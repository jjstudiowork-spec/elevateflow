/**
 * EditMode.jsx — ElevateFlow edit canvas
 * Fixes: Enter key newline, white-space pre-wrap, line spacing,
 *        copy/paste style, default font Arial, video on canvas.
 */
import React, { useRef, useCallback, useEffect } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';

// ── Filmstrip ──────────────────────────────────────────────────
function Filmstrip({ slides, selectedSlideId, onSelect }) {
  return (
    <div className="filmstrip">
      <div className="filmstrip__header">SLIDES</div>
      {slides.map((slide, i) => {
        const videoSrc = slide.video
          ? (slide.video.startsWith('asset://') || slide.video.startsWith('http') || slide.video.startsWith('blob:')
              ? slide.video
              : convertFileSrc(slide.video))
          : null;
        return (
          <div
            key={slide.id}
            className={`filmstrip__item ${slide.id === selectedSlideId ? 'filmstrip__item--active' : ''}`}
            onClick={() => onSelect(slide.id)}
          >
            <span className="filmstrip__index">{i + 1}</span>
            <div className="filmstrip__thumb" style={{ containerType: 'inline-size', position: 'relative', overflow: 'hidden' }}>
              {videoSrc && (
                <video
                  src={videoSrc + '#t=0.001'}
                  className="filmstrip__thumb-video"
                  muted playsInline preload="metadata"
                />
              )}
              {/* Text positioned to match show mode exactly */}
              <div style={{
                position: 'absolute',
                left:   `${slide.x ?? 50}%`,
                top:    `${slide.y ?? 50}%`,
                width:  `${slide.width ?? 60}%`,
                height: `${slide.height ?? 30}%`,
                transform: 'translate(-50%, -50%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: `${slide.fontSize || 5}cqw`,
                fontWeight: slide.fontWeight || 800,
                color: slide.textColor || '#fff',
                fontFamily: slide.fontFamily || 'Arial, sans-serif',
                textTransform: slide.transform || 'none',
                lineHeight: slide.lineSpacing || 1.2,
                whiteSpace: 'pre-wrap',
                textAlign: 'center',
                overflow: 'hidden',
              }}>
                {slide.text}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Transform handles ──────────────────────────────────────────
function TransformHandles({ onHandleMouseDown }) {
  const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  return (
    <>
      {handles.map(h => (
        <div
          key={h}
          className={`transform-handle transform-handle--${h}`}
          onMouseDown={e => { onHandleMouseDown(h, e); }}
        />
      ))}
    </>
  );
}

// ── Edit Canvas ────────────────────────────────────────────────
function EditCanvas({
  selectedSlide, canvasRatio,
  isObjectSelected, isTyping,
  isCenteredX, isCenteredY,
  onCanvasMouseDown,
  onObjectMouseDown, onDoubleClick,
  onHandleMouseDown,
  onTextBlur, onTextKeyDown,
  textBoxRef,
  dispatch,
}) {
  const editableRef = useRef(null);

  // Sync text content into the DOM when slide changes or editing starts,
  // but only when NOT actively typing (so we don't reset the cursor).
  useEffect(() => {
    if (!editableRef.current || isTyping) return;
    editableRef.current.innerText = selectedSlide?.text || '';
  }, [selectedSlide?.id, isTyping]);

  // Focus the editable div when typing starts
  useEffect(() => {
    if (isTyping && editableRef.current) {
      editableRef.current.focus();
      // Move cursor to end
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(editableRef.current);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }, [isTyping]);

  if (!selectedSlide) {
    return (
      <div className="edit-canvas">
        <div className="edit-canvas__empty"><span>Select a slide to edit</span></div>
      </div>
    );
  }

  const videoSrc = selectedSlide.video
    ? (selectedSlide.video.startsWith('asset://') || selectedSlide.video.startsWith('http')
        ? selectedSlide.video
        : convertFileSrc(selectedSlide.video))
    : null;

  return (
    <div
      className="edit-canvas"
      onMouseDown={onCanvasMouseDown}
    >
      {isObjectSelected && isCenteredX && <div className="smart-guide smart-guide--v" />}
      {isObjectSelected && isCenteredY && <div className="smart-guide smart-guide--h" />}

      <div className="edit-canvas__surface" style={{ aspectRatio: canvasRatio, containerType: 'inline-size' }}>
        {videoSrc && (
          <video src={videoSrc} className="edit-canvas__bg-video" autoPlay muted loop playsInline />
        )}

        <div
          ref={textBoxRef}
          className={`text-box ${isObjectSelected ? 'text-box--selected' : ''}`}
          style={{
            left: `${selectedSlide.x ?? 50}%`,
            top: `${selectedSlide.y ?? 50}%`,
            width: `${selectedSlide.width ?? 60}%`,
            height: `${selectedSlide.height ?? 30}%`,
            transform: 'translate(-50%, -50%)',
            willChange: 'left, top',
          }}
          onMouseDown={onObjectMouseDown}
          onDoubleClick={onDoubleClick}
        >
          {isObjectSelected && <TransformHandles onHandleMouseDown={onHandleMouseDown} />}

          <div
            ref={editableRef}
            contentEditable={isTyping}
            suppressContentEditableWarning
            className={`text-box__content ${isTyping ? 'text-box__content--editing' : ''}`}
            style={{
              color:          selectedSlide.textColor  || '#fff',
              fontWeight:     selectedSlide.fontWeight || 800,
              fontSize:       `${selectedSlide.fontSize || 5}cqw`,
              fontFamily:     selectedSlide.fontFamily || 'Arial, sans-serif',
              textTransform:  selectedSlide.transform  || 'none',
              fontStyle:      selectedSlide.italic ? 'italic' : 'normal',
              lineHeight:     selectedSlide.lineSpacing || 1.2,
              whiteSpace:     'pre-wrap',
              textDecoration: [
                selectedSlide.underline     && 'underline',
                selectedSlide.strikethrough && 'line-through',
              ].filter(Boolean).join(' ') || 'none',
              pointerEvents: isTyping ? 'auto' : 'none',
              outline: 'none',
            }}
            onBlur={onTextBlur}
            onKeyDown={onTextKeyDown}
            onPaste={e => {
              e.preventDefault();
              const text = e.clipboardData.getData('text/plain');
              document.execCommand('insertText', false, text);
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ── Shape Inspector ────────────────────────────────────────────
function ShapeInspector({ slide }) {
  if (!slide) return <div className="inspector__empty">No slide selected</div>;
  return (
    <div className="inspector-group">
      <div className="inspector-group__label">POSITION & SIZE</div>
      <div className="inspector-prop-grid">
        <PropBox label="X" value={Math.round(slide.x ?? 50)} />
        <PropBox label="Y" value={Math.round(slide.y ?? 50)} />
        <PropBox label="W" value={Math.round(slide.width ?? 60)} />
        <PropBox label="H" value={Math.round(slide.height ?? 30)} />
      </div>
    </div>
  );
}

// ── Text Inspector ─────────────────────────────────────────────
function TextInspector({ slide, updateStyle, onCopyStyle, onPasteStyle, hasStyleClipboard }) {
  if (!slide) return <div className="inspector__empty">No slide selected</div>;

  const [systemFonts, setSystemFonts] = React.useState([]);
  const [fontsLoaded, setFontsLoaded] = React.useState(false);

  React.useEffect(() => {
    import('@tauri-apps/api/core').then(({ invoke }) => {
      invoke('get_system_fonts')
        .then(fonts => {
          setSystemFonts(fonts);
          setFontsLoaded(true);
        })
        .catch(() => setFontsLoaded(true)); // fallback gracefully
    });
  }, []);

  // Fallback fonts always shown at top if system fonts fail
  const FALLBACK_FONTS = [
    'Arial', 'Helvetica', 'Georgia', 'Times New Roman',
    'Courier New', 'Impact', 'Verdana', 'Trebuchet MS',
  ];

  const fontList = fontsLoaded && systemFonts.length > 0
    ? systemFonts
    : FALLBACK_FONTS;

  // Current value may be like "Arial, sans-serif" — extract the first name for matching
  const currentFamily = (slide.fontFamily || 'Arial, sans-serif')
    .replace(/['"]/g, '').split(',')[0].trim();

  return (
    <div className="inspector-group">
      {/* Copy / Paste Style */}
      <div className="inspector-style-actions">
        <button className="inspector-style-btn" onClick={onCopyStyle} title="Copy all text styling">
          <CopyStyleIcon /> Copy Style
        </button>
        <button
          className={`inspector-style-btn ${hasStyleClipboard ? 'inspector-style-btn--ready' : ''}`}
          onClick={onPasteStyle}
          disabled={!hasStyleClipboard}
          title={hasStyleClipboard ? 'Paste copied style' : 'No style copied yet'}
        >
          <PasteStyleIcon /> Paste Style
        </button>
      </div>

      <div className="inspector-group__label">TYPOGRAPHY</div>

      {/* Font family */}
      <div className="inspector-field">
        <label className="inspector-field__label">
          Family {!fontsLoaded && <span style={{ color: '#333', fontWeight: 400 }}>loading…</span>}
        </label>
        <select
          className="inspector-select"
          value={currentFamily}
          onChange={e => updateStyle('fontFamily', e.target.value)}
        >
          {fontList.map(name => (
            <option key={name} value={name} style={{ fontFamily: name }}>
              {name}
            </option>
          ))}
          {/* If current font isn't in the list, add it so it doesn't show blank */}
          {fontsLoaded && !fontList.includes(currentFamily) && (
            <option value={currentFamily}>{currentFamily}</option>
          )}
        </select>
      </div>

      {/* Font size */}
      <div className="inspector-field">
        <label className="inspector-field__label">Size</label>
        <div className="inspector-slider-row">
          <input type="range" min="1" max="20" step="0.5"
            value={slide.fontSize || 5}
            onChange={e => updateStyle('fontSize', parseFloat(e.target.value))}
            className="inspector-slider"
          />
          <span className="inspector-slider-value">{slide.fontSize || 5}</span>
        </div>
      </div>

      {/* Line spacing */}
      <div className="inspector-field">
        <label className="inspector-field__label">Spacing</label>
        <div className="inspector-slider-row">
          <input type="range" min="0.8" max="3" step="0.05"
            value={slide.lineSpacing || 1.2}
            onChange={e => updateStyle('lineSpacing', parseFloat(e.target.value))}
            className="inspector-slider"
          />
          <span className="inspector-slider-value">{(slide.lineSpacing || 1.2).toFixed(2)}</span>
        </div>
      </div>

      {/* Formatting buttons */}
      <div className="inspector-group__label" style={{ marginTop: 12 }}>FORMATTING</div>
      <div className="inspector-format-grid">
        <FormatBtn label="B" style={{ fontWeight: 800 }}
          active={slide.fontWeight === 800}
          onClick={() => updateStyle('fontWeight', slide.fontWeight === 800 ? 400 : 800)} />
        <FormatBtn label="I" style={{ fontStyle: 'italic' }}
          active={slide.italic} onClick={() => updateStyle('italic', !slide.italic)} />
        <FormatBtn label="U" style={{ textDecoration: 'underline' }}
          active={slide.underline} onClick={() => updateStyle('underline', !slide.underline)} />
        <FormatBtn label="S" style={{ textDecoration: 'line-through' }}
          active={slide.strikethrough} onClick={() => updateStyle('strikethrough', !slide.strikethrough)} />
      </div>

      {/* Text transform */}
      <div className="inspector-field" style={{ marginTop: 12 }}>
        <label className="inspector-field__label">Transform</label>
        <select className="inspector-select"
          value={slide.transform || 'none'}
          onChange={e => updateStyle('transform', e.target.value)}
        >
          <option value="none">None</option>
          <option value="uppercase">UPPERCASE</option>
          <option value="lowercase">lowercase</option>
          <option value="capitalize">Capitalize</option>
        </select>
      </div>

      {/* Color */}
      <div className="inspector-field">
        <label className="inspector-field__label">Color</label>
        <div className="inspector-color-row">
          <input type="color" className="inspector-color-picker"
            value={slide.textColor || '#ffffff'}
            onChange={e => updateStyle('textColor', e.target.value)} />
          <span className="inspector-color-value">{(slide.textColor || '#ffffff').toUpperCase()}</span>
        </div>
      </div>
    </div>
  );
}

// ── Cue Inspector (Timecode) ───────────────────────────────────
function CueInspector({ slide, updateStyle, dispatch }) {
  if (!slide) return <div className="inspector__empty">No slide selected</div>;

  const tc  = slide.timecode || '';
  const notes = slide.notes || '';

  const setTc = (val) => updateStyle('timecode', val || null);
  const setNotes = (val) => updateStyle('notes', val);

  const isValidTc = (v) => /^\d{2}:\d{2}:\d{2}:\d{2}$/.test(v);

  return (
    <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Timecode */}
      <div>
        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, color: '#2a2a2a', marginBottom: 8 }}>TIMECODE TRIGGER</div>
        <div style={{ marginBottom: 6 }}>
          <input
            value={tc}
            onChange={e => setTc(e.target.value)}
            placeholder="01:00:12:00"
            style={{
              width: '100%', height: 32, padding: '0 10px', boxSizing: 'border-box',
              background: '#111', border: `1px solid ${isValidTc(tc) ? 'rgba(74,222,128,0.4)' : tc ? 'rgba(239,68,68,0.4)' : '#1e1e1e'}`,
              borderRadius: 6, color: isValidTc(tc) ? '#4ade80' : '#888',
              fontSize: 13, fontFamily: '"SF Mono", "JetBrains Mono", monospace',
              outline: 'none', letterSpacing: 1,
            }}
          />
        </div>
        <div style={{ fontSize: 9, color: '#2a2a2a', lineHeight: 1.5 }}>
          HH:MM:SS:FF — slide fires when incoming LTC matches this time.
          Leave empty to disable.
        </div>
        {isValidTc(tc) && (
          <div style={{ marginTop: 8, padding: '6px 10px', borderRadius: 6, background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.15)' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#4ade80' }}>✓ Cue set — will fire at {tc}</div>
          </div>
        )}
      </div>

      {/* Notes */}
      <div>
        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, color: '#2a2a2a', marginBottom: 8 }}>SLIDE NOTES</div>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Notes visible on stage display…"
          rows={4}
          style={{
            width: '100%', padding: '8px 10px', boxSizing: 'border-box',
            background: '#111', border: '1px solid #1e1e1e', borderRadius: 6,
            color: '#888', fontSize: 11, outline: 'none', resize: 'vertical',
            fontFamily: '-apple-system, Arial, sans-serif', lineHeight: 1.5,
          }}
        />
      </div>
    </div>
  );
}

// ── Inspector Shell ────────────────────────────────────────────
function Inspector({ activeTab, slide, dispatch, updateStyle, onCopyStyle, onPasteStyle, hasStyleClipboard }) {
  const tabs = ['Shape', 'Text', 'Cue'];
  return (
    <div className="inspector">
      <div className="inspector__tabs">
        {tabs.map(t => (
          <button key={t}
            className={`inspector__tab ${activeTab === t ? 'inspector__tab--active' : ''}`}
            onClick={() => dispatch({ type: 'SET_INSPECTOR_TAB', payload: t })}
          >{t}</button>
        ))}
      </div>
      <div className="inspector__body">
        {activeTab === 'Shape' && <ShapeInspector slide={slide} />}
        {activeTab === 'Text' && (
          <TextInspector
            slide={slide}
            updateStyle={updateStyle}
            onCopyStyle={onCopyStyle}
            onPasteStyle={onPasteStyle}
            hasStyleClipboard={hasStyleClipboard}
          />
        )}
        {activeTab === 'Cue' && <CueInspector slide={slide} updateStyle={updateStyle} dispatch={dispatch} />}
      </div>
    </div>
  );
}

// ── Main EditMode ──────────────────────────────────────────────
export default function EditMode({
  state, dispatch,
  slides, selectedSlide,
  updateSlideText, updateSlideStyle, updateSlideStyles, applyTransform,
  onCopyStyle, onPasteStyle,
}) {
  const {
    selectedSlideId, isObjectSelected, isTyping,
    interactionMode, dragOffset, activeInspectorTab,
    styleClipboard, canvasRatio = '16 / 9',
  } = state;

  const isCenteredX = selectedSlide ? Math.abs((selectedSlide.x ?? 50) - 50) < 1 : false;
  const isCenteredY = selectedSlide ? Math.abs((selectedSlide.y ?? 50) - 50) < 1 : false;

  const textBoxRef = useRef(null);
  const dragState  = useRef(null);

  // ── Move: native window listeners, zero React overhead ────────
  const handleObjectMouseDown = useCallback((e) => {
    if (isTyping) return;
    e.stopPropagation();
    e.preventDefault();
    dispatch({ type: 'SET_OBJECT_SELECTED', payload: true });

    const surface = e.currentTarget.closest('.edit-canvas__surface');
    const r = surface.getBoundingClientRect();
    const mx = ((e.clientX - r.left) / r.width)  * 100;
    const my = ((e.clientY - r.top)  / r.height) * 100;
    const sx = selectedSlide?.x ?? 50;
    const sy = selectedSlide?.y ?? 50;

    dragState.current = { surface, ox: mx - sx, oy: my - sy };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'move';

    const onMove = (ev) => {
      const dr = dragState.current?.surface.getBoundingClientRect();
      if (!dr) return;
      let nx = ((ev.clientX - dr.left) / dr.width)  * 100 - dragState.current.ox;
      let ny = ((ev.clientY - dr.top)  / dr.height) * 100 - dragState.current.oy;
      if (Math.abs(nx - 50) < 1.5) nx = 50;
      if (Math.abs(ny - 50) < 1.5) ny = 50;
      dragState.current.nx = nx;
      dragState.current.ny = ny;
      if (textBoxRef.current) {
        textBoxRef.current.style.left = `${nx}%`;
        textBoxRef.current.style.top  = `${ny}%`;
      }
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      if (dragState.current?.nx !== undefined) {
        // Single atomic update — avoids stale closure bug
        updateSlideStyles({ x: dragState.current.nx, y: dragState.current.ny });
      }
      dragState.current = null;
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseup', onUp);
  }, [isTyping, selectedSlide, dispatch, updateSlideStyle]);

  // ── Resize handles ─────────────────────────────────────────────
  const handleHandleMouseDown = useCallback((handle, e) => {
    e.stopPropagation();
    e.preventDefault();
    const surface = textBoxRef.current?.closest('.edit-canvas__surface');
    if (!surface) return;

    const ox = selectedSlide?.x      ?? 50;
    const oy = selectedSlide?.y      ?? 50;
    const ow = selectedSlide?.width  ?? 60;
    const oh = selectedSlide?.height ?? 30;
    const r2 = ox + ow / 2, l = ox - ow / 2;
    const b  = oy + oh / 2, t = oy - oh / 2;

    document.body.style.userSelect = 'none';
    document.body.style.cursor = `${handle}-resize`;

    const onMove = (ev) => {
      const dr = surface.getBoundingClientRect();
      let mx = ((ev.clientX - dr.left) / dr.width)  * 100;
      let my = ((ev.clientY - dr.top)  / dr.height) * 100;
      let nx = ox, ny = oy, nw = ow, nh = oh;
      if (handle.includes('e')) { nw = Math.max(5, mx - l);  nx = l  + nw / 2; }
      if (handle.includes('w')) { nw = Math.max(5, r2 - mx); nx = r2 - nw / 2; }
      if (handle.includes('s')) { nh = Math.max(5, my - t);  ny = t  + nh / 2; }
      if (handle.includes('n')) { nh = Math.max(5, b  - my); ny = b  - nh / 2; }
      if (textBoxRef.current) {
        textBoxRef.current.style.left   = `${nx}%`;
        textBoxRef.current.style.top    = `${ny}%`;
        textBoxRef.current.style.width  = `${nw}%`;
        textBoxRef.current.style.height = `${nh}%`;
      }
      dragState.current = { nx, ny, nw, nh };
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      if (dragState.current) {
        const { nx, ny, nw, nh } = dragState.current;
        updateSlideStyles({ x: nx, y: ny, width: nw, height: nh });
      }
      dragState.current = null;
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseup', onUp);
  }, [selectedSlide, updateSlideStyles]);

  const handleCanvasMouseDown = useCallback(() => {
    dispatch({ type: 'SET_OBJECT_SELECTED', payload: false });
  }, [dispatch]);

  const handleTextBlur = useCallback((e) => {
    const text = e.currentTarget.innerText;
    updateSlideText(text);
    dispatch({ type: 'SET_TYPING', payload: false });
  }, [updateSlideText, dispatch]);

  const handleTextKeyDown = useCallback((e) => {
    // Always stop propagation so slide navigation keys don't fire while typing
    e.stopPropagation();

    if (e.key === 'Escape') {
      const text = e.currentTarget.innerText;
      updateSlideText(text);
      dispatch({ type: 'SET_TYPING', payload: false });
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      document.execCommand('insertText', false, '\n');
      return;
    }

    // Cmd+V / Ctrl+V — explicit paste handler using Clipboard API
    if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
      e.preventDefault();
      navigator.clipboard.readText().then(text => {
        if (text) document.execCommand('insertText', false, text);
      }).catch(() => {
        // Fallback — let browser handle it
      });
      return;
    }
  }, [updateSlideText, dispatch]);

  return (
    <div className="edit-mode">
      <Filmstrip
        slides={slides}
        selectedSlideId={selectedSlideId}
        onSelect={id => dispatch({ type: 'SET_SELECTED_SLIDE', payload: id })}
      />

      <div className="edit-main">
        <CanvasRatioBar canvasRatio={canvasRatio} dispatch={dispatch} />
        <div className="edit-main__canvas-wrap">
          <EditCanvas
            selectedSlide={selectedSlide}
            canvasRatio={canvasRatio}
            isObjectSelected={isObjectSelected}
            isTyping={isTyping}
            isCenteredX={isCenteredX}
            isCenteredY={isCenteredY}
            onCanvasMouseDown={handleCanvasMouseDown}
            onObjectMouseDown={handleObjectMouseDown}
            onDoubleClick={() => dispatch({ type: 'SET_TYPING', payload: true })}
            onHandleMouseDown={handleHandleMouseDown}
            onTextBlur={handleTextBlur}
            onTextKeyDown={handleTextKeyDown}
            textBoxRef={textBoxRef}
            dispatch={dispatch}
          />
        </div>
      </div>

      <Inspector
        activeTab={activeInspectorTab}
        slide={selectedSlide}
        dispatch={dispatch}
        updateStyle={updateSlideStyle}
        onCopyStyle={onCopyStyle}
        onPasteStyle={onPasteStyle}
        hasStyleClipboard={!!styleClipboard}
      />
    </div>
  );
}

// ── Canvas Ratio Bar ───────────────────────────────────────────
function CanvasRatioBar({ canvasRatio, dispatch }) {
  const [monitors, setMonitors] = React.useState([]);

  React.useEffect(() => {
    const load = async () => {
      try {
        const { availableMonitors } = await import('@tauri-apps/api/window');
        const list = await availableMonitors();
        if (list?.length) setMonitors(list);
      } catch {}
    };
    load();
  }, []);

  const setRatio = (ratio) => dispatch({ type: 'SET_CANVAS_RATIO', payload: ratio });

  const PRESETS = [
    { label: '16:9', ratio: '16 / 9' },
    { label: '4:3',  ratio: '4 / 3' },
    { label: '1:1',  ratio: '1 / 1' },
    { label: '9:16', ratio: '9 / 16' },
  ];

  return (
    <div className="canvas-ratio-bar">
      <span className="canvas-ratio-bar__label">CANVAS</span>
      <div className="canvas-ratio-bar__presets">
        {PRESETS.map(p => (
          <button
            key={p.ratio}
            className={`canvas-ratio-bar__btn ${canvasRatio === p.ratio ? 'canvas-ratio-bar__btn--active' : ''}`}
            onClick={() => setRatio(p.ratio)}
          >
            {p.label}
          </button>
        ))}
      </div>
      {monitors.length > 0 && (
        <>
          <div className="canvas-ratio-bar__divider" />
          <select
            className="canvas-ratio-bar__select"
            value=""
            onChange={e => {
              if (e.target.value) setRatio(e.target.value);
            }}
          >
            <option value="">Display…</option>
            {monitors.map((m, i) => {
              const sf = m.scaleFactor ?? 1;
              const w  = Math.round((m.size?.width  || 1920) / sf);
              const h  = Math.round((m.size?.height || 1080) / sf);
              const name = m.name && !m.name.includes('\\\\') && !m.name.includes('/dev/')
                ? m.name
                : `Display ${i + 1}`;
              return (
                <option key={i} value={`${w} / ${h}`}>
                  {name} ({w}×{h})
                </option>
              );
            })}
          </select>
        </>
      )}
      <span className="canvas-ratio-bar__current">
        {canvasRatio.replace(' / ', ':')}
      </span>
    </div>
  );
}

// ── Micro components ───────────────────────────────────────────
function PropBox({ label, value }) {
  return (
    <div className="prop-box">
      <span className="prop-box__label">{label}</span>
      <span className="prop-box__value">{value}</span>
    </div>
  );
}

function FormatBtn({ label, style, active, onClick }) {
  return (
    <button className={`format-btn ${active ? 'format-btn--active' : ''}`} style={style} onClick={onClick}>
      {label}
    </button>
  );
}

function CopyStyleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  );
}
function PasteStyleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
      <rect x="8" y="2" width="8" height="4" rx="1"/>
    </svg>
  );
}