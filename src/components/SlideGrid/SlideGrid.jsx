/**
 * SlideGrid.jsx — ElevateFlow slide grid
 * - Drag-to-reorder with ProPresenter-style colored insert bar
 * - Hotkey dialog (A–Z input, shows badge top-left of slide)
 * - Footer below thumb so text never overlaps it
 */
import React, { useRef, useCallback, useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { convertFileSrc } from '@tauri-apps/api/core';
import { registerDropZone, unregisterDropZone, isDragging } from '../../utils/dragSystem';
import { SlideDragProvider, useSlideDrag } from '../../utils/slideDragSystem';

// ── Hotkey Dialog ──────────────────────────────────────────────
function HotkeyDialog({ slideId, currentKey, onConfirm, onClear, onCancel }) {
  const [value, setValue] = useState(currentKey || '');
  const inputRef = useRef(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 50); }, []);

  const handleKey = (e) => {
    const k = e.key.toUpperCase();
    if (/^[A-Z]$/.test(k)) { setValue(k); e.preventDefault(); }
    else if (e.key === 'Backspace') setValue('');
    else if (e.key === 'Enter' && value) onConfirm(value.toLowerCase());
    else if (e.key === 'Escape') onCancel();
  };

  return ReactDOM.createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100000,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onMouseDown={onCancel}>
      <div onMouseDown={e => e.stopPropagation()} style={{
        background: '#1a1a1e', border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 14, padding: '24px 28px', width: 300,
        boxShadow: '0 24px 60px rgba(0,0,0,0.8)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Arial, sans-serif',
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#e4e4e7', marginBottom: 6 }}>
          Assign Hot Key
        </div>
        <div style={{ fontSize: 11, color: '#52525b', marginBottom: 20 }}>
          Press a letter key (A–Z) to assign it as a hotkey for this slide.
        </div>

        {/* Key display */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div
            ref={inputRef}
            tabIndex={0}
            onKeyDown={handleKey}
            style={{
              width: 52, height: 52, borderRadius: 10,
              border: '2px solid rgba(212,175,55,0.5)',
              background: value ? 'rgba(212,175,55,0.12)' : 'rgba(255,255,255,0.04)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, fontWeight: 900,
              color: value ? '#D4AF37' : 'rgba(255,255,255,0.15)',
              outline: 'none', cursor: 'text',
              boxShadow: value ? '0 0 0 3px rgba(212,175,55,0.15)' : 'none',
              transition: 'all 0.15s',
              userSelect: 'none',
            }}
          >
            {value || '?'}
          </div>
          <div style={{ fontSize: 11, color: '#52525b', lineHeight: 1.5 }}>
            {value ? `Key "${value}" will trigger this slide` : 'Press any letter key'}
          </div>
        </div>

        <div style={{ fontSize: 10, color: '#3f3f46', marginBottom: 18 }}>
          Valid characters: A–Z
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={dlgBtn('#333', '#888')}>Cancel</button>
          <button onClick={onClear} style={dlgBtn('rgba(239,68,68,0.12)', '#f87171', 'rgba(239,68,68,0.3)')}>Clear</button>
          <button onClick={() => value && onConfirm(value.toLowerCase())}
            disabled={!value}
            style={dlgBtn(value ? 'rgba(212,175,55,0.12)' : '#111', value ? '#D4AF37' : '#333', value ? 'rgba(212,175,55,0.3)' : '#222')}>
            OK
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
function dlgBtn(bg, color, border = 'rgba(255,255,255,0.1)') {
  return {
    padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700,
    cursor: 'pointer', border: `1px solid ${border}`,
    background: bg, color,
  };
}

// ── Insert indicator ───────────────────────────────────────────
function InsertBar({ color = '#60a5fa' }) {
  return (
    <div style={{
      width: 4, alignSelf: 'stretch', borderRadius: 2, flexShrink: 0,
      background: color,
      boxShadow: `0 0 14px ${color}, 0 0 4px ${color}`,
      margin: '0 1px',
      minHeight: 40,
    }} />
  );
}

// ── Slide thumbnail ────────────────────────────────────────────
function SlideThumbnail({
  slide, index, isSelected, isDragOver, isReorderSource,
  hotkey,
  onClick, onContextMenu, onMouseDown,
  onDrop,
}) {
  const ref        = useRef(null);
  const handlerRef = useRef(null);
  handlerRef.current = onDrop;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    registerDropZone(el, (type, data) => {
      if (type === 'media' || type === 'media-file') handlerRef.current?.(data, slide.id);
    });
    return () => unregisterDropZone(el);
  }, [slide.id]);

  const borderColor = isDragOver ? '#00e87a'
                    : isSelected ? '#D4AF37'
                    : (slide.color || 'var(--border-dim)');

  const shadow = isDragOver
    ? '0 0 0 2px #00e87a, 0 0 16px rgba(0,232,122,0.35)'
    : isSelected
    ? '0 0 0 2px #D4AF37, 0 8px 24px rgba(0,0,0,0.6)'
    : '0 2px 8px rgba(0,0,0,0.4)';

  return (
    <div
      ref={ref}
      className={`slide-card${isSelected ? ' slide-card--active' : ''}${isDragOver ? ' slide-card--drag-over' : ''}`}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseDown={onMouseDown}
      style={{
        '--border-color': borderColor,
        '--shadow': shadow,
        opacity: isReorderSource ? 0.3 : 1,
      }}
      aria-selected={isSelected}
      role="option"
      data-slide-id={slide.id}
    >
      {/* Thumb — aspect ratio box, content never bleeds into footer */}
      <div className="slide-card__thumb">
        {slide.video && (() => {
          const isData  = slide.video.startsWith('data:');
          const isImage = isData ? slide.video.startsWith('data:image')
                                 : slide.video.match(/\.(png|jpg|jpeg|gif|webp|bmp)$/i);
          const src = (isData || slide.video.startsWith('asset://') || slide.video.startsWith('http') || slide.video.startsWith('blob:'))
            ? slide.video : convertFileSrc(slide.video);
          if (isImage || slide.videoFit === 'contain') {
            return <img src={src} className="slide-card__bg-video" alt="" style={{ objectFit: slide.videoFit || 'cover' }} />;
          }
          return <video key={slide.video} src={src + '#t=0.001'} className="slide-card__bg-video" muted playsInline preload="metadata" />;
        })()}

        {/* Hotkey badge — top-left corner */}
        {hotkey && (
          <div className="slide-card__hotkey-badge">
            {hotkey.toUpperCase()}
          </div>
        )}

        {/* Text */}
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

        {/* Media drop overlay */}
        {isDragOver && (
          <div className="slide-card__drop-overlay">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#00e87a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <span>Drop as background</span>
          </div>
        )}
      </div>

      {/* Footer — sits in normal flow BELOW the thumb, never overlaps */}
      <div className="slide-card__footer">
        <span className="slide-card__index">{index + 1}</span>
        {slide.group && slide.group !== 'None' && (
          <span className="slide-card__group-label" style={{ color: slide.color || '#888', borderColor: slide.color || '#555' }}>
            {slide.group}
          </span>
        )}
        <div style={{ display:'flex', gap:3, alignItems:'center', marginLeft:'auto' }}>
          {slide.video && <VideoIcon />}
          {slide.triggerAudio && <MusicNoteIcon />}
        </div>
      </div>
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

// ── Inner grid — consumes SlideDragProvider context ────────────
function SlideGridInner({
  state, dispatch,
  slides, displaySlides, activeSong,
  onSlideClick, onAddSlide,
  onDuplicate, onCopy, onCut, onPaste, onSetGroup, onDelete,
  onDropMedia, onAssignTrigger, onRemoveVideo, onSetHotkey,
  onReorderSlide,
  audioFiles, audioPlaylists,
}) {
  const { selectedSlideId, contextMenu, hotkeys = {} } = state;
  const [dragOverSlideId, setDragOverSlideId] = useState(null);
  const [hotkeyDialog,    setHotkeyDialog]    = useState(null); // slideId

  const { dragId: reorderDragId, insertBefore, startDrag: startSlideDrag } = useSlideDrag() || {};

  const closeMenu = useCallback(() => dispatch({ type:'SET_CONTEXT_MENU', payload:null }), [dispatch]);

  // Media drag hover highlight
  useEffect(() => {
    const onMove = (e) => {
      if (!isDragging()) { setDragOverSlideId(null); return; }
      const cards = document.querySelectorAll('.slide-card[data-slide-id]');
      let found = null;
      cards.forEach(card => {
        const r = card.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
          found = card.dataset.slideId;
        }
      });
      setDragOverSlideId(found || null);
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  const slideList = displaySlides || slides;

  return (
    <div className="slide-grid-panel" onClick={closeMenu}>
      <div
        className="slide-grid"
        role="listbox" aria-label="Slides"
        style={{
          '--slide-ratio': state.canvasRatio || '16 / 9',
          '--slide-card-size': `${state.slideCardSize || 180}px`,
          display: 'flex', flexWrap: 'wrap', gap: 8,
          alignContent: 'flex-start',
          alignItems: 'flex-start',
        }}
      >
        {slideList.map((slide, i) => (
          <React.Fragment key={slide.displayId || slide.id}>
            {slide._isFirstOfSong && (
              <div className="slide-grid__song-divider" style={{ width: '100%' }}>
                <span>{slide._songTitle}</span>
              </div>
            )}
            {/* Insert bar BEFORE this slide */}
            {insertBefore === slide.id && reorderDragId !== slide.id && (
              <InsertBar color={slide.color || '#60a5fa'} />
            )}
            <SlideThumbnail
              slide={slide} index={i}
              isSelected={slide.id === selectedSlideId}
              isDragOver={dragOverSlideId === slide.id}
              isReorderSource={reorderDragId === slide.id}
              hotkey={Object.entries(hotkeys).find(([,id]) => id === slide.id)?.[0]}
              onClick={() => onSlideClick(slide)}
              onMouseDown={(e) => {
                if (e.button !== 0) return;
                e.stopPropagation();
                const sx = e.clientX, sy = e.clientY;
                let moved = false;
                const onCheck = (mv) => {
                  if (!moved && (Math.abs(mv.clientX - sx) > 5 || Math.abs(mv.clientY - sy) > 5)) {
                    moved = true;
                    window.removeEventListener('mousemove', onCheck);
                    startSlideDrag?.(slide.id, slide.text?.slice(0, 26) || `Slide ${i + 1}`, mv.clientX, mv.clientY);
                  }
                };
                const onUp = () => {
                  window.removeEventListener('mousemove', onCheck);
                  window.removeEventListener('mouseup', onUp);
                };
                window.addEventListener('mousemove', onCheck);
                window.addEventListener('mouseup', onUp);
              }}
              onContextMenu={e => {
                e.preventDefault();
                dispatch({ type:'SET_CONTEXT_MENU', payload:{ x:e.clientX, y:e.clientY, slideId:slide.id } });
              }}
              onDrop={(data, slideId) => onDropMedia(data, slideId)}
            />
          </React.Fragment>
        ))}

        {/* Insert bar at END */}
        {insertBefore === '__END__' && <InsertBar color="#60a5fa" />}

        <AddSlideButton onClick={onAddSlide} />
      </div>

      {contextMenu && (
        <ContextMenu
          menu={contextMenu}
          slides={slides}
          audioFiles={audioFiles || []}
          currentHotkeys={hotkeys}
          onEdit={() => { dispatch({ type:'SET_SELECTED_SLIDE', payload:contextMenu.slideId }); dispatch({ type:'SET_MODE', payload:'edit' }); closeMenu(); }}
          onDuplicate={() => { onDuplicate(contextMenu.slideId); closeMenu(); }}
          onCopy={() => { onCopy(contextMenu.slideId); closeMenu(); }}
          onCut={() => { onCut(contextMenu.slideId); closeMenu(); }}
          onPaste={() => { onPaste(); closeMenu(); }}
          onSetGroup={(n,c) => { onSetGroup(contextMenu.slideId,n,c); closeMenu(); }}
          onDelete={() => { onDelete(contextMenu.slideId); closeMenu(); }}
          onRemoveVideo={() => { onRemoveVideo?.(contextMenu.slideId); closeMenu(); }}
          onAssignTrigger={track => { onAssignTrigger(contextMenu.slideId, track); closeMenu(); }}
          onOpenHotkeyDialog={() => { setHotkeyDialog(contextMenu.slideId); closeMenu(); }}
        />
      )}

      {hotkeyDialog && (
        <HotkeyDialog
          slideId={hotkeyDialog}
          currentKey={Object.entries(hotkeys).find(([,id]) => id === hotkeyDialog)?.[0] || ''}
          onConfirm={(key) => { onSetHotkey?.(key, hotkeyDialog); setHotkeyDialog(null); }}
          onClear={() => {
            // Remove any existing hotkey for this slide
            const existing = Object.entries(hotkeys).find(([,id]) => id === hotkeyDialog)?.[0];
            if (existing) onSetHotkey?.(existing, null);
            setHotkeyDialog(null);
          }}
          onCancel={() => setHotkeyDialog(null)}
        />
      )}
    </div>
  );
}

// ── Public export — wraps with SlideDragProvider ───────────────
export default function SlideGrid(props) {
  return (
    <SlideGridInner {...props} />
  );
}

// ── Context Menu ───────────────────────────────────────────────
function ContextMenu({ menu, slides, audioFiles, currentHotkeys, onEdit, onDuplicate, onCopy, onCut, onPaste, onSetGroup, onDelete, onRemoveVideo, onAssignTrigger, onOpenHotkeyDialog }) {
  const slide = slides?.find(s => s.id === menu?.slideId);
  const GROUP_OPTIONS = [
    { n:'Verse', c:'#3b82f6' }, { n:'Chorus', c:'#ef4444' }, { n:'Bridge', c:'#a855f7' },
    { n:'Pre-Chorus', c:'#f97316' }, { n:'Intro', c:'#22c55e' }, { n:'Outro', c:'#6b7280' },
    { n:'Tag', c:'#ec4899' }, { n:'None', c:'#2a2a2a' },
  ];
  const existingHotkey = Object.entries(currentHotkeys).find(([,id]) => id === menu?.slideId)?.[0];
  return (
    <div className="context-menu" style={{ top: menu.y, left: menu.x }} onMouseDown={e => e.stopPropagation()}>
      <div className="context-menu__section-label">ACTIONS</div>
      <CItem label="Edit Slide"  shortcut="↵"  onClick={onEdit} />
      <CItem label="Duplicate"   shortcut="⌘D" onClick={onDuplicate} />
      <CItem label="Copy"        shortcut="⌘C" onClick={onCopy} />
      <CItem label="Cut"         shortcut="⌘X" onClick={onCut} />
      <CItem label="Paste"       shortcut="⌘V" onClick={onPaste} />
      {slide?.video && <CItem label="Remove Video" onClick={onRemoveVideo} />}
      <div className="context-menu__divider" />
      <div className="context-menu__section-label">GROUP</div>
      {GROUP_OPTIONS.map(opt => (
        <div key={opt.n} className="context-menu__item" onClick={() => onSetGroup(opt.n, opt.c)}>
          <span className="context-menu__swatch" style={{ background: opt.c }} />{opt.n}
        </div>
      ))}
      <div className="context-menu__divider" />
      {/* Hotkey — single button, opens dialog */}
      <div className="context-menu__item" onClick={onOpenHotkeyDialog}
        style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <span>Hot Key</span>
        {existingHotkey && (
          <span style={{
            fontSize:9, fontWeight:900, color:'#D4AF37',
            background:'rgba(212,175,55,0.15)', border:'1px solid rgba(212,175,55,0.3)',
            borderRadius:3, padding:'1px 5px', letterSpacing:0.5,
          }}>{existingHotkey.toUpperCase()}</span>
        )}
      </div>
      <div className="context-menu__divider" />
      <CItem label="Delete" onClick={onDelete} danger />
    </div>
  );
}

function CItem({ label, shortcut, onClick, danger }) {
  return (
    <div className={`context-menu__item${danger ? ' context-menu__item--danger' : ''}`} onClick={onClick}>
      <span>{label}</span>
      {shortcut && <span className="context-menu__shortcut">{shortcut}</span>}
    </div>
  );
}

function VideoIcon() {
  return <svg viewBox="0 0 24 24" width="10" height="10" fill="#D4AF37"><path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z"/></svg>;
}
function MusicNoteIcon() {
  return <svg viewBox="0 0 24 24" width="10" height="10" fill="#888"><path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6z"/></svg>;
}