import React, { useState, useEffect, useRef } from 'react';
import type { TVShow, Video, Cast, Crew, Episode } from '../../../types';
import { 
  getBackdropUrl, 
  getTVShowDetails, 
  getTVShowVideos, 
  getSimilarTVShows, 
  getPosterUrl, 
  getTVShowCredits, 
  getProfileUrl,
  getTVShowSeason,
  getStillUrl 
} from '../../../services/tmdb';
import { WatchProgressService } from '../../../services/progress';
import { triggerHaptic } from '../../../utils/haptics';
import { scheduleReminder } from '../../../utils/notifications';
import VideoPlayer from '../player/VideoPlayer';

interface TVShowDetailsProps {
  show: TVShow;
  onClose: () => void;
}

type ViewState = 'overview' | 'episodes';

export default function TVShowDetails({ show, onClose }: TVShowDetailsProps) {
  const [view, setView] = useState<ViewState>('overview');
  const [fullShow, setFullShow] = useState<TVShow>(show);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingTrailer, setPlayingTrailer] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [similarShows, setSimilarShows] = useState<TVShow[]>([]);
  const [cast, setCast] = useState<Cast[]>([]);
  const [crew, setCrew] = useState<Crew[]>([]);
  const [showPlayer, setShowPlayer] = useState(false);
  
  // Season & Episode State
  const [selectedSeason, setSelectedSeason] = useState(1);
  const [selectedEpisode, setSelectedEpisode] = useState(1);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);

  // Mobile Detection
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const [isDub, setIsDub] = useState(false);
  const [isAnime, setIsAnime] = useState(false);
  const [resumeEpisode, setResumeEpisode] = useState<{season: number, episode: number} | null>(null);

  const handleClose = () => {
    triggerHaptic('light');
    onClose();
  };

  const handleRemindMe = () => {
    triggerHaptic('medium');
    scheduleReminder(fullShow.id, fullShow.name, 'tv');
  };

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    async function loadDetails() {
      setLoading(true);
      
      const [details, showVideos, similar, credits] = await Promise.all([
        getTVShowDetails(show.id),
        getTVShowVideos(show.id),
        getSimilarTVShows(show.id),
        getTVShowCredits(show.id),
      ]);
      
      if (details) {
        setFullShow(details);
        const isAnimeShow = details.genres?.some(g => g.name.toLowerCase() === 'animation') && 
                            details.originCountry?.includes('JP');
        setIsAnime(!!isAnimeShow);
      }
      setVideos(showVideos);
      setSimilarShows(similar);
      setCast(credits.cast);
      setCrew(credits.crew);
      
      const progress = await WatchProgressService.getProgress(show.id, 'tv');
      if (progress && progress.season && progress.episode) {
        setResumeEpisode({ season: progress.season, episode: progress.episode });
      }

      setLoading(false);
    }
    
    loadDetails();
    
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [show.id]);

  useEffect(() => {
    async function loadSeasonEpisodes() {
      if (!fullShow.id) return;
      setLoadingEpisodes(true);
      const seasonData = await getTVShowSeason(fullShow.id, selectedSeason);
      if (seasonData && seasonData.episodes) {
        setEpisodes(seasonData.episodes);
      }
      setLoadingEpisodes(false);
    }

    loadSeasonEpisodes();
  }, [fullShow.id, selectedSeason]);

  const handlePlayClick = (episodeNum = 1) => {
    triggerHaptic('heavy');
    setSelectedEpisode(episodeNum);
    setShowPlayer(true);
    setPlayingTrailer(false);
    setView('episodes'); 
  };

  const handleResumeClick = () => {
    triggerHaptic('heavy');
    if (resumeEpisode) {
      setSelectedSeason(resumeEpisode.season);
      setSelectedEpisode(resumeEpisode.episode);
      setShowPlayer(true);
      setPlayingTrailer(false);
      setView('episodes'); 
    } else {
      handlePlayClick(1);
    }
  };

  const handleNextEpisode = () => {
    triggerHaptic('medium');
    const currentEpisodeIndex = episodes.findIndex(ep => ep.episodeNumber === selectedEpisode);
    
    if (currentEpisodeIndex !== -1 && currentEpisodeIndex < episodes.length - 1) {
      setSelectedEpisode(episodes[currentEpisodeIndex + 1].episodeNumber);
    } else if (selectedSeason < (fullShow.numberOfSeasons || 0)) {
      setSelectedSeason(prev => prev + 1);
      setSelectedEpisode(1);
    } else {
      setShowPlayer(false);
      triggerHaptic('medium');
    }
  };

  const trailer = videos.find(v => v.type === 'Trailer' && v.site === 'YouTube') || videos[0];

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 3000,
        // Optimized for performance: lighter blur depth
        background: 'rgba(10, 10, 10, 0.65)',
        backdropFilter: 'blur(20px) saturate(220%) brightness(0.9)',
        WebkitBackdropFilter: 'blur(15px) saturate(220%) brightness(0.9)',
        overflowY: 'auto',
        overflowX: 'hidden',
        animation: 'detailsIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        willChange: 'opacity, transform',
        color: '#fff',
        fontFamily: "'Inter', sans-serif",
      }}
    >
        {view === 'overview' && (
          <button
            onClick={handleClose}
            aria-label="Back"
            style={{
              position: 'fixed',
              top: 'calc(1rem + env(safe-area-inset-top))',
              right: '1.5rem',
              zIndex: 3001,
              background: 'rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(10px) saturate(180%)',
              WebkitBackdropFilter: 'blur(10px) saturate(180%)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#fff',
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
              transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
        )}

        {view === 'overview' ? (
          <>
            <div style={{ 
              position: 'relative', 
              height: isMobile ? '45vh' : '50vh', 
              width: '100%',
              minHeight: '350px'
            }}>
                {playingTrailer && trailer ? (
                  <iframe
                    src={`https://www.youtube.com/embed/${trailer.key}?autoplay=1&rel=0`}
                    title={trailer.name}
                    allow="autoplay; encrypted-media"
                    style={{ width: '100%', height: '100%', border: 'none' }}
                  />
                ) : (
                  <>
                     <img
                       src={getBackdropUrl(fullShow.backdropPath, 'original')}
                       alt={fullShow.name}
                       style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }}
                     />
                     <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(to top, #141414 0%, rgba(20,20,20,0.2) 60%, transparent 100%)',
                     }} />
                     <div style={{
                        position: 'absolute',
                        bottom: '5%',
                        left: '5%',
                        right: '5%',
                        maxWidth: '800px',
                     }}>
                        <h1 style={{ 
                          fontSize: 'clamp(1.5rem, 4.5vw, 3rem)', 
                          fontWeight: 900, 
                          textShadow: '2px 2px 4px rgba(0,0,0,0.5)', 
                          marginBottom: '0.4rem',
                          lineHeight: 1.1,
                          maxWidth: '100%',
                        }}>
                          {fullShow.name}
                        </h1>
                        
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          flexWrap: 'wrap',
                          gap: '8px', 
                          marginBottom: '1.25rem', 
                          fontSize: 'clamp(0.8rem, 1.8vw, 0.9rem)', 
                          color: '#bcbcbc' 
                        }}>
                           <span style={{ color: '#46d369', fontWeight: 700 }}>{Math.round(fullShow.voteAverage * 10)}% Match</span>
                           <span>{fullShow.firstAirDate?.slice(0,4)}</span>
                           <span style={{ border: '1px solid #777', padding: '0 5px', fontSize: '0.75rem', borderRadius: '2px' }}>HD</span>
                           {fullShow.numberOfSeasons && (
                               <span>{fullShow.numberOfSeasons} Season{fullShow.numberOfSeasons !== 1 ? 's' : ''}</span>
                           )}
                        </div>

                        <div style={{ display: 'flex', gap: '12px', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                            <button
                              onClick={handleResumeClick}
                              style={{
                                 padding: isMobile ? '8px 14px' : '10px 18px',
                                 fontSize: isMobile ? '0.85rem' : '0.95rem',
                                 fontWeight: 800,
                                 borderRadius: '6px',
                                 border: 'none',
                                 background: '#fff',
                                  color: '#000',
                                  boxShadow: '0 4px 20px rgba(255, 255, 255, 0.3)',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: '6px',
                                 flex: '1 1 auto',
                                 minWidth: '130px',
                                 height: '38px',
                              }}
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                              {resumeEpisode ? `Resume S${resumeEpisode.season}:E${resumeEpisode.episode}` : 'Play S1:E1'}
                            </button>

                            <button
                              onClick={() => { triggerHaptic('light'); setView('episodes'); }}
                              style={{
                                  padding: '8px 14px',
                                  fontSize: isMobile ? '0.85rem' : '0.95rem',
                                  fontWeight: 700,
                                  borderRadius: '6px',
                                  background: 'rgba(255, 255, 255, 0.1)',
                                  backdropFilter: 'blur(10px) saturate(180%)',
                                  WebkitBackdropFilter: 'blur(10px) saturate(180%)',
                                  border: '1px solid rgba(255, 255, 255, 0.15)',
                                 color: '#fff',
                                 cursor: 'pointer',
                                 display: 'flex',
                                 alignItems: 'center',
                                 justifyContent: 'center',
                                 gap: '6px',
                                 flex: '1 1 auto',
                                 minWidth: '110px',
                                 height: '38px',
                              }}
                            >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z" />
                              </svg>
                              Episodes
                            </button>

                           {trailer && (
                             <button
                               onClick={() => { triggerHaptic('medium'); setPlayingTrailer(!playingTrailer); }}
                               style={{
                                 padding: '12px 16px',
                                 fontSize: 'clamp(0.9rem, 2vw, 1rem)',
                                 fontWeight: 700,
                                 borderRadius: '10px',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                background: 'rgba(255, 255, 255, 0.12)',
                                backdropFilter: 'blur(10px) saturate(180%)',
                                WebkitBackdropFilter: 'blur(10px) saturate(180%)',
                                 color: '#fff',
                                 cursor: 'pointer',
                                 display: 'flex',
                                 alignItems: 'center',
                                 justifyContent: 'center',
                                 gap: '8px',
                                 flex: '1 1 auto',
                                 minWidth: '110px',
                                 boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                                 transition: 'all 0.3s ease',
                               }}
                             >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                   <path d={playingTrailer ? "M6 4h4v16H6V4zm8 0h4v16h-4V4z" : "M8 5v14l11-7z"}/>
                                </svg>
                                {playingTrailer ? 'Stop' : 'Trailer'}
                             </button>
                           )}

                           <button
                             onClick={handleRemindMe}
                             style={{
                                width: '38px',
                                height: '38px',
                                borderRadius: '50%',
                                 border: '1px solid rgba(255, 255, 255, 0.2)',
                                 background: 'rgba(255, 255, 255, 0.1)',
                                 backdropFilter: 'blur(10px) saturate(220%)',
                                 WebkitBackdropFilter: 'blur(10px) saturate(220%)',
                                color: '#fff',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.2s',
                                flexShrink: 0,
                             }}
                             title="Remind me to watch this"
                           >
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                              </svg>
                           </button>
                        </div>

                        {!isMobile && (
                          <p style={{ 
                            fontSize: 'clamp(0.95rem, 1.5vw, 1.1rem)', 
                            lineHeight: '1.6', 
                            textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                            maxWidth: '700px',
                            color: '#ededed',
                            wordBreak: 'break-word',
                            overflowWrap: 'anywhere',
                          }}>
                            {fullShow.overview}
                          </p>
                        )}
                     </div>
                  </>
                )}
            </div>

            <div style={{ 
              padding: isMobile ? '1rem' : '0 5% 4rem', 
              marginTop: isMobile ? '1rem' : '1.5rem',
              animation: 'detailsIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) both',
              animationDelay: '0.1s', 
              maxWidth: '100%',
              overflow: 'hidden',
              willChange: 'opacity, transform',
            }}>
                {isMobile && (
                   <div style={{ marginBottom: '2rem', width: '100%' }}>
                    <p style={{ 
                       fontSize: '0.85rem', 
                       lineHeight: '1.4', 
                       color: '#ccc', 
                       display: '-webkit-box',
                       WebkitLineClamp: isDescriptionExpanded ? 'unset' : 3,
                       WebkitBoxOrient: 'vertical',
                       overflow: 'hidden',
                       transition: 'all 0.3s ease',
                       wordBreak: 'break-word',
                       overflowWrap: 'anywhere',
                       width: '100%',
                       maxWidth: '100%',
                     }}>
                       {fullShow.overview}
                    </p>
                    {fullShow.overview && fullShow.overview.length > 100 && (
                      <button 
                        onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#fff',
                          fontWeight: '700',
                          padding: '4px 0',
                          cursor: 'pointer',
                          fontSize: '0.85rem',
                          opacity: 0.8
                        }}
                      >
                        {isDescriptionExpanded ? 'Read less' : 'Read more'}
                      </button>
                    )}
                   </div>
                )}

                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(0, 1fr))', 
                  gap: 'clamp(2rem, 5vw, 4rem)',
                  width: '100%',
                }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ marginBottom: '3rem' }}>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '1rem', color: '#e5e5e5' }}>Cast</h3>
                        <div style={{ 
                           display: 'flex', 
                           flexWrap: 'nowrap', 
                           gap: isMobile ? '16px' : '24px',
                           overflowX: 'auto',
                       touchAction: 'pan-x',
                       overscrollBehavior: 'contain',
                           paddingBottom: '1rem',
                           WebkitOverflowScrolling: 'touch',
                           scrollSnapType: 'x mandatory',
                           msOverflowStyle: 'none',
                           scrollbarWidth: 'none',
                        }}>
                           {cast.slice(0, 20).map(person => (
                             <div key={person.id} style={{ 
                                textAlign: 'center', 
                                width: isMobile ? '85px' : '100px',
                                flexShrink: 0,
                                scrollSnapAlign: 'start',
                              }}>
                                <img 
                                  src={getProfileUrl(person.profilePath)} 
                                  alt={person.name}
                                  loading="lazy"
                                  style={{ 
                                    width: isMobile ? '85px' : '100px', 
                                    height: isMobile ? '100px' : '90px', 
                                    borderRadius: '50%', 
                                    objectFit: 'cover', 
                                    marginBottom: '8px', 
                                    background: '#333',
                                    border: '1px solid rgba(255,255,255,0.15)',
                                    boxShadow: '0 8px 25px rgba(0,0,0,0.3)',
                                  }}
                                />
                                <div style={{ fontSize: '0.8rem', color: '#ddd', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{person.name}</div>
                             </div>
                           ))}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2rem' }}>
                          <div>
                            <span style={{ color: '#777', display: 'block', marginBottom: '4px', fontSize: '0.9rem' }}>Genres</span>
                            <span style={{ color: '#fff', fontSize: '1rem' }}>{fullShow.genres?.map(g => g.name).join(', ')}</span>
                          </div>
                      </div>
                    </div>

                    <div style={{ minWidth: 0 }}>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: 600, marginBottom: '1rem', color: '#e5e5e5' }}>More Like This</h3>
                        {similarShows.length > 0 ? (
                           <div style={{ 
                              display: 'grid', 
                              gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(auto-fill, minmax(120px, 1fr))', 
                              gap: '12px',
                              width: '100%',
                           }}>
                              {similarShows.slice(0, 6).map(show => (
                                 <div 
                                    key={show.id} 
                                    style={{ 
                                      aspectRatio: '2/3', 
                                      background: '#333', 
                                      borderRadius: '4px', 
                                      overflow: 'hidden', 
                                      cursor: 'pointer',
                                      width: '100%',
                                      maxWidth: '100%',
                                    }}
                                    onClick={() => {
                                       onClose();
                                       setTimeout(() => window.dispatchEvent(new CustomEvent('tvShowClick', { detail: show })), 50);
                                    }}
                                 >
                                    <img src={getPosterUrl(show.posterPath, 'small')} alt={show.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                 </div>
                              ))}
                           </div>
                        ) : (
                          <div style={{ color: '#777' }}>No recommendations found.</div>
                        )}
                    </div>
                </div>
            </div>
          </>
        ) : (
          <div style={{ minHeight: '100vh', background: '#101010', display: 'flex', flexDirection: 'column' }}>
             <div style={{ 
                position: 'sticky', 
                top: 0, 
                zIndex: 100, 
                background: 'rgba(20,20,20,0.4)', 
                 backdropFilter: 'blur(15px) saturate(220%) brightness(1.1)',
                 WebkitBackdropFilter: 'blur(15px) saturate(220%) brightness(1.1)',
                 borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                padding: '12px 5%',
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                paddingTop: 'calc(12px + env(safe-area-inset-top))',
             }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button 
                       onClick={() => setView('overview')}
                       style={{ 
                          background: 'transparent', 
                          border: 'none', 
                          color: '#fff', 
                          cursor: 'pointer', 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '6px', 
                          padding: '8px 0'
                       }}
                    >
                       <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                       <span style={{ fontSize: '1rem', fontWeight: 600 }}>Back</span>
                    </button>
                    {!isMobile && (
                      <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, opacity: 0.9 }}>
                         {fullShow.name}
                      </h2>
                    )}
                 </div>

                 <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                     {isAnime && (
                       <button 
                         onClick={() => setIsDub(!isDub)}
                         style={{
                            background: isDub ? '#E50914' : 'transparent',
                            color: '#fff',
                            border: '1px solid ' + (isDub ? '#E50914' : '#fff'),
                            padding: '6px 10px',
                            fontWeight: 700,
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.75rem'
                         }}
                       >
                         {isDub ? 'DUB' : 'SUB'}
                       </button>
                     )}
                     
                     <div style={{ position: 'relative' }}>
                        <select
                          value={selectedSeason}
                          onChange={(e) => setSelectedSeason(Number(e.target.value))}
                          style={{
                            appearance: 'none',
                            background: 'rgba(255, 255, 255, 0.1)',
                             color: '#fff',
                             border: '1px solid rgba(255, 255, 255, 0.2)',
                            padding: '8px 32px 8px 12px',
                            fontSize: '0.9rem',
                            borderRadius: '12px',
                              cursor: 'pointer',
                              fontWeight: 700,
                              minWidth: '120px',
                              boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                          }}
                        >
                          {Array.from({ length: fullShow.numberOfSeasons || 1 }, (_, i) => i + 1).map(s => (
                            <option key={s} value={s}>Season {s}</option>
                          ))}
                        </select>
                        <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                        </div>
                     </div>
                 </div>
             </div>

             <div style={{ 
                flex: 1, 
                padding: isMobile ? '10px' : '2rem 15%', 
                overflowY: 'auto',
                background: '#101010'
             }}>
                 {loadingEpisodes ? (
                   <div style={{ padding: '4rem', textAlign: 'center', color: '#777' }}>
                      <div className="spinner" style={{ width: '40px', height: '40px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#fff', borderRadius: '50%', margin: '0 auto 1rem', animation: 'spin 1s linear infinite' }}></div>
                      Loading...
                   </div>
                 ) : (
                   episodes.map((ep) => {
                     const stillUrl = getStillUrl(ep.stillPath);
                     return (
                        <div 
                          key={ep.id}
                          onClick={() => handlePlayClick(ep.episodeNumber)}
                          className="episode-row"
                          style={{
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: '15px',
                            padding: '10px 0',
                            borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                            cursor: 'pointer',
                            background: 'transparent', 
                            maxWidth: '100%',
                            overflow: 'hidden',
                          }}
                        >
                           <div style={{ position: 'relative', width: isMobile ? '130px' : '160px', aspectRatio: '16/9', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, background: '#222' }}>
                               {stillUrl ? (
                                 <img 
                                   src={stillUrl} 
                                   alt={ep.name}
                                   loading="lazy"
                                   style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                 />
                               ) : (
                                 <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#555', fontSize: '0.8rem' }}>
                                   No Image
                                 </div>
                               )}
                               
                               <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)' }}>
                                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff" style={{ marginLeft: '2px' }}><path d="M8 5v14l11-7z"/></svg>
                                  </div>
                               </div>
                           </div>

                           <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, gap: '4px' }}>
                                 <h4 style={{ 
                                    fontSize: '0.95rem', 
                                    fontWeight: 700, 
                                    margin: 0, 
                                    color: '#fff', 
                                    lineHeight: '1.2',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                 }}>
                                   {ep.name} <span style={{ fontWeight: 400, opacity: 0.7 }}>- S{selectedSeason},E{ep.episodeNumber}</span>
                                 </h4>

                                 <span style={{ fontSize: '0.8rem', color: '#888', fontWeight: 500 }}>
                                    {ep.airDate || 'Unknown Date'}
                                 </span>
                              
                              <p style={{ 
                                 fontSize: '0.85rem', 
                                 color: '#bbb', 
                                 margin: 0, 
                                 lineHeight: '1.4',
                                 display: '-webkit-box', 
                                 WebkitLineClamp: 2, 
                                 WebkitBoxOrient: 'vertical', 
                                 overflow: 'hidden',
                                 wordBreak: 'break-word',
                              }}>
                                 {ep.overview || `Episode ${ep.episodeNumber} of Season ${selectedSeason}.`}
                              </p>
                           </div>
                        </div>
                     );
                   })
                 )}
             </div>
          </div>
        )}

        {showPlayer && (
          <VideoPlayer
            src={`https://vidsrc.cc/v2/embed/tv/${fullShow.id}/${selectedSeason}/${selectedEpisode}`}
            title={`${fullShow.name} - S${selectedSeason}:E${selectedEpisode}`}
            onClose={() => setShowPlayer(false)}
            onNextEpisode={handleNextEpisode}
            item={fullShow}
            season={selectedSeason}
            episode={selectedEpisode}
          />
        )}
        
        <style>{`
           @keyframes detailsIn {
             from { opacity: 0; transform: scale(1.02); }
             to { opacity: 1; transform: scale(1); }
           }
           @keyframes spin {
              to { transform: rotate(360deg); }
           }
           ::-webkit-scrollbar {
              width: 6px;
           }
           ::-webkit-scrollbar-track {
              background: #0a0a0a; 
           }
           ::-webkit-scrollbar-thumb {
              background: #333; 
              border-radius: 4px;
           }
        `}</style>
    </div>
  );
}
