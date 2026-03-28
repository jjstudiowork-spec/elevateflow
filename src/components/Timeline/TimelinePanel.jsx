/**
 * TimelinePanel.jsx — ProPresenter-style Timeline
 *
 * Features:
 * - Drag slide cue blocks to set trigger times
 * - Play button runs the timeline clock, auto-fires slides at their cue times
 * - Configurable total duration
 * - Playhead shows current position, drag to seek
 * - Loop toggle
 * - Audio/video track display
 * - Ruler with adaptive tick marks
 */
import React, { useRef, useCallback, useEffect, useState } from 'react';

const TRACK_H  = 38;
const LABEL_W  = 68;
const RULER_H  = 22;

const GC = {
  Verse:        '#3b82f6',
  Chorus:       '#ef4444',
  Bridge:       '#a855f7',
  'Pre-Chorus': '#f97316',
  Intro:        '#22c55e',
  Outro:        '#6b7280',
  None:         '#3a3a3a',
};

function groupColor(g) { return GC[g] || GC.None; }

// ── Ruler ──────────────────────────────────────────────────────
function Ruler({ duration, timeToX }) {
  const step = duration <= 30 ? 2
             : duration <= 60 ? 5
             : duration <= 300 ? 15
             : duration <= 600 ? 30 : 60;
  const ticks = [];
  for (let t = 0; t <= duration; t += step) {
    const x = timeToX(t);
    const m = Math.floor(t / 60);
    const s = (t % 60).toString().padStart(2, '0');
    const label = m > 0 ? `${m}:${s}` : `0:${s}`;
    ticks.push({ x, label, major: t % (step * 4) === 0 });
  }
  return (
    <div style={{ height: RULER_H, position: 'relative', background: '#0a0a0a', borderBottom: '1px solid #1a1a1a', userSelect: 'none' }}>
      {ticks.map(({ x, label, major }) => (
        <div key={label} style={{ position: 'absolute', left: x, top: 0, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', pointerEvents: 'none' }}>
          <div style={{ width: 1, height: major ? 10 : 5, background: major ? '#333' : '#222', marginTop: 0, marginLeft: 1 }} />
          {major && <span style={{ fontSize: 9, color: '#3a3a3a', fontWeight: 700, marginLeft: 3, lineHeight: 1 }}>{label}</span>}
        </div>
      ))}
    </div>
  );
}

// ── Track row ──────────────────────────────────────────────────
function TrackRow({ label, h = TRACK_H, children, onClick }) {
  return (
    <div style={{ display: 'flex', height: h, borderBottom: '1px solid #111' }} onClick={onClick}>
      <div style={{
        width: LABEL_W, flexShrink: 0, display: 'flex', alignItems: 'center', paddingLeft: 10,
        fontSize: 8, fontWeight: 800, letterSpacing: '1.2px', color: '#2a2a2a',
        background: '#080808', borderRight: '1px solid #151515',
      }}>{label}</div>
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>{children}</div>
    </div>
  );
}

// ── Slide cue block (draggable) ────────────────────────────────
function CueBlock({ slide, x, w, isActive, isNext, onClick, onDragStart }) {
  const color = groupColor(slide.group);
  const [hov, setHov] = useState(false);

  return (
    <div
      onMouseDown={onDragStart}
      onClick={e => { e.stopPropagation(); onClick(); }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title={`${slide.text?.split('\n')[0] || 'Slide'} — drag to reposition`}
      style={{
        position: 'absolute', left: x, top: 4,
        width: Math.max(w - 1, 8), height: TRACK_H - 8,
        background: isActive ? color : `${color}55`,
        borderRadius: 4,
        border: `1.5px solid ${isActive ? color : (hov ? `${color}99` : `${color}33`)}`,
        boxShadow: isActive ? `0 0 10px ${color}66` : 'none',
        cursor: 'grab', overflow: 'hidden',
        display: 'flex', alignItems: 'center', padding: '0 5px',
        transition: 'border-color 0.1s, box-shadow 0.15s',
        userSelect: 'none',
      }}
    >
      {/* Cue handle on left edge */}
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
        background: color, opacity: 0.9, borderRadius: '4px 0 0 4px',
      }} />
      <span style={{
        fontSize: 8, fontWeight: 700, color: isActive ? '#fff' : `${color}cc`,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        marginLeft: 5,
      }}>
        {slide.text?.split('\n')[0]?.slice(0, 20) || '—'}
      </span>
      {isNext && (
        <div style={{
          position: 'absolute', right: 3, top: '50%', transform: 'translateY(-50%)',
          fontSize: 7, fontWeight: 800, color: '#D4AF37', background: 'rgba(212,175,55,0.15)',
          border: '1px solid rgba(212,175,55,0.3)', borderRadius: 3, padding: '1px 4px',
        }}>NEXT</div>
      )}
    </div>
  );
}

// ── Playhead ───────────────────────────────────────────────────
function Playhead({ x, trackCount }) {
  return (
    <div style={{
      position: 'absolute', left: x, top: 0,
      width: 2, height: `${RULER_H + TRACK_H * trackCount}px`,
      pointerEvents: 'none', zIndex: 30,
    }}>
      {/* Triangle */}
      <div style={{
        position: 'absolute', top: -1, left: -5,
        width: 0, height: 0,
        borderLeft: '6px solid transparent',
        borderRight: '6px solid transparent',
        borderTop: '8px solid #ef4444',
      }} />
      <div style={{ width: 2, height: '100%', background: 'rgba(239,68,68,0.7)' }} />
    </div>
  );
}

// ── Main Timeline Panel ────────────────────────────────────────
export default function TimelinePanel({ state, dispatch, slides, activeSong, onSlideClick }) {
  const containerRef = useRef(null);
  const [w, setW]    = useState(800);
  const rafRef       = useRef(null);
  const clockRef     = useRef(0);      // internal playback clock in seconds
  const lastTickRef  = useRef(null);   // timestamp of last animation frame
  const firedRef     = useRef(new Set()); // slide ids fired in this playthrough

  const {
    currentTime, duration: videoDuration,
    audioCurrentTime, audioDuration,
    transportTab, activeAudioUrl, liveVideo, selectedSlideId,
    timelinePlaying = false, timelineLoop = false,
    timelineDuration: stateDuration,
    slideCueTimes = {},  // { [slideId]: seconds }
  } = state;

  // Timeline duration — user-configurable or auto
  const tlDuration = Math.max(
    stateDuration || 0,
    audioDuration || 0,
    videoDuration || 0,
    slides.length * 8,
    60,
  );

  const trackW   = w - LABEL_W;
  const timeToX  = useCallback(t => (t / tlDuration) * trackW, [tlDuration, trackW]);
  const xToTime  = useCallback(x => Math.max(0, Math.min((x / trackW) * tlDuration, tlDuration)), [tlDuration, trackW]);

  // Observe container width
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(e => setW(e[0].contentRect.width));
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Build cue times — evenly spaced by default, overridden by user drags
  const getCueTime = useCallback((slide, index) => {
    if (slideCueTimes[slide.id] !== undefined) return slideCueTimes[slide.id];
    // Default: evenly distributed
    return (index / Math.max(slides.length, 1)) * tlDuration;
  }, [slideCueTimes, slides.length, tlDuration]);

  // Playhead position
  const playheadTime = timelinePlaying ? clockRef.current
    : (transportTab === 'audio' ? (audioCurrentTime || 0) : (currentTime || 0));
  const playheadX = timeToX(playheadTime);

  // ── Timeline clock ─────────────────────────────────────────────
  useEffect(() => {
    if (!timelinePlaying) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTickRef.current = null;
      return;
    }

    const tick = (now) => {
      if (lastTickRef.current !== null) {
        const dt = (now - lastTickRef.current) / 1000;
        clockRef.current = Math.min(clockRef.current + dt, tlDuration);

        // Check which slides should fire
        slides.forEach((slide, i) => {
          const cueT = getCueTime(slide, i);
          if (!firedRef.current.has(slide.id) && clockRef.current >= cueT) {
            firedRef.current.add(slide.id);
            onSlideClick?.(slide);
          }
        });

        // Reached end
        if (clockRef.current >= tlDuration) {
          if (timelineLoop) {
            clockRef.current = 0;
            firedRef.current.clear();
          } else {
            dispatch({ type: 'SET_TIMELINE_PLAYING', payload: false });
            return;
          }
        }
      }
      lastTickRef.current = now;
      rafRef.current = requestAnimationFrame(tick);
    };

    firedRef.current = new Set(
      slides.filter((s, i) => clockRef.current > getCueTime(s, i)).map(s => s.id)
    );
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [timelinePlaying, timelineLoop, tlDuration, slides, getCueTime, onSlideClick, dispatch]);

  // ── Playhead drag ──────────────────────────────────────────────
  const handleRulerMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const seek = (ev) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = ev.clientX - rect.left - LABEL_W;
      const t = xToTime(x);
      clockRef.current = t;
      firedRef.current = new Set(
        slides.filter((s, i) => t > getCueTime(s, i)).map(s => s.id)
      );
      // Also seek media
      const ael = document.querySelector('audio');
      const vel = document.querySelector('video');
      if (ael && activeAudioUrl) ael.currentTime = t;
      if (vel && liveVideo) vel.currentTime = t;
    };
    seek(e);
    const onMove = (ev) => seek(ev);
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [xToTime, slides, getCueTime, activeAudioUrl, liveVideo]);

  // ── Cue block drag ─────────────────────────────────────────────
  const handleCueDragStart = useCallback((slide, index, e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startT = getCueTime(slide, index);
    const onMove = (ev) => {
      if (!containerRef.current) return;
      const dx = ev.clientX - startX;
      const dt = (dx / trackW) * tlDuration;
      const newT = Math.max(0, Math.min(startT + dt, tlDuration));
      dispatch({ type: 'SET_SLIDE_CUE_TIME', payload: { slideId: slide.id, time: newT } });
    };
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [getCueTime, trackW, tlDuration, dispatch]);

  // ── Toggle play ────────────────────────────────────────────────
  const togglePlay = () => {
    if (!timelinePlaying) {
      lastTickRef.current = null;
      dispatch({ type: 'SET_TIMELINE_PLAYING', payload: true });
    } else {
      dispatch({ type: 'SET_TIMELINE_PLAYING', payload: false });
    }
  };

  const fmt = (s) => {
    if (!s && s !== 0) return '0:00';
    const m = Math.floor(s / 60);
    return `${m}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
  };

  const activeIdx   = slides.findIndex(s => s.id === selectedSlideId);
  const nextSlide   = slides[activeIdx + 1];
  const audioName   = activeAudioUrl?.split(/[\\/]/).pop().replace(/\.[^.]+$/, '') || null;
  const videoName   = liveVideo?.split(/[\\/]/).pop().replace(/\.[^.]+$/, '') || null;

  const TRACKS = 3; // slides, media, audio

  return (
    <div ref={containerRef} style={{
      background: '#0c0c0c', borderTop: '2px solid #1a1a1a',
      display: 'flex', flexDirection: 'column', userSelect: 'none',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
    }}>
      {/* ── Header / transport ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '5px 10px', borderBottom: '1px solid #181818', background: '#0a0a0a',
      }}>
        {/* Play/pause */}
        <button onClick={togglePlay} style={{
          width: 26, height: 26, borderRadius: '50%', border: 'none',
          background: timelinePlaying ? 'rgba(239,68,68,0.2)' : 'rgba(212,175,55,0.15)',
          color: timelinePlaying ? '#ef4444' : '#D4AF37',
          cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {timelinePlaying ? '⏹' : '▶'}
        </button>

        {/* Loop */}
        <button onClick={() => dispatch({ type: 'SET_TIMELINE_LOOP', payload: !timelineLoop })} style={{
          width: 26, height: 26, borderRadius: 5, border: 'none',
          background: timelineLoop ? 'rgba(212,175,55,0.12)' : 'transparent',
          color: timelineLoop ? '#D4AF37' : '#333',
          cursor: 'pointer', fontSize: 13,
        }} title="Loop">↻</button>

        {/* Position */}
        <span style={{ fontSize: 10, fontWeight: 700, color: '#444', fontVariantNumeric: 'tabular-nums', marginLeft: 2 }}>
          {fmt(timelinePlaying ? clockRef.current : playheadTime)} / {fmt(tlDuration)}
        </span>

        {/* Duration control */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 9, color: '#2a2a2a', fontWeight: 700, letterSpacing: 1 }}>DURATION</span>
          <input type="number" min={10} max={3600} step={10}
            value={stateDuration || Math.ceil(tlDuration)}
            onChange={e => dispatch({ type: 'SET_TIMELINE_DURATION', payload: parseInt(e.target.value) || 60 })}
            style={{
              width: 54, height: 22, background: '#111', border: '1px solid #1e1e1e',
              borderRadius: 4, color: '#444', fontSize: 10, textAlign: 'center', outline: 'none',
            }}
          />
          <span style={{ fontSize: 9, color: '#222' }}>sec</span>
        </div>

        {/* Reset */}
        <button onClick={() => { clockRef.current = 0; firedRef.current.clear(); dispatch({ type: 'SET_TIMELINE_PLAYING', payload: false }); }}
          style={{
            height: 22, padding: '0 8px', background: 'transparent', border: '1px solid #1e1e1e',
            borderRadius: 4, color: '#2a2a2a', fontSize: 9, cursor: 'pointer', fontWeight: 700,
          }}>↩ Reset</button>

        {/* Close */}
        <button onClick={() => dispatch({ type: 'TOGGLE_TIMELINE' })} style={{
          height: 22, padding: '0 8px', background: 'transparent', border: '1px solid #1e1e1e',
          borderRadius: 4, color: '#2a2a2a', fontSize: 9, cursor: 'pointer', fontWeight: 700,
        }}>✕</button>
      </div>

      {/* ── Ruler + Tracks ── */}
      <div style={{ position: 'relative', flexShrink: 0 }}>

        {/* Ruler */}
        <div style={{ display: 'flex' }}>
          <div style={{ width: LABEL_W, flexShrink: 0, background: '#080808', borderRight: '1px solid #151515', height: RULER_H }} />
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden', cursor: 'col-resize' }}
            onMouseDown={handleRulerMouseDown}>
            <Ruler duration={tlDuration} timeToX={timeToX} />
            {/* Playhead on ruler */}
            <div style={{
              position: 'absolute', top: 0, left: playheadX - 1, width: 2, height: RULER_H,
              background: '#ef4444', pointerEvents: 'none', zIndex: 5,
            }} />
          </div>
        </div>

        {/* Slides track */}
        <TrackRow label="SLIDES">
          {/* Click-on-track seeks */}
          <div style={{ position: 'absolute', inset: 0, cursor: 'col-resize' }}
            onMouseDown={handleRulerMouseDown} />
          {slides.map((slide, i) => {
            const cueT = getCueTime(slide, i);
            const x = timeToX(cueT);
            // Width = gap to next cue
            const nextCue = i < slides.length - 1 ? getCueTime(slides[i + 1], i + 1) : tlDuration;
            const w2 = Math.max(timeToX(nextCue) - x - 1, 10);
            return (
              <CueBlock
                key={slide.id} slide={slide} x={x} w={w2}
                isActive={slide.id === selectedSlideId}
                isNext={nextSlide?.id === slide.id}
                onClick={() => onSlideClick?.(slide)}
                onDragStart={(e) => handleCueDragStart(slide, i, e)}
              />
            );
          })}
          {/* Playhead line through slides track */}
          <div style={{ position: 'absolute', left: playheadX, top: 0, bottom: 0, width: 2, background: 'rgba(239,68,68,0.5)', pointerEvents: 'none', zIndex: 10 }} />
        </TrackRow>

        {/* Media track */}
        <TrackRow label="MEDIA">
          {videoName && (
            <div style={{
              position: 'absolute', left: 2, top: 4, right: 2, bottom: 4,
              background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)',
              borderRadius: 4, display: 'flex', alignItems: 'center', padding: '0 8px', overflow: 'hidden',
            }}>
              <span style={{ fontSize: 9, color: '#D4AF37', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                ▶ {videoName}
              </span>
            </div>
          )}
          <div style={{ position: 'absolute', left: playheadX, top: 0, bottom: 0, width: 2, background: 'rgba(239,68,68,0.3)', pointerEvents: 'none' }} />
        </TrackRow>

        {/* Audio track */}
        <TrackRow label="AUDIO" onClick={handleRulerMouseDown}>
          {audioName && audioDuration > 0 ? (
            <div style={{
              position: 'absolute', left: 2, top: 4, width: Math.max(timeToX(audioDuration) - 4, 0), bottom: 4,
              background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
              borderRadius: 4, display: 'flex', alignItems: 'center', padding: '0 8px', overflow: 'hidden',
              cursor: 'col-resize',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 1, marginRight: 6, flexShrink: 0 }}>
                {[4,7,5,9,6,8,4,7,9,5].map((h,i) => (
                  <div key={i} style={{ width: 2, height: h, background: 'rgba(34,197,94,0.5)', borderRadius: 1 }} />
                ))}
              </div>
              <span style={{ fontSize: 9, color: '#22c55e', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {audioName}
              </span>
            </div>
          ) : (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', paddingLeft: 8 }}>
              <span style={{ fontSize: 8, color: '#1e1e1e', fontWeight: 700 }}>No audio</span>
            </div>
          )}
          <div style={{ position: 'absolute', left: playheadX, top: 0, bottom: 0, width: 2, background: 'rgba(239,68,68,0.3)', pointerEvents: 'none' }} />
        </TrackRow>

      </div>
    </div>
  );
}