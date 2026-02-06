import React, { useState, useEffect } from 'react';
import type { Movie, Video, Cast, Crew } from '../../../types';
import { getBackdropUrl, getMovieDetails, getMovieVideos, getSimilarMovies, getPosterUrl, getMovieCredits, getProfileUrl } from '../../../services/tmdb';
import { isInMyList, addToMyList, removeFromMyList } from '../../../services/myList';
import { WatchProgressService } from '../../../services/progress';
import { triggerHaptic } from '../../../utils/haptics';
import { scheduleReminder } from '../../../utils/notifications';
import VideoPlayer from '../player/VideoPlayer';
import { COLORS } from '../../../constants';

interface MovieDetailsProps {
  movie: Movie;
  onClose: () => void;
  onListUpdate?: () => void;
  onActorClick?: (personId: number) => void;
}

export default function MovieDetails({ movie, onClose, onListUpdate, onActorClick }: MovieDetailsProps) {
  const [fullMovie, setFullMovie] = useState<Movie>(movie);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingTrailer, setPlayingTrailer] = useState(false);
  const [inList, setInList] = useState(false);
  const [similarMovies, setSimilarMovies] = useState<Movie[]>([]);
  const [cast, setCast] = useState<Cast[]>([]);
  const [crew, setCrew] = useState<Crew[]>([]);
  const [showPlayer, setShowPlayer] = useState(false);
  const [hasProgress, setHasProgress] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  const [loadingStream, setLoadingStream] = useState(false);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    async function loadDetails() {
      setLoading(true);

      // For TMDB content, fetch full details
      const [details, movieVideos, similar, credits] = await Promise.all([
        getMovieDetails(movie.id),
        getMovieVideos(movie.id),
        getSimilarMovies(movie.id),
        getMovieCredits(movie.id),
      ]);
      
      if (details) setFullMovie(details);
      setVideos(movieVideos);
      setSimilarMovies(similar);
      setCast(credits.cast);
      setCrew(credits.crew);
      setInList(isInMyList(movie.id));
      
      const progress = await WatchProgressService.getProgress(movie.id, 'movie');
      setHasProgress(!!progress);

      setLoading(false);
    }
    
    loadDetails();
    
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [movie.id]);

  const handleToggleList = () => {
    triggerHaptic('medium');
    if (inList) {
      removeFromMyList(movie.id);
      setInList(false);
    } else {
      addToMyList(fullMovie);
      setInList(true);
    }
    onListUpdate?.();
  };

  const handlePlayClick = async () => {
    triggerHaptic('heavy');
    // Using default streaming provider (vidsrc) as fresh start
    setStreamUrl(`https://vidsrc.cc/v2/embed/movie/${fullMovie.id}`);
    setShowPlayer(true);
  };

  const handleRemindMe = () => {
    triggerHaptic('medium');
    scheduleReminder(fullMovie.id, fullMovie.title, 'movie');
  };

  const handleClose = () => {
    triggerHaptic('light');
    onClose();
  };

  const trailer = videos.find(v => v.type === 'Trailer' && v.site === 'YouTube') || videos[0];

  return (
    <div 
      onClick={handleClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 3000,
        background: 'rgba(10, 10, 10, 0.6)',
        backdropFilter: 'blur(25px) saturate(240%) brightness(1.1)',
        WebkitBackdropFilter: 'blur(20px) saturate(220%) brightness(0.9)',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        overflowX: 'hidden',
        animation: 'detailsIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        willChange: 'opacity, transform',
      }}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{
          minHeight: '100vh',
          background: '#0a0a0a',
          position: 'relative',
          width: '100%',
          maxWidth: '100%',
        }}
      >
        {/* Navigation Back/Close Button */}
        <button
          onClick={handleClose}
          aria-label="Back"
          style={{
            position: 'fixed',
            top: 'calc(1.5rem + env(safe-area-inset-top))',
            right: '1.5rem',
            zIndex: 3001,
            background: 'rgba(255, 255, 255, 0.12)',
            backdropFilter: 'blur(15px) saturate(220%)',
            WebkitBackdropFilter: 'blur(15px) saturate(180%)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            color: '#fff',
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>

        {/* Cinematic Backdrop */}
        <div style={{
          position: 'relative',
          width: '100%',
          height: isMobile ? '40vh' : '45vh',
          maxHeight: '500px',
        }}>
           {playingTrailer && trailer ? (
            <div style={{ position: 'relative', width: '100%', height: '100%', background: '#000' }}>
               <iframe
                src={`https://www.youtube.com/embed/${trailer.key}?autoplay=1&rel=0`}
                title={trailer.name}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ width: '100%', height: '100%', border: 'none' }}
              />
            </div>
           ) : (
             <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                <img
                  src={getBackdropUrl(fullMovie.backdropPath, 'original')}
                  alt={fullMovie.title}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'linear-gradient(to bottom, rgba(10,10,10,0.2) 0%, rgba(10,10,10,0.6) 60%, #0a0a0a 100%)',
                }} />
             </div>
           )}
        </div>

        {/* Content Container */}
        <div style={{
          position: 'relative',
          marginTop: isMobile ? '-60px' : '-100px',
          animation: 'detailsIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) both',
          animationDelay: '0.1s',
          padding: '0 5% 4rem',
          zIndex: 2,
          maxWidth: '100%',
          overflow: 'hidden'
        }}>
          {/* Tagline */}
          {fullMovie.tagline && (
            <p style={{
              color: 'rgba(255, 255, 255, 0.9)',
              fontSize: 'clamp(0.9rem, 2vw, 1.1rem)',
              fontWeight: 500,
              fontStyle: 'italic',
              marginBottom: '0.5rem',
              textShadow: '0 2px 4px rgba(0,0,0,0.8)',
              opacity: 0.9,
            }}>
              "{fullMovie.tagline}"
            </p>
          )}

          {/* Title */}
          <h1 style={{
            fontSize: 'clamp(1.35rem, 5.5vw, 3rem)',
            fontWeight: 900,
            lineHeight: 1.1,
            color: '#fff',
            marginBottom: '0.75rem',
            textShadow: '0 4px 12px rgba(0,0,0,0.6)',
            letterSpacing: '-0.02em',
          }}>
            {fullMovie.title}
          </h1>

          {/* Metadata */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '1.25rem',
            fontSize: 'clamp(0.75rem, 1.8vw, 0.85rem)',
            fontWeight: 600,
            color: '#e5e5e5',
          }}>
             <span style={{
               color: '#46d369',
               fontWeight: 700,
               fontSize: 'clamp(0.9rem, 2vw, 1rem)',
             }}>
               {Math.round(fullMovie.voteAverage * 10)}% Match
             </span>
             <span>{fullMovie.releaseDate?.split('-')[0]}</span>
             {fullMovie.runtime && (
               <>
                 <span style={{ opacity: 0.5 }}>|</span>
                 <span>{Math.floor(fullMovie.runtime / 60)}h {fullMovie.runtime % 60}m</span>
               </>
             )}
              {fullMovie.adult && (
                 <span style={{
                   border: '1px solid rgba(255,255,255,0.4)',
                   padding: '0 4px',
                   fontSize: '0.75rem',
                   borderRadius: '2px'
                 }}>18+</span>
              )}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '2rem', flexWrap: 'wrap' }}>
             <button
               onClick={handlePlayClick}
               style={{
                 flex: '1 1 auto',
                  minWidth: isMobile ? '100px' : '110px',
                  maxWidth: '180px',
                  padding: '6px 12px',
                  height: isMobile ? '34px' : '40px',
                  backgroundColor: '#fff',
                  color: '#000',
                  border: 'none',
                  borderRadius: '6px',
                  boxShadow: '0 4px 20px rgba(255, 255, 255, 0.3)',
                  fontSize: isMobile ? '0.85rem' : '0.95rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  transition: 'transform 0.2s',
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
                {hasProgress ? 'Resume' : 'Play'}
              </button>

             {trailer && (
                <button
                  onClick={() => {
                    triggerHaptic('medium');
                    setPlayingTrailer(!playingTrailer);
                    setShowPlayer(false);
                  }}
                  style={{
                    flex: '1 1 auto',
                    minWidth: isMobile ? '100px' : '110px',
                    maxWidth: '180px',
                    padding: '6px 12px',
                    height: isMobile ? '34px' : '40px',
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    backdropFilter: 'blur(15px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(15px) saturate(180%)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: '#fff',
                    borderRadius: '6px',
                    fontSize: isMobile ? '0.85rem' : '0.95rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                   <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                     <path d={playingTrailer ? "M6 4h4v16H6V4zm8 0h4v16h-4V4z" : "M8 5v14l11-7z"}/>
                   </svg>
                   {playingTrailer ? 'Stop' : 'Trailer'}
                </button>
             )}

             <button
                onClick={handleToggleList}
                style={{
                  width: isMobile ? '34px' : '40px',
                  height: isMobile ? '34px' : '40px',
                  borderRadius: '50%',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  background: 'rgba(255, 255, 255, 0.15)',
                  backdropFilter: 'blur(30px) saturate(220%)',
                  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                  backgroundColor: 'transparent',
                  color: inList ? '#46d369' : '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                  padding: 0,
                  flexShrink: 0,
                }}
             >
               {inList ? (
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
               ) : (
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
               )}
             </button>

             {/* Remind Me Button */}
              <button
                 onClick={handleRemindMe}
                 style={{
                   width: isMobile ? '34px' : '40px',
                   height: isMobile ? '34px' : '40px',
                   borderRadius: '50%',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  background: 'rgba(255, 255, 255, 0.15)',
                  backdropFilter: 'blur(30px) saturate(220%)',
                  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                  backgroundColor: 'transparent',
                  color: '#fff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                  padding: 0,
                  flexShrink: 0,
                }}
                title="Remind me to watch this"
             >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
             </button>
          </div>

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(0, 1fr))',
            gap: 'clamp(2rem, 5vw, 3rem)',
            width: '100%',
          }}>
             {/* Left Column: Story & Info */}
             <div style={{ minWidth: 0 }}>
                <div style={{ marginBottom: '1.5rem', width: '100%' }}>
                    <p style={{ 
                       fontSize: '0.85rem', 
                       lineHeight: '1.5', 
                       color: 'rgba(255,255,255,0.85)', 
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
                       {fullMovie.overview}
                    </p>
                    {fullMovie.overview && fullMovie.overview.length > 100 && (
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

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '2rem' }}>
                   {fullMovie.genres?.map(g => (
                      <span key={g.id} style={{
                        fontSize: '0.85rem',
                        color: '#fff',
                        padding: '6px 16px',
                        background: 'rgba(255, 255, 255, 0.1)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: '30px',
                      }}>
                        {g.name}
                      </span>
                   ))}
                </div>
                
                {crew.length > 0 && (
                  <div style={{ marginBottom: '2rem' }}>
                    <span style={{ color: '#777', fontSize: '0.9rem' }}>Director: </span>
                    <span style={{ color: '#ddd' }}>
                      {crew.filter(c => c.job === 'Director').map(c => c.name).join(', ')}
                    </span>
                  </div>
                )}
             </div>

             {/* Right Column: Cast & More */}
             <div style={{ minWidth: 0 }}>
               {/* Minimalist Cast Section - Photos Only */}
               {cast.length > 0 && (
                 <div style={{ marginBottom: '2.5rem' }}>
                   <h3 style={{
                     fontSize: '1.1rem',
                     fontWeight: 600,
                     color: 'rgba(255,255,255,0.9)',
                     marginBottom: '1rem',
                   }}>
                     Cast
                   </h3>
                   <div style={{
                       display: 'flex',
                       flexWrap: 'nowrap',
                       gap: isMobile ? '24px' : '40px',
                        touchAction: 'pan-x',
                        padding: isMobile ? '0 5% 1rem' : '0 0 1rem',
                       overflowX: 'auto',
                        overscrollBehavior: 'contain',
                       paddingBottom: '1rem',
                       WebkitOverflowScrolling: 'touch',
                       scrollSnapType: 'x mandatory',
                       msOverflowStyle: 'none',
                       scrollbarWidth: 'none',
                     }}>
                      <style>{`
                        div::-webkit-scrollbar {
                          display: none;
                        }
                      `}</style>
                       {cast.slice(0, 20).map((person) => (
                         <div 
                            key={person.id} 
                            title={`${person.name} as ${person.character}`} 
                            onClick={() => onActorClick?.(person.id)}
                            style={{ 
                               position: 'relative',
                               cursor: 'pointer',
                               textAlign: 'center',
                               width: isMobile ? '85px' : '100px',
                               flexShrink: 0,
                               scrollSnapAlign: 'start',
                             }}
                         >
                            {person.profilePath ? (
                              <img 
                                src={getProfileUrl(person.profilePath)}
                                alt={person.name}
                                style={{
                                  width: isMobile ? '80px' : '100px',
                                  height: isMobile ? '80px' : '100px',
                                  borderRadius: '50%',
                                  objectFit: 'cover',
                                  border: '1px solid rgba(255, 255, 255, 0.15)',
                                  transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                                  marginBottom: '8px',
                                  boxShadow: '0 8px 25px rgba(0,0,0,0.3)',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.transform = 'scale(1.05)';
                                  e.currentTarget.style.borderColor = '#fff';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.transform = 'scale(1)';
                                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                                }}
                              />
                            ) : (
                              <div style={{
                                width: isMobile ? '80px' : '100px',
                                height: isMobile ? '80px' : '100px',
                                borderRadius: '50%',
                                background: '#333',
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                fontSize: '2rem',
                                marginBottom: '8px',
                                border: '2px solid rgba(255,255,255,0.1)',
                              }}>
                                👤
                              </div>
                            )}
                            <div style={{
                                fontSize: isMobile ? '0.75rem' : '0.85rem',
                                fontWeight: 600,
                                color: '#e5e5e5',
                                lineHeight: 1.2,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                width: '100%',
                            }}>
                              {person.name}
                            </div>
                         </div>
                       ))}
                   </div>
                 </div>
               )}

               {/* More Like This Grid */}
               {similarMovies.length > 0 && (
                 <div>
                   <h3 style={{
                     fontSize: '1.1rem',
                     fontWeight: 600,
                     color: 'rgba(255,255,255,0.9)',
                     marginBottom: '1rem',
                   }}>
                     More Like This
                   </h3>
                   <div style={{
                     display: 'grid',
                     gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(3, 1fr)',
                     gap: '10px',
                     width: '100%',
                   }}>
                      {similarMovies.slice(0, 9).map(similar => (
                        <div 
                          key={similar.id}
                          onClick={() => {
                            onClose();
                            setTimeout(() => {
                               window.dispatchEvent(new CustomEvent('movieClick', { detail: similar }));
                            }, 50);
                          }}
                          style={{
                            aspectRatio: '2/3',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            position: 'relative',
                            cursor: 'pointer',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
                            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                            width: '100%',
                            maxWidth: '100%',
                          }}
                        >
                           <img 
                             src={getPosterUrl(similar.posterPath, 'small')}
                             alt={similar.title}
                             style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                           />
                           <div style={{
                             position: 'absolute',
                             inset: 0,
                             background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 50%)',
                             opacity: 0,
                             transition: 'opacity 0.2s',
                           }}
                           onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                           onMouseLeave={(e) => e.currentTarget.style.opacity = '0'}
                           >
                              <span style={{
                                position: 'absolute',
                                bottom: '4px',
                                left: '4px',
                                fontSize: '0.7rem',
                                color: '#fff',
                                fontWeight: 600
                              }}>
                                {similar.voteAverage.toFixed(1)}
                              </span>
                           </div>
                        </div>
                      ))}
                   </div>
                 </div>
               )}
             </div>
          </div>
        </div>
      </div>

       {/* Video Player Overlay */}
       {showPlayer && (
        <VideoPlayer
          src={streamUrl || `https://vidsrc.cc/v2/embed/movie/${fullMovie.id}`}
          title={fullMovie.title}
          onClose={() => { triggerHaptic('light'); setShowPlayer(false); setStreamUrl(null); }}
          item={fullMovie}
        />
      )}

      <style>{`
        @keyframes detailsIn {
          from { opacity: 0; transform: scale(1.02); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
