import type { Movie } from '../types';
import { ProfileService } from './profiles';
import { supabase } from './supabase';

export async function getMyList(): Promise<Movie[]> {
  try {
    const profile = ProfileService.getActiveProfile();
    if (!profile) return [];

    const { data, error } = await supabase
      .from('my_list')
      .select('*')
      .eq('profile_id', profile.id)
      .eq('type', 'movie') // Assuming currently only movies in MyList based on strict typing, but easy to expand
      .order('added_at', { ascending: false });

    if (error) {
      console.error('Error fetching My List:', error);
      return [];
    }

    return data.map((item: any) => item.data as Movie);
  } catch (error) {
    console.error('Error reading My List:', error);
    return [];
  }
}

export async function addToMyList(movie: Movie): Promise<boolean> {
  try {
    const profile = ProfileService.getActiveProfile();
    if (!profile) return false;

    const { error } = await supabase
      .from('my_list')
      .insert({
        profile_id: profile.id,
        movie_id: movie.id,
        type: 'movie',
        data: movie
      });

    if (error) {
        // Unique violation means already in list, basically success
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

export async function removeFromMyList(movieId: number): Promise<boolean> {
  try {
    const profile = ProfileService.getActiveProfile();
    if (!profile) return false;

    const { error } = await supabase
      .from('my_list')
      .delete()
      .eq('profile_id', profile.id)
      .eq('movie_id', movieId)
      .eq('type', 'movie'); // Strict type check

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

export async function isInMyList(movieId: number): Promise<boolean> {
  try {
    const profile = ProfileService.getActiveProfile();
    if (!profile) return false;

    const { data, error } = await supabase
      .from('my_list')
      .select('id')
      .eq('profile_id', profile.id)
      .eq('movie_id', movieId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
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
