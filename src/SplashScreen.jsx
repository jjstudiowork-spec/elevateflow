/**
 * SplashScreen.jsx
 * Separate splash window — bigger, rounded, animated loading steps.
 */
import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import logo from '../src-tauri/icons/icon-512.png';
import './styles/splash.css';

const STEPS = [
  'Initialising workspace…',
  'Loading libraries…',
  'Preparing media engine…',
  'Restoring your songs…',
  'Ready',
];

export default function SplashScreen() {
  const [phase,       setPhase]       = useState('entering');
  const [stepIndex,   setStepIndex]   = useState(0);
  const [barWidth,    setBarWidth]    = useState(0);

  useEffect(() => {
    // Fade in
    const t0 = setTimeout(() => setPhase('visible'), 200);

    // Step through loading messages
    const stepDuration = 340; // ms per step
    const stepTimers = STEPS.map((_, i) =>
      setTimeout(() => {
        setStepIndex(i);
        setBarWidth(Math.round(((i + 1) / STEPS.length) * 100));
      }, 300 + i * stepDuration)
    );

    // Fade out and finish
    const total = 300 + STEPS.length * stepDuration + 300;
    const tOut  = setTimeout(() => setPhase('exiting'),  total);
    const tDone = setTimeout(() => invoke('finish_splash').catch(console.error), total + 500);

    return () => {
      clearTimeout(t0);
      stepTimers.forEach(clearTimeout);
      clearTimeout(tOut);
      clearTimeout(tDone);
    };
  }, []);

  return (
    <div className="transparent-window">
    <div className={`splash splash--${phase}`}>

      {/* Ambient glow */}
      <div className="splash__glow" />
      <div className="splash__glow splash__glow--2" />

      {/* Top section — logo + wordmark */}
      <div className="splash__top">
        <div className="splash__logo-wrap">
          <img src={logo} className="splash__logo-img" alt="ElevateFlow" draggable={false} />
          <div className="splash__logo-ring" />
        </div>

        <div className="splash__wordmark">
          ELEVATE<span className="splash__wordmark-accent">FLOW</span>
        </div>
        <div className="splash__tagline">Worship Presentation Software</div>
      </div>

      {/* Bottom section — loading bar + step text */}
      <div className="splash__bottom">
        <div className="splash__step-text">{STEPS[stepIndex]}</div>

        <div className="splash__bar-track">
          <div
            className="splash__bar-fill"
            style={{ width: `${barWidth}%` }}
          />
        </div>

        <div className="splash__version">v1.0.0</div>
      </div>

    </div>
    </div>
  );
}