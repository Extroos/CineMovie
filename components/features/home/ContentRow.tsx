import React, { useEffect, useRef } from 'react';
import type { Movie, TVShow } from '../../../types';
import { getPosterUrl, getMovieDetails, getTVShowDetails } from '../../../services/tmdb';
import { triggerHaptic } from '../../../utils/haptics';

interface ContentRowProps {
  title: string;
  movies: (Movie | TVShow)[];
  onMovieClick?: (movie: Movie | TVShow) => void;
}

const ContentCard = React.memo(({ movie, onClick }: { movie: Movie | TVShow, onClick?: (movie: Movie | TVShow) => void, key?: string }) => {
  const cardRef = useRef<HTMLDivElement>(null);

  const handleClick = () => {
    triggerHaptic('light');
    onClick?.(movie);
  };

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        // PROACTIVE PREFETCH: Load details before user clicks
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
  const watchedBy = (movie as any).watchedBy; // Social feature

  return (
    <div
      ref={cardRef}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      style={{
        minWidth: '110px',
        width: '110px',
        flexShrink: 0,
        cursor: 'pointer',
        transition: 'transform 0.3s ease',
        position: 'relative',
        WebkitTapHighlightColor: 'transparent',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        willChange: 'transform',
      }}
    >
      <div style={{
        position: 'relative',
        aspectRatio: '2/3',
        borderRadius: '6px',
        overflow: 'hidden',
        backgroundColor: '#222',
      }}>
        <img
          src={getPosterUrl(movie.posterPath, 'medium')}
          alt={displayTitle}
          loading="lazy"
          decoding="async"
          onLoad={(e) => {
            (e.target as HTMLImageElement).style.opacity = '1';
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
            transition: 'opacity 0.4s ease',
            pointerEvents: 'none',
          }}
        />
        
        {/* Friend Watch Avatar Overlay */}
        {watchedBy && (
           <div style={{
             position: 'absolute',
             bottom: '4px',
             right: '4px',
             display: 'flex',
             alignItems: 'center',
             gap: '4px',
             zIndex: 20,
           }}>
              {(movie as any).friendEpisode && (
                 <div style={{
                    background: 'rgba(0,0,0,0.85)',
                    color: '#46d369',
                    fontSize: '0.6rem',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    border: '1px solid #46d369',
                    backdropFilter: 'blur(4px)',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.6)'
                 }}>
                    Ep {(movie as any).friendEpisode}
                 </div>
              )}

              <div style={{
                 width: '24px',
                 height: '24px',
                 borderRadius: '50%',
                 border: '1.5px solid #46d369',
                 overflow: 'hidden',
                 boxShadow: '0 2px 5px rgba(0,0,0,0.5)',
                 background: '#000'
               }}>
                  <img 
                    src={(watchedBy as any).avatar || 'https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png'} 
                    alt={(watchedBy as any).name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
               </div>
           </div>
        )}

        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 40%)',
          opacity: 0,
          transition: 'opacity 0.2s',
        }}
        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
        onMouseLeave={(e) => e.currentTarget.style.opacity = '0'}
        />
      </div>
    </div>
  );
});

const ContentRow = React.memo(function ContentRow({ title, movies, onMovieClick }: ContentRowProps) {
  if (!movies || movies.length === 0) return null;

  return (
    <div style={{
      marginBottom: '0.75rem',
      paddingTop: '0.5rem',
      position: 'relative',
      zIndex: 10,
    }}>
      <h2 style={{
        fontSize: '1.1rem',
        fontWeight: '900',
        color: '#FFFFFF',
        marginBottom: '0.5rem', 
        paddingLeft: '5%',
        letterSpacing: '-0.01em',
        textTransform: 'uppercase',
      }}>
        {title}
      </h2>

      <div 
        className="no-scrollbar content-row-scroll"
        style={{
          display: 'flex',
          gap: '10px',
          overflowX: 'auto',
          overflowY: 'hidden',
          paddingLeft: '5%',
          paddingRight: '5%',
          paddingBottom: '8px',
          WebkitOverflowScrolling: 'touch',
          scrollBehavior: 'smooth',
          touchAction: 'auto',
          overscrollBehaviorX: 'contain',
        }}
      >
        {movies.map((movie) => (
          <ContentCard 
            key={`${movie.id}-${(movie as any).name ? 'tv' : 'movie'}`} 
            movie={movie} 
            onClick={onMovieClick} 
          />
        ))}
      </div>
    </div>
  );
});

export default ContentRow;
