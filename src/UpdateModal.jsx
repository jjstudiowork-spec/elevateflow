/**
 * UpdateModal.jsx
 * Used with useUpdater() — installs updates in-app via Tauri updater.
 */
import React, { useState, useEffect, useRef } from 'react';

function ReleaseNotes({ notes }) {
  if (!notes) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {notes.split('\n').filter(l => l.trim()).map((line, i) => {
        const isBullet = /^[-•*]\s/.test(line.trim());
        const text = isBullet ? line.trim().slice(2) : line;
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

export default function UpdateModal({ updateInfo, status, progress, error, onInstall, onRemindLater, onSkip }) {
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const isDownloading = status === 'downloading';
  const isInstalling  = status === 'installing';
  const isDone        = status === 'done';
  const isError       = status === 'error';
  const isBusy        = isDownloading || isInstalling;

  const formattedDate = updateInfo.pubDate
    ? new Date(updateInfo.pubDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : '';

  const btnLabel = isDone ? '✓ Installing…'
    : isInstalling ? 'Installing…'
    : isDownloading ? `Downloading… ${Math.round(progress)}%`
    : 'Install Update';

  return (
    <>
      <style>{`
        @keyframes efUpdIn { from{opacity:0;transform:translateY(20px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes efUpdBg { from{opacity:0} to{opacity:1} }
        @keyframes efUpdSlide{0%{left:-40%}100%{left:110%}}
        .ef-upd-card { animation: efUpdIn .35s cubic-bezier(.16,1,.3,1) forwards; }
        .ef-upd-install:not(:disabled):hover { background:rgba(212,175,55,0.22)!important; border-color:rgba(212,175,55,0.7)!important; transform:translateY(-1px); box-shadow:0 6px 24px rgba(212,175,55,0.25)!important; }
        .ef-upd-later:hover { background:rgba(255,255,255,0.07)!important; border-color:rgba(255,255,255,0.18)!important; }
        .ef-upd-skip:hover  { color:#D4AF37!important; }
      `}</style>

      <div style={{
        position: 'fixed', inset: 0, zIndex: 99998,
        background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: 'efUpdBg .25s ease',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Arial, sans-serif',
      }}>
        <div className="ef-upd-card" style={{
          width: 490, borderRadius: 22,
          background: 'linear-gradient(160deg, rgba(18,18,22,0.98) 0%, rgba(10,10,14,0.99) 100%)',
          border: '1px solid rgba(212,175,55,0.2)',
          boxShadow: '0 40px 100px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.06)',
          overflow: 'hidden',
        }}>

          {/* Gold stripe */}
          <div style={{ height: 3, background: 'linear-gradient(90deg, transparent 0%, #D4AF37 40%, #E8C94A 60%, transparent 100%)' }} />

          {/* Header */}
          <div style={{ padding: '26px 28px 0', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14, flexShrink: 0,
              background: 'linear-gradient(135deg, rgba(212,175,55,0.22), rgba(212,175,55,0.06))',
              border: '1px solid rgba(212,175,55,0.28)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#D4AF37" strokeWidth="1.6" strokeLinecap="round">
                <polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/>
                <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/>
              </svg>
            </div>
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
          </div>

          {/* Release notes */}
          {updateInfo.notes && (
            <div style={{
              margin: '20px 28px 0', padding: '14px 16px',
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 10, maxHeight: 160, overflowY: 'auto',
            }}>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.5, color: '#3f3f46', marginBottom: 10 }}>
                WHAT'S NEW
              </div>
              <ReleaseNotes notes={updateInfo.notes} />
            </div>
          )}

          {/* Progress bar */}
          {(isDownloading || isInstalling) && (
            <div style={{ margin: '16px 28px 0' }}>
              <div style={{ width: '100%', height: 4, borderRadius: 2, background: 'rgba(212,175,55,0.12)', overflow: 'hidden', position: 'relative' }}>
                {isInstalling ? (
                  // Indeterminate
                  <div style={{ position: 'absolute', top: 0, height: '100%', width: '40%', background: 'linear-gradient(90deg,transparent,#D4AF37,transparent)', animation: 'efUpdSlide 1.2s linear infinite' }} />
                ) : (
                  // Determinate
                  <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg, #D4AF37, #f7e084)', borderRadius: 2, transition: 'width 0.2s ease' }} />
                )}
              </div>
              <div style={{ fontSize: 11, color: '#52525b', marginTop: 6, textAlign: 'center' }}>
                {isInstalling ? 'Installing update…' : `Downloading ${Math.round(progress)}%`}
              </div>
            </div>
          )}

          {/* Success */}
          {isDone && (
            <div style={{
              margin: '16px 28px 0', padding: '10px 14px',
              background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.18)',
              borderRadius: 8, fontSize: 12, color: '#4ade80', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              ✓ Update installed — ElevateFlow is relaunching…
            </div>
          )}

          {/* Error */}
          {isError && (
            <div style={{
              margin: '16px 28px 0', padding: '10px 14px',
              background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)',
              borderRadius: 8, fontSize: 12, color: '#f87171', fontWeight: 600,
            }}>
              {error || 'Update failed. Please try again.'}
            </div>
          )}

          {/* Buttons */}
          <div style={{ padding: '20px 28px 26px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button className="ef-upd-install" onClick={onInstall} disabled={isBusy || isDone}
              style={{
                height: 46, borderRadius: 12, cursor: isBusy || isDone ? 'not-allowed' : 'pointer',
                background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.45)',
                color: '#D4AF37', fontSize: 14, fontWeight: 800, transition: 'all .15s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                opacity: isBusy || isDone ? 0.65 : 1,
              }}>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/>
                <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/>
              </svg>
              {btnLabel}
            </button>

            {!isBusy && !isDone && (
              <>
                <button className="ef-upd-later" onClick={onRemindLater}
                  style={{
                    height: 42, borderRadius: 12, cursor: 'pointer',
                    background: 'transparent', border: '1px solid rgba(255,255,255,0.09)',
                    color: '#71717a', fontSize: 13, fontWeight: 600, transition: 'all .15s',
                  }}>
                  Remind Me Later
                </button>
                <button className="ef-upd-skip" onClick={onSkip}
                  style={{
                    height: 28, background: 'none', border: 'none',
                    color: '#3f3f46', fontSize: 11, fontWeight: 600,
                    cursor: 'pointer', transition: 'color .15s',
                  }}>
                  Skip This Version
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}