/**
 * App.jsx — ElevateFlow
 *
 * Clean orchestrator. All state lives in useAppState(),
 * all operations live in domain hooks, all UI in components.
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen, emitTo } from '@tauri-apps/api/event';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';

// ── Hooks ──────────────────────────────────────────────────────
import { useAppState } from './hooks/useAppState';
import { useSlides } from './hooks/useSlides';
import { useSync, usePersistence } from './hooks/useSync';
import { useMedia, useTransport } from './hooks/useMedia';
import { exportSongAsEf, importEfFile } from './hooks/useEfFiles';

// ── Components ─────────────────────────────────────────────────
import Toolbar from './components/Toolbar/Toolbar';
import Sidebar from './components/Sidebar/Sidebar';
import SlideGrid from './components/SlideGrid/SlideGrid';
import RightPanel from './components/RightPanel/index';
import MediaBin from './components/MediaBin/MediaBin';
import EditMode from './components/EditMode/EditMode';
import TextImport from './TextImport';
import AIAssistant from './AIAssistant';
import UpdateNotifier, { useUpdateCheck } from './UpdateNotifier';
import StageMode from './StageMode';
import FlowEditor from './FlowEditor';
import WindowedOutputPicker from './WindowedOutputPicker';
import TrailerVideo from './TrailerVideo';
import Tutorial from './Tutorial';
import GraphicsMode from './components/GraphicsMode/GraphicsMode';
import ThemeEditor from './components/ThemeEditor/ThemeEditor';
import ImportEfModal from './components/ImportEfModal/ImportEfModal';

// ── Styles ─────────────────────────────────────────────────────
import './styles/app.css';
import './styles/edit.css';
import './styles/toolbar-output-buttons.css';

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

/** Broadcast to all open output windows */
async function pushToOutputs(eventName, payload = {}) {
  try {
    await emitTo('*', eventName, payload);
  } catch (_) {}
}

/**
 * Build the payload for output windows.
 * IMPORTANT: send raw `path` (filesystem path), NOT src (asset:// URL).
 * Each output window calls convertFileSrc() locally — asset URLs are window-scoped.
 */
function buildAudiencePayload(slide, liveVideo, activeOverlay, nextSlide, volume = 1, fadeDuration = 0.5) {
  return {
    text:          slide?.text          || '',
    videoPath:     slide?.video         || liveVideo     || null,
    overlayPath:   slide?.overlay       || activeOverlay || null,
    textColor:     slide?.textColor     || '#ffffff',
    fontWeight:    slide?.fontWeight    || 800,
    fontSize:      slide?.fontSize      || 5,
    fontFamily:    slide?.fontFamily    || 'Arial, sans-serif',
    italic:        slide?.italic        || false,
    underline:     slide?.underline     || false,
    strikethrough: slide?.strikethrough || false,
    transform:     slide?.transform     || 'none',
    lineSpacing:   slide?.lineSpacing   ?? 1.2,
    volume:        volume,
    fadeDuration:  fadeDuration,
    videoFit:      slide?.videoFit      || 'cover',
    x:             slide?.x      ?? 50,
    y:             slide?.y      ?? 50,
    width:         slide?.width  ?? 60,
    height:        slide?.height ?? 30,
    // Next slide for stage monitor
    nextSlideText:        nextSlide?.text        || '',
    nextSlideColor:       nextSlide?.textColor   || '#ffff00',
    nextSlideFontWeight:  nextSlide?.fontWeight  || 800,
    nextSlideFontSize:    nextSlide?.fontSize    || 5,
    nextSlideFontFamily:  nextSlide?.fontFamily  || 'Arial, sans-serif',
    nextSlideTransform:   nextSlide?.transform   || 'none',
  };
}

// ─────────────────────────────────────────────────────────────────
// ROOT COMPONENT
// ─────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────
// RESIZABLE LAYOUT
// ─────────────────────────────────────────────────────────────────
function ResizableLayout({
  state, dispatch,
  slides, displaySlides, activeSong,
  handleSlideClick, addSlide, duplicateSlide, copySlide, cutSlide, pasteSlide,
  setSlideGroup, deleteSlide, onDropMedia, assignTriggerToSlide, setDragHoverSlideId,
  selectedSlide, nextSlide, videoRef, audioRef,
  togglePlay, skipTime, formatTime, clearAll,
  handleVideoTimeUpdate, handleAudioTimeUpdate, handleImportMedia,
  handleMediaClick, onDragStart, displayedItems,
  startHosting, joinSession, endSession,
  showMediaBin,
}) {
  const [sidebarW,    setSidebarW]    = useState(220);
  const [rightW,      setRightW]      = useState(300);
  const [mediaBinH,   setMediaBinH]   = useState(320);

  const MIN_SIDEBAR   = 160;  const MAX_SIDEBAR   = 400;
  const MIN_RIGHT     = 240;  const MAX_RIGHT     = 500;
  const MIN_MEDIABIN  = 120;  const MAX_MEDIABIN  = 400;

  const startDrag = useCallback((e, type) => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startSidebar  = sidebarW;
    const startRight    = rightW;
    const startMediaBin = mediaBinH;

    const onMove = (ev) => {
      if (type === 'sidebar') {
        const next = Math.min(MAX_SIDEBAR, Math.max(MIN_SIDEBAR, startSidebar + ev.clientX - startX));
        setSidebarW(next);
      } else if (type === 'right') {
        const next = Math.min(MAX_RIGHT, Math.max(MIN_RIGHT, startRight - (ev.clientX - startX)));
        setRightW(next);
      } else if (type === 'mediabin') {
        const next = Math.min(MAX_MEDIABIN, Math.max(MIN_MEDIABIN, startMediaBin - (ev.clientY - startY)));
        setMediaBinH(next);
      }
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = type === 'mediabin' ? 'ns-resize' : 'ew-resize';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [sidebarW, rightW, mediaBinH]);

  return (
    <div className="show-layout" style={{
      gridTemplateColumns: `${sidebarW}px 4px 1fr 4px ${rightW}px`,
      gridTemplateRows: showMediaBin ? `1fr 4px ${mediaBinH}px` : '1fr',
    }}>
      {/* Sidebar */}
      <div className="show-layout__sidebar">
        <Sidebar state={state} dispatch={dispatch}
          displayedItems={displayedItems}
          startHosting={startHosting} joinSession={joinSession} endSession={endSession}
        />
      </div>

      {/* Sidebar ↔ Center resizer */}
      <div className="panel-resizer panel-resizer--sidebar"
        onMouseDown={e => startDrag(e, 'sidebar')} />

      {/* Center */}
      <div className="show-layout__center">
        <SlideGrid state={state} dispatch={dispatch}
          slides={slides} displaySlides={displaySlides} activeSong={activeSong}
          onSlideClick={handleSlideClick} onAddSlide={() => addSlide()}
          onDuplicate={duplicateSlide} onCopy={copySlide} onCut={cutSlide}
          onPaste={pasteSlide} onSetGroup={setSlideGroup} onDelete={deleteSlide}
          onDragOver={(e) => e.preventDefault()} onDropMedia={onDropMedia}
          onAssignTrigger={assignTriggerToSlide} onDragHoverSlide={setDragHoverSlideId}
          onRemoveVideo={(slideId) => {
            if (slideId) updateSlides(slides.map(s => s.id === slideId ? { ...s, video: null } : s));
          }}
          audioFiles={state.audioFiles} audioPlaylists={state.audioPlaylists}
        />
      </div>

      {/* Center ↔ Right resizer */}
      <div className="panel-resizer panel-resizer--right"
        onMouseDown={e => startDrag(e, 'right')} />

      {/* Right */}
      <div className="show-layout__right">
        <RightPanel state={state} dispatch={dispatch}
          selectedSlide={selectedSlide} nextSlide={nextSlide}
          videoRef={videoRef} audioRef={audioRef}
          togglePlay={togglePlay} skipTime={skipTime} formatTime={formatTime}
          onClearAll={clearAll}
          handleVideoTimeUpdate={handleVideoTimeUpdate}
          handleAudioTimeUpdate={handleAudioTimeUpdate}
          onImportAudio={handleImportMedia}
        />
      </div>

      {/* Media bin resizer */}
      {showMediaBin && (
        <div className="panel-resizer panel-resizer--horiz"
          onMouseDown={e => startDrag(e, 'mediabin')} />
      )}

      {/* Media bin */}
      {showMediaBin && (
        <div className="show-layout__media-bin">
          <MediaBin state={state} dispatch={dispatch}
            onMediaClick={handleMediaClick} onImportMedia={handleImportMedia}
            onDragStart={onDragStart}
            liveVideo={state.liveVideo} activeOverlay={state.activeOverlay}
          />
        </div>
      )}
    </div>
  );
}

export default function App() {
  const { state, dispatch, send } = useAppState();

  const videoRef      = useRef(null);
  const audioRef      = useRef(null);
  const videoAudioRef = useRef(null); // plays video audio in main window
  const [showMediaBin,    setShowMediaBin]    = useState(true);
  const [showPP7Importer,  setShowPP7Importer]  = useState(false);
  const [showTextImport,   setShowTextImport]    = useState(false);
  const [showAI,           setShowAI]           = useState(false);
  const [showWindowedPicker, setShowWindowedPicker] = useState(false);
  const [showTrailer,        setShowTrailer]        = useState(false);
  const [showTutorial,       setShowTutorial]       = useState(false); // shown after trailer
  const [update, dismissUpdate] = useUpdateCheck();

  const handleTextImport = useCallback(({ title, slides, destType, destId }) => {
    const songId = 'txt_' + Date.now();
    const libId  = destType === 'library' ? destId : (state.libraries[0]?.id || 'default');
    dispatch({ type: 'ADD_SONG', payload: {
      id: songId, title, libId,
      slides, author: '', copyright: '',
    }});
    if (destType === 'playlist' && destId) {
      dispatch({ type: 'ADD_SONG_TO_PLAYLIST', payload: { playlistId: destId, songId } });
    }
  }, [dispatch, state.libraries]);

  const handlePP7Import = useCallback((songs) => {
    const libId = 'pp7_import_' + Date.now();
    dispatch({ type: 'ADD_LIBRARY', payload: { id: libId, title: 'ProPresenter 7 Import' } });
    songs.forEach(song => {
      dispatch({ type: 'ADD_SONG', payload: { ...song, libId } });
    });
    setShowPP7Importer(false);
  }, [dispatch]);

  // Restore saved audio output device on startup
  useEffect(() => {
    const sinkId = localStorage.getItem('ef_audio_sink');
    if (!sinkId || sinkId === 'default') return;
    const applySink = async () => {
      const els = [audioRef.current, videoRef.current, videoAudioRef.current].filter(Boolean);
      for (const el of els) {
        if (el.setSinkId) await el.setSinkId(sinkId).catch(() => {});
      }
    };
    // Wait for elements to mount
    setTimeout(applySink, 500);

    // Listen for sink changes from Settings window
    const handler = (e) => {
      const { sinkId: sid } = e.detail || {};
      if (!sid) return;
      const els = [audioRef.current, videoRef.current, videoAudioRef.current].filter(Boolean);
      els.forEach(el => { if (el.setSinkId) el.setSinkId(sid).catch(() => {}); });
    };
    window.addEventListener('ef-audio-sink-changed', handler);
    return () => window.removeEventListener('ef-audio-sink-changed', handler);
  }, []);

  // Tauri menu / system event listeners
  useEffect(() => {
    const win = getCurrentWindow();
    if (win.label !== 'main') return;

    const unlistenSync = listen('toggle-sync-panel', () => {
      dispatch({ type: 'TOGGLE_SYNC_PANEL' });
    });
    const unlistenUnderscan = listen('apply-underscan', (e) => {
      dispatch({ type: 'SET_UNDERSCAN_SCALE', payload: 1 - (e.payload.value / 100) });
    });

    // Desktop drag-and-drop onto the app window (Finder only)
    const unlistenDrop = listen('tauri://drag-drop', (e) => {
      const paths = e.payload?.paths;
      if (!paths || paths.length === 0) return;

      // Ignore if our custom drag system is active (internal drag)
      // isDragging is imported at module level below
      if (window._efDragActive) return;

      // Find the slide being targeted — ONLY assign if directly over a slide card
      const dropX = e.payload?.position?.x ?? e.payload?.x;
      const dropY = e.payload?.position?.y ?? e.payload?.y;

      let targetSlideId = null;

      // Method 1: elementFromPoint at drop coordinates
      if (typeof dropX === 'number' && typeof dropY === 'number') {
        const el = document.elementFromPoint(dropX, dropY);
        const card = el?.closest('[data-slide-id]');
        if (card) targetSlideId = card.dataset.slideId;
      }

      // Method 2: pendingDropSlideRef (set when our drop zone fires first)
      if (!targetSlideId && pendingDropSlideRef.current) {
        targetSlideId = pendingDropSlideRef.current;
      }
      pendingDropSlideRef.current = null;
      // NOTE: If no targetSlideId, files go to media bin only — never modify slides

      paths.forEach(rawPath => {
        const ext     = rawPath.split('.').pop().toLowerCase();
        const isVideo = ['mp4','mov','avi','mkv','webm','m4v'].includes(ext);
        const isAudio = ['mp3','wav','aac','flac','m4a','ogg'].includes(ext);
        const isImage = ['png','jpg','jpeg','gif','webp'].includes(ext);
        if (!isVideo && !isAudio && !isImage) return;

        // Always add to media bin — coordinate-based slide targeting is unreliable
        // (Retina scaling, window positioning etc. cause false positives)
        // Users drag from media bin to slides using our custom drag system.
        const src  = convertFileSrc(rawPath);
        const type = isVideo ? 'video' : isAudio ? 'audio' : 'image';
        const file = {
          id:   Date.now() + Math.random(),
          name: rawPath.split(/[\\/]/).pop().replace(/\.[^.]+$/, ''),
          path: rawPath, src, type,
        };
        if (isAudio) dispatch({ type: 'ADD_AUDIO_FILE', payload: file });
        else         dispatch({ type: 'ADD_MEDIA_FILE', payload: file });
      });
    });

    return () => {
      unlistenSync.then(f => f());
      unlistenUnderscan.then(f => f());
      unlistenDrop.then(f => f());
    };
  }, [dispatch]);

  // ── Domain hooks ──────────────────────────────────────────────
  const slideOps = useSlides(state, dispatch);
  const {
    activeSong, slides, selectedSlide, nextSlide,
    addSlide, deleteSlide, duplicateSlide,
    copySlide, cutSlide, pasteSlide,
    updateSlideText, updateSlideStyle, updateSlideStyles,
    setSlideGroup, assignMediaToSlide, assignTriggerToSlide,
    applyTransform, sendToAudience,
  } = slideOps;

  const handleSetHotkey = useCallback((key, slideId) => {
    dispatch({ type: 'SET_HOTKEY', payload: { key: key.toLowerCase(), slideId } });
  }, [dispatch]);

  const handleSetGroup = useCallback((slideId, groupName, color) => {
    setSlideGroup(slideId, groupName, color);
    const GROUP_DEFAULTS = {
      'Verse': 'v', 'Chorus': 'c', 'Bridge': 'b', 'Intro': 'i',
      'Outro': 'o', 'Pre-Chorus': 'p', 'Ending': 'e', 'Tag': 't',
      'Slide': 's', 'Interlude': 's',
    };
    const defaultKey = GROUP_DEFAULTS[groupName];
    if (defaultKey && !state.hotkeys?.[defaultKey]) {
      dispatch({ type: 'SET_HOTKEY', payload: { key: defaultKey, slideId } });
    }
  }, [setSlideGroup, dispatch, state.hotkeys]);

  // ── Sidebar items (defined early — used in keyboard handler) ──
  const displayedItems = state.activeSidebarType === 'lib'
    ? state.librarySongs.filter(s => s.libId === state.activeSidebarId)
    : state.librarySongs.filter(s =>
        state.playlists.find(p => p.id === state.activeSidebarId)?.songIds?.includes(s.id)
      );

  // In playlist view — show all songs' slides in one scroll
  const displaySlides = React.useMemo(() => {
    if (state.activeSidebarType !== 'pl' || !state.activeSidebarId) return slides;
    // Collect all slides from all songs in this playlist, tagged with song info
    const pl = state.playlists.find(p => p.id === state.activeSidebarId);
    if (!pl?.songIds?.length) return slides;
    const allSlides = [];
    pl.songIds.forEach(songId => {
      const song = state.librarySongs.find(s => s.id === songId);
      if (!song) return;
      (song.slides || []).forEach((slide, i) => {
        allSlides.push({ ...slide, _songTitle: song.title, _songId: song.id, _isFirstOfSong: i === 0 });
      });
    });
    return allSlides.length > 0 ? allSlides : slides;
  }, [slides, state.activeSidebarType, state.activeSidebarId, state.playlists, state.librarySongs]);

  const { startHosting, joinSession, endSession, emitSync } = useSync(state, dispatch, slides);
  const { handleImportMedia, handleMediaClick: _handleMediaClick } = useMedia(state, dispatch, audioRef, videoRef);

  // Wrap handleMediaClick to also push video/overlay to output windows immediately
  const handleMediaClick = useCallback(async (mediaFile) => {
    _handleMediaClick(mediaFile);
    // Give dispatch a tick to update state, then push current selected slide + new media
    setTimeout(async () => {
      const isOverlay = mediaFile.category === 'overlay' || mediaFile.path?.toLowerCase().endsWith('.webm');
      // Always use .src (asset:// URL) to match what state.liveVideo stores —
      // so AudienceView gets the same string on slide clicks and media clicks
      const videoPath   = !isOverlay && mediaFile.type !== 'audio' ? (mediaFile.src || mediaFile.path) : state.liveVideo;
      const overlayPath = isOverlay ? (mediaFile.src || mediaFile.path) : state.activeOverlay;
      const slide = slides.find(s => s.id === state.selectedSlideId) || {};
      await pushToOutputs('audience-update', buildAudiencePayload(slide, videoPath, overlayPath, nextSlide, state.volume, state.fadeDuration));
    }, 0);
  }, [_handleMediaClick, state.liveVideo, state.activeOverlay, state.selectedSlideId, slides]);
  const { togglePlay, skipTime, handleVideoTimeUpdate, handleAudioTimeUpdate, formatTime } =
    useTransport(state, dispatch, videoRef, audioRef);

  // ── Persistence ───────────────────────────────────────────────
  const { loadPersistedData, saveData, cleanBlobUrls } = usePersistence(
    state, dispatch, getCurrentWindow().label
  );
  useEffect(() => { loadPersistedData(); }, []);
  // Auto-backup library to ~/Documents/ElevateFlow/library-backup.json
  useEffect(() => {
    const backup = async () => {
      try {
        const { homeDir } = await import('@tauri-apps/api/path');
        const { mkdir, writeTextFile } = await import('@tauri-apps/plugin-fs');
        const home = await homeDir();
        const dir  = `${home}Documents/ElevateFlow`;
        await mkdir(dir, { recursive: true }).catch(() => {});
        const data = JSON.stringify({
          version: 1,
          savedAt: new Date().toISOString(),
          libraries:  state.libraries,
          librarySongs: state.librarySongs,
          playlists:  state.playlists,
        }, null, 2);
        await writeTextFile(`${dir}/library-backup.json`, data);
      } catch {}
    };
    const t = setTimeout(backup, 2000); // debounce
    return () => clearTimeout(t);
  }, [state.libraries, state.librarySongs, state.playlists]);

  useEffect(() => { saveData(); }, [
    state.librarySongs, state.playlists, state.libraries,
    state.mediaFiles, state.audioFiles, state.audioPlaylists,
    state.activeItemId, state.activeSidebarId, state.activeSidebarType,
    state.stageLayouts, state.activeStageLayoutId,
  ]);
  useEffect(() => {
    const t = setTimeout(cleanBlobUrls, 1000);
    return () => clearTimeout(t);
  }, []);

  // ── Keyboard navigation ───────────────────────────────────────
  useEffect(() => {
    const onKeyDown = async (e) => {
      if (state.isTyping) return;

      // ── Global shortcuts (work in ANY mode) ──────────────────
      if (e.metaKey || e.ctrlKey) {
        if (e.key === ',') {
          e.preventDefault();
          import('@tauri-apps/api/webviewWindow').then(({ WebviewWindow }) => {
            WebviewWindow.getByLabel('settings').then(w => {
              if (w) { w.show(); w.setFocus(); }
              else new WebviewWindow('settings', { url: 'index.html#/settings', width: 600, height: 500, title: 'Settings', resizable: false, center: true });
            }).catch(() => {
              new WebviewWindow('settings', { url: 'index.html#/settings', width: 600, height: 500, title: 'Settings', resizable: false, center: true });
            });
          });
          return;
        }
        if (e.key === 't' || e.key === 'T') {
          e.preventDefault();
          import('@tauri-apps/api/webviewWindow').then(({ WebviewWindow }) => {
            WebviewWindow.getByLabel('timecode').then(w => {
              if (w) { w.show(); w.setFocus(); }
              else new WebviewWindow('timecode', { url: 'index.html#/timecode', width: 500, height: 600, title: 'Timecode', resizable: false, center: true });
            }).catch(() => {
              new WebviewWindow('timecode', { url: 'index.html#/timecode', width: 500, height: 600, title: 'Timecode', resizable: false, center: true });
            });
          });
          return;
        }
        if (e.key === '1') { e.preventDefault(); dispatch({ type: 'SET_MODE', payload: 'show' });  return; }
        if (e.key === '2') { e.preventDefault(); dispatch({ type: 'SET_MODE', payload: 'edit' });  return; }
        if (e.key === '3') { e.preventDefault(); dispatch({ type: 'SET_MODE', payload: 'stage' }); return; }
        if (e.key === '4') { e.preventDefault(); dispatch({ type: 'SET_MODE', payload: 'flow' });  return; }
      }

      // ── Show mode only ────────────────────────────────────────
      if (state.mode !== 'show' || !state.isHost) return;
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const idx = displayedItems.findIndex(s => s.id === state.activeItemId);
        if (e.key === 'ArrowDown' && idx < displayedItems.length - 1) {
          dispatch({ type: 'SET_ACTIVE_ITEM', payload: displayedItems[idx + 1].id });
        }
        if (e.key === 'ArrowUp' && idx > 0) {
          dispatch({ type: 'SET_ACTIVE_ITEM', payload: displayedItems[idx - 1].id });
        }
        e.preventDefault();
        return;
      }

      if (slides.length === 0) return;
      const idx = slides.findIndex(s => s.id === state.selectedSlideId);

      if (e.key === 'ArrowRight' && idx < slides.length - 1) {
        const next = slides[idx + 1];
        dispatch({ type: 'SET_SELECTED_SLIDE', payload: next.id });
        emitSync('CHANGE_SLIDE', { slideId: next.id });
        await pushToOutputs('audience-update', buildAudiencePayload(next, state.liveVideo, state.activeOverlay, slides[slides.findIndex(s => s.id === next.id) + 1], state.volume, state.fadeDuration));
      }
      if (e.key === 'ArrowLeft' && idx > 0) {
        const prev = slides[idx - 1];
        dispatch({ type: 'SET_SELECTED_SLIDE', payload: prev.id });
        emitSync('CHANGE_SLIDE', { slideId: prev.id });
        await pushToOutputs('audience-update', buildAudiencePayload(prev, state.liveVideo, state.activeOverlay, slides[slides.findIndex(s => s.id === prev.id) + 1], state.volume, state.fadeDuration));
      }
      // ── Hotkey slide trigger ───────────────────────────────────
      const key = e.key.toLowerCase();
      if (/^[a-z]$/.test(key) && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const slideId = state.hotkeys?.[key];
        if (slideId) {
          // Find the slide across all songs
          let hotkeySlide = null;
          for (const song of state.librarySongs) {
            const found = song.slides?.find(s => s.id === slideId);
            if (found) { hotkeySlide = found; break; }
          }
          if (hotkeySlide) {
            dispatch({ type: 'SET_SELECTED_SLIDE', payload: slideId });
            const vidPath = hotkeySlide.video || state.liveVideo || null;
            const ovrPath = hotkeySlide.overlay || state.activeOverlay || null;
            const idx2 = displaySlides.findIndex(s => s.id === slideId);
            const nxt  = idx2 >= 0 ? displaySlides[idx2 + 1] : null;
            await pushToOutputs('audience-update', buildAudiencePayload(hotkeySlide, vidPath, ovrPath, nxt, state.volume, state.fadeDuration));
            e.preventDefault();
            return;
          }
        }
      }

      if (e.key === 'Escape') {
        dispatch({ type: 'SET_SELECTED_SLIDE', payload: null });
        dispatch({ type: 'SET_LIVE_VIDEO',     payload: null });
        dispatch({ type: 'SET_ACTIVE_OVERLAY', payload: null });
        emitSync('CLEAR_ALL', {});
        await pushToOutputs('audience-clear');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [state.selectedSlideId, state.mode, state.isHost, state.isTyping,
      state.liveVideo, state.activeOverlay, slides, displayedItems, dispatch, emitSync, sendToAudience]);

  // ── Slide click — fires trigger audio if assigned ─────────────
  const handleSlideClick = useCallback(async (slide) => {
    dispatch({ type: 'SET_SELECTED_SLIDE', payload: slide.id });

    // Switch active song if clicking a slide from a different song (playlist view)
    if (slide._songId && slide._songId !== state.activeItemId) {
      dispatch({ type: 'SET_ACTIVE_ITEM', payload: slide._songId });
    }

    if (slide.video) {
      dispatch({ type: 'SET_LIVE_VIDEO',    payload: slide.video });
      dispatch({ type: 'SET_TRANSPORT_TAB', payload: 'video' });
    }

    // Fire trigger audio if assigned to this slide
    if (slide.triggerAudio) {
      dispatch({ type: 'SET_ACTIVE_AUDIO_URL', payload: slide.triggerAudio.src });
      dispatch({ type: 'SET_TRANSPORT_TAB',    payload: 'audio' });
      dispatch({ type: 'SET_IS_AUDIO_PLAYING', payload: true });
      if (audioRef?.current) {
        audioRef.current.src = slide.triggerAudio.src;
        audioRef.current.play().catch(() => {});
      }
    }

    emitSync('CHANGE_SLIDE', { slideId: slide.id });
    const videoPath   = slide.video   || state.liveVideo   || null;
    const overlayPath = slide.overlay || state.activeOverlay || null;
    // Find next slide from displaySlides (works in playlist view across songs)
    const displayIdx  = displaySlides.findIndex(s => s.id === slide.id);
    const realNext    = displayIdx >= 0 ? displaySlides[displayIdx + 1] : nextSlide;
    await pushToOutputs('audience-update', buildAudiencePayload(slide, videoPath, overlayPath, realNext, state.volume, state.fadeDuration));
  }, [dispatch, emitSync, audioRef, state.liveVideo, state.activeOverlay, state.activeItemId, nextSlide, displaySlides]);

  // ── Ref for pending Finder→slide drop (avoids stale closure) ─
  const pendingDropSlideRef = useRef(null);
  const assignMediaRef = useRef(assignMediaToSlide);
  useEffect(() => { assignMediaRef.current = assignMediaToSlide; }, [assignMediaToSlide]);
  const ndiSlideRef    = useRef(null);
  const ndiLiveVideoRef = useRef(null);

  // Expose current state for audience window initialization
  // Toolbar reads this ref when audience launches to push current slide/video
  React.useEffect(() => {
    window._efCurrentPayload = buildAudiencePayload(
      selectedSlide, state.liveVideo, state.activeOverlay, nextSlide, state.volume, state.fadeDuration
    );
  }, [selectedSlide, state.liveVideo, state.activeOverlay, nextSlide, state.volume, state.fadeDuration]);

  // Push stage layout to stage window whenever active layout changes
  useEffect(() => {
    const layout = state.stageLayouts?.find(l => l.id === state.activeStageLayoutId);
    if (!layout) return;
    pushToOutputs('stage-config', { layout }).catch?.(() => {});
  }, [state.activeStageLayoutId, state.stageLayouts]);

  // Push slide TC cues to timecode window whenever slides change
  useEffect(() => {
    const tcCues = slides
      .filter(s => s.timecode)
      .map(s => ({ id: s.id, tc: s.timecode, label: s.text?.split('\n')[0]?.slice(0,40) || 'Slide', slideId: s.id }));
    if (!tcCues.length) return;
    import('@tauri-apps/api/event').then(({ emitTo }) =>
      emitTo('timecode', 'slide-cues-updated', { cues: tcCues }).catch(() => {})
    );
  }, [slides]);

  // Show trailer after splash — go fullscreen for it
  useEffect(() => {
    let unlisten;
    import('@tauri-apps/api/event').then(({ listen: listenFn }) => {
      listenFn('splash-done', async () => {
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window');
          await getCurrentWindow().setFullscreen(true);
        } catch {}
        // Try to play trailer, fall back to tutorial directly if file missing
        setShowTrailer(true);
      }).then(f => { unlisten = f; });
    });
    return () => { unlisten?.(); };
  }, []);

  // Listen for Import .ef from menu bar
  useEffect(() => {
    let unlisten;
    import('@tauri-apps/api/event').then(({ listen: listenFn }) => {
      listenFn('menu-import-ef', async () => {
        try {
          const { importEfFile } = await import('./hooks/useEfFiles');
          const song = await importEfFile();
          if (song) dispatch({ type: 'SET_IMPORT_EF_PENDING', payload: song });
        } catch (e) { console.error(e); }
      }).then(f => { unlisten = f; });
    });
    return () => { unlisten?.(); };
  }, [dispatch]);

  // Listen for Windowed Output menu item
  useEffect(() => {
    let unlisten;
    import('@tauri-apps/api/event').then(({ listen: listenFn }) => {
      listenFn('menu-windowed-output', () => setShowWindowedPicker(true))
        .then(f => { unlisten = f; });
    });
    return () => { unlisten?.(); };
  }, []);

  // Timecode trigger — fires a specific slide when TC matches
  useEffect(() => {
    let unlisten;
    import('@tauri-apps/api/event').then(({ listen: listenFn }) => {
      listenFn('timecode-trigger', async (e) => {
        const { slideId } = e.payload;
        if (!slideId) return;
        // Find the slide in current song
        const slide = slides.find(s => s.id === slideId);
        if (!slide) return;
        dispatch({ type: 'SET_SELECTED_SLIDE', payload: slideId });
        const videoPath   = slide.video   || state.liveVideo   || null;
        const overlayPath = slide.overlay || state.activeOverlay || null;
        await pushToOutputs('audience-update',
          buildAudiencePayload(slide, videoPath, overlayPath, null, state.volume, state.fadeDuration)
        );
      }).then(f => { unlisten = f; });
    });
    return () => { unlisten?.(); };
  }, [slides, state.liveVideo, state.activeOverlay, state.volume, state.fadeDuration, dispatch]);

  // Respond to stage window requesting current config on mount
  useEffect(() => {
    let unlisten;
    import('@tauri-apps/api/event').then(({ listen: listenFn, emitTo }) => {
      listenFn('stage-request-config', () => {
        const layout = state.stageLayouts?.find(l => l.id === state.activeStageLayoutId);
        if (layout) emitTo('*', 'stage-config', { layout }).catch(() => {});
      }).then(f => { unlisten = f; });
    });
    return () => { unlisten?.(); };
  }, [state.stageLayouts, state.activeStageLayoutId]);

  // Keep NDI refs in sync
  useEffect(() => { ndiSlideRef.current = selectedSlide; }, [selectedSlide]);
  useEffect(() => { ndiLiveVideoRef.current = state.liveVideo; }, [state.liveVideo]);

  // Keep video audio in sync with liveVideo and volume
  useEffect(() => {
    const el = videoAudioRef.current;
    if (!el) return;
    if (state.liveVideo) {
      if (el.src !== state.liveVideo) {
        el.src = state.liveVideo;
        el.play().catch(() => {});
      }
      el.volume = state.volume ?? 1;
    } else {
      el.src = '';
      el.pause();
    }
  }, [state.liveVideo, state.volume]);

  // Sync video seek to hidden audio element
  useEffect(() => {
    const preview = videoRef.current;
    const audio   = videoAudioRef.current;
    if (!preview || !audio) return;
    const onSeek = () => {
      if (Math.abs(audio.currentTime - preview.currentTime) > 0.3) {
        audio.currentTime = preview.currentTime;
      }
    };
    preview.addEventListener('seeked', onSeek);
    return () => preview.removeEventListener('seeked', onSeek);
  }, []);

  // ── Media drop from custom drag system ───────────────────────
  // MediaBin cards call startDrag() on mousedown.
  // SlideGrid drop zones call this with (url, slideId).
  const onDropMedia = useCallback((urlOrEvent, slideId) => {
    // Custom drag system — called as (url_string, slideId)
    if (typeof urlOrEvent === 'string' && slideId) {
      assignMediaToSlide(slideId, urlOrEvent);
      return;
    }
    // If called with just an object (data from dragSystem handler)
    if (urlOrEvent && typeof urlOrEvent === 'object' && !urlOrEvent.preventDefault && slideId) {
      const url = urlOrEvent.src || urlOrEvent.path;
      if (url) { assignMediaToSlide(slideId, url); return; }
    }
  }, [assignMediaToSlide]);

  // onDragStart kept for any legacy callers — no-op since MediaBin uses custom system
  const onDragStart = useCallback(() => {}, []);

  const [dragHoverSlideId, setDragHoverSlideId] = useState(null);

  // ── Copy / Paste style ────────────────────────────────────────
  const handleCopyStyle = useCallback(() => {
    if (!selectedSlide) return;
    const styleKeys = ['fontFamily','fontSize','fontWeight','textColor','transform','italic','underline','strikethrough','lineSpacing'];
    const style = {};
    styleKeys.forEach(k => { style[k] = selectedSlide[k]; });
    dispatch({ type: 'SET_STYLE_CLIPBOARD', payload: style });
  }, [selectedSlide, dispatch]);

  const handlePasteStyle = useCallback(() => {
    if (!state.styleClipboard || !selectedSlide) return;
    Object.entries(state.styleClipboard).forEach(([k, v]) => {
      if (v !== undefined) updateSlideStyle(k, v);
    });
  }, [state.styleClipboard, selectedSlide, updateSlideStyle]);
  // ── Export active song as .ef ─────────────────────────────────
  const handleExportEf = useCallback(async () => {
    if (!activeSong) return;
    try { await exportSongAsEf(activeSong); }
    catch (err) { console.error('[EF Export]', err); }
  }, [activeSong]);

  // ── Import .ef file ───────────────────────────────────────────
  const handleImportEf = useCallback(async () => {
    try {
      const song = await importEfFile();
      if (!song) return;
      dispatch({ type: 'SET_IMPORT_EF_PENDING', payload: song });
    } catch (err) {
      console.error('[EF Import]', err);
      alert(`Could not import file: ${err.message}`);
    }
  }, [dispatch]);

  const handleImportEfConfirm = useCallback(({ song, destType, destId }) => {
    const newSong = {
      id:    Date.now() + Math.random(),
      title: song.title,
      slides: song.slides,
      libId:      destType === 'library'  ? destId : undefined,
      playlistId: destType === 'playlist' ? destId : undefined,
    };
    dispatch({ type: 'ADD_SONG',              payload: newSong });
    dispatch({ type: 'SET_ACTIVE_ITEM',       payload: newSong.id });
    dispatch({ type: 'SET_IMPORT_EF_PENDING', payload: null });
  }, [dispatch]);

  const clearAll = useCallback(async () => {
    dispatch({ type: 'SET_SELECTED_SLIDE', payload: null });
    dispatch({ type: 'SET_LIVE_VIDEO',     payload: null });
    dispatch({ type: 'SET_ACTIVE_OVERLAY', payload: null });
    emitSync('CLEAR_ALL', {});
    await pushToOutputs('audience-clear');
  }, [dispatch, emitSync]);



  // ─────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────

  const isEditMode        = state.mode === 'edit';
  const isStageMode       = state.mode === 'stage';
  const isFlowMode        = state.mode === 'flow';
  const isGraphicsMode    = state.mode === 'graphics';
  const isThemeEditorMode = state.mode === 'theme-editor';
  const isShowMode        = !isEditMode && !isStageMode && !isFlowMode && !isGraphicsMode && !isThemeEditorMode;

  // ── NDI frame capture loop ────────────────────────────────────
  useEffect(() => {
    const NDI_W = 640;
    const NDI_H = 360;

    const canvas = document.createElement('canvas');
    canvas.width  = NDI_W;
    canvas.height = NDI_H;
    const ctx = canvas.getContext('2d');

    const bgVideo = document.createElement('video');
    bgVideo.muted = true; bgVideo.loop = true; bgVideo.autoplay = true;
    bgVideo.style.display = 'none';
    document.body.appendChild(bgVideo);

    let lastVideoSrc = null;
    let ndiActive    = { audience: false, stage: false };
    let sending      = false; // skip frame if previous IPC still in flight

    const statusInterval = setInterval(async () => {
      try { ndiActive = await invoke('ndi_status'); } catch {}
    }, 2000);
    invoke('ndi_status').then(s => { ndiActive = s; }).catch(() => {});

    const frameInterval = setInterval(() => {
      if (!ndiActive.audience && !ndiActive.stage) return;
      if (sending) return; // don't pile up frames

      const slide    = ndiSlideRef.current;
      const videoSrc = ndiLiveVideoRef.current || slide?.video || null;

      if (videoSrc !== lastVideoSrc) {
        lastVideoSrc = videoSrc;
        if (videoSrc) {
          const resolved = videoSrc.startsWith('asset://') || videoSrc.startsWith('http')
            ? videoSrc : convertFileSrc(videoSrc);
          bgVideo.src = resolved;
          bgVideo.play().catch(() => {});
        } else {
          bgVideo.src = '';
        }
      }

      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, NDI_W, NDI_H);

      if (videoSrc && bgVideo.readyState >= 2 && bgVideo.videoWidth > 0) {
        try { ctx.drawImage(bgVideo, 0, 0, NDI_W, NDI_H); } catch {}
      }

      if (slide?.text) {
        const fontSize = Math.round(NDI_W * (slide.fontSize || 5) / 100);
        ctx.font         = `${slide.fontWeight || 800} ${fontSize}px ${slide.fontFamily || 'Arial'}`;
        ctx.fillStyle    = slide.textColor || '#fff';
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor  = 'rgba(0,0,0,0.9)';
        ctx.shadowBlur   = 8;
        const lines  = slide.text.split('\n');
        const lineH  = fontSize * (slide.lineSpacing || 1.2);
        const startY = NDI_H / 2 - (lines.length - 1) * lineH / 2;
        lines.forEach((line, i) => {
          const txt = slide.transform === 'uppercase' ? line.toUpperCase()
                    : slide.transform === 'lowercase' ? line.toLowerCase()
                    : line;
          ctx.fillText(txt, NDI_W / 2, startY + i * lineH);
        });
        ctx.shadowBlur = 0;
      }

      const b64 = canvas.toDataURL('image/jpeg', 0.5).split(',')[1];
      sending = true;
      const sends = [];
      if (ndiActive.audience) sends.push(invoke('ndi_send_frame', { role: 'audience', pixelsB64: b64, width: NDI_W, height: NDI_H }));
      if (ndiActive.stage)    sends.push(invoke('ndi_send_frame', { role: 'stage',    pixelsB64: b64, width: NDI_W, height: NDI_H }));
      Promise.all(sends).catch(() => {}).finally(() => { sending = false; });

    }, 1000 / 8); // 8fps — stable for lyrics

    return () => {
      clearInterval(statusInterval);
      clearInterval(frameInterval);
      bgVideo.remove();
    };
  }, []);

  return (
    <div
      className="app"
      onMouseUp={() => dispatch({ type: 'SET_INTERACTION_MODE', payload: null })}
      onMouseLeave={() => dispatch({ type: 'SET_INTERACTION_MODE', payload: null })}
    >
      {/* Audio element is fully uncontrolled — src set imperatively in playTrack */}
      <UpdateNotifier update={update} onDismiss={dismissUpdate} />
      {showWindowedPicker && <WindowedOutputPicker onClose={() => setShowWindowedPicker(false)} />}
      {showTrailer && (
        <TrailerVideo onDone={async () => {
          setShowTrailer(false);
          try {
            const { getCurrentWindow } = await import('@tauri-apps/api/window');
            await getCurrentWindow().setFullscreen(false);
          } catch {}
          setShowTutorial(true);
        }} />
      )}
      {showTutorial && <Tutorial onClose={() => setShowTutorial(false)} />}

      {showAI && (
        <AIAssistant
          state={state}
          dispatch={dispatch}
          onClose={() => setShowAI(false)}
        />
      )}

      {showTextImport && (
        <TextImport
          state={state}
          onImport={handleTextImport}
          onClose={() => setShowTextImport(false)}
        />
      )}

      {showPP7Importer && (
        <PP7Importer
          onImport={handlePP7Import}
          onClose={() => setShowPP7Importer(false)}
        />
      )}

      <audio
        ref={audioRef}
        onPlay={() => dispatch({ type: 'SET_IS_AUDIO_PLAYING', payload: true })}
        onPause={() => dispatch({ type: 'SET_IS_AUDIO_PLAYING', payload: false })}
        onTimeUpdate={handleAudioTimeUpdate}
        onLoadedMetadata={handleAudioTimeUpdate}
      />
      {/* Hidden video that provides audio output in main window.
          Audience windows have their video muted to avoid doubling. */}
      <video
        ref={videoAudioRef}
        src={state.liveVideo || undefined}
        style={{ display: 'none' }}
        autoPlay
        loop
        volume={state.volume ?? 1}
        onVolumeChange={e => { if (e.target) e.target.volume = state.volume ?? 1; }}
      />

      <Toolbar
        state={state} dispatch={dispatch}
        selectedSlide={selectedSlide}
        updateSlideStyle={updateSlideStyle}
        onImportEf={handleImportEf}
        activeSong={activeSong}
        showMediaBin={showMediaBin}
        onToggleMediaBin={() => setShowMediaBin(p => !p)}
        onImportPP7={() => setShowPP7Importer(true)}
        onTextImport={() => setShowTextImport(true)}
        onToggleAI={() => setShowAI(p => !p)}
        showAI={showAI}
      />

      {/* ── SHOW / STAGE MODE ── */}
      {isShowMode && (
        <ResizableLayout state={state} dispatch={dispatch}
          slides={slides} displaySlides={displaySlides} activeSong={activeSong}
          handleSlideClick={handleSlideClick} addSlide={addSlide}
          duplicateSlide={duplicateSlide} copySlide={copySlide}
          cutSlide={cutSlide} pasteSlide={pasteSlide}
          setSlideGroup={setSlideGroup} deleteSlide={deleteSlide}
          onDropMedia={onDropMedia} assignTriggerToSlide={assignTriggerToSlide}
          setDragHoverSlideId={setDragHoverSlideId}
          selectedSlide={selectedSlide} nextSlide={nextSlide}
          videoRef={videoRef} audioRef={audioRef}
          togglePlay={togglePlay} skipTime={skipTime} formatTime={formatTime}
          clearAll={clearAll}
          handleVideoTimeUpdate={handleVideoTimeUpdate}
          handleAudioTimeUpdate={handleAudioTimeUpdate}
          handleImportMedia={handleImportMedia}
          handleMediaClick={handleMediaClick}
          onDragStart={onDragStart}
          displayedItems={displayedItems}
          startHosting={startHosting} joinSession={joinSession} endSession={endSession}
          showMediaBin={showMediaBin}
        />
      )}

      {/* ── EDIT MODE ── */}
      {isEditMode && (
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <EditMode
            state={state} dispatch={dispatch}
            slides={slides}
            selectedSlide={selectedSlide}
            updateSlideText={updateSlideText}
            updateSlideStyle={updateSlideStyle}
            updateSlideStyles={updateSlideStyles}
            applyTransform={applyTransform}
            onCopyStyle={handleCopyStyle}
            onPasteStyle={handlePasteStyle}
          />
        </div>
      )}

      {/* ── STAGE MODE ── */}
      {isStageMode && (
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <StageMode state={state} dispatch={dispatch} />
        </div>
      )}

      {/* ── FLOW MODE ── */}
      {isFlowMode && (
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <FlowEditor
            state={state}
            dispatch={dispatch}
            slides={slides}
            onUpdateSlides={(newSlides) => {
              if (state.activeItemId) {
                dispatch({ type: 'UPDATE_SONG', payload: { id: state.activeItemId, slides: newSlides } });
              }
            }}
          />
        </div>
      )}

      {/* ── THEME EDITOR MODE ── */}
      {isThemeEditorMode && (
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <ThemeEditor dispatch={dispatch} />
        </div>
      )}

      {/* ── GRAPHICS MODE ── */}
      {isGraphicsMode && (
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <GraphicsMode
            state={state} dispatch={dispatch}
            mediaFiles={state.mediaFiles}
          />
        </div>
      )}

      {/* ── IMPORT .EF MODAL ── */}
      {state.importEfPending && (
        <ImportEfModal
          song={state.importEfPending}
          libraries={state.libraries}
          playlists={state.playlists}
          onConfirm={handleImportEfConfirm}
          onCancel={() => dispatch({ type: 'SET_IMPORT_EF_PENDING', payload: null })}
        />
      )}
    </div>
  );
}