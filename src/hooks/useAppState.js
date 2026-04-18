/**
 * useAppState.js
 * Central state management for ElevateFlow
 * Replaces the monolithic state block in App.jsx
 */
import { useReducer, useCallback } from 'react';

const initialState = {
  // Navigation
  mode: 'show',
  activePreview: 'Audience',
  activeInspectorTab: 'Shape',
  activeControlTab: 'music',
  mediaBinTab: 'backgrounds',
  transportTab: 'video',

  // Libraries & Playlists
  libraries: [],
  playlists: [],
  librarySongs: [],
  activeSidebarId: null,
  activeSidebarType: 'lib',
  activeItemId: null,
  activeArrangement: 'Master',
  showArrangements: false,

  // Slides
  selectedSlideId: null,
  selectedSlideIds: [], // multi-select
  isObjectSelected: false,
  isTyping: false,
  interactionMode: null,
  clipboard: null,
  contextMenu: null,

  // Decks
  decks: [{ id: 'default', name: 'DEFAULT' }],
  activeDeckId: 'default',

  // Media
  mediaFiles: [],
  audioFiles: [],
  activeAudioUrl: null,
  liveVideo: null,
  liveMediaType: 'video', // 'video' | 'image'
  activeOverlay: null,

  // Transport
  isPlaying: false,
  isAudioPlaying: false,
  currentTime: 0,
  duration: 0,
  audioCurrentTime: 0,
  audioDuration: 0,
  volume: 1,

  // Audio Playlists
  audioPlaylists: [],
  selectedAudioPlaylistId: null,
  editingAudioId: null,

  // Firebase Sync
  isSynced: false,
  isHost: true,
  sessionCode: '',
  inputCode: '',
  remoteSlideData: null,
  isSyncPanelVisible: false,

  // Stage Layouts
  stageLayouts: [
    {
      id: 'default',
      name: 'Default',
      elements: [
        { id: 'e1', type: 'currentSlide', x: 2,  y: 2,  w: 96, h: 54, fontSize: 1,   color: '#ffffff', bgColor: 'transparent', showLabel: false },
        { id: 'e2', type: 'nextSlide',    x: 2,  y: 58, w: 64, h: 28, fontSize: 0.7, color: '#ffff00', bgColor: 'transparent', showLabel: true  },
        { id: 'e3', type: 'clock',        x: 68, y: 58, w: 30, h: 14, fontSize: 1.4, color: '#D4AF37', bgColor: 'transparent', showLabel: true  },
        { id: 'e4', type: 'timer',        x: 68, y: 74, w: 30, h: 14, fontSize: 1.4, color: '#00e87a', bgColor: 'transparent', showLabel: true  },
      ],
    },
  ],
  activeStageLayoutId: 'default',

  // Stage Monitor
  stageMessage: '',
  timerSeconds: 600, // default 10 min
  timerRunning: false,
  timerInitialSeconds: 600,
  showTimeline: false,
  pendingDropSlideId: null,
  styleClipboard: null,
  importEfPending: null,
  fadeDuration: 0.5, // seconds for media fade in/out
  canvasRatio: '16 / 9',
  timelinePlaying:  false,
  timelineLoop:     false,
  timelineDuration: null,   // null = auto-calculate
  slideCueTimes:    {},     // { [slideId]: seconds }
  slideCardSize: 180, // slide card width in px
  // Hotkeys: { [key: string]: slideId }  e.g. { 'v': 'slide-123' }
  hotkeys: {},
  // Presentation Mode
  isPresentationHost:    false,
  isPresentationClient:  false,
  presentationHostAddress: null,
  showJoinDialog:        false,
  // Remote slide (received from host as client)
  remoteSlide:   null,
  remoteVideo:   null,
  remoteOverlay: null,

  // Edit Mode
  dragOffset: { x: 0, y: 0 },
  previewVideo: null,
  underscanScale: 1,

  // UI State
  showPreviewDropdown: false,
  editingId: null,
  editValue: '',
  hoveringGroup: false,
};

function reducer(state, action) {
  switch (action.type) {
    // ─── Navigation ────────────────────────────────────────────
    case 'SET_MODE': return { ...state, mode: action.payload };
    case 'SET_ACTIVE_PREVIEW': return { ...state, activePreview: action.payload };
    case 'SET_INSPECTOR_TAB': return { ...state, activeInspectorTab: action.payload };
    case 'SET_CONTROL_TAB': return { ...state, activeControlTab: action.payload };
    case 'SET_MEDIA_BIN_TAB': return { ...state, mediaBinTab: action.payload };
    case 'SET_TRANSPORT_TAB': return { ...state, transportTab: action.payload };
    case 'TOGGLE_PREVIEW_DROPDOWN': return { ...state, showPreviewDropdown: !state.showPreviewDropdown };
    case 'CLOSE_PREVIEW_DROPDOWN': return { ...state, showPreviewDropdown: false };

    // ─── Libraries ─────────────────────────────────────────────
    case 'SET_LIBRARIES': return { ...state, libraries: action.payload };
    case 'ADD_LIBRARY': return { ...state, libraries: [...state.libraries, action.payload] };
    case 'SET_PLAYLISTS': return { ...state, playlists: action.payload };
    case 'ADD_PLAYLIST': return { ...state, playlists: [...state.playlists, action.payload] };
    case 'UPDATE_PLAYLIST': return {
      ...state,
      playlists: state.playlists.map(p => p.id === action.payload.id ? { ...p, ...action.payload } : p),
    };
    case 'SET_LIBRARY_SONGS': return { ...state, librarySongs: action.payload };
    case 'ADD_SONG': return { ...state, librarySongs: [...state.librarySongs, action.payload] };
    case 'DELETE_LIBRARY': return {
      ...state,
      libraries: state.libraries.filter(l => l.id !== action.payload),
      librarySongs: state.librarySongs.filter(s => s.libId !== action.payload),
    };
    case 'DELETE_PLAYLIST': return {
      ...state,
      playlists: state.playlists.filter(p => p.id !== action.payload),
    };
    case 'UPDATE_SONG': return {
      ...state,
      librarySongs: state.librarySongs.map(s => s.id === action.payload.id ? { ...s, ...action.payload } : s),
    };
    case 'DELETE_SONG': return { ...state, librarySongs: state.librarySongs.filter(s => s.id !== action.payload) };
    case 'SET_ACTIVE_SIDEBAR': return {
      ...state,
      activeSidebarId: action.payload.id,
      activeSidebarType: action.payload.type,
    };
    case 'SET_ACTIVE_ITEM': return { ...state, activeItemId: action.payload };
    case 'SET_ARRANGEMENT': return { ...state, activeArrangement: action.payload };
    case 'TOGGLE_ARRANGEMENTS': return { ...state, showArrangements: !state.showArrangements };

    // ─── Slides ────────────────────────────────────────────────
    case 'SET_SELECTED_SLIDE': return { ...state, selectedSlideId: action.payload };
    case 'SET_SELECTED_SLIDE_IDS': return { ...state, selectedSlideIds: action.payload };
    case 'ADD_SELECTED_SLIDE_ID': return {
      ...state,
      selectedSlideIds: state.selectedSlideIds.includes(action.payload)
        ? state.selectedSlideIds
        : [...state.selectedSlideIds, action.payload],
    };
    case 'UPDATE_SONG_SLIDES': return {
      ...state,
      librarySongs: state.librarySongs.map(s =>
        s.id === state.activeItemId ? { ...s, slides: action.payload } : s
      ),
    };
    case 'SET_OBJECT_SELECTED': return { ...state, isObjectSelected: action.payload };
    case 'SET_TYPING': return { ...state, isTyping: action.payload };
    case 'SET_INTERACTION_MODE': return { ...state, interactionMode: action.payload };
    case 'SET_CLIPBOARD': return { ...state, clipboard: action.payload };
    case 'SET_CONTEXT_MENU': return { ...state, contextMenu: action.payload };
    case 'SET_DRAG_OFFSET': return { ...state, dragOffset: action.payload };

    // ─── Decks ─────────────────────────────────────────────────
    case 'ADD_DECK': return { ...state, decks: [...state.decks, action.payload] };
    case 'UPDATE_DECK': return {
      ...state,
      decks: state.decks.map(d => d.id === action.payload.id ? { ...d, ...action.payload } : d),
    };
    case 'SET_ACTIVE_DECK': return { ...state, activeDeckId: action.payload };

    // ─── Media ─────────────────────────────────────────────────
    case 'SET_MEDIA_FILES': return { ...state, mediaFiles: action.payload };
    case 'ADD_MEDIA_FILES': return { ...state, mediaFiles: [...state.mediaFiles, ...action.payload] };
    case 'ADD_MEDIA_FILE':  return { ...state, mediaFiles: [...state.mediaFiles, action.payload] };
    case 'DELETE_MEDIA_FILE': return { ...state, mediaFiles: state.mediaFiles.filter(f => f.id !== action.payload) };
    case 'UPDATE_MEDIA_FILE': return { ...state, mediaFiles: state.mediaFiles.map(f => f.id === action.payload.id ? { ...f, ...action.payload } : f) };
    case 'UPDATE_AUDIO_FILE': return { ...state, audioFiles: state.audioFiles.map(f => f.id === action.payload.id ? { ...f, ...action.payload } : f) };
    case 'SET_AUDIO_FILES': return { ...state, audioFiles: action.payload };
    case 'ADD_AUDIO_FILES': return { ...state, audioFiles: [...state.audioFiles, ...action.payload] };
    case 'ADD_AUDIO_FILE':  return { ...state, audioFiles: [...state.audioFiles, action.payload] };
    case 'SET_LIVE_VIDEO': return { ...state, liveVideo: action.payload };
    case 'SET_MEDIA_TYPE': return { ...state, liveMediaType: action.payload };
    case 'SET_ACTIVE_AUDIO_URL': return { ...state, activeAudioUrl: action.payload };
    case 'SET_ACTIVE_OVERLAY': return { ...state, activeOverlay: action.payload };
    case 'TOGGLE_OVERLAY': return {
      ...state,
      activeOverlay: state.activeOverlay === action.payload ? null : action.payload,
    };

    // ─── Transport ─────────────────────────────────────────────
    case 'SET_IS_PLAYING': return { ...state, isPlaying: action.payload };
    case 'SET_IS_AUDIO_PLAYING': return { ...state, isAudioPlaying: action.payload };
    case 'SET_CURRENT_TIME': return { ...state, currentTime: action.payload };
    case 'SET_DURATION': return { ...state, duration: action.payload };
    case 'SET_AUDIO_CURRENT_TIME': return { ...state, audioCurrentTime: action.payload };
    case 'SET_AUDIO_DURATION': return { ...state, audioDuration: action.payload };
    case 'SET_VOLUME': return { ...state, volume: action.payload };

    // ─── Audio Playlists ───────────────────────────────────────
    case 'SET_AUDIO_PLAYLISTS': return { ...state, audioPlaylists: action.payload };
    case 'ADD_AUDIO_PLAYLIST': return { ...state, audioPlaylists: [...state.audioPlaylists, action.payload] };
    case 'UPDATE_AUDIO_PLAYLIST': return {
      ...state,
      audioPlaylists: state.audioPlaylists.map(p =>
        p.id === action.payload.id ? { ...p, ...action.payload } : p
      ),
    };
    case 'SET_SELECTED_AUDIO_PLAYLIST': return { ...state, selectedAudioPlaylistId: action.payload };
    case 'SET_EDITING_AUDIO_ID': return { ...state, editingAudioId: action.payload };

    // ─── Firebase Sync ─────────────────────────────────────────
    case 'SET_SYNCED': return { ...state, isSynced: action.payload };
    case 'SET_IS_HOST': return { ...state, isHost: action.payload };
    case 'SET_SESSION_CODE': return { ...state, sessionCode: action.payload };
    case 'SET_INPUT_CODE': return { ...state, inputCode: action.payload };
    case 'SET_REMOTE_SLIDE_DATA': return { ...state, remoteSlideData: action.payload };
    case 'SET_SYNC_PANEL_VISIBLE': return { ...state, isSyncPanelVisible: action.payload };
    case 'TOGGLE_SYNC_PANEL': return { ...state, isSyncPanelVisible: !state.isSyncPanelVisible };
    case 'END_SESSION': return {
      ...state,
      sessionCode: '',
      isSynced: false,
      isHost: true,
      inputCode: '',
      remoteSlideData: null,
    };

    // ─── Edit UI ───────────────────────────────────────────────
    case 'START_RENAME': return { ...state, editingId: action.payload.id, editValue: action.payload.value };
    case 'SET_EDIT_VALUE': return { ...state, editValue: action.payload };
    case 'CLEAR_RENAME': return { ...state, editingId: null, editValue: '' };
    case 'SAVE_RENAME_LIB': return {
      ...state,
      libraries: state.libraries.map(i => i.id === action.payload.id ? { ...i, title: action.payload.value } : i),
      editingId: null,
    };
    case 'SAVE_RENAME_PL': return {
      ...state,
      playlists: state.playlists.map(i => i.id === action.payload.id ? { ...i, title: action.payload.value } : i),
      editingId: null,
    };
    // Add song reference to a playlist (song stays in library too)
    case 'ADD_SECTION_TO_PLAYLIST': {
      const { playlistId, section } = action.payload;
      return {
        ...state,
        playlists: state.playlists.map(p =>
          p.id === playlistId
            ? { ...p, sections: [...(p.sections || []), section] }
            : p
        ),
      };
    }
    case 'RENAME_SECTION': {
      const { playlistId, sectionId, title } = action.payload;
      return {
        ...state,
        playlists: state.playlists.map(p =>
          p.id === playlistId
            ? { ...p, sections: (p.sections||[]).map(s => s.id === sectionId ? {...s, title} : s) }
            : p
        ),
      };
    }
    case 'DELETE_SECTION': {
      const { playlistId, sectionId } = action.payload;
      return {
        ...state,
        playlists: state.playlists.map(p =>
          p.id === playlistId
            ? { ...p, sections: (p.sections||[]).filter(s => s.id !== sectionId) }
            : p
        ),
      };
    }
    case 'ADD_SONG_TO_PLAYLIST': {
      const { songId, playlistId } = action.payload;
      return {
        ...state,
        playlists: state.playlists.map(p =>
          p.id === playlistId
            ? { ...p, songIds: [...new Set([...(p.songIds || []), songId])] }
            : p
        ),
      };
    }
    // Move song to a different library
    case 'MOVE_SONG_TO_LIB': {
      const { songId, libId } = action.payload;
      return {
        ...state,
        librarySongs: state.librarySongs.map(s =>
          s.id === songId ? { ...s, libId } : s
        ),
      };
    }
    // Remove song from playlist
    case 'REMOVE_SONG_FROM_PLAYLIST': {
      const { songId, playlistId } = action.payload;
      return {
        ...state,
        playlists: state.playlists.map(p =>
          p.id === playlistId
            ? { ...p, songIds: (p.songIds || []).filter(id => id !== songId) }
            : p
        ),
      };
    }
    case 'SAVE_RENAME_SONG': return {
      ...state,
      librarySongs: state.librarySongs.map(i => i.id === action.payload.id ? { ...i, title: action.payload.value } : i),
      editingId: null,
    };
    case 'SET_UNDERSCAN_SCALE': return { ...state, underscanScale: action.payload };
    case 'SET_HOVERING_GROUP': return { ...state, hoveringGroup: action.payload };
    case 'ADD_STAGE_LAYOUT': return {
      ...state,
      stageLayouts: [...state.stageLayouts, action.payload],
      activeStageLayoutId: action.payload.id,
    };
    case 'UPDATE_STAGE_LAYOUT': return {
      ...state,
      stageLayouts: state.stageLayouts.map(l =>
        l.id === action.payload.id ? { ...l, ...action.payload } : l
      ),
    };
    case 'DELETE_STAGE_LAYOUT': {
      const remaining = state.stageLayouts.filter(l => l.id !== action.payload);
      return {
        ...state,
        stageLayouts: remaining.length ? remaining : state.stageLayouts,
        activeStageLayoutId: remaining.length
          ? (state.activeStageLayoutId === action.payload ? remaining[0].id : state.activeStageLayoutId)
          : state.activeStageLayoutId,
      };
    }
    case 'SET_ACTIVE_STAGE_LAYOUT': return { ...state, activeStageLayoutId: action.payload };
    case 'UPDATE_STAGE_ELEMENT': {
      const { layoutId, element } = action.payload;
      return {
        ...state,
        stageLayouts: state.stageLayouts.map(l =>
          l.id === layoutId
            ? { ...l, elements: l.elements.map(e => e.id === element.id ? { ...e, ...element } : e) }
            : l
        ),
      };
    }
    case 'SET_PRESENTATION_HOST':
      return { ...state, isPresentationHost: action.payload };
    case 'SET_PRESENTATION_CLIENT':
      return { ...state, isPresentationClient: action.payload };
    case 'SET_PRESENTATION_HOST_ADDRESS':
      return { ...state, presentationHostAddress: action.payload };
    case 'SET_SHOW_JOIN_DIALOG':
      return { ...state, showJoinDialog: action.payload };
    case 'APPLY_REMOTE_SLIDE':
      return {
        ...state,
        remoteSlide:   action.payload,
        remoteVideo:   action.payload?.videoPath   ?? state.remoteVideo,
        remoteOverlay: action.payload?.overlayPath ?? state.remoteOverlay,
      };
    case 'CLEAR_ALL_REMOTE':
      return { ...state, remoteSlide: null, remoteVideo: null, remoteOverlay: null };
    case 'SET_HOTKEY': {
      const { key, slideId } = action.payload;
      const next = { ...state.hotkeys };
      if (slideId === null) {
        // Remove any existing binding for this slide
        Object.keys(next).forEach(k => { if (next[k] === slideId) delete next[k]; });
      } else {
        // Remove old binding for this key if any
        Object.keys(next).forEach(k => { if (next[k] === slideId) delete next[k]; });
        next[key.toLowerCase()] = slideId;
      }
      return { ...state, hotkeys: next };
    }
    case 'REMOVE_HOTKEY': {
      const next = { ...state.hotkeys };
      delete next[action.payload];
      return { ...state, hotkeys: next };
    }
    case 'ADD_STAGE_ELEMENT': {
      const { layoutId, element } = action.payload;
      return {
        ...state,
        stageLayouts: state.stageLayouts.map(l =>
          l.id === layoutId ? { ...l, elements: [...l.elements, element] } : l
        ),
      };
    }
    case 'DELETE_STAGE_ELEMENT': {
      const { layoutId, elementId } = action.payload;
      return {
        ...state,
        stageLayouts: state.stageLayouts.map(l =>
          l.id === layoutId ? { ...l, elements: l.elements.filter(e => e.id !== elementId) } : l
        ),
      };
    }

    // ─── Stage Monitor ──────────────────────────────────────────
    case 'SET_STAGE_MESSAGE': return { ...state, stageMessage: action.payload };
    case 'SET_TIMER_SECONDS': return { ...state, timerSeconds: action.payload };
    case 'SET_TIMER_INITIAL': return { ...state, timerInitialSeconds: action.payload, timerSeconds: action.payload };
    case 'SET_TIMER_RUNNING': return { ...state, timerRunning: action.payload };
    case 'RESET_TIMER': return { ...state, timerSeconds: state.timerInitialSeconds, timerRunning: false };
    case 'TOGGLE_TIMELINE': return { ...state, showTimeline: !state.showTimeline };
    case 'SET_PENDING_DROP_SLIDE': return { ...state, pendingDropSlideId: action.payload };
    case 'SET_STYLE_CLIPBOARD': return { ...state, styleClipboard: action.payload };
    case 'SET_IMPORT_EF_PENDING': return { ...state, importEfPending: action.payload };
    case 'SET_FADE_DURATION': return { ...state, fadeDuration: action.payload };
    case 'SET_CANVAS_RATIO':  return { ...state, canvasRatio: action.payload };
    case 'SET_SLIDE_CARD_SIZE':   return { ...state, slideCardSize:   action.payload };
    case 'SET_TIMELINE_PLAYING': return { ...state, timelinePlaying: action.payload };
    case 'SET_TIMELINE_LOOP':    return { ...state, timelineLoop:    action.payload };
    case 'SET_TIMELINE_DURATION':return { ...state, timelineDuration:action.payload };
    case 'SET_SLIDE_CUE_TIME':   return {
      ...state,
      slideCueTimes: { ...state.slideCueTimes, [action.payload.slideId]: action.payload.time },
    };
    case 'RESET_SLIDE_CUE_TIMES':return { ...state, slideCueTimes: {} };
    case 'APPLY_THEME_TO_ALL': return {
      ...state,
      librarySongs: state.librarySongs.map(song =>
        song.id === state.activeItemId
          ? { ...song, slides: (song.slides || []).map(s => {
              const updates = { ...action.payload };
              // Only apply position/size if the theme explicitly includes them
              const result = { ...s, ...updates };
              return result;
            })}
          : song
      ),
    };

    // ─── Bulk load (persistence) ───────────────────────────────
    case 'LOAD_PERSISTED': return { ...state, ...action.payload };

    default:
      console.warn('Unknown action type:', action.type);
      return state;
  }
}

export function useAppState() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const send = useCallback((type, payload) => dispatch({ type, payload }), []);

  return { state, dispatch, send };
}

export default useAppState;