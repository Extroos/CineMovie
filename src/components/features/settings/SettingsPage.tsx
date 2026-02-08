import React, { useState, useEffect } from 'react';
import { COLORS } from '../../../constants';
import { triggerHaptic } from '../../../utils/haptics';
import { Profile, ProfileService } from '../../../services/profiles';
import { Movie } from '../../../types';
import { getBackdropUrl } from '../../../services/tmdb';
import { SettingsService, AppSettings } from '../../../services/settings';
import { WatchProgressService } from '../../../services/progress';

interface SettingsPageProps {
  onNavigate: (view: any) => void;
  heroBackground: Movie | null;
  activeProfile: Profile | null;
  onSwitchProfile: () => void;
  onLogout: () => void;
  onUpdateFound: (info: any) => void;
}

export default function SettingsPage({ 
  onNavigate, 
  heroBackground, 
  activeProfile, 
  onSwitchProfile, 
  onLogout,
  onUpdateFound
}: SettingsPageProps) {
  const [settings, setSettings] = useState<AppSettings>(SettingsService.getAll());
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(activeProfile?.name || '');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const isMobile = window.innerWidth < 768;

  useEffect(() => {
    const handleSettingsChange = () => {
      setSettings(SettingsService.getAll());
    };
    window.addEventListener('settingsChanged', handleSettingsChange);
    return () => window.removeEventListener('settingsChanged', handleSettingsChange);
  }, []);

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    SettingsService.set(key, value);
    triggerHaptic('light');
  };

  const handleSaveName = async () => {
    if (activeProfile && tempName.trim() && tempName !== activeProfile.name) {
      const success = await ProfileService.updateProfile(activeProfile.id, { name: tempName.trim() });
      if (success) {
        triggerHaptic('medium');
      }
    }
    setIsEditingName(false);
  };

  const handleSelectAvatar = async (avatarUrl: string) => {
    if (activeProfile) {
      const success = await ProfileService.updateProfile(activeProfile.id, { avatar: avatarUrl });
      if (success) {
        triggerHaptic('medium');
        setShowAvatarPicker(false);
      }
    }
  };

  const handleClearHistory = async () => {
    if (window.confirm('Are you sure you want to clear your entire watch history? This cannot be undone.')) {
      const success = await WatchProgressService.clearAllProgress();
      if (success) {
        triggerHaptic('heavy');
        alert('Watch history cleared successfully.');
      }
    }
  };

  const toggleMinimalHome = () => updateSetting('minimalHome', !settings.minimalHome);
  const toggleAutoNext = () => updateSetting('autoNext', !settings.autoNext);
  const toggleDebug = () => updateSetting('debugMode', !settings.debugMode);

  return (
    <div style={{
      minHeight: '100vh',
      background: COLORS.bgPrimary,
      color: '#fff',
      paddingBottom: isMobile ? '100px' : '140px',
      overflowX: 'hidden'
    }}>
      {/* Compact Cinematic Header */}
      <div style={{ 
        position: 'relative', 
        height: isMobile ? '20vh' : '35vh', 
        maxHeight: '350px',
        overflow: 'hidden' 
      }}>
        {heroBackground && (
          <img 
            src={getBackdropUrl(heroBackground.backdropPath, 'original')} 
            alt="" 
            style={{ 
              width: '100%', 
              height: '100%', 
              objectFit: 'cover', 
              opacity: 0.3,
              filter: 'brightness(0.6) contrast(1.2) saturate(1.1)'
            }}
          />
        )}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to bottom, transparent 0%, rgba(10,10,10,0.8) 70%, #0a0a0a 100%)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          padding: isMobile ? '16px 20px' : '40px 5%'
        }}>
          <h1 style={{ 
            margin: 0, 
            fontSize: isMobile ? '2rem' : '3.5rem', 
            fontWeight: 900,
            letterSpacing: '-0.04em'
          }}>Settings</h1>
          <p style={{ 
            margin: '4px 0 0', 
            opacity: 0.4, 
            fontSize: '0.75rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.12em'
          }}>CineMovie Suite v1.4.0</p>
        </div>
      </div>

      <div style={{ 
        padding: '0 5%', 
        marginTop: isMobile ? '-5px' : '-15px',
        position: 'relative',
        zIndex: 10
      }}>
        {/* Profile Card Section */}
        <section style={{ marginBottom: isMobile ? '24px' : '32px' }}>
          <div style={{ 
            background: 'rgba(255,255,255,0.03)', 
            backdropFilter: 'blur(40px) saturate(200%)',
            WebkitBackdropFilter: 'blur(30px) saturate(180%)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: isMobile ? '20px' : '28px', 
            padding: isMobile ? '16px' : '24px',
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? '12px' : '24px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
          }}>
            <div 
              onClick={() => setShowAvatarPicker(true)}
              style={{
                position: 'relative',
                cursor: 'pointer'
              }}
            >
              <img 
                src={activeProfile?.avatar} 
                alt=""
                style={{
                  width: isMobile ? '64px' : '90px',
                  height: isMobile ? '64px' : '90px',
                  borderRadius: '16px',
                  objectFit: 'cover',
                  border: '2px solid rgba(255,255,255,0.1)'
                }}
              />
              <div style={{
                position: 'absolute',
                bottom: '-4px',
                right: '-4px',
                background: COLORS.primary,
                borderRadius: '50%',
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid #000'
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
              </div>
            </div>

            <div style={{ flex: 1 }}>
              {isEditingName ? (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input 
                    autoFocus
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    onBlur={handleSaveName}
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                    style={{
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '8px',
                      color: '#fff',
                      padding: '4px 8px',
                      fontSize: isMobile ? '1rem' : '1.2rem',
                      fontWeight: 700,
                      width: '100%'
                    }}
                  />
                </div>
              ) : (
                <div 
                  onClick={() => { setIsEditingName(true); setTempName(activeProfile?.name || ''); }}
                  style={{ fontWeight: 800, fontSize: isMobile ? '1.2rem' : '1.6rem', letterSpacing: '-0.02em', cursor: 'pointer' }}
                >
                  {activeProfile?.name}
                </div>
              )}
              <div style={{ 
                fontSize: isMobile ? '0.75rem' : '0.85rem', 
                fontWeight: 600,
                opacity: 0.4,
                marginTop: '2px'
              }}>{activeProfile?.isKids ? 'Kids Content Only' : 'Standard Library'} • Member</div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button 
                onClick={onSwitchProfile}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff',
                  padding: '6px 12px',
                  borderRadius: '10px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Switch
              </button>
            </div>
          </div>
        </section>

        {/* Settings Sections */}
        {[
          {
            title: 'Experience',
            settings: [
              { label: 'Minimal UI', sub: 'Simplified home layout', checked: settings.minimalHome, onChange: toggleMinimalHome },
              { label: 'Auto-Next', sub: 'Seamless playback transition', checked: settings.autoNext, onChange: toggleAutoNext }
            ]
          },
          {
            title: 'Appearance',
            items: [
              { 
                label: 'App Theme', 
                sub: 'Select visual style', 
                render: (
                  <select 
                    value={settings.theme}
                    onChange={(e) => updateSetting('theme', e.target.value as any)}
                    style={{
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#fff',
                      padding: '8px 12px',
                      borderRadius: '12px',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      outline: 'none',
                      appearance: 'none',
                      textAlign: 'center'
                    }}
                  >
                    <option value="dark" style={{ background: '#111' }}>Cinematic Dark</option>
                    <option value="amoled" style={{ background: '#000' }}>Deep AMOLED</option>
                    <option value="light" style={{ background: '#fff', color: '#000' }}>Classic Light</option>
                  </select>
                )
              }
            ]
          },
          {
            title: 'Privacy & History',
            items: [
              { 
                label: 'Watch History', 
                sub: 'Remove all progress data', 
                render: (
                  <button 
                    onClick={handleClearHistory}
                    style={{
                      background: 'rgba(229, 9, 20, 0.1)',
                      border: '1px solid rgba(229, 9, 20, 0.2)',
                      color: '#E50914',
                      padding: '6px 12px',
                      borderRadius: '10px',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    Clear All
                  </button>
                )
              }
            ]
          },
          {
            title: 'Technical',
            settings: [
              { label: 'Safe Mode', sub: 'Diagnostic system tools', checked: settings.debugMode, onChange: toggleDebug }
            ]
          }
        ].map((group, idx) => (
          <section key={idx} style={{ marginBottom: isMobile ? '28px' : '36px' }}>
            <h2 style={{ 
              fontSize: isMobile ? '0.7rem' : '0.8rem', 
              textTransform: 'uppercase', 
              color: 'rgba(255,255,255,0.3)', 
              letterSpacing: '0.15em', 
              fontWeight: 800,
              marginBottom: '10px',
              paddingLeft: '6px'
            }}>{group.title}</h2>
            <div style={{ 
              background: 'rgba(255,255,255,0.02)', 
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: isMobile ? '18px' : '24px', 
              overflow: 'hidden',
              backdropFilter: 'blur(20px)'
            }}>
              {(group.settings || []).map((s: any, i: number) => (
                <div key={i} style={{ 
                  padding: isMobile ? '14px 18px' : '18px 24px', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  borderBottom: i === (group.settings?.length || 0) + (group.items?.length || 0) - 1 ? 'none' : '1px solid rgba(255,255,255,0.03)',
                }}>
                  <div style={{ flex: 1, paddingRight: '12px' }}>
                    <div style={{ fontWeight: 700, fontSize: isMobile ? '0.9rem' : '1.05rem', marginBottom: '2px' }}>{s.label}</div>
                    <div style={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{s.sub}</div>
                  </div>
                  <Switch checked={s.checked} onChange={s.onChange} isMobile={isMobile} />
                </div>
              ))}
              {(group.items || []).map((item: any, i: number) => (
                <div key={i} style={{ 
                  padding: isMobile ? '14px 18px' : '18px 24px', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  borderBottom: i === (group.items?.length || 0) - 1 ? 'none' : '1px solid rgba(255,255,255,0.03)',
                }}>
                  <div style={{ flex: 1, paddingRight: '12px' }}>
                    <div style={{ fontWeight: 700, fontSize: isMobile ? '0.9rem' : '1.05rem', marginBottom: '2px' }}>{item.label}</div>
                    <div style={{ fontSize: isMobile ? '0.65rem' : '0.75rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{item.sub}</div>
                  </div>
                  {item.render}
                </div>
              ))}
            </div>
          </section>
        ))}

        <button 
          onClick={() => { triggerHaptic('heavy'); onLogout(); }}
          style={{
            width: '100%',
            background: 'rgba(255, 255, 255, 0.05)',
            color: '#fff',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            padding: isMobile ? '16px' : '20px',
            borderRadius: isMobile ? '16px' : '24px',
            fontWeight: 800,
            fontSize: isMobile ? '0.9rem' : '1rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
        >
          Logout of Cinema
        </button>

        <div style={{ 
          marginTop: '40px', 
          textAlign: 'center', 
          opacity: 0.15, 
          fontSize: '0.65rem',
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.2em'
        }}>
          Automated Excellence • CineMovie High-Density UI
        </div>
      </div>

      {/* Avatar Picker Modal */}
      {showAvatarPicker && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.9)',
          backdropFilter: 'blur(20px)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          padding: '24px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900 }}>Select Avatar</h2>
            <button 
              onClick={() => setShowAvatarPicker(false)}
              style={{ background: 'none', border: 'none', color: '#fff', fontSize: '2rem', cursor: 'pointer' }}
            >
              ×
            </button>
          </div>
          <div style={{ 
            flex: 1, 
            overflowY: 'auto', 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', 
            gap: '12px',
            paddingBottom: '40px'
          }}>
            {Array.from({ length: 67 }).map((_, i) => (
              <img 
                key={i}
                src={`/avatars/avatar-${i + 1}.jpg`}
                alt=""
                onClick={() => handleSelectAvatar(`/avatars/avatar-${i + 1}.jpg`)}
                style={{
                  width: '100%',
                  aspectRatio: '1/1',
                  borderRadius: '12px',
                  objectFit: 'cover',
                  cursor: 'pointer',
                  border: activeProfile?.avatar === `/avatars/avatar-${i + 1}.jpg` ? `3px solid ${COLORS.primary}` : '2px solid transparent'
                }}
              />
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        section { animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); borderRadius: 10px; }
      `}</style>
    </div>
  );
}

function Switch({ checked, onChange, isMobile }: { checked: boolean, onChange: () => void, isMobile?: boolean }) {
  return (
    <div 
      onClick={onChange}
      style={{
        width: isMobile ? '40px' : '50px',
        height: isMobile ? '22px' : '28px',
        background: checked ? COLORS.primary : 'rgba(255,255,255,0.06)',
        borderRadius: '30px',
        position: 'relative',
        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        cursor: 'pointer',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: checked ? `0 0 12px rgba(229, 9, 20, 0.15)` : 'none'
      }}
    >
      <div style={{
        position: 'absolute',
        top: isMobile ? '2px' : '3px',
        left: checked ? (isMobile ? '20px' : '25px') : (isMobile ? '2px' : '3px'),
        width: isMobile ? '16px' : '20px',
        height: isMobile ? '16px' : '20px',
        background: '#fff',
        borderRadius: '50%',
        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {checked && <div style={{ width: '3px', height: '3px', borderRadius: '50%', background: COLORS.primary }} />}
      </div>
    </div>
  );
}
