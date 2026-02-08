import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Movie, TVShow } from '../../types';
import { 
  getBackdropUrl, 
  getPosterUrl, 
  getMoviesByGenre, 
  getTVShowsByGenre 
} from '../../services/tmdb';
import { triggerHaptic } from '../../utils/haptics';
import { scheduleReminder } from '../../utils/notifications';
import { COLORS } from '../../constants';

// --- Arty Professional Design Tokens ---
const DESIGN = {
  glass: 'rgba(15, 15, 15, 0.4)',
  blur: '40px',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  shadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
  ease: [0.16, 1, 0.3, 1], // Custom snappy expo ease
};

interface BrowseNewsProps {
  trending: (Movie | TVShow)[];
  upcoming: Movie[];
  onItemClick: (item: any) => void;
}

const GENRES = [
  { id: 28, name: 'Action', color: '#1a1a1a' },
  { id: 12, name: 'Adventure', color: '#1a1a1a' },
  { id: 16, name: 'Animation', color: '#1a1a1a' },
  { id: 35, name: 'Comedy', color: '#1a1a1a' },
  { id: 80, name: 'Crime', color: '#1a1a1a' },
  { id: 99, name: 'Documentary', color: '#1a1a1a' },
  { id: 18, name: 'Drama', color: '#1a1a1a' },
  { id: 10751, name: 'Family', color: '#1a1a1a' },
  { id: 14, name: 'Fantasy', color: '#1a1a1a' },
  { id: 27, name: 'Horror', color: '#1a1a1a' },
  { id: 10402, name: 'Music', color: '#1a1a1a' },
  { id: 9648, name: 'Mystery', color: '#1a1a1a' },
  { id: 10749, name: 'Romance', color: '#1a1a1a' },
  { id: 878, name: 'Sci-Fi', color: '#1a1a1a' },
  { id: 53, name: 'Thriller', color: '#1a1a1a' },
];

type ContentItem = (Movie | TVShow) & { mediaType: 'movie' | 'tv' };

export default function BrowseNewsPage({ trending, upcoming, onItemClick }: BrowseNewsProps) {
  const [activeTab, setActiveTab] = useState<'everyone' | 'coming' | 'categories'>('everyone');
  const [selectedGenre, setSelectedGenre] = useState<number | null>(null);
  const [genreContent, setGenreContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [genreBackdrops, setGenreBackdrops] = useState<Record<number, string>>({});

  useEffect(() => {
    const loadBackdrops = async () => {
      const backdrops: Record<number, string> = {};
      try {
        const results = await Promise.all(
          GENRES.map(genre => getMoviesByGenre(genre.id).catch(() => []))
        );
        GENRES.forEach((genre, index) => {
          if (results[index]?.[0]?.backdropPath) {
            backdrops[genre.id] = results[index][0].backdropPath;
          }
        });
        setGenreBackdrops(backdrops);
      } catch (e) { console.error(e); }
    };
    loadBackdrops();
  }, []);

  useEffect(() => {
    if (selectedGenre) {
      const loadContent = async () => {
        setLoading(true);
        try {
          const [m, s] = await Promise.all([
            getMoviesByGenre(selectedGenre),
            getTVShowsByGenre(selectedGenre)
          ]);
          setGenreContent([
            ...m.map(x => ({ ...x, mediaType: 'movie' as const })),
            ...s.map(x => ({ ...x, mediaType: 'tv' as const }))
          ].sort(() => Math.random() - 0.5));
        } catch (e) { console.error(e); }
        setLoading(false);
      };
      loadContent();
    }
  }, [selectedGenre]);

  const handleBack = useCallback(() => {
    triggerHaptic('light');
    setSelectedGenre(null);
  }, []);

  if (selectedGenre) {
    const genre = GENRES.find(g => g.id === selectedGenre);
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        style={{ minHeight: '100vh', background: '#000', paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div style={{ 
          padding: '16px 20px', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '16px',
          position: 'sticky',
          top: 0,
          zIndex: 1000,
          background: DESIGN.glass, 
          backdropFilter: `blur(${DESIGN.blur}) brightness(1.2)`,
          WebkitBackdropFilter: `blur(${DESIGN.blur}) brightness(1.2)`,
          borderBottom: DESIGN.border,
        }}>
          <button onClick={handleBack} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', width: '36px', height: '36px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, letterSpacing: '-0.03em' }}>{genre?.name}</h2>
        </div>
        
        <div style={{ 
          padding: '20px',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '12px',
          paddingBottom: '120px'
        }}>
          {loading ? Array(12).fill(0).map((_, i) => (
            <div key={i} style={{ aspectRatio: '2/3', background: '#0a0a0a', borderRadius: '12px', border: DESIGN.border }} />
          )) :
            genreContent.map((item, idx) => (
              <motion.div 
                key={item.id} 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.03, ease: DESIGN.ease }}
                onClick={() => onItemClick(item)} 
                style={{ cursor: 'pointer', aspectRatio: '2/3', borderRadius: '12px', overflow: 'hidden', background: '#0a0a0a', border: DESIGN.border }}
              >
                <img src={getPosterUrl(item.posterPath, 'small')} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </motion.div>
            ))
          }
        </div>
      </motion.div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      color: '#fff',
      paddingBottom: '120px'
    }}>
      {/* Editorial Header */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: DESIGN.glass, 
        backdropFilter: `blur(${DESIGN.blur}) saturate(160%) brightness(1.1)`,
        WebkitBackdropFilter: `blur(${DESIGN.blur}) saturate(160%) brightness(1.1)`,
        borderBottom: DESIGN.border,
      }}>
        <div style={{ padding: 'calc(20px + env(safe-area-inset-top)) 24px 20px' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 900, letterSpacing: '-0.05em', margin: 0, textTransform: 'uppercase' }}>Newsroom</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
             <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: COLORS.primary }} />
             <p style={{ margin: 0, opacity: 0.5, fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Discovery & Trends</p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', padding: '0 20px 16px' }}>
          {[
            { id: 'everyone', label: 'Latest Feed' },
            { id: 'coming', label: 'Gallery' },
            { id: 'categories', label: 'Explore' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => { triggerHaptic('light'); setActiveTab(tab.id as any); }}
              style={{
                flex: 1,
                background: activeTab === tab.id ? '#fff' : 'rgba(255,255,255,0.03)',
                border: 'none',
                color: activeTab === tab.id ? '#000' : 'rgba(255,255,255,0.4)',
                padding: '10px 0',
                fontSize: '0.8rem',
                fontWeight: 900,
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                textTransform: 'uppercase',
                letterSpacing: '0.02em',
                transform: activeTab === tab.id ? 'scale(1)' : 'scale(0.97)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '20px' }}>
        <AnimatePresence mode="wait">
          {activeTab === 'categories' ? (
            <motion.div 
              key="categories"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ ease: DESIGN.ease, duration: 0.5 }}
              style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}
            >
              {GENRES.map(genre => (
                <motion.div
                  key={genre.id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { triggerHaptic('medium'); setSelectedGenre(genre.id); }}
                  style={{ 
                    aspectRatio: '1.8/1', 
                    borderRadius: '20px', 
                    position: 'relative', 
                    overflow: 'hidden', 
                    cursor: 'pointer', 
                    background: '#111',
                    border: DESIGN.border,
                    boxShadow: DESIGN.shadow
                  }}
                >
                  {genreBackdrops[genre.id] && (
                    <img 
                      src={getBackdropUrl(genreBackdrops[genre.id], 'small')} 
                      alt="" 
                      style={{ 
                        position: 'absolute', 
                        inset: 0, 
                        width: '100%', 
                        height: '100%', 
                        objectFit: 'cover', 
                        opacity: 0.3,
                        filter: 'grayscale(100%) brightness(0.7)'
                      }} 
                    />
                  )}
                  <div style={{ 
                    position: 'absolute', 
                    inset: 0, 
                    padding: '16px', 
                    display: 'flex', 
                    alignItems: 'flex-end',
                    background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)'
                  }}>
                    <span style={{ fontWeight: 900, fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>{genre.name}</span>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              {(() => {
                const list = activeTab === 'everyone' ? trending : upcoming;
                
                return list.map((item, index) => (
                  <motion.div 
                    key={item.id} 
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-50px' }}
                    transition={{ delay: index % 5 * 0.1, ease: DESIGN.ease }}
                    style={{ marginBottom: '40px' }}
                  >
                    <div 
                      onClick={() => onItemClick(item)} 
                      style={{ 
                        position: 'relative', 
                        aspectRatio: activeTab === 'coming' ? '2/3' : '16/9', 
                        borderRadius: '16px', 
                        overflow: 'hidden', 
                        background: '#0a0a0a',
                        border: DESIGN.border,
                        boxShadow: DESIGN.shadow,
                        // Arty staggered sizes for the gallery view
                        width: activeTab === 'coming' ? '85%' : '100%',
                        margin: activeTab === 'coming' && index % 2 === 1 ? '0 0 0 auto' : '0'
                      }}
                    >
                      <img 
                        src={getBackdropUrl(item.backdropPath, 'original') || getPosterUrl(item.posterPath, 'large')} 
                        alt="" 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                      />
                      <div style={{ 
                        position: 'absolute', 
                        top: '16px', 
                        right: '16px', 
                        background: activeTab === 'everyone' ? 'rgba(255,255,255,0.9)' : COLORS.primary, 
                        color: activeTab === 'everyone' ? '#000' : '#fff',
                        padding: '6px 10px', 
                        borderRadius: '8px', 
                        fontSize: '0.7rem', 
                        fontWeight: 900,
                        letterSpacing: '0.05em',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                      }}>
                        {activeTab === 'everyone' ? 'TRENDING' : 'OPENING'}
                      </div>
                    </div>
                    
                    <div style={{ 
                      marginTop: '16px', 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'flex-start',
                      padding: activeTab === 'coming' ? (index % 2 === 1 ? '0 0 0 15%' : '0 15% 0 0') : '0'
                    }}>
                      <div style={{ flex: 1, marginRight: '20px' }}>
                        <h3 
                          onClick={() => onItemClick(item)} 
                          style={{ margin: 0, fontSize: '1.2rem', fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1 }}
                        >
                          {(item as Movie).title || (item as TVShow).name}
                        </h3>
                        <p style={{ 
                          margin: '8px 0', 
                          fontSize: '0.85rem', 
                          color: '#666', 
                          lineHeight: '1.5', 
                          display: '-webkit-box', 
                          WebkitLineClamp: 2, 
                          WebkitBoxOrient: 'vertical', 
                          overflow: 'hidden',
                          fontWeight: 500
                        }}>
                          {item.overview}
                        </p>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
                        <button 
                          onClick={() => { triggerHaptic('medium'); scheduleReminder(item.id, (item as Movie).title || (item as TVShow).name, (item as Movie).title ? 'movie' : 'tv'); }} 
                          style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ));
              })()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
