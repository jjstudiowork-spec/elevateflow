/**
 * RightPanel/index.jsx
 * Right panel: Preview → Clear Bar → Transport → Controls/Audio Bins
 * Full ProPresenter 7 right panel layout
 */
import React, { useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';

// ─────────────────────────────────────────────────────────────────
// STAGE LAYOUT PREVIEW — mini live render of active stage layout
// ─────────────────────────────────────────────────────────────────
function useClock() {
  const [time, setTime] = React.useState('');
  React.useEffect(() => {
    const tick = () => {
      const now = new Date();
      let h = now.getHours(); const m = now.getMinutes().toString().padStart(2,'0');
      const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
      setTime(`${h}:${m} ${ap}`);
    };
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, []);
  return time;
}

function fmtTimer(s) {
  if (s === null || s === undefined) return '--:--';
  const a = Math.abs(s), m = Math.floor(a/60).toString().padStart(2,'0'), sc = (a%60).toString().padStart(2,'0');
  return `${s < 0 ? '-' : ''}${m}:${sc}`;
}

function StageLayoutPreview({ state, selectedSlide, nextSlide }) {
  const clock = useClock();
  const { stageLayouts = [], activeStageLayoutId, stageMessage, timerSeconds } = state;
  const layout = stageLayouts.find(l => l.id === activeStageLayoutId) || stageLayouts[0];

  if (!layout || !layout.elements?.length) return (
    <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'#000' }}>
      <span style={{ fontSize:'1.5cqw', color:'#2a2a2a', fontWeight:700 }}>NO LAYOUT</span>
    </div>
  );

  return (
    <div style={{ position:'absolute', inset:0, background:'#000', overflow:'hidden', containerType:'inline-size' }}>
      {layout.elements.map(el => {
        let text = '';
        let color = el.color || '#fff';
        switch (el.type) {
          case 'currentSlide': text = selectedSlide?.text || ''; color = el.color || selectedSlide?.textColor || '#fff'; break;
          case 'nextSlide':    text = nextSlide?.text || ''; color = el.color || '#fde047'; break;
          case 'clock':        text = clock; break;
          case 'timer':        text = fmtTimer(timerSeconds);
            color = timerSeconds !== null && timerSeconds <= 0 ? '#ef4444' : timerSeconds !== null && timerSeconds <= 30 ? '#f97316' : el.color || '#4ade80';
            break;
          case 'message':      text = stageMessage || ''; break;
          case 'notes':        text = selectedSlide?.notes || ''; break;
          case 'video':        text = ''; break;
          default:             text = '';
        }
        return (
          <div key={el.id} style={{
            position:'absolute', left:`${el.x}%`, top:`${el.y}%`, width:`${el.w}%`, height:`${el.h}%`,
            background: el.bgColor && el.bgColor !== 'transparent' ? el.bgColor : 'transparent',
            overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center',
            padding:'1% 1.5%', boxSizing:'border-box',
          }}>
            {el.type === 'video' ? (
              <div style={{ fontSize:`${(el.fontSize||0.8)*0.8}cqw`, color:'#333', fontWeight:700 }}>VIDEO</div>
            ) : (
              <div style={{
                fontSize:`${el.fontSize||1}cqw`, fontWeight: el.type === 'currentSlide' ? selectedSlide?.fontWeight||800 : 700,
                color, textAlign:'center', whiteSpace:'pre-wrap', lineHeight:1.2, overflow:'hidden',
                fontFamily: el.type === 'currentSlide' ? selectedSlide?.fontFamily : 'inherit',
                fontStyle: el.type === 'currentSlide' && selectedSlide?.italic ? 'italic' : 'normal',
                textTransform: el.type === 'currentSlide' ? selectedSlide?.transform||'none' : 'none',
                fontVariantNumeric: el.type === 'clock' || el.type === 'timer' ? 'tabular-nums' : 'normal',
              }}>{text}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// AUDIENCE PREVIEW
// ─────────────────────────────────────────────────────────────────
function AudiencePreview({ state, dispatch, selectedSlide, nextSlide, videoRef, audioRef, onTimeUpdate }) {
  const { liveVideo, activeOverlay, activePreview, showPreviewDropdown } = state;

  // Read screen assignments to get the correct aspect ratio for each output
  const [assignments, setAssignments] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem('ef_screen_assignments') || '{}'); }
    catch { return {}; }
  });

  React.useEffect(() => {
    const handler = () => {
      try { setAssignments(JSON.parse(localStorage.getItem('ef_screen_assignments') || '{}')); }
      catch {}
    };
    window.addEventListener('storage', handler);
    window.addEventListener('ef-screens-updated', handler);
    return () => {
      window.removeEventListener('storage', handler);
      window.removeEventListener('ef-screens-updated', handler);
    };
  }, []);

  const getAspectRatio = (previewName) => {
    try {
      const saved = JSON.parse(localStorage.getItem('ef_screen_assignments') || '{}');
      // Try named screen first
      if (saved.allScreens?.length) {
        const match = saved.allScreens.find(s => (s.name || s.id) === previewName);
        if (match?.width && match?.height) return `${match.width} / ${match.height}`;
      }
      // Fall back to role-based
      const role = previewName === 'Stage' ? 'stage' : 'audience';
      const screen = assignments[role];
      if (!screen?.size?.width || !screen?.size?.height) return '16 / 9';
      return `${screen.size.width} / ${screen.size.height}`;
    } catch { return '16 / 9'; }
  };

  // Determine if the active preview is an audience-role screen
  const isAudiencePreview = React.useMemo(() => {
    if (activePreview === 'Audience') return true;
    if (activePreview === 'Stage')    return false;
    try {
      const saved = JSON.parse(localStorage.getItem('ef_screen_assignments') || '{}');
      // Check stageScreens list first — if the screen name matches a stage screen, it's stage
      const inStage    = (saved.stageScreens    || []).some(s => (s.name || s.id) === activePreview);
      const inAudience = (saved.audienceScreens || []).some(s => (s.name || s.id) === activePreview);
      if (inStage)    return false;
      if (inAudience) return true;
      // Fall back to allScreens role field
      const match = (saved.allScreens || []).find(s => (s.name || s.id) === activePreview);
      if (match) return match.role !== 'stage';
    } catch {}
    return true;
  }, [activePreview, assignments]);

  const aspectRatio = getAspectRatio(activePreview);

  // Only convert if it's a raw filesystem path — not already an asset:// URL
  const toSrc = (val) => {
    if (!val) return null;
    if (val.startsWith('asset://') || val.startsWith('https://asset.localhost') || val.startsWith('blob:') || val.startsWith('http')) return val;
    return convertFileSrc(val);
  };
  const videoSrc   = toSrc(liveVideo);
  const overlaySrc = toSrc(activeOverlay);

  return (
    <div className="preview-section" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Centering box — fills resizable container, centers screen */}
      <div className="preview-screen-box">
        {/* VU Meter */}
        <VuMeter audioRef={audioRef} videoRef={videoRef} state={state} />
        <div className="preview-screen" style={{ aspectRatio }}>
        {isAudiencePreview ? (
          <>
            {/* Background video or image */}
            {videoSrc && liveVideo?.match(/\.(png|jpg|jpeg|gif|webp|bmp)$/i) ? (
              <img key={videoSrc} src={videoSrc}
                className="preview-screen__bg-video"
                style={{ objectFit: 'cover', width: '100%', height: '100%', position: 'absolute', inset: 0 }}
              />
            ) : videoSrc ? (
              <video
                ref={videoRef}
                key={videoSrc}
                src={videoSrc}
                className="preview-screen__bg-video"
                autoPlay muted loop
                onTimeUpdate={onTimeUpdate}
                onLoadedMetadata={onTimeUpdate}
                onPlay={() => dispatch({ type: 'SET_IS_PLAYING', payload: true })}
                onPause={() => dispatch({ type: 'SET_IS_PLAYING', payload: false })}
                style={{ animation: `ef-preview-fade ${state.fadeDuration ?? 0.5}s ease` }}
              />
            ) : null}

            {/* Text layer */}
            {selectedSlide && (
              <div
                className="preview-screen__text"
                style={{
                  left: `${selectedSlide.x ?? 50}%`,
                  top: `${selectedSlide.y ?? 50}%`,
                  width: `${selectedSlide.width ?? 60}%`,
                  height: `${selectedSlide.height ?? 30}%`,
                  color: selectedSlide.textColor || '#fff',
                  fontWeight: selectedSlide.fontWeight || 800,
                  fontSize: `${selectedSlide.fontSize || 5}cqw`,
                  fontFamily: selectedSlide.fontFamily || 'Arial, sans-serif',
                  fontStyle: selectedSlide.italic ? 'italic' : 'normal',
                  textTransform: selectedSlide.transform || 'none',
                  lineHeight: selectedSlide.lineSpacing ?? 1.2,
                  whiteSpace: 'pre-wrap',
                  textDecoration: [
                    selectedSlide.underline && 'underline',
                    selectedSlide.strikethrough && 'line-through',
                  ].filter(Boolean).join(' ') || 'none',
                  textShadow: '0 2px 10px rgba(0,0,0,0.8)',
                }}
              >
                {selectedSlide.text}
              </div>
            )}

            {/* Overlay */}
            {overlaySrc && (
              <video
                src={overlaySrc}
                className="preview-screen__overlay"
                autoPlay muted loop
              />
            )}
          </>
        ) : (
          // Stage preview — renders the active layout with live data
          <StageLayoutPreview
            state={state}
            selectedSlide={selectedSlide}
            nextSlide={nextSlide}
          />
        )}

        {/* Live indicator */}
        
      </div>
      </div>{/* end preview-screen-box */}

      {/* View selector */}
      <div className="preview-view-selector">
        <div className="preview-view-selector__inner">
          <button
            className="preview-view-selector__btn"
            onClick={() => dispatch({ type: 'TOGGLE_PREVIEW_DROPDOWN' })}
          >
            ▾ {activePreview.toUpperCase()}
          </button>

          {showPreviewDropdown && (() => {
            // Read all configured screens from localStorage
            let allScreens = [
              { id: 'Audience', label: 'Audience', role: 'audience' },
              { id: 'Stage',    label: 'Stage',    role: 'stage' },
            ];
            try {
              const saved = JSON.parse(localStorage.getItem('ef_screen_assignments') || '{}');
              if (saved.allScreens?.length) {
                allScreens = saved.allScreens.map(s => ({
                  id:    s.name || s.id,
                  label: s.name || (s.role === 'audience' ? 'Audience' : 'Stage'),
                  role:  s.role,
                  width: s.width,
                  height: s.height,
                }));
              }
            } catch {}
            return (
              <div className="preview-view-selector__dropdown">
                {allScreens.map(s => (
                  <div key={s.id}
                    className={`preview-view-selector__option ${activePreview === s.id ? 'active' : ''}`}
                    onClick={() => {
                      dispatch({ type: 'SET_ACTIVE_PREVIEW', payload: s.id });
                      dispatch({ type: 'CLOSE_PREVIEW_DROPDOWN' });
                    }}
                  >
                    <span>{s.label}</span>
                    {s.width && <span style={{ fontSize: 9, color: '#444', marginLeft: 6 }}>{s.width}×{s.height}</span>}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// CLEAR BAR
// ─────────────────────────────────────────────────────────────────
function ClearBar({ onClearAll, onClearText, onClearVideo, onClearOverlay, onClearAudio }) {
  return (
    <div className="clear-bar">
      <button className="clear-bar__all" onClick={onClearAll} title="Clear Everything">
        <XIcon size={16} color="#ef4444" />
      </button>
      <div className="clear-bar__layers">
        <button className="clear-bar__layer" onClick={onClearText} title="Clear Text"><TextIcon /></button>
        <button className="clear-bar__layer" onClick={onClearVideo} title="Clear Video"><VideoLayerIcon /></button>
        <button className="clear-bar__layer" onClick={onClearOverlay} title="Clear Overlay"><LayersIcon /></button>
        <button className="clear-bar__layer" onClick={onClearAudio} title="Clear Audio">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
            <line x1="4" y1="4" x2="20" y2="20" stroke="#888"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// VU METER
// ─────────────────────────────────────────────────────────────────
function VuMeter({ audioRef, videoRef, state }) {
  const canvasRef   = React.useRef(null);
  const animRef     = React.useRef(null);
  const analyserRef = React.useRef(null);
  const splitterRef = React.useRef(null);
  const channelAnalysers = React.useRef([]);
  const sourceRef   = React.useRef(null);
  const ctxRef      = React.useRef(null);
  const [channels,  setChannels] = React.useState(2);

  const { isPlaying, isAudioPlaying, transportTab } = state;
  const isActive = transportTab === 'video' ? isPlaying : isAudioPlaying;
  const mediaEl  = transportTab === 'video' ? videoRef?.current : audioRef?.current;

  React.useEffect(() => {
    if (!mediaEl) return;
    try {
      if (!ctxRef.current) {
        ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ac = ctxRef.current;
      if (ac.state === 'suspended') ac.resume();

      if (sourceRef.current?._el !== mediaEl) {
        try { sourceRef.current?.disconnect(); } catch {}
        const src = ac.createMediaElementSource(mediaEl);
        src._el = mediaEl;

        // Detect channel count from device (stored in localStorage)
        const numCh = Math.max(2, Math.min(8, ac.destination.channelCount || 2));
        setChannels(numCh);

        // Splitter → one analyser per channel
        const splitter = ac.createChannelSplitter(numCh);
        const analysers = [];
        for (let i = 0; i < numCh; i++) {
          const a = ac.createAnalyser();
          a.fftSize = 256;
          a.smoothingTimeConstant = 0.8;
          splitter.connect(a, i, 0);
          analysers.push(a);
        }
        src.connect(splitter);
        src.connect(ac.destination);

        sourceRef.current = src;
        splitterRef.current = splitter;
        channelAnalysers.current = analysers;
        // Keep single analyser for fallback
        analyserRef.current = analysers[0];
      }
    } catch {}
  }, [mediaEl]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext('2d');

    const BAR_W  = 7;
    const GAP    = 3;
    const NUM_SEG = 20;

    const draw = () => {
      animRef.current = requestAnimationFrame(draw);
      const numCh = channelAnalysers.current.length || 1;
      const W = numCh * (BAR_W + GAP) - GAP;
      const H = 120;
      if (canvas.width !== W) canvas.width = W;
      if (canvas.height !== H) canvas.height = H;
      ctx2d.clearRect(0, 0, W, H);

      channelAnalysers.current.forEach((analyser, ch) => {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        const level = avg / 255;
        const filled = Math.round(level * NUM_SEG);
        const xOff = ch * (BAR_W + GAP);
        const segH = H / NUM_SEG - 1;

        for (let i = 0; i < NUM_SEG; i++) {
          const y = H - (i + 1) * (segH + 1);
          const pct = i / NUM_SEG;
          const r = pct > 0.6 ? 255 : Math.round(pct / 0.6 * 180);
          const g = pct > 0.6 ? Math.round((1 - (pct - 0.6) / 0.4) * 200) : 200;
          ctx2d.fillStyle = i < filled ? `rgb(${r},${g},0)` : 'rgba(255,255,255,0.04)';
          ctx2d.fillRect(xOff, y, BAR_W, segH);
        }
      });
    };

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [channels]);

  return (
    <canvas ref={canvasRef}
      style={{
        position: 'absolute', left: 4, top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 10, borderRadius: 2,
        opacity: isActive ? 1 : 0.2,
        transition: 'opacity 0.3s',
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────
// TRANSPORT BAR
// ─────────────────────────────────────────────────────────────────
function TransportBar({
  state, dispatch,
  togglePlay, skipTime, formatTime,
  videoRef, audioRef,
}) {
  const {
    transportTab, isPlaying, isAudioPlaying,
    currentTime, duration, audioCurrentTime, audioDuration, volume,
    liveVideo, activeAudioUrl,
  } = state;

  const isVideoMode = transportTab === 'video';
  const playing = isVideoMode ? isPlaying : isAudioPlaying;
  const time = isVideoMode ? currentTime : audioCurrentTime;
  const dur  = isVideoMode ? duration    : audioDuration;
  const progress = dur > 0 ? (time / dur) * 100 : 0;

  // Derive display name from path
  const mediaName = isVideoMode
    ? (liveVideo ? liveVideo.split(/[\\/]/).pop().replace(/\.[^.]+$/, '') : null)
    : (activeAudioUrl ? activeAudioUrl.split(/[\\/]/).pop().replace(/\.[^.]+$/, '') : null);

  const handleSeek = async (e) => {
    const val = parseFloat(e.target.value);
    const t = (val / 100) * dur;
    if (isVideoMode && videoRef?.current) {
      videoRef.current.currentTime = t;
      try {
        const { emitTo } = await import('@tauri-apps/api/event');
        await emitTo('*', 'audience-seek', { time: t });
      } catch {}
    }
    if (!isVideoMode && audioRef?.current) audioRef.current.currentTime = t;
  };

  // Also sync on timeupdate to keep preview and audience in lockstep
  React.useEffect(() => {
    const el = videoRef?.current;
    if (!el) return;
    let last = -1;
    const sync = async () => {
      const t = el.currentTime;
      if (Math.abs(t - last) > 2) { // only resync if > 2s drift
        last = t;
        try {
          const { emitTo } = await import('@tauri-apps/api/event');
          await emitTo('*', 'audience-seek', { time: t });
        } catch {}
      }
    };
    el.addEventListener('seeked', sync);
    return () => el.removeEventListener('seeked', sync);
  }, [videoRef]);

  return (
    <div className="transport-bar">
      {/* Tab switcher */}
      <div className="transport-bar__tabs">
        {['video', 'audio'].map(tab => (
          <button
            key={tab}
            className={`transport-bar__tab ${transportTab === tab ? 'active' : ''}`}
            onClick={() => dispatch({ type: 'SET_TRANSPORT_TAB', payload: tab })}
          >
            {tab.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Media name */}
      {mediaName && (
        <div className="transport-bar__name" title={mediaName}>
          {mediaName}
        </div>
      )}

      {/* Progress slider */}
      <div className="transport-bar__progress">
        <span className="transport-bar__time">{formatTime(time)}</span>
        <input
          type="range"
          min="0"
          max="100"
          value={progress}
          onChange={handleSeek}
          className="transport-bar__scrubber"
          onInput={handleSeek}
        />
        <span className="transport-bar__time">{formatTime(dur)}</span>
      </div>

      {/* Controls */}
      <div className="transport-bar__controls">
        <button className="transport-bar__btn" onClick={() => skipTime(-15)} title="Back 15s">
          <Rewind15Icon />
        </button>

        <button
          className={`transport-bar__play ${playing ? 'transport-bar__play--playing' : ''}`}
          onClick={togglePlay}
          title={playing ? 'Pause' : 'Play'}
        >
          {playing ? <PauseIcon /> : <PlayIcon />}
        </button>

        <button className="transport-bar__btn" onClick={() => skipTime(15)} title="Forward 15s">
          <Forward15Icon />
        </button>

        {/* Volume knob */}
        <div className="transport-bar__volume">
          <VolumeIcon />
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={e => dispatch({ type: 'SET_VOLUME', payload: parseFloat(e.target.value) })}
            className="transport-bar__vol-slider"
          />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// NEXT SLIDE PREVIEW
// ─────────────────────────────────────────────────────────────────
function NextSlidePreview({ slide }) {
  if (!slide) return (
    <div className="next-slide next-slide--empty">
      <span>END OF PRESENTATION</span>
    </div>
  );

  return (
    <div className="next-slide" style={{ containerType: 'inline-size' }}>
      <div className="next-slide__label">NEXT</div>
      <div
        className="next-slide__text"
        style={{
          color: slide.textColor || '#fff',
          fontWeight: slide.fontWeight || 800,
          fontSize: `${slide.fontSize || 5}cqw`,
          fontFamily: slide.fontFamily || 'inherit',
          textTransform: slide.transform || 'none',
        }}
      >
        {slide.text}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// AUDIO BINS PANEL
// ─────────────────────────────────────────────────────────────────
function AudioBinsPanel({ state, dispatch, onImportAudio, audioRef }) {
  const {
    audioPlaylists, selectedAudioPlaylistId, editingAudioId,
    audioFiles, activeAudioUrl,
  } = state;

  // Duration formatting
  const fmt = (s) => {
    if (!s || isNaN(s)) return '--:--';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const addBundle = () => {
    const newId = Date.now();
    dispatch({ type: 'ADD_AUDIO_PLAYLIST', payload: { id: newId, name: 'New Playlist' } });
    dispatch({ type: 'SET_SELECTED_AUDIO_PLAYLIST', payload: newId });
    dispatch({ type: 'SET_EDITING_AUDIO_ID', payload: newId });
  };

  const currentTracks = audioFiles.filter(f =>
    selectedAudioPlaylistId ? f.playlistId === selectedAudioPlaylistId : false
  );

  const totalDuration = currentTracks.reduce((acc, t) => acc + (t.duration || 0), 0);
  const totalMins = Math.round(totalDuration / 60);

  const handleImport = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const { convertFileSrc } = await import('@tauri-apps/api/core');
      const selected = await open({
        multiple: true,
        filters: [{ name: 'Audio', extensions: ['mp3','wav','aac','flac','m4a','ogg'] }],
      });
      if (!selected) return;
      const paths = Array.isArray(selected) ? selected : [selected];
      paths.forEach(rawPath => {
        dispatch({ type: 'ADD_AUDIO_FILE', payload: {
          id: Date.now() + Math.random(),
          name: rawPath.split(/[\\/]/).pop().replace(/\.[^.]+$/, ''),
          path: rawPath,
          src: convertFileSrc(rawPath),
          type: 'audio',
          playlistId: selectedAudioPlaylistId || null,
        }});
      });
    } catch (err) { console.error('[AudioBins] Import failed:', err); }
  };

  const playTrack = (track) => {
    if (audioRef?.current) {
      const el = audioRef.current;
      el.src = track.src;
      el.load();
      el.play().catch(() => {});
    }
    dispatch({ type: 'SET_ACTIVE_AUDIO_URL', payload: track.src });
    dispatch({ type: 'SET_TRANSPORT_TAB',    payload: 'audio' });
    dispatch({ type: 'SET_IS_AUDIO_PLAYING', payload: true });
  };

  return (
    <div className="ab-root">

      {/* ── Top: Playlist sidebar ── */}
      <div className="ab-playlists">
        <div className="ab-section-header">
          <span className="ab-section-title">AUDIO</span>
          <div style={{ display: 'flex', gap: 3 }}>
            <button className="ab-icon-btn" onClick={handleImport} title="Import audio">
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </button>
            <button className="ab-icon-btn" onClick={addBundle} title="New Playlist">+</button>
          </div>
        </div>

        <div className="ab-playlist-list">
          {audioPlaylists.length === 0 ? (
            <div className="ab-empty-small">No playlists — click + to create</div>
          ) : (
            audioPlaylists.map(pl => {
              const active = selectedAudioPlaylistId === pl.id;
              const count  = audioFiles.filter(f => f.playlistId === pl.id).length;
              return (
                <div key={pl.id}
                  className={`ab-playlist-item ${active ? 'ab-playlist-item--active' : ''}`}
                  onClick={() => dispatch({ type: 'SET_SELECTED_AUDIO_PLAYLIST', payload: pl.id })}
                >
                  <AbPlaylistIcon active={active} />
                  {editingAudioId === pl.id ? (
                    <input autoFocus className="ab-rename-input"
                      defaultValue={pl.name}
                      onBlur={e => {
                        dispatch({ type: 'UPDATE_AUDIO_PLAYLIST', payload: { id: pl.id, name: e.target.value || pl.name } });
                        dispatch({ type: 'SET_EDITING_AUDIO_ID', payload: null });
                      }}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === 'Escape') e.target.blur();
                      }}
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <span className="ab-playlist-name"
                      onDoubleClick={() => dispatch({ type: 'SET_EDITING_AUDIO_ID', payload: pl.id })}>
                      {pl.name}
                    </span>
                  )}
                  <span className="ab-playlist-count">{count}</span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Bottom: Track list ── */}
      <div className="ab-tracks">
        {selectedAudioPlaylistId ? (
          <>
            <div className="ab-section-header ab-section-header--tracks">
              <span className="ab-track-meta">
                {currentTracks.length} ITEM{currentTracks.length !== 1 ? 'S' : ''}
                {totalMins > 0 && <> · {totalMins} MINUTE{totalMins !== 1 ? 'S' : ''}</>}
              </span>
              <button className="ab-icon-btn" onClick={handleImport} title="Add tracks">+</button>
            </div>
            <div className="ab-track-list">
              {currentTracks.length === 0 ? (
                <div className="ab-empty-small">No tracks — click + to import</div>
              ) : (
                currentTracks.map(track => {
                  const isActive = activeAudioUrl === track.src;
                  return (
                    <div key={track.id}
                      className={`ab-track ${isActive ? 'ab-track--active' : ''}`}
                      onClick={() => playTrack(track)}
                    >
                      <AbTrackIcon active={isActive} />
                      <span className="ab-track-name">{track.name}</span>
                      <span className="ab-track-dur">{fmt(track.duration)}</span>
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : (
          <div className="ab-empty-small" style={{ padding: '12px 10px' }}>
            Select a playlist to see tracks
          </div>
        )}
      </div>
    </div>
  );
}

function AbPlaylistIcon({ active }) {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none"
      stroke={active ? '#D4AF37' : '#444'} strokeWidth="1.5" strokeLinecap="round" flexShrink="0">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <path d="M14 4h7M14 8h5M14 15h7M14 19h5"/>
    </svg>
  );
}
function AbTrackIcon({ active }) {
  return (
    <svg viewBox="0 0 24 24" width="11" height="11" fill="none"
      stroke={active ? '#D4AF37' : '#444'} strokeWidth="1.5" strokeLinecap="round" flexShrink="0">
      <path d="M9 18V5l12-2v13"/>
      <circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
    </svg>
  );
}


// ─────────────────────────────────────────────────────────────────
// SHOW CONTROLS TOOLBAR
// ─────────────────────────────────────────────────────────────────
function ShowControlsToolbar({ activeTab, onTabChange }) {
  const tabs = [
    { id: 'music',   Icon: MusicIcon,   label: 'Music'   },
    { id: 'screens', Icon: StageIcon,   label: 'Stage'   },
    { id: 'stage',   Icon: MessageIcon, label: 'Controls'},
    { id: 'messages',Icon: MessageIcon, label: 'Messages'},
    { id: 'macros',  Icon: MacroIcon,   label: 'Macros'  },
  ];

  return (
    <div className="show-controls-toolbar">
      {tabs.map(({ id, Icon, label }) => (
        <button
          key={id}
          className={`show-controls-toolbar__btn ${activeTab === id ? 'active' : ''}`}
          onClick={() => onTabChange(id)}
          title={label}
        >
          <Icon color={activeTab === id ? '#D4AF37' : '#555'} />
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// MAIN RIGHT PANEL
// ─────────────────────────────────────────────────────────────────
export default function RightPanel({
  state, dispatch,
  selectedSlide, nextSlide,
  videoRef, audioRef,
  togglePlay, skipTime, formatTime,
  onClearAll, handleVideoTimeUpdate, handleAudioTimeUpdate,
  onImportAudio,
}) {
  const { activeControlTab } = state;

  // Resizable heights: preview area and content area
  const [previewH,  setPreviewH]  = React.useState(240);
  const [contentH,  setContentH]  = React.useState(260);
  const MIN_PREVIEW = 140; const MAX_PREVIEW = 420;
  const MIN_CONTENT = 120; const MAX_CONTENT = 500;

  const startResizePreview = React.useCallback((e) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = previewH;
    const onMove = (ev) => {
      const next = Math.min(MAX_PREVIEW, Math.max(MIN_PREVIEW, startH + ev.clientY - startY));
      setPreviewH(next);
    };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); document.body.style.cursor = ''; };
    document.body.style.cursor = 'ns-resize';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [previewH]);

  const startResizeContent = React.useCallback((e) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = contentH;
    const onMove = (ev) => {
      const next = Math.min(MAX_CONTENT, Math.max(MIN_CONTENT, startH - (ev.clientY - startY)));
      setContentH(next);
    };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); document.body.style.cursor = ''; };
    document.body.style.cursor = 'ns-resize';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [contentH]);

  return (
    <aside className="right-panel">
      {/* 1. Preview — resizable */}
      <div style={{ height: previewH, flexShrink: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <AudiencePreview
          state={state} dispatch={dispatch}
          selectedSlide={selectedSlide} nextSlide={nextSlide}
          videoRef={videoRef} audioRef={audioRef}
          onTimeUpdate={handleVideoTimeUpdate}
        />
      </div>

      {/* Resizer 1 */}
      <div className="rp-resizer" onMouseDown={startResizePreview} title="Drag to resize" />

      {/* 2. Clear Bar */}
      <ClearBar
        onClearAll={onClearAll}
        onClearText={async () => {
          dispatch({ type: 'SET_SELECTED_SLIDE', payload: null });
          try { const { emitTo } = await import('@tauri-apps/api/event'); await emitTo('*', 'audience-update', { text: '', nextSlideText: '' }); } catch {}
        }}
        onClearVideo={async () => {
          dispatch({ type: 'SET_LIVE_VIDEO', payload: null });
          try { const { emitTo } = await import('@tauri-apps/api/event'); await emitTo('*', 'audience-update', { videoPath: null }); } catch {}
        }}
        onClearOverlay={async () => {
          dispatch({ type: 'SET_ACTIVE_OVERLAY', payload: null });
          try { const { emitTo } = await import('@tauri-apps/api/event'); await emitTo('*', 'audience-update', { overlayPath: null }); } catch {}
        }}
        onClearAudio={() => {
          dispatch({ type: 'SET_ACTIVE_AUDIO_URL', payload: null });
          dispatch({ type: 'SET_IS_AUDIO_PLAYING', payload: false });
          if (audioRef?.current) { audioRef.current.pause(); audioRef.current.src = ''; }
        }}
      />

      {/* 3. Transport */}
      <TransportBar
        state={state} dispatch={dispatch}
        togglePlay={togglePlay} skipTime={skipTime} formatTime={formatTime}
        videoRef={videoRef} audioRef={audioRef}
      />

      {/* 5. Show Controls Toolbar */}
      <ShowControlsToolbar
        activeTab={activeControlTab}
        onTabChange={tab => dispatch({ type: 'SET_CONTROL_TAB', payload: tab })}
      />

      {/* Resizer 2 */}
      <div className="rp-resizer" onMouseDown={startResizeContent} title="Drag to resize" />

      {/* 6. Content panel — resizable */}
      <div style={{ height: contentH, flexShrink: 0, overflow: 'hidden' }} className="right-panel__content">
        {activeControlTab === 'music' && (
          <AudioBinsPanel state={state} dispatch={dispatch} onImportAudio={onImportAudio} audioRef={audioRef} />
        )}
        {activeControlTab === 'screens' && (
          <StageScreensPanel state={state} dispatch={dispatch} />
        )}
        {activeControlTab === 'stage' && (
          <StageControlsPanel state={state} dispatch={dispatch} />
        )}
        {activeControlTab !== 'music' && activeControlTab !== 'stage' && (
          <div className="right-panel__placeholder">
            <span>{activeControlTab.toUpperCase()} CONTROLS</span>
            <p>Coming soon</p>
          </div>
        )}
      </div>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────────
// STAGE CONTROLS PANEL
// ─────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────
// STAGE SCREENS PANEL
// ─────────────────────────────────────────────────────────────────
function LayoutThumbnail({ layout, active, onClick }) {
  const TC = { currentSlide:'#4ade80', nextSlide:'#facc15', clock:'#D4AF37', timer:'#00e87a', message:'#60a5fa', notes:'#a78bfa', video:'#f97316' };
  return (
    <div onClick={onClick} style={{
      position:'relative', width:'100%', aspectRatio:'16/9',
      background:'#000', borderRadius:6, overflow:'hidden', cursor:'pointer',
      border: active ? '2px solid #D4AF37' : '1px solid #222',
      boxShadow: active ? '0 0 0 1px rgba(212,175,55,0.3)' : 'none',
    }}>
      {layout.elements.map(el => (
        <div key={el.id} style={{
          position:'absolute', left:`${el.x}%`, top:`${el.y}%`, width:`${el.w}%`, height:`${el.h}%`,
          background:`${TC[el.type]||'#444'}22`, border:`1px solid ${TC[el.type]||'#444'}55`, borderRadius:2,
        }}/>
      ))}
      {active && <div style={{
        position:'absolute', bottom:3, right:3, fontSize:7, fontWeight:800, color:'#D4AF37',
        background:'rgba(0,0,0,0.7)', padding:'1px 4px', borderRadius:3,
      }}>LIVE</div>}
    </div>
  );
}

function StageScreensPanel({ state, dispatch }) {
  const { stageLayouts = [], activeStageLayoutId } = state;

  const activateLayout = async (id) => {
    dispatch({ type: 'SET_ACTIVE_STAGE_LAYOUT', payload: id });
    const layout = stageLayouts.find(l => l.id === id);
    if (layout) {
      try {
        const { emitTo } = await import('@tauri-apps/api/event');
        await emitTo('*', 'stage-config', { layout });
      } catch {}
    }
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'#0c0c0c' }}>
      <div style={{ padding:'8px 12px', borderBottom:'1px solid #1a1a1a', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <span style={{ fontSize:9, fontWeight:800, letterSpacing:2, color:'#333' }}>STAGE LAYOUTS</span>
        <button onClick={() => dispatch({ type:'SET_MODE', payload:'stage' })} style={{
          fontSize:9, fontWeight:700, padding:'3px 8px',
          background:'rgba(212,175,55,0.08)', border:'1px solid rgba(212,175,55,0.2)',
          borderRadius:4, color:'#D4AF37', cursor:'pointer',
        }}>✎ Edit Layouts</button>
      </div>
      <div style={{ flex:1, overflowY:'auto', padding:'10px 10px 0' }}>
        {stageLayouts.map(layout => (
          <div key={layout.id} style={{ marginBottom:10 }}>
            <LayoutThumbnail layout={layout} active={activeStageLayoutId === layout.id} onClick={() => activateLayout(layout.id)} />
            <div style={{ fontSize:10, fontWeight:700, color: activeStageLayoutId === layout.id ? '#D4AF37' : '#444', marginTop:4, textAlign:'center' }}>
              {layout.name}
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding:'6px 12px', borderTop:'1px solid #111', display:'flex', flexWrap:'wrap', gap:6 }}>
        {[['#4ade80','Slide'],['#facc15','Next'],['#D4AF37','Clock'],['#00e87a','Timer'],['#60a5fa','Msg'],['#a78bfa','Notes']].map(([color,label]) => (
          <div key={label} style={{ display:'flex', alignItems:'center', gap:3, fontSize:8, color:'#333' }}>
            <div style={{ width:6, height:6, borderRadius:1, background:color, opacity:0.7 }}/>{label}
          </div>
        ))}
      </div>
    </div>
  );
}

function StageControlsPanel({ state, dispatch }) {  const { stageMessage, timerSeconds, timerRunning, timerInitialSeconds } = state;
  const [timerMode,    setTimerMode]    = React.useState('duration');
  const [targetTime,   setTargetTime]   = React.useState('');
  const [msgVisible,   setMsgVisible]   = React.useState(false);

  // HH:MM:SS format for countdown-to-time timer
  const formatTimer = (secs) => {
    if (secs === null || secs === undefined) return '00:00:00';
    const abs = Math.abs(secs);
    const h = Math.floor(abs / 3600);
    const m = Math.floor((abs % 3600) / 60).toString().padStart(2, '0');
    const s = (abs % 60).toString().padStart(2, '0');
    const prefix = secs < 0 ? '-' : '';
    if (timerMode === 'clock' || h > 0) return `${prefix}${h}:${m}:${s}`;
    return `${prefix}${m}:${s}`;
  };

  const handleMessageChange = async (val) => {
    dispatch({ type: 'SET_STAGE_MESSAGE', payload: val });
    // Only emit to stage if currently visible
    if (msgVisible) {
      try {
        const { emitTo } = await import('@tauri-apps/api/event');
        await emitTo('*', 'stage-message', { message: val });
      } catch (_) {}
    }
  };

  const handleMessageVisibility = async (show) => {
    setMsgVisible(show);
    try {
      const { emitTo } = await import('@tauri-apps/api/event');
      await emitTo('*', 'stage-message', { message: show ? (stageMessage || '') : '' });
    } catch (_) {}
  };

  const handleTextareaPaste = (e) => {
    // Allow native paste — stopPropagation prevents app-level key handlers from intercepting
    e.stopPropagation();
  };

  const handleTextareaKeyDown = (e) => {
    e.stopPropagation(); // prevent slide navigation keys
    if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
      // Let browser handle paste natively — just stop propagation
      return;
    }
  };

  const pushTimer = async (seconds, running) => {
    try {
      const { emitTo } = await import('@tauri-apps/api/event');
      await emitTo('*', 'stage-timer', { seconds, running });
    } catch (_) {}
  };

  const handleSetTimer = (mins) => {
    const secs = mins * 60;
    dispatch({ type: 'SET_TIMER_INITIAL', payload: secs });
    pushTimer(secs, false);
  };

  const handleSetTargetTime = (timeStr) => {
    if (!timeStr) return;
    const [hh, mm] = timeStr.split(':').map(Number);
    const now    = new Date();
    const target = new Date();
    target.setHours(hh, mm, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    const secs = Math.round((target - now) / 1000);
    dispatch({ type: 'SET_TIMER_INITIAL', payload: secs });
    pushTimer(secs, false);
  };

  const handleStartStop = () => {
    const next = !timerRunning;
    dispatch({ type: 'SET_TIMER_RUNNING', payload: next });
    pushTimer(timerSeconds, next);
  };

  const handleReset = () => {
    dispatch({ type: 'RESET_TIMER' });
    pushTimer(timerInitialSeconds, false);
  };

  const timerColor = timerSeconds <= 0 ? '#ff3b3b' : timerSeconds <= 30 ? '#ffaa00' : '#00e87a';
  const presets = [1, 2, 3, 5, 10, 15, 20, 30];

  return (
    <div className="stage-controls">

      {/* Stage Message */}
      <div className="stage-controls__section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div className="stage-controls__label" style={{ margin: 0 }}>STAGE MESSAGE</div>
          <button
            onClick={() => handleMessageVisibility(!msgVisible)}
            style={{
              height: 22, padding: '0 10px', borderRadius: 5, cursor: 'pointer',
              fontSize: 9, fontWeight: 800, letterSpacing: 0.5,
              background: msgVisible ? 'rgba(74,222,128,0.1)' : 'transparent',
              border: `1px solid ${msgVisible ? 'rgba(74,222,128,0.3)' : '#222'}`,
              color: msgVisible ? '#4ade80' : '#444',
              transition: 'all 0.15s',
            }}
          >
            {msgVisible ? '● LIVE' : '○ HIDDEN'}
          </button>
        </div>
        <textarea
          className="stage-controls__message-input"
          placeholder="Type a message for the stage monitor..."
          value={stageMessage || ''}
          onChange={e => handleMessageChange(e.target.value)}
          onKeyDown={handleTextareaKeyDown}
          onPaste={handleTextareaPaste}
          rows={3}
        />
        {stageMessage && (
          <button
            className="stage-controls__clear-btn"
            onClick={() => { handleMessageChange(''); setMsgVisible(false); }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Timer */}
      <div className="stage-controls__section">
        <div className="stage-controls__label">COUNTDOWN TIMER</div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
          {[['duration', 'Duration'], ['clock', 'To Time']].map(([mode, label]) => (
            <button key={mode} onClick={() => setTimerMode(mode)} style={{
              flex: 1, height: 26, borderRadius: 5, cursor: 'pointer', fontSize: 10, fontWeight: 700,
              background: timerMode === mode ? 'rgba(212,175,55,0.12)' : 'transparent',
              border: `1px solid ${timerMode === mode ? 'rgba(212,175,55,0.35)' : '#222'}`,
              color: timerMode === mode ? '#D4AF37' : '#444',
              transition: 'all 0.12s',
            }}>{label}</button>
          ))}
        </div>

        {/* Timer display */}
        <div className="stage-controls__timer-display" style={{ color: timerColor }}>
          {formatTimer(timerSeconds)}
        </div>

        {/* Duration mode: presets + custom */}
        {timerMode === 'duration' && (
          <>
            <div className="stage-controls__presets">
              {presets.map(m => (
                <button
                  key={m}
                  className={`stage-controls__preset ${timerInitialSeconds === m * 60 ? 'stage-controls__preset--active' : ''}`}
                  onClick={() => handleSetTimer(m)}
                >
                  {m}m
                </button>
              ))}
            </div>
            <div className="stage-controls__custom">
              <input
                type="number" min="0"
                className="stage-controls__custom-input"
                placeholder="Custom min"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) { handleSetTimer(val); e.target.value = ''; }
                  }
                }}
              />
              <span className="stage-controls__custom-hint">press Enter</span>
            </div>
          </>
        )}

        {/* Clock mode: countdown to a specific time of day */}
        {timerMode === 'clock' && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, color: '#444', marginBottom: 6, fontWeight: 700, letterSpacing: 1 }}>
              COUNT DOWN TO
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="time"
                value={targetTime}
                onChange={e => setTargetTime(e.target.value)}
                style={{
                  flex: 1, height: 30, padding: '0 8px',
                  background: '#111', border: '1px solid #1e1e1e',
                  borderRadius: 5, color: '#ccc', fontSize: 12, outline: 'none',
                  fontFamily: 'monospace',
                }}
              />
              <button
                onClick={() => handleSetTargetTime(targetTime)}
                disabled={!targetTime}
                style={{
                  height: 30, padding: '0 10px', borderRadius: 5, cursor: targetTime ? 'pointer' : 'not-allowed',
                  background: targetTime ? 'rgba(212,175,55,0.1)' : 'transparent',
                  border: `1px solid ${targetTime ? 'rgba(212,175,55,0.3)' : '#1e1e1e'}`,
                  color: targetTime ? '#D4AF37' : '#333', fontSize: 10, fontWeight: 700,
                }}
              >Set</button>
            </div>
            <div style={{ fontSize: 9, color: '#2a2a2a', marginTop: 5 }}>
              Counts down to the selected time today (or tomorrow if past)
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="stage-controls__timer-btns">
          <button
            className={`stage-controls__play-btn ${timerRunning ? 'stage-controls__play-btn--running' : ''}`}
            onClick={handleStartStop}
          >
            {timerRunning ? '⏸ Pause' : '▶ Start'}
          </button>
          <button className="stage-controls__reset-btn" onClick={handleReset}>
            ↺ Reset
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SVG Icons
// ─────────────────────────────────────────────────────────────────
function XIcon({ size = 14, color = '#ef4444' }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
    </svg>
  );
}

function TextIcon() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
      <path d="M2.5 4v3h5v12h3V7h5V4h-13zm19 5h-9v3h3v7h3v-7h3V9z" />
    </svg>
  );
}

function VideoLayerIcon() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
      <path d="M17 10.5V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 4v-11l-4 4z" />
    </svg>
  );
}

function LayersIcon() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
      <path d="M11.99 18.54l-7.37-5.73L3 14.07l9 7 9-7-1.63-1.27-7.38 5.74zM12 16l7.36-5.73L21 9l-9-7-9 7 1.63 1.27L12 16z" />
    </svg>
  );
}

function PlayIcon() {
  return <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>;
}

function PauseIcon() {
  return <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>;
}

function Rewind15Icon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
      <path d="M12 5V1L7 6l5 5V7c3.3 0 6 2.7 6 6s-2.7 6-6 6-6-2.7-6-6H4c0 4.4 3.6 8 8 8s8-3.6 8-8-3.6-8-8-8z" />
      <text x="8.5" y="15" fontSize="5" fontWeight="bold" fontFamily="Arial" fill="currentColor">15</text>
    </svg>
  );
}

function Forward15Icon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
      <path d="M12 5V1l5 5-5 5V7c-3.3 0-6 2.7-6 6s2.7 6 6 6 6-2.7 6-6h2c0 4.4-3.6 8-8 8s-8-3.6-8-8 3.6-8 8-8z" />
      <text x="8.5" y="15" fontSize="5" fontWeight="bold" fontFamily="Arial" fill="currentColor">15</text>
    </svg>
  );
}

function VolumeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
      <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
    </svg>
  );
}

function MusicIcon({ size = 14, color = 'currentColor' }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={color}>
      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
    </svg>
  );
}

function StageIcon({ color = 'currentColor' }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke={color} strokeWidth="2">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

function MessageIcon({ color = 'currentColor' }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke={color} strokeWidth="2">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}

function MacroIcon({ color = 'currentColor' }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke={color} strokeWidth="2">
      <polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}