import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Movie, TVShow } from '../../../types';
import { getPosterUrl, getMovieDetails, getTVShowDetails } from '../../../services/tmdb';
import { triggerHaptic } from '../../../utils/haptics';

interface ContentRowProps {
  title: string;
  movies: (Movie | TVShow)[];
  onMovieClick?: (movie: Movie | TVShow) => void;
}

const ContentCard = React.memo(({ movie, onClick, index }: { movie: Movie | TVShow, onClick?: (movie: Movie | TVShow) => void, index: number }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const handleClick = () => {
    triggerHaptic('medium');
    onClick?.(movie);
  };

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        if ((movie as any).firstAirDate || (movie as any).name) {
          getTVShowDetails(movie.id).catch(() => {});
        } else {
          getMovieDetails(movie.id).catch(() => {});
        }
        observer.disconnect();
      }
    }, { threshold: 0.1 });

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, [movie]);

  const displayTitle = (movie as Movie).title || (movie as TVShow).name;
  const watchedBy = (movie as any).watchedBy;

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ 
        delay: index * 0.05, 
        duration: 0.4, 
        ease: [0.16, 1, 0.3, 1] 
      }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={handleClick}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      role="button"
      tabIndex={0}
      style={{
        minWidth: '110px',
        width: '110px',
        flexShrink: 0,
        cursor: 'pointer',
        position: 'relative',
        zIndex: isHovered ? 50 : 1,
        WebkitTapHighlightColor: 'transparent',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'pan-x pan-y' // Explicitly allow vertical flow
      }}
    >
      <div style={{
        position: 'relative',
        aspectRatio: '2/3',
        borderRadius: '8px',
        overflow: 'hidden',
        backgroundColor: '#1a1a1a',
        boxShadow: isHovered ? '0 10px 20px rgba(0,0,0,0.4)' : '0 4px 8px rgba(0,0,0,0.2)',
        transition: 'box-shadow 0.3s ease',
      }}>
        {/* Skeleton Shimmer */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(90deg, #1a1a1a 25%, #2a2a2a 50%, #1a1a1a 75%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.5s infinite linear',
          zIndex: 1,
        }} />

        <img
          src={getPosterUrl(movie.posterPath, 'medium')}
          alt={displayTitle}
          loading="lazy"
          decoding="async"
          onLoad={(e) => {
            (e.currentTarget.previousSibling as HTMLElement).style.display = 'none';
            e.currentTarget.style.opacity = '1';
          }}
          onError={(e) => {
             e.currentTarget.onerror = null;
             e.currentTarget.src = 'https://via.placeholder.com/200x300/111/444?text=No+Poster';
             e.currentTarget.style.opacity = '1';
          }}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: 0,
            transition: 'opacity 0.5s ease-out, transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            pointerEvents: 'none',
            zIndex: 2,
          }}
        />
        
        {watchedBy && (
           <div style={{
             position: 'absolute',
             inset: 0,
             display: 'flex',
             flexDirection: 'column',
             justifyContent: 'flex-end',
             zIndex: 20,
             pointerEvents: 'none',
           }}>

              {/* Status Row */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px',
                background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {(movie as any).isLive && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(229, 9, 20, 0.9)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)' }}>
                      <div className="pulse-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fff' }} />
                      <span style={{ fontSize: '0.6rem', fontWeight: 900, color: '#fff', letterSpacing: '0.05em' }}>LIVE</span>
                    </div>
                  )}
                  {(movie as any).friendEpisode && (
                    <div style={{ background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '0.6rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }}>
                      E{(movie as any).friendEpisode}
                    </div>
                  )}
                </div>

                {/* Avatars Stack */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {(movie as any).watchers?.slice(0, 3).map((w: any, i: number) => (
                    <div 
                      key={w.friend.id}
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        border: '2px solid #0a0a0a',
                        overflow: 'hidden',
                        marginLeft: i === 0 ? 0 : '-10px',
                        zIndex: 10 - i,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
                        background: '#0a0a0a'
                      }}
                    >
                      <img 
                        src={w.friend.avatar || 'https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png'} 
                        alt={w.friend.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    </div>
                  ))}
                  {(movie as any).watchers?.length > 3 && (
                    <div style={{ fontSize: '10px', color: '#fff', marginLeft: '4px', fontWeight: 700 }}>+{(movie as any).watchers.length - 3}</div>
                  )}
                </div>
              </div>
           </div>
        )}

        <AnimatePresence>
          {isHovered && watchedBy && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 60%)',
                zIndex: 10,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '10px',
                textAlign: 'center'
              }}
            >
              <span style={{ color: '#fff', fontSize: '10px', fontWeight: 700, opacity: 0.8, textTransform: 'uppercase' }}>
                {(movie as any).watchers?.length > 1 ? 'Friends Watching' : `Watching now`}
              </span>
              <span style={{ color: '#fff', fontSize: '12px', fontWeight: 900, marginTop: '2px' }}>
                {(movie as any).watchedBy.name} {(movie as any).watchers?.length > 1 && `& ${(movie as any).watchers.length - 1} more`}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <style>{`
        @keyframes shimmer {
          from { background-position: 200% 0; }
          to { background-position: -200% 0; }
        }
        @keyframes pulse {
          0% { transform: scale(0.95); opacity: 0.8; }
          50% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(0.95); opacity: 0.8; }
        }
        .pulse-dot {
          animation: pulse 1.5s infinite ease-in-out;
        }
      `}</style>
    </motion.div>
  );
});

const ContentRow = React.memo(function ContentRow({ title, movies, onMovieClick }: ContentRowProps) {
  if (!movies || movies.length === 0) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      style={{
        marginBottom: '1.5rem',
        paddingTop: '0.5rem',
        position: 'relative',
        zIndex: 10,
      }
    }>
      <h2 style={{
        fontSize: '1.25rem',
        fontWeight: '900',
        color: '#FFFFFF',
        marginBottom: '0.75rem', 
        paddingLeft: '5%',
        letterSpacing: '-0.02em',
        textTransform: 'none',
      }}>
        {title}
      </h2>

      <div 
        style={{
          position: 'relative',
          overflowX: 'hidden', // Contain any horizontal bleed from scaling cards
          width: '100%',
        }}
      >
        <div 
          className="no-scrollbar content-row-scroll"
          style={{
            display: 'flex',
            gap: '12px',
            overflowX: 'auto',
            overflowY: 'hidden', // CRITICAL: Stop the row from stealing vertical swipes
            paddingLeft: '5%',
            paddingRight: '5%',
            paddingTop: '30px',    // Increased padding for card scale clearance
            paddingBottom: '30px', 
            marginTop: '-30px',
            marginBottom: '-20px',
            WebkitOverflowScrolling: 'touch',
            scrollBehavior: 'smooth',
            touchAction: 'pan-x pan-y', // Explicitly allow vertical flow to reach the body
            overscrollBehaviorX: 'contain',
          }}
        >
          {movies.map((movie, index) => (
            <ContentCard 
              key={`${movie.id}-${(movie as any).name ? 'tv' : 'movie'}`} 
              movie={movie} 
              index={index}
              onClick={onMovieClick} 
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
});

export default ContentRow;
