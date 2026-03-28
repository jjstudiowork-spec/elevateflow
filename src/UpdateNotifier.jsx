/**
 * UpdateNotifier.jsx
 * Checks elevateflow.netlify.app/update.json on launch.
 * Shows a modal if a newer version is available.
 */
import React, { useEffect, useState } from 'react';

const UPDATE_URL   = 'https://api.github.com/repos/jjstudiowork-spec/elevateflow/releases/latest';
const CURRENT_VER  = '0.1.0';

// Simple semver compare: returns true if remote > current
function isNewer(remote, current) {
  const parse = v => v.replace(/[^0-9.]/g, '').split('.').map(Number);
  const [rMaj, rMin, rPatch] = parse(remote);
  const [cMaj, cMin, cPatch] = parse(current);
  if (rMaj !== cMaj) return rMaj > cMaj;
  if (rMin !== cMin) return rMin > cMin;
  return rPatch > cPatch;
}

export function useUpdateCheck() {
  const [update, setUpdate] = useState(null);

  useEffect(() => {
    const check = async () => {
      try {
        const res  = await fetch(UPDATE_URL, {
          headers: { 'Accept': 'application/vnd.github+json' }
        });
        if (!res.ok) return;
        const data = await res.json();
        // GitHub release tag is like "v0.2.0" — strip the v
        const version = (data.tag_name || '').replace(/^v/, '');
        if (version && isNewer(version, CURRENT_VER)) {
          // Find the simple ElevateFlow.dmg asset
          const asset = data.assets?.find(a => a.name === 'ElevateFlow.dmg');
          setUpdate({
            version,
            notes:   data.body || '',
            date:    data.published_at?.split('T')[0] || '',
            url:     asset?.browser_download_url || data.html_url,
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
  const [installing, setInstalling] = useState(false);

  if (!update) return null;

  const handleInstall = async () => {
    setInstalling(true);
    try {
      // Open the DMG download URL in the system browser
      const { open } = await import('@tauri-apps/plugin-opener');
      await open(update.url);
    } catch {}
    // Dismiss after opening
    setTimeout(onDismiss, 1000);
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 99999,
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Arial, sans-serif',
    }}>
      <div style={{
        width: 420, background: '#111115',
        borderRadius: 18, border: '1px solid #1e1e24',
        boxShadow: '0 40px 120px rgba(0,0,0,0.9)',
        overflow: 'hidden',
      }}>
        {/* Gold top bar */}
        <div style={{
          height: 4,
          background: 'linear-gradient(90deg, #D4AF37, #f0d060, #D4AF37)',
        }} />

        <div style={{ padding: '28px 28px 24px' }}>
          {/* Icon + title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14,
              background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
            }}>⬇</div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#e4e4e7' }}>
                Update Available
              </div>
              <div style={{ fontSize: 11, color: '#52525b', marginTop: 3 }}>
                ElevateFlow {update.version} is ready
              </div>
            </div>
          </div>

          {/* Version pill */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '5px 12px', borderRadius: 20, marginBottom: 16,
            background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)',
          }}>
            <span style={{ fontSize: 10, color: '#52525b' }}>
              {CURRENT_VER}
            </span>
            <span style={{ color: '#D4AF37', fontSize: 12 }}>→</span>
            <span style={{ fontSize: 11, fontWeight: 800, color: '#D4AF37' }}>
              {update.version}
            </span>
          </div>

          {/* Release notes */}
          {update.notes && (
            <div style={{
              padding: '12px 14px', borderRadius: 10,
              background: '#0e0e12', border: '1px solid #1a1a22',
              marginBottom: 22,
            }}>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, color: '#2a2a35', marginBottom: 8 }}>
                WHAT'S NEW
              </div>
              <div style={{
                fontSize: 12, color: '#71717a', lineHeight: 1.7,
                whiteSpace: 'pre-wrap',
              }}>
                {update.notes}
              </div>
            </div>
          )}

          {/* Date */}
          {update.date && (
            <div style={{ fontSize: 10, color: '#2a2a35', marginBottom: 20 }}>
              Released {update.date}
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onDismiss} style={{
              flex: 1, height: 42, borderRadius: 10, cursor: 'pointer',
              background: 'transparent', border: '1px solid #1e1e24',
              color: '#52525b', fontSize: 13, fontWeight: 600,
              transition: 'all 0.12s',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#2a2a35'; e.currentTarget.style.color = '#71717a'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e1e24'; e.currentTarget.style.color = '#52525b'; }}
            >
              Remind Me Later
            </button>
            <button onClick={handleInstall} disabled={installing} style={{
              flex: 2, height: 42, borderRadius: 10,
              cursor: installing ? 'not-allowed' : 'pointer',
              background: installing ? 'rgba(212,175,55,0.06)' : 'rgba(212,175,55,0.12)',
              border: `1px solid ${installing ? 'rgba(212,175,55,0.15)' : 'rgba(212,175,55,0.45)'}`,
              color: installing ? '#52525b' : '#D4AF37',
              fontSize: 13, fontWeight: 700, transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}>
              {installing
                ? <><div style={{ width: 12, height: 12, border: '2px solid rgba(212,175,55,0.2)', borderTopColor: '#D4AF37', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Opening…</>
                : <><span>⬇</span> Download Update</>
              }
            </button>
          </div>

          {/* Unsigned app note */}
          <div style={{ marginTop: 12, fontSize: 10, color: '#1e1e24', textAlign: 'center', lineHeight: 1.6 }}>
            After downloading, right-click the app → Open to bypass Gatekeeper
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}