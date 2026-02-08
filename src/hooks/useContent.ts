import { useState, useEffect, useCallback } from 'react';
import * as tmdb from '../services/tmdb';
import { VidSrcService } from '../services/vidsrc';
import { getMyList } from '../services/myList';
import { WatchProgressService } from '../services/progress';
import { RecommendationService } from '../services/recommendations';
import { ProfileService } from '../services/profiles';
import type { Movie, TVShow } from '../types';
import { withRetry, getSettledValue } from '../utils/resilience';

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
  
  // VidSrc content (hydrated with TMDB data)
  latestReleases: Movie[];      
  
  myList: (Movie | TVShow)[];
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
    latestReleases: [], 
    myList: [], continueWatching: [], topPicks: [],
    heroMovie: null, heroTVShow: null
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadContent = useCallback(async (isMounted: boolean = true) => {
    try {
      setLoading(true);
      const profile = ProfileService.getActiveProfile();
      console.log('[useContent] Loading content for profile:', profile?.name);
      
      let myListData: (Movie | TVShow)[] = [];
      let continueWatchingData: (Movie | TVShow)[] = [];
      
      if (profile) {
        [myListData, continueWatchingData] = await Promise.all([
          withRetry(() => getMyList()),
          withRetry(() => WatchProgressService.getContinueWatching())
        ]);
      }

      const results = await Promise.allSettled([
        withRetry(() => tmdb.getTrending()),
        withRetry(() => tmdb.getPopular()),
        withRetry(() => tmdb.getTopRated()),
        withRetry(() => tmdb.getUpcoming()),

        // Shared Genres (Movie + TV) - Smart Trending
        Promise.allSettled([
          withRetry(() => tmdb.getTrendingByGenre(28, 'movie')), 
          withRetry(() => tmdb.getTrendingByGenre(10759, 'tv'))
        ]), // Action
        
        Promise.allSettled([
          withRetry(() => tmdb.getTrendingByGenre(35, 'movie')), 
          withRetry(() => tmdb.getTrendingByGenre(35, 'tv'))
        ]), // Comedy
        
        Promise.allSettled([
          withRetry(() => tmdb.getTrendingByGenre(10751, 'movie')), 
          withRetry(() => tmdb.getTrendingByGenre(10751, 'tv'))
        ]), // Family
        
        Promise.allSettled([
          withRetry(() => tmdb.getTrendingByGenre(878, 'movie')), 
          withRetry(() => tmdb.getTrendingByGenre(10765, 'tv'))
        ]), // Sci-Fi
        
        Promise.allSettled([
          withRetry(() => tmdb.getTrendingByGenre(27, 'movie')), 
          withRetry(() => tmdb.getTrendingByGenre(10765, 'tv'))
        ]), // Horror
        
        Promise.allSettled([
          withRetry(() => tmdb.getTrendingByGenre(99, 'movie')), 
          withRetry(() => tmdb.getTrendingByGenre(99, 'tv'))
        ]), // Documentary
        
        Promise.allSettled([
          withRetry(() => tmdb.getTrendingByGenre(12, 'movie')), 
          withRetry(() => tmdb.getTrendingByGenre(10759, 'tv'))
        ]), // Adventure
        
        withRetry(() => tmdb.getTrendingTV()),
        withRetry(() => tmdb.getPopularTV()),
        withRetry(() => tmdb.getTopRatedTV()),
        withRetry(() => tmdb.getTrendingByGenre(18, 'tv')), // Drama
        withRetry(() => tmdb.getTrendingByGenre(35, 'tv')), // Comedy
        withRetry(() => tmdb.getTrendingByGenre(10765, 'tv')), // SciFi
        withRetry(() => tmdb.getTrendingByGenre(80, 'tv')), // Crime
        withRetry(() => tmdb.getTrendingByGenre(9648, 'tv')), // Mystery
        withRetry(() => tmdb.getTrendingByGenre(99, 'tv')), // Documentary
      ]);

      const interleaveSet = (settledResult: PromiseSettledResult<[PromiseSettledResult<Movie[]>, PromiseSettledResult<TVShow[]>]>) => {
        if (settledResult.status === 'rejected') return [];
        const [movies, tv] = settledResult.value;
        return interleave(
          getSettledValue(movies, []),
          getSettledValue(tv, [])
        );
      };

      const interleave = (movies: Movie[], tv: TVShow[]) => {
          const result: (Movie | TVShow)[] = [];
          const max = Math.max(movies.length, tv.length);
          for (let i = 0; i < max; i++) {
              if (movies[i]) result.push({ ...movies[i], mediaType: 'movie' } as any);
              if (tv[i]) result.push({ ...tv[i], mediaType: 'tv' } as any);
          }
          return result.slice(0, 20);
      };

      const trending = getSettledValue(results[0], []);
      const popular = getSettledValue(results[1], []);
      const topRated = getSettledValue(results[2], []);
      const upcoming = getSettledValue(results[3], []);

      const actionMix = interleaveSet(results[4] as any);
      const comedyMix = interleaveSet(results[5] as any);
      const familyMix = interleaveSet(results[6] as any);
      const scifiMix = interleaveSet(results[7] as any);
      const horrorMix = interleaveSet(results[8] as any);
      const documentaryMix = interleaveSet(results[9] as any);
      const adventureMix = interleaveSet(results[10] as any);

      const trendingTV = getSettledValue(results[11], []);
      const popularTV = getSettledValue(results[12], []);
      const topRatedTV = getSettledValue(results[13], []);
      const dramaTV = getSettledValue(results[14], []);
      const comedyTV = getSettledValue(results[15], []);
      const scifiTV = getSettledValue(results[16], []);
      const crimeTV = getSettledValue(results[17], []);
      const mysteryTV = getSettledValue(results[18], []);
      const documentaryTV = getSettledValue(results[19], []);

      if (!isMounted) return;

      let topPicks: (Movie | TVShow)[] = [];
      try {
        topPicks = await RecommendationService.getTopPicks();
      } catch (e) { console.error('Recs error', e); }

      let latestVidSrc: Movie[] = [];
      try {
        const vidSrcItems = await VidSrcService.getLatestMovies(1);
        const vidSrcIds = vidSrcItems
            .filter(i => i.tmdb_id)
            .map(i => i.tmdb_id)
            .slice(0, 10);
            
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
