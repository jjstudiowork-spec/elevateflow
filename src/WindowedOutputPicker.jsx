/**
 * WindowedOutputPicker.jsx
 * Shows audience screens in a picker — opens a normal (non-fullscreen) window for that screen.
 */
import React, { useState, useEffect } from 'react';

export default function WindowedOutputPicker({ onClose }) {
  const [screens, setScreens] = useState([]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('ef_screen_assignments') || '{}');
      const audience = (saved.audienceScreens || []).map(s => ({ ...s, role: 'audience' }));
      const stage    = (saved.stageScreens    || []).map(s => ({ ...s, role: 'stage' }));
      setScreens([...audience, ...stage]);
    } catch {}
  }, []);

  const openWindow = async (screen) => {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
    const label = `windowed_${screen.id.replace(/[^a-z0-9]/gi, '_')}`;
    const route = screen.role === 'stage' ? '/stage' : '/audience';
    try {
      const existing = await WebviewWindow.getByLabel(label);
      if (existing) { await existing.show(); await existing.setFocus(); onClose(); return; }
    } catch {}
    new WebviewWindow(label, {
      url: `index.html#${route}`,
      title: screen.name || (screen.role === 'stage' ? 'Stage Output' : 'Audience Output'),
      width:    screen.width  || 1280,
      height:   screen.height || 720,
      resizable: true,
      center: true,
      fullscreen: false,
    });
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(10px)', zIndex: 9999,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Arial, sans-serif',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        width: 380, background: '#111115', borderRadius: 16,
        border: '1px solid #1e1e24', boxShadow: '0 32px 80px rgba(0,0,0,0.9)',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '18px 20px 14px',
          borderBottom: '1px solid #1a1a1e',
          background: 'linear-gradient(180deg, rgba(212,175,55,0.04) 0%, transparent 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#e4e4e7' }}>Windowed Output</div>
            <div style={{ fontSize: 10, color: '#3f3f46', marginTop: 2 }}>Opens a resizable output window</div>
          </div>
          <button onClick={onClose} style={{ width: 26, height: 26, borderRadius: 6, border: '1px solid #1e1e24', background: 'transparent', color: '#3f3f46', cursor: 'pointer', fontSize: 14 }}>×</button>
        </div>

        <div style={{ padding: '12px 16px 16px' }}>
          {screens.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 12, color: '#3f3f46' }}>
              No screens configured. Set up screens in Configure Screens first.
            </div>
          ) : screens.map(screen => (
            <div key={screen.id} onClick={() => openWindow(screen)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                background: '#0e0e12', border: '1px solid #1a1a1e',
                marginBottom: 8, transition: 'all 0.1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(212,175,55,0.25)'; e.currentTarget.style.background = 'rgba(212,175,55,0.04)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#1a1a1e'; e.currentTarget.style.background = '#0e0e12'; }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                background: screen.role === 'stage' ? 'rgba(212,175,55,0.1)' : 'rgba(96,165,250,0.1)',
                border: `1px solid ${screen.role === 'stage' ? 'rgba(212,175,55,0.2)' : 'rgba(96,165,250,0.2)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
              }}>{screen.role === 'stage' ? '🎭' : '📺'}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#e4e4e7' }}>{screen.name}</div>
                <div style={{ fontSize: 10, color: '#3f3f46', marginTop: 2 }}>
                  {screen.role === 'stage' ? 'Stage' : 'Audience'} · {screen.width}×{screen.height}
                </div>
              </div>
              <div style={{ fontSize: 11, color: '#D4AF37' }}>↗</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}