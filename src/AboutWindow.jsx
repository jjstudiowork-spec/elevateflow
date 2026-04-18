/**
 * AboutWindow.jsx — ElevateFlow About screen
 */
import React, { useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { getVersion } from '@tauri-apps/api/app';
import logo from '../src-tauri/icons/icon-512.png';

export default function AboutWindow() {
  const [version, setVersion] = useState('…');

  useEffect(() => {
    getVersion().then(v => setVersion(v)).catch(() => setVersion('—'));
  }, []);

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", Arial, sans-serif',
      userSelect: 'none',
    }}>
      <div style={{
        width: 340, borderRadius: 20,
        background: 'rgba(10,10,14,0.96)',
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 40px 100px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.04)',
        overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Gold top stripe */}
        <div style={{ height: 3, background: 'linear-gradient(90deg, transparent, #D4AF37 30%, #f0d060 50%, #D4AF37 70%, transparent)' }} />

        {/* Close button */}
        <button
          onClick={() => getCurrentWindow().close()}
          style={{
            position: 'absolute', top: 14, right: 14,
            width: 24, height: 24, borderRadius: '50%',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'rgba(255,255,255,0.4)', fontSize: 13,
            cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            lineHeight: 1, zIndex: 10,
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
        >✕</button>

        {/* Logo + name */}
        <div style={{ padding: '32px 28px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* Glow */}
          <div style={{
            position: 'absolute', top: 30, left: '50%', transform: 'translateX(-50%)',
            width: 140, height: 140, borderRadius: '50%',
            background: 'radial-gradient(ellipse, rgba(212,175,55,0.1) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          <div style={{
            width: 80, height: 80, borderRadius: 22,
            background: 'rgba(212,175,55,0.08)',
            border: '1px solid rgba(212,175,55,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 18, position: 'relative',
            boxShadow: '0 8px 32px rgba(212,175,55,0.12)',
          }}>
            <img src={logo} alt="ElevateFlow" style={{ width: 54, height: 54, borderRadius: 12, objectFit: 'contain' }} />
          </div>

          <div style={{ fontSize: 22, fontWeight: 800, color: '#f0f0f0', letterSpacing: -0.5, marginBottom: 4 }}>
            Elevate<span style={{ color: '#D4AF37' }}>Flow</span>
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 6 }}>
            Worship Presentation Software
          </div>

          {/* Version badge */}
          <div style={{
            padding: '4px 14px', borderRadius: 20, marginBottom: 20,
            background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)',
            fontSize: 11, fontWeight: 700, color: '#D4AF37', letterSpacing: 0.5,
          }}>
            v{version}
          </div>

          {/* Divider */}
          <div style={{ width: '100%', height: 1, background: 'rgba(255,255,255,0.05)', marginBottom: 20 }} />

          {/* Details */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Developer', value: 'KFST' },
              { label: 'Built with', value: 'Tauri v2 + React' },
              { label: 'Platform', value: 'macOS · Windows' },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', fontWeight: 600, letterSpacing: 0.3 }}>{label}</span>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: 700 }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div style={{ width: '100%', height: 1, background: 'rgba(255,255,255,0.05)', margin: '20px 0 14px' }} />

          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.15)', textAlign: 'center' }}>
            © 2025 KFST. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  );
}