import React, { useState } from 'react';
import { COLORS } from '../../../constants';
import { downloadAndInstallUpdate, openDownloadUrl, DownloadProgress } from '../../../services/updater';

interface UpdateModalProps {
  version: string;
  downloadUrl: string;
  releaseNotes?: string;
  onClose: () => void;
  forceUpdate?: boolean;
}

export default function UpdateModal({ version, downloadUrl, releaseNotes, onClose, forceUpdate }: UpdateModalProps) {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleUpdate = async () => {
    setDownloading(true);
    setError(null);
    
    try {
      const success = await downloadAndInstallUpdate(downloadUrl, (p: DownloadProgress) => {
        setProgress(p.progress);
      });
      
      if (!success) {
        // Fallback to opening URL directly
        openDownloadUrl(downloadUrl);
      }
    } catch (e) {
      setError('Download failed. Opening in browser...');
      setTimeout(() => {
        openDownloadUrl(downloadUrl);
      }, 1500);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 99999,
      background: 'rgba(0, 0, 0, 0.92)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      animation: 'fadeIn 0.3s ease-out',
      padding: '20px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '400px',
        background: '#0a0a0a',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
      }}>
        
        {/* Header */}
        <div style={{
          position: 'relative',
          width: '100%',
          height: '160px',
          background: `linear-gradient(135deg, ${COLORS.primaryDark} 0%, #000 100%)`,
        }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(circle at 30% 30%, rgba(229, 9, 20, 0.4) 0%, transparent 60%)',
          }} />
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </div>
          <div style={{
            position: 'absolute',
            bottom: 0, left: 0, right: 0, height: '60px',
            background: 'linear-gradient(to bottom, transparent 0%, #0a0a0a 100%)',
          }} />
        </div>

        {/* Content */}
        <div style={{ padding: '0 24px 24px', marginTop: '-20px', position: 'relative', zIndex: 2 }}>
          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: '#fff',
            marginBottom: '8px',
            textAlign: 'center',
          }}>
            Update Available
          </h1>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            marginBottom: '16px',
            fontSize: '0.85rem',
            color: '#888',
          }}>
            <span style={{ color: '#46d369', fontWeight: 600 }}>v{version}</span>
            <span>•</span>
            <span>Ready to install</span>
          </div>

          <p style={{
            fontSize: '0.9rem',
            lineHeight: 1.5,
            color: 'rgba(255,255,255,0.7)',
            textAlign: 'center',
            marginBottom: '16px',
          }}>
            A new version is available. Update now for the latest features and fixes.
          </p>

          {releaseNotes && (
            <div style={{
              background: 'rgba(255,255,255,0.04)',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '20px',
              fontSize: '0.8rem',
              color: 'rgba(255,255,255,0.6)',
              maxHeight: '80px',
              overflowY: 'auto',
            }}>
              <div style={{ fontWeight: 600, color: '#fff', marginBottom: '6px', fontSize: '0.7rem', textTransform: 'uppercase' }}>
                What's New
              </div>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>{releaseNotes}</div>
            </div>
          )}

          {/* Progress Bar */}
          {downloading && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{
                height: '4px',
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '2px',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${progress}%`,
                  background: COLORS.primary,
                  transition: 'width 0.2s ease',
                }} />
              </div>
              <p style={{ fontSize: '0.75rem', color: '#888', textAlign: 'center', marginTop: '8px' }}>
                Downloading... {progress}%
              </p>
            </div>
          )}

          {error && (
            <p style={{ fontSize: '0.8rem', color: '#ff6b6b', textAlign: 'center', marginBottom: '12px' }}>
              {error}
            </p>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleUpdate}
              disabled={downloading}
              style={{
                flex: 1,
                padding: '12px',
                backgroundColor: downloading ? '#333' : '#fff',
                color: downloading ? '#888' : '#000',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.95rem',
                fontWeight: 700,
                cursor: downloading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              {downloading ? 'Downloading...' : 'Update Now'}
            </button>

            {!forceUpdate && !downloading && (
              <button
                onClick={onClose}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Later
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
