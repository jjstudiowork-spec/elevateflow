/**
 * PptxImporter.jsx — ElevateFlow
 *
 * Modal for importing a .pptx file.
 * Each slide is rendered as a JPEG thumbnail and shown in a preview grid.
 * On confirm, calls onImport(song) with a fully-formed song object ready
 * for dispatch({ type: 'ADD_SONG', payload: song }).
 */

import React, { useState, useRef, useCallback } from 'react';
import { parsePptxFile } from './lib/pptxParser';

// ─── Styles (inline, self-contained) ────────────────────────────────────────

const S = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 9999,
    background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  modal: {
    background: '#18181f', borderRadius: 14,
    width: 660, maxWidth: '95vw', maxHeight: '90vh',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
    border: '1px solid rgba(255,255,255,0.07)',
  },
  header: {
    padding: '16px 22px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    flexShrink: 0,
  },
  body: {
    flex: 1, overflowY: 'auto', padding: 22,
  },
  footer: {
    padding: '14px 22px',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    display: 'flex', justifyContent: 'flex-end', gap: 10,
    flexShrink: 0,
  },
  btnCancel: {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, color: '#aaa',
    fontSize: 13, padding: '8px 20px',
    cursor: 'pointer', fontWeight: 500,
  },
  btnImport: (active) => ({
    background: active ? 'linear-gradient(135deg,#7c6af7,#a78bfa)' : 'rgba(255,255,255,0.05)',
    border: 'none', borderRadius: 8,
    color: active ? '#fff' : '#555',
    fontSize: 13, padding: '8px 24px',
    cursor: active ? 'pointer' : 'not-allowed',
    fontWeight: 600, transition: 'all 0.15s',
  }),
  dropzone: (over) => ({
    border: `2px dashed ${over ? '#7c6af7' : 'rgba(255,255,255,0.14)'}`,
    borderRadius: 12, padding: '52px 32px',
    textAlign: 'center', cursor: 'pointer',
    background: over ? 'rgba(124,106,247,0.07)' : 'rgba(255,255,255,0.02)',
    transition: 'all 0.15s',
  }),
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function PptxImporter({ state, onImport, onClose }) {
  const [phase,    setPhase]    = useState('idle');    // idle | loading | preview | error
  const [progress, setProgress] = useState(0);
  const [result,   setResult]   = useState(null);      // { title, slides }
  const [error,    setError]    = useState('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  // ── File processing ─────────────────────────────────────────────
  const process = useCallback(async (file) => {
    if (!file?.name?.toLowerCase().endsWith('.pptx')) {
      setError('Please select a valid .pptx PowerPoint file.');
      setPhase('error');
      return;
    }
    setPhase('loading');
    setProgress(0);
    setError('');

    try {
      const parsed = await parsePptxFile(file, pct => setProgress(pct));
      if (!parsed.slides.length) throw new Error('No slides could be rendered from this file.');
      setResult(parsed);
      setPhase('preview');
    } catch (e) {
      console.error('[PptxImporter]', e);
      setError(e.message || 'Failed to parse the PPTX file.');
      setPhase('error');
    }
  }, []);

  const handleInputChange = (e) => {
    const f = e.target.files?.[0];
    if (f) process(f);
    // reset so same file can be re-picked
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) process(f);
  };

  // ── Import ──────────────────────────────────────────────────────
  const handleImport = useCallback(() => {
    if (!result) return;
    const libId = state?.libraries?.[0]?.id || 'default';
    onImport({
      id:        'pptx_' + Date.now(),
      title:     result.title,
      libId,
      slides:    result.slides,
      author:    '',
      copyright: '',
    });
    onClose();
  }, [result, state, onImport, onClose]);

  // ── Keyboard close ───────────────────────────────────────────────
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  // ────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────

  return (
    <div style={S.overlay} onClick={handleOverlayClick}>
      <div style={S.modal}>

        {/* Header */}
        <div style={S.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <span style={{ fontSize: 24, lineHeight: 1 }}>📊</span>
            <div>
              <div style={{ color: '#f0f0f0', fontWeight: 700, fontSize: 15, letterSpacing: '-0.2px' }}>
                Import PowerPoint
              </div>
              <div style={{ color: '#666', fontSize: 12, marginTop: 1 }}>
                Each slide is rendered as a visual song slide
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#555', fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: '0 2px' }}
            title="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={S.body}>

          {/* ── IDLE / ERROR: drop zone ─────────────────────────── */}
          {(phase === 'idle' || phase === 'error') && (
            <>
              <div
                style={S.dropzone(dragOver)}
                onClick={() => inputRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
              >
                <div style={{ fontSize: 44, marginBottom: 14 }}>📂</div>
                <div style={{ color: '#d0d0d0', fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
                  Drop your .pptx file here
                </div>
                <div style={{ color: '#555', fontSize: 13 }}>or click to browse</div>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pptx,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                  style={{ display: 'none' }}
                  onChange={handleInputChange}
                />
              </div>

              {phase === 'error' && (
                <div style={{
                  marginTop: 14, padding: '10px 14px',
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: 8, color: '#f87171', fontSize: 13,
                }}>
                  ⚠️ {error}
                </div>
              )}
            </>
          )}

          {/* ── LOADING ─────────────────────────────────────────── */}
          {phase === 'loading' && (
            <div style={{ textAlign: 'center', padding: '56px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 18, animation: 'spin 1.2s linear infinite', display: 'inline-block' }}>⚙️</div>
              <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
              <div style={{ color: '#d0d0d0', fontSize: 15, fontWeight: 600, marginBottom: 22 }}>
                Rendering slides…
              </div>
              <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 99, height: 6, overflow: 'hidden', maxWidth: 340, margin: '0 auto' }}>
                <div style={{
                  height: '100%', width: `${progress}%`,
                  background: 'linear-gradient(90deg,#7c6af7,#a78bfa)',
                  transition: 'width 0.25s ease', borderRadius: 99,
                }} />
              </div>
              <div style={{ color: '#555', fontSize: 12, marginTop: 10 }}>{progress}%</div>
            </div>
          )}

          {/* ── PREVIEW ─────────────────────────────────────────── */}
          {phase === 'preview' && result && (
            <>
              {/* Title row */}
              <div style={{
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', marginBottom: 16,
              }}>
                <div style={{ color: '#ccc', fontSize: 13 }}>
                  <span style={{ color: '#fff', fontWeight: 700 }}>{result.slides.length}</span>
                  {' slides from '}
                  <span style={{ color: '#a78bfa', fontWeight: 600 }}>"{result.title}"</span>
                </div>
                <button
                  onClick={() => { setPhase('idle'); setResult(null); setProgress(0); }}
                  style={{
                    background: 'none',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 6, color: '#777',
                    fontSize: 12, padding: '4px 11px', cursor: 'pointer',
                  }}
                >
                  ↩ Change file
                </button>
              </div>

              {/* Slide thumbnail grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 8,
              }}>
                {result.slides.map((slide, idx) => (
                  <div
                    key={slide.id}
                    style={{
                      position: 'relative', borderRadius: 6, overflow: 'hidden',
                      aspectRatio: '16/9', background: '#000',
                      border: '1px solid rgba(255,255,255,0.07)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                    }}
                  >
                    <img
                      src={slide.pptxImageUrl}
                      alt={`Slide ${idx + 1}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                    {/* Slide number badge */}
                    <div style={{
                      position: 'absolute', bottom: 0, right: 0,
                      background: 'rgba(0,0,0,0.55)',
                      color: '#aaa', fontSize: 10,
                      padding: '2px 6px', borderTopLeftRadius: 5,
                    }}>
                      {idx + 1}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

        </div>

        {/* Footer */}
        <div style={S.footer}>
          <button style={S.btnCancel} onClick={onClose}>Cancel</button>
          <button
            style={S.btnImport(phase === 'preview')}
            disabled={phase !== 'preview'}
            onClick={handleImport}
          >
            {result
              ? `Import ${result.slides.length} slide${result.slides.length === 1 ? '' : 's'}`
              : 'Import'}
          </button>
        </div>

      </div>
    </div>
  );
}