/**
 * Timecode.jsx — SMPTE LTC Reader
 * Selects audio input device + channel, decodes LTC, displays live timecode.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LTCDecoder } from './ltcDecoder';

const FPS = [
  { label: '23.976', value: 23.976 },
  { label: '24',     value: 24     },
  { label: '25',     value: 25     },
  { label: '29.97',  value: 29.97  },
  { label: '30',     value: 30     },
];

// ── Colours ─────────────────────────────────────────────────────
const BG       = '#0a0a0c';
const SURFACE  = '#111115';
const BORDER   = '#1e1e24';
const GOLD     = '#D4AF37';
const GREEN    = '#4ade80';
const RED      = '#f87171';
const AMBER    = '#fb923c';
const MUTED    = '#52525b';
const TEXT     = '#e4e4e7';
const DIM      = '#27272a';

// ── Helpers ──────────────────────────────────────────────────────
function Label({ children }) {
  return (
    <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2,
      color: '#3f3f46', textTransform: 'uppercase', marginBottom: 7 }}>
      {children}
    </div>
  );
}

function Select({ value, onChange, disabled, children, style = {} }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
      style={{
        width: '100%', height: 36, padding: '0 10px',
        background: '#0e0e12', border: `1px solid ${BORDER}`,
        borderRadius: 8, color: disabled ? MUTED : TEXT, fontSize: 12,
        outline: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        appearance: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%2352525b'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
        paddingRight: 28,
        ...style,
      }}>
      {children}
    </select>
  );
}

// ── Signal meter ─────────────────────────────────────────────────
function LevelMeter({ rms }) {
  // 24 thin vertical bars
  const bars   = 24;
  const filled = Math.round(Math.min(rms, 1) * bars);
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 28 }}>
      {Array.from({ length: bars }, (_, i) => {
        const pct    = i / bars;
        const active = i < filled;
        const color  = pct > 0.83 ? RED : pct > 0.66 ? AMBER : GREEN;
        const h      = 6 + i * 0.9;
        return (
          <div key={i} style={{
            width: 3, height: h,
            background: active ? color : '#1a1a20',
            borderRadius: 1,
            boxShadow: active && pct > 0.66 ? `0 0 4px ${color}66` : 'none',
            transition: 'background 0.04s',
          }} />
        );
      })}
    </div>
  );
}

// ── The big timecode digits ───────────────────────────────────────
function Digits({ tc, locked, searching }) {
  const parts = tc ? tc.split(':') : null;
  const labels = ['HH', 'MM', 'SS', 'FF'];

  const digitColor = locked   ? TEXT
                   : searching ? `${TEXT}44`
                   : '#1e1e24';

  const sepColor  = locked ? '#3f3f46' : '#1a1a20';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '36px 0 28px', gap: 10,
      background: `radial-gradient(ellipse at 50% 0%, rgba(212,175,55,0.04) 0%, transparent 70%)`,
    }}>
      {/* Digit row */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 0 }}>
        {[0,1,2,3].map(i => (
          <React.Fragment key={i}>
            {/* Pair */}
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: 72, fontWeight: 100, letterSpacing: -2,
                fontFamily: '"SF Mono","JetBrains Mono","Fira Code",monospace',
                color: i === 3 ? (locked ? GOLD : digitColor) : digitColor,
                lineHeight: 1, minWidth: 96,
                transition: 'color 0.12s',
                textShadow: locked && i === 3 ? `0 0 20px ${GOLD}44` : 'none',
              }}>
                {parts ? parts[i] : '- -'}
              </div>
              <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: 2, color: '#2a2a2e', marginTop: 4 }}>
                {labels[i]}
              </div>
            </div>
            {/* Separator */}
            {i < 3 && (
              <div style={{
                fontSize: 48, fontWeight: 100, color: sepColor,
                lineHeight: 1, paddingBottom: 14, margin: '0 2px',
                fontFamily: '"SF Mono","JetBrains Mono",monospace',
                transition: 'color 0.12s',
              }}>
                {i === 2 ? ';' : ':'}
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ── Status pill ───────────────────────────────────────────────────
function Status({ locked, searching, fps }) {
  const [bg, border, color, label] =
    locked    ? [`${GREEN}12`, `${GREEN}35`, GREEN, 'LOCKED']
  : searching ? [`${AMBER}10`, `${AMBER}30`, AMBER, 'SEARCHING']
  :             [`${DIM}80`,   BORDER,       MUTED, 'STOPPED'];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '5px 14px', borderRadius: 20,
        background: bg, border: `1px solid ${border}`,
      }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%', background: color,
          boxShadow: locked ? `0 0 8px ${color}` : 'none',
          animation: searching ? 'pulse 1s ease infinite' : 'none',
        }} />
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color }}>{label}</span>
      </div>
      {(locked || searching) && (
        <div style={{ fontSize: 10, color: MUTED, fontFamily: 'monospace' }}>
          {fps} fps
        </div>
      )}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────
export default function Timecode() {
  const [devices,      setDevices]      = useState([]);
  const [deviceId,     setDeviceId]     = useState('');
  const [channelCount, setChannelCount] = useState(0);
  const [channel,      setChannel]      = useState(0); // 0-based
  const [fps,          setFps]          = useState(29.97);
  const [running,      setRunning]      = useState(false);
  const [tc,           setTc]           = useState(null);
  const [locked,       setLocked]       = useState(false);
  const [searching,    setSearching]    = useState(false);
  const [rms,          setRms]          = useState(0);
  const [frameCount,   setFrameCount]   = useState(0);

  const ctxRef       = useRef(null);
  const processorRef = useRef(null);
  const streamRef    = useRef(null);
  const decoderRef   = useRef(null);
  const lockRef      = useRef(null);

  // Enumerate audio inputs
  useEffect(() => {
    const load = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => {});
        const all = await navigator.mediaDevices.enumerateDevices();
        const ins = all.filter(d => d.kind === 'audioinput');
        setDevices(ins);
        if (ins.length && !deviceId) setDeviceId(ins[0].deviceId);
      } catch {}
    };
    load();
    navigator.mediaDevices.addEventListener('devicechange', load);
    return () => navigator.mediaDevices.removeEventListener('devicechange', load);
  }, []);

  // Probe channel count when device changes
  useEffect(() => {
    if (!deviceId) return;
    const probe = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: { exact: deviceId }, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        });
        const track   = stream.getAudioTracks()[0];
        const settings = track.getSettings();
        const count   = settings.channelCount || 1;
        setChannelCount(count);
        setChannel(0);
        stream.getTracks().forEach(t => t.stop());
      } catch { setChannelCount(1); setChannel(0); }
    };
    probe();
  }, [deviceId]);

  const stop = useCallback(() => {
    clearTimeout(lockRef.current);
    processorRef.current?.disconnect();
    streamRef.current?.getTracks().forEach(t => t.stop());
    ctxRef.current?.close().catch(() => {});
    processorRef.current = null;
    streamRef.current    = null;
    ctxRef.current       = null;
    decoderRef.current   = null;
    setRunning(false);
    setLocked(false);
    setSearching(false);
    setRms(0);
  }, []);

  const start = useCallback(async () => {
    stop();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          channelCount: { ideal: channelCount || 2 },
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: { ideal: 48000 },
        },
      });
      streamRef.current = stream;

      const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
      ctxRef.current = ctx;
      if (ctx.state === 'suspended') await ctx.resume();

      const source  = ctx.createMediaStreamSource(stream);
      const numCh   = source.channelCount;
      const targetCh = Math.min(channel, numCh - 1);

      // Use enough input channels to cover the target channel
      // Pick the channel in onaudioprocess — avoids splitter/merger bugs
      const inCh    = Math.max(numCh, 1);
      // 8192 buffer = ~170ms at 48kHz — large enough to prevent dropout
      // without introducing too much latency for real-time display
      const processor = ctx.createScriptProcessor(8192, inCh, 1);
      processorRef.current = processor;

      // Silent output — don't blast LTC squeal through speakers
      const silencer = ctx.createGain();
      silencer.gain.value = 0;

      source.connect(processor);
      processor.connect(silencer);
      silencer.connect(ctx.destination);

      console.log('[TC] AudioContext sampleRate:', ctx.sampleRate, '| fps:', fps, '| channel:', targetCh, '/', numCh);
      const decoder = new LTCDecoder(ctx.sampleRate, fps);
      decoderRef.current = decoder;

      decoder.onFrame = (frame) => {
        setTc(frame.string);
        setLocked(true);
        setSearching(false);
        setFrameCount(n => n + 1);
        clearTimeout(lockRef.current);
        lockRef.current = setTimeout(() => setLocked(false), 400);
      };

      processor.onaudioprocess = (e) => {
        // Get the specific channel carrying LTC
        const ch   = Math.min(targetCh, e.inputBuffer.numberOfChannels - 1);
        const data = e.inputBuffer.getChannelData(ch);
        decoder.process(data);
        // RMS level meter
        let sq = 0;
        for (let i = 0; i < data.length; i++) sq += data[i] * data[i];
        setRms(Math.min(Math.sqrt(sq / data.length) * 6, 1));
      };

      setRunning(true);
      setSearching(true);
    } catch (err) {
      alert(`Audio error: ${err.message}`);
    }
  }, [deviceId, channelCount, channel, fps, stop]);

  // When fps changes while running, update decoder
  useEffect(() => {
    decoderRef.current?.setFPS(fps);
  }, [fps]);

  const deviceLabel = (d) => {
    if (!d.label) return `Device ${d.deviceId.slice(0, 8)}`;
    return d.label.length > 40 ? d.label.slice(0, 38) + '…' : d.label;
  };

  return (
    <div style={{
      width: '100vw', height: '100vh', background: BG, color: TEXT,
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Arial, sans-serif',
      display: 'flex', flexDirection: 'column', overflow: 'hidden', userSelect: 'none',
    }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 20px',
        borderBottom: `1px solid ${BORDER}`,
        background: `linear-gradient(180deg, rgba(255,255,255,0.015) 0%, transparent 100%)`,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: `rgba(212,175,55,0.12)`, border: `1px solid rgba(212,175,55,0.25)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14,
          }}>⏱</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1 }}>Timecode</div>
            <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>SMPTE LTC Reader</div>
          </div>
        </div>
      </div>

      {/* Digit display area */}
      <div style={{ background: '#090909', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
        <Digits tc={tc} locked={locked} searching={searching} />

        {/* Status + level */}
        <div style={{ padding: '0 24px 20px', display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center' }}>
          <Status locked={locked} searching={searching} fps={fps} />
          {frameCount > 0 && (
            <div style={{ fontSize: 10, color: GREEN, fontFamily: 'monospace', opacity: 0.7 }}>
              {frameCount} frames decoded
            </div>
          )}
          <LevelMeter rms={rms} />
        </div>
      </div>

      {/* Settings */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

        {/* Input Device */}
        <div style={{ marginBottom: 16 }}>
          <Label>Input Device</Label>
          <Select value={deviceId} onChange={setDeviceId} disabled={running}>
            {devices.map(d => (
              <option key={d.deviceId} value={d.deviceId}>{deviceLabel(d)}</option>
            ))}
            {devices.length === 0 && <option value="">No devices found</option>}
          </Select>
        </div>

        {/* Channel */}
        {channelCount > 1 && (
          <div style={{ marginBottom: 16 }}>
            <Label>LTC Channel</Label>
            <Select value={channel} onChange={v => setChannel(parseInt(v))} disabled={running}>
              {Array.from({ length: channelCount }, (_, i) => {
                const names = ['Left (L)', 'Right (R)', 'Centre (C)', 'LFE', 'Surround L', 'Surround R'];
                return (
                  <option key={i} value={i}>{names[i] || `Channel ${i + 1}`}</option>
                );
              })}
            </Select>
            <div style={{ fontSize: 10, color: '#3a3a40', marginTop: 6 }}>
              {channelCount} channels available on this device
            </div>
          </div>
        )}

        {/* Frame Rate */}
        <div style={{ marginBottom: 20 }}>
          <Label>Frame Rate</Label>
          <div style={{ display: 'flex', gap: 6 }}>
            {FPS.map(o => (
              <button key={o.value}
                onClick={() => setFps(o.value)}
                style={{
                  flex: 1, height: 34, borderRadius: 7, cursor: 'pointer',
                  background: fps === o.value ? `rgba(212,175,55,0.12)` : 'transparent',
                  border: `1px solid ${fps === o.value ? `rgba(212,175,55,0.4)` : BORDER}`,
                  color: fps === o.value ? GOLD : MUTED,
                  fontSize: 11, fontWeight: 700, transition: 'all 0.12s',
                }}>
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {/* Start / Stop */}
        {!running ? (
          <button onClick={start} disabled={!deviceId}
            style={{
              width: '100%', height: 44, borderRadius: 10, cursor: deviceId ? 'pointer' : 'not-allowed',
              background: deviceId ? `rgba(212,175,55,0.1)` : 'transparent',
              border: `1px solid ${deviceId ? `rgba(212,175,55,0.35)` : BORDER}`,
              color: deviceId ? GOLD : MUTED, fontSize: 14, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'all 0.15s',
            }}>
            <span style={{ fontSize: 16 }}>▶</span> Start Listening
          </button>
        ) : (
          <button onClick={stop}
            style={{
              width: '100%', height: 44, borderRadius: 10, cursor: 'pointer',
              background: `rgba(248,113,113,0.08)`, border: `1px solid rgba(248,113,113,0.3)`,
              color: RED, fontSize: 14, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
            <span style={{ fontSize: 16 }}>■</span> Stop
          </button>
        )}

        {/* Tip */}
        <div style={{
          marginTop: 16, padding: '10px 14px', borderRadius: 8,
          background: '#111115', border: `1px solid ${BORDER}`,
          fontSize: 10, color: '#3a3a40', lineHeight: 1.7,
        }}>
          <strong style={{ color: '#52525b' }}>BlackHole setup:</strong> set your timecode player's output to{' '}
          <span style={{ color: MUTED, fontFamily: 'monospace' }}>BlackHole 2ch</span>, then select it as the input device above and click Start.
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}