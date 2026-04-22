/**
 * Mix.jsx — ElevateFlow Audio Mixer
 * Styled after Prime MultiTrack with ElevateFlow dark gold aesthetic.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

// ── Constants ──────────────────────────────────────────────────
const TRACK_COLORS = [
  '#6366f1','#8b5cf6','#06b6d4','#3b82f6',
  '#10b981','#f59e0b','#ef4444','#ec4899',
  '#14b8a6','#84cc16','#f97316','#a855f7',
];

const INITIAL_CHANNELS = [
  { id:'click', name:'CLICK',  type:'click',  muted:true,  solo:false, level:80, color:'#ef4444' },
  { id:'cues',  name:'CUES',   type:'cues',   muted:true,  solo:false, level:75, color:'#6366f1' },
  { id:'ag',    name:'AG',     type:'inst',   muted:false, solo:false, level:85, color:'#06b6d4' },
  { id:'bass',  name:'BASS',   type:'inst',   muted:false, solo:false, level:70, color:'#3b82f6' },
  { id:'bv1',   name:'BV 1',   type:'vocal',  muted:false, solo:false, level:65, color:'#10b981' },
  { id:'bv2',   name:'BV 2',   type:'vocal',  muted:false, solo:false, level:60, color:'#14b8a6' },
  { id:'drums', name:'DRUMS',  type:'inst',   muted:false, solo:false, level:90, color:'#f59e0b' },
  { id:'eg1',   name:'EG 1',   type:'inst',   muted:false, solo:false, level:55, color:'#f97316' },
  { id:'eg2',   name:'EG 2',   type:'inst',   muted:false, solo:false, level:50, color:'#ec4899' },
  { id:'pad',   name:'PAD',    type:'keys',   muted:false, solo:false, level:45, color:'#a855f7' },
  { id:'piano', name:'PIANO',  type:'keys',   muted:false, solo:false, level:60, color:'#8b5cf6' },
];

const SONGS = [
  { id:1, title:'Freedom Song',            key:'C',  bpm:125, active:false },
  { id:2, title:'Higher Praise Multitracks',key:'Bb', bpm:128, active:false },
  { id:3, title:'Holy x Infinity',          key:'Eb', bpm:74,  active:true  },
  { id:4, title:'Mighty Name Of Jesus',     key:'Eb', bpm:72,  active:false },
  { id:5, title:'YHWH (DEMO V2.1)',          key:'B',  bpm:136, active:false },
  { id:6, title:'Forever Free (Live)',       key:'A',  bpm:118, active:false },
];

const KEYS = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];

// ── Waveform ────────────────────────────────────────────────────
function Waveform({ channels, progress = 0.35 }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    const W = c.width, H = c.height;
    ctx.clearRect(0, 0, W, H);
    const segW = W / channels.length;
    channels.forEach((ch, i) => {
      if (ch.muted) return;
      const x = i * segW;
      ctx.fillStyle = ch.color + '33';
      ctx.fillRect(x, 0, segW - 2, H);
      // Draw fake waveform bars
      const bars = Math.floor(segW / 3);
      for (let b = 0; b < bars; b++) {
        const bx = x + b * 3;
        const h = (0.3 + Math.random() * 0.7) * H * (ch.level / 100);
        const by = (H - h) / 2;
        ctx.fillStyle = ch.color + 'cc';
        ctx.fillRect(bx, by, 2, h);
      }
    });
    // Playhead
    const px = W * progress;
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(px, 0, 2, H);
    // Segment markers (section labels)
    const labels = ['I','V1','C','Inst','V2','C','B','T','C'];
    labels.forEach((lbl, i) => {
      const lx = (W / labels.length) * i + 4;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(lx, 2, 22, 14);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px system-ui';
      ctx.fillText(lbl, lx + 3, 12);
    });
  }, [channels, progress]);

  return (
    <canvas ref={canvasRef} width={900} height={72}
      style={{ width:'100%', height:72, display:'block', cursor:'pointer' }} />
  );
}

// ── VU Bar ──────────────────────────────────────────────────────
function VuBar({ level, muted, color }) {
  const h = muted ? 0 : level;
  return (
    <div style={{ width:8, height:'100%', background:'rgba(0,0,0,0.4)', borderRadius:3, overflow:'hidden', position:'relative' }}>
      <div style={{
        position:'absolute', bottom:0, width:'100%', height:`${h}%`,
        background: `linear-gradient(to top, ${color}cc 0%, ${color} 60%, #ef4444 100%)`,
        opacity: muted ? 0.15 : 0.9, transition:'height 0.1s',
      }} />
    </div>
  );
}

// ── Channel Strip ───────────────────────────────────────────────
function ChannelStrip({ ch, onToggleMute, onToggleSolo, onFaderChange, isMaster }) {
  const [faderY, setFaderY] = useState(null);
  const faderRef = useRef(null);
  const level = ch.level;

  const startDrag = useCallback((e) => {
    e.preventDefault();
    const trackEl = faderRef.current?.closest('.ef-fader-track');
    if (!trackEl) return;
    const rect = trackEl.getBoundingClientRect();
    const onMove = (mv) => {
      const rel = 1 - (mv.clientY - rect.top) / rect.height;
      onFaderChange(ch.id, Math.round(Math.min(1, Math.max(0, rel)) * 100));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [ch.id, onFaderChange]);

  return (
    <div style={{
      display:'flex', flexDirection:'column', alignItems:'center',
      width: isMaster ? 90 : 64, flexShrink:0,
      background: isMaster ? 'rgba(212,175,55,0.04)' : 'transparent',
      borderRight:'1px solid rgba(255,255,255,0.04)',
      padding:'10px 4px 8px',
      height:'100%', boxSizing:'border-box',
    }}>
      {/* Color bar top */}
      <div style={{ width:'80%', height:3, borderRadius:2, background: ch.muted ? '#333' : ch.color, marginBottom:8, flexShrink:0 }} />

      {/* Fader + VU */}
      <div style={{ flex:1, display:'flex', gap:4, alignItems:'flex-end', width:'100%', justifyContent:'center', minHeight:0 }}>
        {/* Fader track */}
        <div className="ef-fader-track" style={{
          width:20, height:'100%', background:'rgba(0,0,0,0.35)',
          borderRadius:4, position:'relative', cursor:'ns-resize', flexShrink:0,
        }}>
          {/* Track line */}
          <div style={{ position:'absolute', left:'50%', top:4, bottom:4, width:1, background:'rgba(255,255,255,0.08)', transform:'translateX(-50%)' }} />
          {/* 0dB marker */}
          <div style={{ position:'absolute', left:0, right:0, top:'25%', height:1, background:'rgba(255,255,255,0.1)' }} />
          {/* Fader cap */}
          <div
            ref={faderRef}
            onMouseDown={startDrag}
            style={{
              position:'absolute',
              bottom: `calc(${level}% - 14px)`,
              left:0, right:0,
              height:28, borderRadius:4,
              background: isMaster
                ? 'linear-gradient(180deg, #f0d060 0%, #D4AF37 50%, #a08020 100%)'
                : 'linear-gradient(180deg, #3a3a3a 0%, #2a2a2a 50%, #1a1a1a 100%)',
              border:'1px solid rgba(255,255,255,0.15)',
              boxShadow:`0 2px 8px rgba(0,0,0,0.5), 0 0 0 1px rgba(0,0,0,0.3)`,
              cursor:'grab',
              display:'flex', alignItems:'center', justifyContent:'center',
            }}
          >
            <div style={{ width:'60%', height:1, background:'rgba(255,255,255,0.3)', borderRadius:1 }} />
          </div>
        </div>

        {/* VU meter */}
        <VuBar level={level} muted={ch.muted} color={ch.color} />
      </div>

      {/* M / S buttons */}
      <div style={{ display:'flex', gap:3, margin:'8px 0 6px', flexShrink:0 }}>
        <button onClick={() => onToggleMute(ch.id)} style={{
          width:24, height:20, borderRadius:4, fontSize:9, fontWeight:800,
          background: ch.muted ? '#ef4444' : 'rgba(255,255,255,0.06)',
          color: ch.muted ? '#fff' : 'rgba(255,255,255,0.4)',
          border:`1px solid ${ch.muted ? '#ef4444' : 'rgba(255,255,255,0.1)'}`,
          cursor:'pointer', letterSpacing:0.5,
        }}>M</button>
        {!isMaster && (
          <button onClick={() => onToggleSolo(ch.id)} style={{
            width:24, height:20, borderRadius:4, fontSize:9, fontWeight:800,
            background: ch.solo ? '#f59e0b' : 'rgba(255,255,255,0.06)',
            color: ch.solo ? '#000' : 'rgba(255,255,255,0.4)',
            border:`1px solid ${ch.solo ? '#f59e0b' : 'rgba(255,255,255,0.1)'}`,
            cursor:'pointer', letterSpacing:0.5,
          }}>S</button>
        )}
      </div>

      {/* Name scribble strip */}
      <div style={{
        width:'90%', padding:'3px 0', textAlign:'center', borderRadius:3,
        background: isMaster ? '#D4AF37' : (ch.muted ? 'rgba(255,255,255,0.03)' : ch.color + '22'),
        color: isMaster ? '#000' : (ch.muted ? '#444' : '#e4e4e7'),
        fontSize:8, fontWeight:800, letterSpacing:0.8, textTransform:'uppercase',
        overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis',
        border:`1px solid ${isMaster ? '#D4AF37' : ch.color + '44'}`,
        flexShrink:0,
      }}>{ch.name}</div>
    </div>
  );
}

// ── Song List Item ──────────────────────────────────────────────
function SongItem({ song, onSelect }) {
  return (
    <div onClick={() => onSelect(song.id)} style={{
      display:'flex', alignItems:'center', gap:12, padding:'10px 14px',
      borderBottom:'1px solid rgba(255,255,255,0.04)', cursor:'pointer',
      background: song.active ? 'rgba(99,102,241,0.08)' : 'transparent',
      transition:'background 0.1s',
    }}
      onMouseEnter={e => !song.active && (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
      onMouseLeave={e => !song.active && (e.currentTarget.style.background = 'transparent')}
    >
      {/* Play indicator */}
      <div style={{ width:16, flexShrink:0 }}>
        {song.active ? (
          <svg viewBox="0 0 16 16" width="12" height="12" fill="#6366f1"><polygon points="3,2 13,8 3,14"/></svg>
        ) : (
          <span style={{ fontSize:10, color:'rgba(255,255,255,0.2)', fontFamily:'monospace' }}>{song.id}</span>
        )}
      </div>
      {/* Waveform icon */}
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" style={{ flexShrink:0 }}>
        <rect x="2"  y="9"  width="2" height="6"  rx="1" fill={song.active ? '#6366f1' : '#444'}/>
        <rect x="6"  y="5"  width="2" height="14" rx="1" fill={song.active ? '#818cf8' : '#555'}/>
        <rect x="10" y="3"  width="2" height="18" rx="1" fill={song.active ? '#6366f1' : '#444'}/>
        <rect x="14" y="6"  width="2" height="12" rx="1" fill={song.active ? '#818cf8' : '#555'}/>
        <rect x="18" y="9"  width="2" height="6"  rx="1" fill={song.active ? '#6366f1' : '#444'}/>
      </svg>
      {/* Title + info */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:12, fontWeight: song.active ? 700 : 500, color: song.active ? '#e4e4e7' : '#71717a', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {song.title}
        </div>
        <div style={{ fontSize:10, color:'#3f3f46', marginTop:1 }}>
          Original • {song.key} • {song.bpm} BPM
        </div>
      </div>
    </div>
  );
}

// ── Main Mix Component ──────────────────────────────────────────
export default function Mix() {
  const navigate = useNavigate();
  const [channels, setChannels] = useState(INITIAL_CHANNELS);
  const [songs,    setSongs]    = useState(SONGS);
  const [playing,  setPlaying]  = useState(false);
  const [progress, setProgress] = useState(0.35);
  const [time,     setTime]     = useState('00:00');
  const [duration] = useState('06:35');
  const [bpm]      = useState(74);
  const [selectedKey, setSelectedKey] = useState('Eb');
  const [tonicPad] = useState('Classic Foundation');
  const progressRef = useRef(null);

  // Fake playback
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setProgress(p => {
        const next = p + 0.001;
        if (next >= 1) { setPlaying(false); return 0; }
        const secs = Math.round(next * 395);
        setTime(`${String(Math.floor(secs/60)).padStart(2,'0')}:${String(secs%60).padStart(2,'0')}`);
        return next;
      });
    }, 100);
    return () => clearInterval(id);
  }, [playing]);

  const toggleMute = useCallback((id) => {
    setChannels(cs => cs.map(c => c.id === id ? {...c, muted: !c.muted} : c));
  }, []);

  const toggleSolo = useCallback((id) => {
    setChannels(cs => cs.map(c => c.id === id ? {...c, solo: !c.solo} : c));
  }, []);

  const setFader = useCallback((id, level) => {
    setChannels(cs => cs.map(c => c.id === id ? {...c, level} : c));
  }, []);

  const selectSong = useCallback((id) => {
    setSongs(ss => ss.map(s => ({...s, active: s.id === id})));
  }, []);

  const masterCh = { id:'master', name:'MAIN L/R', level:80, muted:false, solo:false, color:'#D4AF37' };

  return (
    <div style={{
      width:'100vw', height:'100vh', display:'flex', flexDirection:'column',
      background:'#0a0a0d', color:'#e4e4e7', overflow:'hidden',
      fontFamily:'-apple-system, BlinkMacSystemFont, "SF Pro Text", Arial, sans-serif',
    }}>

      {/* ── Top Transport Bar ── */}
      <div style={{
        height:52, flexShrink:0, display:'flex', alignItems:'center', gap:8,
        padding:'0 16px 0 90px', borderBottom:'1px solid rgba(255,255,255,0.05)',
        background:'rgba(16,16,20,0.9)', backdropFilter:'blur(20px)',
        WebkitAppRegion:'drag',
      }}>
        <div style={{ WebkitAppRegion:'no-drag', display:'flex', alignItems:'center', gap:8 }}>
          {/* Back to Launcher */}
          <button onClick={() => navigate('/')} style={{
            width:28, height:28, borderRadius:7, cursor:'pointer', border:'1px solid rgba(255,255,255,0.1)',
            background:'rgba(255,255,255,0.05)', color:'rgba(255,255,255,0.5)',
            display:'flex', alignItems:'center', justifyContent:'center',
          }} title="Back to Launcher">
            <svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M8 2L4 6l4 4"/>
            </svg>
          </button>
          {/* MASTER label */}
          <div style={{
            padding:'4px 14px', borderRadius:7, background:'rgba(212,175,55,0.1)',
            border:'1px solid rgba(212,175,55,0.3)', fontSize:11, fontWeight:800,
            color:'#D4AF37', letterSpacing:1.5,
          }}>MASTER</div>
        </div>

        <div style={{ width:1, height:24, background:'rgba(255,255,255,0.07)', margin:'0 4px', WebkitAppRegion:'no-drag' }} />

        {/* Transport controls */}
        <div style={{ display:'flex', gap:4, WebkitAppRegion:'no-drag' }}>
          {/* Rewind */}
          <button onClick={() => { setProgress(0); setTime('00:00'); }} style={tBtn()}>
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M2 3h2v10H2zm3 5l7-5v10L5 8z"/></svg>
          </button>
          {/* Play/Pause */}
          <button onClick={() => setPlaying(p => !p)} style={tBtn('#e4e4e7', playing)}>
            {playing
              ? <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><rect x="3" y="2" width="4" height="12" rx="1"/><rect x="9" y="2" width="4" height="12" rx="1"/></svg>
              : <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><polygon points="3,2 13,8 3,14"/></svg>
            }
          </button>
          {/* Stop */}
          <button onClick={() => { setPlaying(false); setProgress(0); setTime('00:00'); }} style={tBtn()}>
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><rect x="2" y="2" width="12" height="12" rx="2"/></svg>
          </button>
          {/* Next */}
          <button style={tBtn()}>
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M12 3h2v10h-2zm-2 5L3 3v10l7-5z"/></svg>
          </button>
        </div>

        <div style={{ width:1, height:24, background:'rgba(255,255,255,0.07)', margin:'0 4px' }} />

        {/* Time */}
        <div style={{ fontFamily:'monospace', fontSize:13, fontWeight:700, color:'#e4e4e7', minWidth:110, WebkitAppRegion:'no-drag' }}>
          {time} / {duration}
        </div>

        {/* BPM */}
        <div style={{ padding:'4px 10px', borderRadius:6, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', WebkitAppRegion:'no-drag' }}>
          <div style={{ fontSize:9, color:'rgba(255,255,255,0.3)', letterSpacing:1, fontWeight:700 }}>BPM</div>
          <div style={{ fontSize:14, fontWeight:800, color:'#e4e4e7', lineHeight:1 }}>{bpm}</div>
        </div>

        {/* Key */}
        <div style={{ padding:'4px 10px', borderRadius:6, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', WebkitAppRegion:'no-drag' }}>
          <div style={{ fontSize:9, color:'rgba(255,255,255,0.3)', letterSpacing:1, fontWeight:700 }}>KEY</div>
          <div style={{ fontSize:14, fontWeight:800, color:'#e4e4e7', lineHeight:1 }}>{selectedKey}</div>
        </div>

        {/* Spacer */}
        <div style={{ flex:1 }} />

        {/* Title */}
        <div style={{ fontSize:11, fontWeight:800, letterSpacing:3, color:'rgba(255,255,255,0.2)', WebkitAppRegion:'no-drag' }}>
          AUDIO <span style={{ color:'#D4AF37' }}>MIX</span>
        </div>
      </div>

      {/* ── Waveform ── */}
      <div style={{
        height:80, flexShrink:0, background:'#080808',
        borderBottom:'1px solid rgba(255,255,255,0.05)', overflow:'hidden', position:'relative',
      }}>
        <Waveform channels={channels} progress={progress} />
      </div>

      {/* ── Main Area ── */}
      <div style={{ flex:1, display:'flex', minHeight:0, overflow:'hidden' }}>

        {/* ── Channels + Master ── */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0, overflow:'hidden' }}>

          {/* Channel strips */}
          <div style={{ flex:1, display:'flex', overflow:'hidden', minHeight:0 }}>
            {/* Scrollable input channels */}
            <div style={{ flex:1, display:'flex', overflowX:'auto', overflowY:'hidden' }}>
              {channels.map(ch => (
                <ChannelStrip key={ch.id} ch={ch}
                  onToggleMute={toggleMute} onToggleSolo={toggleSolo}
                  onFaderChange={setFader} isMaster={false} />
              ))}
            </div>

            {/* Master section */}
            <div style={{ borderLeft:'2px solid rgba(212,175,55,0.15)', background:'rgba(212,175,55,0.02)', flexShrink:0 }}>
              <ChannelStrip ch={masterCh}
                onToggleMute={toggleMute} onToggleSolo={toggleSolo}
                onFaderChange={setFader} isMaster />
            </div>
          </div>
        </div>

        {/* ── Right Panel: Song list + Key pad ── */}
        <div style={{
          width:280, flexShrink:0, display:'flex', flexDirection:'column',
          borderLeft:'1px solid rgba(255,255,255,0.05)', overflow:'hidden',
        }}>

          {/* Song list header */}
          <div style={{
            padding:'10px 14px', borderBottom:'1px solid rgba(255,255,255,0.05)',
            display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0,
          }}>
            <span style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.5)', letterSpacing:0.5 }}>
              wed kids carriers
            </span>
            <div style={{ display:'flex', gap:6 }}>
              <button style={iconBtn()}>
                <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M11 2l3 3-8 8H3v-3L11 2z"/></svg>
              </button>
              <button style={iconBtn()}>
                <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M1 4h14M5 8h6M7 12h2"/></svg>
              </button>
            </div>
          </div>

          {/* Song items */}
          <div style={{ flex:1, overflowY:'auto', minHeight:0 }}>
            {songs.map(s => <SongItem key={s.id} song={s} onSelect={selectSong} />)}
            {/* Add song */}
            <div style={{ padding:'10px 14px', display:'flex', alignItems:'center', gap:6, cursor:'pointer',
              color:'rgba(99,102,241,0.7)', fontSize:12, fontWeight:600,
            }}
              onMouseEnter={e => e.currentTarget.style.color = '#818cf8'}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(99,102,241,0.7)'}
            >
              <span style={{ fontSize:16, lineHeight:1 }}>⊕</span> Add a Song
            </div>
          </div>

          {/* ── Tonic Pad / Key Selector ── */}
          <div style={{
            borderTop:'1px solid rgba(255,255,255,0.05)',
            padding:'10px 12px', flexShrink:0,
            background:'rgba(0,0,0,0.3)',
          }}>
            {/* Tonic pad header */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <button style={{ ...iconBtn(), background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.2)', color:'#818cf8' }}>
                  <svg viewBox="0 0 16 16" width="10" height="10" fill="currentColor"><path d="M8 2a6 6 0 100 12A6 6 0 008 2zm0 2a4 4 0 110 8A4 4 0 018 4z"/></svg>
                </button>
                <div>
                  <div style={{ fontSize:8, color:'rgba(255,255,255,0.25)', letterSpacing:1, fontWeight:700 }}>TONIC PAD</div>
                  <div style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.6)' }}>{tonicPad}</div>
                </div>
              </div>
              <div style={{ padding:'3px 7px', borderRadius:4, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', fontSize:9, fontWeight:700, color:'rgba(255,255,255,0.3)' }}>
                PRESET LOCK
              </div>
            </div>

            {/* Key grid */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:4 }}>
              {KEYS.map(k => (
                <button key={k} onClick={() => setSelectedKey(k)} style={{
                  height:32, borderRadius:6, fontSize:11, fontWeight:700,
                  cursor:'pointer', transition:'all 0.12s',
                  background: k === selectedKey ? 'rgba(99,102,241,0.8)' : 'rgba(255,255,255,0.05)',
                  color: k === selectedKey ? '#fff' : 'rgba(255,255,255,0.5)',
                  border: `1px solid ${k === selectedKey ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.08)'}`,
                  boxShadow: k === selectedKey ? '0 4px 12px rgba(99,102,241,0.4)' : 'none',
                }}>{k}</button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Style helpers ───────────────────────────────────────────────
function tBtn(color = 'rgba(255,255,255,0.5)', active = false) {
  return {
    width:34, height:34, borderRadius:8, cursor:'pointer', display:'flex',
    alignItems:'center', justifyContent:'center',
    background: active ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)',
    border:`1px solid ${active ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'}`,
    color: color,
  };
}
function iconBtn() {
  return {
    width:24, height:24, borderRadius:5, cursor:'pointer', display:'flex',
    alignItems:'center', justifyContent:'center',
    background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)',
    color:'rgba(255,255,255,0.4)',
  };
}