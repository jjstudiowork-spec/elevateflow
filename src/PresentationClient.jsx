/**
 * PresentationClient.jsx
 * What the client computer sees when connected to a host.
 * Left: full live preview of what host is sending.
 * Right: right panel controls (clear, stage, volume).
 */
import React, { useRef } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import RightPanel from './components/RightPanel';

function LivePreview({ slide, videoPath, overlayPath }) {
  const toSrc = (val) => {
    if (!val) return null;
    if (val.startsWith('asset://') || val.startsWith('blob:') || val.startsWith('http')) return val;
    try { return convertFileSrc(val); } catch { return null; }
  };

  const videoSrc   = toSrc(videoPath);
  const overlaySrc = toSrc(overlayPath);
  const isImage    = videoPath?.match(/\.(png|jpg|jpeg|gif|webp|bmp)$/i);

  return (
    <div style={{
      flex: 1, background: '#000', position: 'relative',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden', containerType: 'inline-size',
    }}>
      {/* Background media */}
      {videoSrc && (isImage
        ? <img src={videoSrc} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        : <video src={videoSrc} autoPlay loop muted playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      )}

      {/* Overlay */}
      {overlaySrc && (
        <video src={overlaySrc} autoPlay loop muted playsInline
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 2, pointerEvents: 'none' }} />
      )}

      {/* Text */}
      {slide?.text && (
        <div style={{
          position: 'absolute', zIndex: 10,
          left: `${slide.x ?? 50}%`, top: `${slide.y ?? 50}%`,
          width: `${slide.width ?? 60}%`, height: `${slide.height ?? 30}%`,
          transform: 'translate(-50%, -50%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          textAlign: 'center', whiteSpace: 'pre-wrap', pointerEvents: 'none',
          color: slide.textColor || '#fff',
          fontWeight: slide.fontWeight || 800,
          fontSize: `${slide.fontSize || 5}cqw`,
          fontFamily: slide.fontFamily || 'Arial, sans-serif',
          fontStyle: slide.italic ? 'italic' : 'normal',
          textTransform: slide.transform || 'none',
          lineHeight: slide.lineSpacing ?? 1.2,
          textDecoration: [slide.underline && 'underline', slide.strikethrough && 'line-through'].filter(Boolean).join(' ') || 'none',
        }}>
          {slide.text}
        </div>
      )}

      {/* Empty state */}
      {!slide?.text && !videoSrc && (
        <div style={{ color: 'rgba(255,255,255,0.08)', fontSize: '2cqw', fontWeight: 800, letterSpacing: 4, userSelect: 'none' }}>
          WAITING FOR HOST
        </div>
      )}

      {/* Connected badge */}
      <div style={{
        position: 'absolute', top: 16, right: 16, zIndex: 20,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
        border: '1px solid rgba(0,232,122,0.3)', borderRadius: 8,
        padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 6,
        fontSize: 10, fontWeight: 800, color: '#00e87a', letterSpacing: 1,
        fontFamily: '-apple-system, sans-serif',
      }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00e87a', boxShadow: '0 0 6px #00e87a' }} />
        CONNECTED TO HOST
      </div>
    </div>
  );
}

export default function PresentationClient({
  state, dispatch,
  videoRef, audioRef,
  togglePlay, skipTime, formatTime,
  handleVideoTimeUpdate, handleAudioTimeUpdate,
  onClearAll, onDisconnect,
}) {
  const { remoteSlide, remoteVideo, remoteOverlay } = state;

  return (
    <div style={{
      display: 'flex', height: '100%', overflow: 'hidden',
      background: '#000',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Arial, sans-serif',
    }}>

      {/* ── Left: Live preview ── */}
      <LivePreview
        slide={remoteSlide}
        videoPath={remoteVideo}
        overlayPath={remoteOverlay}
      />

      {/* ── Right: Controls panel ── */}
      <div style={{
        width: 300, flexShrink: 0,
        borderLeft: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', flexDirection: 'column', background: '#0c0c0f',
        overflow: 'hidden',
      }}>

        {/* Client header */}
        <div style={{
          padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(0,232,122,0.04)',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.5, color: '#00e87a', marginBottom: 2 }}>
              PRESENTATION CLIENT
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
              {state.presentationHostAddress || 'Connected'}
            </div>
          </div>
          <button onClick={onDisconnect} style={{
            height: 26, padding: '0 10px', borderRadius: 6,
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            color: '#f87171', fontSize: 10, fontWeight: 700, cursor: 'pointer',
          }}>Disconnect</button>
        </div>

        {/* Right panel — stage/preview controls */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <RightPanel
            state={state} dispatch={dispatch}
            selectedSlide={remoteSlide}
            nextSlide={null}
            videoRef={videoRef} audioRef={audioRef}
            togglePlay={togglePlay} skipTime={skipTime} formatTime={formatTime}
            onClearAll={onClearAll}
            handleVideoTimeUpdate={handleVideoTimeUpdate}
            handleAudioTimeUpdate={handleAudioTimeUpdate}
          />
        </div>
      </div>
    </div>
  );
}