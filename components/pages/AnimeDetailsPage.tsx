import React, { useState, useEffect } from 'react';
import { AnimeService, Anime, AnimeEpisode } from '../../services/anime';
import { getPosterUrl } from '../../services/tmdb';
import { isInMyList } from '../../services/myList';
import { WatchProgressService } from '../../services/progress';
import { FriendService } from '../../services/friends';
import type { FriendActivity } from '../../types';
import { triggerHaptic } from '../../utils/haptics';
import { scheduleReminder } from '../../utils/notifications';
import VideoPlayer from '../features/player/VideoPlayer';

interface AnimeDetailsProps {
  anime: Anime;
  onClose: () => void;
  onListUpdate?: () => void;
}

type ViewState = 'overview' | 'episodes';

export default function AnimeDetailsPage({ anime, onClose, onListUpdate }: AnimeDetailsProps) {
  const [view, setView] = useState<ViewState>('overview');
  const [fullAnime, setFullAnime] = useState<Anime>(anime);
  const [loading, setLoading] = useState(true);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);
  const [inList, setInList] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [streamTracks, setStreamTracks] = useState<any[]>([]); 
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  
  const [episodes, setEpisodes] = useState<AnimeEpisode[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState<AnimeEpisode | null>(null);
  
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const [resumeEpisode, setResumeEpisode] = useState<{episode: number} | null>(null);
  const [loadingStream, setLoadingStream] = useState(false);
  const [friendsWatching, setFriendsWatching] = useState<FriendActivity[]>([]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    async function loadDetails() {
      setLoading(true);
      try {
        const details = await AnimeService.getDetails(anime.id);
        if (details) {
            setFullAnime(details);
            if (details.episodesList) {
                setEpisodes(details.episodesList);
            }
        }
        if (!isNaN(Number(anime.id))) {
            setInList(isInMyList(Number(anime.id)));
        }
      } catch (e) { console.error(e); }
      setLoading(false);
    }
    loadDetails();
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'auto'; };
  }, [anime.id]);

  useEffect(() => {
    async function loadFriends() {
       try {
           const activity = await FriendService.getFriendActivity();
           const relevant = activity.filter(a => a.item.id.toString() === anime.id.toString());
           setFriendsWatching(relevant);
       } catch (e) { console.error(e); }
    }
    loadFriends();
  }, [anime.id]);

  useEffect(() => {
    async function loadProgress() {
      try {
        const p = await WatchProgressService.getProgress('anime' as any, anime.id);
        if (p && (p as any).episode_number) {
           setResumeEpisode({ episode: (p as any).episode_number });
        }
      } catch (e) { console.error(e); }
    }
    loadProgress();
  }, [anime.id]);

  const handlePlayEpisode = async (episode: AnimeEpisode) => {
      triggerHaptic('heavy');
      if (loadingStream) return;
      
      try {
          const itemToSave = { ...fullAnime, mediaType: 'anime' };
          await WatchProgressService.saveProgress(itemToSave as any, 1, 0, undefined, episode.number);
      } catch (e) { console.warn(e); } 

      setLoadingStream(true);
      setSelectedEpisode(episode);
      setStreamTracks([]); 
      
      try {
          const servers = await AnimeService.getServers(episode.id);
          if (servers && servers.length > 0) {
             let foundSource = false;
             for (const server of servers) {
                 try {
                     const sources = await AnimeService.getSources(server.serverName, episode.id);
                     if (sources && sources.sources && sources.sources.length > 0) {
                         setStreamUrl(sources.sources[0].url);
                         if (sources.tracks) setStreamTracks(sources.tracks); 
                         setShowPlayer(true);
                         foundSource = true;
                         break;
                     }
                 } catch (err) { console.warn(err); }
             }
             if (!foundSource) alert('No working streams found.');
          } else alert('No servers found.');
      } catch(e) { alert('Failed to load servers.'); } finally { setLoadingStream(false); }
  };

  const handleResumeClick = () => {
    triggerHaptic('heavy');
    if (resumeEpisode) {
        const ep = episodes.find(e => e.number === resumeEpisode.episode);
        if (ep) handlePlayEpisode(ep);
        else if (episodes.length > 0) handlePlayEpisode(episodes[0]); 
    } else if (episodes.length > 0) handlePlayEpisode(episodes[0]);
  };

  const handleClose = () => { triggerHaptic('light'); onClose(); };
  
  const handleRemindMe = () => {
      triggerHaptic('medium');
      scheduleReminder(Number(fullAnime.id) || 0, getTitle(fullAnime), 'tv');
  };

  const getTitle = (a: Anime) => {
      if (typeof a.title === 'string') return a.title;
      return a.title?.userPreferred || a.title?.english || a.title?.romaji || 'Anime';
  };

  const getCoverImage = (a: Anime) => a.coverImage?.extraLarge || a.coverImage?.large || a.coverImage?.medium || a.posterPath;
  const getBannerImage = (a: Anime) => a.bannerImage || a.backdropPath || getCoverImage(a);

  return (
    <div 
      style={{
        position: 'fixed', inset: 0, zIndex: 3000,
        background: 'rgba(10, 10, 10, 0.65)',
        backdropFilter: 'blur(20px) saturate(220%) brightness(0.9)',
        WebkitBackdropFilter: 'blur(15px) saturate(220%) brightness(0.9)',
        overflowY: 'auto', overflowX: 'hidden',
        animation: 'detailsIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        willChange: 'opacity, transform',
        color: '#fff', fontFamily: "'Inter', sans-serif",
      }}
    >
        {view === 'overview' && (
          <button
            onClick={handleClose}
            style={{
              position: 'fixed', top: 'calc(1rem + env(safe-area-inset-top))', right: '1.5rem', zIndex: 3001,
              background: 'rgba(255, 255, 255, 0.15)', backdropFilter: 'blur(10px) saturate(180%)',
              WebkitBackdropFilter: 'blur(10px) saturate(180%)', border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#fff', width: '44px', height: '44px', borderRadius: '50%',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>
        )}

        {view === 'overview' ? (
           <>
            <div style={{ position: 'relative', height: isMobile ? '45vh' : '50vh', width: '100%', minHeight: '350px' }}>
                 <img src={getBannerImage(fullAnime)} alt={getTitle(fullAnime)} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} />
                 <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, #141414 0%, rgba(20,20,20,0.2) 60%, transparent 100%)' }} />
                 <div style={{ position: 'absolute', bottom: '5%', left: '5%', right: '5%', maxWidth: '800px' }}>
                    <h1 style={{ fontSize: 'clamp(1.5rem, 4.5vw, 3rem)', fontWeight: 900, marginBottom: '0.4rem', lineHeight: 1.1 }}>{getTitle(fullAnime)}</h1>
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '1.25rem', fontSize: 'clamp(0.8rem, 1.8vw, 0.9rem)', color: '#bcbcbc' }}>
                       <span style={{ color: '#46d369', fontWeight: 700 }}>{(fullAnime.rating || 0)}% Match</span>
                       <span>{fullAnime.seasonYear || '2024'}</span>
                       <span>{fullAnime.episodes || episodes.length || '?'} Episodes</span>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        <button onClick={handleResumeClick} disabled={loadingStream} style={{ padding: '8px 18px', fontWeight: 800, borderRadius: '6px', border: 'none', background: '#fff', color: '#000', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', height: '38px', opacity: loadingStream ? 0.7 : 1 }}>
                          {loadingStream ? <div className="spinner-sm" style={{ borderTopColor: '#000' }} /> : <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>}
                          {resumeEpisode ? `Resume Ep ${resumeEpisode.episode}` : 'Play Ep 1'}
                        </button>
                        <button onClick={() => setView('episodes')} style={{ padding: '8px 14px', fontWeight: 700, borderRadius: '6px', background: 'rgba(255, 255, 255, 0.1)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', border: '1px solid rgba(255, 255, 255, 0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', height: '38px' }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z" /></svg> Episodes
                        </button>
                        <button onClick={handleRemindMe} style={{ width: '38px', height: '38px', borderRadius: '50%', border: '1px solid rgba(255, 255, 255, 0.2)', background: 'rgba(255, 255, 255, 0.15)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path></svg>
                        </button>
                    </div>
                    {!isMobile && <p style={{ fontSize: '1.1rem', lineHeight: '1.6', maxWidth: '700px' }}>{fullAnime.description?.replace(/<[^>]*>?/gm, '')}</p>}
                 </div>
            </div>
            <div style={{ padding: isMobile ? '1rem' : '0 5% 4rem', marginTop: '1.5rem', animation: 'detailsIn 0.6s both', willChange: 'opacity, transform' }}>
                 {isMobile && (
                   <div style={{ marginBottom: '2rem' }}>
                    <p style={{ fontSize: '0.85rem', lineHeight: '1.4', color: '#ccc', display: '-webkit-box', WebkitLineClamp: isDescriptionExpanded ? 'unset' : 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                       {fullAnime.description?.replace(/<[^>]*>?/gm, '')}
                    </p>
                    {(fullAnime.description?.length || 0) > 100 && (
                      <button onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)} style={{ background: 'none', border: 'none', color: '#fff', fontWeight: '700', padding: '4px 0', fontSize: '0.85rem' }}>
                        {isDescriptionExpanded ? 'Read less' : 'Read more'}
                      </button>
                    )}
                   </div>
                 )}
                 <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))', gap: '2rem' }}>
                      <div><span style={{ color: '#777', display: 'block', fontSize: '0.9rem' }}>Genres</span><span style={{ color: '#fff' }}>{fullAnime.genres?.join(', ')}</span></div>
                      <div><span style={{ color: '#777', display: 'block', fontSize: '0.9rem' }}>Status</span><span style={{ color: '#fff' }}>{fullAnime.status}</span></div>
                 </div>
                 {fullAnime.recommendations && fullAnime.recommendations.length > 0 && (
                    <div style={{ marginTop: '3rem' }}>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '1rem' }}>More Like This</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(auto-fill, minmax(120px, 1fr))', gap: '12px' }}>
                            {fullAnime.recommendations.slice(0, 12).map(rec => (
                                <div key={rec.id} style={{ aspectRatio: '2/3', background: '#333', borderRadius: '4px', overflow: 'hidden', cursor: 'pointer' }} onClick={() => { onClose(); setTimeout(() => window.dispatchEvent(new CustomEvent('movieClick', { detail: rec })), 50); }}>
                                    <img src={getPosterUrl(rec.coverImage?.extraLarge || rec.coverImage?.large || rec.posterPath, 'medium')} alt={getTitle(rec)} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </div>
                            ))}
                        </div>
                    </div>
                 )}
            </div>
           </>
        ) : (
          <div style={{ minHeight: '100vh', background: '#101010', display: 'flex', flexDirection: 'column' }}>
             <div style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(20,20,20,0.4)', backdropFilter: 'blur(15px)', WebkitBackdropFilter: 'blur(15px)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', padding: '12px 5%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 'calc(12px + env(safe-area-inset-top))' }}>
                 <button onClick={() => setView('overview')} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
                    <span>Back</span>
                 </button>
                 <h2 style={{ fontSize: '1rem', fontWeight: 700, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:'50%' }}>{getTitle(fullAnime)}</h2>
                 <div style={{ width: '40px' }} /> 
             </div>
             <div style={{ flex: 1, padding: isMobile ? '10px' : '2rem 15%', overflowY: 'auto', background: '#101010' }}>
                 {episodes.map((ep) => (
                    <div key={ep.id} onClick={() => handlePlayEpisode(ep)} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '10px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', cursor: 'pointer' }}>
                       <div style={{ position: 'relative', width: isMobile ? '130px' : '160px', aspectRatio: '16/9', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, background: '#222' }}>
                             <img src={getCoverImage(fullAnime)} alt={`Ep ${ep.number}`} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }} />
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)' }}>
                               <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                 <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z"/></svg>
                               </div>
                            </div>
                            <div style={{ position: 'absolute', bottom: 4, right: 4, background:'rgba(0,0,0,0.8)', fontSize:'10px', padding:'2px 4px', borderRadius:'2px' }}>EP {ep.number}</div>
                       </div>
                       <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                             <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#fff' }}>{ep.title || `Episode ${ep.number}`}</h4>
                             <p style={{ fontSize: '0.85rem', color: '#bbb', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{`Episode ${ep.number}`}</p>
                       </div>
                    </div>
                 ))}
             </div>
          </div>
        )}

      {showPlayer && streamUrl && (
        <VideoPlayer
          src={streamUrl}
          title={`Ep ${selectedEpisode?.number || ''}: ${selectedEpisode?.title || 'Episode'}`}
          onClose={() => {
              setShowPlayer(false);
              WatchProgressService.getProgress('anime' as any, anime.id).then((p) => {
                  if (p && (p as any).episode_number) setResumeEpisode({ episode: (p as any).episode_number });
              });
          }}
          onNextEpisode={episodes.find(e => e.number === (selectedEpisode?.number || 0) + 1) ? () => handlePlayEpisode(episodes.find(e => e.number === (selectedEpisode?.number || 0) + 1)!) : undefined}
          item={{ ...fullAnime, mediaType: 'anime' } as any} 
          episode={selectedEpisode?.number}
          tracks={streamTracks}
        />
      )}
      <style>{`
         @keyframes detailsIn { from { opacity: 0; transform: scale(1.02); } to { opacity: 1; transform: scale(1); } }
         @keyframes spin { to { transform: rotate(360deg); } }
         ::-webkit-scrollbar { width: 6px; }
         ::-webkit-scrollbar-track { background: #0a0a0a; }
         ::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
      `}</style>
    </div>
  );
}
