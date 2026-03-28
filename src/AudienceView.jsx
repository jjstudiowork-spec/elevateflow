/**
 * AudienceView.jsx
 * Fullscreen output window.
 * Receives slide data via Tauri events from App.jsx.
 *
 * IMPORTANT: asset:// URLs are window-scoped in Tauri.
 * App.jsx sends the raw filesystem `path` in the event payload.
 * We call convertFileSrc() here in this window so the URL is valid locally.
 */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';

const DEFAULT_STATE = {
  text: '',
  videoPath: null,
  overlayPath: null,
  textColor: '#ffffff',
  fontWeight: 800,
  fontSize: 5,
  fontFamily: 'Arial, sans-serif',
  italic: false,
  underline: false,
  strikethrough: false,
  transform: 'none',
  lineSpacing: 1.2,
  volume: 1,
  fadeDuration: 0.5,
  videoFit: 'cover',
  x: 50,
  y: 50,
  width: 60,
  height: 30,
};

export default function AudienceView() {
  const [slide, setSlide] = useState(DEFAULT_STATE);
  const [videoPath, setVideoPath] = useState(null);
  const [overlayPath, setOverlayPath] = useState(null);
  const [hovered, setHovered] = useState(false);
  const [underscan, setUnderscan] = useState(() => {
    try { return JSON.parse(localStorage.getItem('ef_screen_assignments') || '{}').underscan ?? 0; }
    catch { return 0; }
  });

  const rootRef     = useRef(null);
  const captureRef  = useRef(null); // hidden canvas
  const ndiLoopRef  = useRef(null);
  const ndiActiveRef = useRef(false);

  // Start NDI capture loop if NDI is live for this role
  const startNdiLoop = useCallback(() => {
    if (ndiActiveRef.current) return;
    ndiActiveRef.current = true;

    const canvas = document.createElement('canvas');
    captureRef.current = canvas;
    const ctx = canvas.getContext('2d');

    const loop = async () => {
      if (!ndiActiveRef.current) return;
      try {
        const w = window.innerWidth;
        const h = window.innerHeight;
        if (canvas.width !== w || canvas.height !== h) {
          canvas.width = w;
          canvas.height = h;
        }
        // Draw all video elements into the canvas as a proxy frame
        // (full DOM capture isn't possible in WebView; we composite video + bg colour)
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);
        const videos = document.querySelectorAll('video');
        videos.forEach(v => {
          if (v.readyState >= 2) {
            ctx.drawImage(v, 0, 0, w, h);
          }
        });
        // Overlay text
        const textEl = rootRef.current?.querySelector('[data-ndi-text]');
        if (textEl && slide.text) {
          const rect = textEl.getBoundingClientRect();
          ctx.font = `${slide.fontWeight || 800} ${Math.round(w * (slide.fontSize || 5) / 100)}px ${slide.fontFamily || 'Arial'}`;
          ctx.fillStyle = slide.textColor || '#fff';
          ctx.textAlign  = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(slide.text, w / 2, h / 2);
        }

        const b64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
        await invoke('ndi_send_frame', {
          role: 'audience', pixelsB64: b64, width: w, height: h,
        }).catch(() => {});
      } catch {}
      ndiLoopRef.current = setTimeout(loop, 1000 / 30);
    };
    loop();
  }, [slide]);

  const stopNdiLoop = useCallback(() => {
    ndiActiveRef.current = false;
    if (ndiLoopRef.current) clearTimeout(ndiLoopRef.current);
  }, []);

  // Check if NDI is active for audience role and start/stop accordingly
  useEffect(() => {
    const check = async () => {
      try {
        const status = await invoke('ndi_status');
        if (status.audience && !ndiActiveRef.current) startNdiLoop();
        else if (!status.audience && ndiActiveRef.current) stopNdiLoop();
      } catch {}
    };
    check();
    const id = setInterval(check, 2000);
    return () => { clearInterval(id); stopNdiLoop(); };
  }, [startNdiLoop, stopNdiLoop]);

  useEffect(() => {
    const unlistenUpdate = listen('audience-update', (event) => {
      const { videoPath: vp, overlayPath: op, ...rest } = event.payload;
      setVideoPath(prev => (vp !== prev ? vp : prev));
      setOverlayPath(prev => (op !== prev ? op : prev));
      setSlide(prev => ({ ...DEFAULT_STATE, ...prev, ...rest }));
    });
    const unlistenSeek = listen('audience-seek', (event) => {
      // Seek the background video to match the preview
      const videos = document.querySelectorAll('video');
      videos.forEach(v => {
        if (!v.muted || v.readyState >= 2) {
          try { v.currentTime = event.payload.time; } catch {}
        }
      });
    });
    const unlistenClear = listen('audience-clear', () => {
      setSlide(DEFAULT_STATE);
      setVideoPath(null);
      setOverlayPath(null);
    });
    const unlistenUnderscan = listen('apply-underscan', (e) => {
      setUnderscan(e.payload?.value ?? 0);
    });
    return () => {
      unlistenUpdate.then(f => f());
      unlistenSeek.then(f => f());
      unlistenClear.then(f => f());
      unlistenUnderscan.then(f => f());
    };
  }, []);

  const handleClose = async () => {
    try {
      await getCurrentWindow().close();
    } catch (e) {
      console.error('Could not close window:', e);
    }
  };

  // Only convert if it's a raw filesystem path — not already an asset:// URL
  const toSrc = (val) => {
    if (!val) return null;
    if (val.startsWith('asset://') || val.startsWith('https://asset.localhost') || val.startsWith('blob:') || val.startsWith('http')) return val;
    return convertFileSrc(val);
  };
  const videoSrc   = toSrc(videoPath);
  const overlaySrc = toSrc(overlayPath);

  const textDecoration = [
    slide.underline     && 'underline',
    slide.strikethrough && 'line-through',
  ].filter(Boolean).join(' ') || 'none';

  return (
    <>
    <style>{`
      @keyframes ef-fade-in {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
    `}</style>
    <div
      ref={rootRef}
      style={{
        width: '100vw', height: '100vh',
        background: '#000', overflow: 'hidden',
        position: 'relative', containerType: 'inline-size',
        cursor: hovered ? 'default' : 'none',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseMove={() => setHovered(true)}
    >
      {/* Underscan wrapper — scales content away from edges */}
      <div style={{
        position: 'absolute',
        inset: 0,
        transform: underscan > 0 ? `scale(${1 - underscan / 100})` : undefined,
        transformOrigin: 'center center',
      }}>

      {/* ── Background video / image ── */}
      {videoSrc && (
        <video
          key={videoSrc}
          src={videoSrc}
          autoPlay loop playsInline
          muted  // Audio plays from main window to avoid doubling across multiple audience windows
          ref={el => { if (el) el.volume = 0; }}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: slide.videoFit || 'cover', zIndex: 1,
            animation: `ef-fade-in ${slide.fadeDuration ?? 0.5}s ease forwards`,
          }}
        />
      )}

      {/* ── Text layer ── */}
      <div style={{
        position: 'absolute',
        left:   `${slide.x}%`,
        top:    `${slide.y}%`,
        width:  `${slide.width}%`,
        height: `${slide.height}%`,
        transform: 'translate(-50%, -50%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', whiteSpace: 'pre-wrap',
        zIndex: 10, pointerEvents: 'none',
        color:         slide.textColor,
        fontWeight:    slide.fontWeight,
        fontSize:      `${slide.fontSize}cqw`,
        fontFamily:    slide.fontFamily,
        fontStyle:     slide.italic ? 'italic' : 'normal',
        textTransform: slide.transform,
        lineHeight:    slide.lineSpacing ?? 1.2,
        textDecoration,
        textShadow: '0 2px 20px rgba(0,0,0,0.9)',
      }}>
        {slide.text}
      </div>

      {/* ── Overlay video ── */}
      {overlaySrc && (
        <video
          src={overlaySrc}
          autoPlay loop muted playsInline
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover', zIndex: 5, pointerEvents: 'none',
          }}
        />
      )}

      </div>{/* end underscan wrapper */}

      {/* ── Close button — outside underscan so it stays at screen edge ── */}
      <button
        onClick={handleClose}
        title="Close output window"
        style={{
          position: 'absolute', bottom: '20px', left: '20px', zIndex: 100,
          width: '36px', height: '36px', borderRadius: '50%',
          background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(255,255,255,0.15)',
          color: '#ff4d4d', fontSize: '20px', lineHeight: 1, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: hovered ? 1 : 0,
          transform: hovered ? 'scale(1)' : 'scale(0.7)',
          transition: 'opacity 0.2s ease, transform 0.2s ease',
          backdropFilter: 'blur(8px)',
          pointerEvents: hovered ? 'all' : 'none',
        }}
      >×</button>

    </div>
    </>
  );
}