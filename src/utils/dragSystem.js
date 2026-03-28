/**
 * dragSystem.js — ElevateFlow custom drag & drop
 *
 * Usage:
 *   Drag source:  call startDrag(type, data, label) on mousedown
 *   Drop target:  call registerDropZone(el, handler) on mount
 *                 handler receives (type, data)
 *
 * Ghost element follows cursor. Drop zones highlight on hover.
 * Works entirely with mouse events — no HTML5 drag API.
 */

let _type      = null;
let _data      = null;
let _ghost     = null;
let _active    = false;
let _lastZone  = null;
let _threshold = 5;    // px before drag officially starts
let _startX    = 0;
let _startY    = 0;
let _started   = false; // has threshold been crossed?

// Map of element → handler(type, data)
const _handlers = new Map();

// ── Ghost ──────────────────────────────────────────────────────

function createGhost(label) {
  const old = document.getElementById('ef-drag-ghost');
  if (old) old.remove();

  const g = document.createElement('div');
  g.id = 'ef-drag-ghost';
  g.textContent = label;
  Object.assign(g.style, {
    position:      'fixed',
    pointerEvents: 'none',
    zIndex:        '99999',
    background:    'rgba(212,175,55,0.92)',
    color:         '#000',
    fontSize:      '11px',
    fontWeight:    '700',
    fontFamily:    '-apple-system, Arial, sans-serif',
    padding:       '5px 12px',
    borderRadius:  '6px',
    boxShadow:     '0 4px 20px rgba(0,0,0,0.6)',
    whiteSpace:    'nowrap',
    userSelect:    'none',
    left:          '-999px',
    top:           '-999px',
    transform:     'translate(-50%, calc(-100% - 8px))',
  });
  document.body.appendChild(g);
  return g;
}

// ── Hit testing ────────────────────────────────────────────────

function getZoneAt(x, y) {
  let best = null;
  let bestArea = Infinity;
  _handlers.forEach((handler, el) => {
    if (!document.body.contains(el)) return; // stale element
    const r = el.getBoundingClientRect();
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
      const area = r.width * r.height;
      if (area < bestArea) { // prefer smallest (most specific) zone
        bestArea = area;
        best = { el, handler };
      }
    }
  });
  return best;
}

// ── Event handlers ─────────────────────────────────────────────

function onMouseMove(e) {
  if (!_active) return;

  // Check threshold
  if (!_started) {
    const dx = e.clientX - _startX;
    const dy = e.clientY - _startY;
    if (Math.sqrt(dx*dx + dy*dy) < _threshold) return;
    _started = true;
    _ghost = createGhost(_ghost); // _ghost holds label string until started
    document.body.style.cursor = 'grabbing';
  }

  // Move ghost
  if (_ghost && typeof _ghost !== 'string') {
    _ghost.style.left = e.clientX + 'px';
    _ghost.style.top  = e.clientY + 'px';
  }

  // Hover zones
  const zone = getZoneAt(e.clientX, e.clientY);
  if (_lastZone && _lastZone.el !== zone?.el) {
    _lastZone.el.classList.remove('ef-drop-hover');
    _lastZone = null;
  }
  if (zone && zone.el !== _lastZone?.el) {
    zone.el.classList.add('ef-drop-hover');
    _lastZone = zone;
  }
}

function onMouseUp(e) {
  if (!_active) { cleanup(); return; }

  if (_started) {
    const zone = getZoneAt(e.clientX, e.clientY);
    if (zone) {
      zone.el.classList.remove('ef-drop-hover');
      try { zone.handler(_type, _data); } catch (err) {
        console.error('[dragSystem] handler error:', err);
      }
    }
  }

  if (_lastZone) {
    _lastZone.el.classList.remove('ef-drop-hover');
    _lastZone = null;
  }

  cleanup();
}

function onKeyDown(e) {
  if (e.key === 'Escape') cleanup();
}

// ── Public API ─────────────────────────────────────────────────

export function startDrag(type, data, label = '◼ Drag') {
  cleanup(); // clear any stale drag

  _type    = type;
  _data    = data;
  _active  = true;
  _started = false;
  _ghost   = label; // store label string until threshold crossed

  window._efDragActive = true; // expose to tauri://drag-drop handler
  document.body.style.userSelect = 'none';

  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup',   onMouseUp);
  window.addEventListener('keydown',   onKeyDown);
}

export function cleanup() {
  _active  = false;
  _started = false;
  _type    = null;
  _data    = null;
  window._efDragActive = false;

  if (_ghost && typeof _ghost !== 'string') {
    _ghost.remove();
  }
  _ghost = null;

  if (_lastZone) {
    _lastZone.el.classList.remove('ef-drop-hover');
    _lastZone = null;
  }

  document.body.style.userSelect = '';
  document.body.style.cursor     = '';

  window.removeEventListener('mousemove', onMouseMove);
  window.removeEventListener('mouseup',   onMouseUp);
  window.removeEventListener('keydown',   onKeyDown);
}

export function registerDropZone(el, handler) {
  if (!el || typeof handler !== 'function') return;
  _handlers.set(el, handler);
}

export function unregisterDropZone(el) {
  if (!el) return;
  el.classList.remove('ef-drop-hover');
  _handlers.delete(el);
}

export function isDragging() { return _active && _started; }