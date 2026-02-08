import { useState, useEffect, useCallback } from 'react';
import { FriendService } from '../services/friends';
import { ProfileService } from '../services/profiles';
import type { Friend, FriendActivity } from '../types';
import { supabase } from '../services/supabase';

export function useFriends() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [activity, setActivity] = useState<FriendActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Check Auth (Parallel for speed)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
         setUserId(null);
         setFriends([]);
         setRequests([]);
         setActivity([]);
         setLoading(false);
         return;
      }
      setUserId(user.id);

      // 2. Fetch Data
      const [friendsList, reqs, acts] = await Promise.all([
        FriendService.getFriends(),
        FriendService.getFriendRequests(),
        FriendService.getFriendActivity()
      ]);

      setFriends(friendsList);
      setRequests(reqs);
      setActivity(acts);
    } catch (e) {
      console.error('Error refreshing friends:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial Load
  useEffect(() => {
    refresh();

    // Setup Realtime Listener just for requests/friends to keep UI snappy
    // Note: We'd need to listen to 'friend_requests' table changes logic here
    const channel = supabase.channel('social_updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'friend_requests' },
        () => refresh()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'friends' },
        () => refresh()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'watch_progress' },
        () => refresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  const addFriend = async (friendId: string) => {
    const result = await FriendService.sendFriendRequest(friendId);
    if (result.success) refresh(); // Optimistic update would be better but this is safe
    return result;
  };

  const acceptFriend = async (requestId: string, senderId: string) => {
    const success = await FriendService.acceptRequest(requestId, senderId);
    if (success) refresh();
    return success;
  };

  return {
    friends,
    requests,
    activity,
    loading,
    userId,
    addFriend,
    acceptFriend,
    refresh
  };
}
