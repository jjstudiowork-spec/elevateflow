/**
 * StageView.jsx — Element-driven stage display
 * Renders whichever layout is active, populated with live data.
 */
import React, { useEffect, useState, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { convertFileSrc } from '@tauri-apps/api/core';

function useClock() {
  const [time, setTime] = useState('');
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      let h = now.getHours();
      const m = now.getMinutes().toString().padStart(2, '0');
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      setTime(`${h}:${m} ${ampm}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

function formatTimer(secs) {
  if (secs === null || secs === undefined) return '--:--';
  const abs = Math.abs(secs);
  const m = Math.floor(abs / 60).toString().padStart(2, '0');
  const s = (abs % 60).toString().padStart(2, '0');
  return `${secs < 0 ? '-' : ''}${m}:${s}`;
}

function StageElement({ el, data, clock }) {
  const { type, x, y, w, h, fontSize, color, bgColor, showLabel } = el;
  const { currentSlide, nextSlide, timerSeconds, stageMessage, notes, videoPath } = data;

  let content = null;
  let label   = '';

  switch (type) {
    case 'currentSlide':
      label   = 'CURRENT';
      content = (
        <div style={{
          fontSize: `${fontSize || 1}cqw`, fontWeight: currentSlide?.fontWeight || 800,
          color: el.color || currentSlide?.textColor || '#fff',
          fontFamily: currentSlide?.fontFamily || 'sans-serif',
          fontStyle: currentSlide?.italic ? 'italic' : 'normal',
          textTransform: currentSlide?.transform || 'none',
          whiteSpace: 'pre-wrap', lineHeight: 1.2,
          textDecoration: [
            currentSlide?.underline && 'underline',
            currentSlide?.strikethrough && 'line-through',
          ].filter(Boolean).join(' ') || 'none',
        }}>
          {currentSlide?.text || ''}
        </div>
      );
      break;

    case 'nextSlide':
      label   = 'NEXT';
      content = (
        <div style={{
          fontSize: `${fontSize || 0.7}cqw`, fontWeight: nextSlide?.fontWeight || 700,
          color: el.color || '#ffff00',
          whiteSpace: 'pre-wrap', lineHeight: 1.2, opacity: nextSlide ? 1 : 0.3,
        }}>
          {nextSlide?.text || '— END —'}
        </div>
      );
      break;

    case 'clock':
      label   = 'CLOCK';
      content = (
        <div style={{ fontSize: `${fontSize || 1.4}cqw`, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>
          {clock}
        </div>
      );
      break;

    case 'timer': {
      const tc = timerSeconds === null ? '#fff'
               : timerSeconds <= 0    ? '#ef4444'
               : timerSeconds <= 30   ? '#f97316'
               : color;
      label   = 'TIMER';
      content = (
        <div style={{ fontSize: `${fontSize || 1.4}cqw`, fontWeight: 800, color: tc, fontVariantNumeric: 'tabular-nums' }}>
          {formatTimer(timerSeconds)}
        </div>
      );
      break;
    }

    case 'message':
      label   = 'MESSAGE';
      content = (
        <div style={{ fontSize: `${fontSize || 1}cqw`, fontWeight: 800, color, whiteSpace: 'pre-wrap', textAlign: 'center', lineHeight: 1.3 }}>
          {stageMessage || ''}
        </div>
      );
      break;

    case 'notes':
      label   = 'NOTES';
      content = (
        <div style={{ fontSize: `${fontSize || 0.8}cqw`, fontWeight: 600, color, whiteSpace: 'pre-wrap', lineHeight: 1.4, opacity: notes ? 1 : 0.3 }}>
          {notes || 'No notes for this slide'}
        </div>
      );
      break;

    case 'video':
      label   = 'VIDEO';
      content = videoPath ? (
        <video
          key={videoPath}
          src={videoPath.startsWith('asset://') ? videoPath : convertFileSrc(videoPath)}
          autoPlay loop muted playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <div style={{ fontSize: `${fontSize || 0.8}cqw`, color: '#333', fontWeight: 700 }}>No video</div>
      );
      break;

    default:
      content = null;
  }

  return (
    <div style={{
      position: 'absolute',
      left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%`,
      background: bgColor && bgColor !== 'transparent' ? bgColor : 'transparent',
      overflow: 'hidden', boxSizing: 'border-box',
      display: 'flex', flexDirection: 'column',
      padding: type === 'video' ? 0 : '4px 8px',
    }}>
      {showLabel && (
        <div style={{
          fontSize: '0.5cqw', fontWeight: 800, letterSpacing: 1.5,
          color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase',
          marginBottom: 2, flexShrink: 0,
        }}>{label}</div>
      )}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {content}
      </div>
    </div>
  );
}

export default function StageView() {
  const [layout,       setLayout]       = useState(null);
  const [currentSlide, setCurrentSlide] = useState({});
  const [nextSlide,    setNextSlide]    = useState(null);
  const [videoPath,    setVideoPath]    = useState(null);
  const [stageMessage, setStageMessage] = useState('');
  const [timerSeconds, setTimerSeconds] = useState(null);
  const [timerRunning, setTimerRunning] = useState(false);
  const [notes,        setNotes]        = useState('');
  const timerRef = useRef(null);
  const clock    = useClock();

  useEffect(() => {
    const unsubs = [
      listen('audience-update', (e) => {
        const p = e.payload;
        setCurrentSlide({
          text: p.text, textColor: p.textColor, fontWeight: p.fontWeight,
          fontSize: p.fontSize, fontFamily: p.fontFamily,
          italic: p.italic, underline: p.underline, strikethrough: p.strikethrough,
          transform: p.transform,
        });
        if (p.nextSlideText !== undefined) {
          setNextSlide(p.nextSlideText ? {
            text: p.nextSlideText, fontWeight: p.nextSlideFontWeight || 700,
          } : null);
        }
        if (p.videoPath !== undefined) setVideoPath(p.videoPath);
        if (p.notes     !== undefined) setNotes(p.notes || '');
      }),
      listen('audience-clear', () => {
        setCurrentSlide({}); setNextSlide(null); setVideoPath(null); setNotes('');
      }),
      listen('stage-config', (e) => {
        if (e.payload?.layout) setLayout(e.payload.layout);
      }),
      listen('stage-message', (e) => {
        setStageMessage(e.payload?.message || '');
      }),
      listen('stage-timer', (e) => {
        setTimerSeconds(e.payload.seconds);
        setTimerRunning(e.payload.running);
      }),
    ];

    // Request current layout from main window on mount
    import('@tauri-apps/api/event').then(({ emitTo }) =>
      emitTo('main', 'stage-request-config', {}).catch(() => {})
    );

    return () => unsubs.forEach(p => p.then(f => f()));
  }, []);

  // Timer tick
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (timerRunning && timerSeconds !== null) {
      timerRef.current = setInterval(() => {
        setTimerSeconds(prev => (prev === null ? null : prev - 1));
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerRunning]);

  const data = { currentSlide, nextSlide, timerSeconds, stageMessage, notes, videoPath };

  // Default layout if none received yet
  const displayLayout = layout || {
    elements: [
      { id: 'e1', type: 'currentSlide', x:2,  y:2,  w:96, h:54, fontSize:1,   color:'#fff',     bgColor:'transparent', showLabel:false },
      { id: 'e2', type: 'nextSlide',    x:2,  y:58, w:64, h:28, fontSize:0.7, color:'#ffff00',  bgColor:'transparent', showLabel:true  },
      { id: 'e3', type: 'clock',        x:68, y:58, w:30, h:14, fontSize:1.4, color:'#D4AF37',  bgColor:'transparent', showLabel:true  },
      { id: 'e4', type: 'timer',        x:68, y:74, w:30, h:14, fontSize:1.4, color:'#00e87a',  bgColor:'transparent', showLabel:true  },
    ],
  };

  return (
    <div style={{
      width: '100vw', height: '100vh', background: '#000', overflow: 'hidden',
      position: 'relative', containerType: 'inline-size',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
    }}>
      {displayLayout.elements.map(el => (
        <StageElement key={el.id} el={el} data={data} clock={clock} />
      ))}
    </div>
  );
}