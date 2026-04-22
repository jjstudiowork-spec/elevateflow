/**
 * slideDragSystem.jsx — ElevateFlow slide reorder drag
 * ProPresenter-style: colored insert bar between slides, not card outline.
 * Completely independent from the media drag system.
 */
import React, { createContext, useContext, useRef, useState, useCallback } from 'react';

const Ctx = createContext(null);

export function SlideDragProvider({ children, onReorder }) {
  const [dragId,       setDragId]       = useState(null);   // which slide is being dragged
  const [insertBefore, setInsertBefore] = useState(null);   // insert before this slideId (null = end)
  const [ghostPos,     setGhostPos]     = useState({ x: 0, y: 0 });
  const [ghostLabel,   setGhostLabel]   = useState('');

  const dragIdRef       = useRef(null);
  const insertBeforeRef = useRef(null);
  const activeRef       = useRef(false);

  const startDrag = useCallback((slideId, label, startX, startY) => {
    if (activeRef.current) return;
    activeRef.current       = true;
    dragIdRef.current       = slideId;
    insertBeforeRef.current = null;

    setDragId(slideId);
    setInsertBefore(null);
    setGhostLabel(label);
    setGhostPos({ x: startX + 14, y: startY - 18 });
    document.body.style.cursor = 'grabbing';

    const onMove = (e) => {
      setGhostPos({ x: e.clientX + 14, y: e.clientY - 18 });

      // Hit-test slide cards to find insert position
      const cards = Array.from(document.querySelectorAll('.slide-card[data-slide-id]'));
      let found = null; // insert BEFORE this id

      for (const card of cards) {
        const r = card.getBoundingClientRect();
        if (card.dataset.slideId === dragIdRef.current) continue;
        // Check if cursor is in the LEFT half of this card → insert before it
        if (e.clientX >= r.left && e.clientX < r.left + r.width / 2 &&
            e.clientY >= r.top  && e.clientY <= r.bottom) {
          found = card.dataset.slideId;
          break;
        }
        // RIGHT half → insert after this card (= before the next one)
        // We handle this by checking the next sibling
        if (e.clientX >= r.left + r.width / 2 && e.clientX <= r.right &&
            e.clientY >= r.top && e.clientY <= r.bottom) {
          // Find next non-dragged card
          const idx = cards.indexOf(card);
          const next = cards.slice(idx + 1).find(c => c.dataset.slideId !== dragIdRef.current);
          found = next ? next.dataset.slideId : '__END__';
          break;
        }
      }

      if (found !== insertBeforeRef.current) {
        insertBeforeRef.current = found;
        setInsertBefore(found);
      }
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove, true);
      window.removeEventListener('mouseup',   onUp,   true);
      document.body.style.cursor = '';
      activeRef.current = false;

      const from   = dragIdRef.current;
      const before = insertBeforeRef.current;

      dragIdRef.current       = null;
      insertBeforeRef.current = null;
      setDragId(null);
      setInsertBefore(null);

      if (from && before !== null) {
        onReorder?.(from, before); // before='__END__' means move to end
      }
    };

    window.addEventListener('mousemove', onMove, true);
    window.addEventListener('mouseup',   onUp,   true);
  }, [onReorder]);

  return (
    <Ctx.Provider value={{ dragId, insertBefore, startDrag }}>
      {children}

      {/* Ghost label following cursor */}
      {dragId && (
        <div style={{
          position:      'fixed',
          left:          ghostPos.x,
          top:           ghostPos.y,
          zIndex:        99999,
          pointerEvents: 'none',
          background:    'rgba(212,175,55,0.95)',
          backdropFilter:'blur(10px)',
          color:         '#000',
          fontWeight:    900,
          fontSize:      11,
          letterSpacing: 0.3,
          padding:       '5px 12px',
          borderRadius:  8,
          boxShadow:     '0 8px 32px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.15)',
          maxWidth:      220,
          overflow:      'hidden',
          textOverflow:  'ellipsis',
          whiteSpace:    'nowrap',
          fontFamily:    '-apple-system, sans-serif',
          userSelect:    'none',
          display:       'flex',
          alignItems:    'center',
          gap:           6,
        }}>
          <span style={{ fontSize: 13 }}>↕</span>
          <span>{ghostLabel}</span>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useSlideDrag() {
  return useContext(Ctx);
}