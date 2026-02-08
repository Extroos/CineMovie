import React, { useState } from 'react';
import type { Movie, TVShow } from '../../../types';
import { getBackdropUrl } from '../../../services/tmdb';
import { triggerHaptic } from '../../../utils/haptics';

interface HeroProps {
  movie: Movie | TVShow;
  onPlayClick?: () => void;
  onInfoClick?: () => void;
  onSurpriseMe?: () => void;
}

export default function Hero({ movie, onPlayClick, onInfoClick, onSurpriseMe }: HeroProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const title = (movie as Movie).title || (movie as TVShow).name;

  const handlePlay = () => {
    triggerHaptic('medium');
    onPlayClick?.();
  };

  const handleInfo = () => {
    triggerHaptic('light');
    onInfoClick?.();
  };

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '60vh', 
      maxHeight: '700px',
      minHeight: '400px',
      overflow: 'hidden',
      marginBottom: '0.5rem', 
    }}>
      {/* Background Image */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: '#0a0a0a',
      }}>
        {!imageLoaded && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(90deg, #0a0a0a 25%, #1a1a1a 50%, #0a0a0a 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite linear',
            zIndex: 1,
          }} />
        )}
        <img
          src={getBackdropUrl(movie.backdropPath, 'original')}
          alt={title}
          onLoad={() => setImageLoaded(true)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: imageLoaded ? 1 : 0,
            transition: 'opacity 0.8s ease-out',
            zIndex: 2,
          }}
        />
        
        {/* Cinematic Gradient Overlay */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(to bottom, rgba(10,10,10,0) 0%, rgba(10,10,10,0.2) 60%, #0a0a0a 100%)',
        }} />
        
        {/* Side Gradient for text readability */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'linear-gradient(to right, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 50%)',
        }} />
      </div>

      {/* Content */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '0 5% 3.5rem', 
        zIndex: 2,
        maxWidth: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        alignItems: 'center', 
        textAlign: 'center', 
        height: '100%',
        animation: 'fadeInUp 0.8s ease-out',
      }}>


        {/* Title */}
        <h1 style={{
          fontSize: 'clamp(1.75rem, 5vw, 3rem)', 
          fontWeight: '900',
          color: '#FFFFFF',
          marginBottom: '0.6rem',
          textShadow: '0 4px 12px rgba(0,0,0,0.5)',
          lineHeight: '1.1',
          letterSpacing: '-0.02em',
          maxWidth: '95%',
        }}>
          {title}
        </h1>

        {/* Meta Info */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          marginBottom: '1rem',
          fontSize: 'clamp(0.8rem, 1.8vw, 0.9rem)',
          fontWeight: 600,
          color: '#e5e5e5',
          textShadow: '0 2px 4px rgba(0,0,0,0.8)',
        }}>
          <span style={{ color: '#46d369', fontWeight: 800 }}>
            {Math.round(movie.voteAverage * 10)}% Match
          </span>
          <span>
            {((movie as Movie).releaseDate || (movie as TVShow).firstAirDate || '').split('-')[0]}
          </span>
          
          {(movie as Movie).adult && (
             <span style={{
               border: '1px solid rgba(255,255,255,0.4)',
               padding: '0 4px',
               fontSize: '0.6rem',
               borderRadius: '2px'
             }}>18+</span>
          )}
        </div>

        {/* Overview */}
        <p style={{
          color: 'rgba(255,255,255,0.9)',
          fontSize: 'clamp(0.85rem, 1.8vw, 0.95rem)', 
          lineHeight: '1.4',
          marginBottom: '1.25rem',
          textShadow: '0 2px 4px rgba(0,0,0,0.8)',
          maxWidth: '550px',
          display: '-webkit-box',
          WebkitLineClamp: 2, 
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          margin: '0 auto 1.25rem',
        }}>
          {movie.overview}
        </p>

        {/* Buttons */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center', 
          gap: '12px',
          width: '100%',
          flexWrap: 'wrap',
        }}>
          <button
            onClick={handlePlay}
            aria-label={`Play ${title}`}
            style={{
              height: isMobile ? '36px' : '44px', 
              padding: isMobile ? '0 14px' : '0 24px', 
              background: '#FFFFFF',
              color: '#000000',
              border: 'none',
              borderRadius: '6px',
              fontSize: isMobile ? '0.85rem' : '1rem',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'transform 0.2s',
              minWidth: isMobile ? '90px' : '120px',
              boxShadow: '0 4px 12px rgba(255,255,255,0.2)',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
            Play
          </button>

          {onSurpriseMe && (
            <button
              onClick={(e) => { e.stopPropagation(); onSurpriseMe(); }}
              aria-label="Surprise Me"
              style={{
                height: isMobile ? '36px' : '44px', 
                padding: isMobile ? '0 12px' : '0 20px',
                background: 'rgba(109, 109, 110, 0.4)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.9rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 3 21 3 21 8"></polyline>
                <line x1="4" y1="20" x2="21" y2="3"></line>
                <polyline points="21 16 21 21 16 21"></polyline>
                <line x1="15" y1="15" x2="21" y2="21"></line>
                <line x1="4" y1="4" x2="9" y2="9"></line>
              </svg>
              Surprise Me
            </button>
          )}

          <button
            onClick={handleInfo}
            aria-label={`More info about ${title}`}
            style={{
              width: isMobile ? '36px' : '44px', 
              height: isMobile ? '36px' : '44px',
              borderRadius: '50%',
              background: 'rgba(109, 109, 110, 0.4)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              color: '#FFFFFF',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
              flexShrink: 0,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </button>
        </div>
      </div>
      
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
