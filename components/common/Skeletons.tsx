import React from 'react';
import { COLORS } from '../../constants';

// Add shimmer animation to global styles
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes shimmer {
      0% { background-position: -200% 0; }
      100% { background-position: 200% 0; }
    }
  `;
  document.head.appendChild(style);
}

const shimmerStyle = {
  backgroundColor: COLORS.bgCard,
  backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0) 100%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s infinite linear',
};

export function MovieCardSkeleton() {
  return (
    <div style={{
      minWidth: '160px',
      width: '160px',
      flexShrink: 0,
    }}>
      <div style={{
        position: 'relative',
        paddingBottom: '150%',
        borderRadius: '8px',
        overflow: 'hidden',
        ...shimmerStyle,
      }} />
      <div style={{
        marginTop: '0.625rem',
        height: '2.1rem',
        borderRadius: '4px',
        ...shimmerStyle,
      }} />
    </div>
  );
}

export function HeroSkeleton() {
  return (
    <div style={{
      width: '100%',
      height: '60vh',
      maxHeight: '600px',
      minHeight: '400px',
      marginBottom: '1rem',
      ...shimmerStyle,
    }} />
  );
}

export function ContentRowSkeleton() {
  return (
    <div style={{ padding: '1.5rem 0' }}>
      {/* Title skeleton */}
      <div style={{
        width: '150px',
        height: '24px',
        borderRadius: '4px',
        marginBottom: '1rem',
        marginLeft: '4%',
        ...shimmerStyle,
      }} />

      {/* Cards skeleton */}
      <div style={{
        display: 'flex',
        gap: '0.75rem',
        paddingLeft: '4%',
        paddingRight: '4%',
      }}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <MovieCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
