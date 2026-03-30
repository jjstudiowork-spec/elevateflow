/**
 * ThemeEditor.jsx
 * Full-screen theme editor — same UX as EditMode but for a single
 * "demo slide" that defines a theme's typography style.
 * Saving writes a custom theme to localStorage.
 */
import React, { useRef, useEffect, useCallback, useState } from 'react';

const THEME_STORAGE_KEY = 'elevateflow_custom_themes';

function loadCustomThemes() {
  try { return JSON.parse(localStorage.getItem(THEME_STORAGE_KEY) || '[]'); }
  catch { return []; }
}
function saveCustomThemesToStorage(themes) {
  localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(themes));
}

// ── Default demo slide ─────────────────────────────────────────
const DEFAULT_DEMO_SLIDE = {
  id: 'theme-editor-demo',
  text: `AMAZING GRACE
HOW SWEET THE SOUND`,
  textColor:    '#ffffff',
  fontFamily:   'Arial, sans-serif',
  fontSize:     6,
  fontWeight:   800,
  italic:       false,
  underline:    false,
  strikethrough: false,
  transform:    'uppercase',
  lineSpacing:  1.2,
  x: 50, y: 50, width: 70, height: 40,
};

// ── Canvas ─────────────────────────────────────────────────────
function ThemeCanvas({ slide, isTyping, onDoubleClick, onTextBlur, onTextKeyDown, onUpdate }) {
  const editableRef = useRef(null);
  const textBoxRef  = useRef(null);
  const dragState   = useRef(null);

  useEffect(() => {
    if (!editableRef.current || isTyping) return;
    editableRef.current.innerText = slide.text || '';
  }, [slide.id, isTyping]);

  useEffect(() => {
    if (isTyping && editableRef.current) {
      editableRef.current.focus();
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(editableRef.current);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }, [isTyping]);

  // ── Drag textbox (same as EditMode) ────────────────────────
  const handleObjectMouseDown = useCallback((e) => {
    if (isTyping) return;
    e.stopPropagation(); e.preventDefault();
    const surface = e.currentTarget.closest('.theme-editor__surface');
    if (!surface) return;
    const r = surface.getBoundingClientRect();
    const mx = ((e.clientX - r.left) / r.width)  * 100;
    const my = ((e.clientY - r.top)  / r.height) * 100;
    dragState.current = { surface, ox: mx - (slide.x ?? 50), oy: my - (slide.y ?? 50) };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'move';
    const onMove = (ev) => {
      const dr = dragState.current?.surface.getBoundingClientRect();
      if (!dr) return;
      let nx = ((ev.clientX - dr.left) / dr.width)  * 100 - dragState.current.ox;
      let ny = ((ev.clientY - dr.top)  / dr.height) * 100 - dragState.current.oy;
      if (Math.abs(nx - 50) < 1.5) nx = 50;
      if (Math.abs(ny - 50) < 1.5) ny = 50;
      dragState.current.nx = nx; dragState.current.ny = ny;
      if (textBoxRef.current) { textBoxRef.current.style.left = nx + '%'; textBoxRef.current.style.top = ny + '%'; }
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = ''; document.body.style.cursor = '';
      if (dragState.current?.nx !== undefined) { onUpdate('x', dragState.current.nx); onUpdate('y', dragState.current.ny); }
      dragState.current = null;
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseup', onUp);
  }, [isTyping, slide.x, slide.y, onUpdate]);

  // ── Resize handles ──────────────────────────────────────────
  const handleResizeMouseDown = useCallback((handle, e) => {
    e.stopPropagation(); e.preventDefault();
    const surface = textBoxRef.current?.closest('.theme-editor__surface');
    if (!surface) return;
    const ox = slide.x ?? 50, oy = slide.y ?? 50;
    const ow = slide.width ?? 70, oh = slide.height ?? 40;
    const r2 = ox + ow/2, l = ox - ow/2, b = oy + oh/2, t = oy - oh/2;
    document.body.style.userSelect = 'none';
    const onMove = (ev) => {
      const dr = surface.getBoundingClientRect();
      let mx = ((ev.clientX - dr.left) / dr.width) * 100;
      let my = ((ev.clientY - dr.top)  / dr.height) * 100;
      let nx = ox, ny = oy, nw = ow, nh = oh;
      if (handle.includes('e')) { nw = Math.max(5, mx - l); nx = l + nw/2; }
      if (handle.includes('w')) { nw = Math.max(5, r2 - mx); nx = r2 - nw/2; }
      if (handle.includes('s')) { nh = Math.max(5, my - t); ny = t + nh/2; }
      if (handle.includes('n')) { nh = Math.max(5, b - my); ny = b - nh/2; }
      if (textBoxRef.current) { textBoxRef.current.style.left = nx+'%'; textBoxRef.current.style.top = ny+'%'; textBoxRef.current.style.width = nw+'%'; textBoxRef.current.style.height = nh+'%'; }
      dragState.current = { nx, ny, nw, nh };
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
      if (dragState.current) { const { nx, ny, nw, nh } = dragState.current; onUpdate('x', nx); onUpdate('y', ny); onUpdate('width', nw); onUpdate('height', nh); dragState.current = null; }
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseup', onUp);
  }, [slide, onUpdate]);

  const HANDLES = ['n','s','e','w','ne','nw','se','sw'];

  return (
    <div className="theme-editor__canvas">
      <div className="theme-editor__canvas-inner theme-editor__surface" style={{ aspectRatio: '16/9', containerType: 'inline-size', position: 'relative' }}>
        <div className="theme-editor__canvas-bg" />

        <div
          ref={textBoxRef}
          className={`text-box ${!isTyping ? 'text-box--selected' : ''}`}
          style={{ left: `${slide.x ?? 50}%`, top: `${slide.y ?? 50}%`, width: `${slide.width ?? 70}%`, height: `${slide.height ?? 40}%`, transform: 'translate(-50%, -50%)', cursor: isTyping ? 'text' : 'move' }}
          onMouseDown={handleObjectMouseDown}
          onDoubleClick={onDoubleClick}
        >
          <div
            ref={editableRef}
            contentEditable={isTyping}
            suppressContentEditableWarning
            className={`text-box__content ${isTyping ? 'text-box__content--editing' : ''}`}
            style={{ color: slide.textColor || '#fff', fontWeight: slide.fontWeight || 800, fontSize: `${slide.fontSize || 6}cqw`, fontFamily: slide.fontFamily || 'Arial, sans-serif', textTransform: slide.transform || 'none', fontStyle: slide.italic ? 'italic' : 'normal', lineHeight: slide.lineSpacing || 1.2, whiteSpace: 'pre-wrap', textDecoration: [slide.underline && 'underline', slide.strikethrough && 'line-through'].filter(Boolean).join(' ') || 'none', pointerEvents: isTyping ? 'auto' : 'none', outline: 'none' }}
            onBlur={onTextBlur}
            onKeyDown={onTextKeyDown}
            onPaste={e => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain')); }}
          />
          {/* Resize handles */}
          {!isTyping && HANDLES.map(h => (
            <div key={h} onMouseDown={e => handleResizeMouseDown(h, e)}
              className={`text-box__handle text-box__handle--${h}`} />
          ))}
        </div>

        <div className="theme-editor__canvas-hint">Drag to move · Drag edges to resize · Double-click to edit text</div>
      </div>
    </div>
  );
}

// ── Inspector (same Text inspector as EditMode) ─────────────────
function ThemeInspector({ slide, onUpdate }) {
  const [systemFonts, setSystemFonts] = React.useState([]);
  const [fontsLoaded, setFontsLoaded] = React.useState(false);

  React.useEffect(() => {
    import('@tauri-apps/api/core').then(({ invoke }) => {
      invoke('get_system_fonts')
        .then(fonts => { setSystemFonts(fonts); setFontsLoaded(true); })
        .catch(() => setFontsLoaded(true));
    });
  }, []);

  const FALLBACK_FONTS = [
    'Arial', 'Helvetica', 'Georgia', 'Times New Roman',
    'Courier New', 'Impact', 'Verdana', 'Trebuchet MS',
  ];
  const fontList = fontsLoaded && systemFonts.length > 0 ? systemFonts : FALLBACK_FONTS;
  const currentFamily = (slide.fontFamily || 'Arial, sans-serif')
    .replace(/['"]/g, '').split(',')[0].trim();

  return (
    <div className="inspector">
      <div className="inspector__tabs">
        <button className="inspector__tab inspector__tab--active">Typography</button>
      </div>
      <div className="inspector__body">
        <div className="inspector-group">
          <div className="inspector-group__label">FONT</div>

          <div className="inspector-field">
            <label className="inspector-field__label">
              Family {!fontsLoaded && <span style={{ color: '#333', fontWeight: 400 }}>loading…</span>}
            </label>
            <select className="inspector-select"
              value={currentFamily}
              onChange={e => onUpdate('fontFamily', e.target.value)}
            >
              {fontList.map(name => (
                <option key={name} value={name} style={{ fontFamily: name }}>{name}</option>
              ))}
              {fontsLoaded && !fontList.includes(currentFamily) && (
                <option value={currentFamily}>{currentFamily}</option>
              )}
            </select>
          </div>

          <div className="inspector-field">
            <label className="inspector-field__label">Size</label>
            <div className="inspector-slider-row">
              <input type="range" min="1" max="20" step="0.5" className="inspector-slider"
                value={slide.fontSize || 6}
                onChange={e => onUpdate('fontSize', parseFloat(e.target.value))} />
              <span className="inspector-slider-value">{slide.fontSize || 6}</span>
            </div>
          </div>

          <div className="inspector-field">
            <label className="inspector-field__label">Spacing</label>
            <div className="inspector-slider-row">
              <input type="range" min="0.8" max="3" step="0.05" className="inspector-slider"
                value={slide.lineSpacing || 1.2}
                onChange={e => onUpdate('lineSpacing', parseFloat(e.target.value))} />
              <span className="inspector-slider-value">{(slide.lineSpacing || 1.2).toFixed(2)}</span>
            </div>
          </div>

          <div className="inspector-group__label" style={{ marginTop: 12 }}>FORMATTING</div>
          <div className="inspector-format-grid">
            {[
              { label: 'B', style: { fontWeight: 800 }, active: slide.fontWeight === 800,
                onClick: () => onUpdate('fontWeight', slide.fontWeight === 800 ? 400 : 800) },
              { label: 'I', style: { fontStyle: 'italic' }, active: slide.italic,
                onClick: () => onUpdate('italic', !slide.italic) },
              { label: 'U', style: { textDecoration: 'underline' }, active: slide.underline,
                onClick: () => onUpdate('underline', !slide.underline) },
              { label: 'S', style: { textDecoration: 'line-through' }, active: slide.strikethrough,
                onClick: () => onUpdate('strikethrough', !slide.strikethrough) },
            ].map(({ label, style, active, onClick }) => (
              <button key={label}
                className={`format-btn ${active ? 'format-btn--active' : ''}`}
                style={style} onClick={onClick}
              >{label}</button>
            ))}
          </div>

          <div className="inspector-field" style={{ marginTop: 12 }}>
            <label className="inspector-field__label">Transform</label>
            <select className="inspector-select"
              value={slide.transform || 'none'}
              onChange={e => onUpdate('transform', e.target.value)}
            >
              <option value="none">None</option>
              <option value="uppercase">UPPERCASE</option>
              <option value="lowercase">lowercase</option>
              <option value="capitalize">Capitalize</option>
            </select>
          </div>

          <div className="inspector-field">
            <label className="inspector-field__label">Color</label>
            <div className="inspector-color-row">
              <input type="color" className="inspector-color-picker"
                value={slide.textColor || '#ffffff'}
                onChange={e => onUpdate('textColor', e.target.value)} />
              <span className="inspector-color-value">
                {(slide.textColor || '#ffffff').toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Position & Size */}
        <div className="inspector-group">
          <div className="inspector-group__label">TEXT BOX POSITION</div>
          <div className="inspector-field">
            <label className="inspector-field__label">X %</label>
            <div className="inspector-slider-row">
              <input type="range" min="0" max="100" step="1" className="inspector-slider"
                value={slide.x ?? 50}
                onChange={e => onUpdate('x', parseInt(e.target.value))} />
              <span className="inspector-slider-value">{slide.x ?? 50}</span>
            </div>
          </div>
          <div className="inspector-field">
            <label className="inspector-field__label">Y %</label>
            <div className="inspector-slider-row">
              <input type="range" min="0" max="100" step="1" className="inspector-slider"
                value={slide.y ?? 50}
                onChange={e => onUpdate('y', parseInt(e.target.value))} />
              <span className="inspector-slider-value">{slide.y ?? 50}</span>
            </div>
          </div>
          <div className="inspector-group__label" style={{ marginTop: 10 }}>TEXT BOX SIZE</div>
          <div className="inspector-field">
            <label className="inspector-field__label">Width %</label>
            <div className="inspector-slider-row">
              <input type="range" min="10" max="100" step="1" className="inspector-slider"
                value={slide.width ?? 70}
                onChange={e => onUpdate('width', parseInt(e.target.value))} />
              <span className="inspector-slider-value">{slide.width ?? 70}</span>
            </div>
          </div>
          <div className="inspector-field">
            <label className="inspector-field__label">Height %</label>
            <div className="inspector-slider-row">
              <input type="range" min="5" max="100" step="1" className="inspector-slider"
                value={slide.height ?? 40}
                onChange={e => onUpdate('height', parseInt(e.target.value))} />
              <span className="inspector-slider-value">{slide.height ?? 40}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main ThemeEditor ───────────────────────────────────────────
export default function ThemeEditor({ dispatch }) {
  const [slide, setSlide]       = useState({ ...DEFAULT_DEMO_SLIDE });
  const [isTyping, setIsTyping] = useState(false);
  const [themeName, setThemeName] = useState('');
  const [saved, setSaved]       = useState(false);

  const update = useCallback((key, val) => {
    setSlide(prev => ({ ...prev, [key]: val }));
    setSaved(false);
  }, []);

  const handleTextBlur = useCallback((e) => {
    update('text', e.currentTarget.innerText);
    setIsTyping(false);
  }, [update]);

  const handleTextKeyDown = useCallback((e) => {
    e.stopPropagation();
    if (e.key === 'Escape') { update('text', e.currentTarget.innerText); setIsTyping(false); return; }
    if (e.key === 'Enter') { e.preventDefault(); document.execCommand('insertText', false, '\n'); }
  }, [update]);

  const handleSave = useCallback(() => {
    const name = themeName.trim() || 'Custom Theme';
    const newTheme = {
      id: `custom-${Date.now()}`,
      name,
      fontFamily:    slide.fontFamily,
      fontSize:      slide.fontSize,
      fontWeight:    slide.fontWeight,
      textColor:     slide.textColor,
      transform:     slide.transform,
      italic:        slide.italic,
      underline:     slide.underline,
      strikethrough: slide.strikethrough,
      lineSpacing:   slide.lineSpacing,
      // Position & size
      x:      slide.x,
      y:      slide.y,
      width:  slide.width,
      height: slide.height,
    };
    const existing = loadCustomThemes();
    saveCustomThemesToStorage([...existing, newTheme]);
    setSaved(true);
    // Go back to show mode
    setTimeout(() => dispatch({ type: 'SET_MODE', payload: 'show' }), 700);
  }, [slide, themeName, dispatch]);

  return (
    <div className="theme-editor">

      {/* ── Top bar ── */}
      <div className="theme-editor__topbar">
        <button
          className="theme-editor__back"
          onClick={() => dispatch({ type: 'SET_MODE', payload: 'show' })}
        >
          ← Back
        </button>

        <div className="theme-editor__topbar-center">
          <span className="theme-editor__topbar-label">THEME EDITOR</span>
        </div>

        <div className="theme-editor__save-row">
          <input
            className="theme-editor__name-input"
            placeholder="Theme name…"
            value={themeName}
            onChange={e => { setThemeName(e.target.value); setSaved(false); }}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
          />
          <button
            className={`theme-editor__save-btn ${saved ? 'theme-editor__save-btn--saved' : ''}`}
            onClick={handleSave}
          >
            {saved ? '✓ Saved' : 'Save Theme'}
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="theme-editor__body">
        <ThemeCanvas
          slide={slide}
          isTyping={isTyping}
          onDoubleClick={() => setIsTyping(true)}
          onTextBlur={handleTextBlur}
          onTextKeyDown={handleTextKeyDown}
          onUpdate={update}
        />
        <ThemeInspector slide={slide} onUpdate={update} />
      </div>
    </div>
  );
}