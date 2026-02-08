import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { WatchProgressService } from '../../../services/progress';
import { StatusBar } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import type { Movie, TVShow } from '../../../types';
import { SettingsService } from '../../../services/settings';
import { StreamService } from '../../../services/StreamService';

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
  const [resolving, setResolving] = useState(false);
  const [castSource, setCastSource] = useState<string | null>(null);
  const [resolvedTracks, setResolvedTracks] = useState<VideoPlayerProps['tracks']>([]);
  
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
      
      // If casting, toggle remote player
      if (castConnected && remotePlayerController.current) {
          remotePlayerController.current.playPause();
          setPlaying(!remotePlayer.current.isPaused);
          return;
      }

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
      
      if (castConnected && remotePlayerController.current) {
          remotePlayer.current.currentTime = time;
          remotePlayerController.current.seek();
          setCurrentTime(time);
          return;
      }

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
          
          const syncMediaState = () => {
              if (remotePlayer.current.isConnected) {
                  setPlaying(!remotePlayer.current.isPaused);
                  setCurrentTime(remotePlayer.current.currentTime);
                  setDuration(remotePlayer.current.duration);
              }
          };
          
          remotePlayerController.current.addEventListener(
             window.cast.framework.RemotePlayerEventType.IS_CONNECTED_CHANGED,
             updateState
          );

          remotePlayerController.current.addEventListener(
             window.cast.framework.RemotePlayerEventType.IS_PAUSED_CHANGED,
             syncMediaState
          );

          remotePlayerController.current.addEventListener(
             window.cast.framework.RemotePlayerEventType.CURRENT_TIME_CHANGED,
             () => {
                 const newTime = remotePlayer.current.currentTime;
                 setCurrentTime(prevTime => {
                     // Only update if difference is significant to avoid slider jitter during drag
                     if (Math.abs(prevTime - newTime) > 0.5) return newTime;
                     return prevTime;
                 });
             }
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
    const activeSrc = castSource || src;
    const activeTracks = resolvedTracks.length > 0 ? resolvedTracks : tracks;

    if (castConnected && activeSrc && window.cast) {
        const session = window.cast.framework.CastContext.getInstance().getCurrentSession();
        if (session) {
            // Ensure absolute URL
            const streamUrl = activeSrc.startsWith('http') ? activeSrc : new URL(activeSrc, window.location.href).href;
            const contentType = streamUrl.includes('.m3u8') ? 'application/x-mpegURL' : 'video/mp4';
            
            const mediaInfo = new window.chrome.cast.media.MediaInfo(streamUrl, contentType);
            mediaInfo.metadata = new window.chrome.cast.media.GenericMediaMetadata();
            mediaInfo.metadata.title = title;
            mediaInfo.metadata.subtitle = (item as any)?.name ? `Season ${season} • Episode ${episode}` : '';
            mediaInfo.metadata.images = [];
            
            if (item && (item as any).posterPath) {
               mediaInfo.metadata.images.push(new window.chrome.cast.Image(`https://image.tmdb.org/t/p/w500${(item as any).posterPath}`));
            }

            // --- Subtitles for Cast ---
            const finalTracks = activeTracks || [];
            if (finalTracks.length > 0) {
               const castTracks = finalTracks.map((track, i) => {
                  const castTrack = new window.chrome.cast.media.Track(i + 1, window.chrome.cast.media.TrackType.TEXT);
                  castTrack.trackContentId = track.file;
                  castTrack.trackContentType = 'text/vtt';
                  castTrack.subtype = window.chrome.cast.media.TextTrackType.SUBTITLES;
                  castTrack.name = track.label;
                  castTrack.language = track.label ? track.label.substring(0, 2).toLowerCase() : 'en';
                  return castTrack;
               });
               mediaInfo.tracks = castTracks;
               mediaInfo.textTrackStyle = new window.chrome.cast.media.TextTrackStyle();
            }

            const request = new window.chrome.cast.media.LoadRequest(mediaInfo);
            
            // If we have local current time, start from there
            if (currentTime > 0) {
                request.currentTime = currentTime;
            }

            console.log('[VideoPlayer] Requesting Cast Media Load:', {
                streamUrl,
                contentType,
                currentTime
            });
            session.loadMedia(request)
                .then(() => console.log('[VideoPlayer] Cast Media Load Success'))
                .catch((e: any) => console.error('Cast Load Error:', e));

            // Sync phone state while casting
            if (videoRef.current && !videoRef.current.paused) {
                videoRef.current.pause();
            }
        }
    }
  }, [castConnected, src, castSource, title, item, resolvedTracks]);

  const handleCastClick = async () => {
      if (!window.cast) return;

      const context = window.cast.framework.CastContext.getInstance();
      
      // If not a direct file, we MUST resolve it first
      if (!useNativePlayer && !castSource) {
          if (resolving) return;
          setResolving(true);
          resetControlsTimeout();

          const result = await StreamService.resolve(
              item?.id || '', 
              (item as any)?.name ? 'tv' : 'movie', 
              season, 
              episode
          );

          setResolving(false);

          if (result) {
              console.log('[VideoPlayer] Resolution success, source:', result.source);
              setCastSource(result.source);
              if (result.subtitles) setResolvedTracks(result.subtitles);
              
              console.log('[VideoPlayer] Requesting Cast session...');
              context.requestSession();
          } else {
              console.warn('[VideoPlayer] Resolution failed');
              alert("Sorry, this provider doesn't support casting yet. Try another one if available!");
          }
      } else {
          context.requestSession();
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

    const setupImmersion = async () => {
        if (!containerRef.current) return;
        
        try {
            // 1. Hide Status Bar immediately
            if (isNative) {
                await StatusBar.hide().catch(() => {});
                await StatusBar.setOverlaysWebView({ overlay: true }).catch(() => {});
            }
            
            // 2. Lock Orientation
            if (isMobile) {
                if (isNative) {
                    try {
                        const { ScreenOrientation } = await import('@capacitor/screen-orientation');
                        await (ScreenOrientation as any).lock({ orientation: 'landscape' }).catch(() => {});
                    } catch (e) {
                         if (screen.orientation?.lock) await (screen.orientation as any).lock('landscape').catch(() => {});
                    }
                } else if (screen.orientation?.lock) {
                    await (screen.orientation as any).lock('landscape').catch(() => {});
                }
            }

            // 3. Keep Awake
            if (isNative) {
                try {
                    const { KeepAwake } = await import('@capacitor-community/keep-awake');
                    await KeepAwake.keepAwake().catch(() => {});
                } catch (e) {}
            }
            
            // 4. Fullscreen LAST to prevent layout jumps during orientation change
            if (!document.fullscreenElement) {
                if (containerRef.current.requestFullscreen) {
                    await containerRef.current.requestFullscreen().catch(() => {});
                } else if ((containerRef.current as any).webkitRequestFullscreen) {
                    await (containerRef.current as any).webkitRequestFullscreen().catch(() => {});
                }
            }
        } catch (e) {
            console.log('Immersion setup failed:', e);
        }
    };

    const timer = setTimeout(setupImmersion, 50);

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
            if (isNative) {
                const disableKeepAwake = async () => {
                    try {
                        const { KeepAwake } = await import('@capacitor-community/keep-awake');
                        await KeepAwake.allowSleep();
                    } catch (e) {}
                };
                disableKeepAwake();
            }
            
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
              hls.on(Hls.Events.MANIFEST_PARSED, () => {
                  setBuffering(false);
                  const levels = hls.levels.map((l, i) => ({ height: l.height, index: i }));
                  setQualities(levels);
                  if (playing) videoRef.current?.play().catch(() => {});
              });
              return () => {
                  hls.destroy();
                  hlsRef.current = null;
              };
          } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
              videoRef.current.src = src;
              videoRef.current.addEventListener('loadedmetadata', () => {
                  videoRef.current?.play().catch(e => console.error("Auto-play blocked", e));
              });
          }
      } else if (useNativePlayer && videoRef.current) {
          videoRef.current.src = src;
          videoRef.current.play().catch(e => console.error("Auto-play blocked", e));
      }
  }, [src, useNativePlayer, isHls]);

  // Track progress...
  useEffect(() => {
    if (!item) return;

    if (useNativePlayer) {
      const handleTimeUpdate = () => {
          if (videoRef.current) {
               const cTime = videoRef.current.currentTime;
               const dur = videoRef.current.duration || 0;
               setCurrentTime(cTime);
               if (dur > 0) setDuration(dur);
               progressRef.current = { time: cTime, duration: dur };
          }
      };

      const handlePause = () => {
          setPlaying(false);
          if (progressRef.current.time > 0 && progressRef.current.duration > 0) {
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
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [onClose]);

  // Handle Keyboard / TV Remote Inputs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Backspace') {
          onClose();
          return;
      }

      if (useNativePlayer && videoRef.current) {
          switch(e.key) {
              case ' ':
              case 'Enter': 
                  e.preventDefault();
                  togglePlay();
                  break;
              case 'ArrowLeft': 
                  e.preventDefault();
                  videoRef.current.currentTime -= 10;
                  setSeekJump('rewind');
                  setTimeout(() => setSeekJump(null), 500);
                  resetControlsTimeout();
                  break;
              case 'ArrowRight': 
                  e.preventDefault();
                  videoRef.current.currentTime += 10;
                  setSeekJump('forward');
                  setTimeout(() => setSeekJump(null), 500);
                  resetControlsTimeout();
                  break;
              case 'ArrowUp': 
              case 'ArrowDown':
                  e.preventDefault();
                  setShowControls(true);
                  resetControlsTimeout();
                  break;
          }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    let backListener: any;
    const setupBackListener = async () => {
      try {
        const { App } = await import('@capacitor/app');
        backListener = await App.addListener('backButton', () => {
          onClose();
        });
      } catch (e) {}
    };
    setupBackListener();

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (backListener) backListener.remove();
    };
  }, [onClose, useNativePlayer]);

  // Determine the correct embed URL for iframe
  const getEmbedUrl = () => {
    // If src is already a proxy URL, use it directly
    if (src && src.startsWith('/vidsrc')) return src;
    
    // If src is a full URL but not the proxy, we might need to handle it or block it
    if (src && src.includes('http')) return src;

    if (item) {
      const isTV = 'name' in item || !!season || !!episode;
      if (isTV && season && episode) {
        return `/vidsrc-cc/v2/embed/tv/${item.id}/${season}/${episode}`;
      } else {
        return `/vidsrc-cc/v2/embed/movie/${item.id}`;
      }
    }
    return src;
  };

  const [showSettings, setShowSettings] = useState(false);
  
  const handleTrackSelect = (index: number) => {
     if (videoRef.current && videoRef.current.textTracks) {
         for (let i = 0; i < videoRef.current.textTracks.length; i++) {
             videoRef.current.textTracks[i].mode = 'hidden';
         }
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

      {useNativePlayer ? (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
          {castConnected ? (
              <div style={{ 
                position: 'absolute', inset: 0, zIndex: 10, 
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(to bottom, #111, #000)',
                gap: '24px',
                textAlign: 'center',
                padding: '20px'
              }}>
                <div style={{ position: 'relative' }}>
                   <img 
                    src={item && (item as any).posterPath ? `https://image.tmdb.org/t/p/w500${(item as any).posterPath}` : ''} 
                    alt={title}
                    style={{ width: '160px', borderRadius: '12px', boxShadow: '0 20px 40px rgba(0,0,0,0.8)', border: '1px solid rgba(255,255,255,0.1)' }}
                   />
                   <div style={{ 
                     position: 'absolute', bottom: '-15px', right: '-15px', 
                     background: '#E50914', borderRadius: '50%', width: '40px', height: '40px',
                     display: 'flex', alignItems: 'center', justifyContent: 'center',
                     boxShadow: '0 4px 10px rgba(229, 9, 20, 0.4)'
                   }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M21,3H3C1.9,3,1,3.9,1,5v3h2V5h18v14h-7v2h7c1.1,0,2-0.9,2-2V5C23,3.9,22.1,3,21,3z M1,18v3h3C4,19.34,2.66,18,1,18z M1,14v2c2.76,0,5,2.24,5,5h2C8,17.13,4.87,14,1,14z M1,10v2c4.97,0,9,4.03,9,9h2C12,14.92,7.07,10,1,10z"/></svg>
                   </div>
                </div>
                <div>
                    <h3 style={{ margin: '0 0 8px', color: '#fff', fontSize: '1.4rem', fontWeight: 700 }}>Playing on TV</h3>
                    <p style={{ margin: 0, color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem' }}>{title}</p>
                </div>
              </div>
          ) : (
            <video 
                ref={videoRef}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                playsInline
                crossOrigin="anonymous"
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
          )}
        </div>
      ) : (
        <iframe
            ref={iframeRef}
            src={getEmbedUrl()}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            // Professional Sandbox: strictly block top-level navigation and popups to prevent ads from hijacking the app window.
            sandbox="allow-forms allow-pointer-lock allow-same-origin allow-scripts allow-presentation"
            allowFullScreen
            referrerPolicy="origin"
            style={{ width: '100%', height: '100%', border: 'none' }}
        />
      )}

      {useNativePlayer && (
        <>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', zIndex: 10000 }}>
                 <div 
                    style={{ flex: 1, height: '100%', cursor: showControls ? 'default' : 'none' }}
                    onClick={(e) => { e.stopPropagation(); setShowControls(prev => !prev); resetControlsTimeout(); }}
                    onDoubleClick={(e) => { e.stopPropagation(); videoRef.current!.currentTime -= 10; setSeekJump('rewind'); setTimeout(() => setSeekJump(null), 600); resetControlsTimeout(); }}
                 />
                 <div 
                    style={{ flex: 1, height: '100%', cursor: showControls ? 'default' : 'none' }}
                    onClick={(e) => { e.stopPropagation(); setShowControls(prev => !prev); resetControlsTimeout(); }}
                    onDoubleClick={(e) => { e.stopPropagation(); videoRef.current!.currentTime += 10; setSeekJump('forward'); setTimeout(() => setSeekJump(null), 600); resetControlsTimeout(); }}
                 />
            </div>

            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 10005 }}>
                {(buffering || resolving) && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                        <div style={{ 
                            width: '50px', height: '50px', 
                            border: '4px solid rgba(255,255,255,0.2)', borderTopColor: '#E50914', 
                            borderRadius: '50%', animation: 'spin 0.8s linear infinite' 
                        }} />
                        {resolving && <div style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 600, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>Resolving for TV...</div>}
                    </div>
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

            <div style={{
                position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10010,
                opacity: showControls ? 1 : 0, transition: 'opacity 0.25s ease-out',
                background: showControls ? 'radial-gradient(circle at center, transparent 0%, rgba(0,0,0,0.6) 80%)' : 'transparent',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between'
            }}>
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
                           <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                        </button>
                     )}
                     
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
             <div style={{ flex: 1 }} />
             
             {isCastAvailable && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleCastClick(); }}
                  style={{
                    background: castConnected ? '#E50914' : 'rgba(255, 255, 255, 0.2)',
                    border: 'none',
                    color: '#fff',
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    backdropFilter: 'blur(10px)'
                  }}
                >
                   {resolving ? (
                       <div style={{ width: '20px', height: '20px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                   ) : (
                       <svg style={{ width: '22px', height: '22px' }} viewBox="0 0 24 24"><path fill="currentColor" d="M21,3H3C1.9,3,1,3.9,1,5v3h2V5h18v14h-7v2h7c1.1,0,2-0.9,2-2V5C23,3.9,22.1,3,21,3z M1,18v3h3C4,19.34,2.66,18,1,18z M1,14v2c2.76,0,5,2.24,5,5h2C8,17.13,4.87,14,1,14z M1,10v2c4.97,0,9,4.03,9,9h2C12,14.92,7.07,10,1,10z"/></svg>
                   )}
                </button>
             )}
          </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  );
}
