/**
 * GraphicsMode.jsx
 * Resolume Arena-style layer compositor for live graphics.
 * Supports: video layers, text overlays, blend modes, opacity, transform.
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';

// ─────────────────────────────────────────────────────────────────
// LAYER MODEL
// Default layer template
const createLayer = (overrides = {}) => ({
  id: Date.now() + Math.random(),
  name: 'Layer',
  type: 'video',   // 'video' | 'text' | 'image' | 'solid'
  src: null,
  visible: true,
  opacity: 1,
  blendMode: 'normal',
  x: 0, y: 0,
  scaleX: 1, scaleY: 1,
  rotation: 0,
  loop: true,
  text: '',
  color: '#ffffff',
  fontSize: 5,
  fontFamily: 'Inter',
  fontWeight: 800,
  ...overrides,
});

const BLEND_MODES = [
  'normal', 'multiply', 'screen', 'overlay',
  'darken', 'lighten', 'color-dodge', 'color-burn',
  'hard-light', 'soft-light', 'difference', 'exclusion',
  'add',
];

// ─────────────────────────────────────────────────────────────────
// LAYER ROW (in layer stack)
// ─────────────────────────────────────────────────────────────────
function LayerRow({ layer, isSelected, onSelect, onToggleVisible, onUpdate, onDelete }) {
  return (
    <div
      className={`layer-row ${isSelected ? 'layer-row--selected' : ''} ${!layer.visible ? 'layer-row--hidden' : ''}`}
      onClick={onSelect}
    >
      {/* Visibility toggle */}
      <button
        className="layer-row__vis-btn"
        onClick={e => { e.stopPropagation(); onToggleVisible(); }}
        title={layer.visible ? 'Hide Layer' : 'Show Layer'}
      >
        {layer.visible ? <EyeIcon /> : <EyeOffIcon />}
      </button>

      {/* Layer type icon */}
      <span className="layer-row__type-icon">
        {layer.type === 'video' && <VideoIcon />}
        {layer.type === 'text' && <TextIcon />}
        {layer.type === 'image' && <ImageIcon />}
        {layer.type === 'solid' && <SolidIcon />}
      </span>

      {/* Name */}
      <span className="layer-row__name">{layer.name}</span>

      {/* Opacity mini-slider */}
      <input
        type="range" min="0" max="1" step="0.01"
        value={layer.opacity}
        className="layer-row__opacity"
        onClick={e => e.stopPropagation()}
        onChange={e => onUpdate({ opacity: parseFloat(e.target.value) })}
        title={`Opacity: ${Math.round(layer.opacity * 100)}%`}
      />

      {/* Delete */}
      <button
        className="layer-row__delete"
        onClick={e => { e.stopPropagation(); onDelete(); }}
        title="Delete Layer"
      >
        ×
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// LAYER PROPERTY INSPECTOR
// ─────────────────────────────────────────────────────────────────
function LayerInspector({ layer, onUpdate }) {
  if (!layer) {
    return (
      <div className="gfx-inspector__empty">
        <LayersIcon size={32} color="#333" />
        <p>Select a layer to inspect</p>
      </div>
    );
  }

  return (
    <div className="gfx-inspector">
      <div className="gfx-inspector__title">{layer.name.toUpperCase()}</div>

      {/* Opacity */}
      <InspectorRow label="Opacity">
        <div className="gfx-slider-row">
          <input
            type="range" min="0" max="1" step="0.01"
            value={layer.opacity}
            className="gfx-slider"
            onChange={e => onUpdate({ opacity: parseFloat(e.target.value) })}
          />
          <span className="gfx-value">{Math.round(layer.opacity * 100)}%</span>
        </div>
      </InspectorRow>

      {/* Blend Mode */}
      <InspectorRow label="Blend">
        <select
          className="gfx-select"
          value={layer.blendMode}
          onChange={e => onUpdate({ blendMode: e.target.value })}
        >
          {BLEND_MODES.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </InspectorRow>

      {/* Transform */}
      <div className="gfx-inspector__section">TRANSFORM</div>

      <InspectorRow label="X">
        <input
          type="number"
          className="gfx-input"
          value={Math.round(layer.x)}
          onChange={e => onUpdate({ x: parseFloat(e.target.value) || 0 })}
        />
      </InspectorRow>

      <InspectorRow label="Y">
        <input
          type="number"
          className="gfx-input"
          value={Math.round(layer.y)}
          onChange={e => onUpdate({ y: parseFloat(e.target.value) || 0 })}
        />
      </InspectorRow>

      <InspectorRow label="Scale X">
        <div className="gfx-slider-row">
          <input
            type="range" min="0.1" max="3" step="0.01"
            value={layer.scaleX}
            className="gfx-slider"
            onChange={e => onUpdate({ scaleX: parseFloat(e.target.value) })}
          />
          <span className="gfx-value">{layer.scaleX.toFixed(2)}×</span>
        </div>
      </InspectorRow>

      <InspectorRow label="Scale Y">
        <div className="gfx-slider-row">
          <input
            type="range" min="0.1" max="3" step="0.01"
            value={layer.scaleY}
            className="gfx-slider"
            onChange={e => onUpdate({ scaleY: parseFloat(e.target.value) })}
          />
          <span className="gfx-value">{layer.scaleY.toFixed(2)}×</span>
        </div>
      </InspectorRow>

      <InspectorRow label="Rotation">
        <div className="gfx-slider-row">
          <input
            type="range" min="-180" max="180" step="1"
            value={layer.rotation}
            className="gfx-slider"
            onChange={e => onUpdate({ rotation: parseFloat(e.target.value) })}
          />
          <span className="gfx-value">{layer.rotation}°</span>
        </div>
      </InspectorRow>

      {/* Text-specific */}
      {layer.type === 'text' && (
        <>
          <div className="gfx-inspector__section">TEXT</div>
          <InspectorRow label="Content">
            <textarea
              className="gfx-textarea"
              value={layer.text}
              onChange={e => onUpdate({ text: e.target.value })}
              rows={3}
            />
          </InspectorRow>
          <InspectorRow label="Size">
            <div className="gfx-slider-row">
              <input
                type="range" min="1" max="20" step="0.5"
                value={layer.fontSize}
                className="gfx-slider"
                onChange={e => onUpdate({ fontSize: parseFloat(e.target.value) })}
              />
              <span className="gfx-value">{layer.fontSize}cqw</span>
            </div>
          </InspectorRow>
          <InspectorRow label="Color">
            <input
              type="color"
              className="gfx-color"
              value={layer.color}
              onChange={e => onUpdate({ color: e.target.value })}
            />
          </InspectorRow>
        </>
      )}

      {/* Loop toggle for video */}
      {layer.type === 'video' && (
        <InspectorRow label="Loop">
          <label className="gfx-toggle">
            <input
              type="checkbox"
              checked={layer.loop}
              onChange={e => onUpdate({ loop: e.target.checked })}
            />
            <span className="gfx-toggle__track" />
          </label>
        </InspectorRow>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// COMPOSITOR CANVAS
// ─────────────────────────────────────────────────────────────────
function CompositorCanvas({ layers, selectedLayerId, onSelectLayer }) {
  return (
    <div
      className="compositor-canvas"
      style={{ containerType: 'inline-size', aspectRatio: '16/9' }}
    >
      {/* Render layers bottom-to-top */}
      {[...layers].reverse().map(layer => {
        if (!layer.visible) return null;
        const transform = `translate(${layer.x}px, ${layer.y}px) scale(${layer.scaleX}, ${layer.scaleY}) rotate(${layer.rotation}deg)`;

        return (
          <div
            key={layer.id}
            className={`compositor-layer ${layer.id === selectedLayerId ? 'compositor-layer--selected' : ''}`}
            style={{
              opacity: layer.opacity,
              mixBlendMode: layer.blendMode,
              transform,
              position: 'absolute',
              inset: 0,
              cursor: 'pointer',
            }}
            onClick={() => onSelectLayer(layer.id)}
          >
            {layer.type === 'video' && layer.src && (
              <video
                key={layer.src}
                src={layer.src}
                className="compositor-layer__video"
                autoPlay
                muted
                loop={layer.loop}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )}
            {layer.type === 'image' && layer.src && (
              <img
                src={layer.src}
                className="compositor-layer__image"
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            )}
            {layer.type === 'text' && (
              <div
                className="compositor-layer__text"
                style={{
                  color: layer.color,
                  fontSize: `${layer.fontSize}cqw`,
                  fontWeight: layer.fontWeight,
                  fontFamily: layer.fontFamily,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: '100%',
                  textAlign: 'center',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {layer.text}
              </div>
            )}
            {layer.type === 'solid' && (
              <div style={{ background: layer.color, width: '100%', height: '100%' }} />
            )}
          </div>
        );
      })}

      {/* Grid overlay */}
      <div className="compositor-canvas__grid" aria-hidden="true" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// MAIN GraphicsMode
// ─────────────────────────────────────────────────────────────────
export default function GraphicsMode({ state, dispatch, mediaFiles }) {
  const [layers, setLayers] = useState([
    createLayer({ name: 'Background', type: 'solid', color: '#000000' }),
  ]);
  const [selectedLayerId, setSelectedLayerId] = useState(null);

  const selectedLayer = layers.find(l => l.id === selectedLayerId) || null;

  const addLayer = (type) => {
    const layer = createLayer({ name: `${type} layer`, type });
    setLayers(prev => [...prev, layer]);
    setSelectedLayerId(layer.id);
  };

  const updateLayer = useCallback((id, updates) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l));
  }, []);

  const deleteLayer = (id) => {
    setLayers(prev => prev.filter(l => l.id !== id));
    if (selectedLayerId === id) setSelectedLayerId(null);
  };

  const moveLayer = (id, direction) => {
    setLayers(prev => {
      const idx = prev.findIndex(l => l.id === id);
      if (idx === -1) return prev;
      const next = [...prev];
      const swapIdx = direction === 'up' ? idx + 1 : idx - 1;
      if (swapIdx < 0 || swapIdx >= prev.length) return prev;
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return next;
    });
  };

  return (
    <div className="graphics-mode">
      {/* Layer stack (left) */}
      <div className="layer-stack">
        <div className="layer-stack__header">
          <span className="layer-stack__title">LAYERS</span>
          <div className="layer-stack__actions">
            <button className="layer-stack__add" onClick={() => addLayer('video')} title="Add Video">▶</button>
            <button className="layer-stack__add" onClick={() => addLayer('text')} title="Add Text">T</button>
            <button className="layer-stack__add" onClick={() => addLayer('image')} title="Add Image">🖼</button>
            <button className="layer-stack__add" onClick={() => addLayer('solid')} title="Add Solid">■</button>
          </div>
        </div>

        <div className="layer-stack__list">
          {[...layers].reverse().map(layer => (
            <LayerRow
              key={layer.id}
              layer={layer}
              isSelected={layer.id === selectedLayerId}
              onSelect={() => setSelectedLayerId(layer.id)}
              onToggleVisible={() => updateLayer(layer.id, { visible: !layer.visible })}
              onUpdate={updates => updateLayer(layer.id, updates)}
              onDelete={() => deleteLayer(layer.id)}
            />
          ))}
        </div>

        {/* Reorder buttons */}
        {selectedLayerId && (
          <div className="layer-stack__reorder">
            <button onClick={() => moveLayer(selectedLayerId, 'up')}>↑ Move Up</button>
            <button onClick={() => moveLayer(selectedLayerId, 'down')}>↓ Move Down</button>
          </div>
        )}
      </div>

      {/* Compositor canvas (center) */}
      <div className="compositor-wrapper">
        <div className="compositor-toolbar">
          <span className="compositor-toolbar__label">COMPOSITOR — LIVE OUTPUT</span>
          <div className="compositor-toolbar__status">
            <span className="compositor-toolbar__live-dot" />
            RENDERING
          </div>
        </div>
        <CompositorCanvas
          layers={layers}
          selectedLayerId={selectedLayerId}
          onSelectLayer={setSelectedLayerId}
        />
      </div>

      {/* Inspector (right) */}
      <LayerInspector
        layer={selectedLayer}
        onUpdate={updates => selectedLayerId && updateLayer(selectedLayerId, updates)}
      />
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────
function InspectorRow({ label, children }) {
  return (
    <div className="gfx-inspector__row">
      <span className="gfx-inspector__label">{label}</span>
      <div className="gfx-inspector__control">{children}</div>
    </div>
  );
}

// ── SVG Icons ──────────────────────────────────────────────────
function EyeIcon() {
  return <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" /></svg>;
}
function EyeOffIcon() {
  return <svg viewBox="0 0 24 24" width="12" height="12" fill="#555"><path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46A11.804 11.804 0 001 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" /></svg>;
}
function VideoIcon() {
  return <svg viewBox="0 0 24 24" width="11" height="11" fill="#D4AF37"><path d="M17 10.5V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 4v-11l-4 4z" /></svg>;
}
function TextIcon() {
  return <svg viewBox="0 0 24 24" width="11" height="11" fill="#7C6AF7"><path d="M2.5 4v3h5v12h3V7h5V4h-13zm19 5h-9v3h3v7h3v-7h3V9z" /></svg>;
}
function ImageIcon() {
  return <svg viewBox="0 0 24 24" width="11" height="11" fill="#22c55e"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" /></svg>;
}
function SolidIcon() {
  return <svg viewBox="0 0 24 24" width="11" height="11" fill="#ef4444"><rect x="3" y="3" width="18" height="18" rx="2" /></svg>;
}
function LayersIcon({ size = 14, color = 'currentColor' }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill={color}><path d="M11.99 18.54l-7.37-5.73L3 14.07l9 7 9-7-1.63-1.27-7.38 5.74zM12 16l7.36-5.73L21 9l-9-7-9 7 1.63 1.27L12 16z" /></svg>;
}
