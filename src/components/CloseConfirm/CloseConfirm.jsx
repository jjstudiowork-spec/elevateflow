/**
 * CloseConfirm.jsx
 * Modal shown when the user tries to close the app.
 * Listens for the 'confirm-close' event emitted from lib.rs.
 */
import React, { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';

export default function CloseConfirm() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const unlisten = listen('confirm-close', () => setVisible(true));
    return () => { unlisten.then(f => f()); };
  }, []);

  const handleYes = async () => {
    setVisible(false);
    await getCurrentWindow().destroy();
  };

  const handleCancel = () => setVisible(false);

  if (!visible) return null;

  return (
    <div className="close-confirm-backdrop" onClick={handleCancel}>
      <div className="close-confirm" onClick={e => e.stopPropagation()}>

        <div className="close-confirm__icon">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none"
            stroke="#D4AF37" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </div>

        <div className="close-confirm__title">Close ElevateFlow?</div>
        <div className="close-confirm__body">
          Are you sure you want to close ElevateFlow?<br/>
          Any unsaved changes will be lost.
        </div>

        <div className="close-confirm__actions">
          <button className="close-confirm__btn close-confirm__btn--cancel" onClick={handleCancel}>
            Cancel
          </button>
          <button className="close-confirm__btn close-confirm__btn--yes" onClick={handleYes}>
            Yes, Close
          </button>
        </div>

      </div>
    </div>
  );
}