/**
 * TrailerVideo.jsx
 * Full-screen trailer video shown once after splash screen.
 * Auto-dismissed when video ends or user clicks Skip.
 * Video file: public/elevateflow-trailer.mp4
 */
import React, { useRef, useEffect, useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { appLocalDataDir } from '@tauri-apps/api/path';

export default function TrailerVideo({ onDone }) {
  const videoRef  = useRef(null);
  const [visible, setVisible] = useState(false);
  const [showSkip, setShowSkip] = useState(false);

  useEffect(() => {
    // Fade in
    requestAnimationFrame(() => setVisible(true));
    // Show skip button after 2s
    const t = setTimeout(() => setShowSkip(true), 2000);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    setVisible(false);
    setTimeout(onDone, 400);
  };

  // Video src — served from public/
  const src = '/elevateflow-trailer.mp4';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99998,
      background: '#000',
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.4s ease',
    }}>
      <video
        ref={videoRef}
        src={src}
        autoPlay
        playsInline
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        onEnded={dismiss}
        onError={dismiss}
      />

      {/* Skip button */}
      {showSkip && (
        <button onClick={dismiss} style={{
          position: 'absolute', bottom: 36, right: 36,
          padding: '10px 20px', borderRadius: 24,
          background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,0.15)',
          color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 600,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          transition: 'all 0.15s',
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Arial, sans-serif',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.75)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.5)'; e.currentTarget.style.color = 'rgba(255,255,255,0.8)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
        >
          Skip
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polygon points="5,3 19,12 5,21"/><line x1="19" y1="3" x2="19" y2="21"/>
          </svg>
        </button>
      )}
    </div>
  );
}