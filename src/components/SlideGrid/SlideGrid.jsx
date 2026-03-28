/**
 * SlideGrid.jsx — with trigger menu, music icon, drag highlight, timeline
 */
import React, { useCallback, useState, useEffect, useRef } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import TimelinePanel from '../Timeline/TimelinePanel';
import { registerDropZone, unregisterDropZone, isDragging } from '../../utils/dragSystem';

// ── Lasso selection ────────────────────────────────────────────
function useLasso(gridRef, dispatch, slides) {
  const lasso = React.useRef(null);
  const box   = React.useRef(null);

  const start = React.useCallback((e) => {
    // Only start on left-click on the grid background (not on a card)
    if (e.button !== 0) return;
    if (e.target.closest('.slide-card') || e.target.closest('.pres-header')) return;
    if (isDragging()) return;

    const grid = gridRef.current;
    if (!grid) return;
    e.preventDefault();

    const r = grid.getBoundingClientRect();
    const sx = e.clientX; const sy = e.clientY;

    // Create lasso element
    const el = document.createElement('div');
    el.id = 'ef-lasso';
    Object.assign(el.style, {
      position: 'fixed', border: '1px solid rgba(59,130,246,0.8)',
      background: 'rgba(59,130,246,0.12)', borderRadius: '2px',
      pointerEvents: 'none', zIndex: 9998,
      left: sx + 'px', top: sy + 'px', width: '0', height: '0',
    });
    document.body.appendChild(el);
    box.current = { sx, sy, el };

    // Clear existing selection
    dispatch({ type: 'SET_SELECTED_SLIDE_IDS', payload: [] });

    const onMove = (ev) => {
      const { sx, sy, el } = box.current;
      const x = Math.min(ev.clientX, sx);
      const y = Math.min(ev.clientY, sy);
      const w = Math.abs(ev.clientX - sx);
      const h = Math.abs(ev.clientY - sy);
      el.style.left = x + 'px'; el.style.top = y + 'px';
      el.style.width = w + 'px'; el.style.height = h + 'px';

      // Hit-test each slide card
      const lassoRect = { left: x, top: y, right: x + w, bottom: y + h };
      const selected = [];
      document.querySelectorAll('[data-slide-id]').forEach(card => {
        const cr = card.getBoundingClientRect();
        const overlap = !(cr.right < lassoRect.left || cr.left > lassoRect.right ||
                          cr.bottom < lassoRect.top || cr.top > lassoRect.bottom);
        if (overlap) {
          card.classList.add('slide-card--lasso');
          selected.push(card.dataset.slideId);
        } else {
          card.classList.remove('slide-card--lasso');
        }
      });
      dispatch({ type: 'SET_SELECTED_SLIDE_IDS', payload: selected });
      if (selected.length === 1) dispatch({ type: 'SET_SELECTED_SLIDE', payload: selected[0] });
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.querySelectorAll('.slide-card--lasso').forEach(c => c.classList.remove('slide-card--lasso'));
      box.current?.el?.remove();
      box.current = null;
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [dispatch, slides]);

  return start;
}

function SlideThumbnail({
  slide, index, isSelected, isDragOver,
  onClick, onContextMenu,
  onDrop,
}) {
  const ref     = useRef(null);
  // Keep handler ref stable — avoids re-registering the drop zone every render
  const handlerRef = useRef(null);
  handlerRef.current = onDrop;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    registerDropZone(el, (type, data) => {
      if (type === 'media' || type === 'media-file') handlerRef.current?.(data, slide.id);
    });
    return () => unregisterDropZone(el);
  }, [slide.id]); // stable — only re-register if slide.id changes

  const borderColor = isDragOver ? '#00e87a' : isSelected ? '#D4AF37' : (slide.color || '#2a2a2a');
  const shadow = isDragOver
    ? '0 0 0 2px #00e87a, 0 0 16px rgba(0,232,122,0.35)'
    : isSelected
    ? '0 0 0 2px #D4AF37, 0 8px 24px rgba(0,0,0,0.6)'
    : '0 2px 8px rgba(0,0,0,0.4)';

  return (
    <div
      ref={ref}
      className={`slide-card ${isSelected ? 'slide-card--active' : ''} ${isDragOver ? 'slide-card--drag-over' : ''}`}
      onClick={onClick}
      onContextMenu={onContextMenu}
      style={{ '--border-color': borderColor, '--shadow': shadow }}
      aria-selected={isSelected}
      role="option"
      data-slide-id={slide.id}
    >
      <div className="slide-card__thumb">
        {slide.video && (() => {
          const src = slide.video.startsWith('asset://') || slide.video.startsWith('http') || slide.video.startsWith('blob:')
            ? slide.video
            : convertFileSrc(slide.video);
          // No autoPlay — just show first frame as thumbnail
          return <video key={slide.video} src={src + '#t=0.001'}
            className="slide-card__bg-video" muted playsInline preload="metadata" />;
        })()}
        <div className="slide-card__text" style={{
          left: `${slide.x ?? 50}%`, top: `${slide.y ?? 50}%`,
          width: `${slide.width ?? 60}%`, height: `${slide.height ?? 30}%`,
          color: slide.textColor || '#ffffff', fontWeight: slide.fontWeight || 800,
          fontSize: `${slide.fontSize || 5}cqw`, fontFamily: slide.fontFamily || 'Arial, sans-serif',
          fontStyle: slide.italic ? 'italic' : 'normal',
          textTransform: slide.transform || 'none',
          lineHeight: slide.lineSpacing ?? 1.2,
          whiteSpace: 'pre-wrap',
          textDecoration: [slide.underline && 'underline', slide.strikethrough && 'line-through'].filter(Boolean).join(' ') || 'none',
        }}>
          {slide.text}
        </div>
        {isDragOver && (
          <div className="slide-card__drop-overlay">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#00e87a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <span>Drop as background</span>
          </div>
        )}
        <div className="slide-card__footer">
          <span className="slide-card__index">{index + 1}</span>
          {slide.group && slide.group !== 'None' && (
            <span
              className="slide-card__group-label"
              style={{ color: slide.color || '#888', borderColor: slide.color || '#555' }}
            >
              {slide.group}
            </span>
          )}
          <div style={{ display:'flex', gap:3, alignItems:'center', marginLeft:'auto' }}>
            {slide.triggerAudio && <MusicNoteIcon color="#D4AF37" size={10} />}
            {slide.video && <VideoIcon />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Context Menu ───────────────────────────────────────────────
function ContextMenu({ menu, onEdit, onDuplicate, onCopy, onCut, onPaste, onSetGroup, onDelete, onAssignTrigger, onRemoveVideo, audioFiles, audioPlaylists }) {
  const [triggerOpen, setTriggerOpen] = useState(false);
  const [musicOpen, setMusicOpen] = useState(false);
  const [filterPlaylist, setFilterPlaylist] = useState(null);
  if (!menu) return null;

  const GROUPS = [
    { n:'Verse', c:'#3b82f6' }, { n:'Chorus', c:'#ef4444' }, { n:'Bridge', c:'#a855f7' },
    { n:'Pre-Chorus', c:'#f97316' }, { n:'Intro', c:'#22c55e' }, { n:'Outro', c:'#6b7280' },
  ];

  const tracks = filterPlaylist ? audioFiles.filter(f => f.playlistId === filterPlaylist) : audioFiles;

  return (
    <div className="context-menu" style={{ top: menu.y, left: menu.x }} onMouseDown={e => e.stopPropagation()}>
      <div className="context-menu__section-label">ACTIONS</div>
      <Item label="Edit Slide" shortcut="↵" onClick={onEdit} />
      <Item label="Duplicate" shortcut="⌘D" onClick={onDuplicate} />
      <Item label="Copy" shortcut="⌘C" onClick={onCopy} />
      <Item label="Cut" shortcut="⌘X" onClick={onCut} />
      <Item label="Paste" shortcut="⌘V" onClick={onPaste} />
      <div className="context-menu__divider" />

      {/* Trigger row */}
      <div
        className={`context-menu__item context-menu__item--arrow ${triggerOpen ? 'context-menu__item--hover':''}`}
        onMouseEnter={() => { setTriggerOpen(true); setMusicOpen(false); }}
        onMouseLeave={() => setTriggerOpen(false)}
        style={{ position:'relative' }}
      >
        <span style={{ display:'flex', alignItems:'center', gap:6 }}>
          <MusicNoteIcon color="#888" size={11}/> Trigger
        </span>
        <span className="context-menu__arrow">›</span>
        {triggerOpen && (
          <div className="context-menu context-menu--submenu">
            <div className="context-menu__section-label">TRIGGER TYPE</div>
            {/* Music */}
            <div
              className={`context-menu__item context-menu__item--arrow ${musicOpen?'context-menu__item--hover':''}`}
              onMouseEnter={() => setMusicOpen(true)}
              onMouseLeave={() => setMusicOpen(false)}
              style={{ position:'relative' }}
            >
              <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                <MusicNoteIcon color="#888" size={11}/> Music
              </span>
              <span className="context-menu__arrow">›</span>
              {musicOpen && (
                <div className="context-menu context-menu--submenu context-menu--music">
                  <div className="context-menu__section-label">SELECT TRACK</div>
                  {audioPlaylists.length > 0 && (
                    <div className="context-menu__playlist-pills">
                      <button className={`context-menu__pill${!filterPlaylist?' active':''}`} onClick={() => setFilterPlaylist(null)}>All</button>
                      {audioPlaylists.map(pl => (
                        <button key={pl.id} className={`context-menu__pill${filterPlaylist===pl.id?' active':''}`} onClick={() => setFilterPlaylist(pl.id)}>{pl.name}</button>
                      ))}
                    </div>
                  )}
                  {menu.slideTriggerAudio && (
                    <>
                      <div className="context-menu__item context-menu__item--danger" onClick={() => onAssignTrigger(null)}>✕ Remove Trigger</div>
                      <div className="context-menu__divider" />
                    </>
                  )}
                  {tracks.length === 0
                    ? <div className="context-menu__empty">No audio imported yet</div>
                    : tracks.map(track => (
                      <div key={track.id}
                        className={`context-menu__item context-menu__track ${menu.slideTriggerAudio?.id===track.id?'context-menu__track--active':''}`}
                        onClick={() => onAssignTrigger(track)}
                      >
                        <MusicNoteIcon color={menu.slideTriggerAudio?.id===track.id?'#D4AF37':'#555'} size={10}/>
                        <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>
                          {track.name.replace(/\.[^.]+$/,'')}
                        </span>
                        {menu.slideTriggerAudio?.id===track.id && <span style={{ color:'#D4AF37' }}>✓</span>}
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="context-menu__divider" />
      <div className="context-menu__section-label">GROUP</div>
      {GROUPS.map(opt => (
        <div key={opt.n} className="context-menu__item" onClick={() => onSetGroup(opt.n, opt.c)}>
          <span className="context-menu__swatch" style={{ background:opt.c }} />{opt.n}
        </div>
      ))}
      <div className="context-menu__divider" />
      {menu.slideVideo && (
        <Item
          label={`Remove Action: ${menu.slideVideo.split(/[\/]/).pop()}`}
          onClick={onRemoveVideo}
          danger
        />
      )}
      <Item label="Delete" onClick={onDelete} danger />
    </div>
  );
}

function Item({ label, shortcut, onClick, danger }) {
  return (
    <div className={`context-menu__item ${danger ? 'context-menu__item--danger' : ''}`} onClick={onClick}>
      <span>{label}</span>
      {shortcut && <span className="context-menu__shortcut">{shortcut}</span>}
    </div>
  );
}

function AddSlideButton({ onClick }) {
  return (
    <button className="slide-card slide-card--add" onClick={onClick} title="Add new slide">
      <span className="slide-card--add__plus">+</span>
      <span className="slide-card--add__label">New Slide</span>
    </button>
  );
}

function PresentationHeader({ activeSong, showArrangements, activeArrangement, showTimeline, slideCardSize, dispatch }) {
  return (
    <div className="pres-header">
      <div className="pres-header__info">
        <span className="pres-header__title">{activeSong?.title || 'No Song Selected'}</span>
        {activeArrangement !== 'Master' && <span className="pres-header__arrangement">{activeArrangement}</span>}
      </div>
      <div style={{ display:'flex', gap:6, alignItems:'center' }}>
        <button className={`pres-header__arr-btn ${showTimeline ? 'active' : ''}`}
          onClick={() => dispatch({ type:'TOGGLE_TIMELINE' })} title="Timeline">
          <TimelineIcon />
        </button>
        {/* Slide size slider */}
        <input type="range" min="100" max="320" step="10"
          value={slideCardSize}
          onChange={e => dispatch({ type:'SET_SLIDE_CARD_SIZE', payload: parseInt(e.target.value) })}
          style={{ width:64, accentColor:'#D4AF37', cursor:'pointer', verticalAlign:'middle' }}
          title="Slide size"
        />
        <button className={`pres-header__arr-btn ${showArrangements ? 'active' : ''}`}
          onClick={() => dispatch({ type:'TOGGLE_ARRANGEMENTS' })} title="Arrangements">
          <ArrangementIcon />
        </button>
      </div>
    </div>
  );
}

export default function SlideGrid({
  state, dispatch,
  slides, displaySlides, activeSong,
  onSlideClick, onAddSlide,
  onDuplicate, onCopy, onCut, onPaste, onSetGroup, onDelete,
  onDragOver, onDropMedia,
  onAssignTrigger, onRemoveVideo,
  onDragHoverSlide,
  audioFiles, audioPlaylists,
}) {
  const { selectedSlideId, selectedSlideIds = [], contextMenu, showArrangements, activeArrangement, showTimeline } = state;
  const [dragOverSlideId, setDragOverSlideId] = useState(null);
  const gridRef = React.useRef(null);
  const lassoStart = useLasso(gridRef, dispatch, slides);

  // Track drag-over for both custom and native (Finder) drags
  React.useEffect(() => {
    const onMove = (e) => {
      if (!isDragging()) return;
      // Find which slide card the mouse is over
      const cards = document.querySelectorAll('.slide-card[aria-selected]');
      let found = null;
      cards.forEach(card => {
        const r = card.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
          // Get slide id from data attribute if available
          found = card.dataset.slideId;
        }
      });
      setDragOverSlideId(found || null);
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);
  const closeMenu = useCallback(() => dispatch({ type:'SET_CONTEXT_MENU', payload:null }), [dispatch]);

  const contextSlide = contextMenu ? slides.find(s => s.id === contextMenu.slideId) : null;
  const menuWithTrigger = contextMenu ? {
    ...contextMenu,
    slideTriggerAudio: contextSlide?.triggerAudio || null,
    slideVideo: contextSlide?.video || null,
  } : null;

  return (
    <div className="slide-grid-panel" onClick={closeMenu}>
      <PresentationHeader
        activeSong={activeSong} showArrangements={showArrangements}
        activeArrangement={activeArrangement} showTimeline={showTimeline}
        slideCardSize={state.slideCardSize || 180} dispatch={dispatch}
      />
      <div ref={gridRef} className="slide-grid" role="listbox" aria-label="Slides"
        style={{ '--slide-ratio': state.canvasRatio || '16 / 9', '--slide-card-size': `${state.slideCardSize || 180}px` }}
        onMouseDown={lassoStart}>
        {displaySlides.map((slide, i) => (
          <React.Fragment key={slide.displayId || slide.id}>
            {slide._isFirstOfSong && (
              <div className="slide-grid__song-divider">
                <span>{slide._songTitle}</span>
              </div>
            )}
            <SlideThumbnail
              slide={slide} index={i}
              isSelected={slide.id === selectedSlideId || selectedSlideIds.includes(slide.id)}
              isDragOver={dragOverSlideId === slide.id}
              onClick={() => onSlideClick(slide)}
              onContextMenu={e => { e.preventDefault(); dispatch({ type:'SET_CONTEXT_MENU', payload:{ x:e.clientX, y:e.clientY, slideId:slide.id } }); }}
              onDrop={(data, slideId) => {
                const url = data?.src || data?.path;
                if (url && slideId) onDropMedia?.(url, slideId);
              }}
            />
          </React.Fragment>
        ))}
        <AddSlideButton onClick={onAddSlide} />
      </div>

      {showTimeline && (
        <TimelinePanel
          state={state} dispatch={dispatch}
          slides={slides} activeSong={activeSong}
          onSlideClick={onSlideClick}
        />
      )}

      {contextMenu && (
        <ContextMenu
          menu={menuWithTrigger}
          onEdit={() => { dispatch({ type:'SET_SELECTED_SLIDE', payload:contextMenu.slideId }); dispatch({ type:'SET_MODE', payload:'edit' }); closeMenu(); }}
          onDuplicate={() => { onDuplicate(contextMenu.slideId); closeMenu(); }}
          onCopy={() => { onCopy(contextMenu.slideId); closeMenu(); }}
          onCut={() => { onCut(contextMenu.slideId); closeMenu(); }}
          onPaste={() => { onPaste(); closeMenu(); }}
          onSetGroup={(n,c) => { onSetGroup(contextMenu.slideId,n,c); closeMenu(); }}
          onDelete={() => { onDelete(contextMenu.slideId); closeMenu(); }}
          onRemoveVideo={() => { onRemoveVideo?.(contextMenu.slideId); closeMenu(); }}
          onAssignTrigger={track => { onAssignTrigger(contextMenu.slideId, track); closeMenu(); }}
          audioFiles={audioFiles || []}
          audioPlaylists={audioPlaylists || []}
        />
      )}
    </div>
  );
}

// Icons
function VideoIcon() {
  return <svg viewBox="0 0 24 24" width="10" height="10" fill="#D4AF37"><path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z"/></svg>;
}
function MusicNoteIcon({ color='#888', size=11 }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill={color}><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/></svg>;
}
function ArrangementIcon() {
  return <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>;
}
function TimelineIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="2" y1="5" x2="22" y2="5"/>
      <rect x="3" y="8" width="7" height="4" rx="1" fill="currentColor" stroke="none" opacity="0.8"/>
      <rect x="12" y="8" width="9" height="4" rx="1" fill="currentColor" stroke="none" opacity="0.5"/>
      <line x1="2" y1="17" x2="22" y2="17"/>
      <rect x="2" y="13" width="11" height="3" rx="1" fill="currentColor" stroke="none" opacity="0.4"/>
    </svg>
  );
}