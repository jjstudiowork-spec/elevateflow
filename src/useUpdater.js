/**
 * useUpdater.js
 * Checks GitHub releases API, shows update modal.
 * Install: tries Tauri in-app updater first, falls back to browser download.
 */
import { useState, useEffect, useCallback } from 'react';

const CURRENT_VER = '0.3.1'; // bumped by release.cjs

function isNewer(remote, current) {
  const parse = v => v.replace(/[^0-9.]/g, '').split('.').map(Number);
  const [rMaj, rMin, rPat] = parse(remote);
  const [cMaj, cMin, cPat] = parse(current);
  if (rMaj !== cMaj) return rMaj > cMaj;
  if (rMin !== cMin) return rMin > cMin;
  return rPat > cPat;
}

export function useUpdater() {
  const [updateInfo, setUpdateInfo] = useState(null);
  const [status,     setStatus]     = useState('idle');
  const [progress,   setProgress]   = useState(0);
  const [error,      setError]      = useState(null);
  const [tauriUpdate, setTauriUpdate] = useState(null);

  useEffect(() => {
    const check = async () => {
      try {
        // Step 1: get real app version from Tauri
        const { getVersion } = await import('@tauri-apps/api/app');
        const currentVersion = await getVersion().catch(() => null);

        // Step 2: try Tauri plugin updater
        let tauriAvailable = false;
        try {
          const { check: checkUpdate } = await import('@tauri-apps/plugin-updater');
          const update = await checkUpdate();
          if (update?.available) {
            tauriAvailable = true;
            setTauriUpdate(update);
            setUpdateInfo({
              version:    update.version,
              notes:      update.body || '',
              pubDate:    update.date || '',
              downloadUrl: null, // will use Tauri install
              useTauri:    true,
            });
          }
        } catch {}

        // Step 3: fallback — check GitHub API directly
        if (!tauriAvailable) {
          const res = await fetch('https://api.github.com/repos/jjstudioworks-spec/elevateflow/releases/latest', {
            headers: { 'Accept': 'application/vnd.github+json' }
          });
          if (!res.ok) return;
          const data = await res.json();
          const remoteVersion = (data.tag_name || '').replace(/^v/, '');
          const current = currentVersion || CURRENT_VER;
          if (remoteVersion && isNewer(remoteVersion, current)) {
            const macAsset = data.assets?.find(a => a.name === 'ElevateFlow.dmg');
            const winAsset = data.assets?.find(a => a.name?.endsWith('.exe'));
            const isMac = navigator.platform?.toUpperCase().includes('MAC');
            const asset = isMac ? macAsset : winAsset;
            setUpdateInfo({
              version:     remoteVersion,
              notes:       data.body || '',
              pubDate:     data.published_at || '',
              downloadUrl: asset?.browser_download_url || data.html_url,
              useTauri:    false,
            });
          }
        }
      } catch {}
    };

    const t = setTimeout(check, 4000);
    return () => clearTimeout(t);
  }, []);

  const installUpdate = useCallback(async () => {
    if (!updateInfo) return;

    // Try Tauri in-app install first
    if (updateInfo.useTauri && tauriUpdate) {
      try {
        setStatus('downloading');
        setProgress(0);
        await tauriUpdate.downloadAndInstall((event) => {
          if (event.event === 'Progress') {
            const { chunkLength, contentLength } = event.data;
            if (contentLength) setProgress(p => Math.min(100, p + (chunkLength / contentLength) * 100));
          } else if (event.event === 'Finished') {
            setProgress(100);
            setStatus('installing');
          }
        });
        setStatus('done');
        setTimeout(async () => {
          try {
            const { relaunch } = await import('@tauri-apps/plugin-process');
            await relaunch();
          } catch {}
        }, 1500);
        return;
      } catch (e) {
        // Tauri install failed — fall through to browser
        console.warn('[updater] Tauri install failed, falling back to browser:', e);
      }
    }

    // Fallback: open download in browser
    setStatus('opening');
    const url = updateInfo.downloadUrl;
    if (!url) { setStatus('error'); setError('No download URL available.'); return; }
    try {
      const { open } = await import('@tauri-apps/plugin-opener');
      await open(url);
      setStatus('done');
    } catch {
      try { window.open(url, '_blank'); setStatus('done'); } catch {}
    }
  }, [updateInfo, tauriUpdate]);

  const dismiss = useCallback(() => {
    setUpdateInfo(null);
    setStatus('idle');
    setError(null);
  }, []);

  return { updateInfo, status, progress, error, installUpdate, dismiss };
}