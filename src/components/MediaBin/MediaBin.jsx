/**
 * MediaBin.jsx — Revamped ProPresenter-style media bin
 * Left: playlist sidebar | Right: media grid | Bottom: transport bar with fade
 */
import React, { useRef, useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { convertFileSrc } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import './MediaBin.css';
import { startDrag, registerDropZone, unregisterDropZone } from '../../utils/dragSystem';

const PLAYLISTS_KEY = 'ef_media_playlists';

function loadPlaylists() {
  try { return JSON.parse(localStorage.getItem(PLAYLISTS_KEY) || '[]'); }
  catch { return []; }
}
function savePlaylists(pl) {
  localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(pl));
}

// ── Context Menu ───────────────────────────────────────────────
function ContextMenu({ menu, onCut, onCopy, onPaste, onDelete, onInspect, hasPaste }) {
  if (!menu) return null;
  return ReactDOM.createPortal(
    <div className="media-context-menu" style={{ top: menu.y, left: menu.x }}
      onMouseDown={e => e.stopPropagation()}>
      <CMenuItem label="Cut"       shortcut="⌘X" onClick={onCut} />
      <CMenuItem label="Copy"      shortcut="⌘C" onClick={onCopy} />
      <CMenuItem label="Paste"     shortcut="⌘V" onClick={onPaste} disabled={!hasPaste} />
      <div className="media-context-menu__divider" />
      <CMenuItem label="Delete"    shortcut="⌫"  onClick={onDelete} danger />
      <div className="media-context-menu__divider" />
      <CMenuItem label="Inspector" onClick={onInspect} />
    </div>,
    document.body
  );
}
function CMenuItem({ label, shortcut, onClick, disabled, danger }) {
  return (
    <div className={`media-context-menu__item ${disabled ? 'media-context-menu__item--disabled' : ''} ${danger ? 'media-context-menu__item--danger' : ''}`}
      onClick={disabled ? undefined : onClick}>
      <span>{label}</span>
      {shortcut && <span className="media-context-menu__shortcut">{shortcut}</span>}
    </div>
  );
}

// ── Media Card ─────────────────────────────────────────────────
function MediaCard({ file, isActive, onClick, onContextMenu }) {
  const isVideo = file.type === 'video' || file.type === 'background';
  const isImage = file.type === 'image';
  const displaySrc = file.src || (file.url ? convertFileSrc(file.url) : null);
  const rawPath = file.path || file.url || '';

  const handleMouseDown = (e) => {
    if (e.button !== 0) return;
    // No preventDefault — allows clicks to still work for selection
    // dragSystem threshold (5px) prevents accidental drags on click
    const label = file.name || (isVideo ? 'Video' : isImage ? 'Image' : 'Media');
    startDrag('media-file', { src: displaySrc || rawPath, path: rawPath, ...file }, `▶ ${label}`);
  };

  return (
    <div
      className={`mb-card ${isActive ? 'mb-card--active' : ''}`}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseDown={handleMouseDown}
      title={file.name}
      style={{ cursor: 'grab' }}
    >
      <div className="mb-card__thumb">
        {isVideo && displaySrc && (
          <video src={displaySrc} className="mb-card__preview" muted loop playsInline
            onMouseEnter={e => e.target.play()}
            onMouseLeave={e => { e.target.pause(); e.target.currentTime = 0; }}
          />
        )}
        {isImage && displaySrc && (
          <img src={displaySrc} className="mb-card__preview" alt={file.name} loading="lazy" />
        )}
        {!isVideo && !isImage && (
          <div className="mb-card__icon">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#555" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>
            </svg>
          </div>
        )}
        {isActive && <div className="mb-card__live-dot" />}
      </div>
      <span className="mb-card__name">{file.name}</span>
    </div>
  );
}

// ── Playlist sidebar item ──────────────────────────────────────
function PlaylistItem({ pl, selected, onClick, onRename, onDelete, onDropFile }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(pl.name);
  const inputRef = useRef(null);
  const ref = useRef(null);
  const handlerRef = useRef(null);
  handlerRef.current = onDropFile;

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  useEffect(() => {
    const el = ref.current;
    if (!el || pl.id === 'all') return;
    registerDropZone(el, (type, data) => {
      if (type === 'media-file') handlerRef.current?.(data, pl.id);
    });
    return () => unregisterDropZone(el);
  }, [pl.id]);

  const commit = () => {
    setEditing(false);
    if (val.trim()) onRename(val.trim());
    else setVal(pl.name);
  };

  return (
    <div
      ref={ref}
      className={`mb-playlist-item ${selected ? 'mb-playlist-item--active' : ''}`}
      onClick={onClick}
      onDoubleClick={() => setEditing(true)}
    >
      <PlaylistIcon />
      {editing ? (
        <input ref={inputRef} className="mb-playlist-input"
          value={val} onChange={e => setVal(e.target.value)}
          onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setEditing(false); setVal(pl.name); } }}
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <span className="mb-playlist-name">{pl.name}</span>
      )}
      <button className="mb-playlist-del" onClick={e => { e.stopPropagation(); onDelete(); }} title="Delete playlist">×</button>
    </div>
  );
}

// ── Main MediaBin ──────────────────────────────────────────────
export default function MediaBin({ state, dispatch, onMediaClick, onImportMedia, onDragStart, liveVideo, activeOverlay }) {
  const { mediaFiles, audioFiles } = state;

  // Playlists stored in localStorage (separate from song playlists)
  const [playlists,       setPlaylists]       = useState(() => {
    const saved = loadPlaylists();
    if (saved.length === 0) {
      const def = [{ id: 'all', name: 'All Media' }];
      savePlaylists(def);
      return def;
    }
    return saved;
  });
  const [selectedPl,      setSelectedPl]      = useState('all');
  const [contextMenu,     setContextMenu]      = useState(null);
  const [mediaClipboard,  setMediaClipboard]   = useState(null);
  const [inspectorFile,   setInspectorFile]    = useState(null);
  const [showFader,       setShowFader]        = useState(false);
  const [fadeDuration,    setFadeDuration]     = useState(0.5); // seconds

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const h = () => setContextMenu(null);
    window.addEventListener('mousedown', h);
    return () => window.removeEventListener('mousedown', h);
  }, [contextMenu]);

  // Persist playlists
  useEffect(() => { savePlaylists(playlists); }, [playlists]);

  // Emit fade duration to audience window whenever it changes
  useEffect(() => {
    dispatch({ type: 'SET_FADE_DURATION', payload: fadeDuration });
  }, [fadeDuration, dispatch]);

  const allFiles = mediaFiles; // audio lives in the right panel audio bin, not here

  // Filter by selected playlist
  const visibleFiles = selectedPl === 'all'
    ? allFiles
    : allFiles.filter(f => f.playlistId === selectedPl);

  // Add new playlist
  const addPlaylist = () => {
    const id = `pl-${Date.now()}`;
    const newPl = { id, name: `Playlist ${playlists.length}` };
    setPlaylists(p => [...p, newPl]);
    setSelectedPl(id);
  };

  const renamePlaylist = (id, name) => {
    setPlaylists(p => p.map(pl => pl.id === id ? { ...pl, name } : pl));
  };

  const deletePlaylist = (id) => {
    if (id === 'all') return;
    setPlaylists(p => p.filter(pl => pl.id !== id));
    if (selectedPl === id) setSelectedPl('all');
  };

  // Import media from computer
  const handleImport = useCallback(async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [{ name: 'Media', extensions: ['mp4','mov','avi','mkv','webm','m4v','png','jpg','jpeg','gif','webp','mp3','wav','aac','flac','m4a'] }],
      });
      if (!selected) return;
      const paths = Array.isArray(selected) ? selected : [selected];
      paths.forEach(rawPath => {
        const ext = rawPath.split('.').pop().toLowerCase();
        const isAudio = ['mp3','wav','aac','flac','m4a','ogg'].includes(ext);
        const isVideo = ['mp4','mov','avi','mkv','webm','m4v'].includes(ext);
        const type = isAudio ? 'audio' : isVideo ? 'video' : 'image';
        const file = {
          id: Date.now() + Math.random(),
          name: rawPath.split(/[\\/]/).pop().replace(/\.[^.]+$/, ''),
          path: rawPath,
          src: convertFileSrc(rawPath),
          type,
          playlistId: selectedPl === 'all' ? null : selectedPl,
        };
        if (isAudio) dispatch({ type: 'ADD_AUDIO_FILE', payload: file });
        else         dispatch({ type: 'ADD_MEDIA_FILE', payload: file });
      });
    } catch (err) { console.error('[MediaBin] Import error:', err); }
  }, [selectedPl, dispatch]);

  // Context menu handlers
  const handleContextMenu = useCallback((e, file) => {
    e.preventDefault(); e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, file });
  }, []);

  const handleCopy  = () => { if (contextMenu) { setMediaClipboard({ file: contextMenu.file, mode: 'copy' }); setContextMenu(null); } };
  const handleCut   = () => { if (contextMenu) { setMediaClipboard({ file: contextMenu.file, mode: 'cut' });  setContextMenu(null); } };
  const handlePaste = () => {
    if (!mediaClipboard) return;
    const newFile = { ...mediaClipboard.file, id: Date.now() + Math.random(), name: mediaClipboard.mode === 'copy' ? `${mediaClipboard.file.name} copy` : mediaClipboard.file.name };
    dispatch({ type: 'ADD_MEDIA_FILE', payload: newFile });
    if (mediaClipboard.mode === 'cut') { dispatch({ type: 'DELETE_MEDIA_FILE', payload: mediaClipboard.file.id }); setMediaClipboard(null); }
    setContextMenu(null);
  };
  const handleDelete = () => {
    if (!contextMenu) return;
    dispatch({ type: 'DELETE_MEDIA_FILE', payload: contextMenu.file.id });
    setContextMenu(null);
  };
  const handleInspect = () => {
    if (!contextMenu) return;
    localStorage.setItem('ef_inspector_file', JSON.stringify(contextMenu.file));
    import('@tauri-apps/api/core').then(({ invoke }) => invoke('open_media_inspector').catch(() => {}));
    setContextMenu(null);
  };

  const handleUpdateFile = (id, updates) => {
    dispatch({ type: 'UPDATE_MEDIA_FILE', payload: { id, ...updates } });
  };

  return (
    <div className="mb-root" onMouseDown={() => setContextMenu(null)}>

      {/* ── LEFT: Playlist sidebar ── */}
      <div className="mb-sidebar">
        <div className="mb-sidebar__header">
          <span className="mb-sidebar__title">MEDIA</span>
          <button className="mb-sidebar__add" onClick={addPlaylist} title="New playlist">+</button>
        </div>

        <div className="mb-sidebar__list">
          {playlists.map(pl => (
            <PlaylistItem key={pl.id} pl={pl}
              selected={selectedPl === pl.id}
              onClick={() => setSelectedPl(pl.id)}
              onRename={name => renamePlaylist(pl.id, name)}
              onDelete={() => deletePlaylist(pl.id)}
              onDropFile={(file, targetPlaylistId) => {
                // Safely update just the one file's playlistId
                if (file.type === 'audio') {
                  dispatch({ type: 'UPDATE_AUDIO_FILE', payload: { id: file.id, playlistId: targetPlaylistId } });
                } else {
                  dispatch({ type: 'UPDATE_MEDIA_FILE', payload: { id: file.id, playlistId: targetPlaylistId } });
                }
              }}
            />
          ))}
        </div>
      </div>

      {/* ── RIGHT: Grid + bottom bar ── */}
      <div className="mb-right">

        {/* Grid */}
        <div className="mb-grid" onDragOver={e => e.preventDefault()}>
          {visibleFiles.length === 0 ? (
            <div className="mb-empty">
              <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#222" strokeWidth="1">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <path d="M12 8v8M8 12h8"/>
              </svg>
              <span>Drop media here or click Import</span>
            </div>
          ) : (
            visibleFiles.map(file => (
              <MediaCard key={file.id} file={file}
                isActive={liveVideo === (file.src || file.url) || activeOverlay === (file.src || file.url)}
                onClick={() => onMediaClick(file)}
                onContextMenu={e => handleContextMenu(e, file)}
              />
            ))
          )}
        </div>

        {/* ── Bottom transport bar ── */}
        <div className="mb-bar">
          {/* Import */}
          <button className="mb-bar__btn" onClick={handleImport} title="Import media">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>

          <div className="mb-bar__divider" />

          {/* Fade toggle button — purple when active */}
          <button
            className={`mb-bar__btn mb-bar__fade-btn ${showFader ? 'mb-bar__fade-btn--active' : ''}`}
            onClick={() => setShowFader(p => !p)}
            title="Fade duration"
          >
            <FadeIcon />
          </button>

          {/* Fade fader — slides out when active */}
          {showFader && (
            <div className="mb-bar__fader-wrap">
              <span className="mb-bar__fader-label">{fadeDuration.toFixed(1)}s</span>
              <input
                type="range" min="0" max="5" step="0.1"
                value={fadeDuration}
                onChange={e => setFadeDuration(parseFloat(e.target.value))}
                className="mb-bar__fader"
              />
            </div>
          )}

          <div style={{ flex: 1 }} />

          {/* File count */}
          <span className="mb-bar__count">{visibleFiles.length} item{visibleFiles.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Context menu */}
      <ContextMenu
        menu={contextMenu}
        onCut={handleCut} onCopy={handleCopy} onPaste={handlePaste}
        onDelete={handleDelete} onInspect={handleInspect}
        hasPaste={!!mediaClipboard}
      />
    </div>
  );
}

function PlaylistIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <path d="M14 4h7M14 8h5M14 15h7M14 19h5"/>
    </svg>
  );
}

function FadeIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <rect x="2" y="3" width="5" height="18" rx="1" opacity="0.3"/>
      <rect x="9.5" y="3" width="5" height="18" rx="1" opacity="0.65"/>
      <rect x="17" y="3" width="5" height="18" rx="1"/>
    </svg>
  );
}