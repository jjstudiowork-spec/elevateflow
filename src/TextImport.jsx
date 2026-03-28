/**
 * TextImport.jsx
 * Paste lyrics → choose lines per slide → pick a theme → pick destination → import.
 * Theme selection applies font, size, colour, and textbox position to every slide.
 */
import React, { useState, useEffect, useRef } from 'react';

// ── Built-in themes (keep in sync with Toolbar.jsx) ──────────────
const BUILTIN_THEMES = [
  { id:'classic-white', name:'Classic White', fontFamily:'Arial, sans-serif',    fontSize:6,  fontWeight:800, textColor:'#ffffff', transform:'none',      italic:false, lineSpacing:1.2, x:50, y:50, width:70, height:40 },
  { id:'bold-gold',     name:'Bold Gold',     fontFamily:'Arial, sans-serif',    fontSize:7,  fontWeight:800, textColor:'#D4AF37', transform:'uppercase', italic:false, lineSpacing:1.1, x:50, y:50, width:70, height:40 },
  { id:'thin-modern',   name:'Thin Modern',   fontFamily:'Inter, sans-serif',    fontSize:5,  fontWeight:400, textColor:'#ffffff', transform:'uppercase', italic:false, lineSpacing:1.4, x:50, y:50, width:70, height:40 },
  { id:'script-style',  name:'Script Style',  fontFamily:'Georgia, serif',       fontSize:6,  fontWeight:400, textColor:'#ffffff', transform:'none',      italic:true,  lineSpacing:1.3, x:50, y:50, width:70, height:40 },
  { id:'impact-caps',   name:'Impact Caps',   fontFamily:"'Impact', sans-serif", fontSize:8,  fontWeight:800, textColor:'#ffffff', transform:'uppercase', italic:false, lineSpacing:1.0, x:50, y:50, width:70, height:40 },
  { id:'red-verse',     name:'Red Verse',     fontFamily:'Arial, sans-serif',    fontSize:6,  fontWeight:800, textColor:'#ef4444', transform:'none',      italic:false, lineSpacing:1.2, x:50, y:50, width:70, height:40 },
  { id:'blue-light',    name:'Blue Light',    fontFamily:'Inter, sans-serif',    fontSize:5,  fontWeight:400, textColor:'#60a5fa', transform:'none',      italic:false, lineSpacing:1.3, x:50, y:50, width:70, height:40 },
  { id:'green-glow',    name:'Green Glow',    fontFamily:'Arial, sans-serif',    fontSize:6,  fontWeight:800, textColor:'#00e87a', transform:'uppercase', italic:false, lineSpacing:1.1, x:50, y:50, width:70, height:40 },
];

const THEME_STORAGE_KEY = 'elevateflow_custom_themes';
function loadCustomThemes() {
  try { return JSON.parse(localStorage.getItem(THEME_STORAGE_KEY) || '[]'); }
  catch { return []; }
}

// ── Helpers ───────────────────────────────────────────────────────
function buildSlides(text, linesPerSlide) {
  const lines = text.split('\n').map(l => l.trim());
  const slides = [];
  let current = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === '') {
      if (current.length > 0) { slides.push(current.join('\n')); current = []; }
    } else {
      current.push(line);
      if (current.length === linesPerSlide) { slides.push(current.join('\n')); current = []; }
    }
  }
  if (current.length > 0) slides.push(current.join('\n'));
  return slides.filter(s => s.trim());
}

function makeSlide(text, index, theme) {
  return {
    id:            Date.now() + index + Math.random(),
    text,
    group:         'None',
    color:         '#1a1a1a',
    // Position from theme (or defaults)
    x:             theme?.x      ?? 50,
    y:             theme?.y      ?? 50,
    width:         theme?.width  ?? 60,
    height:        theme?.height ?? 30,
    // Typography from theme
    fontSize:      theme?.fontSize   ?? 5,
    fontWeight:    theme?.fontWeight ?? 800,
    fontFamily:    theme?.fontFamily ?? 'Arial, sans-serif',
    textColor:     theme?.textColor  ?? '#ffffff',
    transform:     theme?.transform  ?? 'none',
    italic:        theme?.italic     ?? false,
    underline:     theme?.underline  ?? false,
    strikethrough: theme?.strikethrough ?? false,
    lineSpacing:   theme?.lineSpacing ?? 1.2,
    video:         null,
  };
}

// ── Slide preview card ────────────────────────────────────────────
function SlidePreview({ text, index, theme }) {
  const td = [
    theme?.underline     && 'underline',
    theme?.strikethrough && 'line-through',
  ].filter(Boolean).join(' ') || 'none';

  const x      = theme?.x      ?? 50;
  const y      = theme?.y      ?? 50;
  const width  = theme?.width  ?? 60;
  const height = theme?.height ?? 30;

  return (
    <div style={{
      background: '#000', borderRadius: 8, overflow: 'hidden',
      aspectRatio: '16/9', position: 'relative',
      border: '1px solid #1e1e24', containerType: 'inline-size',
    }}>
      {/* Positioned text using theme values */}
      <div style={{
        position:   'absolute',
        left:       `${x}%`,
        top:        `${y}%`,
        width:      `${width}%`,
        height:     `${height}%`,
        transform:  'translate(-50%, -50%)',
        display:    'flex', alignItems: 'center', justifyContent: 'center',
        textAlign:  'center', whiteSpace: 'pre-wrap',
        color:         theme?.textColor  || '#fff',
        fontWeight:    theme?.fontWeight || 800,
        fontSize:      `${theme?.fontSize || 5}cqw`,
        fontFamily:    theme?.fontFamily || 'Arial, sans-serif',
        textTransform: theme?.transform  || 'none',
        fontStyle:     theme?.italic ? 'italic' : 'normal',
        lineHeight:    theme?.lineSpacing || 1.2,
        textDecoration: td,
        overflow: 'hidden',
      }}>
        {text}
      </div>
      {/* Slide number */}
      <div style={{
        position: 'absolute', top: 4, left: 6,
        fontSize: 8, fontWeight: 800, color: '#2a2a2e',
      }}>{index + 1}</div>
    </div>
  );
}

// ── Theme picker card ─────────────────────────────────────────────
function ThemePickerCard({ theme, selected, onSelect }) {
  const td = [
    theme.underline     && 'underline',
    theme.strikethrough && 'line-through',
  ].filter(Boolean).join(' ') || 'none';

  const x      = theme.x      ?? 50;
  const y      = theme.y      ?? 50;
  const width  = theme.width  ?? 70;
  const height = theme.height ?? 40;

  return (
    <div
      onClick={() => onSelect(theme.id)}
      title={theme.name}
      style={{
        cursor: 'pointer', borderRadius: 8, overflow: 'hidden',
        border: selected
          ? '2px solid rgba(212,175,55,0.8)'
          : '1px solid #1e1e24',
        boxShadow: selected ? '0 0 0 1px rgba(212,175,55,0.25)' : 'none',
        background: '#000',
        transition: 'all 0.12s',
        flexShrink: 0,
      }}
    >
      {/* 16:9 preview surface */}
      <div style={{
        aspectRatio: '16/9', position: 'relative',
        containerType: 'inline-size', overflow: 'hidden',
      }}>
        <div style={{
          position:   'absolute',
          left:       `${x}%`,
          top:        `${y}%`,
          width:      `${width}%`,
          height:     `${height}%`,
          transform:  'translate(-50%, -50%)',
          display:    'flex', alignItems: 'center', justifyContent: 'center',
          textAlign:  'center', whiteSpace: 'pre-wrap', overflow: 'hidden',
          color:         theme.textColor  || '#fff',
          fontWeight:    theme.fontWeight || 800,
          fontSize:      `${theme.fontSize || 6}cqw`,
          fontFamily:    theme.fontFamily || 'Arial, sans-serif',
          textTransform: theme.transform  || 'none',
          fontStyle:     theme.italic ? 'italic' : 'normal',
          lineHeight:    theme.lineSpacing || 1.2,
          textDecoration: td,
        }}>
          Sample Text
        </div>
      </div>
      {/* Label */}
      <div style={{
        padding: '4px 6px',
        background: selected ? 'rgba(212,175,55,0.1)' : '#0a0a0c',
        borderTop: '1px solid #1e1e24',
        fontSize: 9, fontWeight: 700,
        color: selected ? '#D4AF37' : '#52525b',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {theme.name}
        {theme.id.startsWith('custom-') && (
          <span style={{ marginLeft: 4, fontSize: 8, color: '#D4AF37', opacity: 0.6 }}>Custom</span>
        )}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────
export default function TextImport({ state, onImport, onClose }) {
  const { libraries = [], playlists = [] } = state;

  const [text,          setText]          = useState('');
  const [linesPerSlide, setLinesPerSlide] = useState(2);
  const [destType,      setDestType]      = useState('library');
  const [destId,        setDestId]        = useState(libraries[0]?.id || '');
  const [songTitle,     setSongTitle]     = useState('');
  const [selectedThemeId, setSelectedThemeId] = useState('classic-white');
  const [customThemes,  setCustomThemes]  = useState([]);
  const textareaRef = useRef(null);

  // Load custom themes
  useEffect(() => { setCustomThemes(loadCustomThemes()); }, []);
  const allThemes = [...BUILTIN_THEMES, ...customThemes];
  const selectedTheme = allThemes.find(t => t.id === selectedThemeId) || BUILTIN_THEMES[0];

  // Auto-paste from clipboard on open
  useEffect(() => {
    navigator.clipboard.readText().then(clip => { if (clip?.trim()) setText(clip.trim()); }).catch(() => {});
  }, []);

  // Reset destId when type changes
  useEffect(() => {
    if (destType === 'library') setDestId(libraries[0]?.id || '');
    else setDestId(playlists[0]?.id || '');
  }, [destType, libraries, playlists]);

  const slides    = text.trim() ? buildSlides(text, linesPerSlide) : [];
  const canImport = slides.length > 0 && (destId || destType === 'none');

  const handleImport = () => {
    const title      = songTitle.trim() || 'Imported Song';
    const builtSlides = slides.map((t, i) => makeSlide(t, i, selectedTheme));
    onImport({ title, slides: builtSlides, destType, destId });
    onClose();
  };

  const LINE_OPTIONS = [1, 2, 3, 4];

  const C = {
    bg:      '#0a0a0c',
    surface: '#111115',
    raised:  '#16161c',
    border:  '#1e1e24',
    gold:    '#D4AF37',
    text:    '#e4e4e7',
    muted:   '#52525b',
    dim:     '#27272a',
  };

  return (
    <div style={{
      position:'fixed', inset:0,
      background:'rgba(0,0,0,0.85)', backdropFilter:'blur(12px)',
      display:'flex', alignItems:'center', justifyContent:'center',
      zIndex:9999,
      fontFamily:'-apple-system,BlinkMacSystemFont,"SF Pro Text",Arial,sans-serif',
    }}>
      <div style={{
        width:860, maxHeight:'92vh',
        background:C.surface, borderRadius:18,
        border:`1px solid ${C.border}`,
        boxShadow:'0 40px 120px rgba(0,0,0,0.9)',
        display:'flex', flexDirection:'column', overflow:'hidden',
      }}>

        {/* Header */}
        <div style={{
          padding:'18px 24px 16px',
          background:'linear-gradient(180deg,rgba(212,175,55,0.05) 0%,transparent 100%)',
          borderBottom:`1px solid ${C.border}`,
          display:'flex', alignItems:'center', justifyContent:'space-between',
          flexShrink:0,
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{
              width:36, height:36, borderRadius:10,
              background:'rgba(212,175,55,0.1)', border:'1px solid rgba(212,175,55,0.25)',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#D4AF37" strokeWidth="2" strokeLinecap="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14,2 14,8 20,8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize:15, fontWeight:700, color:C.text }}>Text Import</div>
              <div style={{ fontSize:10, color:C.muted, marginTop:1 }}>
                {slides.length > 0 ? `${slides.length} slides · Theme: ${selectedTheme.name}` : 'Paste lyrics to get started'}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{
            width:28, height:28, borderRadius:7, border:`1px solid ${C.border}`,
            background:'transparent', color:C.muted, cursor:'pointer', fontSize:16,
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

          {/* ── Left: controls ── */}
          <div style={{
            width:268, flexShrink:0, padding:'20px',
            borderRight:`1px solid ${C.border}`,
            display:'flex', flexDirection:'column', gap:18,
            overflowY:'auto',
          }}>

            {/* Song title */}
            <div>
              <div style={{ fontSize:9, fontWeight:800, letterSpacing:2, color:C.muted, marginBottom:8 }}>SONG TITLE</div>
              <input
                value={songTitle} onChange={e => setSongTitle(e.target.value)}
                placeholder="Amazing Grace"
                style={{
                  width:'100%', height:34, padding:'0 10px', boxSizing:'border-box',
                  background:C.raised, border:`1px solid ${C.border}`,
                  borderRadius:7, color:C.text, fontSize:12, outline:'none',
                }}
              />
            </div>

            {/* Lyrics */}
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <div style={{ fontSize:9, fontWeight:800, letterSpacing:2, color:C.muted, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span>LYRICS</span>
                <button onClick={() => navigator.clipboard.readText().then(c => setText(c.trim())).catch(()=>{})}
                  style={{
                    height:20, padding:'0 8px', borderRadius:4, cursor:'pointer',
                    background:'rgba(212,175,55,0.08)', border:'1px solid rgba(212,175,55,0.2)',
                    color:C.gold, fontSize:9, fontWeight:800,
                  }}>⌘ PASTE</button>
              </div>
              <textarea
                ref={textareaRef}
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => e.stopPropagation()}
                onPaste={e => e.stopPropagation()}
                placeholder={`Paste lyrics here…\n\nBlank lines = slide breaks`}
                style={{
                  minHeight:130, padding:'10px', resize:'none',
                  background:C.raised, border:`1px solid ${C.border}`,
                  borderRadius:8, color:C.text, fontSize:11, outline:'none',
                  lineHeight:1.6, fontFamily:'system-ui',
                }}
              />
            </div>

            {/* Lines per slide */}
            <div>
              <div style={{ fontSize:9, fontWeight:800, letterSpacing:2, color:C.muted, marginBottom:10 }}>LINES PER SLIDE</div>
              <div style={{ display:'flex', gap:6 }}>
                {LINE_OPTIONS.map(n => (
                  <button key={n} onClick={() => setLinesPerSlide(n)} style={{
                    flex:1, height:36, borderRadius:8, cursor:'pointer',
                    background: linesPerSlide===n ? 'rgba(212,175,55,0.12)' : C.raised,
                    border:`1px solid ${linesPerSlide===n ? 'rgba(212,175,55,0.45)' : C.border}`,
                    color: linesPerSlide===n ? C.gold : C.muted,
                    fontSize:16, fontWeight:800, transition:'all 0.12s',
                  }}>{n}</button>
                ))}
              </div>
            </div>

            {/* Destination */}
            <div>
              <div style={{ fontSize:9, fontWeight:800, letterSpacing:2, color:C.muted, marginBottom:10 }}>DESTINATION</div>
              <div style={{ display:'flex', gap:4, marginBottom:10 }}>
                {[['library','Library'],['playlist','Playlist']].map(([val,lbl]) => (
                  <button key={val} onClick={() => setDestType(val)} style={{
                    flex:1, height:28, borderRadius:6, cursor:'pointer', fontSize:10, fontWeight:700,
                    background: destType===val ? 'rgba(212,175,55,0.1)' : 'transparent',
                    border:`1px solid ${destType===val ? 'rgba(212,175,55,0.35)' : C.border}`,
                    color: destType===val ? C.gold : C.muted, transition:'all 0.12s',
                  }}>{lbl}</button>
                ))}
              </div>
              <select value={destId} onChange={e => setDestId(e.target.value)} style={{
                width:'100%', height:34,
                background:C.raised, border:`1px solid ${C.border}`,
                borderRadius:7, color:C.text, fontSize:12, padding:'0 10px',
                outline:'none', cursor:'pointer', appearance:'none',
                backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%2352525b'/%3E%3C/svg%3E")`,
                backgroundRepeat:'no-repeat', backgroundPosition:'right 10px center',
              }}>
                {(destType==='library' ? libraries : playlists).map(item => (
                  <option key={item.id} value={item.id}>{item.title || item.name}</option>
                ))}
                {(destType==='library' ? libraries : playlists).length === 0 && (
                  <option value="">No {destType==='library' ? 'libraries' : 'playlists'} found</option>
                )}
              </select>
            </div>
          </div>

          {/* ── Right: theme picker + preview ── */}
          <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

            {/* Theme picker strip */}
            <div style={{
              padding:'14px 20px 12px', borderBottom:`1px solid ${C.border}`, flexShrink:0,
            }}>
              <div style={{ fontSize:9, fontWeight:800, letterSpacing:2, color:C.muted, marginBottom:10 }}>
                THEME — <span style={{ color:C.gold }}>{selectedTheme.name}</span>
              </div>
              <div style={{
                display:'flex', gap:8, overflowX:'auto', paddingBottom:4,
              }}>
                {allThemes.map(theme => (
                  <div key={theme.id} style={{ width:100, flexShrink:0 }}>
                    <ThemePickerCard
                      theme={theme}
                      selected={selectedThemeId === theme.id}
                      onSelect={setSelectedThemeId}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Slide preview grid */}
            <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}>
              <div style={{
                fontSize:9, fontWeight:800, letterSpacing:2, color:C.muted, marginBottom:12,
                display:'flex', alignItems:'center', justifyContent:'space-between',
              }}>
                <span>PREVIEW — {slides.length} SLIDES</span>
              </div>

              {slides.length === 0 ? (
                <div style={{
                  height:'100%', display:'flex', alignItems:'center', justifyContent:'center',
                  flexDirection:'column', gap:12, paddingTop:60,
                }}>
                  <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#1e1e24" strokeWidth="1.5">
                    <rect x="2" y="3" width="20" height="14" rx="2"/>
                    <line x1="8" y1="21" x2="16" y2="21"/>
                    <line x1="12" y1="17" x2="12" y2="21"/>
                  </svg>
                  <div style={{ fontSize:12, color:C.dim }}>Paste lyrics to see a preview</div>
                </div>
              ) : (
                <div style={{
                  display:'grid',
                  gridTemplateColumns:'repeat(auto-fill, minmax(160px, 1fr))',
                  gap:10,
                }}>
                  {slides.map((t, i) => (
                    <SlidePreview key={i} text={t} index={i} theme={selectedTheme} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding:'14px 24px', borderTop:`1px solid ${C.border}`,
          display:'flex', gap:8, alignItems:'center', flexShrink:0,
        }}>
          <div style={{ fontSize:10, color:C.dim, flex:1 }}>
            {slides.length > 0 && (
              `"${songTitle || 'Imported Song'}" · ${slides.length} slides · ${selectedTheme.name} theme → ${
                destType==='library'
                  ? (libraries.find(l=>l.id===destId)?.title || 'Library')
                  : (playlists.find(p=>p.id===destId)?.title || 'Playlist')
              }`
            )}
          </div>
          <button onClick={onClose} style={{
            height:38, padding:'0 18px', borderRadius:9, cursor:'pointer',
            background:'transparent', border:`1px solid ${C.border}`,
            color:C.muted, fontSize:13, fontWeight:600,
          }}>Cancel</button>
          <button onClick={handleImport} disabled={!canImport} style={{
            height:38, padding:'0 24px', borderRadius:9,
            cursor: canImport ? 'pointer' : 'not-allowed',
            background: canImport ? 'rgba(212,175,55,0.12)' : 'transparent',
            border:`1px solid ${canImport ? 'rgba(212,175,55,0.45)' : C.border}`,
            color: canImport ? C.gold : C.dim,
            fontSize:13, fontWeight:700, transition:'all 0.15s',
          }}>
            Import {slides.length > 0 ? `${slides.length} Slides` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}