/**
 * Production.jsx — Production Dashboard
 * A beautiful launcher for your production links.
 * Each link opens in its own floating WebviewWindow.
 */
import React, { useState, useEffect, useRef } from 'react';

const STORAGE_KEY = 'ef_production_links';

// ── Helpers ──────────────────────────────────────────────────────
function normalizeUrl(url) {
  if (!url) return '';
  if (!url.match(/^https?:\/\//)) return 'https://' + url;
  return url;
}

function getDomain(url) {
  try { return new URL(normalizeUrl(url)).hostname.replace('www.', ''); }
  catch { return url; }
}

function faviconUrl(url) {
  try {
    const domain = new URL(normalizeUrl(url)).origin;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  } catch { return null; }
}

// ── Open link in its own window ──────────────────────────────────
async function openLink(link) {
  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
  const label = 'prod_' + link.id;
  try {
    const existing = await WebviewWindow.getByLabel(label);
    if (existing) { await existing.show(); await existing.setFocus(); return; }
  } catch {}
  new WebviewWindow(label, {
    url: normalizeUrl(link.url),
    title: link.label,
    width: 1280, height: 860,
    resizable: true, center: true,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  });
}

// ── Add Link Modal ───────────────────────────────────────────────
function AddModal({ onAdd, onClose }) {
  const [label, setLabel] = useState('');
  const [url,   setUrl]   = useState('');
  const urlRef = useRef(null);

  const submit = () => {
    if (!url.trim()) return;
    const norm  = normalizeUrl(url.trim());
    const lbl   = label.trim() || getDomain(norm);
    onAdd({ id: Date.now().toString(), label: lbl, url: norm });
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, backdropFilter: 'blur(8px)',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        width: 400, background: '#111115', borderRadius: 16,
        border: '1px solid #1e1e24', boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
        padding: 28,
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#e4e4e7', marginBottom: 22 }}>
          Add Link
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, color: '#3f3f46', marginBottom: 7 }}>URL</div>
          <input
            ref={urlRef} autoFocus
            value={url} onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="https://..."
            style={{
              width: '100%', height: 38, padding: '0 12px', boxSizing: 'border-box',
              background: '#0e0e12', border: '1px solid #1e1e24',
              borderRadius: 8, color: '#e4e4e7', fontSize: 13, outline: 'none',
              fontFamily: 'system-ui',
            }}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, color: '#3f3f46', marginBottom: 7 }}>LABEL (optional)</div>
          <input
            value={label} onChange={e => setLabel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="My Site"
            style={{
              width: '100%', height: 38, padding: '0 12px', boxSizing: 'border-box',
              background: '#0e0e12', border: '1px solid #1e1e24',
              borderRadius: 8, color: '#e4e4e7', fontSize: 13, outline: 'none',
              fontFamily: 'system-ui',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{
            flex: 1, height: 38, borderRadius: 8, cursor: 'pointer',
            background: 'transparent', border: '1px solid #1e1e24',
            color: '#52525b', fontSize: 13, fontWeight: 600,
          }}>Cancel</button>
          <button onClick={submit} disabled={!url.trim()} style={{
            flex: 2, height: 38, borderRadius: 8, cursor: url.trim() ? 'pointer' : 'not-allowed',
            background: url.trim() ? 'rgba(212,175,55,0.12)' : 'transparent',
            border: `1px solid ${url.trim() ? 'rgba(212,175,55,0.4)' : '#1e1e24'}`,
            color: url.trim() ? '#D4AF37' : '#3f3f46', fontSize: 13, fontWeight: 700,
          }}>Add Link</button>
        </div>
      </div>
    </div>
  );
}

// ── Link Card ─────────────────────────────────────────────────────
function LinkCard({ link, onOpen, onDelete, onEdit, onOpenInline }) {
  const [hovered, setHovered]   = useState(false);
  const [imgError, setImgError] = useState(false);
  const favicon = faviconUrl(link.url);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onOpen(link)}
      style={{
        position: 'relative',
        background: hovered ? '#18181e' : '#111115',
        border: `1px solid ${hovered ? '#2a2a35' : '#1a1a22'}`,
        borderRadius: 14, padding: '22px 20px 18px',
        cursor: 'pointer', transition: 'all 0.15s',
        boxShadow: hovered ? '0 8px 32px rgba(0,0,0,0.4)' : '0 2px 8px rgba(0,0,0,0.2)',
        transform: hovered ? 'translateY(-2px)' : 'none',
        display: 'flex', flexDirection: 'column', gap: 12,
        userSelect: 'none',
      }}
    >
      {/* Action buttons */}
      {hovered && (
        <div style={{
          position: 'absolute', top: 10, right: 10,
          display: 'flex', gap: 4,
        }} onClick={e => e.stopPropagation()}>
          <button onClick={() => onOpenInline(link)} title="Open in main window" style={{
            height: 24, padding: '0 8px', borderRadius: 6,
            background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)',
            color: '#D4AF37', cursor: 'pointer', fontSize: 9, fontWeight: 800,
            display: 'flex', alignItems: 'center', gap: 3,
          }}>
            <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg>
            In App
          </button>
          <button onClick={() => onEdit(link)} style={{
            width: 24, height: 24, borderRadius: 6,
            background: 'rgba(255,255,255,0.06)', border: '1px solid #222',
            color: '#555', cursor: 'pointer', fontSize: 11,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✎</button>
          <button onClick={() => onDelete(link.id)} style={{
            width: 24, height: 24, borderRadius: 6,
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            color: '#f87171', cursor: 'pointer', fontSize: 13,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>×</button>
        </div>
      )}

      {/* Favicon */}
      <div style={{
        width: 44, height: 44, borderRadius: 12,
        background: '#0e0e12', border: '1px solid #1a1a22',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', flexShrink: 0,
      }}>
        {favicon && !imgError ? (
          <img src={favicon} width={28} height={28}
            onError={() => setImgError(true)}
            style={{ objectFit: 'contain' }}
          />
        ) : (
          <span style={{ fontSize: 20 }}>🔗</span>
        )}
      </div>

      {/* Text */}
      <div>
        <div style={{
          fontSize: 13, fontWeight: 700, color: '#e4e4e7',
          marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{link.label}</div>
        <div style={{
          fontSize: 10, color: '#3f3f46',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{getDomain(link.url)}</div>
      </div>

      {/* Open indicator */}
      {hovered && (
        <div style={{
          fontSize: 9, fontWeight: 800, letterSpacing: 1.5, color: '#D4AF37',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <span>↗</span> OPEN
        </div>
      )}
    </div>
  );
}

// ── Edit Modal ───────────────────────────────────────────────────
function EditModal({ link, onSave, onClose }) {
  const [label, setLabel] = useState(link.label);
  const [url,   setUrl]   = useState(link.url);

  const submit = () => {
    if (!url.trim()) return;
    onSave({ ...link, label: label.trim() || getDomain(url), url: normalizeUrl(url.trim()) });
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, backdropFilter: 'blur(8px)',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        width: 400, background: '#111115', borderRadius: 16,
        border: '1px solid #1e1e24', boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
        padding: 28,
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#e4e4e7', marginBottom: 22 }}>Edit Link</div>
        {[['LABEL', label, setLabel, 'My Site'], ['URL', url, setUrl, 'https://...']].map(([lbl, val, set, ph]) => (
          <div key={lbl} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, color: '#3f3f46', marginBottom: 7 }}>{lbl}</div>
            <input autoFocus={lbl === 'LABEL'} value={val} onChange={e => set(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()}
              placeholder={ph}
              style={{ width: '100%', height: 38, padding: '0 12px', boxSizing: 'border-box', background: '#0e0e12', border: '1px solid #1e1e24', borderRadius: 8, color: '#e4e4e7', fontSize: 13, outline: 'none', fontFamily: 'system-ui', marginBottom: 0 }}
            />
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button onClick={onClose} style={{ flex: 1, height: 38, borderRadius: 8, cursor: 'pointer', background: 'transparent', border: '1px solid #1e1e24', color: '#52525b', fontSize: 13, fontWeight: 600 }}>Cancel</button>
          <button onClick={submit} style={{ flex: 2, height: 38, borderRadius: 8, cursor: 'pointer', background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.4)', color: '#D4AF37', fontSize: 13, fontWeight: 700 }}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────
export default function Production() {
  const [links,    setLinks]    = useState(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch { return []; }
  });
  const [adding,   setAdding]   = useState(false);
  const [editing,  setEditing]  = useState(null);
  const [search,     setSearch]     = useState('');
  const [inlineUrl,   setInlineUrl]   = useState(null);
  const [inlineTitle, setInlineTitle] = useState('');

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
  }, [links]);

  const addLink  = (link) => setLinks(p => [...p, link]);
  const delLink  = (id)   => setLinks(p => p.filter(l => l.id !== id));
  const saveEdit = (link) => setLinks(p => p.map(l => l.id === link.id ? link : l));

  const filtered = links.filter(l =>
    !search || l.label.toLowerCase().includes(search.toLowerCase()) || getDomain(l.url).includes(search.toLowerCase())
  );

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: '#0a0a0c',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Arial, sans-serif',
      color: '#e4e4e7',
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 28px 16px',
        background: 'linear-gradient(180deg, rgba(212,175,55,0.04) 0%, transparent 100%)',
        borderBottom: '1px solid #141418',
        display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#e4e4e7', display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#D4AF37" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
            Production
          </div>
          <div style={{ fontSize: 10, color: '#3f3f46', marginTop: 2 }}>
            {links.length} link{links.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Search */}
        {links.length > 4 && (
          <div style={{ position: 'relative' }}>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              style={{
                width: 180, height: 32, padding: '0 10px 0 30px',
                background: '#111115', border: '1px solid #1e1e24',
                borderRadius: 8, color: '#e4e4e7', fontSize: 12, outline: 'none',
              }}
            />
            <svg style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
              viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#3f3f46" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
            </svg>
          </div>
        )}

        {/* Add button */}
        <button onClick={() => setAdding(true)} style={{
          height: 34, padding: '0 16px', borderRadius: 9, cursor: 'pointer',
          background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.3)',
          color: '#D4AF37', fontSize: 12, fontWeight: 700,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Add Link
        </button>
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
        {links.length === 0 ? (
          /* Empty state */
          <div style={{
            height: '100%', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 16,
          }}>
            <div style={{
              width: 72, height: 72, borderRadius: 20,
              background: '#111115', border: '1px solid #1e1e24',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#2a2a35" strokeWidth="1.5">
                <rect x="2" y="3" width="20" height="14" rx="2"/>
                <path d="M8 21h8M12 17v4"/>
              </svg>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#27272a', marginBottom: 6 }}>No links yet</div>
              <div style={{ fontSize: 12, color: '#1e1e24' }}>Add your production sites to get started</div>
            </div>
            <button onClick={() => setAdding(true)} style={{
              height: 38, padding: '0 20px', borderRadius: 9, cursor: 'pointer',
              background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.25)',
              color: '#D4AF37', fontSize: 13, fontWeight: 700, marginTop: 4,
            }}>+ Add your first link</button>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 14,
          }}>
            {filtered.map(link => (
              <LinkCard key={link.id} link={link}
                onOpen={openLink}
                onDelete={delLink}
                onEdit={setEditing}
                onOpenInline={link => { setInlineUrl(link.url); setInlineTitle(link.label); }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Inline browser */}
      {inlineUrl && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          display: 'flex', flexDirection: 'column',
          background: '#0a0a0c',
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Arial, sans-serif',
        }}>
          {/* Browser bar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 12px', background: '#111115',
            borderBottom: '1px solid #1a1a1e', flexShrink: 0,
          }}>
            <button onClick={() => setInlineUrl(null)} style={{
              height: 28, padding: '0 12px', borderRadius: 6, cursor: 'pointer',
              background: 'transparent', border: '1px solid #1e1e24',
              color: '#71717a', fontSize: 12, fontWeight: 600,
            }}>← Back</button>
            <div style={{
              flex: 1, height: 28, background: '#0e0e12', border: '1px solid #1e1e24',
              borderRadius: 6, display: 'flex', alignItems: 'center',
              padding: '0 10px', fontSize: 11, color: '#52525b', overflow: 'hidden',
            }}>{inlineUrl}</div>
            <span style={{ fontSize: 11, color: '#3f3f46', fontWeight: 600 }}>{inlineTitle}</span>
          </div>
          {/* Embedded webview */}
          <webview
            key={inlineUrl}
            src={inlineUrl}
            style={{ flex: 1, width: '100%', border: 'none' }}
            allowpopups="true"
            useragent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
          />
        </div>
      )}

      {/* Modals */}
      {adding  && <AddModal  onAdd={addLink} onClose={() => setAdding(false)} />}
      {editing && <EditModal link={editing} onSave={saveEdit} onClose={() => setEditing(null)} />}
    </div>
  );
}