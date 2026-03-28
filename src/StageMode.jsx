/**
 * StageMode.jsx — Stage Layout Editor
 * Professional dark UI with live-preview canvas.
 * Bug fix: canvas uses onMouseDown (not onClick) to deselect,
 * so element selection via mousedown doesn't immediately get cleared.
 */
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { emitTo } from '@tauri-apps/api/event';

// ── Element type definitions ────────────────────────────────────
export const ELEMENT_TYPES = [
  { type: 'currentSlide', label: 'Current Slide', icon: '▶', color: '#ffffff', desc: 'Live lyrics/text', preview: 'YOUR GRACE IS ENOUGH\nFOR ME' },
  { type: 'nextSlide',    label: 'Next Slide',    icon: '⏭', color: '#fde047', desc: 'Coming up next',   preview: 'GREAT IS YOUR FAITHFULNESS' },
  { type: 'clock',        label: 'Clock',         icon: '◷', color: '#D4AF37', desc: 'Current time',     preview: '10:45 AM' },
  { type: 'timer',        label: 'Countdown',     icon: '⏱', color: '#4ade80', desc: 'Countdown timer',  preview: '04:32' },
  { type: 'message',      label: 'Stage Message', icon: '✉', color: '#60a5fa', desc: 'Operator note',    preview: 'VERSE 2 COMING UP' },
  { type: 'notes',        label: 'Slide Notes',   icon: '✏', color: '#c084fc', desc: 'Per-slide notes',  preview: 'Remember: slow tempo here' },
  { type: 'video',        label: 'Video Mirror',  icon: '▣', color: '#fb923c', desc: 'Video on audience', preview: null },
];

function typeInfo(type) {
  return ELEMENT_TYPES.find(t => t.type === type) || ELEMENT_TYPES[0];
}

function makeDefaultElement(type, index = 0) {
  const t = typeInfo(type);
  // Smart default positions based on type
  const positions = {
    currentSlide: { x: 2,  y: 2,  w: 96, h: 52 },
    nextSlide:    { x: 2,  y: 57, w: 62, h: 26 },
    clock:        { x: 68, y: 57, w: 30, h: 12 },
    timer:        { x: 68, y: 72, w: 30, h: 12 },
    message:      { x: 2,  y: 57, w: 96, h: 14 },
    notes:        { x: 2,  y: 57, w: 96, h: 20 },
    video:        { x: 2,  y: 2,  w: 40, h: 40 },
  };
  const pos = positions[type] || { x: 5 + index * 3, y: 5 + index * 3, w: 40, h: 25 };
  return {
    id: Date.now().toString() + Math.random().toString(36).slice(2),
    type,
    ...pos,
    fontSize:  type === 'clock' || type === 'timer' ? 1.6
             : type === 'currentSlide' ? 1.0
             : type === 'nextSlide' ? 0.7
             : 0.8,
    color:     t.color,
    bgColor:   'transparent',
    showLabel: type !== 'currentSlide',
  };
}

// ── Canvas element ──────────────────────────────────────────────
const CUR_COLOR  = '#D4AF37';
const SEL_BORDER = `2px solid ${CUR_COLOR}`;
const HANDLE_SZ  = 10;

function StageElement({ el, selected, canvasRef, onSelectRequest, onChange, onDelete }) {
  const elRef   = useRef(null);
  const moveRef = useRef(null);
  const info    = typeInfo(el.type);

  // ── DRAG ──────────────────────────────────────────────────────
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    if (e.target.dataset.handle) return; // let resize handle it
    e.preventDefault();
    e.stopPropagation(); // prevent canvas deselect

    onSelectRequest(el.id);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const cr = canvas.getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY;
    const ox = el.x, oy = el.y;

    const onMove = (ev) => {
      const dx = ((ev.clientX - sx) / cr.width)  * 100;
      const dy = ((ev.clientY - sy) / cr.height) * 100;
      const nx = Math.max(0, Math.min(ox + dx, 100 - el.w));
      const ny = Math.max(0, Math.min(oy + dy, 100 - el.h));
      if (elRef.current) {
        elRef.current.style.left = nx + '%';
        elRef.current.style.top  = ny + '%';
      }
      moveRef.current = { nx, ny };
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
      if (moveRef.current) {
        onChange({ ...el, x: moveRef.current.nx, y: moveRef.current.ny });
        moveRef.current = null;
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  }, [el, canvasRef, onSelectRequest, onChange]);

  // ── RESIZE (SE corner) ────────────────────────────────────────
  const handleResizeMouseDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cr = canvas.getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY;
    const ow = el.w, oh = el.h;

    const onMove = (ev) => {
      const dx = ((ev.clientX - sx) / cr.width)  * 100;
      const dy = ((ev.clientY - sy) / cr.height) * 100;
      const nw = Math.max(5,  Math.min(ow + dx, 100 - el.x));
      const nh = Math.max(3, Math.min(oh + dy, 100 - el.y));
      if (elRef.current) {
        elRef.current.style.width  = nw + '%';
        elRef.current.style.height = nh + '%';
      }
      moveRef.current = { nw, nh };
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
      if (moveRef.current) {
        onChange({ ...el, w: moveRef.current.nw, h: moveRef.current.nh });
        moveRef.current = null;
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  }, [el, canvasRef, onChange]);

  const bgFill = el.bgColor && el.bgColor !== 'transparent' ? el.bgColor : 'rgba(255,255,255,0.04)';

  return (
    <div
      ref={elRef}
      onMouseDown={handleMouseDown}
      style={{
        position: 'absolute',
        left: `${el.x}%`, top: `${el.y}%`,
        width: `${el.w}%`, height: `${el.h}%`,
        background: selected ? 'rgba(212,175,55,0.06)' : bgFill,
        border: selected ? SEL_BORDER : '1px dashed rgba(255,255,255,0.1)',
        borderRadius: 4, cursor: 'grab', overflow: 'hidden',
        boxShadow: selected ? `0 0 0 4px rgba(212,175,55,0.1), inset 0 0 0 1px rgba(212,175,55,0.2)` : 'none',
        boxSizing: 'border-box', userSelect: 'none',
        transition: 'box-shadow 0.1s',
      }}
    >
      {/* Type badge / label */}
      {el.showLabel && (
        <div style={{
          position: 'absolute', top: 3, left: 5,
          display: 'flex', alignItems: 'center', gap: 3,
          pointerEvents: 'none',
        }}>
          <span style={{ fontSize: '0.55cqw', opacity: 0.35, color: '#fff' }}>{info.icon}</span>
          <span style={{ fontSize: '0.5cqw', fontWeight: 800, letterSpacing: 1, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase' }}>
            {info.label}
          </span>
        </div>
      )}

      {/* Content preview */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '4px 8px', boxSizing: 'border-box',
        fontSize: `${el.fontSize || 1}cqw`,
        fontWeight: 800, color: el.color || info.color,
        textAlign: 'center', whiteSpace: 'pre-wrap', overflow: 'hidden',
        lineHeight: 1.2, pointerEvents: 'none',
      }}>
        {el.type === 'video'
          ? <div style={{ opacity: 0.3, fontSize: '1cqw', color: '#fb923c' }}>VIDEO MIRROR</div>
          : info.preview
        }
      </div>

      {/* ── Selection chrome ── */}
      {selected && (
        <>
          {/* Corner dots */}
          {[['0%','0%'],['100%','0%'],['0%','100%']].map(([l, t], i) => (
            <div key={i} style={{
              position: 'absolute', left: l, top: t,
              width: 6, height: 6, background: CUR_COLOR, borderRadius: '50%',
              transform: 'translate(-50%, -50%)', pointerEvents: 'none',
            }} />
          ))}

          {/* SE resize handle */}
          <div
            data-handle="se"
            onMouseDown={handleResizeMouseDown}
            style={{
              position: 'absolute', right: -1, bottom: -1,
              width: HANDLE_SZ + 2, height: HANDLE_SZ + 2,
              background: CUR_COLOR, borderRadius: '3px 0 3px 0',
              cursor: 'se-resize', zIndex: 5,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="5" height="5" viewBox="0 0 5 5" fill="none" style={{ pointerEvents: 'none' }}>
              <path d="M0 5L5 0M2 5L5 2" stroke="#000" strokeWidth="1.2" strokeLinecap="round"/>
            </svg>
          </div>

          {/* Delete button */}
          <button
            onMouseDown={e => { e.stopPropagation(); onDelete(el.id); }}
            style={{
              position: 'absolute', top: -1, right: -1,
              width: 18, height: 18, background: '#ef4444',
              border: 'none', borderRadius: '0 3px 0 3px',
              color: '#fff', fontSize: 10, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 900, lineHeight: 1, zIndex: 5,
            }}
          >×</button>
        </>
      )}
    </div>
  );
}

// ── Inspector panel ─────────────────────────────────────────────
function Inspector({ el, layoutId, dispatch }) {
  if (!el) return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: 24, gap: 12, color: '#2a2a2a',
    }}>
      <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#1e1e1e" strokeWidth="1.5">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
      <span style={{ fontSize: 11, color: '#2a2a2a', textAlign: 'center', lineHeight: 1.5 }}>
        Click any element<br/>to edit its properties
      </span>
    </div>
  );

  const upd = (changes) => dispatch({
    type: 'UPDATE_STAGE_ELEMENT',
    payload: { layoutId, element: { ...el, ...changes } },
  });

  const info = typeInfo(el.type);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '0 14px 14px' }}>

      {/* Type header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '14px 0 12px', borderBottom: '1px solid #1a1a1a', marginBottom: 16,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: `${info.color}18`, border: `1px solid ${info.color}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14,
        }}>{info.icon}</div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: '#ccc' }}>{info.label}</div>
          <div style={{ fontSize: 10, color: '#444', marginTop: 1 }}>{info.desc}</div>
        </div>
      </div>

      {/* Position & Size */}
      <Section label="POSITION & SIZE">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[['X', 'x'], ['Y', 'y'], ['Width', 'w'], ['Height', 'h']].map(([lbl, key]) => (
            <div key={key}>
              <div style={{ fontSize: 9, color: '#444', marginBottom: 4, fontWeight: 700, letterSpacing: 1 }}>{lbl.toUpperCase()} %</div>
              <input type="number" min={0} max={100}
                value={Math.round(el[key])}
                onChange={e => upd({ [key]: Math.max(0, Math.min(100, parseInt(e.target.value)||0)) })}
                style={numInputSt}
              />
            </div>
          ))}
        </div>
      </Section>

      {/* Typography */}
      <Section label="TYPOGRAPHY">
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 9, color: '#444', marginBottom: 6, fontWeight: 700, letterSpacing: 1 }}>
            FONT SIZE — {(el.fontSize||1).toFixed(1)}cqw
          </div>
          <input type="range" min="0.2" max="8" step="0.1"
            value={el.fontSize||1}
            onChange={e => upd({ fontSize: parseFloat(e.target.value) })}
            style={{ width: '100%', accentColor: CUR_COLOR }}
          />
        </div>
        <div>
          <div style={{ fontSize: 9, color: '#444', marginBottom: 6, fontWeight: 700, letterSpacing: 1 }}>TEXT COLOR</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="color" value={el.color || '#ffffff'}
              onChange={e => upd({ color: e.target.value })}
              style={{ width: 40, height: 28, border: 'none', background: 'none', cursor: 'pointer', borderRadius: 4 }}
            />
            <input type="text" value={el.color || '#ffffff'}
              onChange={e => upd({ color: e.target.value })}
              style={{ ...numInputSt, flex: 1, textTransform: 'uppercase' }}
            />
          </div>
        </div>
      </Section>

      {/* Background */}
      <Section label="BACKGROUND">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="color"
            value={el.bgColor === 'transparent' ? '#000000' : (el.bgColor||'#000000')}
            onChange={e => upd({ bgColor: e.target.value })}
            style={{ width: 40, height: 28, border: 'none', background: 'none', cursor: 'pointer', borderRadius: 4 }}
          />
          <button onClick={() => upd({ bgColor: 'transparent' })} style={ghostBtnSt}>
            Transparent
          </button>
        </div>
      </Section>

      {/* Options */}
      <Section label="OPTIONS">
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
          <div style={{
            width: 32, height: 18, borderRadius: 9, cursor: 'pointer',
            background: el.showLabel ? CUR_COLOR : '#222',
            border: `1px solid ${el.showLabel ? CUR_COLOR : '#333'}`,
            position: 'relative', transition: 'background 0.2s',
            flexShrink: 0,
          }} onClick={() => upd({ showLabel: !el.showLabel })}>
            <div style={{
              position: 'absolute', top: 2, left: el.showLabel ? 16 : 2,
              width: 12, height: 12, borderRadius: '50%', background: '#fff',
              transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
            }} />
          </div>
          <span style={{ fontSize: 11, color: '#666' }}>Show label</span>
        </label>
      </Section>
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, color: '#2a2a2a', marginBottom: 10 }}>{label}</div>
      {children}
    </div>
  );
}

const numInputSt = {
  width: '100%', height: 30, padding: '0 8px', boxSizing: 'border-box',
  background: '#111', border: '1px solid #1e1e1e', borderRadius: 5,
  color: '#888', fontSize: 11, outline: 'none', fontFamily: 'monospace',
  transition: 'border-color 0.15s',
};
const ghostBtnSt = {
  height: 28, padding: '0 10px', background: 'transparent',
  border: '1px solid #1e1e1e', borderRadius: 5, color: '#444',
  fontSize: 10, cursor: 'pointer', fontWeight: 700,
};

// ── Layout Top Bar ──────────────────────────────────────────────
function TopBar({ stageLayouts, activeLayoutId, dispatch, onAddLayout, onDuplicate, onDelete, onRename }) {
  const [renaming, setRenaming] = useState(false);
  const [val, setVal] = useState('');
  const active = stageLayouts.find(l => l.id === activeLayoutId);

  const startRename = () => { setVal(active?.name || ''); setRenaming(true); };
  const commitRename = () => {
    if (val.trim()) onRename(val.trim());
    setRenaming(false);
  };

  return (
    <div style={{
      gridColumn: '1 / 4', height: 48,
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '0 16px',
      background: '#111', borderBottom: '1px solid #1e1e1e',
      flexShrink: 0,
    }}>
      {/* Layout switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, color: '#333' }}>LAYOUT</span>
        {renaming ? (
          <input autoFocus value={val}
            onChange={e => setVal(e.target.value)}
            onBlur={commitRename}
            onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setRenaming(false); }}
            style={{ height: 28, padding: '0 10px', background: '#1a1a1a', border: `1px solid ${CUR_COLOR}`, borderRadius: 6, color: '#e0e0e0', fontSize: 12, width: 140, outline: 'none' }}
          />
        ) : (
          <select value={activeLayoutId}
            onChange={e => dispatch({ type: 'SET_ACTIVE_STAGE_LAYOUT', payload: e.target.value })}
            style={{ height: 28, background: '#1a1a1a', border: '1px solid #222', borderRadius: 6, color: '#aaa', fontSize: 12, padding: '0 10px', outline: 'none', cursor: 'pointer' }}
          >
            {stageLayouts.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        )}
      </div>

      <div style={{ width: 1, height: 20, background: '#1e1e1e' }} />

      {[
        { label: '+ New',        fn: onAddLayout },
        { label: 'Duplicate',    fn: onDuplicate },
        { label: 'Rename',       fn: startRename },
      ].map(({ label, fn }) => (
        <button key={label} onClick={fn} style={topBtnSt}>{label}</button>
      ))}

      <button onClick={onDelete} disabled={stageLayouts.length <= 1}
        style={{ ...topBtnSt, color: stageLayouts.length <= 1 ? '#1e1e1e' : '#ef4444', borderColor: stageLayouts.length <= 1 ? '#1a1a1a' : 'rgba(239,68,68,0.2)' }}>
        Delete
      </button>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10, color: '#222' }}>
          {active?.elements?.length || 0} elements
        </span>
        <div style={{ width: 1, height: 16, background: '#1e1e1e' }} />
        <button onClick={() => dispatch({ type: 'SET_MODE', payload: 'show' })} style={{ ...topBtnSt, color: '#D4AF37', borderColor: 'rgba(212,175,55,0.25)' }}>
          ← Back to Show
        </button>
      </div>
    </div>
  );
}

const topBtnSt = {
  height: 28, padding: '0 12px', background: 'transparent',
  border: '1px solid #222', borderRadius: 6, color: '#555',
  fontSize: 11, cursor: 'pointer', fontWeight: 700, transition: 'all 0.12s',
};

// ── Element Palette ─────────────────────────────────────────────
function Palette({ onAdd }) {
  const [hovered, setHovered] = useState(null);

  return (
    <div style={{
      width: 200, flexShrink: 0, background: '#0d0d0d',
      borderRight: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{ padding: '14px 14px 8px', borderBottom: '1px solid #141414' }}>
        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2.5, color: '#2a2a2a' }}>ADD ELEMENT</div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
        {ELEMENT_TYPES.map(({ type, label, icon, color, desc }) => (
          <button key={type}
            onClick={() => onAdd(type)}
            onMouseEnter={() => setHovered(type)}
            onMouseLeave={() => setHovered(null)}
            style={{
              width: '100%', padding: '10px 10px', marginBottom: 3,
              background: hovered === type ? '#161616' : '#111',
              border: `1px solid ${hovered === type ? '#252525' : '#161616'}`,
              borderLeft: `3px solid ${hovered === type ? color : 'transparent'}`,
              borderRadius: 6, cursor: 'pointer', textAlign: 'left',
              display: 'flex', alignItems: 'center', gap: 10,
              transition: 'all 0.1s',
            }}
          >
            <div style={{
              width: 28, height: 28, borderRadius: 7,
              background: `${color}18`, border: `1px solid ${color}33`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, flexShrink: 0,
            }}>{icon}</div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: hovered === type ? '#ccc' : '#666' }}>{label}</div>
              <div style={{ fontSize: 9, color: '#2a2a2a', marginTop: 1 }}>{desc}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main StageMode ──────────────────────────────────────────────
export default function StageMode({ state, dispatch }) {
  const { stageLayouts = [], activeStageLayoutId } = state;
  const [selectedElId, setSelectedElId] = useState(null);
  const canvasRef = useRef(null);

  const activeLayout = stageLayouts.find(l => l.id === activeStageLayoutId) || stageLayouts[0];
  const selectedEl   = activeLayout?.elements?.find(e => e.id === selectedElId) || null;

  // Push to stage window on layout change
  useEffect(() => {
    if (!activeLayout) return;
    emitTo('*', 'stage-config', { layout: activeLayout }).catch(() => {});
  }, [activeLayout]);

  const addElement = useCallback((type) => {
    const el = makeDefaultElement(type, activeLayout?.elements?.length || 0);
    dispatch({ type: 'ADD_STAGE_ELEMENT', payload: { layoutId: activeLayout.id, element: el } });
    setSelectedElId(el.id);
  }, [activeLayout, dispatch]);

  const updateElement = useCallback((el) => {
    dispatch({ type: 'UPDATE_STAGE_ELEMENT', payload: { layoutId: activeLayout.id, element: el } });
  }, [activeLayout, dispatch]);

  const deleteElement = useCallback((elId) => {
    dispatch({ type: 'DELETE_STAGE_ELEMENT', payload: { layoutId: activeLayout.id, elementId: elId } });
    setSelectedElId(null);
  }, [activeLayout, dispatch]);

  const addLayout = () => {
    const id = Date.now().toString();
    dispatch({ type: 'ADD_STAGE_LAYOUT', payload: { id, name: 'New Layout', elements: [] } });
    setSelectedElId(null);
  };

  const duplicateLayout = () => {
    if (!activeLayout) return;
    const id = Date.now().toString();
    dispatch({ type: 'ADD_STAGE_LAYOUT', payload: {
      ...activeLayout, id, name: activeLayout.name + ' Copy',
      elements: activeLayout.elements.map(e => ({ ...e, id: Date.now().toString() + Math.random() })),
    }});
    setSelectedElId(null);
  };

  const deleteLayout = () => {
    if (stageLayouts.length <= 1) return;
    if (!window.confirm(`Delete "${activeLayout?.name}"?`)) return;
    dispatch({ type: 'DELETE_STAGE_LAYOUT', payload: activeLayout.id });
    setSelectedElId(null);
  };

  const renameLayout = (name) => {
    dispatch({ type: 'UPDATE_STAGE_LAYOUT', payload: { id: activeLayout.id, name } });
  };

  // KEY FIX: use onMouseDown not onClick — so it doesn't fire after element mousedown
  const handleCanvasMouseDown = (e) => {
    if (e.target === canvasRef.current || e.target.classList.contains('canvas-grid')) {
      setSelectedElId(null);
    }
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: '#0e0e0e', overflow: 'hidden',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", Arial, sans-serif',
    }}>
      {/* Top bar */}
      <TopBar
        stageLayouts={stageLayouts}
        activeLayoutId={activeLayout?.id}
        dispatch={dispatch}
        onAddLayout={addLayout}
        onDuplicate={duplicateLayout}
        onDelete={deleteLayout}
        onRename={renameLayout}
      />

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Palette */}
        <Palette onAdd={addElement} />

        {/* Canvas area */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'radial-gradient(ellipse at center, #0f0f0f 0%, #080808 100%)',
          overflow: 'hidden', padding: 32, position: 'relative',
        }}>
          {/* Subtle vignette */}
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.4) 100%)', pointerEvents: 'none', zIndex: 0 }} />

          <div style={{ position: 'relative', zIndex: 1, width: '100%', maxHeight: '100%', aspectRatio: '16/9', display: 'flex' }}>
            {/* Screen label */}
            <div style={{
              position: 'absolute', top: -28, left: 0,
              fontSize: 10, fontWeight: 800, letterSpacing: 2, color: '#2a2a2a',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#D4AF37', boxShadow: '0 0 8px #D4AF37' }} />
              STAGE DISPLAY — {activeLayout?.name || 'Default'}
            </div>

            {/* Canvas */}
            <div
              ref={canvasRef}
              onMouseDown={handleCanvasMouseDown}
              style={{
                width: '100%', height: '100%',
                background: '#000', position: 'relative', overflow: 'hidden',
                containerType: 'inline-size',
                boxShadow: selectedElId
                  ? '0 0 0 1.5px #333, 0 32px 80px rgba(0,0,0,0.9)'
                  : '0 0 0 1px #1e1e1e, 0 32px 80px rgba(0,0,0,0.9)',
                borderRadius: 2,
              }}
            >
              {/* Grid */}
              <div className="canvas-grid" style={{
                position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
                backgroundImage: 'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)',
                backgroundSize: '10% 10%',
              }} />

              {/* Empty state */}
              {(!activeLayout?.elements || activeLayout.elements.length === 0) && (
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 12,
                  pointerEvents: 'none',
                }}>
                  <svg viewBox="0 0 48 48" width="40" height="40" fill="none" stroke="#1e1e1e" strokeWidth="1.5">
                    <rect x="4" y="4" width="40" height="40" rx="4"/>
                    <line x1="4" y1="24" x2="44" y2="24" strokeDasharray="3 3"/>
                    <line x1="24" y1="4" x2="24" y2="44" strokeDasharray="3 3"/>
                    <circle cx="24" cy="24" r="4" fill="#1e1e1e" stroke="none"/>
                  </svg>
                  <span style={{ fontSize: 12, color: '#1e1e1e', fontWeight: 700, letterSpacing: 1 }}>
                    ADD ELEMENTS FROM THE LEFT
                  </span>
                </div>
              )}

              {/* Elements */}
              {activeLayout?.elements?.map(el => (
                <StageElement
                  key={el.id} el={el}
                  selected={selectedElId === el.id}
                  canvasRef={canvasRef}
                  onSelectRequest={setSelectedElId}
                  onChange={updateElement}
                  onDelete={deleteElement}
                />
              ))}
            </div>

            {/* Bottom hint */}
            <div style={{
              position: 'absolute', bottom: -24, left: 0, right: 0,
              display: 'flex', justifyContent: 'center', gap: 20,
              fontSize: 9, color: '#252525', fontWeight: 700, letterSpacing: 0.5,
            }}>
              <span>CLICK TO SELECT</span>
              <span>·</span>
              <span>DRAG TO MOVE</span>
              <span>·</span>
              <span>CORNER TO RESIZE</span>
              <span>·</span>
              <span>× TO DELETE</span>
            </div>
          </div>
        </div>

        {/* Inspector */}
        <div style={{
          width: 240, flexShrink: 0,
          borderLeft: '1px solid #1a1a1a', background: '#0d0d0d',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{ padding: '14px 14px 8px', borderBottom: '1px solid #141414' }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2.5, color: '#2a2a2a' }}>PROPERTIES</div>
          </div>
          <Inspector el={selectedEl} layoutId={activeLayout?.id} dispatch={dispatch} />
        </div>
      </div>
    </div>
  );
}