/**
 * LTCReceiver.jsx — ElevateFlow LTC Network Receiver
 * Connects to LTCSender over WebSocket, receives timecode,
 * re-outputs it as LTC audio to a connected device (e.g. Resolume).
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const PORT = 47824;
const C = {
  bg: '#07070a', surface: '#0e0e12', border: 'rgba(255,255,255,0.07)',
  gold: '#D4AF37', goldFaint: 'rgba(212,175,55,0.08)', goldBorder: 'rgba(212,175,55,0.2)',
  green: '#4ade80', red: '#f87171', blue: '#60a5fa', muted: '#52525b',
  text: '#e4e4e7', dim: '#27272a',
};

// ── LTC Encoder (generates LTC audio from timecode) ───────────
class LTCEncoder {
  constructor(sampleRate = 48000, fps = 29.97) {
    this.sampleRate  = sampleRate;
    this.fps         = fps;
    this.samplesPerFrame = Math.round(sampleRate / fps);
    this.samplesPerBit   = Math.round(this.samplesPerFrame / 80);
    this.phase = 1; // current polarity
  }

  // Encode one 80-bit LTC frame into a Float32Array of samples
  encodeFrame(h, m, s, f) {
    // Build 80-bit LTC word
    const bits = new Uint8Array(80);
    const bcd = (v, start, len) => {
      for (let i = 0; i < len; i++) bits[start + i] = (v >> i) & 1;
    };
    bcd(f % 10,      0, 4);  bcd(Math.floor(f / 10), 8, 2);
    bcd(s % 10,     16, 4);  bcd(Math.floor(s / 10), 24, 3);
    bcd(m % 10,     32, 4);  bcd(Math.floor(m / 10), 40, 3);
    bcd(h % 10,     48, 4);  bcd(Math.floor(h / 10), 56, 2);
    // Sync word bits 64-79: 0011111111111101
    const sync = [0,0,1,1,1,1,1,1,1,1,1,1,1,1,0,1];
    sync.forEach((b, i) => { bits[64 + i] = b; });

    const spb = this.samplesPerBit;
    const out = new Float32Array(80 * spb);
    let idx = 0;
    for (let i = 0; i < 80; i++) {
      // Biphase mark: always transition at start of bit
      this.phase = -this.phase;
      for (let j = 0; j < spb; j++) out[idx++] = this.phase * 0.8;
      // Extra transition mid-bit for '1'
      if (bits[i] === 1) {
        this.phase = -this.phase;
        // Overwrite second half
        const half = Math.floor(spb / 2);
        for (let j = half; j < spb; j++) out[idx - spb + j] = this.phase * 0.8;
      }
    }
    return out;
  }

  parseTC(tcStr) {
    const p = tcStr.split(':').map(Number);
    return { h: p[0] || 0, m: p[1] || 0, s: p[2] || 0, f: p[3] || 0 };
  }
}

// ── Components ─────────────────────────────────────────────────

function Badge({ color, children }) {
  return (
    <span style={{
      fontSize: 9, fontWeight: 800, letterSpacing: 1.5, padding: '2px 8px',
      borderRadius: 20, background: `${color}18`, border: `1px solid ${color}40`,
      color, textTransform: 'uppercase',
    }}>{children}</span>
  );
}

function TimecodeDisplay({ tc, fps, running, outputting }) {
  const parts = tc ? tc.split(':') : ['--', '--', '--', '--'];
  const color = outputting ? C.blue : running ? C.green : C.muted;
  return (
    <div style={{
      background: '#000', borderRadius: 12, padding: '20px 28px',
      border: `1px solid ${running ? `${color}44` : C.border}`,
      boxShadow: running ? `0 0 40px ${color}10` : 'none',
      textAlign: 'center', marginBottom: 24,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        {parts.map((p, i) => (
          <React.Fragment key={i}>
            <span style={{
              fontFamily: '"SF Mono", "JetBrains Mono", monospace',
              fontSize: 52, fontWeight: 800, letterSpacing: -1,
              color: running ? color : C.muted,
              minWidth: i === 3 ? 60 : 72, textAlign: 'center',
              textShadow: running ? `0 0 20px ${color}44` : 'none',
              transition: 'color 0.2s, text-shadow 0.2s',
            }}>{p}</span>
            {i < 3 && <span style={{ color: C.muted, fontSize: 36, fontWeight: 300, marginBottom: 4 }}>:</span>}
          </React.Fragment>
        ))}
      </div>
      <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
        {running   && <Badge color={C.green}>{running ? '● RECEIVING' : '○ IDLE'}</Badge>}
        {outputting && <Badge color={C.blue}>⟶ OUTPUTTING</Badge>}
        {fps && <Badge color={C.gold}>{fps} FPS</Badge>}
      </div>
    </div>
  );
}

// ── Main Receiver ───────────────────────────────────────────────
export default function LTCReceiver() {
  const navigate = useNavigate();
  const [host,       setHost]       = useState('');
  const [status,     setStatus]     = useState('idle');   // idle | connecting | connected | error
  const [tc,         setTc]         = useState(null);
  const [fps,        setFps]        = useState(29.97);
  const [outputting, setOutputting] = useState(false);
  const [outputDevice, setOutputDevice] = useState('');
  const [devices,    setDevices]    = useState([]);
  const [log,        setLog]        = useState([]);
  const [latency,    setLatency]    = useState(null);

  const wsRef      = useRef(null);
  const acRef      = useRef(null);
  const encoderRef = useRef(null);
  const nodeRef    = useRef(null);
  const queueRef   = useRef([]);   // queued Float32Array samples to play
  const lastRxRef  = useRef(0);

  const addLog = useCallback((msg, type = 'info') => {
    setLog(l => [{ msg, type, ts: new Date().toLocaleTimeString() }, ...l.slice(0, 49)]);
  }, []);

  // Enumerate output devices — need permission first for labels
  useEffect(() => {
    const getDevices = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
        const all = await navigator.mediaDevices.enumerateDevices();
        setDevices(all.filter(d => d.kind === 'audiooutput'));
      } catch {
        setDevices([]);
      }
    };
    getDevices();
  }, []);

  // Start audio output engine
  const startAudioOutput = useCallback(async () => {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
      if (outputDevice && ac.setSinkId) await ac.setSinkId(outputDevice).catch(() => {});
      acRef.current      = ac;
      encoderRef.current = new LTCEncoder(ac.sampleRate, fps);
      queueRef.current   = [];
      setOutputting(true);
      addLog(`Audio output started @ ${ac.sampleRate}Hz`, 'success');
    } catch (e) {
      addLog(`Audio output error: ${e.message}`, 'error');
    }
  }, [fps, outputDevice, addLog]);

  // Enqueue and play an encoded LTC frame
  const playFrame = useCallback((tcStr) => {
    const ac  = acRef.current;
    const enc = encoderRef.current;
    if (!ac || !enc) return;
    const { h, m, s, f } = enc.parseTC(tcStr);
    const samples  = enc.encodeFrame(h, m, s, f);
    const buf      = ac.createBuffer(1, samples.length, ac.sampleRate);
    buf.copyToChannel(samples, 0);
    const src = ac.createBufferSource();
    src.buffer = buf;
    src.connect(ac.destination);
    // Schedule gaplessly
    const now = ac.currentTime;
    const startAt = Math.max(now, queueRef.current[queueRef.current.length - 1] || now);
    src.start(startAt);
    queueRef.current.push(startAt + buf.duration);
    // Clean old entries
    if (queueRef.current.length > 10) queueRef.current = queueRef.current.slice(-5);
  }, []);

  const connect = useCallback(async () => {
    if (!host.trim()) return;
    setStatus('connecting');
    addLog(`Connecting to ws://${host.trim()}:${PORT}/ef-ltc…`, 'info');

    try {
      const ws = new WebSocket(`ws://${host.trim()}:${PORT}/ef-ltc`);
      wsRef.current = ws;

      ws.onopen = async () => {
        setStatus('connected');
        addLog('Connected to sender', 'success');
        await startAudioOutput();
      };

      ws.onmessage = (e) => {
        try {
          const { timecode, fps: rfps, ts } = JSON.parse(e.data);
          setTc(timecode);
          if (rfps) setFps(rfps);
          if (ts) setLatency(Math.round(Date.now() - ts));
          lastRxRef.current = Date.now();
          if (outputting || acRef.current) playFrame(timecode);
        } catch {}
      };

      ws.onclose = () => {
        setStatus('idle');
        setOutputting(false);
        addLog('Disconnected from sender', 'warn');
      };

      ws.onerror = () => {
        setStatus('error');
        addLog('Connection failed — check host and that sender is running', 'error');
      };
    } catch (e) {
      setStatus('error');
      addLog(`Error: ${e.message}`, 'error');
    }
  }, [host, startAudioOutput, playFrame, outputting, addLog]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    acRef.current?.close().catch(() => {});
    acRef.current     = null;
    encoderRef.current = null;
    setStatus('idle');
    setOutputting(false);
    setTc(null);
    addLog('Disconnected', 'warn');
  }, [addLog]);

  const connected = status === 'connected';
  const statusColor = status === 'connected' ? C.green : status === 'error' ? C.red : status === 'connecting' ? C.gold : C.muted;

  return (
    <div style={{
      width: '100vw', height: '100vh', background: C.bg, color: C.text,
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Arial, sans-serif',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        height: 56, flexShrink: 0, display: 'flex', alignItems: 'center',
        padding: '0 24px 0 90px', borderBottom: `1px solid ${C.border}`,
        background: 'rgba(96,165,250,0.04)', WebkitAppRegion: 'drag',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, WebkitAppRegion: 'no-drag' }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 900, color: '#fff',
          }}>EF</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.text, letterSpacing: -0.3 }}>LTC Receiver</div>
            <div style={{ fontSize: 10, color: C.muted }}>ElevateFlow Timecode Bridge</div>
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ WebkitAppRegion: 'no-drag', display: 'flex', alignItems: 'center', gap: 8 }}>
          {latency !== null && connected && (
            <span style={{ fontSize: 10, color: latency < 10 ? C.green : latency < 30 ? C.gold : C.red, fontFamily: 'monospace' }}>
              {latency}ms
            </span>
          )}
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor, boxShadow: connected ? `0 0 8px ${statusColor}` : 'none' }} />
          <span style={{ fontSize: 11, color: statusColor, fontWeight: 700 }}>{status.toUpperCase()}</span>
        </div>
        <button
          onClick={() => {
            disconnect();
            navigate('/');
          }}
          style={{
            WebkitAppRegion: 'no-drag',
            width: 28, height: 28, borderRadius: 7, cursor: 'pointer',
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
            color: '#f87171', display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginLeft: 8,
          }}
          title="Close"
        >
          <svg viewBox="0 0 12 12" width="10" height="10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <line x1="2" y1="2" x2="10" y2="10"/><line x1="10" y1="2" x2="2" y2="10"/>
          </svg>
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: Controls */}
        <div style={{ width: 300, flexShrink: 0, padding: 24, borderRight: `1px solid ${C.border}`, overflowY: 'auto' }}>
          <TimecodeDisplay tc={tc} fps={fps} running={connected} outputting={outputting} />

          {/* Host */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, color: '#3f3f46', marginBottom: 6 }}>SENDER IP ADDRESS</div>
            <input
              value={host} onChange={e => setHost(e.target.value)}
              disabled={connected}
              onKeyDown={e => e.key === 'Enter' && !connected && connect()}
              placeholder="e.g. 192.168.1.5"
              style={{
                width: '100%', height: 36, padding: '0 12px', boxSizing: 'border-box',
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 8, color: C.text, fontSize: 14,
                fontFamily: '"SF Mono", monospace', outline: 'none',
              }}
            />
          </div>

          {/* Output device */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, color: '#3f3f46', marginBottom: 6 }}>AUDIO OUTPUT (LTC)</div>
            <select value={outputDevice} onChange={e => setOutputDevice(e.target.value)} disabled={connected}
              style={{ width: '100%', height: 36, padding: '0 10px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 12, outline: 'none' }}>
              <option value="">Default Output</option>
              {devices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Output ${d.deviceId.slice(0, 8)}`}</option>)}
            </select>
            <div style={{ fontSize: 10, color: C.dim, marginTop: 6 }}>
              Route this output to Resolume / your DAW via a virtual audio cable.
            </div>
          </div>

          {status === 'error' && (
            <div style={{ fontSize: 11, color: C.red, padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 8, marginBottom: 14 }}>
              Could not connect. Make sure the sender is running and the IP is correct.
            </div>
          )}

          <button onClick={connected ? disconnect : connect} style={{
            width: '100%', height: 44, borderRadius: 10, cursor: 'pointer',
            background: connected ? 'rgba(239,68,68,0.1)' : 'rgba(96,165,250,0.1)',
            border: `1px solid ${connected ? 'rgba(239,68,68,0.3)' : 'rgba(96,165,250,0.3)'}`,
            color: connected ? C.red : C.blue,
            fontSize: 13, fontWeight: 800, letterSpacing: 0.5, transition: 'all 0.15s',
          }}>
            {status === 'connecting' ? '⟳  Connecting…'
              : connected ? '⏹  Disconnect'
              : '⟶  Connect to Sender'}
          </button>

          {/* Info box */}
          <div style={{ marginTop: 20, padding: 14, background: C.surface, borderRadius: 10, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, color: '#3f3f46', marginBottom: 8 }}>SIGNAL CHAIN</div>
            {[
              { label: 'DAW / Ableton', icon: '🎹' },
              { label: 'LTC Audio Out', icon: '→' },
              { label: 'ElevateFlow Sender', icon: '📡' },
              { label: 'Network (Wi-Fi / LAN)', icon: '→' },
              { label: 'ElevateFlow Receiver', icon: '📥' },
              { label: 'LTC Audio Out', icon: '→' },
              { label: 'Resolume / DAW', icon: '🎬' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <span style={{ fontSize: 12 }}>{item.icon}</span>
                <span style={{ fontSize: 11, color: item.icon === '→' ? C.dim : C.muted }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Log */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '14px 24px 8px', fontSize: 9, fontWeight: 800, letterSpacing: 2, color: '#3f3f46', flexShrink: 0 }}>
            LOG
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 20px' }}>
            {log.length === 0 && (
              <div style={{ fontSize: 12, color: C.dim, fontStyle: 'italic', marginTop: 8 }}>
                Enter the sender's IP address and click Connect.
              </div>
            )}
            {log.map((entry, i) => (
              <div key={i} style={{ fontSize: 11, padding: '4px 0', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 10 }}>
                <span style={{ color: C.dim, fontFamily: 'monospace', flexShrink: 0 }}>{entry.ts}</span>
                <span style={{ color: entry.type === 'error' ? C.red : entry.type === 'success' ? C.green : entry.type === 'warn' ? '#fb923c' : C.muted }}>
                  {entry.msg}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}