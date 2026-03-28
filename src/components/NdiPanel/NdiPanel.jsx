/**
 * NdiPanel.jsx
 * Floating NDI control panel — start/stop audience and stage NDI streams.
 * Shows connection status and NDI source names visible on the network.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

const STORAGE_KEY = 'ef_screen_assignments';

function loadScreenConfig() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch { return {}; }
}

export default function NdiPanel({ onClose }) {
  const [status,        setStatus]        = useState({ audience: false, stage: false, available: false });
  const [audienceName,  setAudienceName]  = useState('ElevateFlow Audience');
  const [stageName,     setStageName]     = useState('ElevateFlow Stage');
  const [loading,       setLoading]       = useState({ audience: false, stage: false });
  const [error,         setError]         = useState(null);

  // Poll status every 2s
  useEffect(() => {
    const check = async () => {
      try {
        const s = await invoke('ndi_status');
        setStatus(s);
      } catch {}
    };
    check();
    const id = setInterval(check, 2000);
    return () => clearInterval(id);
  }, []);

  // Load screen names as NDI source name defaults
  useEffect(() => {
    const cfg = loadScreenConfig();
    if (cfg.audienceScreens?.[0]?.name) setAudienceName(`ElevateFlow – ${cfg.audienceScreens[0].name}`);
    if (cfg.stageScreens?.[0]?.name)    setStageName(`ElevateFlow – ${cfg.stageScreens[0].name}`);
  }, []);

  const toggle = useCallback(async (role) => {
    setLoading(p => ({ ...p, [role]: true }));
    setError(null);
    try {
      if (status[role]) {
        await invoke('ndi_stop', { role });
      } else {
        const cfg    = loadScreenConfig();
        const screen = role === 'audience' ? cfg.audienceScreens?.[0] : cfg.stageScreens?.[0];
        const w = screen?.width  || 1920;
        const h = screen?.height || 1080;
        const name = role === 'audience' ? audienceName : stageName;
        await invoke('ndi_start', { role, name, width: w, height: h });
      }
      const s = await invoke('ndi_status');
      setStatus(s);
    } catch (err) {
      setError(err?.toString() || 'NDI error');
    } finally {
      setLoading(p => ({ ...p, [role]: false }));
    }
  }, [status, audienceName, stageName]);

  return (
    <div className="ndi-panel">
      {/* Header */}
      <div className="ndi-panel__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <NdiIcon />
          <span className="ndi-panel__title">NDI OUTPUT</span>
        </div>
        <button className="ndi-panel__close" onClick={onClose}>✕</button>
      </div>

      {/* NDI available warning */}
      {!status.available && (
        <div className="ndi-panel__warning">
          <span>⚠</span>
          NDI SDK not found. Install from{' '}
          <span style={{ color: '#D4AF37', textDecoration: 'underline', cursor: 'pointer' }}
            onClick={() => invoke('open_url', { url: 'https://ndi.video/for-developers/ndi-sdk/' }).catch(() => {})}>
            ndi.video
          </span>
        </div>
      )}

      {/* Streams */}
      <div className="ndi-panel__streams">
        <StreamRow
          label="Audience"
          name={audienceName}
          onNameChange={setAudienceName}
          live={status.audience}
          loading={loading.audience}
          disabled={!status.available}
          onToggle={() => toggle('audience')}
        />
        <StreamRow
          label="Stage"
          name={stageName}
          onNameChange={setStageName}
          live={status.stage}
          loading={loading.stage}
          disabled={!status.available}
          onToggle={() => toggle('stage')}
        />
      </div>

      {/* Error */}
      {error && (
        <div className="ndi-panel__error">{error}</div>
      )}

      {/* Info */}
      <div className="ndi-panel__footer">
        Active streams are visible to NDI receivers on your local network (OBS, vMix, Studio Monitor…)
      </div>
    </div>
  );
}

function StreamRow({ label, name, onNameChange, live, loading, disabled, onToggle }) {
  return (
    <div className={`ndi-stream ${live ? 'ndi-stream--live' : ''}`}>
      <div className="ndi-stream__top">
        <div className="ndi-stream__label-row">
          <div className={`ndi-stream__dot ${live ? 'ndi-stream__dot--live' : ''}`} />
          <span className="ndi-stream__label">{label}</span>
          {live && <span className="ndi-stream__badge">LIVE</span>}
        </div>
        <button
          className={`ndi-stream__btn ${live ? 'ndi-stream__btn--stop' : 'ndi-stream__btn--start'}`}
          onClick={onToggle}
          disabled={disabled || loading}
        >
          {loading ? '…' : live ? 'Stop' : 'Go Live'}
        </button>
      </div>
      <div className="ndi-stream__name-row">
        <span className="ndi-stream__name-label">Source Name</span>
        <input
          className="ndi-stream__name-input"
          value={name}
          onChange={e => onNameChange(e.target.value)}
          disabled={live}
          placeholder="NDI source name on network"
        />
      </div>
    </div>
  );
}

function NdiIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
      <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
      <circle cx="12" cy="20" r="1" fill="currentColor"/>
    </svg>
  );
}