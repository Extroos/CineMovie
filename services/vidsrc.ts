/**
 * VidSrc.icu Integration
 * Provides access to streaming embed URLs and content lists
 */

const BASE_URL = '/vidsrc'; // Proxy to https://vidsrc.icu

export interface VidSrcItem {
  imdb_id?: string;
  tmdb_id: string;
  title: string;
  embed_url?: string;
  embed_url_tmdb?: string;
  quality?: string;
  type?: 'movie' | 'tv';
}

export const VidSrcService = {
  // Get latest movies
  async getLatestMovies(page: number = 1): Promise<VidSrcItem[]> {
    try {
      const response = await fetch(`${BASE_URL}/movie/${page}`);
      if (!response.ok) return [];
      const json = await response.json();
      return (json.result || []).map((item: any) => ({ ...item, type: 'movie' }));
    } catch (e) {
      console.error('VidSrc fetch error:', e);
      return [];
    }
  },

  // Get latest TV shows
  async getLatestTV(page: number = 1): Promise<VidSrcItem[]> {
    try {
      const response = await fetch(`${BASE_URL}/tv/${page}`);
      if (!response.ok) return [];
      const json = await response.json();
      return (json.result || []).map((item: any) => ({ ...item, type: 'tv' }));
    } catch (e) {
      console.error('VidSrc fetch error:', e);
      return [];
    }
  },

  // Get recent episodes
  async getRecentEpisodes(page: number = 1): Promise<any[]> {
    try {
      const response = await fetch(`${BASE_URL}/episodes/${page}`);
      if (!response.ok) return [];
      const json = await response.json();
      return json.result || [];
    } catch (e) {
      console.error('VidSrc fetch error:', e);
      return [];
    }
  },

  // Generate embed URL for Movie
  getMovieEmbed: (tmdbId: number | string) => {
    return `${BASE_URL}/embed/movie/${tmdbId}`;
  },

  // Generate embed URL for TV Show
  getTVEmbed: (tmdbId: number | string, season: number, episode: number) => {
    return `${BASE_URL}/embed/tv/${tmdbId}/${season}/${episode}`;
  }
};
