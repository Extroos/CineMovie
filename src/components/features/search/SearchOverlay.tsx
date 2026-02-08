import React, { useState, useEffect, useRef } from 'react';
import type { Movie } from '../../../types';
import { searchMulti, getPosterUrl } from '../../../services/tmdb';
import { COLORS } from '../../../constants';
import { triggerHaptic, triggerSuccessHaptic } from '../../../utils/haptics';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';

interface SearchOverlayProps {
  onClose: () => void;
  onMovieClick: (movie: Movie) => void;
  onShowResults: (query: string, results: Movie[]) => void;
}

export default function SearchOverlay({ onClose, onMovieClick, onShowResults }: SearchOverlayProps) {
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [suggestions, setSuggestions] = useState<Movie[]>([]);
  const [isListening, setIsListening] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastSearchQuery = useRef<string>('');

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
    
    // Lock body scroll
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Debounced Live Search
  useEffect(() => {
    // Immediate cleanup for fast typing
    if (!query.trim()) {
      setSuggestions([]);
      setSearching(false);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      performSearch(query);
    }, 400); // Slightly faster debounce

    return () => {
      clearTimeout(delayDebounceFn);
    };
  }, [query]);

  const performSearch = async (searchTerm: string, force: boolean = false) => {
    if (!searchTerm.trim()) return;
    if (!force && searchTerm === lastSearchQuery.current) return;

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    setSearching(true);
    try {
      const results = await searchMulti(searchTerm, controller.signal);
      setSuggestions(results);
      lastSearchQuery.current = searchTerm;
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Search failed:', error);
      }
    } finally {
      if (!controller.signal.aborted) {
        setSearching(false);
      }
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim()) return;
    triggerHaptic('medium');

    // SMART LOGIC: If we're still searching or query has changed, force an immediate update
    if (searching || query !== lastSearchQuery.current) {
      setSearching(true);
      // Create a fresh controller for the final "Enter" search
      if (abortControllerRef.current) abortControllerRef.current.abort();
      
      const results = await searchMulti(query);
      onShowResults(query, results);
    } else {
      onShowResults(query, suggestions);
    }
  };

  const handleVoiceSearch = async () => {
    try {
      const { available } = await SpeechRecognition.available();
      if (!available) {
        alert("Voice recognition is not available on this device.");
        return;
      }

      const { speechRecognition } = await SpeechRecognition.checkPermissions();
      if (speechRecognition !== 'granted') {
        const { speechRecognition: newPermission } = await SpeechRecognition.requestPermissions();
        if (newPermission !== 'granted') return;
      }

      triggerHaptic('medium');
      setIsListening(true);
      
      SpeechRecognition.start({
        language: "en-US",
        partialResults: true,
        popup: true,
      });

      SpeechRecognition.addListener('partialResults', (data: any) => {
        if (data.matches && data.matches.length > 0) {
          setQuery(data.matches[0]);
        }
      });

      // Cleanup listener on stop is handled by the plugin or we can wait for results
      // On many devices, start() opens a system dialog that returns the result
    } catch (e) {
      console.error('Voice search error:', e);
    } finally {
      setIsListening(false);
    }
  };

  const clearSearch = () => {
    triggerHaptic('light');
    setQuery('');
    inputRef.current?.focus();
  };

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 2000,
        // Liquid Glass: High vibrancy "wet glass" effect
        background: 'rgba(10, 10, 10, 0.4)', 
        backdropFilter: 'blur(15px) saturate(220%) brightness(1.1)',
        WebkitBackdropFilter: 'blur(15px) saturate(220%) brightness(1.1)',
        display: 'flex',
        flexDirection: 'column',
        // Backdrop fade-in only
        animation: 'backdropFadeBlur 0.4s ease-out forwards',
      }}
    >
      {/* Search Header */}
      <div style={{
        padding: 'calc(16px + env(safe-area-inset-top, 0px)) 20px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: 'transparent', // Transparent to see hero photo
        // Staggered entrance for the input bar
        animation: 'inputSlideIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
      }}>
        <button
          onClick={() => { triggerHaptic('light'); onClose(); }}
          aria-label="Close search"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#FFFFFF',
            cursor: 'pointer',
            padding: '8px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>

        <form 
          onSubmit={handleSearch} 
          style={{ 
            flex: 1,
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <input
            ref={inputRef}
            type="text"
            placeholder="Search movies, TV shows..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 40px 12px 44px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '16px',
              color: '#FFFFFF',
              fontSize: '17px',
              fontWeight: 500,
              outline: 'none',
              boxShadow: '0 4px 24px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255, 255, 255, 0.1)',
            }}
          />
          <svg 
            width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ position: 'absolute', left: '12px', pointerEvents: 'none' }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>

          {/* Action Buttons (Voice/Clear) */}
          <div style={{ position: 'absolute', right: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {query ? (
              <button 
                type="button"
                onClick={clearSearch}
                style={{ background: 'none', border: 'none', color: '#8E8E93', padding: '4px', cursor: 'pointer' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            ) : (
              <button 
                type="button"
                onClick={handleVoiceSearch}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: isListening ? COLORS.primary : '#8E8E93', 
                  padding: '4px', 
                  cursor: 'pointer',
                  animation: isListening ? 'pulse 1.5s infinite' : 'none'
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Suggestions List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        padding: '16px 20px 40px',
      }}>
        {/* Categorical Tags */}
        {!query && !searching && (
          <div style={{ marginTop: '20px' }}>
            <p style={{
              fontSize: '13px',
              fontWeight: 600,
              color: '#8E8E93',
              marginBottom: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              Browse Categories
            </p>
            <div style={{
              display: 'flex',
              gap: '10px',
              overflowX: 'auto',
              paddingBottom: '10px',
              msOverflowStyle: 'none',
              scrollbarWidth: 'none',
              WebkitOverflowScrolling: 'touch',
            }}>
              {['Action', 'Comedy', 'Sci-Fi', 'Horror', 'Romance', 'Kids', 'Trending'].map(tag => (
                <button
                  key={tag}
                  onClick={() => {
                    triggerHaptic('light');
                    setQuery(tag);
                  }}
                  style={{
                    whiteSpace: 'nowrap',
                    padding: '8px 20px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '20px',
                    color: '#FFF',
                    fontSize: '14px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}

        {searching ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '40px' }}>
            <div style={{
              width: '32px', height: '32px',
              border: '3px solid rgba(255, 255, 255, 0.1)',
              borderTopColor: COLORS.primary,
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
          </div>
        ) : query && suggestions.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <p style={{
              fontSize: '13px',
              fontWeight: 600,
              color: '#8E8E93',
              marginBottom: '8px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              Top Results
            </p>
            {suggestions.map((movie, index) => (
              <div
                key={movie.id}
                onClick={() => { triggerHaptic('light'); onMovieClick(movie); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '8px',
                  borderRadius: '12px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)',
                  animation: `suggestionFadeInUp 0.4s ease-out ${index * 0.05}s both`,
                }}
              >
                {/* Tiny Poster */}
                <img
                  src={getPosterUrl(movie.posterPath, 'small')}
                  alt={movie.title}
                  style={{
                    width: '40px',
                    height: '60px',
                    borderRadius: '6px',
                    objectFit: 'cover',
                    backgroundColor: '#1C1C1E',
                  }}
                />
                
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4 style={{
                    color: '#FFFFFF',
                    fontSize: '15px',
                    fontWeight: 500,
                    margin: '0 0 4px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {movie.title || (movie as any).name}
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                     {/* Year Badge */}
                    <span style={{
                      color: '#8E8E93',
                      fontSize: '13px',
                      background: 'rgba(255, 255, 255, 0.1)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontWeight: 600,
                    }}>
                      {(movie.releaseDate || (movie as any).firstAirDate || '').split('-')[0] || 'N/A'}
                    </span>
                    {/* Rating removed per USER request */}
                  </div>
                </div>
                
                {/* Arrow */}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
            ))}
          </div>
        ) : query && !searching ? (
          <div style={{ textAlign: 'center', paddingTop: '60px', color: '#8E8E93' }}>
            <p>No matches found for "{query}"</p>
          </div>
        ) : (
           /* Empty State */
          <div style={{ textAlign: 'center', paddingTop: '60px', opacity: 0.4 }}>
             <p style={{ color: '#FFF' }}>Type or use voice to search...</p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes backdropFadeBlur {
          from { opacity: 0; backdrop-filter: blur(0) saturate(100%); }
          to { opacity: 1; backdrop-filter: blur(15px) saturate(220%); }
        }
        @keyframes inputSlideIn {
          from { opacity: 0; transform: translateX(30px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes suggestionFadeInUp {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.4; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
