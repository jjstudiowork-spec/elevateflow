/**
 * HostingBanner.jsx
 * Shown on host screen when Presentation Mode is active.
 * Displays IP address and connection count so operators on client machines can connect.
 */
import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

export default function HostingBanner({ hostInfo, onStop }) {
  const [copied, setCopied] = useState(false);

  const ip = hostInfo?.ip || '…';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ip);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div style={{
      position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
      zIndex: 9000,
      background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(20px)',
      border: '1px solid rgba(0,232,122,0.25)',
      borderRadius: 14, padding: '10px 16px',
      display: 'flex', alignItems: 'center', gap: 14,
      boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,232,122,0.1)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Arial, sans-serif',
      userSelect: 'none',
    }}>
      {/* Live dot */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#00e87a', boxShadow: '0 0 8px #00e87a' }} />
        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.5, color: '#00e87a' }}>HOSTING</span>
      </div>

      <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.08)' }} />

      {/* IP */}
      <div>
        <div style={{ fontSize: 9, color: '#3f3f46', fontWeight: 700, letterSpacing: 1, marginBottom: 2 }}>CLIENT IP TO USE</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: '#e4e4e7', fontFamily: '"SF Mono", monospace', letterSpacing: 1 }}>{ip}</div>
      </div>

      {/* Copy */}
      <button onClick={copy} style={{
        height: 28, padding: '0 12px', borderRadius: 7, cursor: 'pointer',
        background: copied ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.06)',
        border: `1px solid ${copied ? 'rgba(74,222,128,0.3)' : 'rgba(255,255,255,0.1)'}`,
        color: copied ? '#4ade80' : '#71717a',
        fontSize: 11, fontWeight: 700, transition: 'all 0.15s',
      }}>
        {copied ? '✓ Copied' : 'Copy'}
      </button>

      <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.08)' }} />

      {/* Stop */}
      <button onClick={onStop} style={{
        height: 28, padding: '0 12px', borderRadius: 7, cursor: 'pointer',
        background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
        color: '#f87171', fontSize: 11, fontWeight: 700,
      }}>Stop</button>
    </div>
  );
}