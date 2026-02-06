import type { Movie, Genre, Video, MovieCategory, SearchResult, TVShow, Season, Episode } from '../types';
import { TMDB_BASE_URL, TMDB_IMAGE_BASE_URL, IMAGE_SIZES } from '../constants';
import { CacheService, DEFAULT_TTL, LONG_TTL } from './cache';

const API_KEY = '8265bd1679663a7ea12ac168da84d2e8'; // Using reliable demo key
const BASE_URL = 'https://api.themoviedb.org/3';

// Retry configuration
const MAX_RETRIES = 3;
const INITIAL_BACKOFF = 300; // ms

// Request deduplication & SWR tracking
const pendingRequests = new Map<string, Promise<any>>();
const activeSubscriptions = new Map<string, Set<(data: any) => void>>();

async function fetchWithRetry(url: string, retries = MAX_RETRIES, backoff = INITIAL_BACKOFF): Promise<Response> {
  try {
    const response = await fetch(url);
    
    // Retry on 5xx server errors or 429 rate limits
    if (!response.ok && (response.status >= 500 || response.status === 429)) {
       throw new Error(`Server error: ${response.status}`);
    }
    
    return response;
  } catch (error) {
    if (retries > 0) {
      console.warn(`Fetch failed, retrying in ${backoff}ms... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, backoff));
      return fetchWithRetry(url, retries - 1, backoff * 2);
    }
    throw error;
  }
}

/**
 * Wrapper for fetching data with SWR (Stale-While-Revalidate) and De-duplication.
 */
async function fetchFromApi<T>(path: string, params: Record<string, string | number> = {}, ttl: number = DEFAULT_TTL): Promise<T> {
  const urlObj = new URL(`${BASE_URL}${path}`);
  urlObj.searchParams.append('api_key', API_KEY);
  Object.entries(params).forEach(([key, value]) => urlObj.searchParams.append(key, String(value)));
  const fullUrl = urlObj.toString();
  const cacheKey = CacheService.generateKey(path, params);

  // 1. DEDUPLICATION: If a request for this key is already in flight, return it
  if (pendingRequests.has(cacheKey)) {
    return pendingRequests.get(cacheKey);
  }

  // 2. SWR: Try cache first
  const cacheResult = CacheService.get<T>(cacheKey);
  
  const performFetch = async (): Promise<T> => {
    try {
      const response = await fetchWithRetry(fullUrl);
      
      // Handle 404 gracefully (content missing/deleted)
      if (response.status === 404) {
        return null as any; 
      }
      
      if (!response.ok) throw new Error(`TMDB error: ${response.status}`);
      const data = await response.json();
      CacheService.set(cacheKey, data, ttl);
      
      // Notify any subscribers (future extensibility)
      if (activeSubscriptions.has(cacheKey)) {
        activeSubscriptions.get(cacheKey)?.forEach(cb => cb(data));
      }

      return data;
    } finally {
      pendingRequests.delete(cacheKey);
    }
  };

  if (cacheResult) {
    // If not stale, return cache data immediately
    if (!cacheResult.isStale) {
      return (cacheResult as any).data;
    }

    // IF STALE: Return cache data immediately but refetch in background (Proactive Revalidation)
    // We don't wait for this fetch to return to the user
    const backgroundFetch = performFetch().catch(e => console.warn('Silent SWR revalidation failed', e));
    pendingRequests.set(cacheKey, backgroundFetch); 
    
    return (cacheResult as any).data; 
  }

  // 3. COLD START: No cache, must fetch
  const fetchPromise = performFetch();
  pendingRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
}

function buildUrl(path: string, params: Record<string, string | number> = {}) {
  // Keeps existing helper if needed, but fetchFromApi handles generic calls now
  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.append('api_key', API_KEY);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, String(value));
  });
  return url.toString();
}

function transformMovie(data: any): Movie {
  return {
    id: data.id,
    title: data.title,
    overview: data.overview || 'No overview available.',
    posterPath: data.poster_path,
    backdropPath: data.backdrop_path,
    releaseDate: data.release_date || '2024-01-01',
    voteAverage: data.vote_average || 0,
    voteCount: data.vote_count || 0,
    genres: data.genre_ids?.map((id: number) => ({ id, name: getGenreName(id) })) || data.genres || [],
    runtime: data.runtime,
    tagline: data.tagline,
  };
}

function transformTVShow(data: any): TVShow {
  return {
    id: data.id,
    name: data.name,
    overview: data.overview || 'No overview available.',
    posterPath: data.poster_path,
    backdropPath: data.backdrop_path,
    firstAirDate: data.first_air_date || '2024-01-01',
    voteAverage: data.vote_average || 0,
    voteCount: data.vote_count || 0,
    genres: data.genre_ids?.map((id: number) => ({ id, name: getTVGenreName(id) })) || data.genres || [],
    numberOfSeasons: data.number_of_seasons,
    numberOfEpisodes: data.number_of_episodes,
    status: data.status,
    tagline: data.tagline,
    episodeRunTime: data.episode_run_time,
    originCountry: data.origin_country, // Map origin_country
  };
}

const genreMap: Record<number, string> = {
  28: 'Action', 12: 'Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
  99: 'Documentary', 18: 'Drama', 10751: 'Family', 14: 'Fantasy', 36: 'History',
  27: 'Horror', 10402: 'Music', 9648: 'Mystery', 10749: 'Romance', 878: 'Science Fiction',
  10770: 'TV Movie', 53: 'Thriller', 10752: 'War', 37: 'Western',
};

const tvGenreMap: Record<number, string> = {
  10759: 'Action & Adventure', 16: 'Animation', 35: 'Comedy', 80: 'Crime',
  99: 'Documentary', 18: 'Drama', 10751: 'Family', 10762: 'Kids',
  9648: 'Mystery', 10763: 'News', 10764: 'Reality', 10765: 'Sci-Fi & Fantasy',
  10766: 'Soap', 10767: 'Talk', 10768: 'War & Politics', 37: 'Western',
};

function getGenreName(id: number): string {
  return genreMap[id] || 'Unknown';
}

function getTVGenreName(id: number): string {
  return tvGenreMap[id] || genreMap[id] || 'Unknown';
}

// ===== MOVIE ENDPOINTS =====

export async function getTrending(timeWindow: 'day' | 'week' = 'week'): Promise<Movie[]> {
  try {
    const data: any = await fetchFromApi(`/trending/movie/${timeWindow}`);
    return data.results.slice(0, 20).map(transformMovie);
  } catch (error) {
    console.error('Error fetching trending movies:', error);
    return [];
  }
}

export async function getPopular(): Promise<Movie[]> {
  try {
    const data: any = await fetchFromApi('/movie/popular');
    return data.results.slice(0, 20).map(transformMovie);
  } catch (error) {
    console.error('Error fetching popular movies:', error);
    return [];
  }
}

export async function getTopRated(): Promise<Movie[]> {
  try {
    const data: any = await fetchFromApi('/movie/top_rated');
    return data.results.slice(0, 20).map(transformMovie);
  } catch (error) {
    console.error('Error fetching top rated movies:', error);
    return [];
  }
}

export async function getUpcoming(): Promise<Movie[]> {
  try {
    const data: any = await fetchFromApi('/movie/upcoming');
    return data.results.slice(0, 20).map(transformMovie);
  } catch (error) {
    console.error('Error fetching upcoming movies:', error);
    return [];
  }
}

export async function getMoviesByGenre(genreId: number): Promise<Movie[]> {
  try {
    const data: any = await fetchFromApi('/discover/movie', {
      with_genres: genreId,
      sort_by: 'popularity.desc',
    });
    return data.results.slice(0, 20).map(transformMovie);
  } catch (error) {
    console.error('Error fetching movies by genre:', error);
    return [];
  }
}

export async function searchMovies(query: string): Promise<Movie[]> {
  try {
    if (!query.trim()) return [];
    const data: any = await fetchFromApi('/search/movie', { query });
    return data.results.slice(0, 20).map(transformMovie);
  } catch (error) {
    console.error('Error searching movies:', error);
    return [];
  }
}

export async function getMovieDetails(movieId: number | string): Promise<Movie | null> {
  // Gracefully handle Anime IDs (strings) passed to TMDB service
  if (!movieId || typeof movieId === 'string') return null;

  try {
    const data: any = await fetchFromApi(`/movie/${movieId}`, {}, LONG_TTL/2);
    if (!data || !data.id) return null;
    return transformMovie(data);
  } catch (error) {
    console.error('Error fetching movie details:', error);
    return null;
  }
}

export async function getMovieVideos(movieId: number): Promise<Video[]> {
  try {
    const data: any = await fetchFromApi(`/movie/${movieId}/videos`);
    return data.results.map((video: any) => ({
      id: video.id,
      key: video.key,
      name: video.name,
      site: video.site,
      type: video.type,
      official: video.official,
    }));
  } catch (error) {
    console.error('Error fetching movie videos:', error);
    return [];
  }
}

export async function getSimilarMovies(movieId: number): Promise<Movie[]> {
  try {
    const data: any = await fetchFromApi(`/movie/${movieId}/similar`);
    return data.results.slice(0, 10).map(transformMovie);
  } catch (error) {
    console.error('Error fetching similar movies:', error);
    return [];
  }
}

export async function getMovieCredits(movieId: number): Promise<{ cast: any[], crew: any[] }> {
  try {
    const data: any = await fetchFromApi(`/movie/${movieId}/credits`);
    
    return {
      cast: data.cast.slice(0, 10).map((person: any) => ({
        id: person.id,
        name: person.name,
        character: person.character,
        profilePath: person.profile_path,
        order: person.order,
      })),
      crew: data.crew
        .filter((person: any) => person.job === 'Director' || person.department === 'Writing')
        .slice(0, 5)
        .map((person: any) => ({
          id: person.id,
          name: person.name,
          job: person.job,
          department: person.department,
          profilePath: person.profile_path,
        })),
    };
  } catch (error) {
    console.error('Error fetching movie credits:', error);
    return { cast: [], crew: [] };
  }
}

// ===== TV SHOW ENDPOINTS =====

export async function getTrendingTV(timeWindow: 'day' | 'week' = 'week'): Promise<TVShow[]> {
  try {
    const data: any = await fetchFromApi(`/trending/tv/${timeWindow}`);
    return data.results.slice(0, 20).map(transformTVShow);
  } catch (error) {
    console.error('Error fetching trending TV shows:', error);
    return [];
  }
}

export async function getPopularTV(): Promise<TVShow[]> {
  try {
    const data: any = await fetchFromApi('/tv/popular');
    return data.results.slice(0, 20).map(transformTVShow);
  } catch (error) {
    console.error('Error fetching popular TV shows:', error);
    return [];
  }
}

export async function getTopRatedTV(): Promise<TVShow[]> {
  try {
    const data: any = await fetchFromApi('/tv/top_rated');
    return data.results.slice(0, 20).map(transformTVShow);
  } catch (error) {
    console.error('Error fetching top rated TV shows:', error);
    return [];
  }
}

export async function getOnTheAirTV(): Promise<TVShow[]> {
  try {
    const data: any = await fetchFromApi('/tv/on_the_air');
    return data.results.slice(0, 20).map(transformTVShow);
  } catch (error) {
    console.error('Error fetching on the air TV shows:', error);
    return [];
  }
}

export async function getTVShowDetails(tvId: number | string): Promise<TVShow | null> {
  // If it's a string (Anime ID) or invalid, return null to avoid TMDB 404s
  if (!tvId || typeof tvId === 'string') return null;

  try {
    const data: any = await fetchFromApi(`/tv/${tvId}`, {}, LONG_TTL/2);
    if (!data || !data.id) return null;
    return transformTVShow(data);
  } catch (error) {
    console.error('Error fetching TV show details:', error);
    return null;
  }
}

export async function getTVShowVideos(tvId: number): Promise<Video[]> {
  try {
    const data: any = await fetchFromApi(`/tv/${tvId}/videos`);
    return data.results.map((video: any) => ({
      id: video.id,
      key: video.key,
      name: video.name,
      site: video.site,
      type: video.type,
      official: video.official,
    }));
  } catch (error) {
    console.error('Error fetching TV show videos:', error);
    return [];
  }
}

export async function getSimilarTVShows(tvId: number): Promise<TVShow[]> {
  try {
    const data: any = await fetchFromApi(`/tv/${tvId}/similar`);
    return data.results.slice(0, 10).map(transformTVShow);
  } catch (error) {
    console.error('Error fetching similar TV shows:', error);
    return [];
  }
}

export async function getTVShowCredits(tvId: number): Promise<{ cast: any[], crew: any[] }> {
  try {
    const data: any = await fetchFromApi(`/tv/${tvId}/credits`);
    
    return {
      cast: data.cast.slice(0, 10).map((person: any) => ({
        id: person.id,
        name: person.name,
        character: person.character,
        profilePath: person.profile_path,
        order: person.order,
      })),
      crew: data.crew
        .filter((person: any) => person.job === 'Executive Producer' || person.job === 'Creator')
        .slice(0, 5)
        .map((person: any) => ({
          id: person.id,
          name: person.name,
          job: person.job,
          department: person.department,
          profilePath: person.profile_path,
        })),
    };
  } catch (error) {
    console.error('Error fetching TV show credits:', error);
    return { cast: [], crew: [] };
  }
}

export async function searchTVShows(query: string): Promise<TVShow[]> {
  try {
    if (!query.trim()) return [];
    const data: any = await fetchFromApi('/search/tv', { query });
    return data.results.slice(0, 20).map(transformTVShow);
  } catch (error) {
    console.error('Error searching TV shows:', error);
    return [];
  }
}

export async function getTVShowsByGenre(genreId: number): Promise<TVShow[]> {
  try {
    const data: any = await fetchFromApi('/discover/tv', {
      with_genres: genreId,
      sort_by: 'popularity.desc',
    });
    return data.results.slice(0, 20).map(transformTVShow);
  } catch (error) {
    console.error('Error fetching TV shows by genre:', error);
    return [];
  }
}

// ===== PERSON ENDPOINTS =====

export async function getPersonDetails(personId: number): Promise<any> {
  try {
    return await fetchFromApi(`/person/${personId}`, {}, LONG_TTL);
  } catch (error) {
    console.error('Error fetching person details:', error);
    return null;
  }
}

export async function getPersonCombinedCredits(personId: number): Promise<any> {
  try {
    const data: any = await fetchFromApi(`/person/${personId}/combined_credits`, {}, LONG_TTL/2);
    
    // Sort by popularity and filter out items with no poster
    const cast = (data.cast || [])
      .filter((item: any) => item.poster_path)
      .sort((a: any, b: any) => b.popularity - a.popularity)
      .map((item: any) => {
        if (item.media_type === 'movie') return transformMovie(item);
        return transformTVShow(item);
      });

    return cast;
  } catch (error) {
    console.error('Error fetching person credits:', error);
    return [];
  }
}


export async function getTVShowSeason(tvId: number, seasonNumber: number): Promise<any> {
  try {
    const data: any = await fetchFromApi(`/tv/${tvId}/season/${seasonNumber}`, {}, LONG_TTL);
    
    // Transform episodes to match our Episode interface
    if (data.episodes) {
      data.episodes = data.episodes.map((ep: any) => ({
        id: ep.id,
        name: ep.name,
        overview: ep.overview,
        voteAverage: ep.vote_average,
        voteCount: ep.vote_count,
        airDate: ep.air_date,
        episodeNumber: ep.episode_number,
        seasonNumber: ep.season_number,
        stillPath: ep.still_path, // Map snake_case to camelCase
        runtime: ep.runtime,
        crew: ep.crew,
        guestStars: ep.guest_stars,
      }));
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching TV show season:', error);
    return null;
  }
}

// ===== HELPER FUNCTIONS =====

export function getPosterUrl(path: string | null, size: 'small' | 'medium' | 'large' | 'original' = 'medium'): string {
  if (!path) return '/movie-placeholder.png';
  if (path.startsWith('http')) return path; // Handle full URLs (e.g., from AniList)
  return `${TMDB_IMAGE_BASE_URL}/${IMAGE_SIZES.poster[size]}${path}`;
}

export function getBackdropUrl(path: string | null, size: 'small' | 'medium' | 'large' | 'original' = 'large'): string {
  if (!path) return '/backdrop-placeholder.png';
  if (path.startsWith('http')) return path; // Handle full URLs (e.g., from AniList)
  return `${TMDB_IMAGE_BASE_URL}/${IMAGE_SIZES.backdrop[size]}${path}`;
}

export function getProfileUrl(path: string | null): string {
  if (!path) return '';
  if (path.startsWith('http')) return path; // Handle full URLs
  return `${TMDB_IMAGE_BASE_URL}/w185${path}`;
}

export function getStillUrl(path: string | null): string {
  if (!path) return ''; 
  if (path.startsWith('http')) return path;
  return `${TMDB_IMAGE_BASE_URL}/w300${path}`;
}

/**
 * Proactively load images into browser cache
 */
export function prewarmImages(urls: string[]) {
  if (typeof window === 'undefined') return;
  urls.forEach(url => {
    if (!url) return;
    const img = new Image();
    img.src = url;
  });
}
