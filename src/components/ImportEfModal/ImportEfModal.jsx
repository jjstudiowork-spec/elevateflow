/**
 * ImportEfModal.jsx
 * Shown after parsing a .ef file.
 * User chooses which library or playlist to import the song into.
 */
import React, { useState } from 'react';

export default function ImportEfModal({ song, libraries, playlists, onConfirm, onCancel }) {
  const [destType, setDestType] = useState('library');
  const [destId,   setDestId]   = useState(libraries[0]?.id || '');

  const destinations = destType === 'library' ? libraries : playlists;

  const handleConfirm = () => {
    if (!destId) return;
    onConfirm({
      song,
      destType,
      destId,
    });
  };

  return (
    <div className="ef-modal-backdrop" onClick={onCancel}>
      <div className="ef-modal" onClick={e => e.stopPropagation()}>

        <div className="ef-modal__header">
          <span className="ef-modal__title">Import Song</span>
          <button className="ef-modal__close" onClick={onCancel}>✕</button>
        </div>

        <div className="ef-modal__body">
          <div className="ef-modal__song-name">
            <span className="ef-modal__song-icon">♪</span>
            {song.title}
          </div>

          <div className="ef-modal__label">Import into</div>
          <div className="ef-modal__dest-tabs">
            <button
              className={`ef-modal__dest-tab ${destType === 'library' ? 'ef-modal__dest-tab--active' : ''}`}
              onClick={() => { setDestType('library'); setDestId(libraries[0]?.id || ''); }}
            >Library</button>
            <button
              className={`ef-modal__dest-tab ${destType === 'playlist' ? 'ef-modal__dest-tab--active' : ''}`}
              onClick={() => { setDestType('playlist'); setDestId(playlists[0]?.id || ''); }}
            >Playlist</button>
          </div>

          {destinations.length === 0 ? (
            <div className="ef-modal__empty">
              No {destType === 'library' ? 'libraries' : 'playlists'} found.<br/>
              Create one first in the sidebar.
            </div>
          ) : (
            <div className="ef-modal__dest-list">
              {destinations.map(d => (
                <div
                  key={d.id}
                  className={`ef-modal__dest-item ${destId === d.id ? 'ef-modal__dest-item--active' : ''}`}
                  onClick={() => setDestId(d.id)}
                >
                  {destType === 'library' ? '📚' : '🎵'} {d.title || d.name || 'Untitled'}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="ef-modal__footer">
          <button className="ef-modal__btn ef-modal__btn--cancel" onClick={onCancel}>Cancel</button>
          <button
            className="ef-modal__btn ef-modal__btn--confirm"
            onClick={handleConfirm}
            disabled={!destId || destinations.length === 0}
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
}