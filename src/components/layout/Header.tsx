import React, { useState, useEffect } from 'react';
import { Profile } from '../../services/profiles';
import { triggerHaptic } from '../../utils/haptics';

interface HeaderProps {
  onSearchOpen: () => void;
  activeProfile: Profile | null;
  onSwitchProfile: () => void;
}

export default function Header({ onSearchOpen, activeProfile, onSwitchProfile }: HeaderProps) {

  return (
    <header 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 1000,
        height: 'auto', 
        padding: 'calc(16px + env(safe-area-inset-top, 0px)) 16px 16px',
        display: 'flex',
        justifyContent: 'flex-end', 
        gap: '12px',
        background: 'transparent',
        backdropFilter: 'none',
        WebkitBackdropFilter: 'none',
        borderBottom: 'none',
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        pointerEvents: 'none', // Allow clicks to pass through empty space
      }}
    >
        {/* Floating Search Icon */}
        <button
          onClick={() => { triggerHaptic('light'); onSearchOpen(); }}
          aria-label="Search"
          style={{
            background: 'rgba(255, 255, 255, 0.18)',
            backdropFilter: 'blur(15px) saturate(200%)',
            WebkitBackdropFilter: 'blur(15px) saturate(200%)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            color: '#FFFFFF',
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
            boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
            pointerEvents: 'auto',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>

        {/* Profile Avatar */}
        {activeProfile && (
          <button
            onClick={() => { triggerHaptic('light'); onSwitchProfile(); }}
            style={{
              background: 'rgba(255, 255, 255, 0.18)',
              backdropFilter: 'blur(15px) saturate(200%)',
              WebkitBackdropFilter: 'blur(15px) saturate(200%)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              width: '40px',
              height: '40px',
              cursor: 'pointer',
              padding: 0,
              overflow: 'hidden',
              transition: 'all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
              pointerEvents: 'auto',
            }}
          >
            <img 
              src={activeProfile.avatar} 
              alt={activeProfile.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </button>
        )}
    </header>
  );
}
