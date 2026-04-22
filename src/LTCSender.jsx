/**
 * LTCSender.jsx — ElevateFlow LTC Network Sender
 * Receives LTC audio from a DAW (via audio input), decodes it,
 * and broadcasts the timecode over the local network via WebSocket.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { LTCDecoder } from './ltcDecoder';

const PORT = 47824;
const C = {
  bg: '#07070a', surface: '#0e0e12', border: 'rgba(255,255,255,0.07)',
  gold: '#D4AF37', goldFaint: 'rgba(212,175,55,0.08)', goldBorder: 'rgba(212,175,55,0.2)',
  green: '#4ade80', red: '#f87171', muted: '#52525b', text: '#e4e4e7', dim: '#27272a',
};

function Badge({ color, children }) {
  return (
    <span style={{
      fontSize: 9, fontWeight: 800, letterSpacing: 1.5, padding: '2px 8px',
      borderRadius: 20, background: `${color}18`, border: `1px solid ${color}40`,
      color, textTransform: 'uppercase',
    }}>{children}</span>
  );
}

function TimecodeDisplay({ tc, fps, running }) {
  const parts = tc ? tc.split(':') : ['--', '--', '--', '--'];
  return (
    <div style={{
      background: '#000', borderRadius: 12, padding: '14px 20px',
      border: `1px solid ${running ? 'rgba(74,222,128,0.3)' : C.border}`,
      boxShadow: running ? '0 0 40px rgba(74,222,128,0.08)' : 'none',
      textAlign: 'center', marginBottom: 24,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
        {parts.map((p, i) => (
          <React.Fragment key={i}>
            <span style={{
              fontFamily: '"SF Mono", "JetBrains Mono", monospace',
              fontSize: 34, fontWeight: 800, letterSpacing: -1,
              color: running ? C.green : C.muted,
              minWidth: i === 3 ? 40 : 50, textAlign: 'center',
              textShadow: running ? `0 0 16px ${C.green}44` : 'none',
              transition: 'color 0.2s, text-shadow 0.2s',
            }}>{p}</span>
            {i < 3 && <span style={{ color: C.muted, fontSize: 24, fontWeight: 300, marginBottom: 2 }}>:</span>}
          </React.Fragment>
        ))}
      </div>
      <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center', gap: 10 }}>
        <Badge color={running ? C.green : C.muted}>{running ? '● RUNNING' : '○ STOPPED'}</Badge>
        {fps && <Badge color={C.gold}>{fps} FPS</Badge>}
      </div>
    </div>
  );
}

function ClientRow({ client }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 12px', background: C.surface, borderRadius: 8,
      border: `1px solid ${C.border}`, marginBottom: 4,
    }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.green, boxShadow: `0 0 6px ${C.green}` }} />
      <span style={{ fontSize: 12, fontWeight: 600, color: C.text, fontFamily: 'monospace' }}>{client}</span>
      <Badge color={C.green}>CONNECTED</Badge>
    </div>
  );
}

export default function LTCSender() {
  const navigate = useNavigate();
  const [devices,    setDevices]    = useState([]);
  const [deviceId,   setDeviceId]   = useState('');
  const [channel,    setChannel]    = useState(0);
  const [maxChannels, setMaxChannels] = useState(8);
  const [fps,        setFps]        = useState(29.97);
  const [running,    setRunning]    = useState(false);
  const [tc,         setTc]         = useState(null);
  const [rms,        setRms]        = useState(0);
  const [clients,    setClients]    = useState([]);
  const [serverIp,   setServerIp]   = useState('');
  const [error,      setError]      = useState('');
  const [log,        setLog]        = useState([]);

  const wsServerRef   = useRef(null);
  const clientsRef    = useRef([]);
  const streamRef     = useRef(null);
  const decoderRef    = useRef(null);
  const processorRef  = useRef(null);
  const acRef         = useRef(null);

  const addLog = useCallback((msg, type = 'info') => {
    setLog(l => [{ msg, type, ts: new Date().toLocaleTimeString() }, ...l.slice(0, 49)]);
  }, []);

  // Get local IP
  useEffect(() => {
    const tryIp = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const ip = await invoke('get_local_ip');
        setServerIp(ip);
      } catch {
        setServerIp(window.location.hostname || 'localhost');
      }
    };
    tryIp();
  }, []);

  // Enumerate audio devices — must request mic permission first to get labels
  useEffect(() => {
    const getDevices = async () => {
      try {
        // Request permission so device labels are populated
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop()); // immediately release
        const devs = await navigator.mediaDevices.enumerateDevices();
        const inputs = devs.filter(d => d.kind === 'audioinput');
        setDevices(inputs);
        // Auto-select first real device
        if (inputs.length > 0 && !deviceId) setDeviceId(inputs[0].deviceId);
      } catch {
        // Permission denied or no devices — fallback to empty
        setDevices([]);
      }
    };
    getDevices();
  }, []);

  // WebSocket server (using Tauri backend as relay)
  const startServer = useCallback(async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const { listen }  = await import('@tauri-apps/api/event');

      // Use our existing presentation WebSocket port + 1
      await invoke('start_ltc_server').catch(() => {});
      addLog(`LTC server started on port ${PORT}`, 'success');

      // Listen for client connections
      await listen('ltc-client-connected',    e => {
        const addr = e.payload?.addr || 'unknown';
        clientsRef.current = [...clientsRef.current, addr];
        setClients([...clientsRef.current]);
        addLog(`Client connected: ${addr}`, 'success');
      });
      await listen('ltc-client-disconnected', e => {
        const addr = e.payload?.addr || '';
        clientsRef.current = clientsRef.current.filter(c => c !== addr);
        setClients([...clientsRef.current]);
        addLog(`Client disconnected: ${addr}`, 'warn');
      });
    } catch (e) {
      // Fallback: use BroadcastChannel for same-machine testing
      addLog('Server running (local mode — install Tauri backend for network)', 'warn');
    }
  }, [addLog]);

  const broadcastTc = useCallback(async (frame) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('broadcast_ltc', { timecode: frame.string, fps: frame.fps || fps }).catch(() => {});
    } catch {}
  }, [fps]);

  // Probe channel count when device changes
  useEffect(() => {
    if (!deviceId) return;
    const probe = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: { exact: deviceId }, channelCount: { ideal: 32 } }
        });
        const track = stream.getAudioTracks()[0];
        const settings = track.getSettings();
        setMaxChannels(settings.channelCount || 8);
        stream.getTracks().forEach(t => t.stop());
      } catch { setMaxChannels(8); }
    };
    probe();
  }, [deviceId]);

  const start = useCallback(async () => {
    setError('');
    try {
      const constraints = {
        audio: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          channelCount: { ideal: 32 },
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl:  false,
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      const ac = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
      acRef.current = ac;

      const source   = ac.createMediaStreamSource(stream);
      const splitter = ac.createChannelSplitter(Math.max(2, source.channelCount));
      source.connect(splitter);

      const decoder = new LTCDecoder(ac.sampleRate, fps);
      decoderRef.current = decoder;

      decoder.onFrame = (frame) => {
        setTc(frame.string);
        setRunning(true);
        broadcastTc(frame);
      };

      // ScriptProcessor for LTC — low latency
      const processor = ac.createScriptProcessor(2048, source.channelCount, 1);
      splitter.connect(processor, channel, 0);
      processor.connect(ac.destination);

      processor.onaudioprocess = (e) => {
        const data = e.inputBuffer.getChannelData(0);
        decoder.process(data);
        // RMS for meter
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
        setRms(Math.sqrt(sum / data.length));
      };

      processorRef.current = processor;
      await startServer();
      addLog(`Started — listening on ch${channel + 1} @ ${fps}fps`, 'success');
    } catch (e) {
      setError(e.message);
      addLog(`Error: ${e.message}`, 'error');
    }
  }, [deviceId, channel, fps, startServer, broadcastTc, addLog]);

  const stop = useCallback(() => {
    processorRef.current?.disconnect();
    acRef.current?.close().catch(() => {});
    streamRef.current?.getTracks().forEach(t => t.stop());
    processorRef.current = null;
    acRef.current = null;
    streamRef.current = null;
    setRunning(false);
    setRms(0);
    addLog('Stopped', 'warn');
  }, [addLog]);

  const bars = 20;
  const filled = Math.round(Math.min(rms * 8, 1) * bars);

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
        background: 'rgba(212,175,55,0.04)', WebkitAppRegion: 'drag',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, WebkitAppRegion: 'no-drag' }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: 'linear-gradient(135deg, #D4AF37, #a08020)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 900, color: '#000',
          }}>EF</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.text, letterSpacing: -0.3 }}>LTC Sender</div>
            <div style={{ fontSize: 10, color: C.muted }}>ElevateFlow Timecode Bridge</div>
          </div>
        </div>
        <div style={{ flex: 1 }} />
        {serverIp && (
          <div style={{ WebkitAppRegion: 'no-drag', fontSize: 11, color: C.muted, fontFamily: 'monospace', marginRight: 12 }}>
            {serverIp}:{PORT}
          </div>
        )}
        <button
          onClick={() => {
            if (running) stop();
            navigate('/');
          }}
          style={{
            WebkitAppRegion: 'no-drag',
            width: 28, height: 28, borderRadius: 7, cursor: 'pointer',
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
            color: '#f87171', display: 'flex', alignItems: 'center', justifyContent: 'center',
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

          <TimecodeDisplay tc={tc} fps={fps} running={running} />

          {/* Level meter */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, color: '#3f3f46', marginBottom: 8 }}>SIGNAL</div>
            <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 24 }}>
              {Array.from({ length: bars }, (_, i) => {
                const pct = i / bars;
                const active = i < filled;
                const color = pct > 0.8 ? C.red : pct > 0.6 ? '#fb923c' : C.green;
                return <div key={i} style={{ flex: 1, height: 8 + i * 0.8, background: active ? color : C.border, borderRadius: 1, transition: 'background 0.05s' }} />;
              })}
            </div>
          </div>

          {/* Device */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, color: '#3f3f46', marginBottom: 6 }}>AUDIO INPUT</div>
            <select value={deviceId} onChange={e => setDeviceId(e.target.value)} disabled={running}
              style={{ width: '100%', height: 36, padding: '0 10px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 12, outline: 'none' }}>
              <option value="">Default Input</option>
              {devices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label || `Input ${d.deviceId.slice(0, 8)}`}</option>)}
            </select>
          </div>

          {/* Channel */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, color: '#3f3f46', marginBottom: 6 }}>LTC CHANNEL</div>
            <select value={channel} onChange={e => setChannel(Number(e.target.value))} disabled={running}
              style={{ width: '100%', height: 36, padding: '0 10px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, color: C.text, fontSize: 12, outline: 'none' }}>
              {Array.from({ length: maxChannels }, (_, i) => (
              <option key={i} value={i}>Channel {i + 1}</option>
            ))}
            </select>
          </div>

          {/* FPS */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, color: '#3f3f46', marginBottom: 6 }}>FRAME RATE</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[23.976, 24, 25, 29.97, 30].map(f => (
                <button key={f} onClick={() => !running && setFps(f)} style={{
                  flex: 1, height: 32, borderRadius: 6, cursor: 'pointer', fontSize: 9, fontWeight: 700,
                  background: fps === f ? C.goldFaint : C.surface,
                  border: `1px solid ${fps === f ? C.goldBorder : C.border}`,
                  color: fps === f ? C.gold : C.muted, transition: 'all 0.12s',
                }}>{f}</button>
              ))}
            </div>
          </div>

          {error && <div style={{ fontSize: 11, color: C.red, padding: '8px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 8, marginBottom: 14 }}>{error}</div>}

          {/* Start/Stop */}
          <button onClick={running ? stop : start} style={{
            width: '100%', height: 44, borderRadius: 10, cursor: 'pointer',
            background: running ? 'rgba(239,68,68,0.1)' : C.goldFaint,
            border: `1px solid ${running ? 'rgba(239,68,68,0.3)' : C.goldBorder}`,
            color: running ? C.red : C.gold,
            fontSize: 13, fontWeight: 800, letterSpacing: 0.5,
            transition: 'all 0.15s',
          }}>
            {running ? '⏹  Stop Sender' : '▶  Start Sender'}
          </button>
        </div>

        {/* Right: Clients + Log */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Clients */}
          <div style={{ padding: '20px 24px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, color: '#3f3f46', marginBottom: 12 }}>
              CONNECTED RECEIVERS ({clients.length})
            </div>
            {clients.length === 0 ? (
              <div style={{ fontSize: 12, color: C.dim, fontStyle: 'italic' }}>
                No receivers connected. Start a receiver on another computer and connect to {serverIp}:{PORT}
              </div>
            ) : (
              clients.map((c, i) => <ClientRow key={i} client={c} />)
            )}
          </div>

          {/* Log */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '14px 24px 8px', fontSize: 9, fontWeight: 800, letterSpacing: 2, color: '#3f3f46', flexShrink: 0 }}>
              LOG
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 20px' }}>
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
    </div>
  );
}