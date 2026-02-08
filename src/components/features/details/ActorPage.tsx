import React, { useState, useEffect, memo, useRef } from 'react';
import type { Movie, TVShow } from '../../../types';
import { getPersonDetails, getPersonCombinedCredits, getProfileUrl, getPosterUrl, getBackdropUrl } from '../../../services/tmdb';
import { COLORS } from '../../../constants';

interface ActorPageProps {
  personId: number;
  onClose: () => void;
  onMovieClick: (movie: Movie) => void;
  onTVShowClick: (show: TVShow) => void;
}

function ActorPage({ personId, onClose, onMovieClick, onTVShowClick }: ActorPageProps) {
  const [details, setDetails] = useState<any>(null);
  const [credits, setCredits] = useState<(Movie | TVShow)[]>([]);
  const [loading, setLoading] = useState(true);
  const [bioExpanded, setBioExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const abortController = new AbortController();

    async function loadActorData() {
      setLoading(true);
      try {
        const [personData, creditsData] = await Promise.all([
          getPersonDetails(personId, abortController.signal),
          getPersonCombinedCredits(personId, abortController.signal)
        ]);
        setDetails(personData);
        setCredits(creditsData);
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error("Failed to load actor data", error);
        }
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadActorData();
    
    // Lock body scroll
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    
    return () => { 
      abortController.abort();
      document.body.style.overflow = originalStyle;
    };
  }, [personId]);

  if (loading) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 3000,
        background: 'rgba(10,10,10,0.9)',
        backdropFilter: 'blur(15px) saturate(180%)',
        WebkitBackdropFilter: 'blur(15px) saturate(180%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          width: '36px', height: '36px',
          border: '2px solid #222', borderTopColor: COLORS.primary,
          borderRadius: '50%', animation: 'spin 0.7s linear infinite',
        }} />
      </div>
    );
  }

  if (!details) return null;

  const backdropItem = credits.find(c => c.backdropPath) as Movie | TVShow | undefined;
  const backdropUrl = backdropItem ? getBackdropUrl(backdropItem.backdropPath, 'original') : null;

  const biography = details.biography || '';
  const bioLimit = isMobile ? 120 : 280;
  const showReadMore = biography.length > bioLimit;
  const displayBio = bioExpanded ? biography : biography.substring(0, bioLimit) + (showReadMore ? '...' : '');

  return (
    <div 
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 3000,
        background: 'rgba(10,10,10,0.6)', // Lighter overlay to show the blur better
        overflowY: 'auto', overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
        animation: 'detailsIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        willChange: 'transform, opacity',
      }}
    >
      {/* Performance optimized background blur layer - fixed and separate from scroll */}
      <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: -1,
          backdropFilter: 'blur(25px) saturate(220%) brightness(0.8)',
          WebkitBackdropFilter: 'blur(20px) saturate(220%) brightness(0.8)',
          pointerEvents: 'none',
          animation: 'backdropFade 0.6s ease-out both',
      }} />
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{ minHeight: '100vh', background: '#0a0a0a', position: 'relative' }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'fixed',
            top: 'calc(12px + env(safe-area-inset-top))',
            left: '12px',
            zIndex: 3001,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: 'none',
            color: '#fff',
            width: '36px', height: '36px',
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>

        <div style={{
          position: 'relative',
          width: '100%',
          height: isMobile ? '40vh' : '50vh',
          maxHeight: '500px',
        }}>
          {backdropUrl ? (
            <>
              <img
                src={backdropUrl}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
              />
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to bottom, transparent 30%, #0a0a0a 100%)',
              }} />
            </>
          ) : (
            <div style={{ width: '100%', height: '100%', background: '#111' }} />
          )}
        </div>

        <div style={{
          position: 'relative',
          marginTop: isMobile ? '-70px' : '-100px',
          padding: '0 5% 3rem',
          zIndex: 2,
        }}>
          <div style={{ display: 'flex', gap: isMobile ? '12px' : '20px', marginBottom: '20px' }}>
            <div style={{
              width: isMobile ? '80px' : '120px',
              height: isMobile ? '120px' : '180px',
              borderRadius: '8px',
              overflow: 'hidden',
              flexShrink: 0,
              boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
            }}>
              <img 
                src={getProfileUrl(details.profile_path)} 
                alt={details.name}
                loading="lazy"
                style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
              />
            </div>

            <div style={{ flex: 1, minWidth: 0, paddingTop: isMobile ? '30px' : '50px' }}>
              <h1 style={{
                fontSize: 'clamp(1.1rem, 4vw, 1.8rem)',
                fontWeight: 700,
                color: '#fff',
                marginBottom: '6px',
                lineHeight: 1.2,
              }}>
                {details.name}
              </h1>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', color: '#888', fontSize: 'clamp(0.7rem, 1.8vw, 0.8rem)' }}>
                {details.known_for_department && <span>{details.known_for_department}</span>}
                {details.birthday && <span>• {details.birthday.split('-')[0]}</span>}
                {credits.length > 0 && <span>• {credits.length} credits</span>}
              </div>
            </div>
          </div>

          {biography && (
            <div style={{ marginBottom: '24px' }}>
              <p style={{
                fontSize: 'clamp(0.78rem, 2vw, 0.88rem)',
                color: 'rgba(255,255,255,0.7)',
                lineHeight: 1.6,
                margin: 0,
              }}>
                {displayBio}
              </p>
              {showReadMore && (
                <button
                  onClick={(e) => { e.stopPropagation(); setBioExpanded(!bioExpanded); }}
                  style={{
                    background: 'none', border: 'none',
                    color: COLORS.primary,
                    fontSize: '0.8rem', fontWeight: 600,
                    padding: '4px 0', marginTop: '4px',
                    cursor: 'pointer',
                  }}
                >
                  {bioExpanded ? 'Less' : 'More'}
                </button>
              )}
            </div>
          )}

          <div>
            <h2 style={{
              fontSize: 'clamp(0.85rem, 2.2vw, 1rem)',
              fontWeight: 600,
              color: '#fff',
              marginBottom: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              Filmography
            </h2>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
              gap: isMobile ? '10px' : '14px',
            }}>
              {credits.map((item: any, index: number) => (
                <div 
                  key={`${item.id}-${item.title || item.name}-${index}`}
                  onClick={() => item.title ? onMovieClick(item) : onTVShowClick(item)}
                  style={{
                    cursor: 'pointer',
                    WebkitTapHighlightColor: 'transparent',
                    animation: `creditItemIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${Math.min(index * 0.03, 0.6)}s both`,
                    willChange: 'transform, opacity',
                  }}
                >
                  <div style={{
                    position: 'relative',
                    aspectRatio: '2/3',
                    borderRadius: '6px',
                    overflow: 'hidden',
                    marginBottom: '5px',
                    backgroundColor: '#151515',
                  }}>
                    <img 
                      src={getPosterUrl(item.posterPath, 'medium')} 
                      alt={item.title || item.name}
                      loading="lazy"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = 'https://via.placeholder.com/200x300/111/333?text=';
                      }}
                    />
                    {item.voteAverage > 0 && (
                      <div style={{
                        position: 'absolute', top: '4px', right: '4px',
                        background: 'rgba(0,0,0,0.7)',
                        backdropFilter: 'blur(8px)',
                        WebkitBackdropFilter: 'blur(8px)',
                        padding: '2px 5px',
                        borderRadius: '4px',
                        fontSize: '0.6rem',
                        fontWeight: 700,
                        color: '#46d369',
                      }}>
                        {item.voteAverage.toFixed(1)}
                      </div>
                    )}
                  </div>
                  <p style={{
                    fontSize: 'clamp(0.6rem, 1.6vw, 0.72rem)',
                    fontWeight: 500,
                    color: '#ccc',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    margin: 0,
                  }}>
                    {item.title || item.name}
                  </p>
                  <p style={{
                    fontSize: 'clamp(0.55rem, 1.4vw, 0.65rem)',
                    color: '#555',
                    margin: 0,
                  }}>
                    {(item.releaseDate || item.firstAirDate || '').split('-')[0]}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ height: 'env(safe-area-inset-bottom, 16px)' }} />
      </div>

      <style>{`
        @keyframes detailsIn { 
          from { opacity: 0; transform: scale(1.02); } 
          to { opacity: 1; transform: scale(1); } 
        }
        @keyframes backdropFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes creditItemIn {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const ActorPageMemo = memo(ActorPage);
export default ActorPageMemo;
