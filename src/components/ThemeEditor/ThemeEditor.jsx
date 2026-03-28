/**
 * ThemeEditor.jsx
 * Full-screen theme editor. Drag & resize the text box just like EditMode.
 * Position (x, y, width, height), font, size, colour are all saved to the theme
 * and applied when the theme is used on a slide or in TextImport.
 */
import React, { useRef, useEffect, useCallback, useState } from 'react';

const THEME_STORAGE_KEY = 'elevateflow_custom_themes';

export function loadCustomThemes() {
  try { return JSON.parse(localStorage.getItem(THEME_STORAGE_KEY) || '[]'); }
  catch { return []; }
}
function saveCustomThemesToStorage(themes) {
  localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(themes));
}

// ── Default demo slide ──────────────────────────────────────────
const DEFAULT_DEMO_SLIDE = {
  id: 'theme-editor-demo',
  text: 'Sample Text',
  textColor:     '#ffffff',
  fontFamily:    'Arial, sans-serif',
  fontSize:      6,
  fontWeight:    800,
  italic:        false,
  underline:     false,
  strikethrough: false,
  transform:     'none',
  lineSpacing:   1.2,
  x: 50, y: 50, width: 70, height: 40,
};

// ── Resize handle directions ────────────────────────────────────
const HANDLES = [
  { id: 'nw', style: { top: -5, left: -5,             cursor: 'nw-resize' } },
  { id: 'ne', style: { top: -5, right: -5,            cursor: 'ne-resize' } },
  { id: 'se', style: { bottom: -5, right: -5,         cursor: 'se-resize' } },
  { id: 'sw', style: { bottom: -5, left: -5,          cursor: 'sw-resize' } },
  { id: 'n',  style: { top: -5, left: 'calc(50% - 4px)', cursor: 'n-resize' } },
  { id: 's',  style: { bottom: -5, left: 'calc(50% - 4px)', cursor: 's-resize' } },
  { id: 'e',  style: { top: 'calc(50% - 4px)', right: -5,  cursor: 'e-resize' } },
  { id: 'w',  style: { top: 'calc(50% - 4px)', left: -5,   cursor: 'w-resize' } },
];

// ── Canvas with drag/resize ─────────────────────────────────────
function ThemeCanvas({ slide, isTyping, onDoubleClick, onTextBlur, onTextKeyDown, onPositionChange }) {
  const editableRef = useRef(null);
  const canvasRef   = useRef(null);
  const dragRef     = useRef(null); // { mode, startX, startY, snap }

  // Sync editable content when not typing
  useEffect(() => {
    if (!editableRef.current || isTyping) return;
    editableRef.current.innerText = slide.text || '';
  }, [slide.id, isTyping]);

  // Focus + caret when entering typing mode
  useEffect(() => {
    if (isTyping && editableRef.current) {
      editableRef.current.focus();
      const range = document.createRange();
      const sel   = window.getSelection();
      range.selectNodeContents(editableRef.current);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }, [isTyping]);

  const startDrag = useCallback((e, mode) => {
    if (isTyping) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = {
      mode,
      startX:  e.clientX,
      startY:  e.clientY,
      rectW:   rect.width,
      rectH:   rect.height,
      snap:    { ...slide },   // snapshot of slide at drag start
    };
  }, [isTyping, slide]);

  useEffect(() => {
    const onMove = (e) => {
      if (!dragRef.current) return;
      const { mode, startX, startY, rectW, rectH, snap } = dragRef.current;
      const dx = (e.clientX - startX) / rectW * 100;
      const dy = (e.clientY - startY) / rectH * 100;

      let { x, y, width, height } = snap;
      // Snapping to centre
      let nx = x, ny = y, nw = width, nh = height;

      if (mode === 'move') {
        nx = snap.x + dx;
        ny = snap.y + dy;
        if (Math.abs(nx - 50) < 1.5) nx = 50;
        if (Math.abs(ny - 50) < 1.5) ny = 50;
      } else {
        // Derive box edges from centre + half-size
        const r = x + width / 2, l = x - width / 2;
        const b = y + height / 2, t = y - height / 2;

        let newR = r, newL = l, newT = t, newB = b;
        if (mode.includes('e')) newR = r + dx;
        if (mode.includes('w')) newL = l + dx;
        if (mode.includes('s')) newB = b + dy;
        if (mode.includes('n')) newT = t + dy;

        nw = Math.max(10, newR - newL);
        nh = Math.max(5,  newB - newT);
        nx = newL + nw / 2;
        ny = newT + nh / 2;
      }

      onPositionChange({ x: nx, y: ny, width: nw, height: nh });
    };

    const onUp = () => { dragRef.current = null; };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
  }, [onPositionChange]);

  const textDecoration = [
    slide.underline     && 'underline',
    slide.strikethrough && 'line-through',
  ].filter(Boolean).join(' ') || 'none';

  return (
    <div className="theme-editor__canvas">
      <div
        ref={canvasRef}
        className="theme-editor__canvas-inner"
        style={{ aspectRatio: '16/9', containerType: 'inline-size', position: 'relative' }}
      >
        {/* Background */}
        <div className="theme-editor__canvas-bg" />

        {/* Smart guides */}
        {dragRef.current?.mode === 'move' && Math.abs(slide.x - 50) < 1.5 && (
          <div className="smart-guide smart-guide--v" />
        )}
        {dragRef.current?.mode === 'move' && Math.abs(slide.y - 50) < 1.5 && (
          <div className="smart-guide smart-guide--h" />
        )}

        {/* Draggable text box */}
        <div
          className={`text-box ${!isTyping ? 'text-box--selected' : ''}`}
          style={{
            left:      `${slide.x}%`,
            top:       `${slide.y}%`,
            width:     `${slide.width}%`,
            height:    `${slide.height}%`,
            transform: 'translate(-50%, -50%)',
            cursor:    isTyping ? 'text' : 'move',
          }}
          onMouseDown={e => startDrag(e, 'move')}
          onDoubleClick={onDoubleClick}
        >
          {/* Editable text */}
          <div
            ref={editableRef}
            contentEditable={isTyping}
            suppressContentEditableWarning
            className={`text-box__content ${isTyping ? 'text-box__content--editing' : ''}`}
            style={{
              color:          slide.textColor  || '#fff',
              fontWeight:     slide.fontWeight || 800,
              fontSize:       `${slide.fontSize || 6}cqw`,
              fontFamily:     slide.fontFamily || 'Arial, sans-serif',
              textTransform:  slide.transform  || 'none',
              fontStyle:      slide.italic ? 'italic' : 'normal',
              lineHeight:     slide.lineSpacing || 1.2,
              whiteSpace:     'pre-wrap',
              textDecoration,
              pointerEvents:  isTyping ? 'auto' : 'none',
              outline:        'none',
            }}
            onBlur={onTextBlur}
            onKeyDown={onTextKeyDown}
            onPaste={e => {
              e.preventDefault();
              document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
            }}
          />

          {/* Resize handles — only when selected and not typing */}
          {!isTyping && HANDLES.map(({ id, style }) => (
            <div
              key={id}
              className="transform-handle"
              style={{ ...style, position: 'absolute', width: 8, height: 8 }}
              onMouseDown={e => startDrag(e, id)}
            />
          ))}
        </div>

        <div className="theme-editor__canvas-hint" style={{ pointerEvents: 'none' }}>
          {isTyping ? 'Press Esc to finish editing' : 'Drag to reposition · Double-click to edit text'}
        </div>
      </div>
    </div>
  );
}

// ── Inspector ───────────────────────────────────────────────────
function ThemeInspector({ slide, onUpdate }) {
  const [systemFonts, setSystemFonts] = useState([]);
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    import('@tauri-apps/api/core').then(({ invoke }) => {
      invoke('get_system_fonts')
        .then(fonts => { setSystemFonts(fonts); setFontsLoaded(true); })
        .catch(() => setFontsLoaded(true));
    });
  }, []);

  const FALLBACK_FONTS = [
    'Arial','Helvetica','Georgia','Times New Roman',
    'Courier New','Impact','Verdana','Trebuchet MS','Inter','Poppins',
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

        {/* Position readout */}
        <div className="inspector-group">
          <div className="inspector-group__label">POSITION</div>
          <div className="inspector-prop-grid">
            {[
              { k: 'x',      label: 'X',  v: Math.round(slide.x)      },
              { k: 'y',      label: 'Y',  v: Math.round(slide.y)      },
              { k: 'width',  label: 'W',  v: Math.round(slide.width)  },
              { k: 'height', label: 'H',  v: Math.round(slide.height) },
            ].map(({ k, label, v }) => (
              <div key={k} className="prop-box">
                <span className="prop-box__label">{label}</span>
                <span className="prop-box__value">{v}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="inspector-group">
          <div className="inspector-group__label">FONT</div>

          <div className="inspector-field">
            <label className="inspector-field__label">
              Family {!fontsLoaded && <span style={{ color:'#333', fontWeight:400 }}>loading…</span>}
            </label>
            <select className="inspector-select" value={currentFamily}
              onChange={e => onUpdate('fontFamily', e.target.value)}>
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
            <label className="inspector-field__label">Line Spacing</label>
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
              { label:'B', style:{ fontWeight:800 },          active: slide.fontWeight===800,  onClick:()=>onUpdate('fontWeight', slide.fontWeight===800?400:800) },
              { label:'I', style:{ fontStyle:'italic' },      active: slide.italic,            onClick:()=>onUpdate('italic',     !slide.italic) },
              { label:'U', style:{ textDecoration:'underline'},active: slide.underline,         onClick:()=>onUpdate('underline',  !slide.underline) },
              { label:'S', style:{ textDecoration:'line-through'},active:slide.strikethrough,   onClick:()=>onUpdate('strikethrough',!slide.strikethrough) },
            ].map(({ label, style, active, onClick }) => (
              <button key={label}
                className={`format-btn ${active ? 'format-btn--active' : ''}`}
                style={style} onClick={onClick}
              >{label}</button>
            ))}
          </div>

          <div className="inspector-field" style={{ marginTop: 12 }}>
            <label className="inspector-field__label">Transform</label>
            <select className="inspector-select" value={slide.transform || 'none'}
              onChange={e => onUpdate('transform', e.target.value)}>
              <option value="none">None</option>
              <option value="uppercase">UPPERCASE</option>
              <option value="lowercase">lowercase</option>
              <option value="capitalize">Capitalize</option>
            </select>
          </div>

          <div className="inspector-field">
            <label className="inspector-field__label">Text Color</label>
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
      </div>
    </div>
  );
}

// ── Main ThemeEditor ────────────────────────────────────────────
export default function ThemeEditor({ dispatch }) {
  const [slide,     setSlide]     = useState({ ...DEFAULT_DEMO_SLIDE });
  const [isTyping,  setIsTyping]  = useState(false);
  const [themeName, setThemeName] = useState('');
  const [saved,     setSaved]     = useState(false);

  const update = useCallback((key, val) => {
    setSlide(prev => ({ ...prev, [key]: val }));
    setSaved(false);
  }, []);

  // Batch position update from drag
  const handlePositionChange = useCallback(({ x, y, width, height }) => {
    setSlide(prev => ({ ...prev, x, y, width, height }));
    setSaved(false);
  }, []);

  const handleTextBlur = useCallback((e) => {
    update('text', e.currentTarget.innerText);
    setIsTyping(false);
  }, [update]);

  const handleTextKeyDown = useCallback((e) => {
    e.stopPropagation();
    if (e.key === 'Escape') { update('text', e.currentTarget.innerText); setIsTyping(false); return; }
    if (e.key === 'Enter')  { e.preventDefault(); document.execCommand('insertText', false, '\n'); }
  }, [update]);

  const handleSave = useCallback(() => {
    const name = themeName.trim() || 'Custom Theme';
    const newTheme = {
      id:            `custom-${Date.now()}`,
      name,
      // Typography
      fontFamily:    slide.fontFamily,
      fontSize:      slide.fontSize,
      fontWeight:    slide.fontWeight,
      textColor:     slide.textColor,
      transform:     slide.transform,
      italic:        slide.italic,
      underline:     slide.underline,
      strikethrough: slide.strikethrough,
      lineSpacing:   slide.lineSpacing,
      // Position — applied to slides when theme is used
      x:             slide.x,
      y:             slide.y,
      width:         slide.width,
      height:        slide.height,
    };
    const existing = loadCustomThemes();
    saveCustomThemesToStorage([...existing, newTheme]);
    setSaved(true);
    setTimeout(() => dispatch({ type: 'SET_MODE', payload: 'show' }), 700);
  }, [slide, themeName, dispatch]);

  return (
    <div className="theme-editor">

      {/* Top bar */}
      <div className="theme-editor__topbar">
        <button className="theme-editor__back"
          onClick={() => dispatch({ type: 'SET_MODE', payload: 'show' })}>
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

      {/* Body */}
      <div className="theme-editor__body">
        <ThemeCanvas
          slide={slide}
          isTyping={isTyping}
          onDoubleClick={() => setIsTyping(true)}
          onTextBlur={handleTextBlur}
          onTextKeyDown={handleTextKeyDown}
          onPositionChange={handlePositionChange}
        />
        <ThemeInspector slide={slide} onUpdate={update} />
      </div>
    </div>
  );
}