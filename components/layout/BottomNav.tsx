import React from 'react';
import { COLORS } from '../../constants';
import { triggerHaptic } from '../../utils/haptics';

export type View = 'home' | 'movies' | 'tvshows' | 'newandhot' | 'mylist' | 'settings' | 'schedules';

interface BottomNavProps {
  currentView: View;
  onNavClick: (view: View) => void;
}

const BottomNav = React.memo(function BottomNav({ currentView, onNavClick }: BottomNavProps) {
  const navItems = [
    { 
      id: 'home' as View, 
      label: 'Home',
      icon: (active: boolean) => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? "2.5" : "2"} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          {active && <polyline points="9 22 9 12 15 12 15 22" />}
        </svg>
      )
    },
    { 
      id: 'movies' as View, 
      label: 'Movies',
      icon: (active: boolean) => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? "2.5" : "2"} strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
          <polyline points="17 2 12 7 7 2" />
        </svg>
      )
    },
    { 
      id: 'tvshows' as View, 
      label: 'TV Shows',
      icon: (active: boolean) => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? "2.5" : "2"} strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      )
    },
    { 
      id: 'newandhot' as View, 
      label: 'News', 
      icon: (active: boolean) => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? "2.5" : "2"} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 11a9 9 0 0 1 9 9" /><path d="M4 4a16 16 0 0 1 16 16" /><circle cx="5" cy="19" r="1" />
        </svg>
      )
    },
    { 
      id: 'settings' as View, 
      label: 'Settings',
      icon: (active: boolean) => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? "2.5" : "2"} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"></circle>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2 2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
        </svg>
      )
    }
  ];

  const handleNavClick = (view: View) => {
    triggerHaptic('light');
    onNavClick(view);
  };

  return (
    <nav 
      role="navigation"
      aria-label="Main navigation"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        // Apple-style "Liquid Glass" - Optimized blur for performance
        background: 'rgba(15, 15, 15, 0.75)',
        backdropFilter: 'blur(20px) saturate(180%) brightness(1.2) contrast(0.9)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%) brightness(1.2) contrast(0.9)',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        padding: '6px 10px calc(8px + env(safe-area-inset-bottom, 0px))',
        boxShadow: '0 -10px 30px rgba(0,0,0,0.5), inset 0 1px 1.5px rgba(255, 255, 255, 0.1)',
      }}
    >
      {navItems.map((item) => {
        const isActive = currentView === item.id || (item.id === 'settings' && currentView === 'mylist');
        
        return (
          <button
            key={item.id}
            onClick={() => handleNavClick(item.id)}
            aria-label={item.label}
            aria-current={isActive ? 'page' : undefined}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0px',
              padding: '4px 4px',
              minWidth: '50px',
              width: '20%',
              userSelect: 'none',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <div style={{
              color: isActive ? '#FFFFFF' : 'rgba(255, 255, 255, 0.5)', 
              transition: 'all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)',
              transform: isActive ? 'scale(1.05)' : 'scale(1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {item.icon(isActive)}
            </div>
            
            <span style={{
              fontSize: '8.5px',
              fontWeight: isActive ? 600 : 500,
              color: isActive ? '#FFFFFF' : 'rgba(255, 255, 255, 0.5)', 
              letterSpacing: '0.1px',
              transition: 'all 0.25s ease',
              marginTop: '1px',
            }}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
});

export default BottomNav;
