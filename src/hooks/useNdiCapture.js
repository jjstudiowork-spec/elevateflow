/**
 * useNdiCapture.js
 * Captures frames and sends RAW pixel data to Rust NDI sender
 */

import { invoke } from '@tauri-apps/api/core';

const captureLoops = {};

export function startNdiCapture(role) {
  if (captureLoops[role]) return; // already running

  const canvas = document.createElement('canvas');
  const ctx    = canvas.getContext('2d');

  let raf    = null;
  let active = true;

  const loop = async () => {
    if (!active) return;

    try {
      const w = window.innerWidth;
      const h = window.innerHeight;

      // Resize canvas if needed
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width  = w;
        canvas.height = h;
      }

      // ✅ DRAW TEST FRAME (so we KNOW pipeline works)
      ctx.fillStyle = 'red';
      ctx.fillRect(0, 0, w, h);

      // ✅ GET RAW PIXELS (RGBA)
      const imageData = ctx.getImageData(0, 0, w, h);
      const pixels = imageData.data;

      // ✅ CONVERT TO BASE64 (RAW, NOT PNG)
      const b64 = uint8ToBase64(pixels);

      if (b64) {
        await invoke('ndi_send_frame', {
          role,
          pixelsB64: b64,
          width: w,
          height: h,
        }).catch(() => {});
      }

    } catch (err) {
      console.error('NDI capture error:', err);
    }

    raf = setTimeout(loop, 1000 / 30); // ~30fps
  };

  captureLoops[role] = {
    stop: () => {
      active = false;
      clearTimeout(raf);
      delete captureLoops[role];
    }
  };

  loop();
}

export function stopNdiCapture(role) {
  captureLoops[role]?.stop();
}

// ✅ SAFE BASE64 ENCODER (NO TRUNCATION)
function uint8ToBase64(uint8) {
  let binary = '';
  const chunkSize = 0x8000;

  for (let i = 0; i < uint8.length; i += chunkSize) {
    const sub = uint8.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...sub);
  }

  return btoa(binary);
}