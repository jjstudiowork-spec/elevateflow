/**
 * Sidebar.jsx — Libraries / Playlists / Items with drag-drop between sections
 */
import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import QRCode from 'react-qr-code';
import { startDrag, registerDropZone, unregisterDropZone } from '../../utils/dragSystem';

function RenameInput({ value, onChange, onCommit }) {
  return (
    <input autoFocus className="sidebar__rename-input"
      value={value} onChange={e => onChange(e.target.value)}
      onBlur={onCommit} onKeyDown={e => e.key === 'Enter' && onCommit()}
    />
  );
}

function SidebarSection({ title, onAdd, addNode, children, defaultOpen = true, onDrop }) {
  const [open, setOpen] = useState(defaultOpen);
  const ref = useRef(null);
  const handlerRef = useRef(null);
  handlerRef.current = onDrop;

  useEffect(() => {
    const el = ref.current;
    if (!el || !onDrop) return;
    registerDropZone(el, (type, data) => handlerRef.current?.(type, data));
    return () => unregisterDropZone(el);
  }, []);

  return (
    <div ref={ref} className="sidebar__section">
      <div className="sidebar__section-header">
        <button className="sidebar__collapse-btn" onClick={() => setOpen(o => !o)} aria-expanded={open}>
          <ChevronIcon open={open} /><span>{title}</span>
        </button>
        {addNode || (onAdd && <button className="sidebar__add-btn" onClick={onAdd} title={`Add ${title}`}>+</button>)}
      </div>
      {open && <div className="sidebar__section-body">{children}</div>}
    </div>
  );
}

function SidebarItem({ id, label, active, editingId, editValue, onSelect, onStartRename, onChangeValue, onCommit, onMouseDown, onDrop, onContextMenu }) {
  const ref = useRef(null);
  const handlerRef = useRef(null);
  handlerRef.current = onDrop;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    registerDropZone(el, (type, data) => handlerRef.current?.(type, data));
    return () => unregisterDropZone(el);
  }, []); // register once

  return (
    <div
      ref={ref}
      className={`sidebar__item ${active ? 'sidebar__item--active' : ''}`}
      onClick={onSelect}
      onDoubleClick={onStartRename}
      onMouseDown={onMouseDown}
      onContextMenu={onContextMenu}
      style={onMouseDown ? { cursor: 'grab' } : undefined}
    >
      {editingId === id ? (
        <RenameInput value={editValue} onChange={onChangeValue} onCommit={onCommit} />
      ) : (
        <><span className="sidebar__item-label">{label}</span>{active && <ActiveDot />}</>
      )}
    </div>
  );
}

function SyncPanel({ state, dispatch }) {
  const [ip, setIp] = useState('');
  useEffect(() => { invoke('get_local_ip').then(setIp).catch(() => setIp('Check Network')); }, []);
  return (
    <div className="sync-panel premium-remote">
      <div className="sync-panel__header">
        <div className="sync-panel__title">REMOTE CONNECT<span className="sync-panel__dot sync-panel__dot--live" /></div>
        <button className="sync-panel__close" onClick={() => dispatch({ type: 'SET_SYNC_PANEL_VISIBLE', payload: false })}>×</button>
      </div>
      <div className="sync-panel__body remote-body">
        <div className="qr-container">
          {ip ? <QRCode value={ip} size={120} bgColor="transparent" fgColor="#D4AF37" level="H" />
               : <div className="qr-placeholder">Detecting IP...</div>}
        </div>
        <div className="remote-meta">
          <p className="remote-url">elevateflow.com/connect</p>
          <div className="ip-badge">{ip}</div>
        </div>
        <p className="remote-hint">Scan with phone to control slides</p>
      </div>
    </div>
  );
}

// ── Playlist Add Menu ──────────────────────────────────────────
function PlaylistAddMenu({ onAddSection }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    window.addEventListener('mousedown', h, true);
    return () => window.removeEventListener('mousedown', h, true);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="sidebar__add-btn" onClick={() => setOpen(o => !o)} title="Add to playlist">+</button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, zIndex: 9999, marginTop: 2,
          background: 'rgba(18,18,18,0.98)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 7, padding: 4, minWidth: 140,
          boxShadow: '0 12px 32px rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)',
        }}>
          <div
            onClick={() => { onAddSection(); setOpen(false); }}
            style={{
              padding: '7px 12px', borderRadius: 5, fontSize: 12, color: '#ccc',
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <span style={{ fontSize: 14 }}>§</span> Add Section
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sidebar Context Menu ───────────────────────────────────────
function SidebarContextMenu({ menu, onClose, onCut, onCopy, onPaste, onDelete }) {
  React.useEffect(() => {
    const h = (e) => { if (!e.target.closest('#sb-ctx-menu')) onClose(); };
    window.addEventListener('mousedown', h, true);
    return () => window.removeEventListener('mousedown', h, true);
  }, [onClose]);

  if (!menu) return null;

  const style = {
    position: 'fixed', top: menu.y, left: menu.x, zIndex: 99999,
    background: 'rgba(18,18,18,0.98)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, padding: 4, minWidth: 160,
    boxShadow: '0 16px 40px rgba(0,0,0,0.8)', backdropFilter: 'blur(16px)',
  };

  return (
    <div id="sb-ctx-menu" style={style} onContextMenu={e => e.preventDefault()}>
      <SbItem label="Cut"    onClick={() => { onCut?.();   onClose(); }} />
      <SbItem label="Copy"   onClick={() => { onCopy?.();  onClose(); }} />
      <SbItem label="Paste"  onClick={() => { onPaste?.(); onClose(); }} />
      <div style={{ height:1, background:'rgba(255,255,255,0.06)', margin:'3px 0' }}/>
      <SbItem label="Delete" onClick={() => { onDelete?.(); onClose(); }} danger />
    </div>
  );
}

function SbItem({ label, onClick, danger }) {
  const [hover, setHover] = React.useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '7px 14px', borderRadius: 5, fontSize: 12, cursor: 'pointer',
        color: danger ? '#ef4444' : '#ccc',
        background: hover ? 'rgba(255,255,255,0.07)' : 'transparent',
        transition: 'background 0.1s',
      }}
    >
      {label}
    </div>
  );
}

export default function Sidebar({ state, dispatch, startHosting, joinSession, endSession, displayedItems }) {
  const { libraries, playlists, librarySongs, activeSidebarId, activeSidebarType, activeItemId, editingId, editValue, isSyncPanelVisible } = state;
  const dragData = useRef(null);
  const [ctxMenu, setCtxMenu] = useState(null);
  const clipboard = React.useRef(null); // { type, item }

  const openCtx = (e, type, id, label) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, type, id, label });
  };

  const handleCut = () => {
    if (!ctxMenu) return;
    const item = ctxMenu.type === 'song'
      ? librarySongs.find(s => s.id === ctxMenu.id)
      : ctxMenu.type === 'lib'
      ? libraries.find(l => l.id === ctxMenu.id)
      : playlists.find(p => p.id === ctxMenu.id);
    clipboard.current = { type: ctxMenu.type, item };
    if (ctxMenu.type === 'song') dispatch({ type: 'DELETE_SONG', payload: ctxMenu.id });
    if (ctxMenu.type === 'lib')  dispatch({ type: 'DELETE_LIBRARY', payload: ctxMenu.id });
    if (ctxMenu.type === 'pl')   dispatch({ type: 'DELETE_PLAYLIST', payload: ctxMenu.id });
  };

  const handleCopy = () => {
    if (!ctxMenu) return;
    const item = ctxMenu.type === 'song'
      ? librarySongs.find(s => s.id === ctxMenu.id)
      : ctxMenu.type === 'lib'
      ? libraries.find(l => l.id === ctxMenu.id)
      : playlists.find(p => p.id === ctxMenu.id);
    clipboard.current = { type: ctxMenu.type, item };
  };

  const handlePaste = () => {
    if (!clipboard.current) return;
    const { type, item } = clipboard.current;
    const newId = Date.now().toString();
    if (type === 'song') dispatch({ type: 'ADD_SONG', payload: { ...item, id: newId, title: item.title + ' (copy)' } });
    if (type === 'lib')  dispatch({ type: 'ADD_LIBRARY', payload: { ...item, id: newId, title: item.title + ' (copy)' } });
    if (type === 'pl')   dispatch({ type: 'ADD_PLAYLIST', payload: { ...item, id: newId, title: (item.title || item.name) + ' (copy)', songIds: [...(item.songIds||[])] } });
  };

  const handleDelete = () => {
    if (!ctxMenu) return;
    if (!window.confirm(`Delete "${ctxMenu.label}"? This cannot be undone.`)) return;
    if (ctxMenu.type === 'song') dispatch({ type: 'DELETE_SONG', payload: ctxMenu.id });
    if (ctxMenu.type === 'lib')  dispatch({ type: 'DELETE_LIBRARY', payload: ctxMenu.id });
    if (ctxMenu.type === 'pl')   dispatch({ type: 'DELETE_PLAYLIST', payload: ctxMenu.id });
  };
  const send = (type, payload) => dispatch({ type, payload });
  const startRename = (id, value) => dispatch({ type: 'START_RENAME', payload: { id, value } });
  const changeValue = (v) => send('SET_EDIT_VALUE', v);

  const addLibrary = () => {
    const newId = Date.now();
    dispatch({ type: 'ADD_LIBRARY', payload: { id: newId, title: 'New Library' } });
    startRename(newId, 'New Library');
  };
  const addPlaylist = () => {
    const newId = Date.now();
    dispatch({ type: 'ADD_PLAYLIST', payload: { id: newId, title: 'New Playlist', songIds: [], sections: [] } });
    startRename(newId, 'New Playlist');
  };

  const addSectionToPlaylist = (playlistId) => {
    const section = { id: Date.now().toString(), title: 'New Section' };
    dispatch({ type: 'ADD_SECTION_TO_PLAYLIST', payload: { playlistId, section } });
  };

  const addSong = () => {
    const newId = Date.now().toString();
    const libId = activeSidebarType === 'lib' ? activeSidebarId : (libraries[0]?.id || 'lib1');
    dispatch({ type: 'ADD_SONG', payload: { id: newId, title: 'New Song', libId, slides: [] } });
    // If in a playlist, also add to that playlist
    if (activeSidebarType === 'pl' && activeSidebarId) {
      dispatch({ type: 'ADD_SONG_TO_PLAYLIST', payload: { songId: newId, playlistId: activeSidebarId } });
    }
    send('SET_ACTIVE_ITEM', newId);
    startRename(newId, 'New Song');
  };

  const handleSongMouseDown = (song) => (e) => {
    if (e.button !== 0) return;
    // Do NOT drag when this song is being renamed
    if (editingId === song.id) return;
    const fromType = activeSidebarType;
    const fromId   = activeSidebarId;
    startDrag('song', { songId: song.id, fromType, fromId }, `♪ ${song.title}`);
  };

  const handleDropOnLibrary = (lib) => (type, data) => {
    if (type !== 'song' || !data?.songId) return;
    dispatch({ type: 'MOVE_SONG_TO_LIB', payload: { songId: data.songId, libId: lib.id } });
    dispatch({ type: 'SET_ACTIVE_SIDEBAR', payload: { id: lib.id, type: 'lib' } });
  };

  const handleDropOnPlaylist = (pl) => (type, data) => {
    if (type !== 'song' || !data?.songId) return;
    dispatch({ type: 'ADD_SONG_TO_PLAYLIST', payload: { songId: data.songId, playlistId: pl.id } });
    dispatch({ type: 'SET_ACTIVE_SIDEBAR', payload: { id: pl.id, type: 'pl' } });
  };

  const handleDropOnItemsSection = (type, data) => {
    if (type !== 'song' || !data?.songId || data.fromType !== 'pl') return;
    dispatch({ type: 'REMOVE_SONG_FROM_PLAYLIST', payload: { songId: data.songId, playlistId: data.fromId } });
  };

  return (
    <aside className="sidebar">
      {isSyncPanelVisible && <SyncPanel state={state} dispatch={dispatch} />}

      {/* Top: Libraries + Playlists — scrollable */}
      <div className="sidebar__collections">
        <SidebarSection title="LIBRARY" onAdd={addLibrary}>
          {libraries.length === 0 && <p className="sidebar__empty">No libraries. Click + to add.</p>}
          {libraries.map(lib => (
            <SidebarItem key={lib.id} id={lib.id} label={lib.title}
              active={activeSidebarId === lib.id && activeSidebarType === 'lib'}
              editingId={editingId} editValue={editValue}
              onSelect={() => dispatch({ type: 'SET_ACTIVE_SIDEBAR', payload: { id: lib.id, type: 'lib' } })}
              onStartRename={() => startRename(lib.id, lib.title)}
              onChangeValue={changeValue}
              onCommit={() => dispatch({ type: 'SAVE_RENAME_LIB', payload: { id: lib.id, value: editValue } })}
              onDrop={handleDropOnLibrary(lib)}
              onContextMenu={e => openCtx(e, 'lib', lib.id, lib.title)}
            />
          ))}
        </SidebarSection>

        <SidebarSection title="PLAYLISTS" onAdd={addPlaylist}>
          {playlists.length === 0 && <p className="sidebar__empty">No playlists. Click + to add.</p>}
          {playlists.map(pl => (
            <SidebarItem key={pl.id} id={pl.id} label={pl.title || pl.name}
              active={activeSidebarId === pl.id && activeSidebarType === 'pl'}
              editingId={editingId} editValue={editValue}
              onSelect={() => dispatch({ type: 'SET_ACTIVE_SIDEBAR', payload: { id: pl.id, type: 'pl' } })}
              onStartRename={() => startRename(pl.id, pl.title || pl.name)}
              onChangeValue={changeValue}
              onCommit={() => dispatch({ type: 'SAVE_RENAME_PL', payload: { id: pl.id, value: editValue } })}
              onDrop={handleDropOnPlaylist(pl)}
              onContextMenu={e => openCtx(e, 'pl', pl.id, pl.title || pl.name)}
            />
          ))}
        </SidebarSection>
      </div>

      {/* Bottom: Songs — separate scrollable section */}
      <div className="sidebar__songs-panel">
        <SidebarSection
          title="SONGS"
          onAdd={activeSidebarType === 'lib' ? addSong : null}
          addNode={activeSidebarType === 'pl' && activeSidebarId
            ? <PlaylistAddMenu onAddSection={() => addSectionToPlaylist(activeSidebarId)} />
            : null
          }
          defaultOpen
          onDrop={activeSidebarType === 'pl' ? handleDropOnItemsSection : undefined}
        >
          {displayedItems.length === 0 && (
            <p className="sidebar__empty">{activeSidebarId ? 'Drag songs here from a library.' : 'Select a library or playlist.'}</p>
          )}
          {(() => {
            // In playlist view, interleave sections as dividers
            if (activeSidebarType !== 'pl' || !activeSidebarId) {
              return displayedItems.map(song => (
                <SidebarItem key={song.id} id={song.id} label={song.title}
                  active={activeItemId === song.id}
                  editingId={editingId} editValue={editValue}
                  onSelect={() => send('SET_ACTIVE_ITEM', song.id)}
                  onStartRename={() => startRename(song.id, song.title)}
                  onChangeValue={changeValue}
                  onCommit={() => dispatch({ type: 'SAVE_RENAME_SONG', payload: { id: song.id, value: editValue } })}
                  onMouseDown={handleSongMouseDown(song)}
                  onContextMenu={e => openCtx(e, 'song', song.id, song.title)}
                />
              ));
            }
            const pl = playlists.find(p => p.id === activeSidebarId);
            const sections = pl?.sections || [];
            return displayedItems.map(song => (
              <SidebarItem key={song.id} id={song.id} label={song.title}
                active={activeItemId === song.id}
                editingId={editingId} editValue={editValue}
                onSelect={() => send('SET_ACTIVE_ITEM', song.id)}
                onStartRename={() => startRename(song.id, song.title)}
                onChangeValue={changeValue}
                onCommit={() => dispatch({ type: 'SAVE_RENAME_SONG', payload: { id: song.id, value: editValue } })}
                onMouseDown={handleSongMouseDown(song)}
                onContextMenu={e => openCtx(e, 'song', song.id, song.title)}
              />
            ));
          })()}
          {/* Sections shown at the bottom for now — user can rename/delete via ctx menu */}
          {activeSidebarType === 'pl' && activeSidebarId && (() => {
            const pl = playlists.find(p => p.id === activeSidebarId);
            return (pl?.sections || []).map(sec => (
              <div key={sec.id} className="sidebar__section-divider"
                onContextMenu={e => {
                  e.preventDefault();
                  if (window.confirm(`Delete section "${sec.title}"?`)) {
                    dispatch({ type: 'DELETE_SECTION', payload: { playlistId: activeSidebarId, sectionId: sec.id } });
                  }
                }}
              >
                <span>{sec.title}</span>
              </div>
            ));
          })()}
        </SidebarSection>
      </div>
      {ctxMenu && (
        <SidebarContextMenu
          menu={ctxMenu}
          onClose={() => setCtxMenu(null)}
          onCut={handleCut}
          onCopy={handleCopy}
          onPaste={handlePaste}
          onDelete={handleDelete}
        />
      )}
    </aside>
  );
}

function ChevronIcon({ open }) {
  return (
    <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor"
      style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }}>
      <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
    </svg>
  );
}
function ActiveDot() { return <span className="sidebar__item-dot" aria-hidden="true" />; }