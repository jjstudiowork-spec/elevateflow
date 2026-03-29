/**
 * CloseConfirmWindow.jsx — Beautiful close confirmation dialog
 */
import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';

export default function CloseConfirmWindow() {
  const [visible, setVisible] = useState(false);

  // Fade in on mount
  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  const handleYes = async () => {
    setVisible(false);
    setTimeout(() => invoke('confirm_close'), 200);
  };

  const handleCancel = async () => {
    setVisible(false);
    setTimeout(() => getCurrentWindow().close(), 200);
  };

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", Arial, sans-serif',
    }}>
      <div style={{
        width: 340,
        background: 'rgba(12,12,14,0.96)',
        borderRadius: 20,
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 32px 80px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.04)',
        overflow: 'hidden',
        opacity: visible ? 1 : 0,
        transform: visible ? 'scale(1) translateY(0)' : 'scale(0.94) translateY(8px)',
        transition: 'opacity 0.18s ease, transform 0.18s ease',
        backdropFilter: 'blur(40px)',
      }}>
        {/* Gold accent line */}
        <div style={{
          height: 3,
          background: 'linear-gradient(90deg, transparent, #D4AF37 30%, #f0d060 50%, #D4AF37 70%, transparent)',
        }} />

        <div style={{ padding: '28px 28px 24px' }}>
          {/* Icon */}
          <div style={{
            width: 52, height: 52, borderRadius: 15, marginBottom: 20,
            background: 'rgba(212,175,55,0.08)',
            border: '1px solid rgba(212,175,55,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg viewBox="0 0 24 24" width="26" height="26" fill="none"
              stroke="#D4AF37" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </div>

          {/* Title */}
          <div style={{ fontSize: 17, fontWeight: 700, color: '#f0f0f0', marginBottom: 8 }}>
            Quit ElevateFlow?
          </div>

          {/* Body */}
          <div style={{ fontSize: 13, color: '#555', lineHeight: 1.6, marginBottom: 24 }}>
            All output windows will be closed and your session will end.
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleCancel} style={{
              flex: 1, height: 40, borderRadius: 10,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#888', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.12s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#bbb'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#888'; }}
            >Cancel</button>
            <button onClick={handleYes} style={{
              flex: 1.4, height: 40, borderRadius: 10,
              background: 'rgba(212,175,55,0.12)',
              border: '1px solid rgba(212,175,55,0.35)',
              color: '#D4AF37', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              transition: 'all 0.12s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(212,175,55,0.2)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(212,175,55,0.12)'; }}
            >Quit ElevateFlow</button>
          </div>
        </div>
      </div>
    </div>
  );
}