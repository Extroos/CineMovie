import { useState, useEffect, useCallback } from 'react';
import * as tmdb from '../services/tmdb';
import { VidSrcService, VidSrcItem } from '../services/vidsrc';
import { getMyList } from '../services/myList';
import { WatchProgressService } from '../services/progress';
import { RecommendationService } from '../services/recommendations';
import { ProfileService } from '../services/profiles';
import { AnimeService, Anime } from '../services/anime';
import type { Movie, TVShow } from '../types';

interface ContentState {
  trending: Movie[];
  popular: Movie[];
  topRated: Movie[];
  upcoming: Movie[];
  action: (Movie | TVShow)[];
  comedy: (Movie | TVShow)[];
  family: (Movie | TVShow)[];
  scifi: (Movie | TVShow)[];
  horror: (Movie | TVShow)[];
  documentary: (Movie | TVShow)[];
  adventure: (Movie | TVShow)[];
  
  trendingTV: TVShow[];
  popularTV: TVShow[];
  topRatedTV: TVShow[];
  dramaTV: TVShow[];
  comedyTV: TVShow[];
  scifiTV: TVShow[];
  crimeTV: TVShow[];
  mysteryTV: TVShow[];
  documentaryTV: TVShow[];
  
  trendingAnime: Anime[];
  popularAnime: Anime[];
  latestAnime: Anime[];
  upcomingAnime: Anime[];
  
  // VidSrc content (hydrated with TMDB data)
  latestReleases: Movie[];      
  
  myList: Movie[];
  continueWatching: (Movie | TVShow)[];
  topPicks: (Movie | TVShow)[];
  
  heroMovie: Movie | null;
  heroTVShow: TVShow | null;
}

export function useContent(profileId?: string) {
  const [content, setContent] = useState<ContentState>({
    trending: [], popular: [], topRated: [], upcoming: [], action: [], comedy: [], family: [],
    scifi: [], horror: [], documentary: [], adventure: [],
    trendingTV: [], popularTV: [], topRatedTV: [], dramaTV: [], comedyTV: [],
    scifiTV: [], crimeTV: [], mysteryTV: [], documentaryTV: [],
    trendingAnime: [], popularAnime: [], latestAnime: [], upcomingAnime: [],
    latestReleases: [], 
    myList: [], continueWatching: [], topPicks: [],
    heroMovie: null, heroTVShow: null
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadContent = useCallback(async (isMounted: boolean = true) => {
    try {
      setLoading(true);
      // Wait for profile propagation if needed or just fetch
      const profile = ProfileService.getActiveProfile();
      console.log('[useContent] Loading content for profile:', profile?.name);
      
      // 1. Critical User Data (Fast)
      let myListData: Movie[] = [];
      let continueWatchingData: (Movie | TVShow)[] = [];
      
      if (profile) {
        [myListData, continueWatchingData] = await Promise.all([
          getMyList(),
          WatchProgressService.getContinueWatching()
        ]);
      }

      // 2. Home Page Content (Parallel)
      const [
        trending, popular, topRated, upcoming,
        actionData, comedyData, familyData,
        scifiData, horrorData, documentaryData, adventureData,
        trendingTV, popularTV, topRatedTV, dramaTV, comedyTV,
        scifiTV, crimeTV, mysteryTV, documentaryTV,
        trendingAnimeData, popularAnimeData, latestAnimeData, upcomingAnimeData
      ] = await Promise.all([
        tmdb.getTrending(),
        tmdb.getPopular(),
        tmdb.getTopRated(),
        tmdb.getUpcoming(),

        // Shared Genres (Movie + TV)
        Promise.all([tmdb.getMoviesByGenre(28), tmdb.getTVShowsByGenre(10759)]), // Action
        Promise.all([tmdb.getMoviesByGenre(35), tmdb.getTVShowsByGenre(35)]),    // Comedy
        Promise.all([tmdb.getMoviesByGenre(10751), tmdb.getTVShowsByGenre(10751)]), // Family
        Promise.all([tmdb.getMoviesByGenre(878), tmdb.getTVShowsByGenre(10765)]), // Sci-Fi
        Promise.all([tmdb.getMoviesByGenre(27), tmdb.getTVShowsByGenre(10765)]), // Horror (Mix with supernatural)
        Promise.all([tmdb.getMoviesByGenre(99), tmdb.getTVShowsByGenre(99)]), // Documentary
        Promise.all([tmdb.getMoviesByGenre(12), tmdb.getTVShowsByGenre(10759)]), // Adventure
        
        tmdb.getTrendingTV(),
        tmdb.getPopularTV(),
        tmdb.getTopRatedTV(),
        tmdb.getTVShowsByGenre(18),
        tmdb.getTVShowsByGenre(35),
        tmdb.getTVShowsByGenre(10765), // Sci-Fi & Fantasy
        tmdb.getTVShowsByGenre(80), // Crime
        tmdb.getTVShowsByGenre(9648), // Mystery
        tmdb.getTVShowsByGenre(99), // Documentary (TV)
        
        AnimeService.getTrending(),
        AnimeService.getPopular(),
        AnimeService.getHomeContent().then(c => c.latest),
        AnimeService.getHomeContent().then(c => c.upcoming)
      ]);

      // Manual interleaver to mix movies and tv shows "smartly"
      const interleave = (movies: Movie[], tv: TVShow[]) => {
          const result: (Movie | TVShow)[] = [];
          const max = Math.max(movies.length, tv.length);
          for (let i = 0; i < max; i++) {
              if (movies[i]) result.push({ ...movies[i], mediaType: 'movie' } as any);
              if (tv[i]) result.push({ ...tv[i], mediaType: 'tv' } as any);
          }
          return result.slice(0, 20);
      };

      const actionMix = interleave(actionData[0], actionData[1]);
      const comedyMix = interleave(comedyData[0], comedyData[1]);
      const familyMix = interleave(familyData[0], familyData[1]);
      const scifiMix = interleave(scifiData[0], scifiData[1]);
      const horrorMix = interleave(horrorData[0], horrorData[1]);
      const documentaryMix = interleave(documentaryData[0], documentaryData[1]);
      const adventureMix = interleave(adventureData[0], adventureData[1]);

      if (!isMounted) return;

      // 3. Recommendations
      let topPicks: (Movie | TVShow)[] = [];
      try {
        topPicks = await RecommendationService.getTopPicks();
      } catch (e) { console.error('Recs error', e); }

      // 4. VidSrc Content - Hydrate with TMDB
      let latestVidSrc: Movie[] = [];
      
      try {
        const vidSrcItems = await VidSrcService.getLatestMovies(1);
        const vidSrcIds = vidSrcItems
            .filter(i => i.tmdb_id)
            .map(i => i.tmdb_id)
            .slice(0, 10); // Limit to 10 for performance
            
        // Fetch details from TMDB
        const detailsPromises = vidSrcIds.map(id => tmdb.getMovieDetails(parseInt(id, 10)));
        const detailsResults = await Promise.allSettled(detailsPromises);
        
        latestVidSrc = detailsResults
            .filter((r): r is PromiseFulfilledResult<Movie | null> => r.status === 'fulfilled' && r.value !== null)
            .map(r => r.value as Movie);
            
      } catch (e) { 
        console.warn('VidSrc fetch error (non-critical):', e); 
      }

      setContent({
        trending: trending.map(m => ({ ...m, mediaType: 'movie' } as any)),
        popular: popular.map(m => ({ ...m, mediaType: 'movie' } as any)),
        topRated: topRated.map(m => ({ ...m, mediaType: 'movie' } as any)),
        upcoming: upcoming.map(m => ({ ...m, mediaType: 'movie' } as any)),
        action: actionMix,
        comedy: comedyMix,
        family: familyMix,
        scifi: scifiMix,
        horror: horrorMix,
        documentary: documentaryMix,
        adventure: adventureMix,
        trendingTV: trendingTV.map(t => ({ ...t, mediaType: 'tv' } as any)),
        popularTV: popularTV.map(t => ({ ...t, mediaType: 'tv' } as any)),
        topRatedTV: topRatedTV.map(t => ({ ...t, mediaType: 'tv' } as any)),
        dramaTV: dramaTV.map(t => ({ ...t, mediaType: 'tv' } as any)),
        comedyTV: comedyTV.map(t => ({ ...t, mediaType: 'tv' } as any)),
        scifiTV: scifiTV.map(t => ({ ...t, mediaType: 'tv' } as any)),
        crimeTV: crimeTV.map(t => ({ ...t, mediaType: 'tv' } as any)),
        mysteryTV: mysteryTV.map(t => ({ ...t, mediaType: 'tv' } as any)),
        documentaryTV: documentaryTV.map(t => ({ ...t, mediaType: 'tv' } as any)),
        trendingAnime: trendingAnimeData, 
        popularAnime: popularAnimeData,
        latestAnime: latestAnimeData,
        upcomingAnime: upcomingAnimeData,
        latestReleases: latestVidSrc, 
        myList: myListData,
        continueWatching: continueWatchingData,
        topPicks,
        heroMovie: trending[0] || null,
        heroTVShow: trendingTV[0] || null
      });

    } catch (err) {
      console.error('Content load error:', err);
      if (isMounted) setError(err as Error);
    } finally {
      if (isMounted) setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    let isMounted = true;
    loadContent(isMounted);
    return () => { isMounted = false; };
  }, [loadContent]);

  const refreshMyList = async () => {
    const list = await getMyList();
    setContent(prev => ({ ...prev, myList: list }));
  };

  const refreshContinueWatching = async () => {
     const cw = await WatchProgressService.getContinueWatching();
     setContent(prev => ({ ...prev, continueWatching: cw }));
  };

  return { 
    ...content, 
    loading, 
    error, 
    refreshMyList, 
    refreshContinueWatching,
    reloadAll: () => loadContent(true) 
  };
}
