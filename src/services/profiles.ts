import { supabase } from './supabase';

export interface Profile {
  id: string;
  user_id?: string;
  name: string;
  avatar: string;
  isKids: boolean;
  autoplay?: boolean;
  haptics?: boolean;
}

const ACTIVE_PROFILE_KEY = 'cinemovie_active_profile_id';
const DEFAULT_AVATAR = 'https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png'; // Fallback
const TOTAL_LOCAL_AVATARS = 67;

export const ProfileService = {
  async getProfiles(): Promise<Profile[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching profiles:', error);
        return [];
      }

      if (!data || data.length === 0) {
        return [];
      }

      return data.map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        isKids: p.is_kids,
        autoplay: p.autoplay,
        haptics: p.haptics
      }));
    } catch (e: any) {
      console.error('Profile fetch error:', e);
      if (e?.code === 'PGRST205' || e?.message?.includes('profiles')) {
        throw new Error('MISSING_TABLES');
      }
      return [];
    }
  },

  getActiveProfile(): Profile | null {
    const stored = localStorage.getItem('cinemovie_active_profile_cache');
    return stored ? JSON.parse(stored) : null;
  },

  setActiveProfile(id: string, profileData?: Profile) {
    localStorage.setItem(ACTIVE_PROFILE_KEY, id);
    if (profileData) {
        localStorage.setItem('cinemovie_active_profile_cache', JSON.stringify(profileData));
    }
    window.dispatchEvent(new CustomEvent('profileChanged', { detail: id }));
  },

  clearActiveProfile() {
    localStorage.removeItem(ACTIVE_PROFILE_KEY);
    localStorage.removeItem('cinemovie_active_profile_cache');
    window.dispatchEvent(new CustomEvent('profileChanged', { detail: null }));
  },

  async addProfile(name: string, isKids: boolean, customAvatarUrl?: string): Promise<Profile | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user logged in');

      let avatar = customAvatarUrl;
      
      if (!avatar) {
        // Fallback random avatar from local collection
        const randomId = Math.floor(Math.random() * TOTAL_LOCAL_AVATARS) + 1;
        avatar = `/avatars/avatar-${randomId}.jpg`;
      }

      const { data, error } = await supabase
        .from('profiles')
        .insert({
          user_id: user.id,
          name,
          avatar,
          is_kids: isKids,
          autoplay: true,
          haptics: true
        })
        .select()
        .single();

      if (error) throw error;

      return {
        id: data.id,
        name: data.name,
        avatar: data.avatar,
        isKids: data.is_kids,
        autoplay: data.autoplay,
        haptics: data.haptics
      };
    } catch (e) {
      console.error('Error adding profile:', e);
      return null;
    }
  },

  async updateProfile(id: string, updates: Partial<Profile>): Promise<boolean> {
      try {
          const dbUpdates: any = {};
          if (updates.name !== undefined) dbUpdates.name = updates.name;
          if (updates.avatar !== undefined) dbUpdates.avatar = updates.avatar;
          if (updates.isKids !== undefined) dbUpdates.is_kids = updates.isKids;
          if (updates.autoplay !== undefined) dbUpdates.autoplay = updates.autoplay;
          if (updates.haptics !== undefined) dbUpdates.haptics = updates.haptics;

          const { error } = await supabase
              .from('profiles')
              .update(dbUpdates)
              .eq('id', id);

          if (error) throw error;
          
          // Update cache if this is the active profile
          const current = this.getActiveProfile();
          if (current && current.id === id) {
              this.setActiveProfile(id, { ...current, ...updates });
          }

          return true;
      } catch (e) {
          console.error('Error updating profile:', e);
          return false;
      }
  },

  async deleteProfile(id: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (e) {
      console.error('Error deleting profile:', e);
      return false;
    }
  }
};
