/**
 * VidSrc.icu Integration
 * Provides access to streaming embed URLs and content lists
 */

import { ServerManager } from '../utils/server-manager';

const getBaseUrl = async () => {
    const serverUrl = await ServerManager.getUrl();
    // If it's the /hianime proxy, we need the root for /vidsrc
    if (serverUrl === '/hianime') return '/vidsrc';
    // If it's an absolute URL, use it as prefix (Vercel will handle the /vidsrc rewrite)
    return `${serverUrl.replace(/\/$/, '')}/vidsrc`;
};

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
      const baseUrl = await getBaseUrl();
      const response = await fetch(`${baseUrl}/movie/${page}`);
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
      const baseUrl = await getBaseUrl();
      const response = await fetch(`${baseUrl}/tv/${page}`);
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
      const baseUrl = await getBaseUrl();
      const response = await fetch(`${baseUrl}/episodes/${page}`);
      if (!response.ok) return [];
      const json = await response.json();
      return json.result || [];
    } catch (e) {
      console.error('VidSrc fetch error:', e);
      return [];
    }
  },

  // Generate embed URL for Movie
  getMovieEmbed: async (tmdbId: number | string) => {
    const baseUrl = await getBaseUrl();
    return `${baseUrl}/embed/movie/${tmdbId}`;
  },

  // Generate embed URL for TV Show
  getTVEmbed: async (tmdbId: number | string, season: number, episode: number) => {
    const baseUrl = await getBaseUrl();
    return `${baseUrl}/embed/tv/${tmdbId}/${season}/${episode}`;
  }
};
