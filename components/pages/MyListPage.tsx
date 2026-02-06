import React from 'react';
import type { Movie } from '../../types';
import { getPosterUrl } from '../../services/tmdb';
import { COLORS } from '../../constants';

interface MyListPageProps {
  movies: Movie[];
  onMovieClick: (movie: Movie) => void;
  onRemove: (movieId: number) => void;
}

export default function MyListPage({ movies, onMovieClick, onRemove }: MyListPageProps) {
  return (
    <div style={{
      minHeight: '100vh',
      background: COLORS.bgPrimary,
      paddingTop: 'calc(80px + env(safe-area-inset-top))',
      paddingBottom: 'calc(80px + env(safe-area-inset-bottom))',
    }}>
      {/* Glass Sticky Header */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        background: 'rgba(10, 10, 10, 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
        padding: '1.5rem 4%',
        paddingTop: 'calc(1.5rem + env(safe-area-inset-top))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 'calc(80px + env(safe-area-inset-top))',
      }}>
        <div>
          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: '800',
            color: COLORS.textPrimary,
            lineHeight: 1.2,
            letterSpacing: '-0.02em',
          }}>
            My List
          </h1>
          <p style={{
            fontSize: '0.85rem',
            color: COLORS.textMuted,
            margin: 0,
          }}>
            {movies.length} {movies.length === 1 ? 'title' : 'titles'} saved
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ 
        padding: '2rem 4%',
        maxWidth: '1200px',
        margin: '0 auto',
      }}>
        {movies.length === 0 ? (
          // Empty State
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '50vh',
            textAlign: 'center',
            animation: 'fadeIn 0.5s ease-out',
          }}>
            <div style={{
              width: '100px',
              height: '100px',
              marginBottom: '2rem',
              background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(255,255,255,0.1)',
            }}>
              <svg 
                width="48" 
                height="48" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke={COLORS.textMuted}
                strokeWidth="1.5"
              >
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <h2 style={{
              color: '#fff',
              fontSize: '1.5rem',
              fontWeight: '700',
              marginBottom: '1rem',
            }}>
              Your list is empty
            </h2>
            <p style={{
              color: COLORS.textMuted,
              fontSize: '1rem',
              maxWidth: '300px',
              lineHeight: '1.6',
            }}>
              Movies and TV shows that you add to your list will appear here.
            </p>
          </div>
        ) : (
          // Grid
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: '2rem 1.5rem',
            animation: 'fadeIn 0.5s ease-out',
          }}>
            {movies.map((movie, index) => (
              <div 
                key={movie.id} 
                style={{ 
                  position: 'relative',
                  animation: `fadeIn 0.5s ease-out ${index * 0.05}ms backwards`,
                }}
                className="movie-card-container"
              >
                <div
                  onClick={() => onMovieClick(movie)}
                  style={{
                    cursor: 'pointer',
                    WebkitTapHighlightColor: 'transparent',
                    transition: 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                  }}
                >
                  <div style={{
                    position: 'relative',
                    paddingBottom: '150%',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    backgroundColor: COLORS.bgCard,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    marginBottom: '0.75rem',
                  }}>
                    <img
                      src={getPosterUrl(movie.posterPath, 'medium')}
                      alt={movie.title}
                      loading="lazy"
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                    
                    {/* Rating Badge - Moved to Top Left */}
                    <div style={{
                      position: 'absolute',
                      top: '8px',
                      left: '8px',
                      background: 'rgba(0, 0, 0, 0.6)',
                      backdropFilter: 'blur(4px)',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      border: '1px solid rgba(255,255,255,0.1)',
                      zIndex: 2,
                    }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill={COLORS.rating}>
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                      </svg>
                      <span style={{
                        color: '#fff',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                      }}>
                        {movie.voteAverage.toFixed(1)}
                      </span>
                    </div>

                    {/* Remove Button - Top Right (Always Visible) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(movie.id);
                      }}
                      style={{
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                        background: 'rgba(0, 0, 0, 0.6)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '50%',
                        width: '32px',
                        height: '32px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        color: '#fff',
                        zIndex: 10,
                        backdropFilter: 'blur(4px)',
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 59, 48, 0.9)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(0, 0, 0, 0.6)'}
                      title="Remove from list"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                    </button>
                  </div>
                  
                  <h3 style={{
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    color: '#e5e5e5',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginBottom: '4px',
                  }}>
                    {movie.title}
                  </h3>
                   <span style={{ fontSize: '0.8rem', color: '#888' }}>
                    {movie.releaseDate?.split('-')[0] || 'N/A'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
