/**
 * Tutorial.jsx — ElevateFlow onboarding tutorial
 * Shows every time (beta mode). Step-by-step interactive walkthrough.
 */
import React, { useState } from 'react';

const STEPS = [
  {
    icon: '👋',
    title: 'Welcome to ElevateFlow',
    subtitle: 'Worship Presentation Software',
    body: 'ElevateFlow is a ProPresenter-style live presentation app built for churches and worship teams. This quick guide will walk you through the basics.\n\nSince ElevateFlow is still in beta, this tutorial shows every time you open the app.',
    tip: null,
  },
  {
    icon: '📚',
    title: 'Libraries & Songs',
    subtitle: 'Organise your content',
    body: 'The left sidebar is your content library.\n\n• Create a **Library** to group songs together (e.g. Sunday Morning, Youth)\n• Add **Songs** to a library — each song has its own slides\n• Create **Playlists** to build a service order from multiple libraries',
    tip: 'Right-click any song or library for more options',
  },
  {
    icon: '🎬',
    title: 'Show Mode',
    subtitle: 'Going live',
    body: 'Show mode is your live presentation view. Click a slide to send it to your audience display.\n\n• **Arrow keys** → navigate between slides\n• **Escape** → clear the screen\n• **A–Z hotkeys** → trigger slides directly (assign in right-click menu)\n• The right panel shows your preview, audio, and stage controls',
    tip: 'Press Escape to black out the screen instantly',
  },
  {
    icon: '✏️',
    title: 'Edit Mode',
    subtitle: 'Design your slides',
    body: 'Edit mode lets you design individual slides.\n\n• Double-click a slide to edit its text\n• Drag the textbox to reposition it\n• Use the right inspector to change font, size, colour, and style\n• The **Cue tab** lets you assign a timecode trigger and slide notes',
    tip: 'Cmd+2 opens Edit mode from anywhere',
  },
  {
    icon: '📝',
    title: 'Flow Mode',
    subtitle: 'Edit lyrics like a document',
    body: 'Flow mode shows all your slides as a continuous flowing document — great for quickly editing lyrics.\n\n• Type naturally in each slide block\n• **⌥ Return** inserts a slide break at the cursor\n• **Delete** at the start of a slide merges it with the one above\n• The right panel shows a live thumbnail preview of every slide',
    tip: 'Flow mode is perfect for importing and reformatting lyrics',
  },
  {
    icon: '🖥',
    title: 'Stage Mode',
    subtitle: 'Design your stage display',
    body: 'Stage mode lets you design a custom layout for your stage monitors — what the musicians see.\n\n• Add elements: Current Slide, Next Slide, Clock, Timer, Message, Notes\n• Drag elements to position them on the canvas\n• Create multiple layouts and switch between them in the Stage tab of the right panel\n• The Stage Controls panel (right panel) has a countdown timer and stage message',
    tip: 'Cmd+3 opens Stage mode',
  },
  {
    icon: '🎨',
    title: 'Themes',
    subtitle: 'Consistent styling across songs',
    body: 'Themes let you save a complete text style — font, size, colour, position, and size — and apply it to all slides in a song.\n\n• Click the **Themes** button in the toolbar to apply a theme\n• Click **+ Add Theme** to open the Theme Editor and design a new one\n• All theme properties including textbox position and size are saved and applied',
    tip: 'Apply a theme to instantly restyle an entire song',
  },
  {
    icon: '📺',
    title: 'Screens & Output',
    subtitle: 'Configure your displays',
    body: 'Connect your output screens via the toolbar or the Screens menu.\n\n• **Audience** → the main display your congregation sees\n• **Stage** → monitors for musicians\n• **Configure Screens** (Opt+Cmd+1) → set up screen assignments, placeholders, and NDI\n• **Windowed Output** (Cmd+3 in Screens menu) → open a resizable output window',
    tip: 'You can have multiple audience and stage screens',
  },
  {
    icon: '⏱',
    title: 'Timecode',
    subtitle: 'Sync with audio timecode',
    body: 'ElevateFlow can receive SMPTE LTC timecode to trigger slides automatically.\n\n• Open **Timecode** from the View menu\n• Select your audio input device (e.g. BlackHole 2ch)\n• Play a timecode audio file routed through that device\n• Assign timecode values to slides in the **Cue tab** in Edit mode',
    tip: 'Great for syncing presentations with backing tracks',
  },
  {
    icon: '🤖',
    title: 'AI Assistant',
    subtitle: 'Powered by Gemini',
    body: 'The AI assistant (✦ AI button in toolbar) can help you with ElevateFlow.\n\n• Create songs from lyrics — just paste them and ask\n• Search your library\n• Clear the screen\n• Answer any question about the app or anything else\n\nThe assistant uses Gemini and works out of the box.',
    tip: 'Try: "Create Amazing Grace with 2 lines per slide"',
  },
  {
    icon: '🚀',
    title: "You're ready!",
    subtitle: 'ElevateFlow Beta',
    body: "You know the basics. ElevateFlow is still in beta so you may encounter bugs — if you do, we'd love to hear about them.\n\nA few handy shortcuts:\n• **Cmd+1/2/3/4** → Show / Edit / Stage / Flow\n• **Cmd+,** → Settings\n• **Cmd+T** → Timecode\n• **Arrow keys** → Navigate slides in Show mode\n• **Escape** → Clear screen",
    tip: null,
  },
];

function StepDots({ total, current }) {
  return (
    <div style={{ display: 'flex', gap: 5, justifyContent: 'center' }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          width: i === current ? 18 : 6, height: 6, borderRadius: 3,
          background: i === current ? '#D4AF37' : '#27272a',
          transition: 'all 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        }} />
      ))}
    </div>
  );
}

export default function Tutorial({ onClose }) {
  const [step, setStep]     = useState(0);
  const [visible, setVisible] = useState(true);
  const current = STEPS[step];
  const isLast  = step === STEPS.length - 1;

  const dismiss = () => {
    setVisible(false);
    setTimeout(onClose, 250);
  };

  // Parse **bold** markdown
  const renderBody = (text) => {
    return text.split('\n').map((line, i) => {
      const parts = line.split(/\*\*(.*?)\*\*/g);
      return (
        <p key={i} style={{ margin: line.startsWith('•') ? '3px 0' : '0 0 6px', lineHeight: 1.65 }}>
          {parts.map((part, j) =>
            j % 2 === 1
              ? <strong key={j} style={{ color: '#e4e4e7', fontWeight: 700 }}>{part}</strong>
              : part
          )}
        </p>
      );
    });
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99998,
      background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(16px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      opacity: visible ? 1 : 0, transition: 'opacity 0.25s ease',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Arial, sans-serif',
    }}>
      <div style={{
        width: 520, background: 'rgba(10,10,12,0.98)',
        borderRadius: 22, border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '0 48px 120px rgba(0,0,0,0.95)',
        overflow: 'hidden',
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.97)',
        transition: 'transform 0.25s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        {/* Gold top bar */}
        <div style={{ height: 3, background: 'linear-gradient(90deg, transparent, #D4AF37 20%, #f7e084 50%, #D4AF37 80%, transparent)' }} />

        {/* Progress bar */}
        <div style={{ height: 2, background: '#0e0e12' }}>
          <div style={{
            height: '100%', background: '#D4AF37',
            width: `${((step + 1) / STEPS.length) * 100}%`,
            transition: 'width 0.3s ease',
            boxShadow: '0 0 8px #D4AF37',
          }} />
        </div>

        <div style={{ padding: '32px 36px 28px' }}>
          {/* Beta badge */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <div style={{
              fontSize: 9, fontWeight: 800, letterSpacing: 2, padding: '3px 10px',
              borderRadius: 20, background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.25)',
              color: '#D4AF37',
            }}>BETA</div>
            <div style={{ fontSize: 10, color: '#3f3f46' }}>{step + 1} / {STEPS.length}</div>
          </div>

          {/* Icon */}
          <div style={{ fontSize: 48, marginBottom: 16, lineHeight: 1 }}>{current.icon}</div>

          {/* Title */}
          <div style={{ fontSize: 22, fontWeight: 800, color: '#f0f0f0', letterSpacing: -0.5, marginBottom: 4 }}>
            {current.title}
          </div>
          <div style={{ fontSize: 12, color: '#52525b', marginBottom: 20 }}>{current.subtitle}</div>

          {/* Body */}
          <div style={{ fontSize: 13, color: '#71717a', lineHeight: 1.65, marginBottom: current.tip ? 16 : 28 }}>
            {renderBody(current.body)}
          </div>

          {/* Tip */}
          {current.tip && (
            <div style={{
              padding: '10px 14px', borderRadius: 10, marginBottom: 24,
              background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.15)',
              display: 'flex', gap: 8, alignItems: 'flex-start',
            }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>💡</span>
              <span style={{ fontSize: 11, color: '#a16207', lineHeight: 1.5 }}>{current.tip}</span>
            </div>
          )}

          {/* Dots */}
          <StepDots total={STEPS.length} current={step} />

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)} style={{
                height: 42, padding: '0 20px', borderRadius: 10, cursor: 'pointer',
                background: 'transparent', border: '1px solid #1e1e24',
                color: '#52525b', fontSize: 13, fontWeight: 600,
              }}>← Back</button>
            )}
            <div style={{ flex: 1 }} />
            <button onClick={dismiss} style={{
              height: 42, padding: '0 20px', borderRadius: 10, cursor: 'pointer',
              background: 'transparent', border: '1px solid #1e1e24',
              color: '#3f3f46', fontSize: 13,
            }}>Skip</button>
            <button onClick={() => isLast ? dismiss() : setStep(s => s + 1)} style={{
              height: 42, padding: '0 24px', borderRadius: 10, cursor: 'pointer',
              background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.4)',
              color: '#D4AF37', fontSize: 13, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {isLast ? "Let's Go 🚀" : 'Next →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}