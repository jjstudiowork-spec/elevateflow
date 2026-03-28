/**
 * useUpdater.js
 * Checks for a new ElevateFlow version by fetching latest.json
 * hosted on your Netlify site.
 *
 * Returns { updateInfo, dismiss, remindLater }
 *   updateInfo  — null (no update / dismissed) or { version, notes, pubDate, downloadUrl, gatekeeperCommand }
 *   dismiss     — permanently skip this version forever
 *   remindLater — snooze for 24 hours
 */

import { useEffect, useState } from 'react';

// ─── CHANGE THIS to your Netlify site URL after you deploy ───────
const UPDATE_MANIFEST_URL = 'https://YOUR-SITE-NAME.netlify.app/latest.json';

// Must match the "version" field in tauri.conf.json
const CURRENT_VERSION = '0.1.0';

// localStorage keys
const KEY_SKIP   = 'ef_update_skip_version';
const KEY_SNOOZE = 'ef_update_snooze_until';

// Returns true if `remote` is strictly newer than `current`
function isNewer(remote, current) {
  const parse = (v) => String(v).replace(/^v/, '').split('.').map(Number);
  const [rMaj, rMin, rPat] = parse(remote);
  const [cMaj, cMin, cPat] = parse(current);
  if (rMaj !== cMaj) return rMaj > cMaj;
  if (rMin !== cMin) return rMin > cMin;
  return rPat > cPat;
}

export function useUpdater() {
  const [updateInfo, setUpdateInfo] = useState(null);

  useEffect(() => {
    const check = async () => {
      // Respect active snooze
      const snoozeUntil = localStorage.getItem(KEY_SNOOZE);
      if (snoozeUntil && new Date() < new Date(snoozeUntil)) return;

      let manifest;
      try {
        const res = await fetch(UPDATE_MANIFEST_URL, { cache: 'no-store' });
        if (!res.ok) return;
        manifest = await res.json();
      } catch {
        return; // No internet or wrong URL — fail silently
      }

      const { version, notes, pub_date, download_url } = manifest;
      if (!version || !isNewer(version, CURRENT_VERSION)) return;

      // Respect "skip this version"
      if (localStorage.getItem(KEY_SKIP) === version) return;

      setUpdateInfo({
        version,
        notes:            notes        || '',
        pubDate:          pub_date     || '',
        downloadUrl:      download_url || '',
        gatekeeperCommand: 'xattr -cr /Applications/ElevateFlow.app',
      });
    };

    // 4-second delay so the splash screen can finish first
    const timer = setTimeout(check, 4000);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    if (updateInfo) localStorage.setItem(KEY_SKIP, updateInfo.version);
    setUpdateInfo(null);
  };

  const remindLater = () => {
    const until = new Date();
    until.setHours(until.getHours() + 24);
    localStorage.setItem(KEY_SNOOZE, until.toISOString());
    setUpdateInfo(null);
  };

  return { updateInfo, dismiss, remindLater };
}