/**
 * AboutWindow.jsx
 * Shown when user clicks "About ElevateFlow" in the menu.
 */
import React from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import logo from '../src-tauri/icons/icon-512.png';
import './styles/splash.css';
import './styles/toolbar-output-buttons.css';

export default function AboutWindow() {
  return (
    <div className="transparent-window">
      <div className="about-win">
      <button className="about-win__close" onClick={() => getCurrentWindow().close()}>✕</button>

      <img src={logo} className="about-win__logo" alt="ElevateFlow" draggable={false} />

      <div className="about-win__name">
        ELEVATE<span className="about-win__accent">FLOW</span>
      </div>

      <div className="about-win__version">Version 1.0.0</div>
      <div className="about-win__tagline">Worship Presentation Software</div>

      <div className="about-win__divider" />

      <div className="about-win__details">
        <div className="about-win__row">
          <span className="about-win__label">Built with</span>
          <span className="about-win__value">Tauri v2 + React</span>
        </div>
        <div className="about-win__row">
          <span className="about-win__label">Developer</span>
          <span className="about-win__value">KFST</span>
        </div>
        <div className="about-win__row">
          <span className="about-win__label">Platform</span>
          <span className="about-win__value">macOS</span>
        </div>
      </div>

      <div className="about-win__copyright">© 2025 KFST. All rights reserved.</div>
    </div>
    </div>
  );
}