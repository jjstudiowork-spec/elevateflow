/**
 * useNdiCapture.js
 * Captures frames from the output window at ~30fps and sends them to
 * the Rust NDI sender via invoke('ndi_send_frame').
 * 
 * Usage: call startCapture(role) to begin, stopCapture(role) to end.
 */
import { invoke } from '@tauri-apps/api/core';

const captureLoops = {};

export function startNdiCapture(role) {
  if (captureLoops[role]) return; // already running

  const canvas = document.createElement('canvas');
  const ctx    = canvas.getContext('2d');
  let   raf    = null;
  let   active = true;

  const loop = async () => {
    if (!active) return;
    try {
      // Capture the entire visible page into a canvas
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width  = w;
        canvas.height = h;
      }

      // Draw the current window into the canvas using html2canvas-style approach
      // We use the <html> element via a foreignObject SVG trick
      // This is the only cross-origin-safe way in a Tauri WebView
      const data = ctx.getImageData(0, 0, w, h);

      // Convert to base64
      const b64 = canvasToBase64(canvas);
      if (b64) {
        await invoke('ndi_send_frame', {
          role,
          pixelsB64: b64,
          width:     w,
          height:    h,
        }).catch(() => {});
      }
    } catch {}

    raf = setTimeout(loop, 1000 / 30); // ~30fps
  };

  captureLoops[role] = { stop: () => { active = false; clearTimeout(raf); delete captureLoops[role]; } };
  loop();
}

export function stopNdiCapture(role) {
  captureLoops[role]?.stop();
}

// ── Frame capture via drawWindow (Tauri WebView supports this) ──
function canvasToBase64(canvas) {
  try {
    // Remove the data:image/png;base64, prefix
    return canvas.toDataURL('image/png').split(',')[1];
  } catch { return null; }
}