import React, { useState, useEffect } from 'react';
import type { Movie, TVShow } from '../../types';
import { 
  getBackdropUrl, 
  getPosterUrl, 
  getMoviesByGenre, 
  getTVShowsByGenre 
} from '../../services/tmdb';
import { AnimeService } from '../../services/anime';
import { triggerHaptic } from '../../utils/haptics';
import { scheduleReminder } from '../../utils/notifications';
import { COLORS } from '../../constants';
import AnimeSchedule from '../../kitsune-components/anime-schedule';

interface BrowseNewsProps {
  trending: (Movie | TVShow)[];
  upcoming: Movie[];
  animeContent: {
    trending: any[];
    latest: any[];
    upcoming: any[];
  };
  onItemClick: (item: any) => void;
}

const GENRES = [
  { id: 9999, name: 'Anime', gradient: 'linear-gradient(135deg, #FF9966 0%, #FF5E62 100%)' },
  { id: 28, name: 'Action', gradient: 'linear-gradient(135deg, #FF4B2B 0%, #FF416C 100%)' },
  { id: 12, name: 'Adventure', gradient: 'linear-gradient(135deg, #FFD200 0%, #F7971E 100%)' },
  { id: 16, name: 'Animation', gradient: 'linear-gradient(135deg, #00C9FF 0%, #92FE9D 100%)' },
  { id: 35, name: 'Comedy', gradient: 'linear-gradient(135deg, #FDC830 0%, #F37335 100%)' },
  { id: 80, name: 'Crime', gradient: 'linear-gradient(135deg, #2c3e50 0%, #3498db 100%)' },
  { id: 99, name: 'Documentary', gradient: 'linear-gradient(135deg, #134E5E 0%, #71B280 100%)' },
  { id: 18, name: 'Drama', gradient: 'linear-gradient(135deg, #8E2DE2 0%, #4A00E0 100%)' },
  { id: 10751, name: 'Family', gradient: 'linear-gradient(135deg, #f857a6 0%, #ff5858 100%)' },
  { id: 14, name: 'Fantasy', gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
  { id: 27, name: 'Horror', gradient: 'linear-gradient(135deg, #000000 0%, #434343 100%)' },
  { id: 10402, name: 'Music', gradient: 'linear-gradient(135deg, #FC466B 0%, #3F5EFB 100%)' },
  { id: 9648, name: 'Mystery', gradient: 'linear-gradient(135deg, #603813 0%, #b29f94 100%)' },
  { id: 10749, name: 'Romance', gradient: 'linear-gradient(135deg, #cc2b5e 0%, #753a88 100%)' },
  { id: 878, name: 'Sci-Fi', gradient: 'linear-gradient(135deg, #000428 0%, #004e92 100%)' },
  { id: 53, name: 'Thriller', gradient: 'linear-gradient(135deg, #e1eec3 0%, #f05053 100%)' },
];

type ContentItem = (Movie | TVShow) & { mediaType: 'movie' | 'tv' | 'anime' };

export default function BrowseNewsPage({ trending, upcoming, animeContent, onItemClick }: BrowseNewsProps) {
  const [activeTab, setActiveTab] = useState<'everyone' | 'coming' | 'categories' | 'schedules'>('everyone');
  const [selectedGenre, setSelectedGenre] = useState<number | null>(null);
  const [genreContent, setGenreContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [genreBackdrops, setGenreBackdrops] = useState<Record<number, string>>({});

  // Load Genre Backdrops once
  useEffect(() => {
    const loadBackdrops = async () => {
      const backdrops: Record<number, string> = {};
      try {
        const results = await Promise.all(
          GENRES.map(genre => {
             if (genre.id === 9999) return []; // Skip anime for typical TMDB genre backdrop
             return getMoviesByGenre(genre.id).catch(() => []);
          })
        );
        GENRES.forEach((genre, index) => {
          if (genre.id === 9999) return;
          if (results[index]?.[0]?.backdropPath) {
            backdrops[genre.id] = results[index][0].backdropPath;
          }
        });
        
        // Fetch one anime for backdrop
        AnimeService.getTrending().then(res => {
            if (res && res.length > 0 && res[0].bannerImage) {
                setGenreBackdrops(prev => ({ ...prev, 9999: res[0].bannerImage! }));
            }
        });

        setGenreBackdrops(backdrops);
      } catch (e) { console.error(e); }
    };
    loadBackdrops();
  }, []);

  // Smart Back Navigation
  useEffect(() => {
    if (selectedGenre) {
      window.history.pushState({ genre: selectedGenre }, '');
      const handlePopState = () => setSelectedGenre(null);
      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, [selectedGenre]);

  // Handle Genre Content Loading
  useEffect(() => {
    if (selectedGenre) {
      const loadContent = async () => {
        setLoading(true);
        try {
          const genre = GENRES.find(g => g.id === selectedGenre);
          if (!genre) return;
          
          if (selectedGenre === 9999) {
             const [trending, popular] = await Promise.all([
               AnimeService.getTrending(),
               AnimeService.getPopular()
             ]);
             setGenreContent([
                ...trending, 
                ...popular
             ].sort(() => Math.random() - 0.5) as any);
          } else {
             const [m, s] = await Promise.all([
               getMoviesByGenre(selectedGenre),
               getTVShowsByGenre(selectedGenre)
             ]);
             setGenreContent([
               ...m.map(x => ({ ...x, mediaType: 'movie' as const })),
               ...s.map(x => ({ ...x, mediaType: 'tv' as const }))
             ].sort(() => Math.random() - 0.5));
          }
        } catch (e) { console.error(e); }
        setLoading(false);
      };
      loadContent();
    }
  }, [selectedGenre]);

  const handleBack = () => {
    window.history.back();
    setTimeout(() => { if (selectedGenre) setSelectedGenre(null); }, 50);
  };

  const handleShare = (item: any) => {
    triggerHaptic('light');
    const title = (item as Movie).title || (item as TVShow).name;
    if (navigator.share) {
      navigator.share({
        title: title,
        text: `Check out ${title} on CineMovie!`,
        url: window.location.href,
      }).catch(console.error);
    }
  };

  const handleRemindMe = (item: any) => {
    triggerHaptic('medium');
    const title = (item as Movie).title || (item as TVShow).name;
    const type = (item as Movie).title ? 'movie' : 'tv';
    scheduleReminder(item.id, title, type);
  };

  if (selectedGenre) {
    const genre = GENRES.find(g => g.id === selectedGenre);
    return (
      <div style={{ minHeight: '100vh', background: '#080808', paddingTop: 'env(safe-area-inset-top)' }}>
        <div style={{ 
          padding: '16px', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px',
          position: 'sticky',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          background: 'rgba(10, 10, 10, 0.6)', 
          backdropFilter: 'blur(30px) saturate(180%) brightness(1.1)',
          WebkitBackdropFilter: 'blur(30px) saturate(180%) brightness(1.1)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
        }}>
          <button onClick={handleBack} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '8px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>{genre?.name}</h2>
        </div>
        <div style={{ 
          padding: '16px',
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '10px',
          paddingBottom: '100px',
          paddingTop: '64px'
        }}>
          {loading ? [1,2,3,4,5,6].map(i => <div key={i} style={{ aspectRatio: '2/3', background: '#1a1a1a', borderRadius: '8px' }} />) :
            genreContent.map(item => (
              <div key={item.id} onClick={() => onItemClick(item)} style={{ cursor: 'pointer', aspectRatio: '2/3', borderRadius: '8px', overflow: 'hidden', background: '#1a1a1a' }}>
                <img src={getPosterUrl(item.posterPath, 'small')} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
            ))
          }
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#080808',
      color: '#fff',
      fontFamily: "'Inter', sans-serif",
      paddingBottom: 'calc(100px + env(safe-area-inset-bottom))'
    }}>
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        background: 'rgba(10, 10, 10, 0.6)', 
        backdropFilter: 'blur(30px) saturate(180%) brightness(1.1)',
        WebkitBackdropFilter: 'blur(30px) saturate(180%) brightness(1.1)',
        padding: '0 16px',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
      }}>
        <div style={{ padding: 'calc(16px + env(safe-area-inset-top)) 16px 16px' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 900, letterSpacing: '-0.5px', margin: 0 }}>Browse News</h1>
          <p style={{ margin: '4px 0 0', opacity: 0.6, fontSize: '0.85rem' }}>Discovery & Trends</p>
        </div>

        <div style={{ display: 'flex', gap: '6px', paddingBottom: '12px' }}>
          {['everyone', 'coming', 'schedules', 'categories'].map((tab) => (
            <button
              key={tab}
              onClick={() => { triggerHaptic('light'); setActiveTab(tab as any); }}
              style={{
                flex: 1,
                background: activeTab === tab ? '#fff' : 'rgba(255,255,255,0.05)',
                border: '1px solid',
                borderColor: activeTab === tab ? 'transparent' : 'rgba(255,255,255,0.05)',
                color: activeTab === tab ? '#000' : '#aaa',
                padding: '8px 0',
                fontSize: '0.75rem',
                fontWeight: 700,
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
                textTransform: 'capitalize',
                scale: activeTab === tab ? '1' : '0.96',
              }}
            >
              {tab === 'everyone' ? 'Latest' : tab === 'coming' ? 'Soon' : tab === 'schedules' ? 'Schedule' : 'Explore'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: '20px' }}>
        {activeTab === 'schedules' ? (
           <AnimeSchedule />
        ) : activeTab === 'categories' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            {GENRES.map(genre => (
              <div
                key={genre.id}
                onClick={() => { triggerHaptic('medium'); setSelectedGenre(genre.id); }}
                style={{ aspectRatio: '2.1/1', borderRadius: '16px', position: 'relative', overflow: 'hidden', cursor: 'pointer', background: genre.gradient }}
              >
                {genreBackdrops[genre.id] && (
                  <img src={getBackdropUrl(genreBackdrops[genre.id], 'small')} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.5, mixBlendMode: 'overlay' }} />
                )}
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent 80%)', padding: '12px', display: 'flex', alignItems: 'flex-end' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.9rem' }}>{genre.name}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          (() => {
            const list = activeTab === 'everyone' 
              ? [...trending, ...animeContent.latest.map(a => ({...a, mediaType: 'anime' as const}))]
              : [...upcoming, ...animeContent.upcoming.map(a => ({...a, mediaType: 'anime' as const}))];
            
            return list.map((item, index) => (
              <div key={item.id} style={{ marginBottom: '32px', animation: 'fadeIn 0.5s ease-out forwards', animationDelay: `${index * 0.1}s`, opacity: 0 }}>
                <div onClick={() => onItemClick(item)} style={{ position: 'relative', aspectRatio: '16/9', borderRadius: '12px', overflow: 'hidden', background: '#1a1a1a' }}>
                  <img src={item.mediaType === 'anime' ? (item as any).bannerImage || (item as any).posterPath : (getBackdropUrl(item.backdropPath, 'original') || getPosterUrl(item.posterPath, 'large'))} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', top: '12px', left: '12px', background: item.mediaType === 'anime' ? '#FF9966' : '#E50914', padding: '4px 8px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 900 }}>
                    {item.mediaType === 'anime' ? 'ANIME' : activeTab === 'everyone' ? 'TRENDING' : 'NEW RELEASE'}
                  </div>
                </div>
                <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, marginRight: '16px' }}>
                    <h3 onClick={() => onItemClick(item)} style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900 }}>{(item as any).title?.english || (item as Movie).title || (item as TVShow).name}</h3>
                    <p style={{ margin: '6px 0', fontSize: '0.8rem', color: '#888', lineHeight: '1.4', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{(item as any).description || item.overview}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '16px' }}>
                    <button onClick={() => handleRemindMe(item)} style={{ background: 'none', border: 'none', color: '#fff' }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg></button>
                    <button onClick={() => handleShare(item)} style={{ background: 'none', border: 'none', color: '#fff' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg></button>
                  </div>
                </div>
              </div>
            ));
          })()
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
