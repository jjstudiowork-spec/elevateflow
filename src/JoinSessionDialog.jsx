/**
 * JoinSessionDialog.jsx
 * Dialog for client to enter host IP address and connect.
 */
import React, { useState } from 'react';

export default function JoinSessionDialog({ onConnect, onClose, clientStatus }) {
  const [address, setAddress] = useState('');
  const isConnecting = clientStatus === 'connecting';
  const isError      = clientStatus === 'error';

  const handleConnect = () => {
    const cleaned = address.trim();
    if (!cleaned) return;
    onConnect(cleaned);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99998,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(16px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Arial, sans-serif',
    }} onClick={e => e.target === e.currentTarget && onClose()}>

      <div style={{
        width: 420, background: 'rgba(12,12,15,0.98)',
        borderRadius: 20, border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 40px 100px rgba(0,0,0,0.9)',
        overflow: 'hidden',
      }}>
        {/* Gold top bar */}
        <div style={{ height: 3, background: 'linear-gradient(90deg, transparent, #D4AF37 30%, #f0d060 50%, #D4AF37 70%, transparent)' }} />

        <div style={{ padding: '28px 28px 24px' }}>
          {/* Icon */}
          <div style={{
            width: 48, height: 48, borderRadius: 14, marginBottom: 20,
            background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#D4AF37" strokeWidth="1.8" strokeLinecap="round">
              <rect x="2" y="3" width="20" height="14" rx="2"/>
              <path d="M8 21h8M12 17v4"/>
              <path d="M9 9l2 2 4-4"/>
            </svg>
          </div>

          <div style={{ fontSize: 18, fontWeight: 800, color: '#f0f0f0', marginBottom: 6 }}>
            Join Presentation Session
          </div>
          <div style={{ fontSize: 12, color: '#52525b', marginBottom: 24, lineHeight: 1.6 }}>
            Enter the host computer's IP address. Find it on the host machine under<br/>
            <strong style={{ color: '#71717a' }}>Presentation Mode → Start Hosting</strong>.
          </div>

          {/* IP input */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.5, color: '#3f3f46', marginBottom: 8 }}>
              HOST IP ADDRESS
            </div>
            <input
              autoFocus
              value={address}
              onChange={e => setAddress(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleConnect()}
              placeholder="e.g. 192.168.1.5"
              style={{
                width: '100%', height: 42, padding: '0 14px',
                background: '#0e0e12', border: `1px solid ${isError ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 10, color: '#e4e4e7', fontSize: 16,
                fontFamily: '"SF Mono", "JetBrains Mono", monospace',
                outline: 'none', letterSpacing: 1, boxSizing: 'border-box',
              }}
            />
            {isError && (
              <div style={{ fontSize: 11, color: '#f87171', marginTop: 6 }}>
                Could not connect. Check the IP address and make sure the host is running.
              </div>
            )}
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} style={{
              flex: 1, height: 42, borderRadius: 10, cursor: 'pointer',
              background: 'transparent', border: '1px solid rgba(255,255,255,0.08)',
              color: '#52525b', fontSize: 13, fontWeight: 600,
            }}>Cancel</button>
            <button onClick={handleConnect} disabled={isConnecting || !address.trim()} style={{
              flex: 1.5, height: 42, borderRadius: 10, cursor: isConnecting ? 'wait' : 'pointer',
              background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.4)',
              color: '#D4AF37', fontSize: 13, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              opacity: isConnecting ? 0.7 : 1,
            }}>
              {isConnecting ? (
                <>
                  <div style={{ width: 14, height: 14, border: '2px solid rgba(212,175,55,0.2)', borderTopColor: '#D4AF37', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  Connecting…
                </>
              ) : 'Connect'}
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}