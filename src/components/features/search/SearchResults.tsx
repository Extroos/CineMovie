import React from 'react';
import type { Movie } from '../../../types';
import { getPosterUrl } from '../../../services/tmdb';
import { COLORS } from '../../../constants';
import { triggerHaptic } from '../../../utils/haptics';

interface SearchResultsProps {
  query: string;
  results: Movie[];
  loading: boolean;
  onMovieClick: (movie: Movie) => void;
  onClose: () => void;
}

export default function SearchResults({ query, results, loading, onMovieClick, onClose }: SearchResultsProps) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 2000,
      background: 'rgba(5, 5, 5, 0.4)', 
      backdropFilter: 'blur(20px) saturate(220%)',
      WebkitBackdropFilter: 'blur(20px) saturate(220%)',
      overflowY: 'auto',
      WebkitOverflowScrolling: 'touch',
      animation: 'resultsIn 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
    }}>
      {/* Sticky Header with Glassmorphism */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 2001,
        // Premium high-vibrancy wet glass
        background: 'rgba(15, 15, 15, 0.4)',
        backdropFilter: 'blur(15px) saturate(220%) brightness(1.2)',
        WebkitBackdropFilter: 'blur(15px) saturate(220%) brightness(1.2)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
        // Fix: Apply safe area to TOP padding
        padding: 'calc(16px + env(safe-area-inset-top, 0px)) 16px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}>
        <button
          onClick={() => { triggerHaptic('light'); onClose(); }}
          aria-label="Back"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#FFFFFF',
            cursor: 'pointer',
            padding: '6px', /* Reduced from 8px */
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: '-6px',
          }}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{
            fontSize: '15px', /* Reduced from 16px */
            fontWeight: 600,
            color: '#FFFFFF',
            margin: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            letterSpacing: '-0.2px',
          }}>
            {query ? `"${query}"` : 'Results'}
          </h2>
          <p style={{
            fontSize: '11px', /* Reduced from 12px */
            color: '#8E8E93',
            margin: '1px 0 0',
            fontWeight: 500,
          }}>
            {results.length} results found
          </p>
        </div>
      </div>

      {/* Content Grid */}
      <div style={{ padding: '16px 16px 100px' }}>
        {loading ? (
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            padding: '4rem 0',
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              border: '3px solid rgba(255, 255, 255, 0.1)',
              borderTopColor: COLORS.primary,
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
          </div>
        ) : results.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '6rem 2rem',
            color: '#8E8E93',
          }}>
            <svg 
              width="48" 
              height="48" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="1.5"
              style={{ margin: '0 auto 16px', opacity: 0.5 }}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <p style={{ fontSize: '16px', fontWeight: 500, margin: '0 0 8px' }}>No matches found</p>
            <p style={{ fontSize: '14px', opacity: 0.7 }}>Try changing your keywords</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', /* Reduced from 110px */
            gap: '12px 10px', /* Reduced gap */
          }}>
            {results.map((movie, index) => (
              <div
                key={`${movie.id}-${index}`}
                onClick={() => { triggerHaptic('medium'); onMovieClick(movie); }}
                style={{
                  cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent',
                  animation: `resultMapIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${Math.min(index * 0.04, 0.5)}s both`,
                }}
              >
                {/* Poster Container */}
                <div style={{
                  position: 'relative',
                  paddingBottom: '150%',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  backgroundColor: '#1a1a1a',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  marginBottom: '8px',
                }}>
                  {/* Skeleton / Shimmer Overlay */}
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
                    alt={movie.title || (movie as any).name}
                    loading="lazy"
                    onLoad={(e) => {
                       // Hide skeleton on load
                       (e.currentTarget.previousSibling as HTMLElement).style.display = 'none';
                       e.currentTarget.style.opacity = '1';
                    }}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      opacity: 0,
                      transition: 'opacity 0.3s ease-out, transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                      zIndex: 2,
                    }}
                  />
                </div>
                
                {/* Title */}
                <h3 style={{
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#FFFFFF',
                  margin: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  lineHeight: '1.4',
                  opacity: 0.9
                }}>
                  {movie.title || (movie as any).name}
                </h3>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes resultsIn {
          from { opacity: 0; transform: scale(1.02); filter: blur(10px); }
          to { opacity: 1; transform: scale(1); filter: blur(0); }
        }
        @keyframes resultMapIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes shimmer {
          from { background-position: 200% 0; }
          to { background-position: -200% 0; }
        }
        .search-result-card:active {
          transform: scale(0.96) !important;
          opacity: 0.8;
        }
      `}</style>
    </div>
  );
}
