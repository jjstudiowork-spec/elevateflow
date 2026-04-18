/**
 * ConfigureScreens.jsx — ElevateFlow Premium Screen Configuration
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { emitTo } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

const STORAGE_KEY = 'ef_screen_assignments';

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch { return {}; }
}

function save(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  window.dispatchEvent(new Event('ef-screens-updated'));
}

// ── Helpers ────────────────────────────────────────────────────
function getMonitorName(m, index) {
  const raw = m.name || '';
  // Filter out Windows device paths and generic fallbacks
  if (!raw || raw.includes('\\\\') || raw.includes('/dev/') || raw === 'Generic Monitor') {
    return `Display ${index + 1}`;
  }
  return raw.trim();
}

// ── Toggle ─────────────────────────────────────────────────────
function Toggle({ on, onChange }) {
  return (
    <button onClick={onChange} style={{
      width: 40, height: 22, borderRadius: 11, flexShrink: 0,
      background: on ? '#3b82f6' : '#2a2a2a',
      border: on ? '1px solid #3b82f6' : '1px solid #333',
      position: 'relative', cursor: 'pointer', padding: 0,
      transition: 'background 0.2s, border-color 0.2s',
    }}>
      <div style={{
        width: 16, height: 16, borderRadius: 8, background: '#fff',
        position: 'absolute', top: 2,
        left: on ? 20 : 2,
        transition: 'left 0.2s',
        boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
      }} />
    </button>
  );
}

// ── Screen card in sidebar ─────────────────────────────────────
function ScreenCard({ screen, selected, onClick, accentColor = '#D4AF37' }) {
  return (
    <div onClick={onClick} style={{
      padding: '10px 12px', borderRadius: 9, cursor: 'pointer',
      background: selected ? `${accentColor}0d` : 'transparent',
      border: `1px solid ${selected ? `${accentColor}35` : 'transparent'}`,
      marginBottom: 3, transition: 'all 0.12s',
      boxShadow: selected ? `0 0 0 3px ${accentColor}12` : 'none',
      display: 'flex', alignItems: 'center', gap: 10,
    }}
      onMouseEnter={e => { if (!selected) { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = '#1e1e24'; } }}
      onMouseLeave={e => { if (!selected) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; } }}
    >
      <div style={{
        width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
        background: selected ? accentColor : '#27272a',
        boxShadow: selected ? `0 0 6px ${accentColor}` : 'none',
        transition: 'all 0.15s',
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: selected ? '#e4e4e7' : '#71717a' }}>{screen.name}</div>
        <div style={{ fontSize: 9, color: selected ? '#52525b' : '#27272a', marginTop: 2, fontFamily: 'monospace' }}>
          {screen.width} × {screen.height}
          {screen.isPlaceholder && <span style={{ marginLeft: 6 }}>· Placeholder</span>}
          {screen.isNdi && <span style={{ marginLeft: 6, color: '#4ade80' }}>· NDI</span>}
        </div>
      </div>
    </div>
  );
}

// ── Add Screen Dropdown ────────────────────────────────────────
function AddDropdown({ monitors, onAdd, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);

  return (
    <div ref={ref} style={{
      position: 'absolute', top: 30, right: 0, zIndex: 200,
      background: '#1a1a1a', border: '1px solid #2a2a2a',
      borderRadius: 8, overflow: 'hidden', minWidth: 220,
      boxShadow: '0 16px 40px rgba(0,0,0,0.7)',
    }}>
      {monitors.length > 0 ? (
        <>
          <div style={{ padding: '6px 12px 4px', fontSize: 9, fontWeight: 800, color: '#333', letterSpacing: 1.5 }}>
            CONNECTED DISPLAYS
          </div>
          {monitors.map((m, i) => (
            <div key={i}
              onClick={() => {
                onAdd({
                  name: getMonitorName(m, i),
                  width: m.size?.width || 1920,
                  height: m.size?.height || 1080,
                  position: m.position,
                  scaleFactor: m.scaleFactor ?? 1,
                  monitorIndex: i,
                  isPlaceholder: false,
                });
                onClose();
              }}
              style={{
                padding: '9px 14px', cursor: 'pointer',
                borderBottom: '1px solid #222', transition: 'background 0.1s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = '#242424'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: '#ddd' }}>{getMonitorName(m, i)}</div>
              <div style={{ fontSize: 10, color: '#555', marginTop: 1, fontFamily: 'monospace' }}>
                {m.size?.width} × {m.size?.height}
              </div>
            </div>
          ))}
          <div style={{ height: 1, background: '#2a2a2a', margin: '2px 0' }} />
        </>
      ) : (
        <div style={{ padding: '10px 14px', fontSize: 11, color: '#444' }}>Scanning displays…</div>
      )}
      <div
        onClick={() => {
          onAdd({ name: 'Placeholder', width: 1920, height: 1080, isPlaceholder: true, monitorIndex: null });
          onClose();
        }}
        style={{
          padding: '9px 14px', cursor: 'pointer', transition: 'background 0.1s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = '#242424'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <div style={{ fontSize: 12, fontWeight: 600, color: '#888' }}>Placeholder (Custom Resolution)</div>
        <div style={{ fontSize: 10, color: '#444', marginTop: 1 }}>Define a custom size manually</div>
      </div>
      <div style={{ height: 1, background: '#1e1e1e' }} />
      <div
        onClick={() => {
          onAdd({ name: 'NDI Output', width: 1920, height: 1080, isNdi: true, isPlaceholder: true, monitorIndex: null, ndiSourceName: 'ElevateFlow NDI' });
          onClose();
        }}
        style={{ padding: '9px 14px', cursor: 'pointer', transition: 'background 0.1s' }}
        onMouseEnter={e => e.currentTarget.style.background = '#242424'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <div style={{ fontSize: 12, fontWeight: 600, color: '#00e87a' }}>NDI Output</div>
        <div style={{ fontSize: 10, color: '#444', marginTop: 1 }}>Stream via NDI to network receivers</div>
      </div>
    </div>
  );
}

// ── Section in sidebar ─────────────────────────────────────────
function Section({ label, role, enabled, onToggle, screens, selectedId, onSelect, monitors, onAdd, onRemove }) {
  const [showDropdown, setShowDropdown] = useState(false);
  const color = role === 'audience' ? '#60a5fa' : '#D4AF37';

  return (
    <div style={{ marginBottom: 20 }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px', marginBottom: 6,
        background: 'rgba(255,255,255,0.02)', borderRadius: 8,
        border: '1px solid #141418',
      }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, boxShadow: `0 0 6px ${color}66`, flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 800, color: '#71717a', flex: 1, letterSpacing: 1.5, textTransform: 'uppercase' }}>{label}</span>
        <Toggle on={enabled} onChange={onToggle} />
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowDropdown(p => !p)}
            style={{
              width: 22, height: 22, borderRadius: 6, padding: 0,
              background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)',
              color: '#D4AF37', fontSize: 16, lineHeight: 1, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >+</button>
          {showDropdown && (
            <AddDropdown
              monitors={monitors}
              onAdd={(screen) => onAdd(role, screen)}
              onClose={() => setShowDropdown(false)}
            />
          )}
        </div>
      </div>

      {/* Screen cards */}
      {screens.length === 0 ? (
        <div style={{ padding: '10px 12px', fontSize: 11, color: '#27272a', textAlign: 'center', fontStyle: 'italic' }}>
          No screens — click + to add
        </div>
      ) : (
        screens.map(s => (
          <ScreenCard key={s.id} screen={s}
            selected={selectedId === s.id}
            onClick={() => onSelect(s.id)}
            accentColor={color}
          />
        ))
      )}
    </div>
  );
}

// ── Hardware Tab ───────────────────────────────────────────────
function HardwareTab({ screen, monitors, onUpdate }) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <Field label="Output">
          <select style={selectSt} value={screen.isNdi ? 'ndi' : (screen.monitorIndex ?? '')} onChange={e => {
            const v = e.target.value;
            if (v === 'ndi') {
              onUpdate({ isNdi: true, isPlaceholder: true, monitorIndex: null, ndiSourceName: screen.ndiSourceName || 'ElevateFlow NDI' });
            } else if (v === '') {
              onUpdate({ isPlaceholder: true, isNdi: false, monitorIndex: null });
            } else {
              const idx = parseInt(v);
              const m = monitors[idx];
              const sf2 = m.scaleFactor ?? 1;
              onUpdate({
                monitorIndex: idx,
                isPlaceholder: false,
                isNdi: false,
                width:  Math.round((m.size?.width  || 1920) / sf2),
                height: Math.round((m.size?.height || 1080) / sf2),
                position: {
                  x: Math.round((m.position?.x ?? 0) / sf2),
                  y: Math.round((m.position?.y ?? 0) / sf2),
                },
                scaleFactor: sf2,
              });
            }
          }}>
            <option value="">Placeholder</option>
            {monitors.map((m, i) => (
              <option key={i} value={i}>{getMonitorName(m, i)} — {m.size?.width}×{m.size?.height}</option>
            ))}
            <option value="ndi">NDI Output</option>
          </select>
        </Field>
        <Field label="Output Target">
          <select style={selectSt} defaultValue="Full">
            <option>Full</option>
            <option>Left Half</option>
            <option>Right Half</option>
          </select>
        </Field>
      </div>

      <div style={{
        background: 'rgba(255,255,255,0.02)', border: '1px solid #222',
        borderRadius: 8, padding: '16px',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={labelSt}>Name</span>
          <input style={{ ...inputSt, flex: 1 }}
            value={screen.name}
            onChange={e => onUpdate({ name: e.target.value })}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={labelSt}>Size</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ textAlign: 'center' }}>
              <input style={{ ...inputSt, width: 80, textAlign: 'center' }}
                type="number" value={screen.width}
                onChange={e => onUpdate({ width: parseInt(e.target.value) || 1920, isPlaceholder: true })}
              />
              <div style={{ fontSize: 9, color: '#333', marginTop: 3, letterSpacing: 0.5 }}>WIDTH</div>
            </div>
            <span style={{ color: '#333', fontSize: 18, marginBottom: 14 }}>×</span>
            <div style={{ textAlign: 'center' }}>
              <input style={{ ...inputSt, width: 80, textAlign: 'center' }}
                type="number" value={screen.height}
                onChange={e => onUpdate({ height: parseInt(e.target.value) || 1080, isPlaceholder: true })}
              />
              <div style={{ fontSize: 9, color: '#333', marginTop: 3, letterSpacing: 0.5 }}>HEIGHT</div>
            </div>
            <span style={{ color: '#333', fontSize: 10, marginBottom: 14 }}>px</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ fontSize: 10, fontWeight: 700, color: '#444', letterSpacing: 0.8 }}>{label.toUpperCase()}</span>
      {children}
    </div>
  );
}

const labelSt = { fontSize: 11, color: '#555', fontWeight: 600, minWidth: 44, textAlign: 'right' };
const selectSt = {
  width: '100%', height: 28, background: '#141414', border: '1px solid #2a2a2a',
  borderRadius: 5, color: '#bbb', fontSize: 11, padding: '0 8px',
  outline: 'none', fontFamily: 'system-ui, Arial',
};
const inputSt = {
  height: 28, background: '#141414', border: '1px solid #2a2a2a',
  borderRadius: 5, color: '#bbb', fontSize: 11, padding: '0 8px',
  outline: 'none', fontFamily: 'system-ui, Arial',
};

// ── NDI Tab ────────────────────────────────────────────────────
function NdiTab({ screen, role, onUpdate }) {
  const [live,    setLive]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [avail,   setAvail]   = useState(false);

  useEffect(() => {
    invoke('ndi_status').then(s => { setLive(s[role] || false); setAvail(s.available); }).catch(() => {});
    const id = setInterval(() => {
      invoke('ndi_status').then(s => { setLive(s[role] || false); setAvail(s.available); }).catch(() => {});
    }, 2000);
    return () => clearInterval(id);
  }, [role]);

  const toggle = async () => {
    setLoading(true); setError(null);
    try {
      if (live) {
        await invoke('ndi_stop', { role });
      } else {
        await invoke('ndi_start', {
          role,
          name:   screen.ndiSourceName || 'ElevateFlow NDI',
          width:  screen.width  || 1920,
          height: screen.height || 1080,
        });
      }
      const s = await invoke('ndi_status');
      setLive(s[role] || false);
    } catch (e) { setError(e?.toString() || 'Error'); }
    finally { setLoading(false); }
  };

  return (
    <div>
      {/* Status bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', borderRadius: 8, marginBottom: 18,
        background: live ? 'rgba(0,232,122,0.06)' : 'rgba(255,255,255,0.02)',
        border: `1px solid ${live ? 'rgba(0,232,122,0.2)' : '#1e1e1e'}`,
      }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
          background: live ? '#00e87a' : '#333',
          boxShadow: live ? '0 0 8px rgba(0,232,122,0.6)' : 'none',
        }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: live ? '#00e87a' : '#444' }}>
          {live ? 'STREAMING' : 'OFFLINE'}
        </span>
        {live && <span style={{ fontSize: 10, color: '#2a7a4a', marginLeft: 4 }}>
          Visible to NDI receivers on your network
        </span>}
      </div>

      {!avail && (
        <div style={{
          padding: '8px 12px', borderRadius: 6, marginBottom: 16,
          background: 'rgba(255,170,0,0.05)', border: '1px solid rgba(255,170,0,0.15)',
          fontSize: 11, color: '#888', lineHeight: 1.5,
        }}>
          ⚠ NDI SDK not found. Install from <span style={{ color: '#D4AF37' }}>ndi.video</span> to enable.
        </div>
      )}

      {/* Source name */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 16 }}>
        <label style={{ fontSize: 10, fontWeight: 700, color: '#444', letterSpacing: 0.8 }}>SOURCE NAME</label>
        <input style={{ ...inputSt, width: '100%' }}
          value={screen.ndiSourceName || 'ElevateFlow NDI'}
          onChange={e => onUpdate({ ndiSourceName: e.target.value })}
          disabled={live}
          placeholder="Name visible in NDI receivers"
        />
        <span style={{ fontSize: 9, color: '#2a2a2a' }}>
          This is how the source appears in OBS, Resolume, vMix etc.
        </span>
      </div>

      {/* Resolution */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: '#444', letterSpacing: 0.8, display: 'block', marginBottom: 5 }}>WIDTH</label>
          <input style={{ ...inputSt, width: '100%', textAlign: 'center' }}
            type="number" value={screen.width || 1920}
            onChange={e => onUpdate({ width: parseInt(e.target.value) || 1920 })}
            disabled={live}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 6, color: '#333', fontSize: 18 }}>×</div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 10, fontWeight: 700, color: '#444', letterSpacing: 0.8, display: 'block', marginBottom: 5 }}>HEIGHT</label>
          <input style={{ ...inputSt, width: '100%', textAlign: 'center' }}
            type="number" value={screen.height || 1080}
            onChange={e => onUpdate({ height: parseInt(e.target.value) || 1080 })}
            disabled={live}
          />
        </div>
      </div>

      {/* Go Live button — always clearly visible */}
      <button
        onClick={toggle}
        disabled={loading || !avail}
        style={{
          width: '100%', height: 40, borderRadius: 8,
          background: live
            ? 'rgba(239,68,68,0.12)'
            : avail
            ? 'rgba(0,232,122,0.12)'
            : 'rgba(255,255,255,0.03)',
          border: `1px solid ${live ? 'rgba(239,68,68,0.4)' : avail ? 'rgba(0,232,122,0.4)' : '#2a2a2a'}`,
          color: live ? '#ef4444' : avail ? '#00e87a' : '#333',
          fontSize: 13, fontWeight: 800,
          cursor: loading || !avail ? 'not-allowed' : 'pointer',
          transition: 'all 0.15s', letterSpacing: 0.5,
          fontFamily: 'system-ui, Arial',
        }}
      >
        {loading ? '…' : live ? '⏹  Stop Streaming' : avail ? '▶  Go Live' : 'NDI SDK Required'}
      </button>

      {error && (
        <div style={{ marginTop: 10, padding: '6px 10px', borderRadius: 5, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', fontSize: 10, color: '#ef4444', fontFamily: 'monospace', wordBreak: 'break-word' }}>
          {error}
        </div>
      )}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────
export default function ConfigureScreens() {
  const [monitors,        setMonitors]        = useState([]);
  const [audienceEnabled, setAudienceEnabled] = useState(true);
  const [stageEnabled,    setStageEnabled]    = useState(true);
  const [audienceScreens, setAudienceScreens] = useState([]);
  const [stageScreens,    setStageScreens]    = useState([]);
  const [selectedId,      setSelectedId]      = useState(null);
  const [activeTab,       setActiveTab]       = useState('Hardware');
  const [underscan,       setUnderscan]       = useState(0);

  // Load monitors — use Rust command for proper display names
  useEffect(() => {
    const fetchMon = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const list = await invoke('get_monitors');
        if (list?.length > 0) {
          // Normalize to same shape as Tauri's availableMonitors()
          const normalized = list.map(m => ({
            name:        m.name,
            size:        { width: m.width, height: m.height },
            position:    { x: m.x, y: m.y },
            scaleFactor: m.scaleFactor,
          }));
          setMonitors(normalized);
          return;
        }
      } catch {}
      // Fallback to JS API
      try {
        const { availableMonitors } = await import('@tauri-apps/api/window');
        const list = await availableMonitors();
        if (list?.length > 0) { setMonitors(list); return; }
      } catch {}
      setTimeout(fetchMon, 1500);
    };
    fetchMon();
  }, []);

  // Load saved config
  useEffect(() => {
    const saved = load();
    if (saved.audienceScreens)              setAudienceScreens(saved.audienceScreens);
    if (saved.stageScreens)                 setStageScreens(saved.stageScreens);
    if (saved.audienceEnabled !== undefined) setAudienceEnabled(saved.audienceEnabled);
    if (saved.stageEnabled    !== undefined) setStageEnabled(saved.stageEnabled);
    if (saved.underscan       !== undefined) setUnderscan(saved.underscan);
  }, []);

  // Persist on every change
  useEffect(() => {
    const allScreens = [
      ...audienceScreens.map(s => ({ ...s, role: 'audience' })),
      ...stageScreens.map(s => ({ ...s, role: 'stage' })),
    ];
    save({
      audienceScreens, stageScreens,
      audienceEnabled, stageEnabled, underscan,
      // Legacy compat for outputManager
      audience: audienceScreens[0] ? { ...audienceScreens[0], size: { width: audienceScreens[0].width, height: audienceScreens[0].height } } : null,
      stage:    stageScreens[0]    ? { ...stageScreens[0],    size: { width: stageScreens[0].width,    height: stageScreens[0].height    } } : null,
      allScreens,
    });
    emitTo('*', 'apply-underscan', { value: underscan }).catch(() => {});
  }, [audienceScreens, stageScreens, audienceEnabled, stageEnabled, underscan]);

  const allScreens = [
    ...audienceScreens.map(s => ({ ...s, role: 'audience' })),
    ...stageScreens.map(s => ({ ...s, role: 'stage' })),
  ];
  const selected = allScreens.find(s => s.id === selectedId) || null;

  const addScreen = useCallback((role, screenData) => {
    const newScreen = {
      id:            `${role}-${Date.now()}`,
      name:          screenData.name || (role === 'audience' ? 'Audience Screen' : 'Stage Screen'),
      width:         screenData.width  || 1920,
      height:        screenData.height || 1080,
      isPlaceholder: screenData.isPlaceholder ?? true,
      isNdi:         screenData.isNdi         ?? false,
      ndiSourceName: screenData.ndiSourceName || '',
      monitorIndex:  screenData.monitorIndex  ?? null,
      position:      screenData.position      || null,
      scaleFactor:   screenData.scaleFactor   || 1,
    };
    if (role === 'audience') setAudienceScreens(p => [...p, newScreen]);
    else                     setStageScreens(p => [...p, newScreen]);
    setSelectedId(newScreen.id);
  }, []);

  const updateScreen = useCallback((id, role, updates) => {
    if (role === 'audience') setAudienceScreens(p => p.map(s => s.id === id ? { ...s, ...updates } : s));
    else                     setStageScreens(p => p.map(s => s.id === id ? { ...s, ...updates } : s));
  }, []);

  const removeScreen = useCallback((id, role) => {
    if (role === 'audience') setAudienceScreens(p => p.filter(s => s.id !== id));
    else                     setStageScreens(p => p.filter(s => s.id !== id));
    if (selectedId === id) setSelectedId(null);
  }, [selectedId]);

  const TABS = ['Hardware', 'Color', 'Corner Pin', 'Alpha Key'];

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '280px 1fr', height: '100vh',
      background: '#0a0a0c',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Arial, sans-serif',
      color: '#fff', userSelect: 'none', overflow: 'hidden',
    }}>

      {/* ── SIDEBAR ── */}
      <div style={{
        background: '#0e0e12', borderRight: '1px solid #1a1a1e',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px' }}>
          <Section
            label="Audience" role="audience"
            enabled={audienceEnabled} onToggle={() => setAudienceEnabled(p => !p)}
            screens={audienceScreens} selectedId={selectedId}
            onSelect={setSelectedId} monitors={monitors}
            onAdd={addScreen}
            onRemove={removeScreen}
          />
          <div style={{ height: 20 }} />
          <Section
            label="Stage" role="stage"
            enabled={stageEnabled} onToggle={() => setStageEnabled(p => !p)}
            screens={stageScreens} selectedId={selectedId}
            onSelect={setSelectedId} monitors={monitors}
            onAdd={addScreen}
            onRemove={removeScreen}
          />
        </div>

        {/* Bottom */}
        <div style={{
          padding: '14px 16px', borderTop: '1px solid #141418',
          background: '#0c0c10',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, color: '#3f3f46' }}>UNDERSCAN</span>
            <span style={{ fontSize: 11, color: '#D4AF37', fontFamily: 'monospace', fontWeight: 700 }}>{underscan}%</span>
          </div>
          <input type="range" min="0" max="20" step="0.5" value={underscan}
            onChange={e => setUnderscan(parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#D4AF37', cursor: 'pointer', marginBottom: 10 }}
          />
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      {selected ? (
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Header */}
          <div style={{
            padding: '20px 24px 0',
            background: 'linear-gradient(180deg, rgba(212,175,55,0.03) 0%, transparent 100%)',
            borderBottom: '1px solid #141418',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#e4e4e7', letterSpacing: -0.3 }}>{selected.name}</div>
                <div style={{ fontSize: 11, color: '#52525b', marginTop: 4, fontFamily: 'monospace' }}>
                  {selected.width} × {selected.height}
                  {selected.isPlaceholder && <span style={{ color: '#3f3f46', marginLeft: 8, background: '#1a1a1e', padding: '1px 6px', borderRadius: 4 }}>Placeholder</span>}
                  {selected.isNdi && <span style={{ color: '#4ade80', marginLeft: 8, background: 'rgba(74,222,128,0.08)', padding: '1px 6px', borderRadius: 4 }}>NDI</span>}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {(selected.role === 'audience' ? audienceScreens : stageScreens).length > 1 && (
                  <button
                    onClick={() => removeScreen(selected.id, selected.role)}
                    style={{
                      height: 28, padding: '0 12px',
                      background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
                      borderRadius: 7, color: '#f87171', fontSize: 11, cursor: 'pointer',
                      fontFamily: 'system-ui, Arial', fontWeight: 600,
                    }}
                  >Remove</button>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 2 }}>
              {TABS.map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)} style={{
                  padding: '7px 16px', borderRadius: '8px 8px 0 0',
                  background: activeTab === tab ? '#0a0a0c' : 'transparent',
                  border: `1px solid ${activeTab === tab ? '#1a1a1e' : 'transparent'}`,
                  borderBottom: activeTab === tab ? '1px solid #0a0a0c' : '1px solid transparent',
                  color: activeTab === tab ? '#e4e4e7' : '#52525b',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'system-ui, Arial', marginBottom: -1,
                  transition: 'color 0.15s',
                }}>
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Preview + content */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

            {/* Screen preview */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '24px', background: '#080808',
              borderBottom: '1px solid #141418', flexShrink: 0,
            }}>
              <div style={{
                position: 'relative',
                aspectRatio: `${selected.width} / ${selected.height}`,
                maxWidth: 400, maxHeight: 150,
                background: '#000',
                border: '1px solid #1e1e24',
                borderRadius: 6,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 12px 40px rgba(0,0,0,0.8)',
                containerType: 'inline-size',
              }}>
                <span style={{ fontSize: '2cqw', color: '#1e1e24', fontWeight: 800, letterSpacing: 1 }}>{selected.name}</span>
                {/* Corner marks */}
                {[['0%','0%'],['100%','0%'],['0%','100%'],['100%','100%']].map(([l,t],i) => (
                  <div key={i} style={{
                    position:'absolute', width:10, height:10,
                    left:l, top:t,
                    borderTop: (t==='0%') ? '1.5px solid #D4AF37' : 'none',
                    borderBottom: (t==='100%') ? '1.5px solid #D4AF37' : 'none',
                    borderLeft: (l==='0%') ? '1.5px solid #D4AF37' : 'none',
                    borderRight: (l==='100%') ? '1.5px solid #D4AF37' : 'none',
                    transform: `translate(${l==='100%'?'-100%':'0'}, ${t==='100%'?'-100%':'0'})`,
                  }}/>
                ))}
              </div>
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, padding: '20px 24px', overflowY: 'auto' }}>
              {selected.isNdi ? (
                <NdiTab
                  screen={selected}
                  role={selected.role}
                  onUpdate={u => updateScreen(selected.id, selected.role, u)}
                />
              ) : activeTab === 'Hardware' ? (
                <HardwareTab
                  screen={selected}
                  monitors={monitors}
                  onUpdate={u => updateScreen(selected.id, selected.role, u)}
                />
              ) : (
                <div style={{ color: '#333', fontSize: 12, paddingTop: 8 }}>
                  {activeTab} settings coming soon.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', color: '#222', gap: 14, padding: 40,
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18, background: '#111115',
            border: '1px solid #1a1a1e', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#2a2a35" strokeWidth="1.5" strokeLinecap="round">
              <rect x="2" y="3" width="20" height="14" rx="2"/>
              <path d="M8 21h8M12 17v4"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#27272a', textAlign: 'center', marginBottom: 6 }}>No screen selected</div>
            <div style={{ fontSize: 12, color: '#1e1e24', textAlign: 'center' }}>Select a screen from the sidebar or add a new one</div>
          </div>
        </div>
      )}
    </div>
  );
}