/**
 * UpdateNotifier.jsx
 * Checks GitHub releases for newer version.
 * Shows a stunning modal when an update is available.
 */
import React, { useEffect, useState } from 'react';

const UPDATE_URL  = 'https://api.github.com/repos/jjstudiowork-spec/elevateflow/releases/latest';
const CURRENT_VER  = '0.2.4';

function isNewer(remote, current) {
  const parse = v => v.replace(/[^0-9.]/g, '').split('.').map(Number);
  const [rMaj, rMin, rPat] = parse(remote);
  const [cMaj, cMin, cPat] = parse(current);
  if (rMaj !== cMaj) return rMaj > cMaj;
  if (rMin !== cMin) return rMin > cMin;
  return rPat > cPat;
}

export function useUpdateCheck() {
  const [update, setUpdate] = useState(null);
  useEffect(() => {
    const check = async () => {
      try {
        const res  = await fetch(UPDATE_URL, { headers: { 'Accept': 'application/vnd.github+json' } });
        if (!res.ok) return;
        const data = await res.json();
        const version = (data.tag_name || '').replace(/^v/, '');
        if (version && isNewer(version, CURRENT_VER)) {
          const asset = data.assets?.find(a => a.name === 'ElevateFlow.dmg');
          setUpdate({
            version,
            notes: data.body || '',
            date:  data.published_at?.split('T')[0] || '',
            url:   asset?.browser_download_url || data.html_url,
          });
        }
      } catch {}
    };
    const t = setTimeout(check, 3000);
    return () => clearTimeout(t);
  }, []);
  return [update, () => setUpdate(null)];
}

export default function UpdateNotifier({ update, onDismiss }) {
  const [visible,    setVisible]    = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (update) requestAnimationFrame(() => setVisible(true));
  }, [update]);

  if (!update) return null;

  const dismiss = () => {
    setVisible(false);
    setTimeout(onDismiss, 250);
  };

  const handleInstall = async () => {
    setInstalling(true);
    try {
      const { open } = await import('@tauri-apps/plugin-opener');
      await open(update.url);
    } catch {}
    setTimeout(dismiss, 800);
  };

  // Parse release notes into bullet lines
  const noteLines = update.notes
    ? update.notes.split('\n').map(l => l.trim()).filter(l => l && l !== '#' && l.length > 1)
    : [];

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(16px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.25s ease',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", Arial, sans-serif',
    }}>
      <div style={{
        width: 440,
        background: 'rgba(10,10,12,0.98)',
        borderRadius: 22,
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 48px 120px rgba(0,0,0,0.95), 0 0 0 1px rgba(255,255,255,0.03)',
        overflow: 'hidden',
        transform: visible ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(12px)',
        transition: 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1)',
      }}>

        {/* Animated gold gradient bar */}
        <div style={{
          height: 3,
          background: 'linear-gradient(90deg, transparent 0%, #D4AF37 20%, #f7e084 50%, #D4AF37 80%, transparent 100%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 2s ease infinite',
        }} />

        {/* Glow behind icon */}
        <div style={{
          position: 'absolute', top: 30, left: '50%', transform: 'translateX(-50%)',
          width: 120, height: 120, borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(212,175,55,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ padding: '32px 32px 28px', position: 'relative' }}>

          {/* Icon + badge */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}>
            <div style={{ position: 'relative' }}>
              <div style={{
                width: 64, height: 64, borderRadius: 18,
                background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
              }}>⬇</div>
              {/* Version badge */}
              <div style={{
                position: 'absolute', top: -6, right: -10,
                background: '#D4AF37', borderRadius: 10, padding: '2px 7px',
                fontSize: 9, fontWeight: 800, color: '#000', letterSpacing: 0.5,
                boxShadow: '0 2px 8px rgba(212,175,55,0.5)',
              }}>NEW</div>
            </div>
          </div>

          {/* Title */}
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#f0f0f0', marginBottom: 6, letterSpacing: -0.5 }}>
              Update Available
            </div>

            {/* Version pills */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <div style={{
                padding: '4px 12px', borderRadius: 20,
                background: '#1a1a1e', border: '1px solid #2a2a2e',
                fontSize: 11, color: '#52525b', fontFamily: 'monospace',
              }}>v{CURRENT_VER}</div>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#D4AF37" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
              <div style={{
                padding: '4px 12px', borderRadius: 20,
                background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.3)',
                fontSize: 11, fontWeight: 800, color: '#D4AF37', fontFamily: 'monospace',
              }}>v{update.version}</div>
            </div>
          </div>

          {/* Release notes */}
          {noteLines.length > 0 && (
            <div style={{
              background: '#0d0d10', border: '1px solid #1a1a1e',
              borderRadius: 12, padding: '14px 16px', marginBottom: 22,
              maxHeight: 140, overflowY: 'auto',
            }}>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, color: '#3f3f46', marginBottom: 10 }}>
                WHAT'S NEW
              </div>
              {noteLines.map((line, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 5, fontSize: 12, color: '#71717a', lineHeight: 1.5 }}>
                  <span style={{ color: '#D4AF37', flexShrink: 0, marginTop: 1 }}>·</span>
                  <span>{line.replace(/^[-*•·]\s*/, '')}</span>
                </div>
              ))}
            </div>
          )}

          {update.date && (
            <div style={{ textAlign: 'center', fontSize: 10, color: '#27272a', marginBottom: 20 }}>
              Released {update.date}
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={dismiss} style={{
              flex: 1, height: 44, borderRadius: 12,
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              color: '#52525b', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.12s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = '#a1a1aa'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = '#52525b'; }}
            >
              Remind Me Later
            </button>
            <button onClick={handleInstall} disabled={installing} style={{
              flex: 1.5, height: 44, borderRadius: 12,
              background: installing ? 'rgba(212,175,55,0.06)' : 'rgba(212,175,55,0.14)',
              border: `1px solid ${installing ? 'rgba(212,175,55,0.15)' : 'rgba(212,175,55,0.45)'}`,
              color: installing ? '#52525b' : '#D4AF37',
              fontSize: 13, fontWeight: 700, cursor: installing ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}
              onMouseEnter={e => { if (!installing) e.currentTarget.style.background = 'rgba(212,175,55,0.22)'; }}
              onMouseLeave={e => { if (!installing) e.currentTarget.style.background = 'rgba(212,175,55,0.14)'; }}
            >
              {installing
                ? <><div style={{ width: 14, height: 14, border: '2px solid rgba(212,175,55,0.2)', borderTopColor: '#D4AF37', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} /> Opening…</>
                : <><span style={{ fontSize: 16 }}>⬇</span> Download Update</>
              }
            </button>
          </div>

          {/* Gatekeeper note */}
          <div style={{ marginTop: 12, fontSize: 10, color: '#1e1e24', textAlign: 'center' }}>
            Right-click the app → Open to bypass Gatekeeper on first launch
          </div>
        </div>
      </div>

      <style>{`
        @keyframes shimmer { 0%,100% { background-position: 100% 0; } 50% { background-position: 0% 0; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}