/**
 * FlowEditor.jsx — ElevateFlow "Flow" mode
 * ProPresenter Reflow-style continuous text editor.
 * All slides shown as a flowing document with slide break markers.
 * Edit text naturally; insert/remove slide breaks inline.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';

const BREAK = '\u2028'; // Private use: slide break marker in raw text

// Convert slides array → single raw string with break markers
function slidesToRaw(slides) {
  return slides.map(s => s.text || '').join(BREAK);
}

// Convert raw string back → array of text chunks
function rawToTexts(raw) {
  return raw.split(BREAK).filter((_, i, arr) => i < arr.length);
}

// Rebuild slides from new texts, preserving all other slide properties
function mergeTexts(slides, texts) {
  const result = [];
  for (let i = 0; i < Math.max(texts.length, 1); i++) {
    const text = texts[i] ?? '';
    if (i < slides.length) {
      result.push({ ...slides[i], text });
    } else {
      // New slide (from a split)
      const base = slides[slides.length - 1] || {};
      result.push({
        ...base,
        id: Date.now() + i + Math.random(),
        text,
      });
    }
  }
  return result.filter(s => s.text !== undefined);
}

// ── Slide card preview ────────────────────────────────────────────
function SlideCard({ text, index, active, onClick }) {
  return (
    <div onClick={onClick} style={{
      width: '100%', aspectRatio: '16/9',
      background: '#000', borderRadius: 8, overflow: 'hidden',
      border: `1.5px solid ${active ? '#D4AF37' : '#1a1a1e'}`,
      cursor: 'pointer', flexShrink: 0,
      boxShadow: active ? '0 0 0 3px rgba(212,175,55,0.15)' : 'none',
      transition: 'all 0.1s', containerType: 'inline-size',
      position: 'relative',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '8% 10%', boxSizing: 'border-box',
        fontSize: '1.1cqw', fontWeight: 800, color: '#fff',
        textAlign: 'center', whiteSpace: 'pre-wrap', lineHeight: 1.3,
        overflow: 'hidden',
      }}>{text || ''}</div>
      <div style={{
        position: 'absolute', top: 4, left: 6,
        fontSize: 9, fontWeight: 800, color: active ? '#D4AF37' : '#2a2a2e',
      }}>{index + 1}</div>
    </div>
  );
}

// ── Main FlowEditor ───────────────────────────────────────────────
export default function FlowEditor({ state, dispatch, slides, onUpdateSlides }) {
  const { activeSong } = state;
  const [texts,    setTexts]    = useState(() => slides.map(s => s.text || ''));
  const [activeIdx, setActiveIdx] = useState(0);
  const [slideSize, setSlideSize] = useState(160);
  const editorRef   = useRef(null);

  // Sync slides → editor when song changes
  useEffect(() => {
    setTexts(slides.map(s => s.text || ''));
    setActiveIdx(0);
  }, [activeSong?.id]);

  // Commit changes back to app state
  const commit = useCallback((newTexts) => {
    const newSlides = mergeTexts(slides, newTexts);
    onUpdateSlides(newSlides);
  }, [slides, onUpdateSlides]);

  // Debounced commit
  const commitTimer = useRef(null);
  const scheduleCommit = (newTexts) => {
    clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => commit(newTexts), 400);
  };

  const updateText = (idx, val) => {
    const next = [...texts];
    next[idx] = val;
    setTexts(next);
    scheduleCommit(next);
  };

  // Insert slide break at cursor position
  const insertBreak = (idx, textarea) => {
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end   = textarea.selectionEnd;
    const before = texts[idx].slice(0, start).trimEnd();
    const after  = texts[idx].slice(end).trimStart();

    const next = [...texts];
    next[idx] = before;
    next.splice(idx + 1, 0, after);
    setTexts(next);
    scheduleCommit(next);
    setActiveIdx(idx + 1);

    // Focus next textarea after render
    setTimeout(() => {
      const areas = editorRef.current?.querySelectorAll('textarea');
      if (areas?.[idx + 1]) { areas[idx + 1].focus(); areas[idx + 1].setSelectionRange(0, 0); }
    }, 50);
  };

  // Merge with previous slide (delete at start)
  const mergeWithPrev = (idx) => {
    if (idx === 0) return;
    const next = [...texts];
    const prevText = next[idx - 1];
    const curText  = next[idx];
    next[idx - 1] = prevText + (prevText && curText ? '\n' : '') + curText;
    next.splice(idx, 1);
    setTexts(next);
    scheduleCommit(next);
    setActiveIdx(idx - 1);

    setTimeout(() => {
      const areas = editorRef.current?.querySelectorAll('textarea');
      if (areas?.[idx - 1]) {
        const len = next[idx - 1].length;
        areas[idx - 1].focus();
        areas[idx - 1].setSelectionRange(len, len);
      }
    }, 50);
  };

  const songTitle = activeSong?.title || 'No Song Selected';

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 220px',
      height: '100%', background: '#0a0a0c', overflow: 'hidden',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Arial, sans-serif',
    }}>

      {/* ── Left: Flow editor ── */}
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{
          padding: '14px 24px', borderBottom: '1px solid #141418',
          display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
          background: 'linear-gradient(180deg, rgba(212,175,55,0.03) 0%, transparent 100%)',
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%', background: '#D4AF37',
            boxShadow: '0 0 8px #D4AF37',
          }} />
          <div style={{ fontSize: 14, fontWeight: 700, color: '#e4e4e7' }}>{songTitle}</div>
          <div style={{ fontSize: 10, color: '#3f3f46', marginLeft: 4 }}>
            {texts.length} slide{texts.length !== 1 ? 's' : ''}
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ fontSize: 10, color: '#27272a', lineHeight: 1.6 }}>
            <span style={{ color: '#3f3f46', fontWeight: 600 }}>⌥ Return</span> — Insert slide break
            &nbsp;&nbsp;
            <span style={{ color: '#3f3f46', fontWeight: 600 }}>Delete</span> at start — Merge slides
          </div>
        </div>

        {/* Editor area */}
        <div ref={editorRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 48px' }}>
          {texts.length === 0 && (
            <div style={{ textAlign: 'center', color: '#27272a', fontSize: 14, marginTop: 60 }}>
              Open a song to start editing
            </div>
          )}
          {texts.map((text, idx) => (
            <div key={idx}>
              {/* Slide block */}
              <div
                onClick={() => setActiveIdx(idx)}
                style={{
                  display: 'flex', gap: 16, alignItems: 'flex-start',
                  marginBottom: 0,
                }}
              >
                {/* Slide number */}
                <div style={{
                  width: 28, paddingTop: 10, textAlign: 'right',
                  fontSize: 11, fontWeight: 700, color: activeIdx === idx ? '#D4AF37' : '#27272a',
                  flexShrink: 0, userSelect: 'none', transition: 'color 0.1s',
                }}>{idx + 1}</div>

                {/* Textarea */}
                <textarea
                  value={text}
                  onChange={e => { updateText(idx, e.target.value); setActiveIdx(idx); }}
                  onKeyDown={e => {
                    e.stopPropagation();
                    if (e.altKey && e.key === 'Enter') {
                      e.preventDefault();
                      insertBreak(idx, e.target);
                    } else if (e.key === 'Backspace' && e.target.selectionStart === 0 && e.target.selectionEnd === 0) {
                      e.preventDefault();
                      mergeWithPrev(idx);
                    }
                  }}
                  onPaste={e => e.stopPropagation()}
                  onFocus={() => setActiveIdx(idx)}
                  placeholder={idx === 0 ? 'Start typing lyrics…' : ''}
                  rows={Math.max(2, text.split('\n').length)}
                  style={{
                    flex: 1, resize: 'none', padding: '10px 14px',
                    background: activeIdx === idx ? 'rgba(212,175,55,0.04)' : '#0e0e12',
                    border: `1px solid ${activeIdx === idx ? 'rgba(212,175,55,0.2)' : '#141418'}`,
                    borderRadius: 10, color: '#e4e4e7',
                    fontSize: 16, lineHeight: 1.65, outline: 'none',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Arial, sans-serif',
                    transition: 'all 0.1s',
                    overflow: 'hidden',
                  }}
                />
              </div>

              {/* Slide break divider */}
              {idx < texts.length - 1 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  margin: '8px 0 8px 44px',
                }}>
                  <div style={{ flex: 1, height: 1, background: '#141418' }} />
                  <div style={{
                    fontSize: 9, fontWeight: 800, letterSpacing: 1.5,
                    color: '#1e1e24', padding: '0 6px',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}>
                    <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#1e1e24' }} />
                    SLIDE BREAK
                    <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#1e1e24' }} />
                  </div>
                  <div style={{ flex: 1, height: 1, background: '#141418' }} />
                </div>
              )}
            </div>
          ))}

          {/* Add slide at end */}
          {texts.length > 0 && (
            <button
              onClick={() => {
                const next = [...texts, ''];
                setTexts(next);
                scheduleCommit(next);
                setActiveIdx(next.length - 1);
                setTimeout(() => {
                  const areas = editorRef.current?.querySelectorAll('textarea');
                  areas?.[next.length - 1]?.focus();
                }, 50);
              }}
              style={{
                marginLeft: 44, marginTop: 12, marginBottom: 40,
                height: 32, padding: '0 14px', borderRadius: 7, cursor: 'pointer',
                background: 'transparent', border: '1px dashed #1a1a1e',
                color: '#2a2a35', fontSize: 12, fontWeight: 600, transition: 'all 0.1s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#D4AF37'; e.currentTarget.style.color = '#D4AF37'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#1a1a1e'; e.currentTarget.style.color = '#2a2a35'; }}
            >+ Add Slide</button>
          )}
        </div>
      </div>

      {/* ── Right: Slide previews ── */}
      <div style={{
        borderLeft: '1px solid #141418', background: '#0d0d0f',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{
          padding: '14px 14px 10px', borderBottom: '1px solid #141418', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, color: '#27272a' }}>SLIDES</div>
          {/* Size slider */}
          <input type="range" min={100} max={200} value={slideSize}
            onChange={e => setSlideSize(parseInt(e.target.value))}
            style={{ width: 60, accentColor: '#D4AF37', cursor: 'pointer' }}
          />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 10px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {texts.map((text, idx) => (
              <SlideCard
                key={idx} text={text} index={idx}
                active={activeIdx === idx}
                onClick={() => {
                  setActiveIdx(idx);
                  const areas = editorRef.current?.querySelectorAll('textarea');
                  areas?.[idx]?.focus();
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}