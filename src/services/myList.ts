import type { Movie, TVShow } from '../types';
import { ProfileService } from './profiles';
import { supabase } from './supabase';

export async function getMyList(): Promise<(Movie | TVShow)[]> {
  try {
    const profile = ProfileService.getActiveProfile();
    if (!profile) return [];

    const { data, error } = await supabase
      .from('my_list')
      .select('*')
      .eq('profile_id', profile.id)
      .order('added_at', { ascending: false });

    if (error) {
      console.error('Error fetching My List:', error);
      return [];
    }

    return data.map((item: any) => ({
      ...(item.data as any),
      mediaType: item.type
    }));
  } catch (error) {
    console.error('Error reading My List:', error);
    return [];
  }
}

export async function addToMyList(item: Movie | TVShow): Promise<boolean> {
  try {
    const profile = ProfileService.getActiveProfile();
    if (!profile) return false;

    const type = (item as any).title ? 'movie' : 'tv';
    const { error } = await supabase
      .from('my_list')
      .insert({
        profile_id: profile.id,
        movie_id: item.id,
        type: type,
        data: item
      });

    if (error) {
        if (error.code === '23505') return true; 
        console.error('Error adding to My List:', error);
        return false;
    }
    return true;
  } catch (error) {
    console.error('Error adding to My List:', error);
    return false;
  }
}

export async function removeFromMyList(itemId: number, type: 'movie' | 'tv'): Promise<boolean> {
  try {
    const profile = ProfileService.getActiveProfile();
    if (!profile) return false;

    const { error } = await supabase
      .from('my_list')
      .delete()
      .eq('profile_id', profile.id)
      .eq('movie_id', itemId)
      .eq('type', type);

    if (error) {
      console.error('Error removing from My List:', error);
      return false;
    }
    return true;
  } catch (error) {
     console.error('Error removing from My List:', error);
     return false;
  }
}

export async function isInMyList(itemId: number, type: 'movie' | 'tv'): Promise<boolean> {
  try {
    const profile = ProfileService.getActiveProfile();
    if (!profile) return false;

    const { data, error } = await supabase
      .from('my_list')
      .select('id')
      .eq('profile_id', profile.id)
      .eq('movie_id', itemId)
      .eq('type', type)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') { 
        return false;
    }

    return !!data;
  } catch (error) {
    console.error('Error checking My List:', error);
    return false;
  }
}

export async function clearMyList(): Promise<boolean> {
  // Clearing list is usually not exposed in UI like this, but implemented for completeness
  try {
    const profile = ProfileService.getActiveProfile();
    if (!profile) return false;

    const { error } = await supabase
      .from('my_list')
      .delete()
      .eq('profile_id', profile.id);

    return !error;
  } catch (error) {
    console.error('Error clearing My List:', error);
    return false;
  }
}
