/**
 * useMedia.js
 * Handles all media operations:
 *  - Import via native file dialog (Tauri dialog plugin)
 *  - Click routing (video → liveVideo, audio → audioUrl, overlay → activeOverlay)
 *  - Drag from desktop onto the app
 *  - convertFileSrc so videos work in both main + output windows
 *
 * useTransport handles playback state for the video/audio elements.
 */

import { useCallback } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { convertFileSrc } from '@tauri-apps/api/core';

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

/** Detect media type from file extension */
function detectMediaType(path) {
  const ext = path.split('.').pop().toLowerCase();
  if (['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v'].includes(ext)) return 'video';
  if (['mp3', 'wav', 'aac', 'flac', 'm4a', 'ogg'].includes(ext)) return 'audio';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
  return 'video'; // default
}

/** Detect if a video is likely meant as an overlay (has alpha / is named overlay) */
function isLikelyOverlay(path) {
  const lower = path.toLowerCase();
  return lower.includes('overlay') || lower.includes('alpha') || lower.endsWith('.webm');
}

// ─────────────────────────────────────────────────────────────────
// useMedia
// ─────────────────────────────────────────────────────────────────

export function useMedia(state, dispatch, audioRef, videoRef) {

  /**
   * Open native file picker and import selected files into the media bin.
   * Uses convertFileSrc so the paths work as <video src> in Tauri webviews.
   */
  const handleImportMedia = useCallback(async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [{
          name: 'Media',
          extensions: [
            'mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v',  // video
            'mp3', 'wav', 'aac', 'flac', 'm4a', 'ogg',  // audio
            'png', 'jpg', 'jpeg', 'gif', 'webp',         // image
          ],
        }],
      });

      if (!selected) return; // user cancelled

      const paths = Array.isArray(selected) ? selected : [selected];

      paths.forEach(rawPath => {
        const type    = detectMediaType(rawPath);
        const srcUrl  = convertFileSrc(rawPath); // works in all Tauri windows

        const mediaFile = {
          id:      Date.now() + Math.random(),
          name:    rawPath.split(/[\\/]/).pop(),
          path:    rawPath,   // raw filesystem path (for emitTo payload)
          src:     srcUrl,    // asset:// URL (for <video> / <img> src)
          type,
          deckId:  state.activeDeckId || null,
        };

        if (type === 'audio') {
          dispatch({ type: 'ADD_AUDIO_FILE', payload: mediaFile });
        } else {
          dispatch({ type: 'ADD_MEDIA_FILE', payload: mediaFile });
        }
      });

    } catch (err) {
      console.error('[useMedia] Import failed:', err);
    }
  }, [dispatch, state.activeDeckId]);

  /**
   * Handle clicking a media card in the bin.
   * Routes based on type and whether it looks like an overlay.
   */
  const handleMediaClick = useCallback((mediaFile) => {
    const { type, src, path } = mediaFile;

    if (type === 'audio') {
      dispatch({ type: 'SET_ACTIVE_AUDIO_URL', payload: src });
      dispatch({ type: 'SET_TRANSPORT_TAB',    payload: 'audio' });
      if (audioRef?.current) {
        audioRef.current.src = src;
        audioRef.current.play().catch(() => {});
      }
      return;
    }

    if (type === 'image') {
      // Images go to the live background slot
      dispatch({ type: 'SET_LIVE_VIDEO', payload: src });
      return;
    }

    // Video — decide background vs overlay
    if (isLikelyOverlay(path)) {
      dispatch({ type: 'SET_ACTIVE_OVERLAY',  payload: src });
      dispatch({ type: 'SET_TRANSPORT_TAB',   payload: 'video' });
    } else {
      dispatch({ type: 'SET_LIVE_VIDEO',      payload: src });
      dispatch({ type: 'SET_TRANSPORT_TAB',   payload: 'video' });
      if (videoRef?.current) {
        videoRef.current.src = src;
        videoRef.current.play().catch(() => {});
      }
    }
  }, [dispatch, audioRef, videoRef]);

  return { handleImportMedia, handleMediaClick };
}

// ─────────────────────────────────────────────────────────────────
// useTransport
// ─────────────────────────────────────────────────────────────────

export function useTransport(state, dispatch, videoRef, audioRef) {

  const togglePlay = useCallback(() => {
    const isVideoMode = state.transportTab === 'video';
    const ref = isVideoMode ? videoRef : audioRef;
    if (!ref?.current) return;

    if (ref.current.paused) {
      ref.current.play().catch(() => {});
    } else {
      ref.current.pause();
    }
  }, [state.transportTab, videoRef, audioRef]);

  const skipTime = useCallback((seconds) => {
    const isVideoMode = state.transportTab === 'video';
    const ref = isVideoMode ? videoRef : audioRef;
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