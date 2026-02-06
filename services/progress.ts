import type { Movie, TVShow } from '../types';
import { ProfileService } from './profiles';
import { supabase } from './supabase';

export interface WatchProgress {
  id: string | number;
  type: 'movie' | 'tv' | 'anime';
  itemId: number | string; 
  progress: number; 
  duration: number; 
  timestamp: number; 
  data: Movie | TVShow | any; 
  season?: number;
  episode?: number;
}

export const WatchProgressService = {
  saveProgress: async (item: Movie | TVShow | any, progress: number, duration: number, season?: number, episode?: number) => {
    if (!item || !item.id) {
        console.warn('[Progress] Cannot save: invalid item', item);
        return;
    }

    // Minimum threshold: Don't save if it's just the start (unless it is a resume update?)
    // Note: If duration is 0 (unknown), we accept the heartbeat as valid only if it's not the initial 0-second save
    if (duration > 0 && progress < 1) { // Lowered to 1s for testing
        // console.log('[Progress] Skipping save: progress too small', progress);
        return; 
    }
    
    // If watched > 90%, remove from continue watching
    if (duration > 0 && progress / duration > 0.90) {
      console.log('[Progress] Removing finished item:', item.id);
      await WatchProgressService.removeProgress(item.id, (item as any).name ? 'tv' : 'movie');
      return;
    }

    try {
      const profile = ProfileService.getActiveProfile();
      if (!profile) {
          console.error('[Progress] No active profile for saving');
          return;
      }

      const type = item.mediaType === 'anime' ? 'anime' : ((item as any).name ? 'tv' : 'movie'); 
      console.log(`[Progress] Saving ${type} ${item.id} (${progress}/${duration})`);
      
      const { error } = await supabase
        .from('watch_progress')
        .upsert({
          profile_id: profile.id,
          item_id: item.id.toString(), // Store as string
          type,
          progress,
          duration,
          season_number: season,
          episode_number: episode,
          last_watched: new Date().toISOString(),
          data: item
        }, { onConflict: 'profile_id,item_id,type' });

      if (error) console.error('[Progress] Supabase Error:', error);
    } catch (e) {
      console.error('[Progress] Exception:', e);
    }
  },

  getProgress: async (id: number | string, type: 'movie' | 'tv' | 'anime'): Promise<WatchProgress | null> => {
    try {
      const profile = ProfileService.getActiveProfile();
      if (!profile) return null;

      const { data, error } = await supabase
        .from('watch_progress')
        .select('*')
        .eq('profile_id', profile.id)
        .eq('item_id', id.toString()) // Compare as string
        .eq('type', type) 
        .maybeSingle();
        
      if (error) console.error('[Progress] Fetch Error:', error);
      if (!data) return null;

      // Filter out insignificant progress (e.g. < 1s) to be safe
      if (data.progress < 1 && data.duration > 0) return null;

      return {
          id: data.id,
          type: data.type,
          itemId: data.item_id,
          progress: data.progress,
          duration: data.duration,
          timestamp: new Date(data.last_watched).getTime(),
          data: data.data,
          season: data.season_number,
          episode: data.episode_number
      };
    } catch (e) {
      console.error('[Progress] Exception get:', e);
      return null;
    }
  },

  getContinueWatching: async (): Promise<(Movie | TVShow)[]> => {
    try {
      const profile = ProfileService.getActiveProfile();
      if (!profile) {
          console.warn('[Progress] No active profile for fetching');
          return [];
      }

      console.log('[Progress] Fetching continue watching...');
      const { data, error } = await supabase
        .from('watch_progress')
        .select('*')
        .eq('profile_id', profile.id)
        .gt('last_watched', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days only
        .order('last_watched', { ascending: false });

      if (error) {
          console.error('[Progress] Fetch Error:', error);
          return [];
      }

      console.log(`[Progress] Found ${data?.length} raw items`, data);

      // DEBUG: Remove strict filtering to verify saving
      const result = data
        // .filter((item: any) => item.data && (item.progress >= 1 || !item.duration)) 
        .map((item: any) => {
            if (!item.data) return null;
            const raw = item.data;
            
            // Unpack complex Anime title if present (AniList format)
            if (raw.title && typeof raw.title === 'object') {
                return {
                    ...raw,
                    original_title: raw.title, // keep original
                    title: raw.title.userPreferred || raw.title.english || raw.title.romaji || 'Anime',
                    // Shotgun approach to ensure ContentRow finds the image
                    poster_path: raw.coverImage?.large || raw.coverImage?.extraLarge || raw.image || raw.poster_path || raw.bannerImage || raw.img || raw.thumbnail || raw.picture,
                    posterPath: raw.coverImage?.large || raw.coverImage?.extraLarge || raw.image || raw.poster_path || raw.bannerImage || raw.img || raw.thumbnail || raw.picture,
                    image: raw.coverImage?.large || raw.coverImage?.extraLarge || raw.image || raw.poster_path || raw.bannerImage || raw.img || raw.thumbnail || raw.picture,
                    mediaType: 'anime',
                    id: item.item_id || raw.id // Ensure ID is from row or data
                };
            }
            // Ensure ID is string for movies/tv if needed, but usually number
            return { ...raw, id: item.item_id || raw.id } as (Movie | TVShow);
        })
        .filter((item: any) => item !== null);
        
      console.log(`[Progress] Returning ${result.length} valid items`);
      return result;
    } catch (e) {
      console.error('[Progress] Exception list:', e);
      return [];
    }
  },

  getWatchHistory: async (page = 0, limit = 20): Promise<WatchProgress[]> => {
    try {
      const profile = ProfileService.getActiveProfile();
      if (!profile) return [];

      const { data, error } = await supabase
        .from('watch_progress')
        .select('*')
        .eq('profile_id', profile.id)
        .order('last_watched', { ascending: false })
        .range(page * limit, (page + 1) * limit - 1);

      if (error) {
        console.error('Error fetching watch history:', error);
        return [];
      }

      return data.map((item: any) => ({
        id: item.item_id,
        type: item.type,
        itemId: item.item_id,
        progress: item.progress,
        duration: item.duration,
        timestamp: new Date(item.last_watched).getTime(),
        data: item.data,
        season: item.season_number,
        episode: item.episode_number
      }));
    } catch (e) {
      console.error('Error fetching watch history', e);
      return [];
    }
  },

  getAll: async (): Promise<Record<string, WatchProgress>> => {
      // Used for quick synced checks
       try {
        const profile = ProfileService.getActiveProfile();
        if (!profile) return {};
  
        const { data } = await supabase
          .from('watch_progress')
          .select('*')
          .eq('profile_id', profile.id);
          
        if (!data) return {};
        
        const map: Record<string, WatchProgress> = {};
        data.forEach((item: any) => {
           map[item.item_id] = {
              id: item.item_id,
              type: item.type,
              itemId: item.item_id,
              progress: item.progress,
              duration: item.duration,
              timestamp: new Date(item.last_watched).getTime(),
              data: item.data,
              season: item.season_number,
              episode: item.episode_number
           };
        });
        return map;
      } catch {
        return {};
      }
  },

  removeProgress: async (id: number, type: 'movie' | 'tv') => {
    try {
      const profile = ProfileService.getActiveProfile();
      if (!profile) return;

      const { error } = await supabase
        .from('watch_progress')
        .delete()
        .eq('profile_id', profile.id)
        .eq('item_id', id)
        .eq('type', type);
        
      if (error) console.error('Error removing progress:', error);
    } catch (e) {
      console.error('Error removing progress', e);
    }
  },
  
  clearAllProgress: async () => {
    try {
      const profile = ProfileService.getActiveProfile();
      if (!profile) return false;

      const { error } = await supabase
        .from('watch_progress')
        .delete()
        .eq('profile_id', profile.id);
        
      if (error) {
        console.error('Error clearing progress:', error);
        return false;
      }
      return true;
    } catch (e) {
      console.error('Error clearing progress', e);
      return false;
    }
  }
};
