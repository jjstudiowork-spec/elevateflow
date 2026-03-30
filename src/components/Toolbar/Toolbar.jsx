/**
 * Toolbar/Toolbar.jsx
 * Top bar: brand + Themes button, mode switcher, output controls.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  launchOutputWindow, closeOutputWindow,
  isOutputOpen, isNdiOutput, loadAssignments,
} from '../../utils/outputManager';

// ── Built-in themes (always present) ──────────────────────────
const BUILTIN_THEMES = [
  { id: 'classic-white', name: 'Classic White', fontFamily: 'Arial, sans-serif',       fontSize: 6, fontWeight: 800, textColor: '#ffffff', transform: 'none',      italic: false, lineSpacing: 1.2 },
  { id: 'bold-gold',     name: 'Bold Gold',     fontFamily: 'Arial, sans-serif',       fontSize: 7, fontWeight: 800, textColor: '#D4AF37', transform: 'uppercase', italic: false, lineSpacing: 1.1 },
  { id: 'thin-modern',   name: 'Thin Modern',   fontFamily: 'Inter, sans-serif',       fontSize: 5, fontWeight: 400, textColor: '#ffffff', transform: 'uppercase', italic: false, lineSpacing: 1.4 },
  { id: 'script-style',  name: 'Script Style',  fontFamily: 'Georgia, serif',          fontSize: 6, fontWeight: 400, textColor: '#ffffff', transform: 'none',      italic: true,  lineSpacing: 1.3 },
  { id: 'impact-caps',   name: 'Impact Caps',   fontFamily: "'Impact', sans-serif",    fontSize: 8, fontWeight: 800, textColor: '#ffffff', transform: 'uppercase', italic: false, lineSpacing: 1.0 },
  { id: 'red-verse',     name: 'Red Verse',     fontFamily: 'Arial, sans-serif',       fontSize: 6, fontWeight: 800, textColor: '#ef4444', transform: 'none',      italic: false, lineSpacing: 1.2 },
  { id: 'blue-light',    name: 'Blue Light',    fontFamily: 'Inter, sans-serif',       fontSize: 5, fontWeight: 400, textColor: '#60a5fa', transform: 'none',      italic: false, lineSpacing: 1.3 },
  { id: 'green-glow',    name: 'Green Glow',    fontFamily: 'Arial, sans-serif',       fontSize: 6, fontWeight: 800, textColor: '#00e87a', transform: 'uppercase', italic: false, lineSpacing: 1.1 },
];

const THEME_STORAGE_KEY = 'elevateflow_custom_themes';

function loadCustomThemes() {
  try { return JSON.parse(localStorage.getItem(THEME_STORAGE_KEY) || '[]'); }
  catch { return []; }
}
function saveCustomThemes(themes) {
  try { localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(themes)); }
  catch {}
}

// ── Theme preview card ─────────────────────────────────────────
function ThemeCard({ theme, onApply, onDelete, isCustom, onEdit }) {
  const [hovered, setHovered] = useState(false);
  const previewText = theme.text || 'AMAZING\nGRACE';
  return (
    <div
      className="theme-card"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onApply(theme)}
      title={`Apply "${theme.name}"`}
    >
      {/* Real slide preview */}
      <div className="theme-card__preview" style={{ background: '#000', position: 'relative', overflow: 'hidden', containerType: 'inline-size' }}>
        <div style={{
          position: 'absolute',
          left:   `${theme.x ?? 50}%`,
          top:    `${theme.y ?? 50}%`,
          width:  `${theme.width ?? 70}%`,
          height: `${theme.height ?? 40}%`,
          transform: 'translate(-50%, -50%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }}>
          <span style={{
            fontFamily:    theme.fontFamily || 'Arial, sans-serif',
            fontSize:      `${theme.fontSize || 6}cqw`,
            fontWeight:    theme.fontWeight || 800,
            color:         theme.textColor  || '#fff',
            fontStyle:     theme.italic ? 'italic' : 'normal',
            textTransform: theme.transform  || 'none',
            lineHeight:    theme.lineSpacing || 1.2,
            textAlign:     'center',
            whiteSpace:    'pre-wrap',
            display:       'block',
            overflow:      'hidden',
            textDecoration: [
              theme.underline     && 'underline',
              theme.strikethrough && 'line-through',
            ].filter(Boolean).join(' ') || 'none',
          }}>
            {previewText}
          </span>
        </div>
      </div>
      {/* Label row */}
      <div className="theme-card__label">
        <span className="theme-card__name">{theme.name}</span>
        {isCustom && hovered && (
          <div style={{ display: 'flex', gap: 2 }}>
            <button className="theme-card__edit" title="Edit theme"
              onClick={e => { e.stopPropagation(); onEdit?.(); }}>✎</button>
            <button className="theme-card__delete" title="Delete theme"
              onClick={e => { e.stopPropagation(); onDelete(theme.id); }}>×</button>
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
  const [editingTheme, setEditingTheme] = useState(null); // theme being edited

  const applyTheme = useCallback((theme) => {
    if (!selectedSlide) return;
    const keys = ['fontFamily','fontSize','fontWeight','textColor','transform',
                  'italic','underline','strikethrough','lineSpacing','x','y','width','height'];
    const updates = {};
    keys.forEach(k => { if (theme[k] !== undefined) updates[k] = theme[k]; });
    dispatch({ type: 'APPLY_THEME_TO_ALL', payload: updates });
    onClose();
  }, [selectedSlide, dispatch, onClose]);

  const saveCurrentAsTheme = useCallback(() => {
    if (!selectedSlide) return;
    const name = themeName.trim() || 'My Theme';
    if (editingTheme) {
      // Update existing custom theme
      const next = customThemes.map(t => t.id === editingTheme.id
        ? { ...t, name,
            text:          selectedSlide.text?.split('\n').slice(0,2).join('\n') || 'Sample',
            fontFamily:    selectedSlide.fontFamily || 'Arial, sans-serif',
            fontSize:      selectedSlide.fontSize   || 6,
            fontWeight:    selectedSlide.fontWeight || 800,
            textColor:     selectedSlide.textColor  || '#ffffff',
            transform:     selectedSlide.transform  || 'none',
            italic:        selectedSlide.italic     || false,
            underline:     selectedSlide.underline  || false,
            strikethrough: selectedSlide.strikethrough || false,
            lineSpacing:   selectedSlide.lineSpacing || 1.2,
            x:             selectedSlide.x,
            y:             selectedSlide.y,
            width:         selectedSlide.width,
            height:        selectedSlide.height,
          }
        : t
      );
      setCustomThemes(next);
      saveCustomThemes(next);
      setEditingTheme(null);
    } else {
      const newTheme = {
        id: `custom-${Date.now()}`, name,
        text:          selectedSlide.text?.split('\n').slice(0,2).join('\n') || 'Sample',
        fontFamily:    selectedSlide.fontFamily    || 'Arial, sans-serif',
        fontSize:      selectedSlide.fontSize      || 6,
        fontWeight:    selectedSlide.fontWeight    || 800,
        textColor:     selectedSlide.textColor     || '#ffffff',
        transform:     selectedSlide.transform     || 'none',
        italic:        selectedSlide.italic        || false,
        underline:     selectedSlide.underline     || false,
        strikethrough: selectedSlide.strikethrough || false,
        lineSpacing:   selectedSlide.lineSpacing   || 1.2,
        x:             selectedSlide.x,
        y:             selectedSlide.y,
        width:         selectedSlide.width,
        height:        selectedSlide.height,
      };
      const next = [...customThemes, newTheme];
      setCustomThemes(next);
      saveCustomThemes(next);
    }
    setThemeName('');
  }, [selectedSlide, customThemes, themeName, editingTheme]);

  const deleteTheme = useCallback((id) => {
    const next = customThemes.filter(t => t.id !== id);
    setCustomThemes(next);
    saveCustomThemes(next);
    if (editingTheme?.id === id) setEditingTheme(null);
  }, [customThemes, editingTheme]);

  const startEdit = (theme) => {
    setEditingTheme(theme);
    setThemeName(theme.name);
  };

  return (
    <div className="themes-panel">
      <div className="themes-panel__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ThemesIcon />
          <span className="themes-panel__title">THEMES</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => { onClose(); dispatch({ type: 'SET_MODE', payload: 'theme-editor' }); }}
            style={{
              height: 24, padding: '0 10px', borderRadius: 5, cursor: 'pointer',
              background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.3)',
              color: '#D4AF37', fontSize: 10, fontWeight: 800,
            }}>+ Add Theme</button>
          <button className="themes-panel__close" onClick={onClose}>✕</button>
        </div>
      </div>

      {!selectedSlide && (
        <div className="themes-panel__hint">Select a slide to apply a theme</div>
      )}

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
                onDelete={deleteTheme}
                onEdit={() => startEdit(t)}
                isEditing={editingTheme?.id === t.id}
              />
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
          <input
            className="themes-panel__save-input"
            placeholder={editingTheme ? editingTheme.name : 'Theme name…'}
            value={themeName}
            onChange={e => setThemeName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveCurrentAsTheme()}
          />
          <button className="themes-panel__save-btn" onClick={saveCurrentAsTheme} disabled={!selectedSlide}>
            {editingTheme ? 'Update' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}


function OutputButton({ role, label, assignments }) {
  const [live, setLive] = useState(() => isOutputOpen(role));
  const [enabled, setEnabled] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('ef_screen_assignments') || '{}');
      const key = role === 'audience' ? 'audienceEnabled' : 'stageEnabled';
      return saved[key] !== false; // default true if not set
    } catch { return true; }
  });

  useEffect(() => {
    const id = setInterval(() => setLive(isOutputOpen(role)), 1000);
    return () => clearInterval(id);
  }, [role]);

  // Listen for screen config changes
  useEffect(() => {
    const handler = () => {
      try {
        const saved = JSON.parse(localStorage.getItem('ef_screen_assignments') || '{}');
        const key = role === 'audience' ? 'audienceEnabled' : 'stageEnabled';
        setEnabled(saved[key] !== false);
      } catch {}
    };
    window.addEventListener('storage', handler);
    window.addEventListener('ef-screens-updated', handler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('ef-screens-updated', handler);
    };
  }, [role]);

  const hasScreen = !!assignments[role];
  const handleClick = useCallback(async () => {
    if (!enabled) return;
    if (live) { await closeOutputWindow(role); setLive(false); }
    else {
      const r = await launchOutputWindow(role);
      if (r.ok) {
        setLive(true);
        // Push current slide/video state to the new window after it renders
        setTimeout(async () => {
          const payload = window._efCurrentPayload;
          if (payload) {
            try {
              const { emitTo } = await import('@tauri-apps/api/event');
              await emitTo('*', 'audience-update', payload);
            } catch {}
          }
        }, 900);
      }
    }
  }, [live, role, enabled]);
  return (
    <button
      className={['toolbar-output-btn', live ? 'toolbar-output-btn--live' : '', !hasScreen ? 'toolbar-output-btn--unassigned' : '', !enabled ? 'toolbar-output-btn--disabled' : ''].join(' ').trim()}
      onClick={handleClick}
      title={!enabled ? `${label} is disabled in Screen Config` : !hasScreen ? `No screen assigned for ${label} — click to configure` : live ? `${label} is LIVE — click to close` : `Open ${label} output`}
    >
      <MonitorIcon live={live} hasScreen={hasScreen && enabled} />
      <span>{label}</span>
      {live && enabled && <span className="toolbar-output-btn__dot" />}
      {live && isNdiOutput(role) && <span style={{ fontSize: 8, color: '#00e87a', marginLeft: 2, fontWeight: 800 }}>NDI</span>}
      {!enabled && <span style={{ fontSize: 8, color: '#333', marginLeft: 2 }}>OFF</span>}
    </button>
  );
}

// ── Account Button ─────────────────────────────────────────────
function AccountButton() {
  const [user,  setUser]  = React.useState(() => {
    try { return JSON.parse(localStorage.getItem('ef_user')); } catch { return null; }
  });
  const [hover, setHover] = React.useState(false);

  React.useEffect(() => {
    const h = (e) => setUser(e.detail);
    window.addEventListener('ef-auth-changed', h);
    return () => window.removeEventListener('ef-auth-changed', h);
  }, []);

  const openAccount = () => {
    import('@tauri-apps/api/webviewWindow').then(({ WebviewWindow }) => {
      new WebviewWindow('account', {
        url: 'index.html#/account',
        width: 400, height: 560,
        title: 'ElevateFlow Account',
        resizable: false, center: true,
      }).catch(() => {});
    });
  };

  const initials = user?.nickname?.[0]?.toUpperCase() || '?';

  return (
    <button
      onClick={openAccount}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={user ? `${user.nickname} — click to manage account` : 'Sign in to ElevateFlow'}
      style={{
        display: 'flex', alignItems: 'center', gap: 7,
        height: 30, padding: user ? '0 10px 0 3px' : '0 12px',
        background: hover
          ? (user ? 'rgba(212,175,55,0.1)' : 'rgba(255,255,255,0.06)')
          : 'transparent',
        border: `1px solid ${hover || user ? 'rgba(212,175,55,0.3)' : 'rgba(255,255,255,0.08)'}`,
        borderRadius: 20, cursor: 'pointer', transition: 'all 0.15s',
        marginRight: 4,
      }}
    >
      {/* Avatar circle */}
      <div style={{
        width: 22, height: 22, borderRadius: '50%',
        background: user?.photoURL ? 'transparent' : 'rgba(212,175,55,0.15)',
        border: '1.5px solid rgba(212,175,55,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', flexShrink: 0,
      }}>
        {user?.photoURL
          ? <img src={user.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontSize: 10, fontWeight: 800, color: '#D4AF37', lineHeight: 1 }}>{initials}</span>
        }
      </div>

      {/* Nickname or Sign In */}
      <span style={{
        fontSize: 11, fontWeight: 700,
        color: user ? '#D4AF37' : 'rgba(255,255,255,0.4)',
        maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {user ? user.nickname : 'Sign In'}
      </span>
    </button>
  );
}

export default function Toolbar({ state, dispatch, selectedSlide, updateSlideStyle, onImportEf, onTextImport, onToggleAI, showAI, activeSong, showMediaBin, onToggleMediaBin }) {
  const { mode, isSynced } = state;
  const [assignments, setAssignments] = useState(loadAssignments);
  const [showThemes, setShowThemes]   = useState(false);
  const themesRef = useRef(null);

  useEffect(() => {
    const refresh = () => setAssignments(loadAssignments());
    window.addEventListener('focus', refresh);
    const id = setInterval(refresh, 3000);
    return () => { window.removeEventListener('focus', refresh); clearInterval(id); };
  }, []);

  // Close themes panel on outside click
  useEffect(() => {
    if (!showThemes) return;
    const handler = (e) => {
      if (themesRef.current && !themesRef.current.contains(e.target)) setShowThemes(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showThemes]);

  return (
    <header className="toolbar" style={{ position: 'relative' }}>

      {/* ── LEFT ── */}
      <div className="toolbar__left">
        <span className="toolbar__brand">
          ELEVATE<span className="toolbar__brand-accent">FLOW</span>
        </span>

        {/* Themes button */}
        <button
          onClick={() => setShowThemes(p => !p)}
          title="Themes"
          style={{
            height: 30, padding: '0 12px', borderRadius: 7, cursor: 'pointer',
            background: showThemes ? 'rgba(212,175,55,0.15)' : 'rgba(212,175,55,0.06)',
            border: `1px solid ${showThemes ? 'rgba(212,175,55,0.5)' : 'rgba(212,175,55,0.2)'}`,
            color: '#D4AF37', fontSize: 11, fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.12s',
          }}
        >
          <ThemesIcon />
          <span>Themes</span>
        </button>

        {/* Text Import button */}
        <button onClick={onTextImport} title="Import from text / clipboard"
          style={{
            height: 30, padding: '0 12px', borderRadius: 7, cursor: 'pointer',
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
            color: '#71717a', fontSize: 11, fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.12s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#a1a1aa'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#71717a'; }}
        >
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
          Text Import
        </button>
      </div>

      {/* ── CENTER: Mode switcher ── */}
      <div className="toolbar__center">
        <div className="toolbar__mode-group">
          {[
            { id: 'show',  label: 'Show',  icon: <ShowIcon /> },
            { id: 'edit',  label: 'Edit',  icon: <EditIcon /> },
            { id: 'stage', label: 'Stage', icon: <StageIcon /> },
            { id: 'flow',  label: 'Flow',  icon: <FlowIcon />  },
          ].map(({ id, label, icon }) => (
            <button key={id}
              className={`toolbar__mode-btn ${mode === id ? 'toolbar__mode-btn--active' : ''}`}
              onClick={() => dispatch({ type: 'SET_MODE', payload: id })}
            >
              {icon}<span>{label}</span>
            </button>
          ))}
          <MoreMenu mode={mode} dispatch={dispatch} />
        </div>
      </div>

      {/* ── RIGHT ── */}
      <div className="toolbar__right">
        <AccountButton />
        <OutputButton role="audience" label="Audience" assignments={assignments} />
        <OutputButton role="stage"    label="Stage"    assignments={assignments} />
        <div className="toolbar__divider" />
        <button
          onClick={onToggleAI}
          title="AI Assistant"
          style={{
            height: 28, padding: '0 10px', borderRadius: 6, cursor: 'pointer',
            background: showAI ? 'rgba(212,175,55,0.12)' : 'transparent',
            border: `1px solid ${showAI ? 'rgba(212,175,55,0.35)' : '#1e1e24'}`,
            color: showAI ? '#D4AF37' : '#555', fontSize: 13, fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.15s',
          }}>
          <span>✦</span>
          <span style={{ fontSize: 10, fontWeight: 800 }}>AI</span>
        </button>
        <button
          className={`toolbar__sync-btn ${showMediaBin ? 'toolbar__sync-btn--active' : ''}`}
          onClick={onToggleMediaBin}
          title={showMediaBin ? 'Hide Media Bin' : 'Show Media Bin'}
        >
          <MediaBinIcon active={showMediaBin} /><span>MEDIA</span>
        </button>
        <button
          className={`toolbar__sync-btn ${isSynced ? 'toolbar__sync-btn--active' : ''}`}
          onClick={() => dispatch({ type: 'TOGGLE_SYNC_PANEL' })}
          title="Network Sync"
        >
          <SyncDot active={isSynced} /><span>SYNC</span>
        </button>

        
        <button
          className="toolbar__icon-btn"
          title="Configure Output Screens" 
          onClick={() => import('@tauri-apps/api/webviewWindow').then(({ WebviewWindow }) => {
            new WebviewWindow('configurescreens', { url: 'index.html#/configure-screens', width: 1100, height: 700, title: 'Configure Screens', resizable: true, center: true });
          })}
        >
          <MonitorIcon hasScreen />
        </button>
      </div>

      {/* ── Themes panel dropdown ── */}
      {showThemes && (
        <div ref={themesRef} className="themes-panel-wrapper">
          <ThemesPanel
            state={state}
            dispatch={dispatch}
            selectedSlide={selectedSlide}
            updateSlideStyle={updateSlideStyle}
            onClose={() => setShowThemes(false)}
          />
        </div>
      )}
    </header>
  );
}

// ── Icons ──────────────────────────────────────────────────────
function MonitorIcon({ live, hasScreen }) {
  const color = live ? '#00ff88' : hasScreen ? '#D4AF37' : '#555';
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
    </svg>
  );
}
function MediaBinIcon({ active }) {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <path d="M8 21h8M12 17v4"/>
      <path d="M7 8l3 3 3-3 3 3"/>
    </svg>
  );
}
function MoreMenu({ mode, dispatch }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  const moreItems = [
    { id: 'theme-editor', label: 'Theme Editor',  icon: '✦' },
  ];
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
    try {
      const existing = await WebviewWindow.getByLabel('youtubemusic');
      if (existing) { await existing.show(); await existing.setFocus(); return; }
    } catch {}
    try {
      new WebviewWindow('youtubemusic', {
        url: 'https://music.youtube.com',
        width: 1100, height: 760, title: 'YouTube Music',
        resizable: true, center: true,
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      });
    } catch {}
  };

  const openProduction = async () => {
    setOpen(false);
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
    try {
      const existing = await WebviewWindow.getByLabel('production');
      if (existing) { await existing.show(); await existing.setFocus(); return; }
    } catch {}
    try {
      new WebviewWindow('production', {
        url: 'index.html#/production',
        width: 1200, height: 800, title: 'Production',
        resizable: true, center: true,
      });
    } catch {}
  };

  const dividerStyle = { height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 8px' };
  const actionStyle = {
    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 12px', borderRadius: 8, background: 'transparent',
    border: 'none', color: '#71717a', fontSize: 12, fontWeight: 600,
    cursor: 'pointer', textAlign: 'left', fontFamily: 'system-ui, Arial',
    transition: 'all 0.1s',
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className={`toolbar__mode-btn ${active ? 'toolbar__mode-btn--active' : ''}`}
        onClick={() => setOpen(p => !p)}
        title="More modes"
      >
        <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
          <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
        </svg>
        <span>More</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(14,14,16,0.98)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 12, padding: 6, minWidth: 180, zIndex: 500,
          boxShadow: '0 16px 48px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.03)',
          backdropFilter: 'blur(20px)',
        }}>
          {/* Mode items */}
          {moreItems.map(item => (
            <button key={item.id}
              onClick={() => { dispatch({ type: 'SET_MODE', payload: item.id }); setOpen(false); }}
              style={{
                ...actionStyle,
                background: mode === item.id ? 'rgba(212,175,55,0.12)' : 'transparent',
                color: mode === item.id ? '#D4AF37' : '#bbb',
              }}
              onMouseEnter={e => { if (mode !== item.id) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
              onMouseLeave={e => { if (mode !== item.id) e.currentTarget.style.background = 'transparent'; }}
            >
              <span>{item.icon}</span><span>{item.label}</span>
            </button>
          ))}

          <div style={dividerStyle} />

          {/* Windows */}
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

function SyncDot({ active }) {
  return <span style={{ width:7, height:7, borderRadius:'50%', flexShrink:0, display:'inline-block', background: active ? '#00ff88' : '#444', boxShadow: active ? '0 0 6px #00ff88' : 'none' }} />;
}
function ThemesIcon() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 2a10 10 0 0 1 0 20"/>
      <path d="M2 12h20"/>
      <path d="M12 2c-2.5 2.5-4 6-4 10s1.5 7.5 4 10"/>
    </svg>
  );
}
function ShowIcon() {
  return <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>;
}
function EditIcon() {
  return <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
}
function FlowIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="18" x2="15" y2="18"/>
    </svg>
  );
}
function StageIcon() {
  return <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>;
}
function GraphicsIcon() {
  return <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></svg>;
}
function ThemeEditorIcon() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c.55 0 1-.45 1-1v-1.56c0-.27-.1-.51-.27-.7a1 1 0 0 1 .74-1.68H16c2.76 0 5-2.24 5-5C21 6.13 16.97 2 12 2z"/>
      <circle cx="6.5" cy="11.5" r="1.5"/><circle cx="9.5" cy="7.5" r="1.5"/>
      <circle cx="14.5" cy="7.5" r="1.5"/><circle cx="17.5" cy="11.5" r="1.5"/>
    </svg>
  );
}
function EfImportIcon() {
  return (
    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  );
}
function EfExportIcon() {
  return (
    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
    </svg>
  );
}