/**
 * useSlides.js
 * All slide CRUD + transform logic extracted from App.jsx
 */
import { useCallback } from 'react';
import { emitTo } from '@tauri-apps/api/event';

export function useSlides(state, dispatch) {
  const { activeItemId, librarySongs, selectedSlideId, clipboard } = state;

  const activeSong = librarySongs.find(s => s.id === activeItemId);
  const slides = activeSong?.slides ?? [];

  const updateSlides = useCallback((newSlides) => {
    dispatch({ type: 'UPDATE_SONG_SLIDES', payload: newSlides });
  }, [dispatch]);

  const reorderSlide = useCallback((dragId, insertBefore) => {
    const from = slides.findIndex(s => s.id === dragId);
    if (from === -1) return;
    const next = [...slides];
    const [moved] = next.splice(from, 1);
    if (insertBefore === '__END__') {
      next.push(moved);
    } else {
      const to = next.findIndex(s => s.id === insertBefore);
      if (to === -1) { next.push(moved); }
      else { next.splice(to, 0, moved); }
    }
    dispatch({ type: 'UPDATE_SONG_SLIDES', payload: next });
  }, [slides, dispatch]);

  const addSlide = useCallback((overrides = {}) => {
    const newId = Date.now();
    const newSlide = {
      id: newId,
      text: 'NEW SLIDE',
      group: 'None',
      color: '#333333',
      x: 50, y: 50,
      width: 60, height: 30,
      video: null,
      fontSize: 5,
      fontWeight: 800,
      fontFamily: 'Arial, sans-serif',
      textColor: '#ffffff',
      transform: 'none',
      italic: false,
      underline: false,
      strikethrough: false,
      lineSpacing: 1.2,
      ...overrides,
    };
    updateSlides([...slides, newSlide]);
    dispatch({ type: 'SET_SELECTED_SLIDE', payload: newId });
    return newId;
  }, [slides, updateSlides, dispatch]);

  const deleteSlide = useCallback((id) => {
    updateSlides(slides.filter(s => s.id !== id));
  }, [slides, updateSlides]);

  const duplicateSlide = useCallback((id) => {
    const src = slides.find(s => s.id === id);
    if (!src) return;
    const newSlide = { ...src, id: Date.now() };
    const idx = slides.findIndex(s => s.id === id);
    const next = [...slides];
    next.splice(idx + 1, 0, newSlide);
    updateSlides(next);
  }, [slides, updateSlides]);

  const copySlide = useCallback((id) => {
    const src = slides.find(s => s.id === id);
    dispatch({ type: 'SET_CLIPBOARD', payload: src });
  }, [slides, dispatch]);

  const cutSlide = useCallback((id) => {
    copySlide(id);
    deleteSlide(id);
  }, [copySlide, deleteSlide]);

  const pasteSlide = useCallback(() => {
    if (!clipboard) return;
    const newSlide = { ...clipboard, id: Date.now() };
    updateSlides([...slides, newSlide]);
  }, [clipboard, slides, updateSlides]);

  const updateSlideText = useCallback((newText) => {
    updateSlides(slides.map(s => s.id === selectedSlideId ? { ...s, text: newText } : s));
  }, [slides, selectedSlideId, updateSlides]);

  const updateSlideStyle = useCallback((key, value) => {
    updateSlides(slides.map(s => s.id === selectedSlideId ? { ...s, [key]: value } : s));
  }, [slides, selectedSlideId, updateSlides]);

  // Batch update — avoids stale closure when setting multiple keys at once
  const updateSlideStyles = useCallback((updates) => {
    updateSlides(slides.map(s => s.id === selectedSlideId ? { ...s, ...updates } : s));
  }, [slides, selectedSlideId, updateSlides]);

  const setSlideGroup = useCallback((id, groupName, color) => {
    updateSlides(slides.map(s => s.id === id ? { ...s, group: groupName, color } : s));
  }, [slides, updateSlides]);

  const assignMediaToSlide = useCallback((slideId, mediaUrl) => {
    // ONLY assign to existing slides — never create new slides from drag-drop
    if (slideId) {
      updateSlides(slides.map(s => s.id === slideId ? { ...s, video: mediaUrl } : s));
    }
    // If no slideId, silently do nothing — caller should add to media bin instead
  }, [slides, updateSlides]);

  const assignTriggerToSlide = useCallback((slideId, audioTrack) => {
    // audioTrack = { id, name, src, path } or null to clear
    updateSlides(slides.map(s => s.id === slideId ? { ...s, triggerAudio: audioTrack || null } : s));
  }, [slides, updateSlides]);

  // Transform / drag logic (runs on mousemove during edit mode)
  const applyTransform = useCallback((interactionMode, mouseX, mouseY, dragOffset) => {
    updateSlides(slides.map(s => {
      if (s.id !== selectedSlideId) return s;

      if (interactionMode === 'move') {
        let nextX = mouseX - (dragOffset?.x || 0);
        let nextY = mouseY - (dragOffset?.y || 0);
        if (Math.abs(nextX - 50) < 1.5) nextX = 50;
        if (Math.abs(nextY - 50) < 1.5) nextY = 50;
        return { ...s, x: nextX, y: nextY };
      }

      let mx = mouseX;
      let my = mouseY;
      if (Math.abs(mx - 50) < 1.5) mx = 50;
      if (Math.abs(my - 50) < 1.5) my = 50;

      let { x, y, width, height } = s;
      const r = x + width / 2, l = x - width / 2;
      const b = y + height / 2, t = y - height / 2;

      if (interactionMode.includes('e')) { width = Math.max(5, mx - l); x = l + width / 2; }
      if (interactionMode.includes('w')) { width = Math.max(5, r - mx); x = r - width / 2; }
      if (interactionMode.includes('s')) { height = Math.max(5, my - t); y = t + height / 2; }
      if (interactionMode.includes('n')) { height = Math.max(5, b - my); y = b - height / 2; }

      return { ...s, x, y, width, height };
    }));
  }, [slides, selectedSlideId, updateSlides]);

  // Send to audience window via Tauri
  const sendToAudience = useCallback(async (slide) => {
    try {
      await emitTo('*', 'audience-update', {
        text:        slide.text      ?? '',
        videoPath:   slide.video     ?? null,
        overlayPath: slide.overlay   ?? null,
        textColor:   slide.textColor   || '#ffffff',
        fontWeight:  slide.fontWeight  || 800,
        fontSize:    slide.fontSize    || 5,
        fontFamily:  slide.fontFamily  || 'inherit',
        italic:      slide.italic      || false,
        underline:   slide.underline   || false,
        strikethrough: slide.strikethrough || false,
        transform:   slide.transform   || 'none',
        x:           slide.x    ?? 50,
        y:           slide.y    ?? 50,
        width:       slide.width  ?? 60,
        height:      slide.height ?? 30,
      });
    } catch (e) {
      // Gracefully fail if audience window isn't open
    }
  }, []);

  const selectedSlide = slides.find(s => s.id === selectedSlideId);
  const slideIndex = slides.indexOf(selectedSlide);
  const nextSlide = slides[slideIndex + 1];

  const handleCopyStyle = useCallback(() => {
    if (!selectedSlideId) return;
    const slide = slides.find(s => s.id === selectedSlideId);
    if (!slide) return;
    const styleKeys = ['fontFamily','fontSize','fontWeight','textColor','transform','italic','underline','strikethrough','lineSpacing'];
    const style = {};
    styleKeys.forEach(k => { style[k] = slide[k]; });
    dispatch({ type: 'SET_STYLE_CLIPBOARD', payload: style });
  }, [selectedSlideId, slides, dispatch]);

  const handlePasteStyle = useCallback(() => {
    const clip = state.styleClipboard;
    if (!clip || !selectedSlideId) return;
    Object.entries(clip).forEach(([k, v]) => {
      if (v !== undefined) updateSlideStyle(k, v);
    });
  }, [state.styleClipboard, selectedSlideId, updateSlideStyle]);

  return {
    activeSong,
    slides,
    selectedSlide,
    nextSlide,
    slideIndex,
    addSlide,
    deleteSlide,
    duplicateSlide,
    copySlide,
    cutSlide,
    pasteSlide,
    updateSlideText,
    updateSlideStyle,
    updateSlideStyles,
    reorderSlide,
    setSlideGroup,
    assignMediaToSlide,
    assignTriggerToSlide,
    applyTransform,
    sendToAudience,
    updateSlides,
    handleCopyStyle,
    handlePasteStyle,
  };
}

export default useSlides;