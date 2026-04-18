/**
 * Mix.jsx — ElevateFlow Audio Mixer (v2)
 * Improved Prime-inspired multitrack mixer.
 * Starts empty, loads tracks when a song is selected.
 */
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';

// ── Design tokens ───────────────────────────────────────────────
const C = {
  bg:        '#0d0e12',
  bgPanel:   '#131419',
  bgDeep:    '#09090c',
  surface:   '#1a1b22',
  surfaceHi: '#21222b',
  border:    'rgba(255,255,255,0.06)',
  borderMid: 'rgba(255,255,255,0.1)',
  accent:    '#22d3ee',      // cyan
  accentDim: 'rgba(34,211,238,0.15)',
  accentGlow:'rgba(34,211,238,0.35)',
  gold:      '#d4af37',
  goldDim:   'rgba(212,175,55,0.15)',
  muted:     'rgba(255,255,255,0.28)',
  dim:       'rgba(255,255,255,0.12)',
  text:      '#e8e9ef',
  textSub:   '#6b6d7a',
  red:       '#ef4444',
  amber:     '#f59e0b',
};

const KEYS = ['C','D♭','D','E♭','E','F','G♭','G','A♭','A','B♭','B'];
const KEYS_FLAT = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];

const PRESET_PADS = ['Classic Foundation','Warm Sustain','Bright Lift','Cathedral'];

const CHANNEL_TEMPLATES = [
  { id:'click', name:'CLICK',  color:'#ef4444', level:80, muted:true,  solo:false },
  { id:'cues',  name:'CUES',   color:'#6366f1', level:75, muted:true,  solo:false },
  { id:'ag',    name:'A.GTR',  color:'#22d3ee', level:85, muted:false, solo:false },
  { id:'bass',  name:'BASS',   color:'#3b82f6', level:70, muted:false, solo:false },
  { id:'bv1',   name:'BV 1',   color:'#10b981', level:65, muted:false, solo:false },
  { id:'bv2',   name:'BV 2',   color:'#14b8a6', level:60, muted:false, solo:false },
  { id:'drums', name:'DRUMS',  color:'#f59e0b', level:90, muted:false, solo:false },
  { id:'eg1',   name:'E.GTR',  color:'#f97316', level:55, muted:false, solo:false },
  { id:'pad',   name:'PAD',    color:'#a855f7', level:45, muted:false, solo:false },
  { id:'piano', name:'PIANO',  color:'#8b5cf6', level:60, muted:false, solo:false },
];

// ── Seeded waveform data (stable per channel) ───────────────────
function seededRandom(seed) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

// ── Waveform Canvas ─────────────────────────────────────────────
function Waveform({ channels, progress, onSeek, isEmpty }) {
  const canvasRef = useRef(null);
  const waveData  = useMemo(() => {
    return channels.map((ch, i) => {
      const rng = seededRandom(i * 137 + 29);
      return Array.from({ length: 300 }, () => 0.25 + rng() * 0.75);
    });
  }, [channels.length]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    const W = c.width, H = c.height;
    ctx.clearRect(0, 0, W, H);

    if (isEmpty || channels.length === 0) return;

    const px = W * progress;
    channels.forEach((ch, i) => {
      if (ch.muted) return;
      const bars = waveData[i];
      const barW = W / bars.length;
      bars.forEach((h, b) => {
        const bx = b * barW;
        const bh = h * H * 0.88 * (ch.level / 100);
        const by = (H - bh) / 2;
        const past = bx < px;
        ctx.fillStyle = past ? ch.color + 'dd' : ch.color + '44';
        ctx.fillRect(bx + 0.5, by, Math.max(1, barW - 1), bh);
      });
    });

    // Playhead
    ctx.fillStyle = C.red;
    ctx.fillRect(px - 1, 0, 2, H);
    ctx.fillStyle = C.red;
    ctx.beginPath();
    ctx.moveTo(px - 6, 0);
    ctx.lineTo(px + 6, 0);
    ctx.lineTo(px, 8);
    ctx.fill();

    // Section markers
    const sections = ['INTRO','VERSE 1','CHORUS','BRIDGE','VERSE 2','CHORUS','TAG'];
    sections.forEach((lbl, i) => {
      const lx = (W / sections.length) * i;
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fillRect(lx, 0, 1, H);
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.font = 'bold 8px "SF Mono", monospace';
      ctx.fillText(lbl, lx + 4, 11);
    });
  }, [channels, progress, waveData, isEmpty]);

  const handleClick = useCallback((e) => {
    if (!canvasRef.current || isEmpty) return;
    const rect = canvasRef.current.getBoundingClientRect();
    onSeek((e.clientX - rect.left) / rect.width);
  }, [onSeek, isEmpty]);

  return (
    <canvas
      ref={canvasRef}
      width={1200} height={64}
      onClick={handleClick}
      style={{ width: '100%', height: 64, display: 'block', cursor: isEmpty ? 'default' : 'crosshair' }}
    />
  );
}

// ── VU Meter ────────────────────────────────────────────────────
function VuMeter({ level, muted, color, playing }) {
  const [peak, setPeak] = useState(0);
  const [disp, setDisp] = useState(0);
  useEffect(() => {
    if (!playing || muted) { setDisp(0); return; }
    const id = setInterval(() => {
      const v = level * (0.6 + Math.random() * 0.4) / 100;
      setDisp(v);
      setPeak(p => Math.max(p * 0.97, v));
    }, 80);
    return () => clearInterval(id);
  }, [playing, muted, level]);

  return (
    <div style={{ width: 6, height: '100%', background: 'rgba(0,0,0,0.5)', borderRadius: 2, overflow: 'visible', position: 'relative', flexShrink: 0 }}>
      <div style={{
        position: 'absolute', bottom: 0, width: '100%',
        height: `${disp * 100}%`,
        background: `linear-gradient(to top, ${color}cc, ${color}, #ef4444)`,
        borderRadius: 2, transition: 'height 0.07s',
      }} />
      {/* Peak hold */}
      <div style={{
        position: 'absolute', width: '100%', height: 2,
        bottom: `${peak * 100}%`, background: color,
        borderRadius: 1, transition: 'bottom 0.07s',
        boxShadow: `0 0 4px ${color}`,
      }} />
    </div>
  );
}

// ── Channel Strip ───────────────────────────────────────────────
function ChannelStrip({ ch, onToggleMute, onToggleSolo, onLevel, isMaster, playing }) {
  const trackRef = useRef(null);
  const isDragging = useRef(false);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    isDragging.current = true;
    const rect = trackRef.current.getBoundingClientRect();
    const onMove = (mv) => {
      if (!isDragging.current) return;
      const rel = 1 - (mv.clientY - rect.top) / rect.height;
      onLevel(ch.id, Math.round(Math.min(1, Math.max(0, rel)) * 100));
    };
    const onUp = () => {
      isDragging.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [ch.id, onLevel]);

  const faderPos = `calc(${ch.level}% - 14px)`;
  const accentColor = isMaster ? C.gold : ch.color;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      width: isMaster ? 76 : 58, flexShrink: 0,
      background: isMaster ? 'rgba(212,175,55,0.03)' : 'transparent',
      borderRight: `1px solid ${C.border}`,
      padding: '10px 4px 8px', height: '100%', boxSizing: 'border-box',
    }}>
      {/* Color accent bar */}
      <div style={{
        width: '75%', height: 2, borderRadius: 2,
        background: ch.muted ? '#222' : accentColor,
        marginBottom: 8, flexShrink: 0,
        boxShadow: ch.muted ? 'none' : `0 0 8px ${accentColor}88`,
      }} />

      {/* Fader + VU */}
      <div style={{ flex: 1, display: 'flex', gap: 4, alignItems: 'stretch', width: '100%', justifyContent: 'center', minHeight: 0 }}>
        {/* Fader track */}
        <div
          ref={trackRef}
          style={{
            width: 18, background: 'rgba(0,0,0,0.4)',
            borderRadius: 4, position: 'relative', cursor: 'ns-resize', flexShrink: 0,
          }}
        >
          {/* Rail */}
          <div style={{ position: 'absolute', left: '50%', top: 8, bottom: 8, width: 1, background: 'rgba(255,255,255,0.07)', transform: 'translateX(-50%)' }} />
          {/* 0dB line */}
          <div style={{ position: 'absolute', left: 2, right: 2, top: '20%', height: 1, background: 'rgba(255,255,255,0.12)' }} />
          {/* Fader cap */}
          <div
            onMouseDown={handleMouseDown}
            style={{
              position: 'absolute', bottom: faderPos, left: 1, right: 1,
              height: 26, borderRadius: 4, cursor: 'grab',
              background: isMaster
                ? 'linear-gradient(180deg, #f0d870 0%, #d4af37 50%, #9a7d1a 100%)'
                : 'linear-gradient(180deg, #2e3040 0%, #1e2030 50%, #12141c 100%)',
              border: `1px solid ${isMaster ? 'rgba(212,175,55,0.5)' : 'rgba(255,255,255,0.14)'}`,
              boxShadow: '0 2px 6px rgba(0,0,0,0.6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <div style={{ width: '55%', height: 1, background: isMaster ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.25)' }} />
          </div>
        </div>

        {/* VU Meter */}
        <VuMeter level={ch.level} muted={ch.muted} color={accentColor} playing={playing} />
      </div>

      {/* M / S */}
      <div style={{ display: 'flex', gap: 3, margin: '8px 0 5px', flexShrink: 0 }}>
        <button onClick={() => onToggleMute(ch.id)} style={{
          width: 22, height: 18, borderRadius: 4, fontSize: 8, fontWeight: 800, letterSpacing: 0.5,
          background: ch.muted ? C.red : 'rgba(255,255,255,0.05)',
          color: ch.muted ? '#fff' : C.textSub,
          border: `1px solid ${ch.muted ? C.red : C.border}`,
          cursor: 'pointer',
        }}>M</button>
        {!isMaster && (
          <button onClick={() => onToggleSolo(ch.id)} style={{
            width: 22, height: 18, borderRadius: 4, fontSize: 8, fontWeight: 800, letterSpacing: 0.5,
            background: ch.solo ? C.amber : 'rgba(255,255,255,0.05)',
            color: ch.solo ? '#000' : C.textSub,
            border: `1px solid ${ch.solo ? C.amber : C.border}`,
            cursor: 'pointer',
          }}>S</button>
        )}
      </div>

      {/* Label */}
      <div style={{
        width: '92%', padding: '3px 2px', textAlign: 'center', borderRadius: 3,
        background: ch.muted ? 'rgba(255,255,255,0.02)' : (isMaster ? C.goldDim : accentColor + '18'),
        color: ch.muted ? '#3a3a3a' : (isMaster ? C.gold : C.text),
        fontSize: 7.5, fontWeight: 800, letterSpacing: 0.8,
        border: `1px solid ${ch.muted ? 'transparent' : accentColor + '30'}`,
        flexShrink: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
      }}>{ch.name}</div>
    </div>
  );
}

// ── Empty Channel Area ──────────────────────────────────────────
function EmptyMixer() {
  return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 10, opacity: 0.3,
    }}>
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
        {[0,1,2,3,4,5].map(i => (
          <rect key={i} x={4 + i*7} y={14 + (i%2)*8} width={4} height={22 - (i%2)*8} rx={2} fill={C.textSub} />
        ))}
      </svg>
      <span style={{ fontSize: 11, color: C.textSub, letterSpacing: 1, fontWeight: 600 }}>
        SELECT A SONG TO LOAD TRACKS
      </span>
    </div>
  );
}

// ── Song Row ────────────────────────────────────────────────────
function SongRow({ song, onSelect, onRemove, index }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={() => onSelect(song.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 14px',
        borderBottom: `1px solid ${C.border}`,
        cursor: 'pointer',
        background: song.active
          ? `linear-gradient(90deg, ${C.accentDim} 0%, transparent 100%)`
          : hovered ? 'rgba(255,255,255,0.025)' : 'transparent',
        transition: 'background 0.12s',
        position: 'relative',
      }}
    >
      {/* Active bar */}
      {song.active && (
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 2, background: C.accent, borderRadius: '0 2px 2px 0' }} />
      )}

      {/* Index / play indicator */}
      <div style={{ width: 18, flexShrink: 0, textAlign: 'center' }}>
        {song.active
          ? <span style={{ color: C.accent, fontSize: 9 }}>▶</span>
          : <span style={{ fontSize: 9, color: C.textSub, fontFamily: 'monospace' }}>{index + 1}</span>
        }
      </div>

      {/* Waveform icon */}
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" style={{ flexShrink: 0 }}>
        {[0,4,8,12,16,20].map((x, i) => {
          const h = [6,14,18,12,8,4][i];
          return <rect key={x} x={x} y={(24-h)/2} width={3} height={h} rx={1.5} fill={song.active ? C.accent : '#3a3a42'} />;
        })}
      </svg>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12, fontWeight: song.active ? 700 : 500,
          color: song.active ? C.text : '#5a5b68',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          letterSpacing: 0.1,
        }}>{song.title}</div>
        <div style={{ fontSize: 9.5, color: '#3a3b48', marginTop: 1.5 }}>
          {song.key} · {song.bpm} BPM
        </div>
      </div>

      {/* Remove (hover) */}
      {hovered && (
        <button
          onClick={e => { e.stopPropagation(); onRemove(song.id); }}
          style={{
            width: 18, height: 18, borderRadius: 4, background: 'rgba(239,68,68,0.12)',
            border: '1px solid rgba(239,68,68,0.2)', color: C.red, fontSize: 11,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}
        >×</button>
      )}
    </div>
  );
}

// ── Add Song Modal ──────────────────────────────────────────────
function AddSongModal({ onAdd, onClose }) {
  const [title, setTitle] = useState('');
  const [key,   setKey]   = useState('C');
  const [bpm,   setBpm]   = useState('120');

  const handleAdd = () => {
    if (!title.trim()) return;
    onAdd({ title: title.trim(), key, bpm: parseInt(bpm) || 120 });
  };

  const inp = {
    background: C.surface, border: `1px solid ${C.borderMid}`,
    borderRadius: 6, padding: '8px 10px', fontSize: 12,
    color: C.text, outline: 'none', width: '100%', boxSizing: 'border-box',
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, backdropFilter: 'blur(4px)',
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: C.bgPanel, border: `1px solid ${C.borderMid}`,
          borderRadius: 12, padding: '20px 22px', width: 300,
          boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 16, letterSpacing: 0.3 }}>
          Add a Song
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            style={inp} placeholder="Song title…" value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            autoFocus
          />

          <div style={{ display: 'flex', gap: 8 }}>
            <select
              value={key} onChange={e => setKey(e.target.value)}
              style={{ ...inp, flex: 1, cursor: 'pointer' }}
            >
              {KEYS_FLAT.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
            <input
              style={{ ...inp, width: 72, flexShrink: 0 }}
              placeholder="BPM" value={bpm}
              onChange={e => setBpm(e.target.value.replace(/\D/g, ''))}
              type="number" min="40" max="300"
            />
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button onClick={onClose} style={{
              flex: 1, padding: '8px 0', borderRadius: 7, fontSize: 11, fontWeight: 600,
              background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
              color: C.textSub, cursor: 'pointer',
            }}>Cancel</button>
            <button onClick={handleAdd} disabled={!title.trim()} style={{
              flex: 2, padding: '8px 0', borderRadius: 7, fontSize: 11, fontWeight: 700,
              background: title.trim() ? C.accent : 'rgba(34,211,238,0.2)',
              border: 'none', color: title.trim() ? '#000' : C.accentDim,
              cursor: title.trim() ? 'pointer' : 'not-allowed', letterSpacing: 0.3,
              transition: 'all 0.12s',
            }}>Add Song</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tonic Pad ───────────────────────────────────────────────────
function TonicPad({ selectedKey, onKeyChange }) {
  const [padOn,    setPadOn]    = useState(false);
  const [preset,   setPreset]   = useState(0);
  const [presetLk, setPresetLk] = useState(false);

  return (
    <div style={{ borderTop: `1px solid ${C.border}`, padding: '10px 10px 12px', flexShrink: 0, background: 'rgba(0,0,0,0.25)' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
        {/* Power */}
        <button
          onClick={() => setPadOn(p => !p)}
          style={{
            width: 28, height: 28, borderRadius: 7, cursor: 'pointer', flexShrink: 0,
            background: padOn ? C.accentDim : 'rgba(255,255,255,0.04)',
            border: `1px solid ${padOn ? C.accent : C.border}`,
            color: padOn ? C.accent : C.textSub,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: padOn ? `0 0 10px ${C.accentGlow}` : 'none',
            transition: 'all 0.15s',
          }}
        >
          <svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor">
            <path d="M8 2v5M5 4.27A5 5 0 1 0 11 4.27" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
          </svg>
        </button>

        {/* Preset display */}
        <div
          onClick={() => !presetLk && setPreset(p => (p + 1) % PRESET_PADS.length)}
          style={{
            flex: 1, padding: '4px 8px', borderRadius: 6, cursor: presetLk ? 'default' : 'pointer',
            background: 'rgba(0,0,0,0.3)', border: `1px solid ${C.border}`,
          }}
        >
          <div style={{ fontSize: 7.5, color: C.textSub, letterSpacing: 1, fontWeight: 700, marginBottom: 1 }}>TONIC PAD</div>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: padOn ? C.text : C.textSub, letterSpacing: 0.1 }}>
            {PRESET_PADS[preset]}
          </div>
        </div>

        {/* Preset Lock */}
        <button
          onClick={() => setPresetLk(p => !p)}
          style={{
            padding: '4px 6px', borderRadius: 5, cursor: 'pointer', flexShrink: 0,
            background: presetLk ? C.accentDim : 'rgba(255,255,255,0.03)',
            border: `1px solid ${presetLk ? C.accent + '50' : C.border}`,
            color: presetLk ? C.accent : C.textSub, fontSize: 7.5, fontWeight: 700,
            letterSpacing: 0.5, lineHeight: 1.2,
            transition: 'all 0.12s',
          }}
        >
          PRESET{'\n'}LOCK
        </button>

        {/* Big pad trigger */}
        <div style={{
          width: 36, height: 36, borderRadius: 7, flexShrink: 0,
          background: padOn ? C.accent : 'rgba(255,255,255,0.04)',
          border: `1px solid ${padOn ? C.accent : C.border}`,
          boxShadow: padOn ? `0 0 16px ${C.accentGlow}, inset 0 1px 0 rgba(255,255,255,0.2)` : 'none',
          transition: 'all 0.15s', cursor: 'pointer',
        }} onClick={() => setPadOn(p => !p)} />
      </div>

      {/* Key grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 3 }}>
        {KEYS.map((k, i) => {
          const flat = KEYS_FLAT[i];
          const active = flat === selectedKey;
          return (
            <button key={k} onClick={() => onKeyChange(flat)} style={{
              height: 30, borderRadius: 6, fontSize: 10.5, fontWeight: 700, cursor: 'pointer',
              background: active ? C.accent : 'rgba(255,255,255,0.04)',
              color: active ? '#000' : C.muted,
              border: `1px solid ${active ? C.accent : C.border}`,
              boxShadow: active ? `0 0 10px ${C.accentGlow}` : 'none',
              transition: 'all 0.1s', letterSpacing: -0.3,
            }}>{k}</button>
          );
        })}
      </div>

      {/* M / S footer */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 4, marginTop: 7 }}>
        {['M','S'].map(l => (
          <button key={l} style={{
            width: 24, height: 24, borderRadius: 5, fontSize: 9, fontWeight: 800,
            background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
            color: C.textSub, cursor: 'pointer',
          }}>{l}</button>
        ))}
      </div>
    </div>
  );
}

// ── Transport Button helper ─────────────────────────────────────
function TBtn({ onClick, active, children, wide }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: wide ? 44 : 34, height: 34, borderRadius: 8, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active ? 'rgba(255,255,255,0.14)' : hov ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${active ? 'rgba(255,255,255,0.22)' : hov ? 'rgba(255,255,255,0.12)' : C.border}`,
        color: active ? C.text : C.muted, transition: 'all 0.1s',
      }}
    >{children}</button>
  );
}

// ── Main App ────────────────────────────────────────────────────
let nextSongId = 1;

export default function Mix() {
  const [songs,        setSongs]        = useState([]);
  const [channels,     setChannels]     = useState([]);
  const [playing,      setPlaying]      = useState(false);
  const [progress,     setProgress]     = useState(0);
  const [time,         setTime]         = useState('00:00');
  const [duration,     setDuration]     = useState('00:00');
  const [selectedKey,  setSelectedKey]  = useState('C');
  const [bpm,          setBpm]          = useState(0);
  const [showModal,    setShowModal]    = useState(false);
  const [setlistName,  setSetlistName]  = useState('My Setlist');
  const [editingName,  setEditingName]  = useState(false);
  const [looping,      setLooping]      = useState(false);
  const [metronome,    setMetronome]    = useState(false);
  const nameRef = useRef(null);

  const activeSong = songs.find(s => s.active);

  // Fake playback
  useEffect(() => {
    if (!playing || !activeSong) return;
    const totalSecs = activeSong.bpm > 0 ? Math.round(60 / activeSong.bpm * 64 * 4) : 240;
    const id = setInterval(() => {
      setProgress(p => {
        const next = p + 0.001;
        if (next >= 1) {
          if (looping) return 0;
          setPlaying(false); return 0;
        }
        const s = Math.round(next * totalSecs);
        setTime(`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`);
        return next;
      });
    }, 100);
    return () => clearInterval(id);
  }, [playing, activeSong, looping]);

  const stopPlayback = () => { setPlaying(false); setProgress(0); setTime('00:00'); };

  const toggleMute  = useCallback((id) => setChannels(cs => cs.map(c => c.id === id ? {...c, muted: !c.muted} : c)), []);
  const toggleSolo  = useCallback((id) => setChannels(cs => {
    const hasSolo = cs.some(c => c.id !== id && c.solo);
    return cs.map(c => c.id === id ? {...c, solo: !c.solo} : c);
  }), []);
  const setLevel    = useCallback((id, level) => setChannels(cs => cs.map(c => c.id === id ? {...c, level} : c)), []);

  const selectSong = useCallback((id) => {
    setSongs(ss => ss.map(s => ({...s, active: s.id === id})));
    const song = songs.find(s => s.id === id);
    if (song) {
      setSelectedKey(song.key);
      setBpm(song.bpm);
      setDuration(() => {
        const totalSecs = Math.round(60 / song.bpm * 64 * 4);
        return `${String(Math.floor(totalSecs/60)).padStart(2,'0')}:${String(totalSecs%60).padStart(2,'0')}`;
      });
    }
    setChannels(CHANNEL_TEMPLATES.map(t => ({...t})));
    stopPlayback();
  }, [songs]);

  const addSong = useCallback(({ title, key, bpm: b }) => {
    const newSong = { id: nextSongId++, title, key, bpm: b, active: false };
    setSongs(ss => [...ss, newSong]);
    setShowModal(false);
  }, []);

  const removeSong = useCallback((id) => {
    setSongs(ss => {
      const next = ss.filter(s => s.id !== id);
      if (ss.find(s => s.id === id)?.active) {
        setChannels([]);
        stopPlayback();
        if (next.length) { /* optionally auto-select first */ }
      }
      return next;
    });
  }, []);

  const masterCh = useMemo(() => ({
    id: 'master', name: 'MAIN L/R', level: 80, muted: false, solo: false, color: C.gold,
  }), []);

  return (
    <div style={{
      width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column',
      background: C.bg, color: C.text, overflow: 'hidden',
      fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
    }}>

      {/* ── Transport Bar ── */}
      <div style={{
        height: 50, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
        padding: '0 14px', borderBottom: `1px solid ${C.border}`,
        background: 'rgba(13,14,18,0.96)', backdropFilter: 'blur(20px)',
        WebkitAppRegion: 'drag',
      }}>

        {/* MASTER badge */}
        <div style={{
          padding: '4px 12px', borderRadius: 7, marginRight: 6,
          background: C.goldDim, border: `1px solid rgba(212,175,55,0.35)`,
          fontSize: 10.5, fontWeight: 800, color: C.gold, letterSpacing: 1.5,
          WebkitAppRegion: 'no-drag', flexShrink: 0,
        }}>MASTER</div>

        <div style={{ width: 1, height: 20, background: C.border, flexShrink: 0 }} />

        {/* Transport controls */}
        <div style={{ display: 'flex', gap: 3, WebkitAppRegion: 'no-drag', flexShrink: 0 }}>
          <TBtn onClick={() => { setProgress(0); setTime('00:00'); }}>
            <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor"><path d="M2 3h2v10H2zm3 5 7-5v10L5 8z"/></svg>
          </TBtn>
          <TBtn onClick={() => activeSong && setPlaying(p => !p)} active={playing} wide>
            {playing
              ? <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor"><rect x="3" y="2" width="4" height="12" rx="1"/><rect x="9" y="2" width="4" height="12" rx="1"/></svg>
              : <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor"><polygon points="4,2 13,8 4,14"/></svg>
            }
          </TBtn>
          <TBtn onClick={stopPlayback}>
            <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor"><rect x="3" y="3" width="10" height="10" rx="2"/></svg>
          </TBtn>
          <TBtn>
            <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor"><path d="M12 3h2v10h-2zm-2 5L3 3v10l7-5z"/></svg>
          </TBtn>
        </div>

        <div style={{ width: 1, height: 20, background: C.border, flexShrink: 0, margin: '0 2px' }} />

        {/* Loop / Metronome */}
        <div style={{ display: 'flex', gap: 3, WebkitAppRegion: 'no-drag', flexShrink: 0 }}>
          <TBtn onClick={() => setLooping(p => !p)} active={looping}>
            <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M2 8a6 6 0 0 1 6-6 6 6 0 0 1 4.5 2M14 8a6 6 0 0 1-6 6 6 6 0 0 1-4.5-2"/>
              <polyline points="10,2 12.5,2 12.5,4.5"/><polyline points="6,14 3.5,14 3.5,11.5"/>
            </svg>
          </TBtn>
          <TBtn onClick={() => setMetronome(p => !p)} active={metronome}>
            <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
              <polygon points="8,1 14,15 2,15" strokeLinejoin="round"/>
              <line x1="8" y1="15" x2="8" y2="7"/>
              <line x1="8" y1="10" x2="11" y2="8"/>
            </svg>
          </TBtn>
        </div>

        <div style={{ width: 1, height: 20, background: C.border, flexShrink: 0, margin: '0 2px' }} />

        {/* Time display */}
        <div style={{
          fontFamily: '"SF Mono", "Fira Code", monospace',
          fontSize: 13, fontWeight: 700, color: C.text, minWidth: 112, flexShrink: 0,
          WebkitAppRegion: 'no-drag', letterSpacing: 1,
        }}>
          {time} <span style={{ color: C.textSub }}>/</span> {duration}
        </div>

        {/* BPM */}
        <div style={{
          padding: '3px 9px', borderRadius: 6, flexShrink: 0,
          background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
          WebkitAppRegion: 'no-drag', textAlign: 'center',
        }}>
          <div style={{ fontSize: 7.5, color: C.textSub, letterSpacing: 1, fontWeight: 700 }}>BPM</div>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: C.text, lineHeight: 1.1 }}>{bpm || '—'}</div>
        </div>

        {/* Key */}
        <div style={{
          padding: '3px 9px', borderRadius: 6, flexShrink: 0,
          background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`,
          WebkitAppRegion: 'no-drag', textAlign: 'center',
        }}>
          <div style={{ fontSize: 7.5, color: C.textSub, letterSpacing: 1, fontWeight: 700 }}>KEY</div>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: C.text, lineHeight: 1.1 }}>{selectedKey}</div>
        </div>

        <div style={{ flex: 1, WebkitAppRegion: 'drag' }} />

        {/* Settings icons */}
        <div style={{ display: 'flex', gap: 3, WebkitAppRegion: 'no-drag' }}>
          {[
            <svg key="pen" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M11 2l3 3-8 8H3v-3L11 2z"/></svg>,
            <svg key="gear" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><circle cx="8" cy="8" r="2.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.3 3.3l1.4 1.4M11.3 11.3l1.4 1.4M3.3 12.7l1.4-1.4M11.3 4.7l1.4-1.4"/></svg>,
          ].map((icon, i) => (
            <button key={i} style={{
              width: 28, height: 28, borderRadius: 6, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`,
              color: C.textSub,
            }}>{icon}</button>
          ))}
        </div>
      </div>

      {/* ── Waveform ── */}
      <div style={{
        height: 72, flexShrink: 0,
        background: C.bgDeep, borderBottom: `1px solid ${C.border}`,
        overflow: 'hidden', position: 'relative',
      }}>
        <Waveform
          channels={channels}
          progress={progress}
          onSeek={p => { setProgress(p); if (activeSong) { const t = p * 240; setTime(`${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.round(t%60)).padStart(2,'0')}`); }}}
          isEmpty={channels.length === 0}
        />
        {/* Playhead marker (left edge) */}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: `linear-gradient(to bottom, ${C.red}, ${C.red}00)` }} />
        <div style={{ position: 'absolute', left: 0, top: 0, width: 6, height: 6, background: C.red, borderRadius: '0 0 3px 0' }} />
      </div>

      {/* ── Main Area ── */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, overflow: 'hidden' }}>

        {/* ── Channel Mixer ── */}
        <div style={{ flex: 1, display: 'flex', minWidth: 0, overflow: 'hidden' }}>
          {channels.length === 0 ? (
            <EmptyMixer />
          ) : (
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              {/* Scrollable channels */}
              <div style={{ flex: 1, display: 'flex', overflowX: 'auto', overflowY: 'hidden' }}>
                {channels.map(ch => (
                  <ChannelStrip key={ch.id} ch={ch}
                    onToggleMute={toggleMute} onToggleSolo={toggleSolo}
                    onLevel={setLevel} isMaster={false} playing={playing} />
                ))}
              </div>
              {/* Master */}
              <div style={{ borderLeft: `2px solid rgba(212,175,55,0.12)`, background: 'rgba(212,175,55,0.015)', flexShrink: 0 }}>
                <ChannelStrip ch={masterCh}
                  onToggleMute={() => {}} onToggleSolo={() => {}}
                  onLevel={() => {}} isMaster playing={playing} />
              </div>
            </div>
          )}
        </div>

        {/* ── Right Panel ── */}
        <div style={{
          width: 272, flexShrink: 0, display: 'flex', flexDirection: 'column',
          borderLeft: `1px solid ${C.border}`, background: C.bgPanel, overflow: 'hidden',
        }}>

          {/* Setlist header */}
          <div style={{
            padding: '10px 12px', borderBottom: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
          }}>
            {editingName ? (
              <input
                ref={nameRef}
                value={setlistName}
                onChange={e => setSetlistName(e.target.value)}
                onBlur={() => setEditingName(false)}
                onKeyDown={e => e.key === 'Enter' && setEditingName(false)}
                autoFocus
                style={{
                  background: 'transparent', border: 'none', outline: 'none',
                  fontSize: 12, fontWeight: 700, color: C.text, flex: 1,
                  fontFamily: 'inherit',
                }}
              />
            ) : (
              <span
                onClick={() => setEditingName(true)}
                style={{ fontSize: 12, fontWeight: 700, color: C.text, cursor: 'text', flex: 1 }}
              >{setlistName}</span>
            )}

            <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0 }}>
              <button onClick={() => setEditingName(true)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: C.accent, padding: 4,
              }}>
                <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M11 2l3 3-8 8H3v-3L11 2z"/></svg>
              </button>
              <button style={{
                padding: '3px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 10, fontWeight: 700,
                background: C.accentDim, border: `1px solid ${C.accent}40`,
                color: C.accent, letterSpacing: 0.5,
              }}>Sync</button>
              <button style={{
                width: 22, height: 22, borderRadius: 5, cursor: 'pointer',
                background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`,
                color: C.textSub, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="6"/><line x1="8" y1="6" x2="8" y2="8.5"/><circle cx="8" cy="11" r=".5" fill="currentColor"/></svg>
              </button>
            </div>
          </div>

          {/* Song list / empty state */}
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {songs.length === 0 ? (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', height: '100%', gap: 12, padding: '0 20px',
              }}>
                <svg viewBox="0 0 48 48" width="52" height="52" fill="none">
                  <path d="M20 8h20v24a8 8 0 1 1-8-8H20V8z" stroke={C.textSub} strokeWidth="1.5" strokeLinejoin="round"/>
                  <circle cx="12" cy="36" r="4" stroke={C.textSub} strokeWidth="1.5"/>
                  <path d="M20 8 8 12v20" stroke={C.textSub} strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="8" cy="32" r="4" stroke={C.textSub} strokeWidth="1.5"/>
                </svg>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.muted, textAlign: 'center' }}>
                  Setlist is empty
                </div>
                <button
                  onClick={() => setShowModal(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 16px', borderRadius: 8, cursor: 'pointer',
                    background: C.accentDim, border: `1px solid ${C.accent}50`,
                    color: C.accent, fontSize: 11.5, fontWeight: 700, letterSpacing: 0.3,
                    boxShadow: `0 0 16px ${C.accentGlow}`,
                  }}
                >
                  <span style={{ fontSize: 14, lineHeight: 1 }}>⊕</span> Add a Song
                </button>
              </div>
            ) : (
              <>
                {songs.map((s, i) => (
                  <SongRow key={s.id} song={s} index={i} onSelect={selectSong} onRemove={removeSong} />
                ))}
              </>
            )}
          </div>

          {/* Add Song footer (when list has items) */}
          {songs.length > 0 && (
            <div style={{ borderTop: `1px solid ${C.border}`, padding: '8px 12px', flexShrink: 0 }}>
              <button
                onClick={() => setShowModal(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, width: '100%',
                  padding: '7px 10px', borderRadius: 7, cursor: 'pointer',
                  background: 'rgba(255,255,255,0.02)', border: `1px solid ${C.border}`,
                  color: C.textSub, fontSize: 11, fontWeight: 600, letterSpacing: 0.2,
                  transition: 'all 0.12s',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = C.accent; e.currentTarget.style.borderColor = C.accent + '40'; }}
                onMouseLeave={e => { e.currentTarget.style.color = C.textSub; e.currentTarget.style.borderColor = C.border; }}
              >
                <span style={{ fontSize: 14 }}>⊕</span> Add a Song
              </button>
            </div>
          )}

          {/* Tonic Pad */}
          <TonicPad selectedKey={selectedKey} onKeyChange={setSelectedKey} />
        </div>
      </div>

      {/* ── Add Song Modal ── */}
      {showModal && <AddSongModal onAdd={addSong} onClose={() => setShowModal(false)} />}
    </div>
  );
}