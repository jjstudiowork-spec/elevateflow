/**
 * CloseConfirmWindow.jsx
 * Rendered in its own small Tauri window when user tries to close the app.
 * Confirming calls confirm_close which destroys all windows.
 */
import React from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import './styles/splash.css';
import './styles/toolbar-output-buttons.css';

export default function CloseConfirmWindow() {
  const handleYes = async () => {
    await invoke('confirm_close');
  };

  const handleCancel = async () => {
    await getCurrentWindow().close();
  };

  return (
    <div className="transparent-window">
      <div className="close-win-backdrop">
        <div className="close-win">
        <div className="close-win__icon">
          <svg viewBox="0 0 24 24" width="30" height="30" fill="none"
            stroke="#D4AF37" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </div>
        <div className="close-win__title">Close ElevateFlow?</div>
        <div className="close-win__body">
          Are you sure? All open windows will be closed.
        </div>
        <div className="close-win__actions">
          <button className="close-win__btn close-win__btn--cancel" onClick={handleCancel}>
            Cancel
          </button>
          <button className="close-win__btn close-win__btn--yes" onClick={handleYes}>
            Yes, Close
          </button>
        </div>
      </div>
    </div>
    </div>
  );
}