import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { WatchProgressService } from '../../../services/progress';
import { StatusBar } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import type { Movie, TVShow } from '../../../types';

const isNative = Capacitor.isNativePlatform();

interface VideoPlayerProps {
  src: string;
  title: string;
  onClose: () => void;
  onNextEpisode?: () => void;
  item?: Movie | TVShow;
  season?: number;
  episode?: number;
  tracks?: { file: string; label: string; kind: string; default?: boolean }[];
}

export default function VideoPlayer({ src, title, onClose, onNextEpisode, item, season, episode, tracks }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeout = useRef<NodeJS.Timeout | null>(null);
  const progressRef = useRef<{time: number, duration: number}>({time: 0, duration: 0});
  const hlsRef = useRef<Hls | null>(null);
  
  // --- Custom Player State (Enhanced Mobile UI) ---
  const [playing, setPlaying] = useState(true);
  const [buffering, setBuffering] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [qualities, setQualities] = useState<{height: number, index: number}[]>([]);
  const [currentQuality, setCurrentQuality] = useState(-1); // -1 = Auto
  const [seekJump, setSeekJump] = useState<'forward' | 'rewind' | null>(null); // For animation
  
  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const togglePlay = async (e?: any) => {
      e?.stopPropagation();
      if (!videoRef.current) return;
      
      // Fullscreen on Play (Gesture safe)
      if (videoRef.current.paused && containerRef.current && !document.fullscreenElement) {
          try {
              if (containerRef.current.requestFullscreen) {
                  await containerRef.current.requestFullscreen();
              } else if ((containerRef.current as any).webkitRequestFullscreen) {
                  await (containerRef.current as any).webkitRequestFullscreen();
              }
          } catch (err) {
              console.log('Fullscreen request failed (expected on some browsers):', err);
          }
      }

      if (videoRef.current.paused) {
          videoRef.current.play().catch(() => {});
          setPlaying(true);
      } else {
          videoRef.current.pause();
          setPlaying(false);
      }
      resetControlsTimeout();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
      const time = parseFloat(e.target.value);
      if (videoRef.current) {
          videoRef.current.currentTime = time;
          setCurrentTime(time);
      }
      resetControlsTimeout();
  };
  
  const handleDoubleTap = (e: React.MouseEvent) => {
      const width = document.body.clientWidth;
      const x = e.clientX;
      const isRight = x > width / 2;
      
      if (videoRef.current) {
          videoRef.current.currentTime += isRight ? 10 : -10;
          setSeekJump(isRight ? 'forward' : 'rewind');
          setTimeout(() => setSeekJump(null), 500); // Reset animation
      }
  };
  // ------------------------------------------------
  
  // --- Google Cast Integration ---
  const [isCastAvailable, setIsCastAvailable] = useState(false);
  const [castConnected, setCastConnected] = useState(false);
  const remotePlayer = useRef<any>(null);
  const remotePlayerController = useRef<any>(null);

  useEffect(() => {
    const initCast = () => {
       if (window.chrome && window.chrome.cast && window.cast) {
          setIsCastAvailable(true);
          const context = window.cast.framework.CastContext.getInstance();
          
          context.setOptions({
            receiverApplicationId: window.chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
            autoJoinPolicy: window.chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
          });

          remotePlayer.current = new window.cast.framework.RemotePlayer();
          remotePlayerController.current = new window.cast.framework.RemotePlayerController(remotePlayer.current);
          
          const updateState = () => {
              setCastConnected(remotePlayer.current.isConnected);
          };
          
          remotePlayerController.current.addEventListener(
             window.cast.framework.RemotePlayerEventType.IS_CONNECTED_CHANGED,
             updateState
          );
          
          // Initial check
          if (remotePlayer.current.isConnected) updateState();
       }
    };
    
    // Check if API is already available or wait for it
    if (window['__onGCastApiAvailable']) {
        initCast();
    } else {
        window['__onGCastApiAvailable'] = (isAvailable: boolean) => {
            if (isAvailable) initCast();
        };
    }
  }, []);

  // Load Media into Cast Session
  useEffect(() => {
    if (castConnected && src && window.cast) {
        const session = window.cast.framework.CastContext.getInstance().getCurrentSession();
        if (session) {
            // Ensure absolute URL
            const streamUrl = src.startsWith('http') ? src : new URL(src, window.location.href).href;
            const contentType = streamUrl.includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4';
            
            const mediaInfo = new window.chrome.cast.media.MediaInfo(streamUrl, contentType);
            mediaInfo.metadata = new window.chrome.cast.media.GenericMediaMetadata();
            mediaInfo.metadata.title = title;
            mediaInfo.metadata.images = [];
            
            if (item && (item as any).posterPath) {
               mediaInfo.metadata.images.push(new window.chrome.cast.Image(`https://image.tmdb.org/t/p/w500${(item as any).posterPath}`));
            }

            const request = new window.chrome.cast.media.LoadRequest(mediaInfo);
            session.loadMedia(request).catch((e: any) => console.error('Cast Load Error:', e));
        }
    }
  }, [castConnected, src, title, item]);

  const handleCastClick = () => {
      if (window.cast) {
          window.cast.framework.CastContext.getInstance().requestSession();
      }
  };

  // Determine if source is direct HLS
  const isHls = src.includes('.m3u8');
  // If not HLS and not a direct file, assume it's an embed or standard URL meant for iframe
  const isDirectFile = src.match(/\.(mp4|webm|ogg|m3u8)(\?|$)/i);
  const useNativePlayer = isHls || isDirectFile;

  // Auto-hide controls after 3 seconds
  const resetControlsTimeout = () => {
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    setShowControls(true);
    controlsTimeout.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  };

  useEffect(() => {
    resetControlsTimeout();
    return () => {
      if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    };
  }, []);

  const didInitRef = useRef(false);

  // --- Immersive UI Setup ---
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;
    
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    // We wrap this in a timeout to ensure the element is actually rendered
    // and to lessen the chance of "user gesture" issues during mount
    const timer = setTimeout(async () => {
        if (containerRef.current) {
            try {
                if (isNative) {
                    await StatusBar.hide();
                    await StatusBar.setOverlaysWebView({ overlay: true });
                }
                
                // Only request fullscreen during setup if we can (usually fails on web without gesture)
                if (isNative && !document.fullscreenElement) {
                   if (containerRef.current.requestFullscreen) {
                       await containerRef.current.requestFullscreen().catch(() => {});
                   }
                }

                if (isMobile) {
                    // Keep Screen Awake during playback
                    if (isNative) { // Only call Capacitor plugin on native
                        try {
                            const { KeepAwake } = await import('@capacitor-community/keep-awake');
                            await KeepAwake.keepAwake();
                        } catch (e) {
                            console.log('KeepAwake not available:', e);
                        }
                    }
                    
                    // Lock to Landscape Orientation
                    if (isNative) { // Only call Capacitor plugin on native
                        try {
                            const { ScreenOrientation } = await import('@capacitor/screen-orientation');
                            await ScreenOrientation.lock({ orientation: 'landscape' });
                        } catch (e) {
                            try {
                                if (screen.orientation && (screen.orientation as any).lock) {
                                    await (screen.orientation as any).lock('landscape');
                                }
                            } catch (webErr) {
                                console.log('Screen orientation lock not supported:', webErr);
                            }
                        }
                    } else { // Web fallback for orientation
                        try {
                            if (screen.orientation && (screen.orientation as any).lock) {
                                await (screen.orientation as any).lock('landscape');
                            }
                        } catch (webErr) {
                            console.log('Screen orientation lock not supported on web:', webErr);
                        }
                    }
                }

            } catch (e) {
                console.log('Immersion setup failed (expected on web if not triggered by click):', e);
            }
        }
    }, 100);

    return () => {
        clearTimeout(timer);
        if (isNative) {
            StatusBar.show().catch(() => {});
            StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
        }
        if (document.fullscreenElement) {
           document.exitFullscreen().catch(() => {});
        }

        if (isMobile) {
            // Allow Screen to Sleep
            if (isNative) {
                const disableKeepAwake = async () => {
                    try {
                        const { KeepAwake } = await import('@capacitor-community/keep-awake');
                        await KeepAwake.allowSleep();
                    } catch (e) {}
                };
                disableKeepAwake();
            }
            
            // Unlock Orientation
            if (isNative) {
                const unlockOrientation = async () => {
                    try {
                        const { ScreenOrientation } = await import('@capacitor/screen-orientation');
                        await ScreenOrientation.unlock();
                    } catch (e) {
                        try {
                            if (screen.orientation && screen.orientation.unlock) {
                                screen.orientation.unlock();
                            }
                        } catch (webErr) {}
                    }
                };
                unlockOrientation();
            } else {
                try {
                    if (screen.orientation && screen.orientation.unlock) {
                        screen.orientation.unlock();
                    }
                } catch (webErr) {}
            }
        }
    };
  }, []);

  // Handle HLS Playback
  useEffect(() => {
      if (useNativePlayer && videoRef.current && isHls) {
          if (Hls.isSupported()) {
              const hls = new Hls();
              hlsRef.current = hls;
              hls.loadSource(src);
              hls.attachMedia(videoRef.current);
              hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
                  const levels = data.levels.map((lvl, index) => ({
                      height: lvl.height,
                      index: index
                  })).sort((a, b) => b.height - a.height); // Highest first
                  setQualities(levels);
                  videoRef.current?.play().catch(e => console.error("Auto-play blocked", e));
              });
              return () => {
                  hls.destroy();
                  hlsRef.current = null;
              };
          } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
              // Native HLS (Safari)
              videoRef.current.src = src;
              videoRef.current.addEventListener('loadedmetadata', () => {
                  videoRef.current?.play().catch(e => console.error("Auto-play blocked", e));
              });
          }
      } else if (useNativePlayer && videoRef.current) {
          // Standard video file
          videoRef.current.src = src;
          videoRef.current.play().catch(e => console.error("Auto-play blocked", e));
      }
  }, [src, useNativePlayer, isHls]);

  // Track progress...
  useEffect(() => {
    if (!item) return;

    if (useNativePlayer) {
      // NATIVE PLAYER LOGIC (Precision Tracking + UI Sync)
      const handleTimeUpdate = () => {
          if (videoRef.current) {
               const cTime = videoRef.current.currentTime;
               const dur = videoRef.current.duration || 0;
               
               // Sync State
               setCurrentTime(cTime);
               if (dur > 0) setDuration(dur);
               
               // Sync Ref for closing save
               progressRef.current = { time: cTime, duration: dur };
          }
      };

      const handlePause = () => {
          setPlaying(false);
          if (progressRef.current.time > 0 && progressRef.current.duration > 0) {
             console.log('Saving progress on pause/close:', progressRef.current);
             WatchProgressService.saveProgress(item, progressRef.current.time, progressRef.current.duration, season, episode);
          }
      };
      
      const setupListeners = () => {
         if (videoRef.current) {
             videoRef.current.addEventListener('timeupdate', handleTimeUpdate);
             videoRef.current.addEventListener('pause', handlePause);
             videoRef.current.addEventListener('play', () => { setPlaying(true); setBuffering(false); resetControlsTimeout(); });
             videoRef.current.addEventListener('waiting', () => setBuffering(true));
             videoRef.current.addEventListener('playing', () => setBuffering(false));
             videoRef.current.addEventListener('ended', handlePause);
             
             // Initial duration check
             if (videoRef.current.duration) setDuration(videoRef.current.duration);
         }
      };

      setupListeners();
      
      const interval = setInterval(() => {
        if (videoRef.current) {
             const currentTime = videoRef.current.currentTime;
             const duration = videoRef.current.duration;
             progressRef.current = { time: currentTime, duration };
             
             if (currentTime > 0 && duration > 0) {
                 WatchProgressService.saveProgress(item, currentTime, duration, season, episode);
             }
        }
      }, 15000); 

      return () => {
          clearInterval(interval);
          if (videoRef.current) {
             videoRef.current.removeEventListener('timeupdate', handleTimeUpdate);
             videoRef.current.removeEventListener('pause', handlePause);
             videoRef.current.removeEventListener('ended', handlePause);
          }
          
          if (progressRef.current.time > 0 && progressRef.current.duration > 0) {
               WatchProgressService.saveProgress(item, progressRef.current.time, progressRef.current.duration, season, episode);
          }
      };

    } else {
      // IFRAME / EXTERNAL PLAYER LOGIC (Basic Heartbeat)
      // Save immediately to mark as "Watching"
      const doSave = async (msg: string) => {
          console.log(`External Player: ${msg}`);
          await WatchProgressService.saveProgress(item, 1, 0, season, episode);
      };

      doSave('Saving initial progress');

      const interval = setInterval(() => {
           doSave('Saving heartbeat');
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [item, season, episode, useNativePlayer]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFullscreen = !!(document.fullscreenElement || (document as any).webkitFullscreenElement);
      if (!isFullscreen && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
        // Optional: onClose(); // Do not close on exit fullscreen for native player as it might be user action
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [onClose]);

  const [nextEpisodeVisible, setNextEpisodeVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setNextEpisodeVisible(true);
    }, 60000); // Only show Next Episode after 60 seconds
    return () => clearTimeout(timer);
  }, [src]);

  // Handle Keyboard / TV Remote Inputs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Back Navigation
      if (e.key === 'Escape' || e.key === 'Backspace') {
          onClose();
          return;
      }

      // TV Remote / Keyboard Shortcuts
      if (useNativePlayer && videoRef.current) {
          switch(e.key) {
              case ' ':
              case 'Enter': // OK Button
                  e.preventDefault();
                  togglePlay();
                  break;
              case 'ArrowLeft': // Seek Back
                  e.preventDefault();
                  videoRef.current.currentTime -= 10;
                  setSeekJump('rewind');
                  setTimeout(() => setSeekJump(null), 500);
                  resetControlsTimeout();
                  break;
              case 'ArrowRight': // Seek Forward
                  e.preventDefault();
                  videoRef.current.currentTime += 10;
                  setSeekJump('forward');
                  setTimeout(() => setSeekJump(null), 500);
                  resetControlsTimeout();
                  break;
              case 'ArrowUp': // Show Controls
              case 'ArrowDown':
                  e.preventDefault();
                  setShowControls(true);
                  resetControlsTimeout();
                  break;
          }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    // Capacitor Hardware Back Button
    let backListener: any;
    const setupBackListener = async () => {
      try {
        const { App } = await import('@capacitor/app');
        backListener = await App.addListener('backButton', () => {
          onClose();
        });
      } catch (e) {
        // console.log('Capacitor App not available');
      }
    };
    setupBackListener();

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (backListener) backListener.remove();
    };
  }, [onClose, useNativePlayer]);

  // Determine the correct embed URL for iframe
  const getEmbedUrl = () => {
    // 1. If we have a direct source (e.g. from Screenscape/VideoSource), use it
    if (src && src.includes('http')) return src;

    // 2. Otherwise constuct VidSrc URL
    if (item) {
      // Anime Check (Using numeric ID assumption from earlier logic or specific flags if we had them)
      // Ideally we should track 'isAnime' but for now let's rely on passed props
      const isTV = 'name' in item || !!season || !!episode;
      
      if (isTV && season && episode) {
        // TV Show
        return `https://vidsrc.icu/embed/tv/${item.id}/${season}/${episode}`;
      } else {
        // Movie
        return `https://vidsrc.icu/embed/movie/${item.id}`;
      }
    }

    return src;
  };

  const [showSettings, setShowSettings] = useState(false);
  
  const handleTrackSelect = (index: number) => {
     if (videoRef.current && videoRef.current.textTracks) {
         // Disable all first
         for (let i = 0; i < videoRef.current.textTracks.length; i++) {
             videoRef.current.textTracks[i].mode = 'hidden';
         }
         // Enable selected
         if (index >= 0 && videoRef.current.textTracks[index]) {
            videoRef.current.textTracks[index].mode = 'showing';
         }
     }
     setShowSettings(false);
     resetControlsTimeout();
  };

  const handleQualitySelect = (index: number) => {
      if (hlsRef.current) {
          hlsRef.current.currentLevel = index;
          setCurrentQuality(index);
          setShowSettings(false);
          resetControlsTimeout();
      }
  };

  const handleContextMenu = (e: React.MouseEvent) => e.preventDefault();

  return (
    <div
      ref={containerRef}
      className="video-player-overlay"
      onContextMenu={handleContextMenu}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#000',
        display: 'flex',
        flexDirection: 'column',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* Settings Modal */}
      {showSettings && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 10020, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowSettings(false)}>
              <div style={{ background: '#1a1a1a', borderRadius: '12px', padding: '20px', width: '300px', maxWidth: '90%', maxHeight: '80vh', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.1)' }} onClick={e => e.stopPropagation()}>
                  <h3 style={{ margin: '0 0 16px', color: '#fff', fontSize: '1.2rem', fontWeight: 600 }}>Settings</h3>
                  
                  {/* Quality Section */}
                  {qualities.length > 0 && (
                      <div style={{ marginBottom: '20px' }}>
                          <h4 style={{ margin: '0 0 8px', color: '#aaa', fontSize: '0.9rem', textTransform: 'uppercase' }}>Quality</h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <button 
                                onClick={() => handleQualitySelect(-1)}
                                style={{ 
                                    padding: '12px', borderRadius: '8px', 
                                    background: currentQuality === -1 ? 'rgba(229, 9, 20, 0.2)' : 'rgba(255,255,255,0.05)', 
                                    border: currentQuality === -1 ? '1px solid #E50914' : 'none', 
                                    color: currentQuality === -1 ? '#E50914' : '#fff', 
                                    textAlign: 'left', cursor: 'pointer', fontWeight: 500
                                }}
                              >
                                Auto
                              </button>
                              {qualities.map((q) => (
                                  <button 
                                    key={q.index}
                                    onClick={() => handleQualitySelect(q.index)}
                                    style={{ 
                                        padding: '12px', borderRadius: '8px', 
                                        background: currentQuality === q.index ? 'rgba(229, 9, 20, 0.2)' : 'rgba(255,255,255,0.05)', 
                                        border: currentQuality === q.index ? '1px solid #E50914' : 'none', 
                                        color: currentQuality === q.index ? '#E50914' : '#fff', 
                                        textAlign: 'left', cursor: 'pointer', fontWeight: 500 
                                    }}
                                  >
                                    {q.height}p
                                  </button>
                              ))}
                          </div>
                      </div>
                  )}

                  {/* Subtitles Section */}
                  {tracks && tracks.length > 0 && (
                      <div>
                          <h4 style={{ margin: '0 0 8px', color: '#aaa', fontSize: '0.9rem', textTransform: 'uppercase' }}>Subtitles</h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <button 
                                onClick={() => handleTrackSelect(-1)}
                                style={{ padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', textAlign: 'left', cursor: 'pointer' }}
                              >
                                Off
                              </button>
                              {tracks.map((track, i) => (
                                  <button 
                                    key={i}
                                    onClick={() => handleTrackSelect(i)}
                                    style={{ padding: '12px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', textAlign: 'left', cursor: 'pointer' }}
                                  >
                                    {track.label || `Track ${i+1}`}
                                  </button>
                              ))}
                          </div>
                      </div>
                  )}

                  <button onClick={() => setShowSettings(false)} style={{ marginTop: '20px', width: '100%', padding: '12px', background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', borderRadius: '8px', cursor: 'pointer' }}>Close</button>
              </div>
          </div>
      )}

      {/* 
         =============================================
         VIDEO LAYER 
         =============================================
      */}
      {useNativePlayer ? (
        <video 
            ref={videoRef}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            playsInline
            crossOrigin="anonymous" // Important for captions
        >
            {tracks && tracks.map((track, i) => (
                <track 
                    key={i}
                    kind={track.kind || 'subtitles'}
                    label={track.label || `Track ${i+1}`}
                    srcLang={track.label ? track.label.substring(0, 2).toLowerCase() : 'en'}
                    src={track.file}
                    default={track.default}
                />
            ))}
        </video>
      ) : (
        <iframe
            ref={iframeRef}
            src={getEmbedUrl()}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            sandbox="allow-forms allow-pointer-lock allow-same-origin allow-scripts allow-presentation"
            allowFullScreen
            referrerPolicy="origin"
            style={{ width: '100%', height: '100%', border: 'none' }}
        />
      )}

      {/* 
         =============================================
         CUSTOM OVERLAY (Only for Native Player)
         =============================================
      */}
      {useNativePlayer && (
        <>
            {/* Gesture Layer (Invisible) */}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', zIndex: 10000 }}>
                 {/* Left Zone (Rewind) */}
                 <div 
                    style={{ flex: 1, height: '100%', cursor: showControls ? 'default' : 'none' }}
                    onClick={(e) => { e.stopPropagation(); setShowControls(prev => !prev); resetControlsTimeout(); }}
                    onDoubleClick={(e) => { e.stopPropagation(); videoRef.current!.currentTime -= 10; setSeekJump('rewind'); setTimeout(() => setSeekJump(null), 600); resetControlsTimeout(); }}
                 />
                 {/* Right Zone (Forward) */}
                 <div 
                    style={{ flex: 1, height: '100%', cursor: showControls ? 'default' : 'none' }}
                    onClick={(e) => { e.stopPropagation(); setShowControls(prev => !prev); resetControlsTimeout(); }}
                    onDoubleClick={(e) => { e.stopPropagation(); videoRef.current!.currentTime += 10; setSeekJump('forward'); setTimeout(() => setSeekJump(null), 600); resetControlsTimeout(); }}
                 />
            </div>

            {/* Visual Feedback Layer (Buffering / Seek) */}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 10005 }}>
                {buffering && (
                    <div style={{ 
                        width: '50px', height: '50px', 
                        border: '4px solid rgba(255,255,255,0.2)', borderTopColor: '#E50914', 
                        borderRadius: '50%', animation: 'spin 0.8s linear infinite' 
                    }} />
                )}
                
                {seekJump && (
                    <div style={{ 
                        background: 'rgba(0,0,0,0.7)', 
                        backdropFilter: 'blur(10px)',
                        padding: '16px 24px', 
                        borderRadius: '30px', 
                        color: '#fff', 
                        fontWeight: 700,
                        fontSize: '1.2rem',
                        display: 'flex', 
                        alignItems: 'center',
                        gap: '10px',
                        animation: 'fadeIn 0.2s ease-out'
                    }}>
                       {seekJump === 'rewind' ? (
                           <><svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></svg> <span>10s</span></>
                       ) : (
                           <><span>10s</span> <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg></>
                       )}
                    </div>
                )}
            </div>

            {/* CONTROLS UI */}
            <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10010,
                opacity: showControls ? 1 : 0, transition: 'opacity 0.25s ease-out',
                background: showControls ? 'radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.6) 80%)' : 'transparent',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
            }}>
                
                {/* Top Bar */}
                <div style={{ 
                    padding: '24px 24px 60px', 
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, transparent 100%)',
                    display: 'flex', alignItems: 'center', gap: '20px', pointerEvents: 'auto',
                    transform: showControls ? 'translateY(0)' : 'translateY(-20px)',
                    transition: 'transform 0.25s ease-out'
                }}>
                     <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
                         <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
                     </button>
                     <div style={{ flex: 1, minWidth: 0 }}>
                        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: '#fff', textShadow: '0 2px 4px rgba(0,0,0,0.5)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</h2>
                        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', marginTop: '2px', fontWeight: 500 }}>High Quality • Native Player</div>
                     </div>
                     
                     {/* Settings Button (Quality / Subtitles) */}
                     {(qualities.length > 0 || (tracks && tracks.length > 0)) && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowSettings(true); }}
                          style={{
                            background: 'rgba(255, 255, 255, 0.1)',
                            border: 'none',
                            color: showSettings ? '#E50914' : '#fff',
                            width: '44px',
                            height: '44px',
                            borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            backdropFilter: 'blur(4px)'
                          }}
                        >
                           {/* Gear Icon */}
                           <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                        </button>
                     )}
                     
                     {/* Google Cast Button */}
                     {isCastAvailable && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleCastClick(); }}
                          style={{
                            background: castConnected ? '#E50914' : 'rgba(255, 255, 255, 0.1)',
                            border: 'none',
                            color: '#fff',
                            width: '44px',
                            height: '44px',
                            borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            backdropFilter: 'blur(4px)'
                          }}
                        >
                           <svg style={{ width: '22px', height: '22px' }} viewBox="0 0 24 24"><path fill="currentColor" d="M21,3H3C1.9,3,1,3.9,1,5v3h2V5h18v14h-7v2h7c1.1,0,2-0.9,2-2V5C23,3.9,22.1,3,21,3z M1,18v3h3C4,19.34,2.66,18,1,18z M1,14v2c2.76,0,5,2.24,5,5h2C8,17.13,4.87,14,1,14z M1,10v2c4.97,0,9,4.03,9,9h2C12,14.92,7.07,10,1,10z"/></svg>
                        </button>
                     )}
                </div>

                {/* Big Center Play Button (Only when paused) */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                     {!playing && !buffering && (
                         <button 
                             onClick={(e) => { e.stopPropagation(); togglePlay(e); }}
                             style={{ 
                                 width: '80px', height: '80px', 
                                 borderRadius: '50%', 
                                 background: 'rgba(0,0,0,0.5)', 
                                 border: '2px solid rgba(255,255,255,0.8)',
                                 backdropFilter: 'blur(4px)',
                                 color: '#fff',
                                 display: 'flex', alignItems: 'center', justifyContent: 'center',
                                 pointerEvents: 'auto',
                                 transform: 'scale(1)',
                                 transition: 'transform 0.1s'
                             }}
                         >
                             <svg width="40" height="40" fill="currentColor" viewBox="0 0 24 24" style={{ marginLeft: '4px' }}><path d="M8 5v14l11-7z"/></svg>
                         </button>
                     )}
                </div>

                {/* Bottom Bar */}
                <div style={{ 
                    padding: '60px 24px 40px', 
                    background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, transparent 100%)',
                    pointerEvents: 'auto',
                    transform: showControls ? 'translateY(0)' : 'translateY(20px)',
                    transition: 'transform 0.25s ease-out'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
                        <button onClick={(e) => { e.stopPropagation(); togglePlay(e); }} style={{ background: 'transparent', border: 'none', color: '#fff', padding: 0 }}>
                            {playing ? (
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                            ) : (
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                            )}
                        </button>

                        <div style={{ flex: 1 }}>
                           {/* Custom Range Slider handled via CSS mostly, but styling inline here */}
                           <input 
                              type="range" 
                              min="0" max={duration || 100} 
                              value={currentTime} 
                              onChange={handleSeek}
                              onMouseDown={resetControlsTimeout}
                              onTouchStart={resetControlsTimeout}
                              style={{
                                  width: '100%',
                                  height: '4px',
                                  borderRadius: '2px',
                                  accentColor: '#E50914',
                                  cursor: 'pointer',
                                  outline: 'none',
                                  background: `linear-gradient(to right, #E50914 ${(currentTime / (duration || 1)) * 100}%, rgba(255,255,255,0.3) ${(currentTime / (duration || 1)) * 100}%)`
                              }}
                           />
                        </div>
                        
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'rgba(255,255,255,0.9)' }}>
                            {formatTime(currentTime)} / {formatTime(duration)}
                        </div>
                    </div>
                </div>

            </div>
        </>
      )}

      {/* 
         =============================================
         IFRAME CONTROLS (Fallback) 
         =============================================
      */}
      {!useNativePlayer && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: '100px',
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.9), transparent)',
            padding: 'calc(10px + env(safe-area-inset-top, 0px)) 20px', 
            display: 'flex', alignItems: 'center', gap: '20px',
            opacity: showControls ? 1 : 0, transition: 'opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1)', 
            pointerEvents: showControls ? 'auto' : 'none',
            zIndex: 100
          }}>
             <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)' }}>
                 <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
             </button>
             {/* Hide app title in fallback mode as iframe usually provides it (avoids double title) */}
             <div style={{ flex: 1 }} />
          </div>
      )}

    </div>
  );
}
