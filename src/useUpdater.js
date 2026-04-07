/**
 * useUpdater.js
 * Uses Tauri's built-in updater plugin.
 * Checks for updates on launch, handles download + install in-app.
 */
import { useState, useEffect, useCallback } from 'react';

export function useUpdater() {
  const [updateInfo,   setUpdateInfo]   = useState(null); // null = no update
  const [status,       setStatus]       = useState('idle'); // idle | checking | downloading | installing | done | error
  const [progress,     setProgress]     = useState(0);
  const [error,        setError]        = useState(null);
  const [updaterObj,   setUpdaterObj]   = useState(null); // the Tauri update object

  useEffect(() => {
    const check = async () => {
      try {
        setStatus('checking');
        const { check: checkUpdate } = await import('@tauri-apps/plugin-updater');
        const update = await checkUpdate();
        if (update?.available) {
          setUpdaterObj(update);
          setUpdateInfo({
            version:  update.version,
            notes:    update.body    || '',
            pubDate:  update.date    || '',
            downloadUrl: null, // handled by Tauri, not browser
            gatekeeperCommand: 'xattr -rd com.apple.quarantine /Applications/ElevateFlow.app',
          });
        }
        setStatus('idle');
      } catch (e) {
        // Silently fail — network issues, no update available, etc.
        setStatus('idle');
      }
    };

    // Check 4 seconds after launch
    const t = setTimeout(check, 4000);
    return () => clearTimeout(t);
  }, []);

  const installUpdate = useCallback(async () => {
    if (!updaterObj) return;
    try {
      setStatus('downloading');
      setProgress(0);

      await updaterObj.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          setProgress(0);
        } else if (event.event === 'Progress') {
          const { chunkLength, contentLength } = event.data;
          if (contentLength) {
            setProgress(p => Math.min(100, p + (chunkLength / contentLength) * 100));
          }
        } else if (event.event === 'Finished') {
          setProgress(100);
          setStatus('installing');
        }
      });

      setStatus('done');
      // Relaunch after a short delay
      setTimeout(async () => {
        try {
          const { relaunch } = await import('@tauri-apps/plugin-process');
          await relaunch();
        } catch {}
      }, 1500);

    } catch (e) {
      setStatus('error');
      setError(e?.message || 'Update failed');
    }
  }, [updaterObj]);

  const dismiss = useCallback(() => {
    setUpdateInfo(null);
    setStatus('idle');
  }, []);

  return { updateInfo, status, progress, error, installUpdate, dismiss };
}