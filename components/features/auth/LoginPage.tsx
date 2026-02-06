import React, { useState, useEffect } from 'react';
import { triggerHaptic, triggerSuccessHaptic } from '../../../utils/haptics';
import { getTrending } from '../../../services/tmdb';
import { getPosterUrl } from '../../../utils/images';
import { supabase } from '../../../services/supabase';

interface LoginPageProps {
  onLogin: () => void;
}

// Fallback high-quality posters if API fails
const FALLBACK_POSTERS = [
    '/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg', // Shawshank
    '/3bhkrj58Vtu7enYsRolD1fZdja1.jpg', // Godfather
    '/ow3wq89wM8qd5X7hFZkIyCKTX4X.jpg', // 12 Angry Men
    '/1e1t5a712y08Z8PjVP8lI94pS.jpg', // Godfather II
    '/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg', // Spirited Away
    '/lfRkUr7DYdHldAqi3PwdQGBRBPM.jpg', // Schindler's List
    '/rCzpDGLbOoPwLjy3OAm5NUPOtrC.jpg', // LOTR Two Towers
    '/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg', // Pulp Fiction
    '/hm58Jw4Lw8OIeECIq5qyPYhAeRJ.jpg', // LOTR Return of King
    '/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg', // Parasite
];

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState(''); // Success message
  const [backgroundPosters, setBackgroundPosters] = useState<string[]>([]);

  // Fetch dynamic posters on mount
  useEffect(() => {
    const fetchPosters = async () => {
        try {
            const movies = await getTrending('week');
            if (movies && movies.length > 0) {
                // Get poster paths
                const paths = movies.map(m => m.posterPath).filter(Boolean) as string[];
                // Duplicate to fill grid
                setBackgroundPosters([...paths, ...paths, ...paths, ...paths]);
            } else {
                setBackgroundPosters(FALLBACK_POSTERS);
            }
        } catch (e) {
            setBackgroundPosters(FALLBACK_POSTERS);
        }
    };
    fetchPosters();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || (isRegistering && !name)) {
      setError('Please fill in all fields.');
      triggerHaptic('medium');
      return;
    }

    setIsLoading(true);
    triggerHaptic('light');
    setError('');
    setMessage('');

    try {
        if (isRegistering) {
            // Cloud Sign Up
            const { data, error: signUpError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { full_name: name } // Save name to cloud profile
                }
            });
            if (signUpError) throw signUpError;
            
            triggerSuccessHaptic();
            
            // Check if session exists. If not, email confirmation is likely required.
            if (data.user && !data.session) {
                setMessage('Account created! Please check your email to confirm.');
                setIsRegistering(false); // Switch to login view
                setPassword(''); // Clear password for security
            } 
            // If session exists, App.tsx listener handles the login
        } else {
            // Cloud Sign In
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email,
                password
            });
            if (signInError) throw signInError;
            
            triggerSuccessHaptic();
        }
    } catch (err: any) {
        console.error('Auth error:', err);
        setError(err.message || 'Authentication failed');
        triggerHaptic('medium'); // Error haptic
    } finally {
        setIsLoading(false);
    }
  };

  // Determine which list to use (fallback if state is empty yet)
  const displayPosters = backgroundPosters.length > 0 ? backgroundPosters : FALLBACK_POSTERS;
  // Ensure we have enough items for the massive grid
  const finalPosters = displayPosters.length < 50 
    ? [...displayPosters, ...displayPosters, ...displayPosters, ...displayPosters, ...displayPosters] 
    : displayPosters;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
      background: '#0a0a0a',
    }}>
      
      {/* 1. Tilted Poster Grid Background */}
      <div style={{
        position: 'absolute',
        top: '-50%',
        left: '-50%',
        width: '200%',
        height: '200%',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        transform: 'rotate(-12deg) scale(0.9)', 
        opacity: 0.9, 
        zIndex: 0,
        filter: 'blur(3px) brightness(0.7)', 
        justifyContent: 'center',
        alignContent: 'center',
        pointerEvents: 'none',
        background: '#111',
      }}>
        {/* Repeating grid */}
        {finalPosters.slice(0, 90).map((path, i) => (
            <img 
                key={i} 
                src={getPosterUrl(path, 'medium')} // Use helper for valid URL
                alt=""
                style={{
                    width: '140px',
                    height: '210px',
                    borderRadius: '8px',
                    objectFit: 'cover',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                    transition: 'opacity 0.5s ease',
                    backgroundColor: '#1a1a1a', 
                }}
                onError={(e) => {
                    (e.target as HTMLImageElement).style.opacity = '0'; // Hide broken
                }} 
            />
        ))}
      </div>
      
      {/* Dark Gradient Overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        zIndex: 1,
        background: 'radial-gradient(circle at center, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.7) 100%)', 
      }} />

      {/* 2. Floating Content */}
      <div style={{
        position: 'relative',
        zIndex: 10,
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        padding: '2rem 1.5rem',
      }}>
        <div style={{
          width: '100%',
          maxWidth: '380px',
          margin: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          paddingBottom: 'env(safe-area-inset-bottom, 20px)',
        }}>
          
          {/* Logo */}
          <h1 style={{ 
              color: '#fff', 
              fontSize: '3rem', 
              fontWeight: 900, 
              letterSpacing: '-2px',
              marginBottom: '0.2rem',
              textShadow: '0 4px 20px rgba(0,0,0,0.8)',
              textTransform: 'uppercase',
              fontStyle: 'italic', 
          }}>
              CineMovie
          </h1>
          <p style={{ 
              color: 'rgba(255, 255, 255, 0.8)', 
              marginBottom: '3rem', 
              fontSize: '1rem', 
              fontWeight: 500,
              letterSpacing: '0.5px' 
          }}>
              {isRegistering ? 'Start your journey.' : 'Unlimited entertainment.'}
          </p>

          {/* Error */}
          {error && (
              <div style={{
                  width: '100%',
                  background: 'rgba(255, 71, 87, 0.2)',
                  color: '#ff6b6b',
                  padding: '12px',
                  borderRadius: '12px',
                  textAlign: 'center',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  marginBottom: '1.5rem',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 71, 87, 0.3)',
              }}>
                  {error}
              </div>
          )}

          {/* Success Message */}
          {message && (
              <div style={{
                  width: '100%',
                  background: 'rgba(46, 213, 115, 0.2)',
                  color: '#2ed573',
                  padding: '12px',
                  borderRadius: '12px',
                  textAlign: 'center',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  marginBottom: '1.5rem',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(46, 213, 115, 0.3)',
              }}>
                  {message}
              </div>
          )}

          {/* Form */}
          <form onSubmit={handleAuth} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              
              {isRegistering && (
                  <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
                      <input
                          type="text"
                          value={name}
                          onChange={(e) => { setName(e.target.value); setError(''); setMessage(''); }}
                          placeholder="Full Name"
                          style={floatingInputStyle}
                      />
                  </div>
              )}

              <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); setMessage(''); }}
                  placeholder="Email Address"
                  style={floatingInputStyle}
              />

              <input
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); setMessage(''); }}
                  placeholder="Password"
                  style={floatingInputStyle}
              />

              {!isRegistering && (
                   <div style={{ display: 'flex', justifyContent: 'center', marginTop: '-0.5rem' }}>
                      <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>
                          Forgot Password?
                      </span>
                  </div>
              )}

              <button
                  type="submit"
                  disabled={isLoading}
                  style={{
                      background: '#fff',
                      color: '#000',
                      border: 'none',
                      borderRadius: '50px', 
                      padding: '18px',
                      fontSize: '1.1rem',
                      fontWeight: 700,
                      cursor: isLoading ? 'wait' : 'pointer',
                      marginTop: '1rem',
                      transition: 'transform 0.2s',
                      boxShadow: '0 8px 30px rgba(255, 255, 255, 0.2)',
                      width: '100%',
                  }}
                  onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.96)'}
                  onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                  {isLoading ? (isRegistering ? 'Creating...' : 'Signing In...') : (isRegistering ? 'Create Account' : 'Sign In')}
              </button>
          </form>
          
          {/* Toggle Mode */}
          <div style={{ marginTop: '2.5rem', textAlign: 'center' }}>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', margin: '0 0 8px 0' }}>
                  {isRegistering ? 'Already have an account?' : 'New to CineMovie?'}
              </p>
              <button 
                  onClick={() => { triggerHaptic('light'); setIsRegistering(!isRegistering); setError(''); setMessage(''); }}
                  style={{
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.3)',
                      color: '#fff',
                      fontWeight: 600,
                      fontSize: '0.9rem',
                      padding: '8px 20px',
                      cursor: 'pointer',
                      borderRadius: '20px',
                      backdropFilter: 'blur(5px)',
                  }}
              >
                  {isRegistering ? 'Sign In' : 'Create Account'}
              </button>
          </div>

        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        ::placeholder {
            color: rgba(255, 255, 255, 0.5);
        }
      `}</style>
    </div>
  );
}

const floatingInputStyle: React.CSSProperties = {
    width: '100%',
    padding: '16px 20px',
    borderRadius: '16px',
    border: '2px solid rgba(255, 255, 255, 0.15)',
    background: 'rgba(0, 0, 0, 0.4)', // Slightly darker for better legibility over busy background
    color: '#fff',
    fontSize: '1.05rem',
    fontWeight: 500,
    outline: 'none',
    transition: 'all 0.2s ease',
    backdropFilter: 'blur(10px)',
};
