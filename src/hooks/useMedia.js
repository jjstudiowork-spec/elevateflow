/**
 * useMedia.js
 * - Import goes into whichever tab is currently active (mediaBinTab)
 * - Stores both src (asset URL for main window) and path (raw FS path for output windows)
 * - handleMediaClick routes video/audio/overlay correctly
 */

import { useCallback } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';

// ── Helpers ───────────────────────────────────────────────────────────────────

function detectMediaType(path) {
  const ext = path.split('.').pop().toLowerCase();
  if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'aac', 'flac', 'm4a', 'ogg'].includes(ext))  return 'audio';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
  return 'video';
}

// Map mediaBinTab → category stored on the media file
const TAB_TO_CATEGORY = {
  backgrounds: 'background',
  overlays:    'overlay',
  video:       'video',
  image:       'image',
  audio:       'audio',
  all:         null,
};

// ── useMedia ──────────────────────────────────────────────────────────────────

export function useMedia(state, dispatch, audioRef, videoRef) {

  const handleImportMedia = useCallback(async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [{
          name: 'Media',
          extensions: [
            'mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v',
            'mp3', 'wav', 'aac', 'flac', 'm4a', 'ogg',
            'png', 'jpg', 'jpeg', 'gif', 'webp',
          ],
        }],
      });

      if (!selected) return;
      const paths = Array.isArray(selected) ? selected : [selected];

      const activeTab = state.mediaBinTab || 'all';

      paths.forEach(rawPath => {
        const detectedType = detectMediaType(rawPath);
        const srcUrl       = convertFileSrc(rawPath);

        // Category = active tab so it appears on that tab (and always on 'all')
        const category = TAB_TO_CATEGORY[activeTab] ?? detectedType;

        const mediaFile = {
          id:       Date.now() + Math.random(),
          name:     rawPath.split(/[\\/]/).pop(),
          path:     rawPath,   // raw filesystem path — send this via emitTo
          src:      srcUrl,    // asset:// URL — use this for <video src> in main window
          type:     detectedType,
          category,
          deckId:   state.activeDeckId || null,
        };

        if (detectedType === 'audio') {
          dispatch({ type: 'ADD_AUDIO_FILE', payload: mediaFile });
        } else {
          dispatch({ type: 'ADD_MEDIA_FILE', payload: mediaFile });
        }
      });

    } catch (err) {
      console.error('[useMedia] Import failed:', err);
    }
  }, [dispatch, state.mediaBinTab, state.activeDeckId]);


  const handleMediaClick = useCallback((mediaFile) => {
    const { type, category, src, path } = mediaFile;

    // Images — set as background (same path as video but rendered as <img> in AudienceView)
    if (type === 'image' || path?.match(/\.(png|jpg|jpeg|gif|webp|bmp)$/i)) {
      dispatch({ type: 'SET_LIVE_VIDEO', payload: path });
      dispatch({ type: 'SET_MEDIA_TYPE', payload: 'image' });
      dispatch({ type: 'SET_TRANSPORT_TAB', payload: 'video' });
      return;
    }

    if (type === 'audio') {
      dispatch({ type: 'SET_ACTIVE_AUDIO_URL', payload: src });
      dispatch({ type: 'SET_TRANSPORT_TAB',    payload: 'audio' });
      if (audioRef?.current) {
        audioRef.current.src = src;
        audioRef.current.play().catch(() => {});
      }
      return;
    }

    const isOverlay = category === 'overlay' || path?.toLowerCase().endsWith('.webm');

    if (isOverlay) {
      dispatch({ type: 'SET_ACTIVE_OVERLAY', payload: path });
    } else {
      dispatch({ type: 'SET_LIVE_VIDEO',     payload: path });
      dispatch({ type: 'SET_TRANSPORT_TAB',  payload: 'video' });
      if (videoRef?.current && type === 'video') {
        videoRef.current.src = src;
        videoRef.current.play().catch(() => {});
      }
    }
  }, [dispatch, audioRef, videoRef]);

  return { handleImportMedia, handleMediaClick };
}

// ── useTransport ──────────────────────────────────────────────────────────────

export function useTransport(state, dispatch, videoRef, audioRef) {

  const togglePlay = useCallback(() => {
    const ref = state.transportTab === 'video' ? videoRef : audioRef;
    if (!ref?.current) return;
    if (ref.current.paused) {
      ref.current.play().catch(() => {});
    } else {
      ref.current.pause();
    }
  }, [state.transportTab, videoRef, audioRef]);

  const skipTime = useCallback((seconds) => {
    const ref = state.transportTab === 'video' ? videoRef : audioRef;
    if (!ref?.current) return;
    ref.current.currentTime = Math.max(0, ref.current.currentTime + seconds);
  }, [state.transportTab, videoRef, audioRef]);

  const handleVideoTimeUpdate = useCallback(() => {
    if (!videoRef?.current) return;
    dispatch({ type: 'SET_CURRENT_TIME', payload: videoRef.current.currentTime });
    dispatch({ type: 'SET_DURATION',     payload: videoRef.current.duration || 0 });
  }, [dispatch, videoRef]);

  const handleAudioTimeUpdate = useCallback(() => {
    if (!audioRef?.current) return;
    dispatch({ type: 'SET_AUDIO_CURRENT_TIME', payload: audioRef.current.currentTime });
    dispatch({ type: 'SET_AUDIO_DURATION',     payload: audioRef.current.duration || 0 });
  }, [dispatch, audioRef]);

  const formatTime = useCallback((secs) => {
    if (!secs || isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }, []);

  return { togglePlay, skipTime, handleVideoTimeUpdate, handleAudioTimeUpdate, formatTime };
}