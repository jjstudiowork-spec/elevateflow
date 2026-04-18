/**
 * StreamStudio.jsx — ElevateFlow Stream
 * Live streaming studio. OBS-inspired layout with ElevateFlow aesthetics.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

// ─────────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────
const C = {
  bg:         '#09090c',
  surface:    '#0e0e12',
  surface2:   '#111116',
  border:     '#1a1a1f',
  border2:    '#222228',
  text:       '#e4e4e7',
  textDim:    '#71717a',
  textMuted:  '#3f3f46',
  gold:       '#D4AF37',
  goldDim:    'rgba(212,175,55,0.15)',
  goldBorder: 'rgba(212,175,55,0.25)',
  red:        '#ef4444',
  green:      '#22c55e',
  blue:       '#3b82f6',
};

const panelHeader = {
  display: 'flex', alignItems: 'center', gap: 7,
  padding: '8px 10px',
  background: C.surface2,
  borderBottom: `1px solid ${C.border}`,
  flexShrink: 0,
};

const panelTitle = {
  fontSize: 11, fontWeight: 700,
  color: C.textDim, letterSpacing: 0.8,
  textTransform: 'uppercase', flex: 1,
};

const iconBtn = (active = false, danger = false) => ({
  height: 22, padding: '0 8px',
  background: danger
    ? 'rgba(239,68,68,0.08)'
    : active ? C.goldDim : 'rgba(255,255,255,0.04)',
  border: `1px solid ${danger ? 'rgba(239,68,68,0.25)' : active ? C.goldBorder : C.border2}`,
  borderRadius: 5,
  color: danger ? C.red : active ? C.gold : C.textDim,
  fontSize: 10, fontWeight: 700, cursor: 'pointer',
  display: 'flex', alignItems: 'center', gap: 4,
  fontFamily: 'inherit', letterSpacing: 0.3,
  transition: 'all 0.15s',
  whiteSpace: 'nowrap',
  flexShrink: 0,
});

const toolbarBtn = {
  width: 20, height: 20,
  background: 'rgba(255,255,255,0.04)',
  border: `1px solid ${C.border2}`,
  borderRadius: 4, color: C.textDim,
  fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0,
};

// ─────────────────────────────────────────────────────────────────
// VU METER
// ─────────────────────────────────────────────────────────────────
function VuMeter({ channels = 2, active = true }) {
  const [levels, setLevels] = useState(() => Array(channels).fill(0.08));

  useEffect(() => {
    if (!active) return;
    // Simulate audio with some correlation between channels
    let base = 0.15;
    const id = setInterval(() => {
      base = Math.max(0.02, Math.min(0.88, base + (Math.random() - 0.48) * 0.12));
      setLevels(Array(channels).fill(0).map(() =>
        Math.max(0.01, Math.min(0.95, base + (Math.random() - 0.5) * 0.08))
      ));
    }, 75);
    return () => clearInterval(id);
  }, [active, channels]);

  return (
    <div style={{ display: 'flex', gap: 2, height: 96, alignItems: 'flex-end' }}>
      {levels.map((lvl, i) => (
        <div key={i} style={{
          flex: 1, minWidth: 8,
          background: '#070709',
          border: `1px solid #111`,
          borderRadius: '2px 2px 0 0',
          overflow: 'hidden', position: 'relative',
        }}>
          {/* Dim track (always visible, shows scale) */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to top, #052e16 0%, #052e1688 55%, #42200666 75%, #450a0a44 90%)',
          }} />
          {/* Live level */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            height: `${lvl * 100}%`,
            background: lvl > 0.82
              ? '#ef4444'
              : `linear-gradient(to top, #16a34a 0%, #22c55e 50%, ${lvl > 0.65 ? '#eab308' : '#22c55e'} 80%, ${lvl > 0.82 ? '#ef4444' : 'transparent'} 100%)`,
            transition: 'height 0.07s ease-out',
          }} />
          {/* Peak tick */}
          <div style={{
            position: 'absolute', left: 0, right: 0,
            bottom: `${Math.min(lvl * 100 + 2, 96)}%`,
            height: 1.5,
            background: lvl > 0.65 ? '#fbbf24' : '#4ade80',
            opacity: 0.8,
            transition: 'bottom 0.07s ease-out',
          }} />
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SCENE LIST
// ─────────────────────────────────────────────────────────────────
function ScenesPanel({ scenes, activeScene, onSelect, onAdd, onRemove }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      background: C.surface, borderRight: `1px solid ${C.border}`,
      overflow: 'hidden', minWidth: 0,
    }}>
      <div style={panelHeader}>
        <SceneIcon />
        <span style={panelTitle}>Scenes</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {scenes.map(s => (
          <div key={s.id}
            onClick={() => onSelect(s.id)}
            style={{
              padding: '7px 10px', cursor: 'pointer', fontSize: 12,
              color: s.id === activeScene ? C.text : C.textDim,
              background: s.id === activeScene
                ? `linear-gradient(90deg, ${C.goldDim} 0%, transparent 100%)`
                : 'transparent',
              borderLeft: `2px solid ${s.id === activeScene ? C.gold : 'transparent'}`,
              transition: 'all 0.1s',
            }}
          >
            {s.name}
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{
        display: 'flex', gap: 3, padding: '5px 8px',
        borderTop: `1px solid ${C.border}`, background: C.surface2,
      }}>
        {['+','−','⧉','↑','↓'].map(icon => (
          <button key={icon} style={toolbarBtn}
            onClick={icon === '+' ? onAdd : icon === '−' ? onRemove : undefined}>
            <span style={{ fontSize: icon === '⧉' ? 9 : 13 }}>{icon}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SOURCES
// ─────────────────────────────────────────────────────────────────
function SourcesPanel({ sources }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      background: C.surface, borderRight: `1px solid ${C.border}`,
      overflow: 'hidden', minWidth: 0,
    }}>
      <div style={panelHeader}>
        <SourceIcon />
        <span style={panelTitle}>Sources</span>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16, gap: 10 }}>
        {sources.length === 0 ? (
          <>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: C.surface2, border: `1px solid ${C.border2}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: C.textMuted, fontSize: 20,
            }}>?</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.5 }}>
                You don't have any sources.<br />
                Click the + button below,<br />
                or right click here to add one.
              </div>
            </div>
          </>
        ) : (
          sources.map(s => (
            <div key={s.id} style={{ width: '100%', padding: '6px 8px', fontSize: 12, color: C.textDim,
              background: C.surface2, borderRadius: 6, border: `1px solid ${C.border}` }}>
              {s.name}
            </div>
          ))
        )}
      </div>

      <div style={{
        display: 'flex', gap: 3, padding: '5px 8px',
        borderTop: `1px solid ${C.border}`, background: C.surface2,
      }}>
        {['+','−','⚙','↑','↓'].map(icon => (
          <button key={icon} style={toolbarBtn}>
            <span style={{ fontSize: icon === '⚙' ? 10 : 13 }}>{icon}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// AUDIO CHANNEL STRIP
// ─────────────────────────────────────────────────────────────────
function AudioChannel({ name, label, muted, onToggleMute }) {
  const [vol, setVol] = useState(70);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 6, padding: '8px 6px',
      borderRight: `1px solid ${C.border}`,
      minWidth: 64, flex: 1,
    }}>
      {/* Label */}
      <div style={{ fontSize: 9, fontWeight: 700, color: C.textMuted, letterSpacing: 0.5, textAlign: 'center' }}>
        {label}
      </div>
      <div style={{ fontSize: 8, color: C.textMuted, opacity: 0.5, textAlign: 'center', marginTop: -4 }}>
        {name}
      </div>

      {/* VU */}
      <VuMeter channels={2} active={!muted} />

      {/* dB reading */}
      <div style={{ fontSize: 9, fontFamily: 'monospace', color: C.textMuted }}>
        {muted ? '—∞ dB' : `${(vol / 100 * 6 - 6).toFixed(1)} dB`}
      </div>

      {/* Volume Slider */}
      <div style={{ width: '100%', padding: '0 4px' }}>
        <input
          type="range" min={0} max={100} value={vol}
          onChange={e => setVol(parseInt(e.target.value))}
          style={{ width: '100%', accentColor: muted ? C.textMuted : C.gold, cursor: 'pointer', height: 2 }}
        />
      </div>

      {/* Controls row */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {/* Mute */}
        <button
          onClick={onToggleMute}
          style={{
            width: 22, height: 22, borderRadius: 5,
            background: muted ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${muted ? 'rgba(239,68,68,0.3)' : C.border2}`,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          title={muted ? 'Unmute' : 'Mute'}
        >
          {muted
            ? <MuteIcon color={C.red} />
            : <SpeakerIcon color={C.textDim} />
          }
        </button>
        {/* Monitor */}
        <button style={{
          width: 22, height: 22, borderRadius: 5,
          background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border2}`,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} title="Monitor">
          <HeadphonesIcon color={C.textMuted} />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// AUDIO MIXER
// ─────────────────────────────────────────────────────────────────
const CHANNELS = [
  { id: 'da1',  name: 'Desktop Audio',   label: 'Global' },
  { id: 'da2',  name: 'Desktop Audio 2', label: 'Global' },
  { id: 'mic1', name: 'Mic/Aux',         label: 'Global' },
  { id: 'mic2', name: 'Mic/Aux 2',       label: 'Global' },
];

function AudioMixerPanel() {
  const [muted, setMuted] = useState({});

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      background: C.surface, borderRight: `1px solid ${C.border}`,
      overflow: 'hidden', minWidth: 0, flex: 2,
    }}>
      <div style={panelHeader}>
        <AudioIcon />
        <span style={panelTitle}>Audio Mixer</span>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {CHANNELS.map(ch => (
          <AudioChannel
            key={ch.id}
            name={ch.name}
            label={ch.label}
            muted={!!muted[ch.id]}
            onToggleMute={() => setMuted(p => ({ ...p, [ch.id]: !p[ch.id] }))}
          />
        ))}
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '5px 8px', borderTop: `1px solid ${C.border}`,
        background: C.surface2,
      }}>
        <span style={{ fontSize: 10, color: C.textMuted, flex: 1 }}>0 hidden</span>
        {['⊟','⚙'].map(icon => (
          <button key={icon} style={toolbarBtn}>
            <span style={{ fontSize: 11 }}>{icon}</span>
          </button>
        ))}
        <button style={iconBtn()}>
          <span style={{ fontSize: 10 }}>Options ▾</span>
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SCENE TRANSITIONS
// ─────────────────────────────────────────────────────────────────
const TRANSITIONS = ['Cut', 'Fade', 'Swipe', 'Slide', 'Fade to Black', 'Luma Wipe'];

function TransitionsPanel() {
  const [selected, setSelected] = useState('Fade');
  const [duration, setDuration] = useState(300);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      background: C.surface, borderRight: `1px solid ${C.border}`,
      overflow: 'hidden', minWidth: 0,
    }}>
      <div style={panelHeader}>
        <TransitionIcon />
        <span style={panelTitle}>Scene Transitions</span>
      </div>

      <div style={{ flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Type select */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontSize: 9, color: C.textMuted, fontWeight: 700, letterSpacing: 0.8 }}>TYPE</span>
          <select
            value={selected}
            onChange={e => setSelected(e.target.value)}
            style={{
              width: '100%', height: 28,
              background: C.surface2, border: `1px solid ${C.border2}`,
              borderRadius: 5, color: C.text, fontSize: 11,
              padding: '0 8px', outline: 'none', fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            {TRANSITIONS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Duration */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontSize: 9, color: C.textMuted, fontWeight: 700, letterSpacing: 0.8 }}>DURATION</span>
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            <input
              type="number" value={duration}
              onChange={e => setDuration(parseInt(e.target.value) || 300)}
              style={{
                flex: 1, height: 28,
                background: C.surface2, border: `1px solid ${C.border2}`,
                borderRadius: 5, color: C.text, fontSize: 11,
                padding: '0 8px', outline: 'none', fontFamily: 'inherit',
              }}
            />
            <span style={{ fontSize: 10, color: C.textMuted }}>ms</span>
          </div>
          <input type="range" min={0} max={3000} step={50} value={duration}
            onChange={e => setDuration(parseInt(e.target.value))}
            style={{ width: '100%', accentColor: C.gold, cursor: 'pointer', height: 2 }}
          />
        </div>

        {/* Quick transitions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 9, color: C.textMuted, fontWeight: 700, letterSpacing: 0.8 }}>QUICK TRANSITIONS</span>
            <button style={{ ...toolbarBtn, width: 'auto', padding: '0 6px', fontSize: 13 }}>+</button>
          </div>
          {['Cut', 'Fade (300ms)', 'Fade to Black (300ms)'].map(t => (
            <button key={t} style={{
              height: 28, width: '100%', textAlign: 'left', padding: '0 10px',
              background: C.surface2, border: `1px solid ${C.border2}`,
              borderRadius: 5, color: C.textDim, fontSize: 11, cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              {t}
              <span style={{ fontSize: 9, color: C.textMuted }}>▾</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{
        display: 'flex', gap: 3, padding: '5px 8px',
        borderTop: `1px solid ${C.border}`, background: C.surface2,
      }}>
        {['+','−','⋮'].map(icon => (
          <button key={icon} style={toolbarBtn}>
            <span style={{ fontSize: 13 }}>{icon}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// CONTROLS PANEL
// ─────────────────────────────────────────────────────────────────
function ControlsPanel({ streaming, recording, onToggleStream, onToggleRecord }) {
  const [studioMode, setStudioMode] = useState(false);
  const navigate = useNavigate();

  const bigBtn = (label, active, danger, onClick) => (
    <button
      onClick={onClick}
      style={{
        width: '100%', height: 36, borderRadius: 8,
        background: active
          ? danger ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.08)'
          : 'rgba(255,255,255,0.04)',
        border: `1px solid ${active
          ? danger ? 'rgba(239,68,68,0.35)' : 'rgba(34,197,94,0.3)'
          : C.border2}`,
        color: active
          ? danger ? C.red : C.green
          : C.textDim,
        fontSize: 12, fontWeight: 700, cursor: 'pointer',
        fontFamily: 'inherit', letterSpacing: 0.3,
        transition: 'all 0.15s',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}
    >
      {active ? '⏹' : '▶'} {label}
    </button>
  );

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      background: C.surface, overflow: 'hidden', minWidth: 0,
    }}>
      <div style={panelHeader}>
        <ControlIcon />
        <span style={panelTitle}>Controls</span>
      </div>

      <div style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {bigBtn(streaming ? 'Stop Streaming' : 'Start Streaming', streaming, true, onToggleStream)}
        {bigBtn(recording ? 'Stop Recording' : 'Start Recording', recording, true, onToggleRecord)}

        {/* Virtual Camera */}
        <button style={{
          width: '100%', height: 36, borderRadius: 8,
          background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border2}`,
          color: C.textDim, fontSize: 12, fontWeight: 700, cursor: 'pointer',
          fontFamily: 'inherit', letterSpacing: 0.3,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          📷 Start Virtual Camera
        </button>

        <div style={{ height: 1, background: C.border, margin: '2px 0' }} />

        {/* Studio Mode toggle */}
        <button
          onClick={() => setStudioMode(p => !p)}
          style={{
            width: '100%', height: 36, borderRadius: 8,
            background: studioMode ? C.goldDim : 'rgba(255,255,255,0.04)',
            border: `1px solid ${studioMode ? C.goldBorder : C.border2}`,
            color: studioMode ? C.gold : C.textDim,
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'inherit', letterSpacing: 0.3,
            transition: 'all 0.15s',
          }}
        >
          Studio Mode {studioMode ? 'ON' : 'OFF'}
        </button>

        {/* Settings */}
        <button style={{
          width: '100%', height: 36, borderRadius: 8,
          background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border2}`,
          color: C.textDim, fontSize: 12, fontWeight: 700, cursor: 'pointer',
          fontFamily: 'inherit', letterSpacing: 0.3,
        }}>
          ⚙ Settings
        </button>
      </div>

      {/* Status bar */}
      <div style={{
        padding: '6px 10px', borderTop: `1px solid ${C.border}`,
        background: C.surface2, display: 'flex', gap: 10, alignItems: 'center',
      }}>
        <span style={{ fontSize: 9, fontFamily: 'monospace', color: streaming ? C.green : C.textMuted }}>
          {streaming ? '● LIVE' : '○ OFFLINE'}
        </span>
        <span style={{ fontSize: 9, fontFamily: 'monospace', color: C.textMuted }}>
          00:00:00
        </span>
        <span style={{ fontSize: 9, fontFamily: 'monospace', color: C.textMuted, marginLeft: 'auto' }}>
          60.00 FPS
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// PREVIEW / PROGRAM PANES
// ─────────────────────────────────────────────────────────────────
function VideoPane({ label, activeScene }) {
  const [zoom, setZoom] = useState(32);

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: 6,
      overflow: 'hidden',
    }}>
      {/* Label */}
      <div style={{
        padding: '6px 10px', fontSize: 12, fontWeight: 700,
        color: label === 'Program' ? C.red : C.gold,
        background: C.surface2, borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: label === 'Program' ? C.red : C.gold,
          boxShadow: `0 0 6px ${label === 'Program' ? C.red : C.gold}`,
        }} />
        {label}: {activeScene}
      </div>

      {/* Canvas area */}
      <div style={{
        flex: 1, background: '#000',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        {/* Grid overlay (subtle) */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }} />

        {/* Center cross */}
        <div style={{ position: 'absolute', width: 20, height: 1, background: 'rgba(255,255,255,0.08)' }} />
        <div style={{ position: 'absolute', width: 1, height: 20, background: 'rgba(255,255,255,0.08)' }} />

        {label === 'Program' && (
          <div style={{
            position: 'absolute', top: 8, right: 8,
            background: 'rgba(239,68,68,0.9)', color: '#fff',
            fontSize: 9, fontWeight: 900, padding: '2px 6px', borderRadius: 3,
            letterSpacing: 1,
          }}>
            LIVE
          </div>
        )}
      </div>

      {/* Zoom controls */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '4px 8px', background: C.surface2,
        borderTop: `1px solid ${C.border}`,
      }}>
        <button style={toolbarBtn} onClick={() => setZoom(z => Math.max(10, z - 5))}>
          <span style={{ fontSize: 13 }}>−</span>
        </button>
        <span style={{ fontSize: 9, fontFamily: 'monospace', color: C.textMuted, minWidth: 30, textAlign: 'center' }}>
          {zoom}%
        </span>
        <button style={toolbarBtn} onClick={() => setZoom(z => Math.min(200, z + 5))}>
          <span style={{ fontSize: 13 }}>+</span>
        </button>
        <select style={{
          height: 18, background: C.surface2, border: `1px solid ${C.border2}`,
          borderRadius: 3, color: C.textMuted, fontSize: 9, padding: '0 4px',
          outline: 'none', fontFamily: 'inherit',
        }}>
          <option>Scale to Window</option>
          <option>Fit to Window</option>
        </select>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// TRANSITION ZONE (center column between preview/program)
// ─────────────────────────────────────────────────────────────────
function TransitionZone({ onCut, onTransition, activeTransition }) {
  const [studioMode, setStudioMode] = useState(false);
  return (
    <div style={{
      width: 160, flexShrink: 0,
      display: 'flex', flexDirection: 'column', alignItems: 'stretch',
      gap: 5, padding: '8px 8px',
      justifyContent: 'center',
    }}>
      <div style={{ fontSize: 9, color: C.textMuted, fontWeight: 700, letterSpacing: 0.8, textAlign: 'center', marginBottom: 4 }}>
        TRANSITION
      </div>

      {/* Transition button */}
      <button
        onClick={onTransition}
        style={{
          height: 34, borderRadius: 7,
          background: C.goldDim, border: `1px solid ${C.goldBorder}`,
          color: C.gold, fontSize: 12, fontWeight: 800,
          cursor: 'pointer', fontFamily: 'inherit', letterSpacing: 0.3,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 10px', transition: 'all 0.15s',
        }}
      >
        <span>Transition</span>
        <span style={{ fontSize: 14 }}>⋮</span>
      </button>

      {/* Quick transitions header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 0' }}>
        <span style={{ fontSize: 9, color: C.textMuted, fontWeight: 700, letterSpacing: 0.5 }}>QUICK TRANSITIONS</span>
        <button style={{ ...toolbarBtn, width: 16, height: 16 }}>+</button>
      </div>

      {/* Quick buttons */}
      {['Cut', 'Fade (300ms)', 'Fade to Black (300ms)'].map(label => (
        <button key={label} style={{
          height: 28, borderRadius: 6,
          background: C.surface2, border: `1px solid ${C.border2}`,
          color: C.textDim, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 8px', transition: 'all 0.12s',
        }}>
          {label}
          <span style={{ fontSize: 10 }}>▾</span>
        </button>
      ))}

      {/* Duration slider */}
      <div style={{ padding: '6px 2px' }}>
        <input type="range" min={0} max={3000} defaultValue={300}
          style={{ width: '100%', accentColor: C.gold, cursor: 'pointer', height: 2 }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SOURCE INFO BAR
// ─────────────────────────────────────────────────────────────────
function SourceInfoBar({ selectedSource }) {
  return (
    <div style={{
      height: 30, flexShrink: 0,
      background: C.surface2, borderTop: `1px solid ${C.border}`,
      borderBottom: `1px solid ${C.border}`,
      display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px',
    }}>
      <span style={{ fontSize: 11, color: C.textMuted, flex: 1 }}>
        {selectedSource || 'No source selected'}
      </span>
      {['Properties', 'Filters'].map(label => (
        <button key={label} style={iconBtn()}>
          {label === 'Properties' ? '⊞' : '≋'} {label}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// STATUS / STATS BAR
// ─────────────────────────────────────────────────────────────────
function StatusBar({ streaming, recording }) {
  const [fps, setFps] = useState('60.00');
  const [cpu, setCpu] = useState('2.7');
  const [time, setTime] = useState('00:00:00');
  const startRef = useRef(null);

  useEffect(() => {
    const id = setInterval(() => {
      setCpu((Math.random() * 8 + 1).toFixed(1));
    }, 2000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (streaming || recording) {
      startRef.current = startRef.current || Date.now();
      const id = setInterval(() => {
        const s = Math.floor((Date.now() - startRef.current) / 1000);
        const h = Math.floor(s / 3600).toString().padStart(2,'0');
        const m = Math.floor((s % 3600) / 60).toString().padStart(2,'0');
        const sec = (s % 60).toString().padStart(2,'0');
        setTime(`${h}:${m}:${sec}`);
      }, 1000);
      return () => clearInterval(id);
    } else {
      startRef.current = null;
      setTime('00:00:00');
    }
  }, [streaming, recording]);

  return (
    <div style={{
      height: 22, flexShrink: 0,
      background: '#050507',
      borderTop: `1px solid ${C.border}`,
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '0 12px',
    }}>
      {streaming && (
        <span style={{ fontSize: 9, fontFamily: 'monospace', color: C.red }}>● STREAMING {time}</span>
      )}
      {recording && (
        <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#f97316' }}>● REC {time}</span>
      )}
      <span style={{ flex: 1 }} />
      <span style={{ fontSize: 9, fontFamily: 'monospace', color: C.textMuted }}>CPU {cpu}%</span>
      <span style={{ fontSize: 9, fontFamily: 'monospace', color: C.textMuted }}>{fps} / 60.00 FPS</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// TITLE BAR
// ─────────────────────────────────────────────────────────────────
function TitleBar({ streaming, recording }) {
  const navigate = useNavigate();
  const menus = ['File','Edit','View','Profile','Scene Collection','Tools','Help'];

  return (
    <div style={{
      height: 38, flexShrink: 0,
      background: '#050507',
      borderBottom: `1px solid ${C.border}`,
      display: 'flex', alignItems: 'center',
    }}
      data-tauri-drag-region
    >
      {/* Traffic lights placeholder */}
      <div style={{ display: 'flex', gap: 6, padding: '0 14px', flexShrink: 0 }}>
        {[C.red, '#eab308', C.green].map((c, i) => (
          <div key={i} style={{
            width: 12, height: 12, borderRadius: '50%',
            background: c, opacity: 0.8, cursor: 'pointer',
          }} />
        ))}
      </div>

      {/* Menu items */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, flex: 1 }}>
        {/* Back to launcher */}
        <button
          onClick={() => navigate('/')}
          style={{
            height: 22, padding: '0 10px', marginRight: 6,
            background: C.goldDim, border: `1px solid ${C.goldBorder}`,
            borderRadius: 5, color: C.gold, fontSize: 10, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'inherit', letterSpacing: 0.3,
          }}
        >
          ← Launcher
        </button>
        {menus.map(m => (
          <button key={m} style={{
            height: 38, padding: '0 9px', background: 'transparent', border: 'none',
            color: C.textDim, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            {m}
          </button>
        ))}
      </div>

      {/* Title */}
      <div style={{ fontSize: 11, color: C.textMuted, padding: '0 16px', flexShrink: 0 }}>
        ElevateFlow Stream — Profile: Default — Scene Collection: Worship
      </div>

      {/* Live indicator */}
      {streaming && (
        <div style={{
          marginRight: 14,
          background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 5, padding: '3px 9px',
          fontSize: 10, fontWeight: 800, color: C.red, letterSpacing: 0.8,
        }}>
          ● LIVE
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// ICONS
// ─────────────────────────────────────────────────────────────────
function SceneIcon() {
  return <svg viewBox="0 0 14 14" width="12" height="12" fill={C.textMuted}>
    <rect x="1" y="2" width="12" height="8" rx="1.5" opacity="0.4"/>
    <rect x="1" y="2" width="12" height="8" rx="1.5" stroke={C.textMuted} strokeWidth="1" fill="none"/>
    <rect x="4" y="12" width="6" height="1" rx="0.5"/>
  </svg>;
}
function SourceIcon() {
  return <svg viewBox="0 0 14 14" width="12" height="12" fill="none" stroke={C.textMuted} strokeWidth="1.2">
    <rect x="1" y="3" width="9" height="7" rx="1.2"/><path d="M10 6l3 2-3 2V6z" fill={C.textMuted} stroke="none"/>
  </svg>;
}
function AudioIcon() {
  return <svg viewBox="0 0 14 14" width="12" height="12" fill={C.textMuted}>
    <rect x="1" y="4" width="2" height="6" rx="1" opacity="0.6"/>
    <rect x="4" y="2" width="2" height="10" rx="1" opacity="0.8"/>
    <rect x="7" y="5" width="2" height="4" rx="1" opacity="0.5"/>
    <rect x="10" y="1" width="2" height="12" rx="1"/>
  </svg>;
}
function TransitionIcon() {
  return <svg viewBox="0 0 14 14" width="12" height="12" fill="none" stroke={C.textMuted} strokeWidth="1.2" strokeLinecap="round">
    <path d="M1 7h12M9 4l3 3-3 3"/>
  </svg>;
}
function ControlIcon() {
  return <svg viewBox="0 0 14 14" width="12" height="12" fill={C.textMuted}>
    <circle cx="7" cy="7" r="5" stroke={C.textMuted} strokeWidth="1.2" fill="none"/>
    <path d="M5 5l4 2-4 2V5z"/>
  </svg>;
}
function SpeakerIcon({ color }) {
  return <svg viewBox="0 0 12 12" width="11" height="11" fill={color}>
    <path d="M1 4h2l3-2v8L3 8H1V4z" opacity="0.8"/>
    <path d="M8 4c1 .7 1 3.3 0 4M9.5 2.5c2 1.5 2 5.5 0 7" stroke={color} strokeWidth="1" fill="none" strokeLinecap="round"/>
  </svg>;
}
function MuteIcon({ color }) {
  return <svg viewBox="0 0 12 12" width="11" height="11" fill={color}>
    <path d="M1 4h2l3-2v8L3 8H1V4z" opacity="0.8"/>
    <path d="M8 4l3 4M11 4L8 8" stroke={color} strokeWidth="1.2" fill="none" strokeLinecap="round"/>
  </svg>;
}
function HeadphonesIcon({ color }) {
  return <svg viewBox="0 0 12 12" width="11" height="11" fill="none" stroke={color} strokeWidth="1.1" strokeLinecap="round">
    <path d="M2 7V6a4 4 0 018 0v1"/>
    <rect x="1" y="7" width="2.5" height="3.5" rx="1" fill={color} stroke="none"/>
    <rect x="8.5" y="7" width="2.5" height="3.5" rx="1" fill={color} stroke="none"/>
  </svg>;
}

// ─────────────────────────────────────────────────────────────────
// ROOT
// ─────────────────────────────────────────────────────────────────
export default function StreamStudio() {
  const [scenes, setScenes] = useState([
    { id: 's1', name: 'Scene 1' },
    { id: 's2', name: 'Scene 2' },
    { id: 's3', name: 'Scene 3' },
  ]);
  const [activeScene, setActiveScene] = useState('s3');
  const [sources]    = useState([]);
  const [streaming,  setStreaming]  = useState(false);
  const [recording,  setRecording] = useState(false);

  const activeName = scenes.find(s => s.id === activeScene)?.name || 'Scene 1';

  const addScene = useCallback(() => {
    const id = `s${Date.now()}`;
    setScenes(p => [...p, { id, name: `Scene ${p.length + 1}` }]);
  }, []);

  const removeScene = useCallback(() => {
    setScenes(p => {
      if (p.length <= 1) return p;
      const idx = p.findIndex(s => s.id === activeScene);
      const next = p[idx === p.length - 1 ? idx - 1 : idx + 1];
      setActiveScene(next.id);
      return p.filter(s => s.id !== activeScene);
    });
  }, [activeScene]);

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: C.bg,
      display: 'flex', flexDirection: 'column',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, Arial, sans-serif',
      overflow: 'hidden',
      color: C.text,
    }}>
      <TitleBar streaming={streaming} recording={recording} />

      {/* ── Preview row ── */}
      <div style={{
        flex: 1, minHeight: 0,
        display: 'flex', gap: 8, padding: '8px',
        overflow: 'hidden',
      }}>
        <VideoPane label="Preview" activeScene={activeName} />
        <TransitionZone />
        <VideoPane label="Program" activeScene={activeName} />
      </div>

      <SourceInfoBar />

      {/* ── Bottom panels ── */}
      <div style={{
        height: 260, flexShrink: 0,
        display: 'flex',
        borderTop: `1px solid ${C.border}`,
      }}>
        {/* Scenes */}
        <div style={{ flex: '0 0 150px', overflow: 'hidden' }}>
          <ScenesPanel
            scenes={scenes} activeScene={activeScene}
            onSelect={setActiveScene} onAdd={addScene} onRemove={removeScene}
          />
        </div>

        {/* Sources */}
        <div style={{ flex: '0 0 180px', overflow: 'hidden' }}>
          <SourcesPanel sources={sources} />
        </div>

        {/* Audio Mixer */}
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <AudioMixerPanel />
        </div>

        {/* Scene Transitions */}
        <div style={{ flex: '0 0 190px', overflow: 'hidden' }}>
          <TransitionsPanel />
        </div>

        {/* Controls */}
        <div style={{ flex: '0 0 180px', overflow: 'hidden' }}>
          <ControlsPanel
            streaming={streaming} recording={recording}
            onToggleStream={() => setStreaming(p => !p)}
            onToggleRecord={() => setRecording(p => !p)}
          />
        </div>
      </div>

      <StatusBar streaming={streaming} recording={recording} />
    </div>
  );
}