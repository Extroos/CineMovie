import React, { useState, useEffect } from 'react';
import { APP_VERSION, checkForUpdates } from '../../../services/updater';
import { getBackdropUrl } from '../../../services/tmdb';
import type { Movie } from '../../../types';
import { Profile, ProfileService } from '../../../services/profiles';
import { supabase } from '../../../services/supabase';
import { triggerHaptic } from '../../../utils/haptics';
import { useFriends } from '../../../hooks/useFriends';
import { ServerManager } from '../../../services/anime';
import { Capacitor } from '@capacitor/core';

const isNative = Capacitor.isNativePlatform();

interface SettingsPageProps {
  onNavigate: (view: any) => void;
  heroBackground?: Movie;
  activeProfile: Profile | null;
  onSwitchProfile: () => void;
  onLogout: () => void;
  onUpdateFound?: (info: any) => void;
}

export default function SettingsPage({ onNavigate, heroBackground, activeProfile, onSwitchProfile, onLogout, onUpdateFound }: SettingsPageProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [currentView, setCurrentView] = useState<'main' | 'social' | 'account' | 'app_settings' | 'help'>('main');
  
  // Social State
  const { friends, requests, userId, addFriend, acceptFriend } = useFriends();
  const [friendInput, setFriendInput] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addMessage, setAddMessage] = useState('');

  // Account State
  const [userEmail, setUserEmail] = useState<string>('');
  const [customServer, setCustomServer] = useState('');
  const [serverStatus, setServerStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'latest' | 'error'>('idle');

  useEffect(() => {
    // Load custom server
    const saved = localStorage.getItem('custom_anime_server');
    if (saved) setCustomServer(saved);
  }, []);

  // Settings State
  const [autoplay, setAutoplay] = useState(activeProfile?.autoplay ?? true);
  const [haptics, setHaptics] = useState(activeProfile?.haptics ?? true);
  const [minimalHome, setMinimalHome] = useState(localStorage.getItem('settings_minimal_home') === 'true');

  useEffect(() => {
    // Fetch email for Account view
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setUserEmail(data.user.email);
    });
  }, []);

  const handleAddFriend = async () => {
    if (!friendInput.trim()) return;
    setIsAdding(true);
    setAddMessage('');
    const result = await addFriend(friendInput.trim());
    setAddMessage(result.message);
    if (result.success) setFriendInput('');
    setIsAdding(false);
  };

  const handleSaveServer = async () => {
    triggerHaptic('medium');
    if (!customServer.trim()) {
        localStorage.removeItem('custom_anime_server');
        ServerManager.reset();
        setServerStatus('idle');
        return;
    }
    
    setServerStatus('testing');
    try {
        // Test connection
        const cleanUrl = customServer.trim().replace(/\/$/, '');
        // We use the proxy route to verify
        const res = await fetch(`${cleanUrl}/home`, { 
            method: 'HEAD',
            headers: { 'Bypass-Tunnel-Reminder': 'true' }
        });
        if (res.ok) {
            localStorage.setItem('custom_anime_server', cleanUrl);
            ServerManager.reset(); // Clear cache
            setServerStatus('success');
            setTimeout(() => setServerStatus('idle'), 3000);
        } else {
            throw new Error('Not reachable');
        }
    } catch (e) {
        setServerStatus('error');
    }
  };

  const toggleSetting = async (setting: 'autoplay' | 'haptics' | 'minimalHome') => {
      triggerHaptic('light');
      
      if (setting === 'minimalHome') {
          const newValue = !minimalHome;
          setMinimalHome(newValue);
          localStorage.setItem('settings_minimal_home', String(newValue));
          window.dispatchEvent(new Event('settingsChanged')); 
          return;
      }

      if (!activeProfile) return;

      const newValue = setting === 'autoplay' ? !autoplay : !haptics;
      
      // Optimistic update
      if (setting === 'autoplay') setAutoplay(newValue);
      else setHaptics(newValue);

      // Persist
      await ProfileService.updateProfile(activeProfile.id, { [setting]: newValue });
  };

  const handleManualUpdateCheck = async () => {
      if (updateStatus === 'checking') return;
      
      setUpdateStatus('checking');
      triggerHaptic('medium');
      
      try {
          const update = await checkForUpdates();
          if (update) {
              setUpdateStatus('idle');
              onUpdateFound?.(update);
          } else {
              setUpdateStatus('latest');
              setTimeout(() => setUpdateStatus('idle'), 3000);
          }
      } catch (e) {
          setUpdateStatus('error');
          setTimeout(() => setUpdateStatus('idle'), 3000);
      }
  };

  // SVG Icons
  const icons = {
    list: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>,
    user: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>,
    settings: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>,
    help: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>,
    logout: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>,
    social: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>,
    chevronRight: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
  };

  const menuItems = [
    { label: 'My List', icon: icons.list, action: () => onNavigate('mylist'), subtitle: 'Manage your saved content' },
    { label: 'Friends & Social', icon: icons.social, action: () => setCurrentView('social'), subtitle: 'Connect with friends' },
    { label: 'Switch Profile', icon: icons.user, action: () => { triggerHaptic('light'); onSwitchProfile(); }, subtitle: 'Change user profile' },
    { label: 'Account', icon: icons.user, action: () => setCurrentView('account'), subtitle: 'Email & Details' },
    { label: 'App Settings', icon: icons.settings, action: () => setCurrentView('app_settings'), subtitle: 'Playback & Haptics' },
    { label: 'Help & Support', icon: icons.help, action: () => setCurrentView('help'), subtitle: 'FAQ & Contact' },
    { label: 'Sign Out', icon: icons.logout, action: () => { triggerHaptic('medium'); onLogout(); }, danger: true, subtitle: 'Log out of this device' },
  ];

  const renderHeader = (title: string, backAction: () => void) => (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      padding: '16px',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
      marginBottom: '1rem'
    }}>
        <button 
          onClick={backAction} 
          style={{ 
            background: 'transparent', 
            border: 'none', 
            color: '#4696ec', 
            marginRight: '8px', 
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            fontSize: '1rem',
            fontWeight: 500,
            padding: 0
          }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}><polyline points="15 18 9 12 15 6"></polyline></svg>
          Back
        </button>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 0 auto', color: '#fff', transform: 'translateX(-50%)', position: 'absolute', left: '50%' }}>{title}</h2>
    </div>
  );

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      position: 'relative',
      paddingBottom: 'calc(80px + env(safe-area-inset-bottom))',
      color: '#fff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    }}>
      
      {/* Cinematic Backdrop - Darkened for better contrast */}
      <div style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        overflow: 'hidden', 
        pointerEvents: 'none',
        background: '#000',
      }}>
         {heroBackground ? (
            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
              <img
                src={getBackdropUrl(heroBackground.backdropPath, 'original')}
                alt="Background"
                onLoad={() => setImageLoaded(true)}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  opacity: imageLoaded ? 0.3 : 0, 
                  transition: 'opacity 1s ease',
                  filter: 'blur(40px) saturate(110%) brightness(0.7)', 
                  transform: 'scale(1.1)', 
                }}
              />
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, #0a0a0a 100%)', 
              }} />
           </div>
         ) : (
           <div style={{ width: '100%', height: '100%', background: '#0a0a0a' }} />
         )}
      </div>

      {/* Content Container */}
      <div style={{
        position: 'relative',
        zIndex: 2,
        padding: 'calc(1.5rem + env(safe-area-inset-top)) 1.5rem 0', // Tighter padding
        maxWidth: '600px', // More constrained max-width for "app-like" feel
        margin: '0 auto',
      }}>
        
        {/* Header - Only show on Main view */}
        {currentView === 'main' && (
          <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}> 
            <h1 style={{
              fontSize: '1.75rem', 
              fontWeight: 700,
              color: '#fff',
              letterSpacing: '-0.03em',
              margin: 0,
            }}>
              Settings
            </h1>
            <div style={{ 
              fontSize: '0.75rem', 
              fontWeight: 500,
              background: 'rgba(255,255,255,0.08)', 
              padding: '4px 10px', 
              borderRadius: '20px', 
              color: 'rgba(255,255,255,0.6)', 
              backdropFilter: 'blur(5px)',
              border: '1px solid rgba(255,255,255,0.05)'
            }}>
              v{APP_VERSION}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Profile Card - Only on Main */}
          {currentView === 'main' && (
            <button 
              onClick={() => { triggerHaptic('light'); onSwitchProfile(); }}
              style={{
                background: 'rgba(30, 30, 30, 0.6)', // Darker, more stable background
                borderRadius: '14px', 
                padding: '12px', 
                border: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                backdropFilter: 'blur(12px)',
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left',
                transition: 'background 0.2s ease',
              }}
              onMouseDown={(e) => e.currentTarget.style.background = 'rgba(40, 40, 40, 0.8)'}
              onMouseUp={(e) => e.currentTarget.style.background = 'rgba(30, 30, 30, 0.6)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(30, 30, 30, 0.6)'}
            >
               <div style={{
                 width: '52px', 
                 height: '52px',
                 borderRadius: '10px',
                 overflow: 'hidden',
                 flexShrink: 0,
                 boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
               }}>
                 <img 
                   src={activeProfile?.avatar} 
                   alt={activeProfile?.name} 
                   style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                 />
               </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{ fontSize: '1.05rem', fontWeight: 600, margin: '0 0 2px 0', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeProfile?.name}</h2>
                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>{activeProfile?.isKids ? 'Kids Profile' : 'Standard Profile'}</div>
              </div>
              <div style={{ opacity: 0.4, paddingRight: '4px' }}>
                 <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
              </div>
            </button>
          )}

          {/* Settings Group Container */}
          <div style={{ 
            background: 'rgba(30, 30, 30, 0.6)', // Unified container for all items
            backdropFilter: 'blur(12px)',
            borderRadius: '14px', 
            border: '1px solid rgba(255, 255, 255, 0.08)',
            overflow: 'hidden'
          }}>
            
            {currentView === 'main' && (
              <div style={{ padding: '0 20px', marginBottom: '32px' }}>
                  <h3 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#FF9966', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '1px' }}>Network & Services</h3>
                  <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '16px', overflow: 'hidden' }}>
                      <button 
                          onClick={() => {
                              localStorage.removeItem('custom_anime_server');
                              localStorage.removeItem('cinemovie_anime_server_cache');
                              window.location.reload();
                          }}
                          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }}
                      >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255,100,100,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF6464" strokeWidth="2"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                              </div>
                              <div style={{ textAlign: 'left' }}>
                                  <div style={{ fontWeight: 600 }}>Reset Anime Server</div>
                                  <div style={{ fontSize: '0.75rem', opacity: 0.5 }}>Clear custom server & force refresh</div>
                              </div>
                          </div>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                      </button>
                      <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', margin: '0 16px' }} />
                      <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                              </div>
                              <div style={{ textAlign: 'left' }}>
                                  <div style={{ fontWeight: 600 }}>Cloud Status</div>
                                  <div style={{ fontSize: '0.75rem', color: '#46d369' }}>Connected (Vercel)</div>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
            )}

            {/* SOCIAL VIEW */}
            {currentView === 'social' && (
              <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
                  {renderHeader('Friends & Social', () => setCurrentView('main'))}
                  <div style={{ padding: '0 16px 16px' }}>
                    {/* Friend ID Card */}
                    <div style={{ marginBottom: '1.25rem', background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                       <div style={{ fontSize: '0.7rem', color: '#888', marginBottom: '0.5rem', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Your Friend ID</div>
                       <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <code style={{ flex: 1, background: 'transparent', color: '#fff', fontSize: '0.95rem', fontFamily: 'monospace', fontWeight: 600 }}>{userId || '...'}</code>
                          <button 
                            onClick={() => { navigator.clipboard.writeText(userId || ''); triggerHaptic('light'); alert('Copied!'); }}
                            style={{ background: 'rgba(70, 211, 105, 0.15)', border: 'none', color: '#46d369', padding: '6px 12px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                          >Copy</button>
                       </div>
                    </div>

                    {/* Add Friend Input */}
                    <div style={{ marginBottom: '1.5rem' }}>
                       <div style={{ display: 'flex', gap: '8px' }}>
                         <input 
                           value={friendInput}
                           onChange={(e) => setFriendInput(e.target.value)}
                           placeholder="Friend ID..."
                           style={{ 
                             flex: 1, 
                             background: 'rgba(255,255,255,0.08)', 
                             border: 'none', 
                             color: '#fff', 
                             padding: '10px 12px', 
                             borderRadius: '8px',
                             fontSize: '0.9rem',
                             outline: 'none'
                           }}
                         />
                         <button 
                            onClick={handleAddFriend}
                            disabled={isAdding}
                            style={{ 
                              background: '#fff', 
                              color: '#000', 
                              border: 'none', 
                              padding: '0 16px', 
                              borderRadius: '8px', 
                              fontWeight: 600, 
                              cursor: 'pointer', 
                              opacity: isAdding ? 0.7 : 1,
                              fontSize: '0.85rem'
                            }}
                         >
                           {isAdding ? '...' : 'Add'}
                         </button>
                       </div>
                       {addMessage && <div style={{ fontSize: '0.8rem', marginTop: '0.8rem', color: addMessage.includes('sent') ? '#46d369' : '#ff4757', fontWeight: 500 }}>{addMessage}</div>}
                    </div>

                    {/* Requests Header */}
                    {requests.length > 0 && (
                      <div style={{ marginBottom: '1.25rem' }}>
                        <h3 style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.6rem', fontWeight: 600, letterSpacing: '0.03em', textTransform: 'uppercase' }}>Requests</h3>
                        {requests.map(req => (
                        <div key={req.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.05)', padding: '10px 12px', borderRadius: '8px', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                             {req.senderAvatar ? (
                               <img src={req.senderAvatar} alt={req.senderName} style={{ width: '30px', height: '30px', borderRadius: '50%', objectFit: 'cover' }} />
                             ) : (
                               <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#333', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>?</div>
                             )}
                             <div>
                               <div style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 500 }}>{req.senderName || 'Unknown User'}</div>
                               <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>ID: {req.sender_id.substring(0, 6)}...</div>
                             </div>
                          </div>
                          <button onClick={() => acceptFriend(req.id, req.sender_id)} style={{ background: '#46d369', color: '#000', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>Accept</button>
                        </div>
                      ))}
                      </div>
                    )}

                    {/* Friends List Header */}
                    <div>
                       <h3 style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.6rem', fontWeight: 600, letterSpacing: '0.03em', textTransform: 'uppercase' }}>Friends ({friends.length})</h3>
                       {friends.length === 0 ? (
                         <div style={{ padding: '24px', textAlign: 'center', opacity: 0.5 }}>
                            <div style={{ fontSize: '0.9rem' }}>No friends added yet</div>
                         </div>
                       ) : (
                         <div style={{ display: 'flex', flexDirection: 'column' }}>
                           {friends.map((f, i) => (
                             <div key={f.id} style={{ 
                               display: 'flex', 
                               alignItems: 'center', 
                               gap: '12px', 
                               padding: '10px 0', 
                               borderBottom: i < friends.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' 
                              }}>
                                <img src={f.avatar} alt={f.name} style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', background: '#333' }} />
                                <div>
                                   <div style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 500 }}>{f.name}</div>
                                   <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>{f.status}</div>
                                </div>
                             </div>
                           ))}
                         </div>
                       )}
                    </div>
                  </div>
              </div>
            )}

            {/* ACCOUNT VIEW */}
            {currentView === 'account' && (
              <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
                {renderHeader('Account', () => setCurrentView('main'))}
                <div style={{ padding: '0 16px 24px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase' }}>Email</div>
                      <div style={{ fontSize: '1rem', color: '#fff' }}>{userEmail || 'Loading...'}</div>
                    </div>
                     <div>
                      <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase' }}>Plan</div>
                       <div style={{ fontSize: '1rem', color: '#46d369', fontWeight: 600 }}>Free Forever</div>
                       <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '4px' }}>No subscription required.</div>
                    </div>
                     <div style={{ paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                      <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase' }}>User ID</div>
                      <div style={{ fontSize: '0.85rem', color: '#555', fontFamily: 'monospace' }}>{userId}</div>
                    </div>

                    {/* Server Configuration */}
                     <div style={{ paddingTop: '20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                      <div style={{ fontSize: '0.75rem', color: '#4696ec', marginBottom: '12px', fontWeight: 600, textTransform: 'uppercase' }}>Anime Server Config</div>
                      <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '8px', lineHeight: '1.4' }}>
                          Enter your <b>tunnel URL</b> (from <code>npm run share</code>) or <b>Local IP</b> (e.g. <code>http://192.168.1.22:3001</code>) to watch on mobile.
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                          <input 
                              value={customServer}
                              onChange={(e) => setCustomServer(e.target.value)}
                              placeholder="http://192.168.1.22:3001"
                              style={{
                                  flex: 1,
                                  background: 'rgba(255,255,255,0.08)',
                                  border: serverStatus === 'error' ? '1px solid #ff4757' : '1px solid rgba(255,255,255,0.1)',
                                  color: '#fff',
                                  padding: '10px',
                                  borderRadius: '8px',
                                  fontSize: '0.85rem',
                                  fontFamily: 'monospace'
                              }}
                          />
                          <button 
                              onClick={handleSaveServer}
                              disabled={serverStatus === 'testing'}
                              style={{
                                  background: serverStatus === 'success' ? '#46d369' : '#fff',
                                  color: '#000',
                                  border: 'none',
                                  padding: '0 16px',
                                  borderRadius: '8px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  minWidth: '80px',
                                  transition: 'background 0.3s'
                              }}
                          >
                              {serverStatus === 'testing' ? '...' : serverStatus === 'success' ? 'Saved' : 'Save'}
                          </button>
                      </div>
                      {serverStatus === 'error' && <div style={{ color: '#ff4757', fontSize: '0.8rem', marginTop: '6px' }}>Connection failed. Make sure the server is running.</div>}
                      <div style={{ marginTop: '12px', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
                          <b>💡 Pro Tip:</b> 192.168.x.x IPs only work when you are on your <b>Home Wi-Fi</b>. If you are in a different country, use the Vercel Cloud or a public Tunnel URL!
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* APP SETTINGS VIEW */}
            {currentView === 'app_settings' && (
              <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
                {renderHeader('App Settings', () => setCurrentView('main'))}
                <div style={{ padding: '0 16px 16px' }}>
                  {/* Minimal Home Toggle */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div>
                      <div style={{ fontSize: '1rem', fontWeight: 500 }}>Minimal Home</div>
                      <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Hide discovery rows, show only watch list</div>
                    </div>
                    <div 
                      onClick={() => toggleSetting('minimalHome')}
                      style={{ 
                        width: '50px', height: '30px', 
                        background: minimalHome ? '#46d369' : '#333', 
                        borderRadius: '30px', 
                        position: 'relative', 
                        cursor: 'pointer',
                        transition: 'background 0.2s'
                      }}>
                      <div style={{ 
                        width: '26px', height: '26px', 
                        background: '#fff', 
                        borderRadius: '50%', 
                        position: 'absolute', 
                        top: '2px', 
                        left: minimalHome ? '22px' : '2px', 
                        transition: 'left 0.2s' 
                      }} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div>
                      <div style={{ fontSize: '1rem', fontWeight: 500 }}>Autoplay Previews</div>
                      <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Play videos automatically while browsing</div>
                    </div>
                    <div 
                      onClick={() => toggleSetting('autoplay')}
                      style={{ 
                        width: '50px', height: '30px', 
                        background: autoplay ? '#46d369' : '#333', 
                        borderRadius: '30px', 
                        position: 'relative', 
                        cursor: 'pointer',
                        transition: 'background 0.2s'
                      }}>
                      <div style={{ 
                        width: '26px', height: '26px', 
                        background: '#fff', 
                        borderRadius: '50%', 
                        position: 'absolute', 
                        top: '2px', 
                        left: autoplay ? '22px' : '2px', 
                        transition: 'left 0.2s' 
                      }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div>
                      <div style={{ fontSize: '1rem', fontWeight: 500 }}>Haptic Feedback</div>
                      <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>Vibrate when interacting with UI</div>
                    </div>
                    <div 
                      onClick={() => toggleSetting('haptics')}
                      style={{ 
                        width: '50px', height: '30px', 
                        background: haptics ? '#46d369' : '#333', 
                        borderRadius: '30px', 
                        position: 'relative', 
                        cursor: 'pointer',
                        transition: 'background 0.2s'
                      }}>
                      <div style={{ 
                        width: '26px', height: '26px', 
                        background: '#fff', 
                        borderRadius: '50%', 
                        position: 'absolute', 
                        top: '2px', 
                        left: haptics ? '22px' : '2px', 
                        transition: 'left 0.2s' 
                      }} />
                    </div>
                  </div>

                  <div 
                    onClick={handleManualUpdateCheck}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between', 
                      padding: '16px 0',
                      cursor: updateStatus === 'checking' ? 'default' : 'pointer',
                      opacity: updateStatus === 'checking' ? 0.6 : 1
                    }}>
                    <div>
                      <div style={{ fontSize: '1rem', fontWeight: 500 }}>Check for Updates</div>
                      <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>
                        {updateStatus === 'checking' ? 'Checking for updates...' : 
                         updateStatus === 'latest' ? 'You are on the latest version' :
                         updateStatus === 'error' ? 'Check failed. Try again.' :
                         `Current version: v${APP_VERSION}`}
                      </div>
                    </div>
                    <div>
                        {updateStatus === 'checking' ? (
                             <div style={{ width: '20px', height: '20px', border: '2px solid rgba(255,255,255,0.2)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                        ) : (
                             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                        )}
                    </div>
                  </div>

                  <div style={{ marginTop: '32px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '24px' }}>
                    <h3 style={{ fontSize: '0.85rem', color: '#ff4757', marginBottom: '12px', fontWeight: 600, textTransform: 'uppercase' }}>Danger Zone</h3>
                    <button 
                      onClick={async () => {
                        triggerHaptic('heavy');
                        if (confirm('Are you sure you want to DELETE YOUR ACCOUNT? This will permanently remove your profile, friends, watch history, and account data. This action cannot be undone.')) {
                           try {
                             const { error } = await supabase.rpc('delete_account');
                             if (error) throw error;
                             
                             localStorage.clear();
                             window.location.reload();
                           } catch (e) {
                             console.error('Error deleting account:', e);
                             alert('Failed to delete account. Please try again.');
                           }
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '12px',
                        background: 'rgba(255, 71, 87, 0.1)',
                        border: '1px solid rgba(255, 71, 87, 0.3)',
                        borderRadius: '10px',
                        color: '#ff4757',
                        fontWeight: 600,
                        fontSize: '0.9rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                      Delete Account
                    </button>
                    <p style={{ marginTop: '8px', fontSize: '0.75rem', color: '#666', lineHeight: '1.4' }}>
                      Permanently delete your account and all associated data.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* HELP VIEW */}
            {currentView === 'help' && (
              <div style={{ animation: 'fadeIn 0.2s ease-out' }}>
                {renderHeader('Help & Support', () => setCurrentView('main'))}
                 <div style={{ padding: '0 16px 24px' }}>
                    <div style={{ marginBottom: '24px' }}>
                      <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '8px' }}>Frequently Asked Questions</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                         <div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ddd' }}>How do I change my profile?</div>
                            <div style={{ fontSize: '0.85rem', color: '#888', marginTop: '4px' }}>Go back to Settings and tap on your profile card at the top.</div>
                         </div>
                         <div>
                            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#ddd' }}>Is this app free?</div>
                            <div style={{ fontSize: '0.85rem', color: '#888', marginTop: '4px' }}>Yes, Cinemovie is completely free to use.</div>
                         </div>
                      </div>
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '8px' }}>Contact Us</h3>
                      <div style={{ fontSize: '0.9rem', color: '#888' }}>Need more help? Email us at:</div>
                      <a href="mailto:support@cinemovie.app" style={{ color: '#4696ec', textDecoration: 'none', fontSize: '1rem', marginTop: '4px', display: 'block' }}>support@cinemovie.app</a>
                    </div>
                 </div>
              </div>
            )}

            {/* MAIN MENU LIST */}
            {currentView === 'main' && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {menuItems.map((item, index) => (
                  <button
                    key={index}
                    onClick={item.action}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '16px', 
                      background: 'transparent',
                      border: 'none',
                      borderBottom: index < menuItems.length - 1 ? '1px solid rgba(255, 255, 255, 0.08)' : 'none',
                      color: item.danger ? '#ff4757' : '#fff',
                      cursor: 'pointer',
                      width: '100%',
                      textAlign: 'left',
                      minHeight: '56px', // Standard mobile touch target
                      position: 'relative',
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      width: '32px', 
                      height: '32px',
                      borderRadius: '8px',
                      background: item.danger ? 'rgba(255, 71, 87, 0.12)' : 'rgba(255, 255, 255, 0.08)',
                      color: item.danger ? '#ff4757' : 'rgba(255,255,255,0.9)',
                      marginRight: '14px',
                    }}>
                      {React.cloneElement(item.icon as React.ReactElement<any>, { width: 18, height: 18 })}
                    </div>
                    
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.95rem', fontWeight: 500, letterSpacing: '-0.01em' }}>{item.label}</div>
                      {item.subtitle && <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: '1px' }}>{item.subtitle}</div>}
                    </div>
                    
                    {/* Chevron or Info */}
                    <div style={{ opacity: 0.3 }}>
                       {item.label !== 'Sign Out' && icons.chevronRight}
                    </div>
                  </button>
                ))}
              </div>
            )}

          </div>
          
             <div style={{ textAlign: 'center', paddingBottom: '1rem', opacity: 0.5 }}>
                <p style={{ color: '#888', fontSize: '0.7rem', fontFamily: 'monospace', margin: 0 }}>
                  CineMovie App • Build {new Date().getFullYear()}.504
                </p>
             </div>

        </div>
      </div>
    </div>
  );
}
