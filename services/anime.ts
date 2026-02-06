import { Capacitor } from '@capacitor/core';

// Hybrid Hosting: Custom -> Local -> Cloud
const FALLBACK_CLOUD = 'https://server-blue-delta.vercel.app'; // Default Vercel Project Name
const isNative = Capacitor.isNativePlatform();

let cachedBaseUrl: string | null = null;

const fetchApi = (url: string, init?: RequestInit) => {
    return fetch(url, {
        ...init,
        headers: {
            ...init?.headers,
            'Bypass-Tunnel-Reminder': 'true',
        }
    });
};

const CURRENT_VERSION = '1.1.4';

/**
 * ServerManager handles dynamic discovery of either:
 * 1. A custom local IP (Settings)
 * 2. The built-in Local Proxy (/hianime)
 * 3. A fallback cloud API
 */
export const ServerManager = {
    async checkVersion(url: string): Promise<boolean> {
        try {
            const cleanUrl = url.replace(/\/$/, '');
            const res = await fetch(`${cleanUrl}/check-version`, {
                method: 'GET',
                signal: AbortSignal.timeout(2000)
            });
            if (res.ok) {
                const data = await res.json();
                console.log(`[ServerManager] Version Check for ${url}: ${data.version}`);
                return data.version === CURRENT_VERSION;
            }
        } catch (e) {
            console.warn(`[ServerManager] Version check failed for ${url}`);
        }
        return false;
    },

    reset: async (): Promise<void> => { cachedBaseUrl = null; },
    getUrl: async (): Promise<string> => {
        // v1.1.0 STALE CACE FIX: If we are on mobile, and the cache is 'localhost', it's WRONG.
        // Localhost on mobile means the phone itself, which isn't running the server.
        if (cachedBaseUrl && isNative && cachedBaseUrl.includes('localhost')) {
            console.warn('[ServerManager] Clearing stale localhost cache on Native device');
            cachedBaseUrl = null;
        }

        if (cachedBaseUrl) return cachedBaseUrl;

        // 1. Custom URL (Tunnel or Network IP)
        const custom = localStorage.getItem('custom_anime_server');
        // On native, window.location.hostname is usually 'localhost', but it's NOT the backend machine.
        const isLocalHost = !isNative && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

        if (custom) {
             const clean = custom.replace(/\/$/, '');
             
             // PARANOIA: If we have a localhost custom server but the app is NOT on localhost, ignore it
             if (clean.includes('localhost') && !isLocalHost) {
                 console.warn('Ignoring localhost custom server while on cloud');
                 localStorage.removeItem('custom_anime_server');
             } else {
                 try {
                      const res = await fetch(`${clean}/home`, { 
                          method: 'HEAD',
                          headers: { 'Bypass-Tunnel-Reminder': 'true' }
                      });
                      if (res.ok) {
                          cachedBaseUrl = clean;
                          return cachedBaseUrl;
                      }
                 } catch(e) { 
                     console.warn('Custom server failed:', e);
                     if (clean.includes('localhost')) localStorage.removeItem('custom_anime_server');
                 }
             }
        }

        // 2. Default Local/Proxy (SKIP ON NATIVE - phone doesn't have a local hianime proxy)
        if (!isNative) {
            try {
                // Use a small fetch to see if the local proxy is actually ALIVE
                const res = await fetch('/hianime/home', { method: 'HEAD' });
            // content-type check ensures we aren't getting a generic 404/500 page from Vite but a real API response
            const isJson = res.headers.get('content-type')?.includes('application/json');
            
            if (res.ok && isJson) {
                // Version Check (Local development only)
                if (window.location.hostname === 'localhost') {
                    const isLatest = await ServerManager.checkVersion('/hianime');
                    if (!isLatest) {
                        console.error('CRITICAL: Local Anime Proxy is outdated! Please run "npm run server" to update.');
                        // We continue anyway, but the log remains
                    }
                }
                cachedBaseUrl = '/hianime';
                return cachedBaseUrl;
            }
        } catch(e) {}
    }

        // 3. Cloud Fallback
        try {
            const cloudRes = await fetchApi(`${FALLBACK_CLOUD}/home`, { method: 'HEAD' });
            if (cloudRes.ok) {
                cachedBaseUrl = FALLBACK_CLOUD;
                return cachedBaseUrl;
            }
        } catch (e) {}
        
        // Final Fallback Logic:
        // On Vercel (browser), we always use /hianime because it's rewritten to the backend.
        // On a phone/local dev, we use either the cloud or the local proxy.
        const isVercel = !isNative && window.location.hostname.includes('vercel.app');
        const isLocalBrowser = !isNative && isLocalHost;

        if (isVercel) return '/hianime';
        if (isLocalBrowser) return '/hianime'; // Vite proxy

        return FALLBACK_CLOUD;
    }
};

export interface AnimeTitle {
  romaji: string;
  english: string;
  native: string;
  userPreferred: string;
}

export interface AnimeImage {
  extraLarge: string;
  large: string;
  medium: string;
  color: string;
}

export interface AnimeEpisode {
  id: string; 
  episodeId: number;
  title: string;
  number: number;
}

export interface Anime {
  id: string; 
  title: AnimeTitle;
  coverImage: AnimeImage;
  bannerImage?: string;
  description?: string;
  genres?: string[];
  season?: string;
  seasonYear?: number;
  episodes?: number; 
  status?: string;
  rating?: number; 
  popularity?: number;
  episodesList?: AnimeEpisode[]; 
  posterPath?: string;
  backdropPath?: string;
  voteAverage?: number;
  voteCount?: number;
  mediaType?: 'anime'; 
  name?: string; 
  recommendations?: Anime[];
}

export interface AnimeStreamConfig {
  intro?: { start: number; end: number };
  outro?: { start: number; end: number };
  sources: { url: string; type: string; isM3U8: boolean }[];
  tracks: { file: string; kind: string; label?: string }[];
}

export const AnimeService = {
  getHomeContent: async (): Promise<{
    spotlight: Anime[];
    trending: Anime[];
    latest: Anime[];
    upcoming: Anime[];
  }> => {
    try {
      const baseUrl = await ServerManager.getUrl();
      const response = await fetchApi(`${baseUrl}/home`);
      if (!response.ok) throw new Error('Network response was not ok');
      const json = await response.json();
      const data = json.data || json; // Handle both wrapped and unwrapped for safety
      return {
        spotlight: (data.spotlightAnimes || []).map(mapAniwatchAnime),
        trending: (data.trendingAnimes || []).map(mapAniwatchAnime),
        latest: (data.latestEpisodeAnimes || []).map(mapAniwatchAnime),
        upcoming: (data.topUpcomingAnimes || []).map(mapAniwatchAnime),
      };
    } catch (e) {
      console.error('AnimeService.getHomeContent error:', e);
      return { spotlight: [], trending: [], latest: [], upcoming: [] };
    }
  },

  getTrending: async (): Promise<Anime[]> => {
      const content = await AnimeService.getHomeContent();
      return content.trending;
  },

  getPopular: async (): Promise<Anime[]> => {
    try {
      const baseUrl = await ServerManager.getUrl();
      const response = await fetchApi(`${baseUrl}/home`);
      if (!response.ok) return [];
      const json = await response.json();
      const data = json.data || json;
      return (data.mostPopularAnimes || []).map(mapAniwatchAnime);
    } catch (e) {
      console.error('AnimeService.getPopular error:', e);
      return [];
    }
  },

  search: async (query: string, page = 1): Promise<Anime[]> => {
    try {
      const baseUrl = await ServerManager.getUrl();
      const response = await fetchApi(`${baseUrl}/search?q=${encodeURIComponent(query)}&page=${page}`);
      if (!response.ok) return [];
      const json = await response.json();
      const data = json.data || json;
      return (data.animes || []).map(mapAniwatchAnime);
    } catch (e) {
      console.error('AnimeService.search error:', e);
      return [];
    }
  },

  getDetails: async (id: string): Promise<Anime | null> => {
    try {
      const baseUrl = await ServerManager.getUrl();
      const response = await fetchApi(`${baseUrl}/info/${id}`);
        if (!response.ok) return null;
        const json = await response.json();
        const data = json.data || json;
        
        // aniwatch returns { anime: { ...info, ...moreInfo } } or similar
        // Based on README: response { anime: { info: {...}, moreInfo: {...} } }
        const anime = data.anime;
        const info = anime?.info;
        const more = anime?.moreInfo;
        
        if (!info) return null;

        // Fetch episodes separately as they are usually not in getInfo for aniwatch
        // or check if they are included. The README says getEpisodes is separate.
        let episodesList: AnimeEpisode[] = [];
        try {
           const epResponse = await fetchApi(`${baseUrl}/episodes/${id}`);
           if (epResponse.ok) {
              const epJson = await epResponse.json();
              const epData = epJson.data || epJson;
               // response: { totalEpisodes, episodes: [...] }
              episodesList = (epData.episodes || []).map((ep: any) => ({
                 id: ep.episodeId, 
                 episodeId: ep.episodeId, 
                 title: ep.title,
                 number: ep.number
              }));
           }
        } catch(e) { console.error('Failed fetching episodes', e); }

        return {
            id: info.id,
            title: {
                romaji: info.name,
                english: info.name,
                native: info.name, // Aniwatch often gives one name
                userPreferred: info.name
            },
            coverImage: {
                extraLarge: info.poster,
                large: info.poster,
                medium: info.poster,
                color: '#E50914'
            },
            bannerImage: info.poster, 
            description: info.description,
            genres: more?.genres || [],
            season: more?.season, // e.g. "Spring 2024"
            seasonYear: more?.aired ? parseInt(more.aired.split(',')[1]) : undefined,
            episodes: info.stats?.episodes?.sub || 0,
            status: more?.status,
            rating: info.stats?.rating ? (parseFloat(info.stats.rating) * 10) : 0, 
            popularity: 0, 
            episodesList: episodesList,
            mediaType: 'anime',
            recommendations: (info.recommendedAnimes || info.relatedAnimes || []).map(mapAniwatchAnime)
        };
    } catch (e) {
        console.error('AnimeService.getDetails error:', e);
        return null;
    }
  },

  getServers: async (episodeId: string): Promise<any> => {
      try {
          const baseUrl = await ServerManager.getUrl();
          const response = await fetchApi(`${baseUrl}/servers/${episodeId}`);
          if (!response.ok) return null;
          const json = await response.json();
          const data = json.data || json;
          // Flatten: Prefer 'sub', fall back to 'dub', or empty array
          return data.sub || data.dub || [];
      } catch (e) {
          console.error('AnimeService.getServers error:', e);
          return null;
      }
  },

  getSources: async (serverName: string, episodeId: string): Promise<AnimeStreamConfig | null> => {
      try {
          const baseUrl = await ServerManager.getUrl();
          const response = await fetchApi(`${baseUrl}/sources?serverId=${serverName}&episodeId=${encodeURIComponent(episodeId)}&category=sub`);
          
          if (response.status === 403) {
              const errorData = await response.json().catch(() => ({}));
              console.error('CRITICAL: Anime Provider Blocked Vercel!', errorData.message);
              alert('Anime Provider Blocked Vercel! Please use your Local Anime Server (Settings > Anime Server).');
              return null;
          }

          if (!response.ok) return null;
          const data = await response.json();
          console.log('[AnimeService] Raw sources from server:', data.sources);
          
          // Transform sources to use the current server's proxy
          if (data && data.sources) {
              data.sources = data.sources.map((src: any) => {
                  console.log('[AnimeService] Mapping source URL:', src.url);

              // v1.0.9 NATIVE BYPASS: 
              // If we are on a phone, Vercel is blocked. We use the RAW url and headers.
              // CapacitorHttp (enabled in capacitor.config.ts) will handle the CORS/Headers automatically.
              // v1.1.4 SMART NATIVE BYPASS: 
              // Only bypass the proxy if we are using the Vercel Cloud (which is often blocked).
              // If we are using a custom PC server, we WANT to use its proxy!
              const isVercel = baseUrl.includes('vercel.app');
              if (isNative && src.originalUrl && isVercel) {
                  console.log('[AnimeService] Cloud Native: Using direct link (bypass Vercel proxy)');
                  src.url = src.originalUrl;
                  return src;
              }

              // Normal Cloud/Local resolution (Squasher)
              let finalUrl = src.url;
              if (finalUrl.startsWith('/')) {
                  const cleanBase = baseUrl.replace(/\/$/, '');
                  finalUrl = `${cleanBase}${finalUrl}`;
              }
              
              // v1.1.0 ELITE SQUASHER: Even more aggressive replacement
              const isLocalhostLeak = finalUrl.includes('localhost:3001');
              const shouldSquash = isNative || !window.location.hostname.includes('localhost');
              
              if (isLocalhostLeak && shouldSquash) {
                  console.warn('[AnimeService] Elite Squasher: Redirecting leaked localhost to valid base:', baseUrl);
                  finalUrl = finalUrl.replace(/https?:\/\/localhost:3001/g, baseUrl);
              }

              console.log('[AnimeService] Final URL:', finalUrl);
              src.url = finalUrl;
              return src;
          });
          }

          // Map tracks
          if (data && data.tracks) {
              data.tracks = data.tracks
                .filter((t: any) => t.kind !== 'thumbnails' && t.label !== 'thumbnails' && t.lang !== 'thumbnails')
                .map((t: any) => ({
                  file: t.url,
                  label: t.label || t.lang || 'Unknown',
                  kind: t.kind || 'subtitles',
                  default: t.default
              }));
          }
           
          return data;
      } catch (e) {
          console.error('[AnimeService] CRITICAL: getSources failed after all retries. The cloud might be blocked or the provider is down.', e);
          return null;
      }
  }
};

function mapAniwatchAnime(item: any): Anime {
  return {
    id: item.id,
    title: {
        romaji: item.name,
        english: item.name,
        native: item.name,
        userPreferred: item.name
    },
    coverImage: {
        extraLarge: item.poster,
        large: item.poster,
        medium: item.poster,
        color: '#E50914'
    },
    bannerImage: item.poster,
    description: item.description,
    rating: item.rank ? (100 - item.rank) : undefined, // Fake rating logic or ignore
    status: item.type,
    episodes: item.episodes?.sub || 0,
    mediaType: 'anime',
    name: item.name,
    posterPath: item.poster,
    backdropPath: item.poster
  };
}
