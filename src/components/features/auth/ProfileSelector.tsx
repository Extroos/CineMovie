import React, { useState, useEffect } from 'react';
import { Profile, ProfileService } from '../../../services/profiles';
import { triggerHaptic, triggerSuccessHaptic } from '../../../utils/haptics';

interface ProfileSelectorProps {
  onProfileSelected: (profile: Profile) => void;
}

export default function ProfileSelector({ onProfileSelected }: ProfileSelectorProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [addingLoading, setAddingLoading] = useState(false);

  const [missingTables, setMissingTables] = useState(false);
  const [isManaging, setIsManaging] = useState(false);
  const [avatarOptions, setAvatarOptions] = useState<string[]>([]);
  const [selectedAvatar, setSelectedAvatar] = useState<string>('');

  const generateAvatarOptions = () => {
    // Select 6 unique random avatars from 67 available
    const set = new Set<number>();
    while(set.size < 6) {
        set.add(Math.floor(Math.random() * 67) + 1);
    }
    const urls = Array.from(set).map(id => `/avatars/avatar-${id}.jpg`);
    setAvatarOptions(urls);
    setSelectedAvatar(urls[0]);
  };

  useEffect(() => {
    if (isAdding) {
        generateAvatarOptions();
    }
  }, [isAdding]);

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    setLoading(true);
    try {
      const data = await ProfileService.getProfiles();
      setProfiles(data);
    } catch (error: any) {
      if (error.message === 'MISSING_TABLES') {
        setMissingTables(true);
      }
    }
    setLoading(false);
  };
  
  if (missingTables) {
    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: 'rgba(10, 10, 10, 0.7)',
            backdropFilter: 'blur(20px) saturate(220%) brightness(0.9)',
            WebkitBackdropFilter: 'blur(20px) saturate(220%) brightness(0.9)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            color: '#fff',
            overflowY: 'auto'
        }}>
            <div style={{
                maxWidth: '800px',
                width: '100%',
                background: 'rgba(255, 255, 255, 0.05)',
                backdropFilter: 'blur(12px) saturate(160%)',
                WebkitBackdropFilter: 'blur(12px) saturate(160%)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '24px',
                padding: '3rem 2rem',
                boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
                animation: 'slideUpGlass 0.7s cubic-bezier(0.16, 1, 0.3, 1)',
            }}>
                <h1 style={{ color: '#E50914', fontSize: '2rem', marginBottom: '1rem', fontWeight: 800, letterSpacing: '-0.5px' }}>Database Setup Required</h1>
                <p style={{ textAlign: 'left', lineHeight: '1.6', color: 'rgba(255, 255, 255, 0.6)', marginBottom: '2rem', fontSize: '1rem' }}>
                    The application needs to create tables in your Supabase project to function correctly. 
                    Please follow these simple steps to complete the setup:
                </p>
                
                <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                    <ol style={{ marginLeft: '1.5rem', marginBottom: '1.5rem', color: 'rgba(255, 255, 255, 0.9)', lineHeight: '1.8' }}>
                        <li style={{ marginBottom: '0.5rem' }}>Go to your <a href="https://supabase.com/dashboard/project/_/sql" target="_blank" rel="noreferrer" style={{ color: '#E50914', fontWeight: 600, textDecoration: 'none', borderBottom: '1px solid currentColor' }}>Supabase SQL Editor</a>.</li>
                        <li style={{ marginBottom: '0.5rem' }}>Click <strong>"New Query"</strong>.</li>
                        <li style={{ marginBottom: '0.5rem' }}>Paste the SQL code provided below.</li>
                        <li style={{ marginBottom: '0.5rem' }}>Click <strong>"Run"</strong> and ensure success.</li>
                        <li>Refresh this page to start.</li>
                    </ol>
                    
                    <div style={{ position: 'relative' }}>
                        <pre style={{ 
                            background: 'rgba(10, 10, 10, 0.8)', 
                            padding: '1.25rem', 
                            borderRadius: '12px', 
                            overflowX: 'auto', 
                            fontSize: '0.875rem', 
                            color: '#34d399',
                            maxHeight: '300px',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            lineHeight: '1.6',
                            fontFamily: 'monospace'
                        }}>
{`-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. PROFILES TABLE
create table profiles (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  avatar text not null,
  is_kids boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS for Profiles
alter table profiles enable row level security;

create policy "Users can view their own profiles"
  on profiles for select
  using (auth.uid() = user_id);

create policy "Users can insert their own profiles"
  on profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own profiles"
  on profiles for update
  using (auth.uid() = user_id);

create policy "Users can delete their own profiles"
  on profiles for delete
  using (auth.uid() = user_id);

-- 2. MY LIST TABLE
create table my_list (
  id uuid default uuid_generate_v4() primary key,
  profile_id uuid references profiles(id) on delete cascade not null,
  movie_id integer not null, -- TMDB ID
  type text not null check (type in ('movie', 'tv')),
  data jsonb not null,
  added_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(profile_id, movie_id, type)
);

-- RLS for My List
alter table my_list enable row level security;

create policy "Users can view their list via profile"
  on my_list for select
  using (exists (select 1 from profiles where profiles.id = my_list.profile_id and profiles.user_id = auth.uid()));

create policy "Users can insert into their list via profile"
  on my_list for insert
  with check (exists (select 1 from profiles where profiles.id = my_list.profile_id and profiles.user_id = auth.uid()));

create policy "Users can delete from their list via profile"
  on my_list for delete
  using (exists (select 1 from profiles where profiles.id = my_list.profile_id and profiles.user_id = auth.uid()));

-- 3. WATCH PROGRESS TABLE
create table watch_progress (
  id uuid default uuid_generate_v4() primary key,
  profile_id uuid references profiles(id) on delete cascade not null,
  item_id integer not null,
  type text not null check (type in ('movie', 'tv')),
  progress integer not null,
  duration integer not null,
  season_number integer,
  episode_number integer,
  last_watched timestamp with time zone default timezone('utc'::text, now()) not null,
  data jsonb not null,
  unique(profile_id, item_id, type)
);

-- RLS for Watch Progress
alter table watch_progress enable row level security;

create policy "Users can view their progress via profile"
  on watch_progress for select
  using (exists (select 1 from profiles where profiles.id = watch_progress.profile_id and profiles.user_id = auth.uid()));

create policy "Users can insert/update their progress via profile"
  on watch_progress for all
  using (exists (select 1 from profiles where profiles.id = watch_progress.profile_id and profiles.user_id = auth.uid()));
`}
                    </pre>
                    </div>
                </div>
                
                <button 
                    onClick={() => { triggerHaptic('medium'); window.location.reload(); }}
                    style={{
                        marginTop: '2rem',
                        width: '100%',
                        padding: '1rem 2rem',
                        background: '#E50914',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '14px',
                        fontSize: '1.1rem',
                        fontWeight: '800',
                        cursor: 'pointer',
                        boxShadow: '0 8px 24px rgba(229, 9, 20, 0.4)',
                        transition: 'all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02) translateY(-2px)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1) translateY(0)'}
                >
                    I've Run the SQL - Refresh Page
                </button>
            </div>
        </div>
    );
  }

  const handleAddProfile = async () => {
    if (!newProfileName.trim() || addingLoading) return;
    
    setAddingLoading(true);
    triggerSuccessHaptic();
    try {
        const newProfile = await ProfileService.addProfile(newProfileName.trim(), false, selectedAvatar);
        if (newProfile) {
            await loadProfiles();
            setIsAdding(false);
            setNewProfileName('');
        }
    } catch (e) {
        // Fallback for failed add (likely also missing table if not caught by get)
        console.error(e);
    }
    setAddingLoading(false);
  };


  const handleSelect = (profile: Profile) => {
    triggerSuccessHaptic();
    onProfileSelected(profile);
  };

  if (loading) {
     return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            background: '#141414',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#aaa'
        }}>
            <div className="spinner"></div>
            <style>{`.spinner { width: 40px; height: 40px; border: 4px solid #333; border-top-color: #e50914; border-radius: 50%; animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
     );
  }



  const handleDeleteProfile = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this profile? This cannot be undone.')) {
        setLoading(true);
        await ProfileService.deleteProfile(id);
        await loadProfiles();
        setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 10000,
      background: 'rgba(10, 10, 10, 0.7)',
      backdropFilter: 'blur(20px) saturate(210%) brightness(0.9)',
      WebkitBackdropFilter: 'blur(15px) saturate(210%) brightness(0.9)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      animation: 'fadeInGlass 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
      border: '1px solid rgba(255, 255, 255, 0.05)',
    }}>
      {/* Main Profile Selection View */}
      {!isAdding && (
          <>
            <h1 style={{
                color: '#fff',
                fontSize: 'clamp(1.5rem, 5vw, 2.5rem)',
                fontWeight: 500,
                marginBottom: '2rem',
                textAlign: 'center',
            }}>
                {isManaging ? 'Manage Profiles' : "Who's watching?"}
            </h1>

            <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: '1.5rem',
                padding: '0 20px',
                maxWidth: '800px',
            }}>
                {profiles.map((profile) => (
                <div 
                    key={profile.id}
                    onClick={() => !isManaging && handleSelect(profile)}
                    style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.8rem',
                    cursor: isManaging ? 'default' : 'pointer',
                    transition: 'transform 0.2s',
                    position: 'relative',
                    }}
                    className="profile-item"
                >
                    <div style={{
                        position: 'relative',
                        width: 'clamp(90px, 14vw, 150px)', 
                        height: 'clamp(90px, 14vw, 150px)',
                        borderRadius: '8px', 
                        overflow: 'hidden',
                        border: '2px solid transparent',
                        background: 'rgba(255, 255, 255, 0.05)',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                        opacity: (isManaging) ? 0.6 : 1,
                        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                    className="profile-avatar"
                    >
                        <img 
                            src={profile.avatar} 
                            alt={profile.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        
                        {/* Delete Overlay */}
                        {isManaging && (
                            <div 
                                onClick={(e) => handleDeleteProfile(profile.id, e)}
                                style={{
                                    position: 'absolute',
                                    inset: 0,
                                    background: 'rgba(0,0,0,0.5)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    zIndex: 10
                                }}
                            >
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </div>
                        )}

                        {profile.isKids && (
                            <div style={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                background: 'rgba(229, 9, 20, 0.9)',
                                color: '#fff',
                                fontSize: '0.7rem',
                                fontWeight: 'bold',
                                textAlign: 'center',
                                padding: '2px 0',
                            }}>
                                KIDS
                            </div>
                        )}
                    </div>
                    <span style={{
                        color: '#aaa',
                        fontSize: '1rem',
                        fontWeight: 500,
                        transition: 'color 0.2s',
                    }}
                    className="profile-name"
                    >
                        {profile.name}
                    </span>
                </div>
                ))}

                {/* Add Profile Button (Entry Point) */}
                <div 
                    onClick={() => { triggerHaptic('light'); setIsAdding(true); }}
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.8rem',
                        cursor: 'pointer', 
                        opacity: 0.7,
                    }}
                    className="add-profile-btn"
                >
                    <div style={{
                        width: 'clamp(90px, 14vw, 150px)',
                        height: 'clamp(90px, 14vw, 150px)',
                        borderRadius: '8px',
                        background: 'rgba(255,255,255,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '3rem',
                        color: '#fff',
                        transition: 'all 0.2s',
                    }}
                    className="add-icon-container"
                    >
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                    </div>
                    <span style={{ color: '#aaa', fontSize: '1rem', fontWeight: 500 }}>Add Profile</span>
                </div>
            </div>

            {/* Manage Profiles Toggle */}
            {profiles.length > 0 && (
                <button
                    onClick={() => setIsManaging(!isManaging)}
                    style={{
                        marginTop: '3rem',
                        padding: '0.8rem 2rem',
                        background: isManaging ? '#fff' : 'transparent',
                        color: isManaging ? '#000' : '#888',
                        border: '1px solid #888',
                        fontSize: '1rem',
                        cursor: 'pointer',
                        letterSpacing: '2px',
                        textTransform: 'uppercase',
                        transition: 'all 0.2s ease',
                    }}
                    className="manage-btn"
                >
                    {isManaging ? 'Done' : 'Manage Profiles'}
                </button>
            )}
          </>
      )}

      {/* Full Screen Add Profile Overlay */}
      {isAdding && (
          <div style={{
            position: 'fixed',
            inset: 0,
            background: '#000',
            zIndex: 10001,
            display: 'flex',
            flexDirection: 'column',
            animation: 'slideUp 0.3s ease-out',
            overflowY: 'auto'
          }}>
            {/* Header */}
            <div style={{
                padding: '20px',
                display: 'flex',
                alignItems: 'center',
                borderBottom: '1px solid #333'
            }}>
                <div onClick={() => setIsAdding(false)} style={{ padding: '10px', marginLeft: '-10px', cursor: 'pointer' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                        <path d="M19 12H5M12 19l-7-7 7-7"/>
                    </svg>
                </div>
                <h2 style={{ color: '#fff', fontSize: '1.2rem', marginLeft: '10px', flex: 1 }}>Add Profile</h2>
                <button 
                    onClick={handleAddProfile}
                    disabled={addingLoading}
                    style={{ 
                        background: 'transparent', 
                        color: addingLoading ? '#666' : '#E50914', 
                        border: 'none', 
                        fontWeight: 'bold', 
                        fontSize: '1rem',
                        padding: '10px'
                    }}
                >
                    {addingLoading ? 'Saving...' : 'Save'}
                </button>
            </div>

            <div style={{ flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                
                {/* Large Input */}
                <div style={{ width: '100%', maxWidth: '400px', marginBottom: '30px' }}>
                    <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        background: '#333', 
                        borderRadius: '4px',
                        padding: '5px'
                    }}>
                        <div style={{
                            width: '60px',
                            height: '60px',
                            borderRadius: '4px',
                            overflow: 'hidden',
                            marginRight: '15px',
                            flexShrink: 0
                        }}>
                             <img src={selectedAvatar} alt="Current" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                        <input
                            autoFocus
                            type="text"
                            value={newProfileName}
                            onChange={(e) => setNewProfileName(e.target.value)}
                            placeholder="Profile Name"
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#fff',
                                fontSize: '1.2rem',
                                width: '100%',
                                outline: 'none',
                                height: '50px'
                            }}
                        />
                    </div>
                </div>

                {/* Avatar Selection */}
                <div style={{ width: '100%', maxWidth: '400px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <h3 style={{ color: '#ccc', fontSize: '1rem', margin: 0 }}>Choose Icon</h3>
                        <button 
                            onClick={() => { triggerHaptic('light'); generateAvatarOptions(); }}
                            style={{ 
                                background: '#333', 
                                border: 'none', 
                                color: '#fff', 
                                padding: '5px 12px', 
                                borderRadius: '20px', 
                                fontSize: '0.8rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '5px'
                            }}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M23 4v6h-6M1 20v-6h6"/> 
                                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                            </svg>
                            Shuffle
                        </button>
                    </div>

                    <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(3, 1fr)', 
                        gap: '15px',
                        paddingBottom: '40px' // Space for scroll
                    }}>
                        {avatarOptions.map((url, index) => (
                            <div 
                                key={index}
                                onClick={() => { triggerHaptic('light'); setSelectedAvatar(url); }}
                                style={{
                                    aspectRatio: '1/1',
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                    position: 'relative',
                                    cursor: 'pointer',
                                    transition: 'transform 0.1s',
                                    transform: selectedAvatar === url ? 'scale(1.05)' : 'scale(1)',
                                    boxShadow: selectedAvatar === url ? '0 0 0 3px #fff' : 'none'
                                }}
                            >
                                <img src={url} alt={`Option ${index}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                {selectedAvatar === url && (
                                    <div style={{
                                        position: 'absolute',
                                        inset: 0,
                                        background: 'rgba(0,0,0,0.2)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <div style={{
                                            width: '24px',
                                            height: '24px',
                                            background: '#fff',
                                            borderRadius: '50%',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="4">
                                                <polyline points="20 6 9 17 4 12"></polyline>
                                            </svg>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

            </div>
          </div>
      )}

      <style>{`
        @keyframes fadeInGlass {
          from { opacity: 0; transform: scale(1.05); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes slideUpGlass {
          from { transform: translateY(30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .profile-avatar:hover {
            border-color: #fff !important;
        }
        .add-icon-container:hover {
            background: rgba(255,255,255,0.2) !important;
        }
        div:hover .profile-item .profile-name {
            color: #fff !important;
        }
        .manage-btn:hover {
            background: rgba(255, 255, 255, 0.1) !important;
            border-color: #fff !important;
            color: #fff !important;
        }
      `}</style>
    </div>
  );
}
