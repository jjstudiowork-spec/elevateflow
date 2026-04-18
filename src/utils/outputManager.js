/**
 * outputManager.js
 * - No macOS fullscreen animation: borderless window sized to display
 * - Multiple windows per role (one per configured screen)
 */

import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { invoke } from '@tauri-apps/api/core';

const STORAGE_KEY = 'ef_screen_assignments';
const openWindows = {};
const ndiActive   = {};

// ── Persistence ────────────────────────────────────────────────

export function saveAssignments(a) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(a)); } catch {}
}

export function loadAssignments() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { audience: null, stage: null };
  } catch { return { audience: null, stage: null }; }
}

// ── Config helpers ─────────────────────────────────────────────

function getScreensForRole(role) {
  try {
    const cfg = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const screens = role === 'audience' ? cfg.audienceScreens : cfg.stageScreens;
    return screens || [];
  } catch { return []; }
}

// ── Main launch ────────────────────────────────────────────────

export async function launchOutputWindow(role) {
  const screens = getScreensForRole(role);

  if (screens.length === 0) {
    try {
      new WebviewWindow('configurescreens', {
        url: 'index.html#/configure-screens',
        width: 1100, height: 700,
        title: 'Configure Screens — ElevateFlow',
        resizable: true, center: true,
      });
    } catch {}
    return { ok: false, reason: 'no_screen' };
  }

  // Close any existing windows for this role first
  await closeOutputWindow(role);

  const url     = `index.html#/${role}`;
  const prefix  = role === 'audience' ? 'audienceoutput' : 'stageoutput';
  const results = [];

  for (let i = 0; i < screens.length; i++) {
    const screen = screens[i];

    // Skip pure placeholders — no physical monitor assigned, no NDI
    if (screen.isPlaceholder && !screen.isNdi) {
      results.push({ ok: false, label: `placeholder_${i}`, reason: 'placeholder' });
      continue;
    }

    if (screen.isNdi) {
      const result = await launchNdiScreen(role, screen, i);
      results.push(result);
      continue;
    }

    // Logical pixels — ConfigureScreens already stores logical px
    const x      = screen.position?.x ?? 0;
    const y      = screen.position?.y ?? 0;
    const width  = screen.width  || 1920;
    const height = screen.height || 1080;
    const label  = `${prefix}${i}`;

    try {
      const win = new WebviewWindow(label, {
        url,
        x, y,
        width, height,
        // Borderless fullscreen — no animation, appears instantly.
        // Window is sized to exactly cover the display at its position.
        fullscreen:  false,
        decorations: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        focus:       false,
        visible:     true,
        resizable:   false,
        title: role === 'audience' ? 'ElevateFlow Output' : 'ElevateFlow Stage',
      });

      await new Promise((resolve) => {
        win.once('tauri://created', resolve);
        win.once('tauri://error',   resolve);
        setTimeout(resolve, 1500);
      });

      openWindows[label] = win;
      win.onCloseRequested(() => { delete openWindows[label]; });
      // Push current app state to the new window after a short render delay
      setTimeout(() => { if (_onLaunchCallback) _onLaunchCallback(role); }, 800);
      results.push({ ok: true, label });
    } catch (err) {
      console.error(`[outputManager] Failed to open ${label}:`, err);
      results.push({ ok: false, label, err });
    }
  }

  return results.some(r => r.ok) ? { ok: true } : { ok: false, reason: 'all_failed' };
}

async function launchNdiScreen(role, screen, index) {
  const prefix = role === 'audience' ? 'audienceoutput' : 'stageoutput';
  const label  = `${prefix}_ndi_${index}`;
  const url    = `index.html#/${role}`;
  const width  = screen.width  || 1920;
  const height = screen.height || 1080;
  const name   = screen.ndiSourceName || `ElevateFlow ${role}`;

  try {
    const win = new WebviewWindow(label, {
      url, width, height,
      x: -width - 200, y: 0,
      decorations: false, visible: true,
      alwaysOnTop: false, skipTaskbar: true, focus: false,
      title: `ElevateFlow NDI ${role}`,
    });

    await new Promise(r => {
      win.once('tauri://created', r);
      win.once('tauri://error',   r);
      setTimeout(r, 2000);
    });

    openWindows[label] = win;
    win.onCloseRequested(() => { delete openWindows[label]; });
    await new Promise(r => setTimeout(r, 800));

    await invoke('ndi_capture_start', { role, name, width, height });
    ndiActive[`${role}_${index}`] = true;
    return { ok: true, label, isNdi: true };
  } catch {
    try {
      await invoke('ndi_start', { role, name, width, height });
      ndiActive[`${role}_${index}`] = true;
      return { ok: true, isNdi: true };
    } catch {
      return { ok: false, reason: 'ndi_error' };
    }
  }
}

// ── Close ──────────────────────────────────────────────────────

export async function closeOutputWindow(role) {
  const prefix = role === 'audience' ? 'audienceoutput' : 'stageoutput';
  let closed = false;

  for (const label of Object.keys(openWindows)) {
    if (label.startsWith(prefix)) {
      try { await openWindows[label].close(); } catch {}
      delete openWindows[label];
      closed = true;
    }
  }

  for (const key of Object.keys(ndiActive)) {
    if (key.startsWith(role)) {
      await invoke('ndi_capture_stop', { role }).catch(() => {});
      await invoke('ndi_stop',         { role }).catch(() => {});
      delete ndiActive[key];
    }
  }

  return closed;
}

// ── Post-launch callback ──────────────────────────────────────
// App registers this to push current state after window opens

let _onLaunchCallback = null;
export function onOutputLaunched(cb) { _onLaunchCallback = cb; }

// ── Status ─────────────────────────────────────────────────────

export function isOutputOpen(role) {
  const prefix = role === 'audience' ? 'audienceoutput' : 'stageoutput';
  return Object.keys(openWindows).some(l => l.startsWith(prefix))
      || Object.keys(ndiActive).some(k => k.startsWith(role));
}

export function isNdiOutput(role) {
  return Object.keys(ndiActive).some(k => k.startsWith(role));
}