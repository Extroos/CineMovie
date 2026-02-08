import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Movie, TVShow } from '../../../types';
import { getPosterUrl } from '../../../services/tmdb';
import { COLORS } from '../../../constants';
import { triggerHaptic } from '../../../utils/haptics';

interface CategoryExplorerProps {
  title: string;
  movies: (Movie | TVShow)[];
  onClose: () => void;
  onMovieClick: (movie: Movie | TVShow) => void;
}

export default function CategoryExplorer({ title, movies, onClose, onMovieClick }: CategoryExplorerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 1.1, filter: 'blur(20px)' }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, scale: 1.05, filter: 'blur(20px)' }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 3000,
        background: 'rgba(5, 5, 5, 0.6)',
        backdropFilter: 'blur(30px) saturate(200%)',
        WebkitBackdropFilter: 'blur(30px) saturate(200%)',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {/* Premium Glass Header */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 3001,
        background: 'rgba(15, 15, 15, 0.4)',
        backdropFilter: 'blur(20px) saturate(220%) brightness(1.2)',
        WebkitBackdropFilter: 'blur(20px) saturate(220%) brightness(1.2)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        padding: 'calc(16px + env(safe-area-inset-top, 0px)) 20px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
      }}>
        <button
          onClick={() => { triggerHaptic('light'); onClose(); }}
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            color: '#FFFFFF',
            cursor: 'pointer',
            padding: '8px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{
            fontSize: '18px',
            fontWeight: 800,
            color: '#FFFFFF',
            margin: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            letterSpacing: '-0.02em',
          }}>
            {title}
          </h2>
          <p style={{
            fontSize: '12px',
            color: 'rgba(255, 255, 255, 0.5)',
            margin: '2px 0 0',
            fontWeight: 600,
          }}>
            {movies.length} titles
          </p>
        </div>
      </div>

      {/* Grid Content */}
      <div style={{ 
        padding: '24px 20px 120px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
        gap: '16px 12px',
      }}>
        {movies.map((movie, index) => {
          const mTitle = (movie as Movie).title || (movie as TVShow).name;
          return (
            <motion.div
              key={`${movie.id}-${index}`}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.03, 0.8), duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              onClick={() => { triggerHaptic('medium'); onMovieClick(movie); }}
              style={{
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <motion.div style={{
                position: 'relative',
                aspectRatio: '2/3',
                borderRadius: '12px',
                overflow: 'hidden',
                backgroundColor: '#1a1a1a',
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                marginBottom: '10px',
                transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              >
                <img
                  src={getPosterUrl(movie.posterPath, 'medium')}
                  alt={mTitle}
                  loading="lazy"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              </motion.div>
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
                lineHeight: '1.3',
                opacity: 0.9
              }}>
                {mTitle}
              </h3>
            </motion.div>
          );
        })}
      </div>

      <style>{`
        ::-webkit-scrollbar { display: none; }
        * { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </motion.div>
  );
}
