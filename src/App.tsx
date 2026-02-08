import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
import LoadingScreen from './components/layout/LoadingScreen';
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
import { QueryClient, QueryClientProvider } from 'react-query';
import { SettingsService } from './services/settings';

const queryClient = new QueryClient();

type View = 'home' | 'movies' | 'tvshows' | 'newandhot' | 'mylist' | 'settings';

export default function App() {
  const [currentView, setCurrentView] = useState<View>('home');
  const [activeProfile, setActiveProfile] = useState<Profile | null>(ProfileService.getActiveProfile());
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showProfileSelector, setShowProfileSelector] = useState(!ProfileService.getActiveProfile());
  
  const [minimalHome, setMinimalHome] = useState(SettingsService.get('minimalHome'));

  useEffect(() => {
    // Initialize theme
    SettingsService.applyTheme(SettingsService.get('theme'));
  }, []);

  useEffect(() => {
    const handleSettingsChange = () => {
        setMinimalHome(SettingsService.get('minimalHome'));
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
    ProfileService.clearActiveProfile();
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
        ProfileService.clearActiveProfile();
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
  
  const content = useContent(activeProfile?.id);
  const { 
    trending, popular, topRated, upcoming, action, comedy, family,
    trendingTV, popularTV, topRatedTV, dramaTV, comedyTV,
    latestReleases, 
    myList, continueWatching, topPicks,
    heroMovie, heroTVShow,
    loading, error,
    refreshMyList
  } = content;

  const { activity: friendActivity } = useFriends(); 

  const groupedActivity = new Map<string, any>();
  const FIVE_MINUTES = 5 * 60 * 1000;
  const now = Date.now();
  
  friendActivity.forEach(act => {
      const key = String(act.item.id);
      const existing = groupedActivity.get(key);
      const isLive = (now - act.timestamp) < FIVE_MINUTES;
      
      const watcher = {
          friend: act.friend,
          episode: act.episode,
          season: act.season,
          progress: act.progress,
          timestamp: act.timestamp,
          isLive
      };

      if (existing) {
          existing.watchers.push(watcher);
          existing.isLive = existing.isLive || isLive;
          if (act.timestamp > existing.timestamp) {
               existing.timestamp = act.timestamp;
               existing.friendEpisode = act.episode;
               existing.watchedBy = act.friend; 
               existing.progress = act.progress;
          }
      } else {
          groupedActivity.set(key, {
              ...act.item,
              watchers: [watcher],
              watchedBy: act.friend,
              friendEpisode: act.episode, 
              timestamp: act.timestamp,
              isLive,
              progress: act.progress
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
    triggerHaptic('medium');
    ProfileService.setActiveProfile(profile.id, profile);
    setActiveProfile(profile);
    setShowProfileSelector(false);
    setCurrentView('home');
    content.reloadAll();
  };

  useEffect(() => {
    const handleMovieClickEvent = (e: any) => handleMovieClick(e.detail);
    const handleTVShowClickEvent = (e: any) => handleTVShowClick(e.detail);
    const handleProfileChange = () => {
      setActiveProfile(ProfileService.getActiveProfile());
      content.reloadAll();
    };
    
    window.addEventListener('movieClick', handleMovieClickEvent);
    window.addEventListener('tvShowClick', handleTVShowClickEvent);
    window.addEventListener('profileChanged', handleProfileChange);
    
    const setupNativeEvents = async () => {
      try {
        const { App: CapApp } = await import('@capacitor/app');
        
        // Handle App state changes (returning from background ads)
        await CapApp.addListener('appStateChange', ({ isActive }) => {
          if (isActive) {
            console.log('App became active - ensuring state consistency');
            // If we are in the video player, we might want to ensure immersive mode is still on
            const videoOverlay = document.querySelector('.video-player-overlay');
            if (videoOverlay) {
                // Logic to re-trigger immersion if needed can go here
            }
          }
        });

        let lastBackPress = 0;
        
        const listener = await CapApp.addListener('backButton', ({ canGoBack }) => {
          // Priority 0: Video Player (highest)
          if (document.querySelector('.video-player-overlay')) return;

          // Priority 1: Overlays & Modals
          if (selectedMovie) { setSelectedMovie(null); return; }
          if (selectedTVShow) { setSelectedTVShow(null); return; }
          if (selectedActor) { setSelectedActor(null); return; }
          if (searchOpen) { setSearchOpen(false); return; }
          if (searchResultsOpen) { setSearchResultsOpen(false); return; }

          // Priority 2: Views
          if (showProfileSelector && activeProfile) {
            setShowProfileSelector(false);
            return;
          }

          if (currentView !== 'home') {
            setCurrentView('home');
            return;
          }

          // Priority 3: App Exit
          const now = Date.now();
          if (now - lastBackPress < 2000) {
            CapApp.exitApp();
          } else {
            lastBackPress = now;
          }
        });
        
        return () => listener.remove();
      } catch (e) {
        console.warn('Capacitor App plugin not available', e);
      }
    };

    const nativeCleanupPromise = setupNativeEvents();
    
    return () => {
      window.removeEventListener('movieClick', handleMovieClickEvent);
      window.removeEventListener('tvShowClick', handleTVShowClickEvent);
      window.removeEventListener('profileChanged', handleProfileChange);
      nativeCleanupPromise.then(cleanup => cleanup?.());
    };
  }, [selectedMovie, selectedTVShow, selectedActor, searchOpen, searchResultsOpen, currentView, showProfileSelector, activeProfile, content]);

  const handleRemoveFromList = async (itemId: number, type: 'movie' | 'tv') => {
    await removeFromMyList(itemId, type);
    content.refreshMyList();
  };

  const handleMovieClick = (movie: Movie) => {
    if ((movie as any).mediaType === 'tv') {
        handleTVShowClick(movie as any);
        return;
    }
    setSelectedMovie(movie);
    // REMOVED: setSearchResultsOpen(false) - Preserve context for back navigation
  };

  const handleTVShowClick = (show: TVShow) => {
    setSelectedTVShow(show);
    // REMOVED: setSearchResultsOpen(false) - Preserve context for back navigation
  };

  const handleShowSearchResults = (query: string, results: Movie[]) => {
    setSearchQuery(query);
    setSearchResults(results);
    setSearchOpen(false);
    setSearchResultsOpen(true);
  };

  const handleNavClick = (view: View) => {
    triggerHaptic('light');
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
        <AnimatePresence mode="wait">
          {isLoading ? (
            <LoadingScreen key="loading" />
          ) : !isAuthenticated ? (
            <LoginPage key="login" onLogin={handleLogin} />
          ) : (
            <motion.div
              key="main-content"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ 
                duration: 0.5, 
                ease: [0.16, 1, 0.3, 1] // Snappy "out-expo" for better mobile movement
              }}
              style={{ width: '100%', height: '100%' }}
            >
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
                  background: #0a0a0a;
                  scroll-behavior: smooth;
                  height: 100%;
                  width: 100%;
                  position: fixed; 
                  left: 0;
                  top: 0;
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
                  overflow: hidden; /* App-wide overflow managed by views */
                }
                #root {
                  height: 100%;
                  width: 100%;
                  overflow-y: auto;
                  -webkit-overflow-scrolling: touch;
                  touch-action: pan-y;
                }
                img {
                  pointer-events: none;
                  -webkit-user-drag: none;
                  user-select: none;
                  -webkit-user-select: none;
                }
                ::-webkit-scrollbar { display: none; }
                * { -ms-overflow-style: none; scrollbar-width: none; }
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                .active-press:active { opacity: 0.7; transform: scale(0.98); }
                .content-row-scroll { 
                  touch-action: pan-x pan-y; 
                  overscroll-behavior-x: contain; 
                  will-change: transform;
                  -webkit-overflow-scrolling: touch;
                }
                .profile-item, .profile-avatar, .add-profile-btn, .manage-btn, 
                .movie-card, .search-overlay, .details-container { 
                  will-change: transform, opacity;
                  -webkit-transform: translateZ(0); /* Force GPU acceleration */
                }
                @keyframes shimmer {
                  from { background-position: 200% 0; }
                  to { background-position: -200% 0; }
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
                  <Header onSearchOpen={() => setSearchOpen(true)} activeProfile={activeProfile} onSwitchProfile={() => setShowProfileSelector(true)} />
                  <div style={{ paddingTop: 0 }}>
                    {loading ? (
                        <div style={{ paddingTop: '64px' }}>
                          <HeroSkeleton />
                          <ContentRowSkeleton />
                          <ContentRowSkeleton />
                        </div>
                    ) : (
                        <>
                          <Hero movie={heroMovie} onPlayClick={() => setSelectedMovie(heroMovie)} onInfoClick={() => setSelectedMovie(heroMovie)} />
                          <div style={{ 
                            position: 'relative', 
                            marginTop: '-4rem', 
                            zIndex: 10, 
                            background: 'linear-gradient(to bottom, transparent 0%, #0a0a0a 10%)', 
                            paddingTop: '2rem',
                            overflowX: 'hidden' // Strictly contain rows from pushing viewport width
                          }}>
                            {(friendActivityItems.length > 0 || continueWatching.length > 0) && (
                              <ContentRow 
                                title={friendActivityItems.length > 0 ? "What We're Watching" : "Continue Watching"} 
                                movies={[...friendActivityItems, ...continueWatching].filter((v,i,a)=>a.findIndex(t=>(String(t.id) === String(v.id)))===i)} 
                                onMovieClick={(item: any) => {
                                  if (item.firstAirDate || item.name) { handleTVShowClick(item); } else { handleMovieClick(item); }
                                }} 
                              />
                            )}
                            {!minimalHome && (
                            <>
                            {trendingTV.length > 0 && ( <ContentRow title="Trending TV Shows" movies={trendingTV} onMovieClick={(show: any) => handleTVShowClick(show)} /> )}
                            {popular.length > 0 && ( <ContentRow title="Popular Movies" movies={popular} onMovieClick={handleMovieClick} /> )}
                            {topRated.length > 0 && ( <ContentRow title="Critically Acclaimed" movies={topRated} onMovieClick={handleMovieClick} /> )}
                            {action.length > 0 && ( <ContentRow title="Trending Action" movies={action} onMovieClick={handleMovieClick} /> )}
                            {comedy.length > 0 && ( <ContentRow title="Top Comedies" movies={comedy} onMovieClick={handleMovieClick} /> )}
                            {family.length > 0 && ( <ContentRow title="Trending Family" movies={family} onMovieClick={handleMovieClick} /> )}
                            {topPicks.length > 0 && ( <ContentRow title="Top Picks for You" movies={topPicks} onMovieClick={(item: any) => { if (item.firstAirDate || item.name) { handleTVShowClick(item); } else { handleMovieClick(item); } }} /> )}
                            {latestReleases.length > 0 && ( <ContentRow title="🎬 Already on VidSrc" movies={latestReleases} onMovieClick={handleMovieClick} /> )}
                            {upcoming.length > 0 && filterKids(upcoming).length > 0 && ( <ContentRow title="Upcoming Releases" movies={filterKids(upcoming)} onMovieClick={handleMovieClick} /> )}
                            </>
                            )}
                          </div>
                        </>
                    )}
                  </div>
                </div>
              )}

              {currentView === 'movies' && (
                <div style={{ minHeight: '100vh', background: COLORS.bgPrimary, paddingBottom: 'calc(100px + env(safe-area-inset-bottom, 0px))' }}>
                  <Header onSearchOpen={() => setSearchOpen(true)} activeProfile={activeProfile} onSwitchProfile={() => setShowProfileSelector(true)} />
                  <div style={{ paddingTop: 0 }}>
                    <Hero movie={heroMovie} onPlayClick={() => setSelectedMovie(heroMovie)} onInfoClick={() => setSelectedMovie(heroMovie)} onSurpriseMe={handleSurpriseMe} />
                    <div style={{ position: 'relative', marginTop: '-4rem', zIndex: 10, background: 'linear-gradient(to bottom, transparent 0%, #0a0a0a 10%)', paddingTop: '2rem' }}>
                      {trending.length > 0 && ( <ContentRow title="Trending Now" movies={trending} onMovieClick={handleMovieClick} /> )}
                      {popular.length > 0 && ( <ContentRow title="Popular Movies" movies={popular} onMovieClick={handleMovieClick} /> )}
                      {topRated.length > 0 && ( <ContentRow title="Top Rated Movies" movies={topRated} onMovieClick={handleMovieClick} /> )}
                      {action.length > 0 && ( <ContentRow title="Trending Action" movies={action} onMovieClick={handleMovieClick} /> )}
                      {comedy.length > 0 && ( <ContentRow title="Top Comedies" movies={comedy} onMovieClick={handleMovieClick} /> )}
                      {family.length > 0 && ( <ContentRow title="Family Hits" movies={family} onMovieClick={handleMovieClick} /> )}
                      {upcoming.length > 0 && ( <ContentRow title="Upcoming Movies" movies={upcoming} onMovieClick={handleMovieClick} /> )}
                    </div>
                  </div>
                </div>
              )}

              {currentView === 'tvshows' && heroTVShow && (
                <div style={{ minHeight: '100vh', background: COLORS.bgPrimary, paddingBottom: 'calc(100px + env(safe-area-inset-bottom, 0px))' }}>
                  <Header onSearchOpen={() => setSearchOpen(true)} activeProfile={activeProfile} onSwitchProfile={() => setShowProfileSelector(true)} />
                  <div style={{ paddingTop: 0 }}>
                    <Hero movie={heroTVShow as any} onPlayClick={() => setSelectedTVShow(heroTVShow)} onInfoClick={() => setSelectedTVShow(heroTVShow)} />
                    <div style={{ position: 'relative', marginTop: '-4rem', zIndex: 10, background: 'linear-gradient(to bottom, transparent 0%, #0a0a0a 10%)', paddingTop: '2rem' }}>
                      {(trendingTV.length > 0) && ( <ContentRow title="Trending Series" movies={trendingTV as any} onMovieClick={(show: any) => handleTVShowClick(show)} /> )}
                      {popularTV.length > 0 && ( <ContentRow title="Most Popular" movies={popularTV} onMovieClick={(show: any) => handleTVShowClick(show)} /> )}
                      {topRatedTV.length > 0 && ( <ContentRow title="Top Rated" movies={topRatedTV} onMovieClick={(show: any) => handleTVShowClick(show)} /> )}
                      {dramaTV.length > 0 && ( <ContentRow title="Trending Drama" movies={dramaTV as any} onMovieClick={(show: any) => handleTVShowClick(show)} /> )}
                      {comedyTV.length > 0 && ( <ContentRow title="Comedy Favorites" movies={comedyTV as any} onMovieClick={(show: any) => handleTVShowClick(show)} /> )}
                    </div>
                  </div>
                </div>
              )}

              {currentView === 'mylist' && (
                <MyListPage movies={myList} onMovieClick={handleMovieClick} onRemove={handleRemoveFromList} />
              )}

              {currentView === 'newandhot' && (
                <BrowseNewsPage trending={trending} upcoming={upcoming} onItemClick={(item: any) => { if (item.firstAirDate) { handleTVShowClick(item); } else { handleMovieClick(item); } }} />
              )}

              {currentView === 'settings' && (
                <SettingsPage onNavigate={setCurrentView} heroBackground={heroMovie} activeProfile={activeProfile} onSwitchProfile={() => setShowProfileSelector(true)} onLogout={handleLogout} onUpdateFound={(info) => setUpdateAvailable(info)} />
              )}

              <BottomNav currentView={currentView} onNavClick={handleNavClick} />

              {searchOpen && ( <SearchOverlay onClose={() => setSearchOpen(false)} onMovieClick={handleMovieClick} onShowResults={handleShowSearchResults} /> )}
              {searchResultsOpen && ( <SearchResults query={searchQuery} results={searchResults} loading={searchLoading} onMovieClick={handleMovieClick} onClose={() => setSearchResultsOpen(false)} /> )}
              {selectedMovie && ( <MovieDetails movie={selectedMovie} onClose={() => { setSelectedMovie(null); content.refreshContinueWatching(); }} onListUpdate={content.refreshMyList} onActorClick={(id) => setSelectedActor(id)} /> )}
              {selectedTVShow && ( <TVShowDetails show={selectedTVShow} onClose={() => { setSelectedTVShow(null); content.refreshContinueWatching(); }} onActorClick={(id) => setSelectedActor(id)} /> )}
              {selectedActor && ( <ActorPage personId={selectedActor} onClose={() => setSelectedActor(null)} onMovieClick={handleMovieClick} onTVShowClick={handleTVShowClick} /> )}
            </motion.div>
          )}
        </AnimatePresence>

        {updateAvailable && (
          <UpdateModal version={updateAvailable.version} downloadUrl={updateAvailable.downloadUrl} releaseNotes={updateAvailable.releaseNotes} forceUpdate={updateAvailable.forceUpdate} onClose={() => setUpdateAvailable(null)} />
        )}
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
