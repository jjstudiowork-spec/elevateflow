/**
 * Toolbar/Toolbar.jsx
 * Liquid glass toolbar — merges with macOS titlebar via titleBarStyle: overlay
 * Traffic lights sit at left: 12px so we pad 84px from left.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  launchOutputWindow, closeOutputWindow,
  isOutputOpen, isNdiOutput, loadAssignments,
} from '../../utils/outputManager';

// ── Built-in themes ────────────────────────────────────────────
const BUILTIN_THEMES = [
  { id: 'classic-white', name: 'Classic White', fontFamily: 'Arial, sans-serif',    fontSize: 6, fontWeight: 800, textColor: '#ffffff', transform: 'none',      italic: false, lineSpacing: 1.2 },
  { id: 'bold-gold',     name: 'Bold Gold',     fontFamily: 'Arial, sans-serif',    fontSize: 7, fontWeight: 800, textColor: '#D4AF37', transform: 'uppercase', italic: false, lineSpacing: 1.1 },
  { id: 'thin-modern',   name: 'Thin Modern',   fontFamily: 'Inter, sans-serif',    fontSize: 5, fontWeight: 400, textColor: '#ffffff', transform: 'uppercase', italic: false, lineSpacing: 1.4 },
  { id: 'script-style',  name: 'Script Style',  fontFamily: 'Georgia, serif',       fontSize: 6, fontWeight: 400, textColor: '#ffffff', transform: 'none',      italic: true,  lineSpacing: 1.3 },
  { id: 'impact-caps',   name: 'Impact Caps',   fontFamily: "'Impact', sans-serif", fontSize: 8, fontWeight: 800, textColor: '#ffffff', transform: 'uppercase', italic: false, lineSpacing: 1.0 },
  { id: 'red-verse',     name: 'Red Verse',     fontFamily: 'Arial, sans-serif',    fontSize: 6, fontWeight: 800, textColor: '#ef4444', transform: 'none',      italic: false, lineSpacing: 1.2 },
  { id: 'blue-light',    name: 'Blue Light',    fontFamily: 'Inter, sans-serif',    fontSize: 5, fontWeight: 400, textColor: '#60a5fa', transform: 'none',      italic: false, lineSpacing: 1.3 },
  { id: 'green-glow',    name: 'Green Glow',    fontFamily: 'Arial, sans-serif',    fontSize: 6, fontWeight: 800, textColor: '#00e87a', transform: 'uppercase', italic: false, lineSpacing: 1.1 },
];

const THEME_STORAGE_KEY = 'elevateflow_custom_themes';
function loadCustomThemes() {
  try { return JSON.parse(localStorage.getItem(THEME_STORAGE_KEY) || '[]'); } catch { return []; }
}
function saveCustomThemes(themes) {
  try { localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(themes)); } catch {}
}

// ── Theme preview card ─────────────────────────────────────────
function ThemeCard({ theme, onApply, onDelete, isCustom, onEdit }) {
  const [hovered, setHovered] = useState(false);
  const previewText = theme.text || 'AMAZING\nGRACE';
  return (
    <div className="theme-card"
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      onClick={() => onApply(theme)} title={`Apply "${theme.name}"`}
    >
      <div className="theme-card__preview" style={{ background: '#000', position: 'relative', overflow: 'hidden', containerType: 'inline-size' }}>
        <div style={{
          position: 'absolute', left: `${theme.x ?? 50}%`, top: `${theme.y ?? 50}%`,
          width: `${theme.width ?? 70}%`, height: `${theme.height ?? 40}%`,
          transform: 'translate(-50%, -50%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        }}>
          <span style={{
            fontFamily: theme.fontFamily || 'Arial, sans-serif',
            fontSize: `${theme.fontSize || 6}cqw`, fontWeight: theme.fontWeight || 800,
            color: theme.textColor || '#fff', fontStyle: theme.italic ? 'italic' : 'normal',
            textTransform: theme.transform || 'none', lineHeight: theme.lineSpacing || 1.2,
            textAlign: 'center', whiteSpace: 'pre-wrap', display: 'block', overflow: 'hidden',
            textDecoration: [theme.underline && 'underline', theme.strikethrough && 'line-through'].filter(Boolean).join(' ') || 'none',
          }}>{previewText}</span>
        </div>
      </div>
      <div className="theme-card__label">
        <span className="theme-card__name">{theme.name}</span>
        {isCustom && hovered && (
          <div style={{ display: 'flex', gap: 2 }}>
            <button className="theme-card__edit" title="Edit theme" onClick={e => { e.stopPropagation(); onEdit?.(); }}>✎</button>
            <button className="theme-card__delete" title="Delete theme" onClick={e => { e.stopPropagation(); onDelete(theme.id); }}>×</button>
          </div>
        )}
        {isCustom && !hovered && <span className="theme-card__badge">Custom</span>}
      </div>
    </div>
  );
}

// ── Themes panel ───────────────────────────────────────────────
function ThemesPanel({ state, dispatch, onClose, updateSlideStyle, selectedSlide }) {
  const [customThemes, setCustomThemes] = useState(loadCustomThemes);
  const [themeName, setThemeName]       = useState('');
  const [editingTheme, setEditingTheme] = useState(null);

  const applyTheme = useCallback((theme) => {
    if (!selectedSlide) return;
    const keys = ['fontFamily','fontSize','fontWeight','textColor','transform','italic','underline','strikethrough','lineSpacing','x','y','width','height'];
    const updates = {};
    keys.forEach(k => { if (theme[k] !== undefined) updates[k] = theme[k]; });
    dispatch({ type: 'APPLY_THEME_TO_ALL', payload: updates });
    onClose();
  }, [selectedSlide, dispatch, onClose]);

  const saveCurrentAsTheme = useCallback(() => {
    if (!selectedSlide) return;
    const name = themeName.trim() || 'My Theme';
    if (editingTheme) {
      const next = customThemes.map(t => t.id === editingTheme.id
        ? { ...t, name, text: selectedSlide.text?.split('\n').slice(0,2).join('\n') || 'Sample',
            fontFamily: selectedSlide.fontFamily || 'Arial, sans-serif', fontSize: selectedSlide.fontSize || 6,
            fontWeight: selectedSlide.fontWeight || 800, textColor: selectedSlide.textColor || '#ffffff',
            transform: selectedSlide.transform || 'none', italic: selectedSlide.italic || false,
            underline: selectedSlide.underline || false, strikethrough: selectedSlide.strikethrough || false,
            lineSpacing: selectedSlide.lineSpacing || 1.2,
            x: selectedSlide.x, y: selectedSlide.y, width: selectedSlide.width, height: selectedSlide.height,
          } : t
      );
      setCustomThemes(next); saveCustomThemes(next); setEditingTheme(null);
    } else {
      const newTheme = {
        id: `custom-${Date.now()}`, name,
        text: selectedSlide.text?.split('\n').slice(0,2).join('\n') || 'Sample',
        fontFamily: selectedSlide.fontFamily || 'Arial, sans-serif', fontSize: selectedSlide.fontSize || 6,
        fontWeight: selectedSlide.fontWeight || 800, textColor: selectedSlide.textColor || '#ffffff',
        transform: selectedSlide.transform || 'none', italic: selectedSlide.italic || false,
        underline: selectedSlide.underline || false, strikethrough: selectedSlide.strikethrough || false,
        lineSpacing: selectedSlide.lineSpacing || 1.2,
        x: selectedSlide.x, y: selectedSlide.y, width: selectedSlide.width, height: selectedSlide.height,
      };
      const next = [...customThemes, newTheme];
      setCustomThemes(next); saveCustomThemes(next);
    }
    setThemeName('');
  }, [selectedSlide, customThemes, themeName, editingTheme]);

  const deleteTheme = useCallback((id) => {
    const next = customThemes.filter(t => t.id !== id);
    setCustomThemes(next); saveCustomThemes(next);
    if (editingTheme?.id === id) setEditingTheme(null);
  }, [customThemes, editingTheme]);

  const startEdit = (theme) => { setEditingTheme(theme); setThemeName(theme.name); };

  return (
    <div className="themes-panel">
      <div className="themes-panel__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ThemesIcon />
          <span className="themes-panel__title">THEMES</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button onClick={() => { onClose(); dispatch({ type: 'SET_MODE', payload: 'theme-editor' }); }}
            style={{ height: 24, padding: '0 10px', borderRadius: 5, cursor: 'pointer',
              background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.3)',
              color: '#D4AF37', fontSize: 10, fontWeight: 800 }}>+ Add Theme</button>
          <button className="themes-panel__close" onClick={onClose}>✕</button>
        </div>
      </div>

      {!selectedSlide && <div className="themes-panel__hint">Select a slide to apply a theme</div>}

      <div className="themes-panel__section-label">BUILT-IN</div>
      <div className="themes-panel__grid">
        {BUILTIN_THEMES.map(t => (
          <ThemeCard key={t.id} theme={t} onApply={applyTheme} isCustom={false} onDelete={() => {}} />
        ))}
      </div>

      {customThemes.length > 0 && (
        <>
          <div className="themes-panel__section-label">CUSTOM</div>
          <div className="themes-panel__grid">
            {customThemes.map(t => (
              <ThemeCard key={t.id} theme={t} onApply={applyTheme} isCustom
                onDelete={deleteTheme} onEdit={() => startEdit(t)} isEditing={editingTheme?.id === t.id} />
            ))}
          </div>
        </>
      )}

      <div className="themes-panel__save">
        <div className="themes-panel__section-label">
          {editingTheme ? `EDITING "${editingTheme.name.toUpperCase()}"` : 'SAVE CURRENT STYLE AS THEME'}
          {editingTheme && (
            <button onClick={() => { setEditingTheme(null); setThemeName(''); }}
              style={{ marginLeft: 8, fontSize: 10, color: '#555', background: 'none', border: 'none', cursor: 'pointer' }}>
              cancel
            </button>
          )}
        </div>
        <div className="themes-panel__save-row">
          <input className="themes-panel__save-input"
            placeholder={editingTheme ? editingTheme.name : 'Theme name…'}
            value={themeName} onChange={e => setThemeName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveCurrentAsTheme()} />
          <button className="themes-panel__save-btn" onClick={saveCurrentAsTheme} disabled={!selectedSlide}>
            {editingTheme ? 'Update' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Output button ──────────────────────────────────────────────
function OutputButton({ role, label, assignments }) {
  const [live, setLive] = useState(() => isOutputOpen(role));
  const [enabled, setEnabled] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('ef_screen_assignments') || '{}');
      return saved[role === 'audience' ? 'audienceEnabled' : 'stageEnabled'] !== false;
    } catch { return true; }
  });

  useEffect(() => {
    const id = setInterval(() => setLive(isOutputOpen(role)), 1000);
    return () => clearInterval(id);
  }, [role]);

  useEffect(() => {
    const handler = () => {
      try {
        const saved = JSON.parse(localStorage.getItem('ef_screen_assignments') || '{}');
        setEnabled(saved[role === 'audience' ? 'audienceEnabled' : 'stageEnabled'] !== false);
      } catch {}
    };
    window.addEventListener('storage', handler);
    window.addEventListener('ef-screens-updated', handler);
    return () => { window.removeEventListener('storage', handler); window.removeEventListener('ef-screens-updated', handler); };
  }, [role]);

  const hasScreen = !!assignments[role];
  const handleClick = useCallback(async () => {
    if (!enabled) return;
    if (live) { await closeOutputWindow(role); setLive(false); }
    else {
      const r = await launchOutputWindow(role);
      if (r.ok) {
        setLive(true);
        setTimeout(async () => {
          const payload = window._efCurrentPayload;
          if (payload) {
            try { const { emitTo } = await import('@tauri-apps/api/event'); await emitTo('*', 'audience-update', payload); } catch {}
          }
        }, 900);
      }
    }
  }, [live, role, enabled]);

  return (
    <button
      className={['toolbar-output-btn', live ? 'toolbar-output-btn--live' : '', !hasScreen ? 'toolbar-output-btn--unassigned' : '', !enabled ? 'toolbar-output-btn--disabled' : ''].join(' ').trim()}
      onClick={handleClick}
      title={!enabled ? `${label} disabled` : !hasScreen ? `No screen for ${label}` : live ? `${label} LIVE — click to close` : `Open ${label}`}
    >
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <MonitorIcon live={live} hasScreen={hasScreen && enabled} />
        <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: 0.5 }}>{label.toUpperCase()}</span>
      </span>
      {live && enabled && <span className="toolbar-output-btn__dot" />}
      {live && isNdiOutput(role) && <span style={{ fontSize: 7, color: '#00e87a', fontWeight: 800 }}>NDI</span>}
      {!enabled && <span style={{ fontSize: 7, color: '#333' }}>OFF</span>}
    </button>
  );
}

// ── Account button ─────────────────────────────────────────────
function AccountButton() {
  const [user,  setUser]  = React.useState(() => { try { return JSON.parse(localStorage.getItem('ef_user')); } catch { return null; } });
  const [hover, setHover] = React.useState(false);
  React.useEffect(() => {
    const h = (e) => setUser(e.detail);
    window.addEventListener('ef-auth-changed', h);
    return () => window.removeEventListener('ef-auth-changed', h);
  }, []);
  const openAccount = () => {
    import('@tauri-apps/api/webviewWindow').then(({ WebviewWindow }) => {
      new WebviewWindow('account', { url: 'index.html#/account', width: 400, height: 560, title: 'ElevateFlow Account', resizable: false, center: true }).catch(() => {});
    });
  };
  const initials = user?.nickname?.[0]?.toUpperCase() || '?';
  return (
    <button onClick={openAccount} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      title={user ? `${user.nickname} — account` : 'Sign in'}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
        height: 46, width: 46, padding: '4px 6px', borderRadius: 10, cursor: 'pointer',
        background: hover ? 'rgba(255,255,255,0.1)' : 'transparent', border: 'none',
        transition: 'all 0.15s', WebkitAppRegion: 'no-drag',
      }}
    >
      <div style={{
        width: 22, height: 22, borderRadius: '50%',
        background: user?.photoURL ? 'transparent' : 'rgba(212,175,55,0.15)',
        border: '1.5px solid rgba(212,175,55,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
      }}>
        {user?.photoURL
          ? <img src={user.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontSize: 10, fontWeight: 800, color: '#D4AF37', lineHeight: 1 }}>{initials}</span>
        }
      </div>
      <span style={{ fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: 0.3 }}>
        {user ? 'ACCOUNT' : 'SIGN IN'}
      </span>
    </button>
  );
}

// ── More menu ──────────────────────────────────────────────────
function MoreMenu({ mode, dispatch }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  const moreItems = [{ id: 'theme-editor', label: 'Theme Editor', icon: '✦' }];
  const active = moreItems.some(m => m.id === mode);

  React.useEffect(() => {
    if (!open) return;
    const h = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const openYouTubeMusic = async () => {
    setOpen(false);
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
    try { const w = await WebviewWindow.getByLabel('youtubemusic'); if (w) { await w.show(); await w.setFocus(); return; } } catch {}
    try { new WebviewWindow('youtubemusic', { url: 'https://music.youtube.com', width: 1100, height: 760, title: 'YouTube Music', resizable: true, center: true, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36' }); } catch {}
  };

  const openProduction = async () => {
    setOpen(false);
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
    try { const w = await WebviewWindow.getByLabel('production'); if (w) { await w.show(); await w.setFocus(); return; } } catch {}
    try { new WebviewWindow('production', { url: 'index.html#/production', width: 1200, height: 800, title: 'Production', resizable: true, center: true }); } catch {}
  };

  const actionStyle = {
    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 12px', borderRadius: 8, background: 'transparent',
    border: 'none', color: '#71717a', fontSize: 12, fontWeight: 600,
    cursor: 'pointer', textAlign: 'left', fontFamily: 'system-ui, Arial', transition: 'all 0.1s',
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className={`toolbar__mode-btn ${active ? 'toolbar__mode-btn--active' : ''}`}
        onClick={() => setOpen(p => !p)} title="More">
        <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
            <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
          </svg>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.5 }}>More</span>
        </span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(14,14,16,0.98)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 12, padding: 6, minWidth: 180, zIndex: 500,
          boxShadow: '0 16px 48px rgba(0,0,0,0.8)', backdropFilter: 'blur(20px)',
        }}>
          {moreItems.map(item => (
            <button key={item.id}
              onClick={() => { dispatch({ type: 'SET_MODE', payload: item.id }); setOpen(false); }}
              style={{ ...actionStyle, background: mode === item.id ? 'rgba(212,175,55,0.12)' : 'transparent', color: mode === item.id ? '#D4AF37' : '#bbb' }}
              onMouseEnter={e => { if (mode !== item.id) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
              onMouseLeave={e => { if (mode !== item.id) e.currentTarget.style.background = 'transparent'; }}
            ><span>{item.icon}</span><span>{item.label}</span></button>
          ))}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 8px' }} />
          <button onClick={openYouTubeMusic} style={actionStyle}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#e4e4e7'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#71717a'; }}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="#ff0000"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
            <span>YouTube Music</span>
          </button>
          <button onClick={openProduction} style={actionStyle}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#e4e4e7'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#71717a'; }}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="#D4AF37" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
            <span>Production</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ── Tiny icons ─────────────────────────────────────────────────
function SyncDot({ active }) {
  return <span style={{ width: 7, height: 7, borderRadius: '50%', display: 'inline-block', background: active ? '#00ff88' : 'rgba(255,255,255,0.2)', boxShadow: active ? '0 0 6px #00ff88' : 'none' }} />;
}
function ThemesIcon() {
  return <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 0 20"/><path d="M2 12h20"/><path d="M12 2c-2.5 2.5-4 6-4 10s1.5 7.5 4 10"/></svg>;
}
function ShowIcon()  { return <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>; }
function EditIcon()  { return <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>; }
function StageIcon() { return <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>; }
function FlowIcon()  { return <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="15" y2="18"/></svg>; }
function MonitorIcon({ live, hasScreen }) {
  const color = live ? '#00ff88' : hasScreen ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.25)';
  return <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>;
}
function MediaBinIcon() {
  return <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><path d="M7 8l3 3 3-3 3 3"/></svg>;
}
function ScreensIcon() {
  return <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><circle cx="12" cy="10" r="2"/></svg>;
}

// ── MAIN TOOLBAR ───────────────────────────────────────────────
export default function Toolbar({ state, dispatch, selectedSlide, updateSlideStyle, onImportEf, onTextImport, onToggleAI, showAI, activeSong, showMediaBin, onToggleMediaBin }) {
  const { mode, isSynced } = state;
  const [assignments, setAssignments] = useState(loadAssignments);
  const [showThemes,  setShowThemes]  = useState(false);
  const themesRef = useRef(null);

  useEffect(() => {
    const refresh = () => setAssignments(loadAssignments());
    window.addEventListener('focus', refresh);
    const id = setInterval(refresh, 3000);
    return () => { window.removeEventListener('focus', refresh); clearInterval(id); };
  }, []);

  useEffect(() => {
    if (!showThemes) return;
    const handler = (e) => { if (themesRef.current && !themesRef.current.contains(e.target)) setShowThemes(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showThemes]);

  // ── Glass pill button helper ───────────────────────────────────
  const pill = (active = false) => ({
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: 2, padding: '4px 12px', height: 46, minWidth: 46,
    borderRadius: 10, border: 'none', cursor: 'pointer', transition: 'all 0.15s',
    background: active
      ? 'linear-gradient(160deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.06) 100%)'
      : 'transparent',
    color: active ? '#fff' : 'rgba(255,255,255,0.38)',
    fontSize: 9, fontWeight: 700, letterSpacing: 0.4,
    boxShadow: active ? 'inset 0 1px 0 rgba(255,255,255,0.2), 0 2px 8px rgba(0,0,0,0.2)' : 'none',
    WebkitAppRegion: 'no-drag',
  });

  // ── Glass group container ──────────────────────────────────────
  const glassGroup = {
    display: 'flex', alignItems: 'center', gap: 2,
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.11)',
    borderRadius: 14, padding: '5px 5px',
    backdropFilter: 'blur(20px) saturate(160%)',
    WebkitBackdropFilter: 'blur(20px) saturate(160%)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -1px 0 rgba(0,0,0,0.1), 0 4px 16px rgba(0,0,0,0.2)',
    WebkitAppRegion: 'no-drag',
  };

  return (
    // data-tauri-drag-region makes the whole bar draggable; buttons opt out with no-drag
    <header className="toolbar" data-tauri-drag-region style={{ position: 'relative', WebkitAppRegion: 'drag' }}>

      {/* ── LEFT: tool pill groups ── */}
      <div className="toolbar__left" style={{ gap: 10 }}>

        {/* Group 1: Theme · Import · AI */}
        <div style={glassGroup}>
          {/* Theme */}
          <button onClick={() => setShowThemes(p => !p)} title="Themes"
            style={{ ...pill(showThemes), color: showThemes ? '#D4AF37' : 'rgba(255,255,255,0.38)',
              background: showThemes ? 'rgba(212,175,55,0.18)' : 'transparent',
              boxShadow: showThemes ? 'inset 0 1px 0 rgba(212,175,55,0.2), 0 2px 8px rgba(0,0,0,0.2)' : 'none',
            }}
            onMouseEnter={e => { if (!showThemes) e.currentTarget.style.color = 'rgba(255,255,255,0.75)'; }}
            onMouseLeave={e => { if (!showThemes) e.currentTarget.style.color = 'rgba(255,255,255,0.38)'; }}
          >
            <ThemesIcon /><span>Theme</span>
          </button>

          {/* Text Import */}
          <button onClick={onTextImport} title="Text Import" style={pill(false)}
            onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.75)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.38)'; }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
            </svg>
            <span>Import</span>
          </button>

          {/* AI */}
          <button onClick={onToggleAI} title="AI Assistant"
            style={{ ...pill(showAI), color: showAI ? '#D4AF37' : 'rgba(255,255,255,0.38)',
              background: showAI ? 'rgba(212,175,55,0.18)' : 'transparent',
            }}
            onMouseEnter={e => { if (!showAI) e.currentTarget.style.color = 'rgba(255,255,255,0.75)'; }}
            onMouseLeave={e => { if (!showAI) e.currentTarget.style.color = 'rgba(255,255,255,0.38)'; }}
          >
            <span style={{ fontSize: 15, lineHeight: 1 }}>✦</span><span>AI</span>
          </button>
        </div>

        {/* Group 2: Media · Sync · Screens */}
        <div style={glassGroup}>
          <button onClick={onToggleMediaBin} title="Media Bin" style={pill(showMediaBin)}
            onMouseEnter={e => { if (!showMediaBin) e.currentTarget.style.color = 'rgba(255,255,255,0.75)'; }}
            onMouseLeave={e => { if (!showMediaBin) e.currentTarget.style.color = 'rgba(255,255,255,0.38)'; }}
          >
            <MediaBinIcon /><span>Media</span>
          </button>
          <button onClick={() => dispatch({ type: 'TOGGLE_SYNC_PANEL' })} title="Network Sync"
            style={{ ...pill(isSynced), color: isSynced ? '#00ff88' : 'rgba(255,255,255,0.38)' }}
            onMouseEnter={e => { if (!isSynced) e.currentTarget.style.color = 'rgba(255,255,255,0.75)'; }}
            onMouseLeave={e => { if (!isSynced) e.currentTarget.style.color = 'rgba(255,255,255,0.38)'; }}
          >
            <SyncDot active={isSynced} /><span>Sync</span>
          </button>
          <button title="Configure Screens" style={pill(false)}
            onClick={() => import('@tauri-apps/api/webviewWindow').then(({ WebviewWindow }) => {
              new WebviewWindow('configurescreens', { url: 'index.html#/configure-screens', width: 1100, height: 700, title: 'Configure Screens', resizable: true, center: true });
            })}
            onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.75)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.38)'; }}
          >
            <ScreensIcon /><span>Screens</span>
          </button>
        </div>
      </div>

      {/* ── CENTER: Mode switcher glass pill ── */}
      <div className="toolbar__center">
        <div className="toolbar__mode-group">
          {[
            { id: 'show',  label: 'Show',  icon: <ShowIcon />  },
            { id: 'edit',  label: 'Edit',  icon: <EditIcon />  },
            { id: 'stage', label: 'Stage', icon: <StageIcon /> },
            { id: 'flow',  label: 'Flow',  icon: <FlowIcon />  },
          ].map(({ id, label, icon }) => (
            <button key={id}
              className={`toolbar__mode-btn ${mode === id ? 'toolbar__mode-btn--active' : ''}`}
              onClick={() => dispatch({ type: 'SET_MODE', payload: id })}
            >
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                {icon}<span>{label}</span>
              </span>
            </button>
          ))}
          <MoreMenu mode={mode} dispatch={dispatch} />
        </div>
      </div>

      {/* ── RIGHT: Output buttons + account ── */}
      <div className="toolbar__right" style={{ gap: 8 }}>
        {/* Output buttons — each is its own glass pill */}
        <div style={{ display: 'flex', gap: 5 }}>
          <OutputButton role="audience" label="Audience" assignments={assignments} />
          <OutputButton role="stage"    label="Stage"    assignments={assignments} />
        </div>

        <div className="toolbar__divider" />
        <AccountButton />
      </div>

      {/* ── Themes panel dropdown ── */}
      {showThemes && (
        <div ref={themesRef} className="themes-panel-wrapper">
          <ThemesPanel
            state={state} dispatch={dispatch}
            selectedSlide={selectedSlide} updateSlideStyle={updateSlideStyle}
            onClose={() => setShowThemes(false)}
          />
        </div>
      )}
    </header>
  );
}