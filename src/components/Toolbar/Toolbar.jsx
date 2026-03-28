/**
 * Toolbar/Toolbar.jsx
 * Top bar: brand + Themes button, mode switcher, output controls.
 *
 * CHANGES vs original:
 *  - BUILTIN_THEMES now include x, y, width, height (textbox position)
 *  - ThemeCard preview shows real positioned "Sample Text" in a 16:9 surface
 *    instead of the old "Aa" span
 *  - applyTheme() now also applies x, y, width, height to the slide
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  launchOutputWindow, closeOutputWindow,
  isOutputOpen, isNdiOutput, loadAssignments,
} from '../../utils/outputManager';

// ── Built-in themes (always present) ──────────────────────────
const BUILTIN_THEMES = [
  { id:'classic-white', name:'Classic White', fontFamily:'Arial, sans-serif',       fontSize:6, fontWeight:800, textColor:'#ffffff', transform:'none',      italic:false, lineSpacing:1.2, x:50, y:50, width:70, height:40 },
  { id:'bold-gold',     name:'Bold Gold',     fontFamily:'Arial, sans-serif',       fontSize:7, fontWeight:800, textColor:'#D4AF37', transform:'uppercase', italic:false, lineSpacing:1.1, x:50, y:50, width:70, height:40 },
  { id:'thin-modern',   name:'Thin Modern',   fontFamily:'Inter, sans-serif',       fontSize:5, fontWeight:400, textColor:'#ffffff', transform:'uppercase', italic:false, lineSpacing:1.4, x:50, y:50, width:70, height:40 },
  { id:'script-style',  name:'Script Style',  fontFamily:'Georgia, serif',          fontSize:6, fontWeight:400, textColor:'#ffffff', transform:'none',      italic:true,  lineSpacing:1.3, x:50, y:50, width:70, height:40 },
  { id:'impact-caps',   name:'Impact Caps',   fontFamily:"'Impact', sans-serif",    fontSize:8, fontWeight:800, textColor:'#ffffff', transform:'uppercase', italic:false, lineSpacing:1.0, x:50, y:50, width:70, height:40 },
  { id:'red-verse',     name:'Red Verse',     fontFamily:'Arial, sans-serif',       fontSize:6, fontWeight:800, textColor:'#ef4444', transform:'none',      italic:false, lineSpacing:1.2, x:50, y:50, width:70, height:40 },
  { id:'blue-light',    name:'Blue Light',    fontFamily:'Inter, sans-serif',       fontSize:5, fontWeight:400, textColor:'#60a5fa', transform:'none',      italic:false, lineSpacing:1.3, x:50, y:50, width:70, height:40 },
  { id:'green-glow',    name:'Green Glow',    fontFamily:'Arial, sans-serif',       fontSize:6, fontWeight:800, textColor:'#00e87a', transform:'uppercase', italic:false, lineSpacing:1.1, x:50, y:50, width:70, height:40 },
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
// Shows a real 16:9 miniature with the text positioned exactly as the theme defines.
function ThemeCard({ theme, onApply, onDelete, isCustom }) {
  const [hovered, setHovered] = useState(false);

  const x      = theme.x      ?? 50;
  const y      = theme.y      ?? 50;
  const width  = theme.width  ?? 70;
  const height = theme.height ?? 40;

  const textDecoration = [
    theme.underline     && 'underline',
    theme.strikethrough && 'line-through',
  ].filter(Boolean).join(' ') || 'none';

  return (
    <div
      className="theme-card"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onApply(theme)}
      title={`Apply "${theme.name}"`}
    >
      {/* 16:9 preview surface with containerType so cqw works */}
      <div
        className="theme-card__preview"
        style={{
          background:     '#000',
          aspectRatio:    '16/9',
          position:       'relative',
          overflow:       'hidden',
          containerType:  'inline-size',
        }}
      >
        <div style={{
          position:      'absolute',
          left:          `${x}%`,
          top:           `${y}%`,
          width:         `${width}%`,
          height:        `${height}%`,
          transform:     'translate(-50%, -50%)',
          display:       'flex',
          alignItems:    'center',
          justifyContent:'center',
          textAlign:     'center',
          whiteSpace:    'pre-wrap',
          overflow:      'hidden',
          pointerEvents: 'none',
          // Typography
          fontFamily:    theme.fontFamily,
          fontSize:      `${theme.fontSize || 6}cqw`,
          fontWeight:    theme.fontWeight,
          color:         theme.textColor,
          fontStyle:     theme.italic ? 'italic' : 'normal',
          textTransform: theme.transform || 'none',
          lineHeight:    theme.lineSpacing || 1.2,
          textDecoration,
        }}>
          Sample Text
        </div>
      </div>

      {/* Label row */}
      <div className="theme-card__label">
        <span className="theme-card__name">{theme.name}</span>
        {isCustom && hovered && (
          <div style={{ display: 'flex', gap: 2 }}>
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
  const [editingTheme, setEditingTheme] = useState(null);

  // Apply all theme properties (including position) to current slide
  const applyTheme = useCallback((theme) => {
    if (!selectedSlide) return;
    const keys = [
      'fontFamily','fontSize','fontWeight','textColor','transform',
      'italic','underline','strikethrough','lineSpacing',
      'x','y','width','height',   // ← position
    ];
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
        ? { ...t, name,
            fontFamily:    selectedSlide.fontFamily || 'Arial, sans-serif',
            fontSize:      selectedSlide.fontSize   || 6,
            fontWeight:    selectedSlide.fontWeight || 800,
            textColor:     selectedSlide.textColor  || '#ffffff',
            transform:     selectedSlide.transform  || 'none',
            italic:        selectedSlide.italic     || false,
            underline:     selectedSlide.underline  || false,
            strikethrough: selectedSlide.strikethrough || false,
            lineSpacing:   selectedSlide.lineSpacing || 1.2,
            x:             selectedSlide.x      ?? 50,
            y:             selectedSlide.y      ?? 50,
            width:         selectedSlide.width  ?? 70,
            height:        selectedSlide.height ?? 40,
          }
        : t
      );
      setCustomThemes(next);
      saveCustomThemes(next);
      setEditingTheme(null);
    } else {
      const newTheme = {
        id: `custom-${Date.now()}`, name,
        fontFamily:    selectedSlide.fontFamily || 'Arial, sans-serif',
        fontSize:      selectedSlide.fontSize   || 6,
        fontWeight:    selectedSlide.fontWeight || 800,
        textColor:     selectedSlide.textColor  || '#ffffff',
        transform:     selectedSlide.transform  || 'none',
        italic:        selectedSlide.italic     || false,
        underline:     selectedSlide.underline  || false,
        strikethrough: selectedSlide.strikethrough || false,
        lineSpacing:   selectedSlide.lineSpacing || 1.2,
        x:             selectedSlide.x      ?? 50,
        y:             selectedSlide.y      ?? 50,
        width:         selectedSlide.width  ?? 70,
        height:        selectedSlide.height ?? 40,
      };
      const next = [...customThemes, newTheme];
      setCustomThemes(next);
      saveCustomThemes(next);
    }
    setThemeName('');
  }, [selectedSlide, themeName, customThemes, editingTheme]);

  const deleteTheme = useCallback((id) => {
    const next = customThemes.filter(t => t.id !== id);
    setCustomThemes(next);
    saveCustomThemes(next);
  }, [customThemes]);

  return (
    <div className="themes-panel">
      {/* Header */}
      <div className="themes-panel__header">
        <span className="themes-panel__title">THEMES</span>
        <button className="themes-panel__close" onClick={onClose}>×</button>
      </div>

      {/* Built-in */}
      <div className="themes-panel__section-label">BUILT-IN</div>
      <div className="themes-panel__grid">
        {BUILTIN_THEMES.map(t => (
          <ThemeCard key={t.id} theme={t} onApply={applyTheme} isCustom={false} onDelete={() => {}} />
        ))}
      </div>

      {/* Custom */}
      {customThemes.length > 0 && (
        <>
          <div className="themes-panel__section-label" style={{ marginTop: 16 }}>CUSTOM</div>
          <div className="themes-panel__grid">
            {customThemes.map(t => (
              <ThemeCard key={t.id} theme={t} onApply={applyTheme} isCustom onDelete={deleteTheme} />
            ))}
          </div>
        </>
      )}

      {/* Save current slide as theme */}
      {selectedSlide && (
        <div className="themes-panel__save-row">
          <input
            className="themes-panel__name-input"
            placeholder="Save current style as theme…"
            value={themeName}
            onChange={e => setThemeName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveCurrentAsTheme()}
          />
          <button className="themes-panel__save-btn" onClick={saveCurrentAsTheme}>
            Save
          </button>
        </div>
      )}
    </div>
  );
}

// ── Output button ──────────────────────────────────────────────
function OutputButton({ role, label, assignments }) {
  const [live,    setLive]    = useState(() => isOutputOpen(role));
  const [loading, setLoading] = useState(false);

  const enabled = role === 'audience'
    ? !!(assignments.audienceScreens?.length)
    : !!(assignments.stageScreens?.length);

  useEffect(() => {
    const id = setInterval(() => setLive(isOutputOpen(role)), 1500);
    return () => clearInterval(id);
  }, [role]);

  const toggle = async () => {
    if (loading) return;
    setLoading(true);
    try {
      if (live) { await closeOutputWindow(role); setLive(false); }
      else      { await launchOutputWindow(role); setLive(isOutputOpen(role)); }
    } catch {}
    setLoading(false);
  };

  return (
    <button
      className={`toolbar-output-btn toolbar-output-btn--${role} ${live ? 'toolbar-output-btn--live' : ''} ${!enabled ? 'toolbar-output-btn--disabled' : ''}`}
      onClick={toggle}
      title={enabled ? (live ? `Close ${label} output` : `Open ${label} output`) : `No ${label} screen configured`}
    >
      <span>{label}</span>
      {live && enabled && <span className="toolbar-output-btn__dot" />}
      {live && isNdiOutput(role) && <span style={{ fontSize:8, color:'#00e87a', marginLeft:2, fontWeight:800 }}>NDI</span>}
      {!enabled && <span style={{ fontSize:8, color:'#333', marginLeft:2 }}>OFF</span>}
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
        url: 'index.html#/account', width:400, height:560,
        title:'ElevateFlow Account', resizable:false, center:true,
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
        display:'flex', alignItems:'center', gap:7,
        height:30, padding: user ? '0 10px 0 3px' : '0 12px',
        background: hover ? (user ? 'rgba(212,175,55,0.1)' : 'rgba(255,255,255,0.06)') : 'transparent',
        border:`1px solid ${hover || user ? 'rgba(212,175,55,0.3)' : 'rgba(255,255,255,0.08)'}`,
        borderRadius:20, cursor:'pointer', transition:'all 0.15s', marginRight:4,
      }}
    >
      <div style={{
        width:22, height:22, borderRadius:'50%',
        background: user?.photoURL ? 'transparent' : 'rgba(212,175,55,0.15)',
        border:'1.5px solid rgba(212,175,55,0.4)',
        display:'flex', alignItems:'center', justifyContent:'center',
        overflow:'hidden', flexShrink:0,
      }}>
        {user?.photoURL
          ? <img src={user.photoURL} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
          : <span style={{ fontSize:10, fontWeight:800, color:'#D4AF37', lineHeight:1 }}>{initials}</span>
        }
      </div>
      <span style={{
        fontSize:11, fontWeight:700,
        color: user ? '#D4AF37' : 'rgba(255,255,255,0.4)',
        maxWidth:80, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
      }}>
        {user ? user.nickname : 'Sign In'}
      </span>
    </button>
  );
}

export default function Toolbar({ state, dispatch, selectedSlide, updateSlideStyle, onExportEf, onImportEf, onTextImport, onToggleAI, showAI, activeSong, showMediaBin, onToggleMediaBin }) {
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

  useEffect(() => {
    if (!showThemes) return;
    const handler = (e) => {
      if (themesRef.current && !themesRef.current.contains(e.target)) setShowThemes(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showThemes]);

  return (
    <header className="toolbar" style={{ position:'relative' }}>

      {/* LEFT */}
      <div className="toolbar__left">
        <span className="toolbar__brand">
          ELEVATE<span className="toolbar__brand-accent">FLOW</span>
        </span>

        <button
          className={`toolbar__themes-btn ${showThemes ? 'toolbar__themes-btn--active' : ''}`}
          onClick={() => setShowThemes(p => !p)}
          title="Themes"
        >
          <ThemesIcon />
          <span>Themes</span>
        </button>

        <div className="toolbar__ef-group">
          <button className="toolbar__ef-btn" onClick={onImportEf} title="Import .ef song file">
            <EfImportIcon /> Import .ef
          </button>
          <button className="toolbar__ef-btn" onClick={onTextImport} title="Import from text / clipboard">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            Text Import
          </button>
          {activeSong && (
            <button className="toolbar__ef-btn" onClick={onExportEf} title={`Export "${activeSong.title}" as .ef`}>
              <EfExportIcon /> Export .ef
            </button>
          )}
        </div>
      </div>

      {/* CENTER: Mode switcher */}
      <div className="toolbar__center">
        <div className="toolbar__mode-group">
          {[
            { id:'show',  label:'Show',  icon:<ShowIcon /> },
            { id:'edit',  label:'Edit',  icon:<EditIcon /> },
            { id:'stage', label:'Stage', icon:<StageIcon /> },
          ].map(({ id, label, icon }) => (
            <button key={id}
              className={`toolbar__mode-btn ${mode===id ? 'toolbar__mode-btn--active' : ''}`}
              onClick={() => dispatch({ type:'SET_MODE', payload:id })}
            >
              {icon}<span>{label}</span>
            </button>
          ))}
          <MoreMenu mode={mode} dispatch={dispatch} />
        </div>
      </div>

      {/* RIGHT */}
      <div className="toolbar__right">
        <AccountButton />
        <OutputButton role="audience" label="Audience" assignments={assignments} />
        <OutputButton role="stage"    label="Stage"    assignments={assignments} />
        <div className="toolbar__divider" />
        <button
          onClick={onToggleAI}
          title="AI Assistant"
          style={{
            height:28, padding:'0 10px', borderRadius:6, cursor:'pointer',
            background: showAI ? 'rgba(212,175,55,0.12)' : 'transparent',
            border:`1px solid ${showAI ? 'rgba(212,175,55,0.35)' : '#1e1e24'}`,
            color: showAI ? '#D4AF37' : '#555', fontSize:13, fontWeight:700,
            display:'flex', alignItems:'center', gap:5, transition:'all 0.15s',
          }}>
          <span>✦</span>
          <span style={{ fontSize:10, fontWeight:800 }}>AI</span>
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
          onClick={() => dispatch({ type:'TOGGLE_SYNC_PANEL' })}
          title="Network Sync"
        >
          <SyncDot active={isSynced} /><span>SYNC</span>
        </button>
        <button
          className="toolbar__icon-btn"
          title="Configure Output Screens"
          onClick={() => import('@tauri-apps/api/webviewWindow').then(({ WebviewWindow }) => {
            new WebviewWindow('configurescreens', { url:'index.html#/configure-screens', width:1100, height:700, title:'Configure Screens', resizable:true, center:true });
          })}
        >
          <MonitorIcon hasScreen />
        </button>
      </div>

      {/* Themes panel dropdown */}
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
      <path d="M8 21h8M12 17v4"/><path d="M7 8l3 3 3-3 3 3"/>
    </svg>
  );
}
function MoreMenu({ mode, dispatch }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  const moreItems = [
    { id:'graphics',     label:'Graphics',     icon:'🎨' },
    { id:'theme-editor', label:'Theme Editor', icon:'✦' },
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
        url:'https://music.youtube.com', width:1100, height:760, title:'YouTube Music',
        resizable:true, center:true,
        userAgent:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
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
      new WebviewWindow('production', { url:'index.html#/production', width:1200, height:800, title:'Production', resizable:true, center:true });
    } catch {}
  };

  const dividerStyle = { height:1, background:'rgba(255,255,255,0.06)', margin:'4px 8px' };
  const actionStyle  = {
    width:'100%', display:'flex', alignItems:'center', gap:8,
    padding:'8px 12px', borderRadius:5, background:'transparent',
    border:'none', color:'#bbb', fontSize:12, fontWeight:600,
    cursor:'pointer', textAlign:'left', fontFamily:'system-ui, Arial',
  };

  return (
    <div ref={ref} style={{ position:'relative' }}>
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
          position:'absolute', top:'calc(100% + 4px)', left:'50%',
          transform:'translateX(-50%)',
          background:'rgba(18,18,18,0.97)', border:'1px solid rgba(255,255,255,0.08)',
          borderRadius:8, padding:4, minWidth:165, zIndex:500,
          boxShadow:'0 8px 24px rgba(0,0,0,0.6)', backdropFilter:'blur(12px)',
        }}>
          {moreItems.map(item => (
            <button key={item.id}
              onClick={() => { dispatch({ type:'SET_MODE', payload:item.id }); setOpen(false); }}
              style={{
                ...actionStyle,
                background: mode===item.id ? 'rgba(212,175,55,0.12)' : 'transparent',
                color:       mode===item.id ? '#D4AF37' : '#bbb',
              }}
              onMouseEnter={e => { if (mode!==item.id) e.currentTarget.style.background='rgba(255,255,255,0.06)'; }}
              onMouseLeave={e => { if (mode!==item.id) e.currentTarget.style.background='transparent'; }}
            >
              <span>{item.icon}</span><span>{item.label}</span>
            </button>
          ))}
          <div style={dividerStyle} />
          <button onClick={openYouTubeMusic} style={actionStyle}
            onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.06)'}
            onMouseLeave={e => e.currentTarget.style.background='transparent'}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="#ff0000"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
            <span>YouTube Music</span>
          </button>
          <button onClick={openProduction} style={actionStyle}
            onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.06)'}
            onMouseLeave={e => e.currentTarget.style.background='transparent'}>
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
      <path d="M12 2a10 10 0 0 1 0 20"/><path d="M2 12h20"/>
      <path d="M12 2c-2.5 2.5-4 6-4 10s1.5 7.5 4 10"/>
    </svg>
  );
}
function ShowIcon()  { return <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>; }
function EditIcon()  { return <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>; }
function StageIcon() { return <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>; }
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