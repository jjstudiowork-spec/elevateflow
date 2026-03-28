/**
 * UpdateModal.jsx
 * Shown when useUpdater() detects a newer version is available.
 *
 * Props:
 *   updateInfo    — { version, notes, pubDate, downloadUrl, gatekeeperCommand }
 *   onRemindLater — snoozes 24 hours
 *   onSkip        — permanently skips this version
 */

import React, { useState, useEffect, useRef } from 'react';

// Renders release notes: supports **bold**, - bullet points, plain lines
function ReleaseNotes({ notes }) {
  if (!notes) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {notes.split('\n').filter(l => l.trim()).map((line, i) => {
        const isBullet = /^[-•*]\s/.test(line.trim());
        const text = isBullet ? line.trim().slice(2) : line;
        // Render **bold** inline
        const parts = text.split(/\*\*(.+?)\*\*/g);
        const rendered = parts.map((p, j) =>
          j % 2 === 1
            ? <strong key={j} style={{ color: '#e4e4e7', fontWeight: 700 }}>{p}</strong>
            : <span key={j}>{p}</span>
        );
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: '#a1a1aa', lineHeight: 1.6 }}>
            {isBullet && <span style={{ color: '#D4AF37', marginTop: 3, flexShrink: 0, fontSize: 7 }}>◆</span>}
            <span>{rendered}</span>
          </div>
        );
      })}
    </div>
  );
}

function IndeterminateBar() {
  return (
    <>
      <style>{`@keyframes efUpdSlide{0%{left:-40%}100%{left:110%}}`}</style>
      <div style={{ width: '100%', height: 3, borderRadius: 2, background: 'rgba(212,175,55,0.12)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, height: '100%', width: '40%', background: 'linear-gradient(90deg,transparent,#D4AF37,transparent)', borderRadius: 2, animation: 'efUpdSlide 1.2s linear infinite' }} />
      </div>
    </>
  );
}

export default function UpdateModal({ updateInfo, onRemindLater, onSkip }) {
  const [phase,  setPhase]  = useState('idle'); // idle | opening | done
  const [copied, setCopied] = useState(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const handleInstall = async () => {
    setPhase('opening');
    try {
      // Try Tauri's opener first, fall back to window.open
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('open_url', { url: updateInfo.downloadUrl }).catch(async () => {
        try {
          const { open } = await import('@tauri-apps/plugin-opener');
          await open(updateInfo.downloadUrl);
        } catch {
          window.open(updateInfo.downloadUrl, '_blank');
        }
      });
    } catch {
      window.open(updateInfo.downloadUrl, '_blank');
    }
    if (mounted.current) setPhase('done');
  };

  const copyCommand = async () => {
    try {
      await navigator.clipboard.writeText(updateInfo.gatekeeperCommand);
      setCopied(true);
      setTimeout(() => { if (mounted.current) setCopied(false); }, 2000);
    } catch {}
  };

  const formattedDate = updateInfo.pubDate
    ? new Date(updateInfo.pubDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '';

  return (
    <>
      <style>{`
        @keyframes efUpdIn { from{opacity:0;transform:translateY(20px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes efUpdBg { from{opacity:0} to{opacity:1} }
        .ef-upd-card    { animation: efUpdIn .35s cubic-bezier(.16,1,.3,1) forwards; }
        .ef-upd-install { transition: all .15s ease !important; }
        .ef-upd-install:not(:disabled):hover { background:rgba(212,175,55,0.22)!important; border-color:rgba(212,175,55,0.7)!important; transform:translateY(-1px); box-shadow:0 6px 24px rgba(212,175,55,0.25)!important; }
        .ef-upd-later:hover { background:rgba(255,255,255,0.07)!important; border-color:rgba(255,255,255,0.18)!important; }
        .ef-upd-skip:hover  { color:#D4AF37!important; }
        .ef-upd-copy:hover  { background:rgba(212,175,55,0.12)!important; border-color:rgba(212,175,55,0.4)!important; }
      `}</style>

      {/* Backdrop */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 99998,
        background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'efUpdBg .25s ease',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Arial, sans-serif',
      }}>

        {/* Card */}
        <div className="ef-upd-card" style={{
          width: 490, borderRadius: 22,
          background: 'linear-gradient(160deg, rgba(18,18,22,0.98) 0%, rgba(10,10,14,0.99) 100%)',
          border: '1px solid rgba(212,175,55,0.2)',
          boxShadow: '0 40px 100px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.06)',
          overflow: 'hidden',
        }}>

          {/* Gold top stripe */}
          <div style={{ height: 3, background: 'linear-gradient(90deg, transparent 0%, #D4AF37 40%, #E8C94A 60%, transparent 100%)' }} />

          {/* Header */}
          <div style={{ padding: '26px 28px 0', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            {/* Icon */}
            <div style={{
              width: 52, height: 52, borderRadius: 14, flexShrink: 0,
              background: 'linear-gradient(135deg, rgba(212,175,55,0.22), rgba(212,175,55,0.06))',
              border: '1px solid rgba(212,175,55,0.28)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#D4AF37" strokeWidth="1.6" strokeLinecap="round">
                <polyline points="8 17 12 21 16 17"/>
                <line x1="12" y1="12" x2="12" y2="21"/>
                <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/>
              </svg>
            </div>

            {/* Title */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.8, color: '#D4AF37', marginBottom: 5 }}>
                UPDATE AVAILABLE
              </div>
              <div style={{ fontSize: 21, fontWeight: 800, color: '#f4f4f5', letterSpacing: -0.4 }}>
                ElevateFlow {updateInfo.version}
              </div>
              {formattedDate && (
                <div style={{ fontSize: 11, color: '#52525b', marginTop: 3 }}>Released {formattedDate}</div>
              )}
            </div>

            {/* Current version */}
            <div style={{
              padding: '3px 9px', borderRadius: 6, flexShrink: 0,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              fontSize: 10, color: '#3f3f46', fontWeight: 600, marginTop: 2,
            }}>
              Current: 0.1.0
            </div>
          </div>

          {/* Release notes */}
          {updateInfo.notes && (
            <div style={{
              margin: '20px 28px 0', padding: '14px 16px',
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 10, maxHeight: 170, overflowY: 'auto',
            }}>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.5, color: '#3f3f46', marginBottom: 10 }}>
                WHAT'S NEW
              </div>
              <ReleaseNotes notes={updateInfo.notes} />
            </div>
          )}

          {/* Gatekeeper notice — always shown since the app is unsigned */}
          <div style={{
            margin: '16px 28px 0', padding: '12px 14px',
            background: 'rgba(212,175,55,0.05)', border: '1px solid rgba(212,175,55,0.15)',
            borderRadius: 10,
          }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: '#D4AF37', marginBottom: 8,
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#D4AF37" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              macOS — UNSIGNED APP
            </div>
            <div style={{ fontSize: 11, color: '#71717a', lineHeight: 1.65, marginBottom: 10 }}>
              After installing, drag <strong style={{ color: '#a1a1aa' }}>ElevateFlow.app</strong> to your Applications folder, then run this command in Terminal so macOS lets it open:
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <code style={{
                flex: 1, padding: '7px 10px', borderRadius: 7,
                background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.08)',
                fontSize: 11, color: '#a1a1aa', fontFamily: '"SF Mono","JetBrains Mono","Fira Code",monospace',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {updateInfo.gatekeeperCommand}
              </code>
              <button className="ef-upd-copy" onClick={copyCommand} style={{
                height: 32, padding: '0 12px', borderRadius: 7,
                background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                color: copied ? '#4ade80' : '#71717a',
                fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
                transition: 'all .15s', whiteSpace: 'nowrap',
              }}>
                {copied ? '✓ Copied' : '⌘ Copy'}
              </button>
            </div>
          </div>

          {/* Indeterminate bar while browser is opening */}
          {phase === 'opening' && (
            <div style={{ padding: '14px 28px 0' }}>
              <IndeterminateBar />
              <div style={{ fontSize: 11, color: '#52525b', marginTop: 8, textAlign: 'center' }}>
                Opening download in your browser…
              </div>
            </div>
          )}

          {/* Success state */}
          {phase === 'done' && (
            <div style={{
              margin: '14px 28px 0', padding: '10px 14px',
              background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.18)',
              borderRadius: 8, fontSize: 11, color: '#4ade80', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span>✓</span> Download opened. Install the .dmg, then run the command above in Terminal.
            </div>
          )}

          {/* Action buttons */}
          <div style={{ padding: '20px 28px 26px', display: 'flex', flexDirection: 'column', gap: 8 }}>

            {/* Install Update */}
            <button
              className="ef-upd-install"
              onClick={handleInstall}
              disabled={phase === 'opening'}
              style={{
                height: 46, borderRadius: 12,
                cursor: phase === 'opening' ? 'wait' : 'pointer',
                background: 'rgba(212,175,55,0.12)',
                border: '1px solid rgba(212,175,55,0.45)',
                color: '#D4AF37', fontSize: 14, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                opacity: phase === 'opening' ? 0.65 : 1,
              }}
            >
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="8 17 12 21 16 17"/>
                <line x1="12" y1="12" x2="12" y2="21"/>
                <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/>
              </svg>
              {phase === 'done' ? 'Download Opened ✓' : 'Install Update'}
            </button>

            {/* Remind Me Later */}
            <button
              className="ef-upd-later"
              onClick={onRemindLater}
              style={{
                height: 42, borderRadius: 12, cursor: 'pointer',
                background: 'transparent', border: '1px solid rgba(255,255,255,0.09)',
                color: '#71717a', fontSize: 13, fontWeight: 600, transition: 'all .15s',
              }}
            >
              Remind Me Later
            </button>

            {/* Skip this version */}
            <button
              className="ef-upd-skip"
              onClick={onSkip}
              style={{
                height: 28, background: 'none', border: 'none',
                color: '#3f3f46', fontSize: 11, fontWeight: 600,
                cursor: 'pointer', transition: 'color .15s',
              }}
            >
              Skip This Version
            </button>

          </div>
        </div>
      </div>
    </>
  );
}