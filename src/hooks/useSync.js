/**
 * useSync.js
 * Firebase network sync logic extracted from App.jsx
 */
import { useEffect, useCallback } from 'react';
import { db } from '../firebaseConfig';
import { doc, setDoc, onSnapshot, updateDoc, getDoc, deleteDoc } from 'firebase/firestore';

export function useSync(state, dispatch, slides) {
  const {
    isSynced, isHost, sessionCode, selectedSlideId, liveVideo, librarySongs,
  } = state;

  // ── HOST: Start a session ─────────────────────────────────────
  const startHosting = useCallback(async () => {
    try {
      const newCode = Math.floor(1000 + Math.random() * 9000).toString();
      const sessionRef = doc(db, 'sessions', newCode);
      const allSlides = librarySongs.flatMap(s => s.slides || []);
      const currentSlide = allSlides.find(s => s.id === selectedSlideId);

      await setDoc(sessionRef, {
        currentSlide: currentSlide ? {
          text: currentSlide.text || '',
          video: currentSlide.video || liveVideo || null,
          transform: currentSlide.transform || 'none',
        } : null,
        videoUrl: liveVideo || null,
        lastUpdated: Date.now(),
        isLive: true,
      });

      dispatch({ type: 'SET_SESSION_CODE', payload: newCode });
      dispatch({ type: 'SET_SYNCED', payload: true });
      dispatch({ type: 'SET_IS_HOST', payload: true });
      dispatch({ type: 'SET_MODE', payload: 'show' });
    } catch (err) {
      console.error('Firebase startHosting Error:', err);
    }
  }, [librarySongs, selectedSlideId, liveVideo, dispatch]);

  // ── CLIENT: Join a session ────────────────────────────────────
  const joinSession = useCallback(async (inputCode) => {
    if (!inputCode) return;
    try {
      const sessionRef = doc(db, 'sessions', inputCode);
      const snap = await getDoc(sessionRef);
      if (snap.exists()) {
        dispatch({ type: 'SET_SESSION_CODE', payload: inputCode });
        dispatch({ type: 'SET_SYNCED', payload: true });
        dispatch({ type: 'SET_IS_HOST', payload: false });
        dispatch({ type: 'SET_MODE', payload: 'graphics' });
      } else {
        alert('Session not found!');
      }
    } catch (err) {
      console.error('Join Error:', err);
    }
  }, [dispatch]);

  // ── End a session ─────────────────────────────────────────────
  const endSession = useCallback(async () => {
    if (isHost && sessionCode) {
      try {
        await deleteDoc(doc(db, 'sessions', sessionCode));
      } catch (e) {
        console.error('Error deleting session:', e);
      }
    }
    dispatch({ type: 'END_SESSION' });
  }, [isHost, sessionCode, dispatch]);

  // ── Emit: generic action ──────────────────────────────────────
  const emitSync = useCallback(async (action, data = {}) => {
    if (!isSynced || !isHost || !sessionCode) return;
    const sessionRef = doc(db, 'sessions', sessionCode);
    try {
      await updateDoc(sessionRef, { action, ...data, lastUpdated: Date.now() });
    } catch (e) {
      console.error('emitSync Error:', e);
    }
  }, [isSynced, isHost, sessionCode]);

  // ── Mirror sync: send current slide state ─────────────────────
  const emitMirrorSync = useCallback(async (video, slideId) => {
    if (!isSynced || !isHost || !sessionCode) return;
    const sessionRef = doc(db, 'sessions', sessionCode);
    const allSlides = librarySongs.flatMap(s => s.slides || []);
    const currentSlide = allSlides.find(s => s.id === slideId);
    const syncVideo = video && !video.startsWith('blob:') ? video : (currentSlide?.video || null);

    try {
      await updateDoc(sessionRef, {
        currentSlide: {
          text: currentSlide?.text || '',
          video: syncVideo,
          transform: currentSlide?.transform || 'none',
        },
        videoUrl: syncVideo,
        lastUpdated: Date.now(),
      });
    } catch (e) {
      console.error('Mirror Sync Error:', e);
    }
  }, [isSynced, isHost, sessionCode, librarySongs]);

  // ── Mirror watcher: fires when slide or video changes ─────────
  useEffect(() => {
    if (isHost && isSynced) {
      emitMirrorSync(liveVideo, selectedSlideId);
    }
  }, [liveVideo, selectedSlideId, isSynced, isHost]);

  // ── CLIENT: listen for host changes ──────────────────────────
  useEffect(() => {
    if (!sessionCode || isHost) return;
    const sessionRef = doc(db, 'sessions', sessionCode);
    const unsub = onSnapshot(sessionRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.slideId !== undefined) {
          dispatch({ type: 'SET_SELECTED_SLIDE', payload: data.slideId });
          dispatch({ type: 'SET_REMOTE_SLIDE_DATA', payload: data.slideData || null });
        }
        if (data.videoUrl) dispatch({ type: 'SET_LIVE_VIDEO', payload: data.videoUrl });
        if (data.clearAll) {
          dispatch({ type: 'SET_SELECTED_SLIDE', payload: null });
          dispatch({ type: 'SET_REMOTE_SLIDE_DATA', payload: null });
          dispatch({ type: 'SET_LIVE_VIDEO', payload: null });
        }
      } else {
        dispatch({ type: 'SET_SYNCED', payload: false });
        dispatch({ type: 'SET_SESSION_CODE', payload: '' });
      }
    });
    return () => unsub();
  }, [sessionCode, isHost, dispatch]);

  return { startHosting, joinSession, endSession, emitSync, emitMirrorSync };
}

export default useSync;

/**
 * usePersistence.js
 * localStorage load/save logic extracted from App.jsx
 */
export function usePersistence(state, dispatch, windowLabel) {
  const KEYS = {
    songs:          'pro_songs',
    playlists:      'pro_playlists',
    libraries:      'pro_libraries',
    media:          'pro_media',
    audio:          'pro_audio',
    audioPlaylists: 'pro_audio_playlists',
    activeItemId:   'pro_active_item_id',
    activeSidebar:  'pro_active_sidebar',
    stageLayouts:   'pro_stage_layouts',
    activeStageLayout: 'pro_active_stage_layout',
  };

  // Load on startup — cleans blob URLs inline so we never dispatch stale empty state
  const loadPersistedData = useCallback(() => {
    if (windowLabel === 'audience') return;

    const clean = (items) => (items || []).map(item => {
      let newItem = { ...item };
      if (newItem.url?.startsWith('blob:')) newItem.url = null;
      if (newItem.src?.startsWith('blob:')) newItem.src = null;
      if (newItem.slides) {
        newItem.slides = newItem.slides.map(s =>
          s.video?.startsWith('blob:') ? { ...s, video: null } : s
        );
      }
      return newItem;
    });

    const payload = {};
    try {
      const songs     = localStorage.getItem(KEYS.songs);
      const playlists = localStorage.getItem(KEYS.playlists);
      const libs      = localStorage.getItem(KEYS.libraries);
      const media     = localStorage.getItem(KEYS.media);
      const audio     = localStorage.getItem(KEYS.audio);

      if (songs)     payload.librarySongs   = clean(JSON.parse(songs));
      if (playlists) payload.playlists      = JSON.parse(playlists);
      if (libs)      payload.libraries      = JSON.parse(libs);
      if (media)     payload.mediaFiles     = clean(JSON.parse(media));
      if (audio)     payload.audioFiles     = clean(JSON.parse(audio));
      const apls = localStorage.getItem(KEYS.audioPlaylists);
      const aid  = localStorage.getItem(KEYS.activeItemId);
      const asb  = localStorage.getItem(KEYS.activeSidebar);
      if (apls)  payload.audioPlaylists    = JSON.parse(apls);
      if (aid)   payload.activeItemId      = JSON.parse(aid);
      if (asb)   { const v = JSON.parse(asb); payload.activeSidebarId = v.id; payload.activeSidebarType = v.type; }
      const sl  = localStorage.getItem(KEYS.stageLayouts);
      const asl = localStorage.getItem(KEYS.activeStageLayout);
      if (sl)  payload.stageLayouts        = JSON.parse(sl);
      if (asl) payload.activeStageLayoutId = JSON.parse(asl);
    } catch (e) {
      console.error('[usePersistence] Load error:', e);
    }

    if (Object.keys(payload).length > 0) {
      dispatch({ type: 'LOAD_PERSISTED', payload });
    }
  }, [windowLabel, dispatch]);

  // Save automatically
  const saveData = useCallback(() => {
    if (windowLabel === 'audience') return;
    localStorage.setItem(KEYS.songs,          JSON.stringify(state.librarySongs));
    localStorage.setItem(KEYS.playlists,      JSON.stringify(state.playlists));
    localStorage.setItem(KEYS.libraries,      JSON.stringify(state.libraries));
    localStorage.setItem(KEYS.media,          JSON.stringify(state.mediaFiles));
    localStorage.setItem(KEYS.audio,          JSON.stringify(state.audioFiles));
    localStorage.setItem(KEYS.audioPlaylists, JSON.stringify(state.audioPlaylists));
    if (state.activeItemId)   localStorage.setItem(KEYS.activeItemId,  JSON.stringify(state.activeItemId));
    if (state.activeSidebarId) localStorage.setItem(KEYS.activeSidebar, JSON.stringify({ id: state.activeSidebarId, type: state.activeSidebarType }));
    if (state.stageLayouts)   localStorage.setItem(KEYS.stageLayouts,  JSON.stringify(state.stageLayouts));
    if (state.activeStageLayoutId) localStorage.setItem(KEYS.activeStageLayout, JSON.stringify(state.activeStageLayoutId));
  }, [windowLabel, state.librarySongs, state.playlists, state.libraries, state.mediaFiles, state.audioFiles, state.audioPlaylists, state.activeItemId, state.activeSidebarId, state.activeSidebarType, state.stageLayouts, state.activeStageLayoutId]);

  // Clean stale blob URLs — now handled inside loadPersistedData
  const cleanBlobUrls = useCallback(() => {}, []);

  return { loadPersistedData, saveData, cleanBlobUrls };
}