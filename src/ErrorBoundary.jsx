/**
 * ErrorBoundary.jsx — ElevateFlow
 * Catches render errors in any child tree and shows a recoverable UI
 * instead of a blank screen. Class component — required by React.
 */
import React from 'react';
import { invoke } from '@tauri-apps/api/core';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null, copied: false };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    console.error('[ElevateFlow] Render error caught by boundary:', error, info);
  }

  copyReport() {
    const text = `ElevateFlow Error Report\n\n${this.state.error?.toString()}\n\nComponent Stack:\n${this.state.info?.componentStack}`;
    navigator.clipboard.writeText(text).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    });
  }

  render() {
    if (!this.state.error) return this.props.children;

    const { error, info, copied } = this.state;
    const C = {
      bg: '#07070a', surface: '#0e0e12', border: 'rgba(255,255,255,0.07)',
      gold: '#D4AF37', red: '#f87171', muted: '#52525b', text: '#e4e4e7',
    };

    return (
      <div style={{
        width: '100vw', height: '100vh',
        background: C.bg, color: C.text,
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Arial, sans-serif',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 40, boxSizing: 'border-box',
        WebkitUserSelect: 'none', userSelect: 'none',
      }}>
        {/* Icon */}
        <div style={{
          width: 64, height: 64, borderRadius: 16,
          background: 'rgba(239,68,68,0.12)',
          border: '1px solid rgba(239,68,68,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 24,
        }}>
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>

        <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 8, letterSpacing: -0.5 }}>
          Something went wrong
        </div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 32, textAlign: 'center', maxWidth: 400, lineHeight: 1.6 }}>
          ElevateFlow hit a render error. You can reload the view or go back to the Launcher.
        </div>

        {/* Error message */}
        <div style={{
          width: '100%', maxWidth: 560,
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 10, padding: '12px 16px', marginBottom: 24,
          fontFamily: '"SF Mono", "JetBrains Mono", monospace',
          fontSize: 11, color: C.red, lineHeight: 1.6,
          maxHeight: 120, overflowY: 'auto',
          WebkitUserSelect: 'text', userSelect: 'text',
        }}>
          {error?.toString()}
        </div>

        {/* Component stack (collapsed) */}
        <details style={{ width: '100%', maxWidth: 560, marginBottom: 28 }}>
          <summary style={{ fontSize: 11, color: C.muted, cursor: 'pointer', marginBottom: 8 }}>
            Component stack
          </summary>
          <pre style={{
            fontSize: 10, color: '#3f3f46', lineHeight: 1.5,
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 8, padding: 12, overflowX: 'auto',
            WebkitUserSelect: 'text', userSelect: 'text',
            whiteSpace: 'pre-wrap',
          }}>
            {info?.componentStack}
          </pre>
        </details>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => this.copyReport()}
            style={btn('rgba(255,255,255,0.05)', C.muted, 'rgba(255,255,255,0.09)')}
          >
            {copied ? '✓ Copied' : 'Copy Report'}
          </button>
          <button
            onClick={() => this.setState({ error: null, info: null })}
            style={btn('rgba(212,175,55,0.08)', C.gold, 'rgba(212,175,55,0.25)')}
          >
            Try Again
          </button>
          <button
            onClick={() => invoke('set_app_menu_visible', { visible: false }).finally(() => {
              window.location.hash = '/';
            })}
            style={btn('rgba(96,165,250,0.08)', '#60a5fa', 'rgba(96,165,250,0.25)')}
          >
            Go to Launcher
          </button>
        </div>
      </div>
    );
  }
}

function btn(bg, color, border) {
  return {
    padding: '9px 20px', borderRadius: 9, fontSize: 12, fontWeight: 700,
    cursor: 'pointer', border: `1px solid ${border}`,
    background: bg, color, letterSpacing: 0.3,
  };
}