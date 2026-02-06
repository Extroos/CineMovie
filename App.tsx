import React, { useState, useEffect } from 'react';
import Header from './components/layout/Header';
import Hero from './components/features/home/Hero';
import ContentRow from './components/features/home/ContentRow';
import MovieDetails from './components/features/details/MovieDetails';
import TVShowDetails from './components/features/details/TVShowDetails';
import SearchOverlay from './components/features/search/SearchOverlay';
import SearchResults from './components/features/search/SearchResults';
import MyListPage from './components/pages/MyListPage';
import BrowseNewsPage from './components/pages/BrowseNewsPage';
import ActorPage from './components/features/details/ActorPage';
import SettingsPage from './components/features/settings/SettingsPage';
import ErrorBoundary from './components/common/ErrorBoundary';
import { HeroSkeleton, ContentRowSkeleton } from './components/common/Skeletons';
import OfflineScreen from './components/layout/OfflineScreen';
import UpdateModal from './components/features/settings/UpdateModal';
import LoginPage from './components/features/auth/LoginPage';
import { checkForUpdates } from './services/updater'; 
import { supabase } from './utils/supabase';
import { removeFromMyList } from './services/myList';
import { useContent } from './hooks/useContent';
import type { Movie, TVShow } from './types';
import { COLORS } from './constants';
import { triggerHaptic } from './utils/haptics';
import { useFriends } from './hooks/useFriends';
import { Profile, ProfileService } from './services/profiles';
import ProfileSelector from './components/features/auth/ProfileSelector';
import BottomNav from './components/layout/BottomNav';
import AnimeDetails from './components/features/details/AnimeDetails';
import { AnimeService } from './services/anime';
import { QueryClient, QueryClientProvider } from 'react-query';
import AnimeSchedule from './kitsune-components/anime-schedule';

const queryClient = new QueryClient();

type View = 'home' | 'movies' | 'tvshows' | 'newandhot' | 'mylist' | 'settings';

export default function App() {
  const [currentView, setCurrentView] = useState<View>('home');
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showProfileSelector, setShowProfileSelector] = useState(true);
  
  // Settings State
  const [minimalHome, setMinimalHome] = useState(localStorage.getItem('settings_minimal_home') === 'true');

  useEffect(() => {
    const handleSettingsChange = () => {
        setMinimalHome(localStorage.getItem('settings_minimal_home') === 'true');
    };
    window.addEventListener('settingsChanged', handleSettingsChange);
    return () => window.removeEventListener('settingsChanged', handleSettingsChange);
  }, []);

  const handleLogin = () => {
    // Auth listener handles state update
  };
  
  const handleLogout = async () => {
    try {
        await supabase.auth.signOut();
    } catch (error) {
        console.error('Logout error:', error);
    }
    setIsAuthenticated(false);
    setActiveProfile(null);
    setShowProfileSelector(true);
    localStorage.removeItem('cinemovie_active_profile_id');
    triggerHaptic('medium');
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const isAuth = !!session;
      setIsAuthenticated(isAuth);
      
      if (!isAuth) {
        setShowProfileSelector(true);
        setActiveProfile(null);
        setCurrentView('home');
      }
    });

    return () => subscription.unsubscribe();
  }, []);


  const scrollPositions = React.useRef<Record<string, number>>({});
  
  useEffect(() => {
    const timer = setTimeout(() => {
      const savedPosition = scrollPositions.current[currentView] || 0;
      window.scrollTo({
        top: savedPosition,
        behavior: 'auto'
      });
    }, 0);
    return () => clearTimeout(timer);
  }, [currentView]);

  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [selectedTVShow, setSelectedTVShow] = useState<TVShow | null>(null);
  const [selectedActor, setSelectedActor] = useState<number | null>(null);
  const [selectedAnime, setSelectedAnime] = useState<any | null>(null);
  
  /* Pass activeProfile ID to trigger reload on profile switch */
  const content = useContent(activeProfile?.id);
  const { 
    trending, popular, topRated, upcoming, action, comedy, family, scifi, horror, documentary, adventure,
    trendingTV, popularTV, topRatedTV, dramaTV, comedyTV, scifiTV, crimeTV, mysteryTV, documentaryTV,
    trendingAnime, popularAnime, latestAnime, upcomingAnime,
    latestReleases, 
    myList, continueWatching, topPicks,
    heroMovie, heroTVShow,
    loading, error,
    refreshMyList
  } = content;

  const { activity: friendActivity } = useFriends(); 

  // Group activities by item ID to handle multiple friends watching the same thing
  const groupedActivity = new Map<string, any>();
  
  friendActivity.forEach(act => {
      const key = String(act.item.id);
      const existing = groupedActivity.get(key);
      
      const watcher = {
          friend: act.friend,
          episode: act.episode,
          season: act.season,
          progress: act.progress,
          timestamp: act.timestamp
      };

      if (existing) {
          existing.watchers.push(watcher);
          // Keep the item data from the most recent activity
          if (act.timestamp > existing.timestamp) {
               existing.timestamp = act.timestamp;
               existing.friendEpisode = act.episode;
               existing.watchedBy = act.friend; // Main avatar is latest
          }
      } else {
          groupedActivity.set(key, {
              ...act.item,
              watchers: [watcher],
              watchedBy: act.friend,
              friendEpisode: act.episode, 
              timestamp: act.timestamp
          });
      }
  });

  const friendActivityItems = Array.from(groupedActivity.values());

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResultsOpen, setSearchResultsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Movie[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  const [updateAvailable, setUpdateAvailable] = useState<any>(null);



  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    checkForUpdates().then(update => {
      if (update) setUpdateAvailable(update);
    }).catch(() => {});
  }, []);

  const handleProfileSelected = async (profile: Profile) => {
    ProfileService.setActiveProfile(profile.id, profile);
    setActiveProfile(profile);
    setShowProfileSelector(false);
    setCurrentView('home');
    content.reloadAll();
  };

  const handleAnimeClick = (anime: any) => {
      setSelectedAnime(anime);
      setSearchOpen(false);
      setSearchResultsOpen(false);
  };

  useEffect(() => {
    const handleMovieClickEvent = (e: any) => handleMovieClick(e.detail);
    const handleTVShowClickEvent = (e: any) => handleTVShowClick(e.detail);
    
    window.addEventListener('movieClick', handleMovieClickEvent);
    window.addEventListener('tvShowClick', handleTVShowClickEvent);
    
    import('@capacitor/app').then(({ App }) => {
      let lastBackPress = 0;
      
      App.addListener('backButton', ({ canGoBack }) => {
        // Skip if video player is open (handled by VideoPlayer component)
        if (document.querySelector('.video-player-overlay')) {
           return;
        }

        // Close profile selector first
        if (showProfileSelector && activeProfile) {
          setShowProfileSelector(false);
          return;
        }

        // Close movie/show details
        if (selectedMovie) {
          setSelectedMovie(null);
          return;
        }
        if (selectedTVShow) {
          setSelectedTVShow(null);
          return;
        }
        if (selectedActor) {
          setSelectedActor(null);
          return;
        }
        if (selectedAnime) {
          setSelectedAnime(null);
          return;
        }

        // Close search overlays
        if (searchOpen) {
          setSearchOpen(false);
          return;
        }
        if (searchResultsOpen) {
          setSearchResultsOpen(false);
          return;
        }

        // Navigate to home from other views (settings, mylist, etc.)
        if (currentView !== 'home') {
          setCurrentView('home');
          return;
        }

        // Double-tap to exit from home
        const now = Date.now();
        if (now - lastBackPress < 2000) {
          // Second tap within 2 seconds - exit app
          App.exitApp();
        } else {
          // First tap - show toast hint and wait
          lastBackPress = now;
          // Optional: Show toast message (if you have a toast system)
          console.log('Press back again to exit');
        }
      });
    });
    
    const handleProfileChange = () => {
        content.reloadAll();
    };

    window.addEventListener('profileChanged', handleProfileChange);
    
    return () => {
      window.removeEventListener('movieClick', handleMovieClickEvent);
      window.removeEventListener('tvShowClick', handleTVShowClickEvent);
      window.removeEventListener('profileChanged', handleProfileChange);
    };
  }, [selectedMovie, selectedTVShow, selectedActor, selectedAnime, searchOpen, searchResultsOpen, currentView]);



  const handleRemoveFromList = async (movieId: number) => {
    await removeFromMyList(movieId);
    content.refreshMyList();
  };

  const handleMovieClick = (movie: Movie) => {
    if ((movie as any).mediaType === 'anime') {
        handleAnimeClick(movie);
        return;
    }
    if ((movie as any).mediaType === 'tv') {
        handleTVShowClick(movie as any);
        return;
    }
    setSelectedMovie(movie);
    setSearchOpen(false);
    setSearchResultsOpen(false);
  };

  const handleTVShowClick = (show: TVShow) => {
    setSelectedTVShow(show);
    setSearchOpen(false);
    setSearchResultsOpen(false);
  };

  const handleContentClick = (item: Movie | TVShow) => {
    if ((item as TVShow).firstAirDate || (item as TVShow).name) {
      handleTVShowClick(item as TVShow);
    } else {
      handleMovieClick(item as Movie);
    }
  };

  const handleShowSearchResults = (query: string, results: Movie[]) => {
    setSearchQuery(query);
    setSearchResults(results);
    setSearchOpen(false);
    setSearchResultsOpen(true);
  };

  const handleNavClick = (view: View) => {
    scrollPositions.current[currentView] = window.scrollY;
    setCurrentView(view);
    setSearchResultsOpen(false);
  };


  const handleSurpriseMe = () => {
    triggerHaptic('medium');
    const allContent = [...trending, ...popular, ...trendingTV, ...popularTV];
    if (allContent.length > 0) {
      const randomItem = allContent[Math.floor(Math.random() * allContent.length)];
      if ((randomItem as any).firstAirDate) {
        handleTVShowClick(randomItem as any);
      } else {
        handleMovieClick(randomItem as any);
      }
    }
  };

  if (!isOnline) {
    return <OfflineScreen onRetry={() => window.location.reload()} />;
  }

  const mixContent = (arrays: any[][]) => {
    const mixed = arrays.flat();
    const uniqueItems = new Map();
    const now = new Date();
    const hourSeed = Math.floor(now.getTime() / (1000 * 60 * 60));
    let smartEntropy = parseInt(localStorage.getItem('smart_entropy') || '0');
    const lastVisit = parseInt(localStorage.getItem('last_visit') || '0');
    const hoursSinceLastVisit = (now.getTime() - lastVisit) / (1000 * 60 * 60);

    if (hoursSinceLastVisit > 10) {
      smartEntropy = Math.floor(Math.random() * 10000); 
      localStorage.setItem('smart_entropy', smartEntropy.toString());
    }
    
    localStorage.setItem('last_visit', now.getTime().toString());

    mixed.forEach(item => {
      if (!item) return;
      if (activeProfile?.isKids) {
          const isKidsContent = (item as any).genreIds?.some((id: number) => [16, 10751, 12].includes(id)) || 
                                (item as any).genres?.some((g: any) => [16, 10751, 12, 'Animation', 'Family', 'Adventure'].includes(g.id || g.name));
          if (!isKidsContent) return;
      }

      const key = `${item.id}-${item.title || item.name}`;
      if (!uniqueItems.has(key)) {
        uniqueItems.set(key, item);
      }
    });

    return Array.from(uniqueItems.values()).sort((a, b) => {
      const seedA = (a.id + hourSeed + smartEntropy) * 1664525 + 1013904223;
      const seedB = (b.id + hourSeed + smartEntropy) * 1664525 + 1013904223;
      return (seedA % 100) - (seedB % 100);
    });
  };

  const filterKids = <T extends Movie | TVShow>(items: T[]): T[] => {
    if (!activeProfile?.isKids) return items;
    return items.filter(item => {
        const genreIds = (item as any).genreIds || (item as any).genres?.map((g: any) => g.id);
        return genreIds?.some((id: number) => [16, 10751, 12].includes(id));
    });
  };

  return (
    <QueryClientProvider client={queryClient}>
    <ErrorBoundary>
      {isLoading ? (
        <div>Loading authentication...</div>
      ) : !isAuthenticated ? (
        <LoginPage onLogin={handleLogin} />
      ) : (
        <>
          <style>{`
            :root {
              --brand-red: #E50914;
            }
            html, body {
              overscroll-behavior: none;
              overscroll-behavior-y: contain;
              -webkit-overflow-scrolling: touch;
              overflow-x: hidden;
              touch-action: pan-y;
            }
            body {
              font-size: 14px; 
              line-height: 1.4;
              -webkit-font-smoothing: antialiased;
              -moz-osx-font-smoothing: grayscale;
              user-select: none;
              -webkit-user-select: none;
              -webkit-touch-callout: none;
              -webkit-tap-highlight-color: transparent;
            }
            img {
              pointer-events: none;
              -webkit-user-drag: none;
              user-select: none;
              -webkit-user-select: none;
            }
            ::-webkit-scrollbar {
              width: 5px;
              height: 5px;
            }
            ::-webkit-scrollbar-track {
              background: #0a0a0a;
            }
            ::-webkit-scrollbar-thumb {
              background: #333;
              border-radius: 10px;
            }
            ::-webkit-scrollbar-thumb:hover {
              background: #444;
            }
            .no-scrollbar::-webkit-scrollbar {
              display: none;
            }
            .no-scrollbar {
              -ms-overflow-style: none;
              scrollbar-width: none;
            }
            .active-press:active {
              opacity: 0.7;
              transform: scale(0.98);
            }
            /* Prevent mobile horizontal overscroll */
            .content-row-scroll {
              touch-action: pan-x;
              overscroll-behavior-x: contain;
              will-change: transform;
            }

            /* Hardware Acceleration Hints */
            .profile-item, .profile-avatar, .add-profile-btn, .manage-btn, 
            .movie-card, .search-overlay, .details-container {
              will-change: transform, opacity;
            }
          `}</style>
      
      {(!activeProfile || showProfileSelector) && (
        <ProfileSelector onProfileSelected={handleProfileSelected} />
      )}


      {currentView === 'home' && (
        <div style={{ 
          minHeight: '100vh', 
          background: COLORS.bgPrimary,
          paddingBottom: 'calc(100px + env(safe-area-inset-bottom, 0px))',
        }}>
          <Header 
            onSearchOpen={() => setSearchOpen(true)} 
            activeProfile={activeProfile}
            onSwitchProfile={() => setShowProfileSelector(true)}
          />
          
          <div style={{ paddingTop: 0 }}>
             {loading ? (
                <div style={{ paddingTop: '64px' }}>
                  <HeroSkeleton />
                  <ContentRowSkeleton />
                  <ContentRowSkeleton />
                </div>
             ) : (
                <>
                  <Hero 
                    movie={heroMovie}
                    onPlayClick={() => setSelectedMovie(heroMovie)}
                    onInfoClick={() => setSelectedMovie(heroMovie)}
                  />

                  <div style={{ 
                    position: 'relative', 
                    marginTop: '-4rem', 
                    zIndex: 10,
                    background: 'linear-gradient(to bottom, transparent 0%, #0a0a0a 10%)',
                    paddingTop: '2rem',
                  }}>
                    {/* Fused Watch List (Friends + Mine) */}
                    {(friendActivityItems.length > 0 || continueWatching.length > 0) && (
                      <ContentRow 
                        title={friendActivityItems.length > 0 ? "What We're Watching" : "Continue Watching"} 
                        movies={[...friendActivityItems, ...continueWatching].filter((v,i,a)=>a.findIndex(t=>(String(t.id) === String(v.id)))===i)} 
                        onMovieClick={(item: any) => {
                           // Detect Anime by multiple signals
                           const isAnime = item.mediaType === 'anime' || 
                                           (item.genreIds && item.genreIds.includes('anime')) || // hypothetical
                                           (typeof item.id === 'string' && isNaN(Number(item.id))) || // String ID = Anime
                                           (item.genres && item.genres.some((g:any) => g.name === 'Animation' && item.originCountry?.includes('JP')));
                           
                           if (isAnime) {
                               handleAnimeClick(item);
                           } else if (item.firstAirDate || item.name) {
                               handleTVShowClick(item);
                           } else {
                               handleMovieClick(item);
                           }
                        }} 
                      />
                    )}

                    {/* DISCOVERY SECTIONS (Hidden in Minimal Mode) */}
                    {!minimalHome && (
                    <>
                    {trending.length > 0 && filterKids(trending).length > 0 && (
                      <ContentRow title="Trending Movies" movies={filterKids(trending)} onMovieClick={handleMovieClick} />
                    )}
                    
                    {content.trendingAnime.length > 0 && (
                       <ContentRow title="Trending Anime" movies={content.trendingAnime as any} onMovieClick={handleAnimeClick} />
                    )}

                    {trendingTV.length > 0 && (
                      <ContentRow title="Trending TV Shows" movies={trendingTV} onMovieClick={(show: any) => handleTVShowClick(show)} />
                    )}

                    {popular.length > 0 && (
                      <ContentRow title="Popular Movies" movies={popular} onMovieClick={handleMovieClick} />
                    )}

                    {topRated.length > 0 && (
                      <ContentRow title="Critically Acclaimed" movies={topRated} onMovieClick={handleMovieClick} />
                    )}

                    {action.length > 0 && (
                       <ContentRow title="Action & Adventure" movies={action} onMovieClick={handleMovieClick} />
                    )}

                    {comedy.length > 0 && (
                       <ContentRow title="Comedy Hits" movies={comedy} onMovieClick={handleMovieClick} />
                    )}

                    {family.length > 0 && (
                       <ContentRow title="Family Night" movies={family} onMovieClick={handleMovieClick} />
                    )}

                    {topPicks.length > 0 && (
                      <ContentRow 
                        title="Top Picks for You" 
                        movies={topPicks} 
                        onMovieClick={(item: any) => {
                           if (item.firstAirDate || item.name) {
                             handleTVShowClick(item);
                           } else {
                             handleMovieClick(item);
                           }
                        }} 
                      />
                    )}

                    {latestReleases.length > 0 && (
                      <ContentRow 
                        title="🎬 Already on VidSrc" 
                        movies={latestReleases} 
                        onMovieClick={handleMovieClick} 
                      />
                    )}

                    {upcoming.length > 0 && filterKids(upcoming).length > 0 && (
                      <ContentRow title="Coming Soon" movies={filterKids(upcoming)} onMovieClick={handleMovieClick} />
                    )}
                    </>
                    )}
                  </div>
                </>
             )}
          </div>
        </div>
      )}

      {currentView === 'movies' && (
        <div style={{ 
          minHeight: '100vh', 
          background: COLORS.bgPrimary,
          paddingBottom: 'calc(100px + env(safe-area-inset-bottom, 0px))',
        }}>
          <Header 
            onSearchOpen={() => setSearchOpen(true)} 
            activeProfile={activeProfile}
            onSwitchProfile={() => setShowProfileSelector(true)}
          />
          
          <div style={{ paddingTop: 0 }}>
            <Hero 
              movie={heroMovie}
              onPlayClick={() => setSelectedMovie(heroMovie)}
              onInfoClick={() => setSelectedMovie(heroMovie)}
              onSurpriseMe={handleSurpriseMe}
            />

            <div style={{ 
              position: 'relative', 
              marginTop: '-4rem', 
              zIndex: 10,
              background: 'linear-gradient(to bottom, transparent 0%, #0a0a0a 10%)',
              paddingTop: '2rem', 
            }}>
              {trending.length > 0 && (
                <ContentRow title="Trending Now" movies={trending} onMovieClick={handleMovieClick} />
              )}
              {popular.length > 0 && (
                <ContentRow title="Popular Movies" movies={popular} onMovieClick={handleMovieClick} />
              )}
              {topRated.length > 0 && (
                <ContentRow title="Top Rated Movies" movies={topRated} onMovieClick={handleMovieClick} />
              )}
              {action.length > 0 && (
                <ContentRow title="Action & Adventure" movies={action} onMovieClick={handleMovieClick} />
              )}
              {comedy.length > 0 && (
                <ContentRow title="Comedy" movies={comedy} onMovieClick={handleMovieClick} />
              )}
              {family.length > 0 && (
                <ContentRow title="Family" movies={family} onMovieClick={handleMovieClick} />
              )}
              {upcoming.length > 0 && (
                <ContentRow title="Coming Soon" movies={upcoming} onMovieClick={handleMovieClick} />
              )}
            </div>
          </div>
        </div>
      )}

      {currentView === 'tvshows' && heroTVShow && (
        <div style={{ 
          minHeight: '100vh', 
          background: COLORS.bgPrimary,
          paddingBottom: 'calc(100px + env(safe-area-inset-bottom, 0px))',
        }}>
          <Header 
            onSearchOpen={() => setSearchOpen(true)} 
            activeProfile={activeProfile}
            onSwitchProfile={() => setShowProfileSelector(true)}
          />
          
          <div style={{ paddingTop: 0 }}>
            <Hero 
              movie={heroTVShow as any}
              onPlayClick={() => setSelectedTVShow(heroTVShow)}
              onInfoClick={() => setSelectedTVShow(heroTVShow)}
            />

            <div style={{ 
              position: 'relative', 
              marginTop: '-4rem', 
              zIndex: 10,
              background: 'linear-gradient(to bottom, transparent 0%, #0a0a0a 10%)',
              paddingTop: '2rem',
            }}>
              {/* Anime specific display in TV shows or dedicated section? */}

              
              {(trendingTV.length > 0) && (
                <ContentRow 
                  title="Trending" 
                  movies={trendingTV as any} 
                  onMovieClick={(show: any) => handleTVShowClick(show)} 
                />
              )}
              {popularTV.length > 0 && (
                <ContentRow 
                  title="Popular" 
                  movies={popularTV} 
                  onMovieClick={(show: any) => handleTVShowClick(show)} 
                />
              )}

              {/* Anime Selection in TV Shows */}
              {content.trendingAnime.length > 0 && <ContentRow title="Trending Anime" movies={content.trendingAnime as any} onMovieClick={handleAnimeClick} />}
              {content.latestAnime.length > 0 && <ContentRow title="Latest Anime Updates" movies={content.latestAnime as any} onMovieClick={handleAnimeClick} />}
              {content.popularAnime.length > 0 && <ContentRow title="Most Popular Anime" movies={content.popularAnime as any} onMovieClick={handleAnimeClick} />}
              {content.upcomingAnime.length > 0 && <ContentRow title="Upcoming Anime" movies={content.upcomingAnime as any} onMovieClick={handleAnimeClick} />}
              {topRatedTV.length > 0 && (
                <ContentRow 
                  title="Top Rated" 
                  movies={topRatedTV} 
                  onMovieClick={(show: any) => handleTVShowClick(show)} 
                />
              )}
              {dramaTV.length > 0 && (
                <ContentRow title="Drama" movies={dramaTV as any} onMovieClick={(show: any) => handleTVShowClick(show)} />
              )}
              {comedyTV.length > 0 && (
                <ContentRow title="Comedy" movies={comedyTV as any} onMovieClick={(show: any) => handleTVShowClick(show)} />
              )}
            </div>
          </div>
        </div>
      )}

      {currentView === 'mylist' && (
        <MyListPage
          movies={myList}
          onMovieClick={handleMovieClick}
          onRemove={handleRemoveFromList}
        />
      )}

      {currentView === 'newandhot' && (
        <BrowseNewsPage 
          trending={trending}
          upcoming={upcoming}
          animeContent={{
            trending: trendingAnime,
            latest: latestAnime,
            upcoming: upcomingAnime
          }}
          onItemClick={(item: any) => {
             if (item.mediaType === 'anime') {
               handleAnimeClick(item);
             } else if (item.firstAirDate) {
               handleTVShowClick(item);
             } else {
               handleMovieClick(item);
             }
          }}
        />
      )}

      {currentView === 'settings' && (
        <SettingsPage 
          onNavigate={setCurrentView} 
          heroBackground={heroMovie} 
          activeProfile={activeProfile}
          onSwitchProfile={() => setShowProfileSelector(true)}
          onLogout={handleLogout}
          onUpdateFound={(info) => setUpdateAvailable(info)}
        />
      )}

      <BottomNav currentView={currentView} onNavClick={handleNavClick} />

      {searchOpen && (
        <SearchOverlay
          onClose={() => setSearchOpen(false)}
          onMovieClick={handleMovieClick}
          onShowResults={handleShowSearchResults}
        />
      )}

      {searchResultsOpen && (
        <SearchResults
          query={searchQuery}
          results={searchResults}
          loading={searchLoading}
          onMovieClick={handleMovieClick}
          onClose={() => setSearchResultsOpen(false)}
        />
      )}

      {selectedMovie && (
        <MovieDetails
          movie={selectedMovie}
          onClose={() => { setSelectedMovie(null); content.refreshContinueWatching(); }}
          onListUpdate={content.refreshMyList}
          onActorClick={(id) => setSelectedActor(id)}
        />
      )}

      {selectedTVShow && (
        <TVShowDetails
          show={selectedTVShow}
          onClose={() => { setSelectedTVShow(null); content.refreshContinueWatching(); }}
        />
      )}
      
      {selectedAnime && (
        <AnimeDetails
          anime={selectedAnime}
          onClose={() => { setSelectedAnime(null); content.refreshContinueWatching(); }}
        />
      )}

      {selectedActor && (
        <ActorPage
          personId={selectedActor}
          onClose={() => setSelectedActor(null)}
          onMovieClick={handleMovieClick}
          onTVShowClick={handleTVShowClick}
        />
      )}

        </>
      )}

      {updateAvailable && (
        <UpdateModal
          version={updateAvailable.version}
          downloadUrl={updateAvailable.downloadUrl}
          releaseNotes={updateAvailable.releaseNotes}
          forceUpdate={updateAvailable.forceUpdate}
          onClose={() => setUpdateAvailable(null)}
        />
      )}
    </ErrorBoundary>
    </QueryClientProvider>
  );
}
