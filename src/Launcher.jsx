/**
 * Launcher.jsx — ElevateFlow App Launcher
 * Shown after splash. Choose your studio: Flow or Stream.
 */
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentWindow } from '@tauri-apps/api/window';

// ── Icons ──────────────────────────────────────────────────────
function FlowIcon() {
  return (
    <svg viewBox="0 0 56 56" width="56" height="56" fill="none">
      <rect x="4" y="9" width="48" height="32" rx="4" fill="white" fillOpacity="0.12" stroke="white" strokeOpacity="0.5" strokeWidth="1.5"/>
      <rect x="10" y="16" width="20" height="2.5" rx="1.25" fill="white" fillOpacity="0.85"/>
      <rect x="10" y="22" width="14" height="2" rx="1" fill="white" fillOpacity="0.5"/>
      <rect x="10" y="27" width="17" height="2" rx="1" fill="white" fillOpacity="0.4"/>
      <rect x="34" y="15" width="14" height="18" rx="3" fill="white" fillOpacity="0.1" stroke="white" strokeOpacity="0.3" strokeWidth="1"/>
      <path d="M38 24l5 3-5 3v-6z" fill="white" fillOpacity="0.8"/>
      <rect x="18" y="43" width="20" height="2" rx="1" fill="white" fillOpacity="0.3"/>
      <rect x="23" y="41" width="10" height="2" rx="1" fill="white" fillOpacity="0.25"/>
    </svg>
  );
}

function StreamIcon() {
  return (
    <svg viewBox="0 0 56 56" width="56" height="56" fill="none">
      <rect x="4" y="12" width="34" height="24" rx="3.5" fill="white" fillOpacity="0.12" stroke="white" strokeOpacity="0.5" strokeWidth="1.5"/>
      <path d="M38 19l14 8-14 8V19z" fill="white" fillOpacity="0.7"/>
      <circle cx="11" cy="19" r="2.5" fill="#ef4444"/>
      <rect x="9" y="25" width="20" height="7" rx="2" fill="white" fillOpacity="0.08"/>
      <rect x="11" y="27" width="16" height="1.5" rx="0.75" fill="white" fillOpacity="0.3"/>
      <rect x="11" y="30" width="10" height="1.5" rx="0.75" fill="white" fillOpacity="0.2"/>
      <rect x="8" y="40" width="6" height="6" rx="1.5" fill="white" fillOpacity="0.5"/>
      <rect x="17" y="40" width="6" height="6" rx="1.5" fill="white" fillOpacity="0.35"/>
      <rect x="26" y="40" width="6" height="6" rx="1.5" fill="white" fillOpacity="0.2"/>
      <rect x="35" y="40" width="6" height="6" rx="1.5" fill="white" fillOpacity="0.12"/>
    </svg>
  );
}

function MixIcon() {
  return (
    <svg viewBox="0 0 56 56" width="56" height="56" fill="none">
      {/* Level Sliders */}
      <rect x="12" y="14" width="4" height="28" rx="2" fill="white" fillOpacity="0.1" />
      <rect x="12" y="28" width="4" height="14" rx="2" fill="white" fillOpacity="0.8" />
      <circle cx="14" cy="28" r="3" fill="white" />
      
      <rect x="26" y="14" width="4" height="28" rx="2" fill="white" fillOpacity="0.1" />
      <rect x="26" y="18" width="4" height="24" rx="2" fill="white" fillOpacity="0.8" />
      <circle cx="28" cy="18" r="3" fill="white" />
      
      <rect x="40" y="14" width="4" height="28" rx="2" fill="white" fillOpacity="0.1" />
      <rect x="40" y="32" width="4" height="10" rx="2" fill="white" fillOpacity="0.8" />
      <circle cx="42" cy="32" r="3" fill="white" />
      
      {/* Decorative Waveform */}
      <path d="M10 46 Q 14 42, 18 46 T 26 46 T 34 46 T 42 46 T 50 46" stroke="white" strokeOpacity="0.3" strokeWidth="1.5" />
    </svg>
  );
}

// ── App Card ───────────────────────────────────────────────────
function AppCard({ app, index }) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [mounted, setMounted] = useState(false);

  const disabled = app.comingSoon;

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 120 + index * 120);
    return () => clearTimeout(t);
  }, [index]);

  const card = {
    width: 320,
    borderRadius: 24,
    background: hovered
      ? 'rgba(255,255,255,0.035)'
      : 'rgba(255,255,255,0.018)',
    border: `1px solid ${hovered ? app.borderColor : 'rgba(255,255,255,0.07)'}`,
    padding: '40px 36px 36px',
    cursor: disabled ? 'default' : 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    position: 'relative',
    overflow: 'hidden',
    transition:
      'transform 0.35s cubic-bezier(0.34,1.56,0.64,1), border-color 0.25s, box-shadow 0.35s, background 0.2s',
    transform: !mounted
      ? 'translateY(32px)'
      : hovered && !disabled
      ? pressed
        ? 'translateY(-2px) scale(0.99)'
        : 'translateY(-10px) scale(1.01)'
      : 'translateY(0)',
    boxShadow:
      hovered && !disabled
        ? `0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px ${app.borderColor}, ${app.glow}`
        : '0 8px 32px rgba(0,0,0,0.4)',
    opacity: mounted ? 1 : 0,
    filter: disabled ? 'grayscale(0.15)' : 'none',
    WebkitUserSelect: 'none',
    userSelect: 'none',
  };

  return (
    <div
      style={card}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setPressed(false);
      }}
      onMouseDown={() => !disabled && setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onClick={() => !disabled && navigate(app.route)}
    >
      {/* Coming Soon Badge */}
      {disabled && (
        <div
          style={{
            position: 'absolute',
            top: 18,
            right: 18,
            padding: '6px 10px',
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 1,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#a1a1aa',
            zIndex: 5,
          }}
        >
          COMING SOON
        </div>
      )}

      {/* Ambient glow orb behind icon */}
      <div
        style={{
          position: 'absolute',
          top: -60,
          right: -60,
          width: 200,
          height: 200,
          borderRadius: '50%',
          background: app.orbColor,
          filter: 'blur(60px)',
          opacity: hovered && !disabled ? 0.5 : 0.2,
          transition: 'opacity 0.4s',
          pointerEvents: 'none',
        }}
      />

      {/* Icon */}
      <div
        style={{
          width: 88,
          height: 88,
          borderRadius: 22,
          background: app.gradient,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 28,
          boxShadow:
            hovered && !disabled
              ? `0 16px 40px ${app.shadowColor}`
              : `0 8px 24px ${app.shadowColor}`,
          transition: 'box-shadow 0.3s',
          flexShrink: 0,
        }}
      >
        {app.icon}
      </div>

      {/* Badge */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          background: app.badgeBg,
          border: `1px solid ${app.badgeBorder}`,
          borderRadius: 20,
          padding: '3px 10px',
          marginBottom: 14,
          alignSelf: 'flex-start',
        }}
      >
        <div
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: app.badgeDot,
          }}
        />
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: app.badgeText,
            letterSpacing: 0.8,
          }}
        >
          {app.badge}
        </span>
      </div>

      {/* Name */}
      <div
        style={{
          fontSize: 34,
          fontWeight: 800,
          color: '#e4e4e7',
          letterSpacing: -1,
          lineHeight: 1,
          marginBottom: 10,
        }}
      >
        {app.name}
      </div>

      {/* Description */}
      <div
        style={{
          fontSize: 13.5,
          color: '#52525b',
          lineHeight: 1.65,
          flex: 1,
          marginBottom: 32,
        }}
      >
        {app.description}
      </div>

      {/* Divider */}
      <div
        style={{
          height: 1,
          background: 'rgba(255,255,255,0.05)',
          marginBottom: 24,
        }}
      />

      {/* Launch button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            height: 38,
            padding: '0 20px',
            background: disabled
              ? 'rgba(255,255,255,0.03)'
              : hovered
              ? app.btnBgHover
              : app.btnBg,
            border: `1px solid ${
              disabled
                ? 'rgba(255,255,255,0.06)'
                : hovered
                ? app.btnBorderHover
                : app.btnBorder
            }`,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.2s',
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: disabled
                ? '#71717a'
                : hovered
                ? app.btnTextHover
                : '#52525b',
              letterSpacing: 0.3,
              transition: 'color 0.2s',
            }}
          >
            {disabled ? 'Coming Soon' : `Open ${app.name}`}
          </span>

          {!disabled && (
            <svg
              viewBox="0 0 16 16"
              width="12"
              height="12"
              fill="none"
              stroke={hovered ? app.btnTextHover : '#52525b'}
              strokeWidth="2"
              strokeLinecap="round"
              style={{
                transition: 'all 0.2s',
                transform: hovered ? 'translateX(2px)' : 'none',
              }}
            >
              <path d="M3 8h10M9 4l4 4-4 4" />
            </svg>
          )}
        </div>

        {/* Version tag */}
        <span
          style={{
            fontSize: 10,
            color: '#27272a',
            fontFamily: 'monospace',
          }}
        >
          v1.0
        </span>
      </div>
    </div>
  );
}

// ── App Definitions ────────────────────────────────────────────
const APPS = [
  {
    id: 'flow',
    name: 'Flow',
    badge: 'PRESENTATION',
    description: 'Design stunning slides, manage your media library, and lead your congregation with powerful live presentation controls.',
    route: '/app',
    gradient: 'linear-gradient(140deg, #2563eb 0%, #7c3aed 100%)',
    orbColor: 'radial-gradient(circle, rgba(99,102,241,0.8), transparent)',
    shadowColor: 'rgba(99,102,241,0.4)',
    borderColor: 'rgba(99,102,241,0.35)',
    glow: '0 0 80px rgba(99,102,241,0.12)',
    badgeBg: 'rgba(99,102,241,0.08)',
    badgeBorder: 'rgba(99,102,241,0.2)',
    badgeDot: '#6366f1',
    badgeText: '#818cf8',
    btnBg: 'transparent',
    btnBorder: 'rgba(255,255,255,0.07)',
    btnBgHover: 'rgba(99,102,241,0.12)',
    btnBorderHover: 'rgba(99,102,241,0.4)',
    btnText: '#52525b',
    btnTextHover: '#818cf8',
    icon: <FlowIcon />,
  },
  {
    id: 'mix',
    name: 'Mix',
    comingSoon: true,
    badge: 'AUDIO ENGINE',
    description: 'Advanced multi-track mixing, real-time effects processing, and automated leveling for a pristine worship sound.',
    route: '/mix',
    gradient: 'linear-gradient(140deg, #f59e0b 0%, #d97706 100%)',
    orbColor: 'radial-gradient(circle, rgba(245,158,11,0.8), transparent)',
    shadowColor: 'rgba(245,158,11,0.35)',
    borderColor: 'rgba(251,191,36,0.35)',
    glow: '0 0 80px rgba(245,158,11,0.1)',
    badgeBg: 'rgba(251,191,36,0.08)',
    badgeBorder: 'rgba(251,191,36,0.2)',
    badgeDot: '#fbbf24',
    badgeText: '#fcd34d',
    btnBg: 'transparent',
    btnBorder: 'rgba(255,255,255,0.07)',
    btnBgHover: 'rgba(245,158,11,0.12)',
    btnBorderHover: 'rgba(251,191,36,0.4)',
    btnText: '#52525b',
    btnTextHover: '#fcd34d',
    icon: <MixIcon />,
  },
  {
    id: 'stream',
    name: 'Stream',
    comingSoon: true,
    badge: 'LIVE STUDIO',
    description: 'Mix scenes, manage audio channels, control transitions, and broadcast your service live to audiences everywhere.',
    route: '/stream',
    gradient: 'linear-gradient(140deg, #dc2626 0%, #ea580c 100%)',
    orbColor: 'radial-gradient(circle, rgba(220,38,38,0.8), transparent)',
    shadowColor: 'rgba(220,38,38,0.35)',
    borderColor: 'rgba(239,68,68,0.35)',
    glow: '0 0 80px rgba(220,38,38,0.1)',
    badgeBg: 'rgba(239,68,68,0.08)',
    badgeBorder: 'rgba(239,68,68,0.2)',
    badgeDot: '#ef4444',
    badgeText: '#f87171',
    btnBg: 'transparent',
    btnBorder: 'rgba(255,255,255,0.07)',
    btnBgHover: 'rgba(220,38,38,0.12)',
    btnBorderHover: 'rgba(239,68,68,0.4)',
    btnText: '#52525b',
    btnTextHover: '#f87171',
    icon: <StreamIcon />,
  },
];

// ── Main Launcher ──────────────────────────────────────────────
export default function Launcher() {
  const [visible, setVisible] = useState(false);

  // Hide Flow-specific menu items when on launcher
  useEffect(() => {
    import('@tauri-apps/api/core').then(({ invoke }) => {
      invoke('set_app_menu_visible', { visible: false }).catch(() => {});
    });
  }, []);
  const [time,    setTime]    = useState('');

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const fmt = () => {
      const d = new Date();
      setTime(d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    fmt();
    const id = setInterval(fmt, 10000);
    return () => clearInterval(id);
  }, []);

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: '#07070a',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, Arial, sans-serif',
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Background — subtle radial orbs */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `
          radial-gradient(ellipse 60% 50% at 20% 20%, rgba(99,102,241,0.06) 0%, transparent 70%),
          radial-gradient(ellipse 60% 50% at 80% 80%, rgba(220,38,38,0.05) 0%, transparent 70%),
          radial-gradient(ellipse 40% 40% at 50% 110%, rgba(212,175,55,0.04) 0%, transparent 70%)
        `,
      }} />

      {/* Drag region */}
      <div data-tauri-drag-region style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 40,
        pointerEvents: 'none',
      }} />

      {/* ── Wordmark ── */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        marginBottom: 60,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(-16px)',
        transition: 'opacity 0.5s ease, transform 0.5s ease',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10,
        }}>
          {/* EF monogram */}
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: 'linear-gradient(135deg, #D4AF37, #a08020)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 14, fontWeight: 900, color: '#000', letterSpacing: -0.5 }}>EF</span>
          </div>
          <span style={{
            fontSize: 15, fontWeight: 800, color: '#3f3f46', letterSpacing: 4,
            textTransform: 'uppercase',
          }}>
            ELEVATE<span style={{ color: '#D4AF37' }}>.</span>
          </span>
        </div>
        <div style={{ fontSize: 13, color: '#27272a', letterSpacing: 0.3 }}>
          Choose your studio
        </div>
      </div>

      {/* ── Cards ── */}
      <div style={{
        display: 'flex', gap: 20, alignItems: 'stretch',
      }}>
        {APPS.map((app, i) => (
          <AppCard key={app.id} app={app} index={i} />
        ))}
      </div>

      {/* ── Footer ── */}
      <div style={{
        position: 'absolute', bottom: 24,
        display: 'flex', alignItems: 'center', gap: 24,
        opacity: visible ? 0.4 : 0,
        transition: 'opacity 0.8s ease 0.6s',
      }}>
        <span style={{ fontSize: 10, color: '#27272a', fontFamily: 'monospace' }}>
          Elevate v1.0.0
        </span>
        <div style={{ width: 3, height: 3, borderRadius: '50%', background: '#27272a' }} />
        <span style={{ fontSize: 10, color: '#27272a', fontFamily: 'monospace' }}>{time}</span>
        <div style={{ width: 3, height: 3, borderRadius: '50%', background: '#27272a' }} />
        <span style={{ fontSize: 10, color: '#27272a', fontFamily: 'monospace' }}>macOS</span>
      </div>
    </div>
  );
}