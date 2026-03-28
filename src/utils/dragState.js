/**
 * dragState.js — Simple global drag state manager
 * Avoids dataTransfer API which is unreliable in Tauri WebViews.
 * Any component can set drag data; any component can read it on drop.
 */

let _dragData = null;
let _dragType = null; // 'media' | 'song' | 'file'

export function setDragData(type, data) {
  _dragType = type;
  _dragData = data;
}

export function getDragData() {
  return { type: _dragType, data: _dragData };
}

export function clearDragData() {
  _dragType = null;
  _dragData = null;
}

export function isDragging() {
  return _dragData !== null;
}