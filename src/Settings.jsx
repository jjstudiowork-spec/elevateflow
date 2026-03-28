/**
 * Settings.jsx — ElevateFlow Settings Window
 */
import React, { useState, useEffect, useRef } from 'react';

const sel = {
  width: '100%', height: 30, background: '#141414',
  border: '1px solid #2a2a2a', borderRadius: 5,
  color: '#ccc', fontSize: 12, padding: '0 10px',
  outline: 'none', fontFamily: 'system-ui, Arial',
};

export default function Settings() {
  const [theme,          setTheme]          = useState(() => localStorage.getItem('ef_theme') || 'dark');
  const [audioDevices,   setAudioDevices]   = useState([]);
  const [selectedSink,   setSelectedSink]   = useState('default');
  const [outputLabel,    setOutputLabel]    = useState('Default');
  const [channelCount,   setChannelCount]   = useState(null);
  const testRef = useRef(null);

  const THEMES = [
    { id: 'dark',     label: 'Dark',         preview: ['#0e0e10','#1a1a1e','#D4AF37'] },
    { id: 'midnight', label: 'Midnight',     preview: ['#080c14','#1a2540','#60a5fa'] },
    { id: 'forest',   label: 'Forest',       preview: ['#080e0a','#172619','#4ade80'] },
    { id: 'crimson',  label: 'Crimson',      preview: ['#0e0808','#2a1414','#f87171'] },
    { id: 'graphite', label: 'Graphite',     preview: ['#111111','#1e1e1e','#ffffff'] },
    { id: 'light',    label: 'Light',        preview: ['#f3f4f6','#ffffff','#b45309'] },
  ];

  const applyTheme = async (id) => {
    setTheme(id);
    localStorage.setItem('ef_theme', id);
    document.documentElement.setAttribute('data-theme', id);
    // Broadcast to ALL windows via Tauri events
    try {
      const { emit } = await import('@tauri-apps/api/event');
      await emit('ef-theme-changed', { theme: id });
    } catch {}
  };

  // Apply saved theme on mount
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, []);

  // Enumerate audio output devices and get channel info
  useEffect(() => {
    const load = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => {});
        const devices = await navigator.mediaDevices.enumerateDevices();
        const outputs = devices.filter(d => d.kind === 'audiooutput');
        setAudioDevices(outputs);
        const saved = localStorage.getItem('ef_audio_sink');
        const savedLabel = localStorage.getItem('ef_audio_sink_label');
        if (saved) { setSelectedSink(saved); setOutputLabel(savedLabel || 'Custom'); }
        // Probe channel count
        try {
          const ac = new (window.AudioContext || window.webkitAudioContext)();
          acRef.current = ac;
          await ac.resume();
          setChannelCount(ac.destination.maxChannelCount || ac.destination.channelCount || 2);
        } catch {}
        // Detect channel count via AudioContext
        await detectChannels();
      } catch (err) {
        console.error('[Settings] Audio device enum failed:', err);
      }
    };
    load();
    navigator.mediaDevices.addEventListener('devicechange', load);
    return () => navigator.mediaDevices.removeEventListener('devicechange', load);
  }, []);

  const detectChannels = async () => {
    try {
      const ac = new (window.AudioContext || window.webkitAudioContext)();
      const count = ac.destination.maxChannelCount || ac.destination.channelCount || 2;
      setChannelCount(Number(count));
      await ac.close();
    } catch {}
  };

  const applySink = async (sinkId, label) => {
    setSelectedSink(sinkId);
    setOutputLabel(label);
    localStorage.setItem('ef_audio_sink', sinkId);
    localStorage.setItem('ef_audio_sink_label', label);

    // Apply to all audio/video elements
    try {
      const allMedia = document.querySelectorAll('audio, video');
      for (const el of allMedia) {
        if (el.setSinkId) await el.setSinkId(sinkId).catch(() => {});
      }
    } catch {}

    // Probe channel count using AudioContext
    try {
      if (!acRef.current) {
        acRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ac = acRef.current;
      if (ac.state === 'suspended') await ac.resume();
      // Create a silent oscillator to force device initialisation
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start();
      await new Promise(r => setTimeout(r, 100));
      osc.stop();
      setChannelCount(ac.destination.maxChannelCount || ac.destination.channelCount || 2);
    } catch { setChannelCount(null); }

    window.dispatchEvent(new CustomEvent('ef-audio-sink-changed', { detail: { sinkId, label } }));
  };

  const testAudio = () => {
    if (!testRef.current) {
      testRef.current = new Audio('/audio-test.mp3');
    }
    if (testRef.current.setSinkId) {
      testRef.current.setSinkId(selectedSink).catch(() => {});
    }
    testRef.current.play().catch(() => {});
  };

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: '#161618', color: '#ccc',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Arial, sans-serif',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      userSelect: 'none',
    }}>
      {/* Title bar */}
      <div style={{
        padding: '18px 24px 12px',
        borderBottom: '1px solid #1a1a1a',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 100%)',
      }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#f0f0f0' }}>Settings</div>
        <div style={{ fontSize: 11, color: '#444', marginTop: 2 }}>ElevateFlow Configuration</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>

        {/* Theme */}
        <section style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: '#333', marginBottom: 14 }}>
            APPEARANCE
          </div>
          <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 10, padding: '16px 18px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {THEMES.map(t => (
                <div key={t.id} onClick={() => applyTheme(t.id)}
                  style={{
                    borderRadius: 8, overflow: 'hidden', cursor: 'pointer',
                    border: `2px solid ${theme === t.id ? '#D4AF37' : '#1e1e1e'}`,
                    boxShadow: theme === t.id ? '0 0 0 1px rgba(212,175,55,0.3)' : 'none',
                    transition: 'all 0.15s',
                  }}>
                  {/* Colour preview */}
                  <div style={{ height: 44, display: 'flex' }}>
                    <div style={{ flex: 1, background: t.preview[0] }} />
                    <div style={{ flex: 1, background: t.preview[1] }} />
                    <div style={{ width: 12, background: t.preview[2] }} />
                  </div>
                  {/* Label */}
                  <div style={{
                    background: '#0e0e0e', padding: '5px 8px',
                    fontSize: 10, fontWeight: 700,
                    color: theme === t.id ? '#D4AF37' : '#555',
                    textAlign: 'center',
                  }}>{t.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Audio Output */}
        <section style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: '#333', marginBottom: 14 }}>
            AUDIO OUTPUT
          </div>

          <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 10, padding: '16px 18px' }}>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 6 }}>
                Output Device
              </label>
              <select style={sel} value={selectedSink}
                onChange={e => {
                  const opt = e.target.options[e.target.selectedIndex];
                  applySink(e.target.value, opt.text);
                }}>
                <option value="default">System Default</option>
                {audioDevices.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Output ${d.deviceId.slice(0, 8)}`}
                  </option>
                ))}
              </select>
              <div style={{ fontSize: 10, color: '#2a2a2a', marginTop: 6 }}>
                Currently: {outputLabel || 'System Default'}
              </div>
              {channelCount > 0 && (
                <div style={{ marginTop: 10, padding: '8px 0' }}>
                  <div style={{ fontSize: 10, color: '#444', marginBottom: 8, fontWeight: 700, letterSpacing: 1 }}>
                    OUTPUT CHANNELS — {channelCount} ch
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {Array.from({ length: channelCount }, (_, i) => {
                      const CH_NAMES = ['L','R','C','LFE','Ls','Rs','Lrs','Rrs'];
                      return (
                        <div key={i} style={{
                          padding: '3px 8px', borderRadius: 4,
                          background: 'rgba(212,175,55,0.08)',
                          border: '1px solid rgba(212,175,55,0.2)',
                          fontSize: 10, color: '#D4AF37', fontWeight: 700,
                          fontFamily: 'monospace',
                        }}>
                          {CH_NAMES[i] || `Ch ${i+1}`}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {audioDevices.length === 0 && (
              <div style={{
                padding: '8px 12px', borderRadius: 6, marginTop: 4,
                background: 'rgba(255,170,0,0.05)', border: '1px solid rgba(255,170,0,0.15)',
                fontSize: 11, color: '#888',
              }}>
                ⚠ No audio output devices found. Make sure your browser has audio permission.
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
              <button
                onClick={testAudio}
                style={{
                  height: 28, padding: '0 14px',
                  background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.25)',
                  borderRadius: 5, color: '#D4AF37', fontSize: 11, cursor: 'pointer',
                  fontFamily: 'system-ui, Arial',
                }}>
                ▶ Test Audio
              </button>
              <span style={{ fontSize: 10, color: '#2a2a2a' }}>
                Plays a short test tone through the selected device
              </span>
            </div>
          </div>
        </section>

        {/* About */}
        <section>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: '#333', marginBottom: 14 }}>
            ABOUT
          </div>
          <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 10, padding: '16px 18px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#888', marginBottom: 4 }}>ElevateFlow</div>
            <div style={{ fontSize: 11, color: '#333' }}>Professional Lyrics & Media Presentation</div>
            <div style={{ fontSize: 10, color: '#222', marginTop: 8 }}>Built with Tauri + React</div>
          </div>
        </section>
      </div>
    </div>
  );
}