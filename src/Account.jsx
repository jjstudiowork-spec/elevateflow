/**
 * Account.jsx — ElevateFlow Account Window
 * SETUP: npm install firebase
 * Replace FIREBASE_CONFIG with your project config from Firebase Console
 */
import React, { useState, useEffect, useRef } from 'react';
import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth, onAuthStateChanged, signOut,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import {
  getFirestore, doc, setDoc, getDoc,
} from 'firebase/firestore';
const FIREBASE_CONFIG = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID",
};

function fb() {
  const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
  return { auth: getAuth(app), db: getFirestore(app) };
}

function broadcast(user) {
  window._efUser = user;
  window.dispatchEvent(new CustomEvent('ef-auth-changed', { detail: user }));
  if (user) localStorage.setItem('ef_user', JSON.stringify(user));
  else localStorage.removeItem('ef_user');
}

// ── Colour palette ─────────────────────────────────────────────
const C = {
  bg:      '#111113',
  panel:   '#18181b',
  border:  '#27272a',
  gold:    '#D4AF37',
  goldFaint:'rgba(212,175,55,0.1)',
  goldBorder:'rgba(212,175,55,0.3)',
  text:    '#e4e4e7',
  muted:   '#71717a',
  dim:     '#3f3f46',
  red:     '#ef4444',
  green:   '#22c55e',
};

const root = {
  width: '100vw', height: '100vh', background: C.bg, color: C.text,
  fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Arial, sans-serif',
  display: 'flex', flexDirection: 'column', overflow: 'hidden', userSelect: 'none',
};

function Input({ label, value, onChange, type = 'text', placeholder, onEnter }) {
  return (
    <div style={{ marginBottom: 14 }}>
      {label && <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: C.muted, marginBottom: 5 }}>{label}</div>}
      <input
        type={type} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && onEnter?.()}
        style={{
          width: '100%', height: 38, padding: '0 12px', boxSizing: 'border-box',
          background: '#1c1c20', border: `1px solid ${C.border}`, borderRadius: 8,
          color: C.text, fontSize: 13, outline: 'none',
          fontFamily: '-apple-system, Arial, sans-serif',
          transition: 'border-color 0.15s',
        }}
        onFocus={e => e.target.style.borderColor = C.goldBorder}
        onBlur={e => e.target.style.borderColor = C.border}
      />
    </div>
  );
}

function Btn({ label, onClick, gold, danger, disabled, style = {} }) {
  const [h, setH] = useState(false);
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        width: '100%', height: 40, borderRadius: 8, cursor: disabled ? 'not-allowed' : 'pointer',
        fontSize: 13, fontWeight: 700, fontFamily: '-apple-system, Arial, sans-serif',
        marginBottom: 8, opacity: disabled ? 0.5 : 1, transition: 'all 0.15s',
        background: gold ? (h ? 'rgba(212,175,55,0.22)' : C.goldFaint)
                  : danger ? (h ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.08)')
                  : (h ? '#222' : '#1c1c20'),
        border: `1px solid ${gold ? C.goldBorder : danger ? 'rgba(239,68,68,0.3)' : C.border}`,
        color: gold ? C.gold : danger ? C.red : C.muted,
        ...style,
      }}
    >{label}</button>
  );
}

function Avatar({ url, initials, size = 80, onClick }) {
  return (
    <div onClick={onClick}
      style={{
        width: size, height: size, borderRadius: '50%',
        background: url ? 'transparent' : 'rgba(212,175,55,0.1)',
        border: `2px solid ${C.goldBorder}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', cursor: onClick ? 'pointer' : 'default',
        flexShrink: 0, position: 'relative',
        transition: 'border-color 0.2s',
        boxShadow: '0 0 0 4px rgba(212,175,55,0.05)',
      }}>
      {url
        ? <img src={url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span style={{ fontSize: size * 0.38, fontWeight: 800, color: C.gold }}>{initials}</span>}
      {onClick && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', background: 'rgba(0,0,0,0.5)', opacity: 0,
          borderRadius: '50%', transition: 'opacity 0.2s', fontSize: 10, color: '#fff',
        }}
          onMouseEnter={e => e.currentTarget.style.opacity = 1}
          onMouseLeave={e => e.currentTarget.style.opacity = 0}
        >Edit</div>
      )}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: C.border, margin: '20px 0' }} />;
}

function Badge({ children, color = C.gold }) {
  return (
    <span style={{
      fontSize: 9, fontWeight: 800, letterSpacing: 1.5, padding: '2px 7px',
      borderRadius: 20, background: `${color}18`, border: `1px solid ${color}40`,
      color, textTransform: 'uppercase',
    }}>{children}</span>
  );
}

// ── Profile view ───────────────────────────────────────────────
function ProfileView({ user, nickname, photoURL, onSignOut, onPhotoChange, onSaveCloud, onLoadCloud, busy, error }) {
  const initials = (nickname || '?')[0].toUpperCase();

  return (
    <div style={root}>
      {/* Header gradient */}
      <div style={{
        background: 'linear-gradient(160deg, rgba(212,175,55,0.08) 0%, transparent 60%)',
        padding: '28px 28px 20px',
        borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <Avatar url={photoURL} initials={initials} size={72} onClick={onPhotoChange} />
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.text, lineHeight: 1.1 }}>{nickname}</div>
            <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{user?.email}</div>
            <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
              <Badge>ElevateFlow</Badge>
              {user && <Badge color={C.green}>Signed In</Badge>}
            </div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
        {error && (
          <div style={{ fontSize: 12, color: C.red, marginBottom: 16, padding: '10px 14px',
            background: 'rgba(239,68,68,0.08)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)' }}>
            {error}
          </div>
        )}

        {/* Cloud sync */}
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: C.dim, marginBottom: 14 }}>CLOUD SYNC</div>
        <div style={{
          background: C.panel, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, marginBottom: 20,
        }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 14, lineHeight: 1.6 }}>
            Back up your libraries, playlists and songs. Sign in on any device to restore them.
          </div>
          <Btn label={busy ? 'Working…' : '↑  Save to Cloud'} gold onClick={onSaveCloud} disabled={busy} />
          <Btn label={busy ? 'Working…' : '↓  Load from Cloud'} onClick={onLoadCloud} disabled={busy} style={{ marginBottom: 0 }} />
        </div>

        <Divider />
        <Btn label="Sign Out" danger onClick={onSignOut} style={{ marginBottom: 0 }} />
      </div>
    </div>
  );
}

// ── Auth view ──────────────────────────────────────────────────
function AuthView({ onSignIn, onSignUp, busy, error }) {
  const [isSignup, setIsSignup] = useState(false);
  const [email,    setEmail]    = useState('');
  const [pass,     setPass]     = useState('');
  const [name,     setName]     = useState('');
  const [nick,     setNick]     = useState('');

  return (
    <div style={root}>
      {/* Logo area */}
      <div style={{
        background: 'linear-gradient(160deg, rgba(212,175,55,0.07) 0%, transparent 70%)',
        padding: '32px 28px 24px',
        borderBottom: `1px solid ${C.border}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: 'rgba(212,175,55,0.1)', border: `1.5px solid ${C.goldBorder}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 26, marginBottom: 14,
        }}>⚡</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.text }}>ElevateFlow</div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>
          {isSignup ? 'Create your account' : 'Sign in to your account'}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
        {error && (
          <div style={{ fontSize: 12, color: C.red, marginBottom: 16, padding: '10px 14px',
            background: 'rgba(239,68,68,0.08)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)' }}>
            {error}
          </div>
        )}

        <Input label="EMAIL" type="email" placeholder="you@example.com" value={email} onChange={setEmail}
          onEnter={() => !isSignup && onSignIn(email, pass)} />
        <Input label="PASSWORD" type="password" placeholder="••••••••" value={pass} onChange={setPass}
          onEnter={() => !isSignup && onSignIn(email, pass)} />

        {isSignup && <>
          <Input label="FULL NAME" placeholder="Your full name" value={name} onChange={setName} />
          <Input label="NICKNAME (shown in toolbar)" placeholder="e.g. Praise Team" value={nick} onChange={setNick} />
        </>}

        <Btn
          label={busy ? 'Please wait…' : isSignup ? 'Create Account' : 'Sign In'}
          gold onClick={() => isSignup ? onSignUp(email, pass, name, nick) : onSignIn(email, pass)}
          disabled={busy}
        />
        <Btn
          label={isSignup ? 'Already have an account? Sign In' : "New here? Create an account"}
          onClick={() => { setIsSignup(o => !o); }}
          style={{ marginBottom: 0 }}
        />
      </div>
    </div>
  );
}

// ── Root ───────────────────────────────────────────────────────
export default function Account() {
  const [view,     setView]     = useState('loading');
  const [user,     setUser]     = useState(null);
  const [nickname, setNickname] = useState('');
  const [photoURL, setPhotoURL] = useState(null);
  const [error,    setError]    = useState('');
  const [busy,     setBusy]     = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    const { auth, db } = fb();
    return onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        let nn  = u.email?.split('@')[0] || 'User';
        let photo = u.photoURL || null;
        try {
          const snap = await getDoc(doc(db, 'users', u.uid));
          if (snap.exists()) {
            const d = snap.data();
            nn    = d.nickname || nn;
            photo = d.photoURL || photo;
          }
        } catch {}
        setNickname(nn);
        setPhotoURL(photo);
        broadcast({ uid: u.uid, email: u.email, nickname: nn, displayName: u.displayName, photoURL: photo });
        setView('profile');
      } else {
        setUser(null); setNickname(''); setPhotoURL(null);
        broadcast(null);
        setView('signin');
      }
    });
  }, []);

  const doSignIn = async (email, pass) => {
    setError(''); setBusy(true);
    try { await signInWithEmailAndPassword(fb().auth, email.trim(), pass); }
    catch (e) { setError(e.message.replace('Firebase: ', '')); }
    setBusy(false);
  };

  const doSignUp = async (email, pass, name, nick) => {
    setError(''); setBusy(true);
    if (!name.trim() || !nick.trim()) { setError('Name and nickname are required.'); setBusy(false); return; }
    try {
      const { auth, db } = fb();
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
      await updateProfile(cred.user, { displayName: name.trim() });
      await setDoc(doc(db, 'users', cred.user.uid), {
        email: email.trim(), name: name.trim(), nickname: nick.trim(),
        createdAt: new Date().toISOString(),
      });
    } catch (e) { setError(e.message.replace('Firebase: ', '')); }
    setBusy(false);
  };

  const doSignOut = async () => { await signOut(fb().auth); };

  const handlePhotoChange = () => fileRef.current?.click();

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setBusy(true); setError('');
    try {
      // Convert to base64 data URL and store in Firestore (no Storage needed)
      const dataURL = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const { db } = fb();
      await setDoc(doc(db, 'users', user.uid), { photoURL: dataURL }, { merge: true });
      setPhotoURL(dataURL);
      broadcast({ uid: user.uid, email: user.email, nickname, displayName: user.displayName, photoURL: dataURL });
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  const pushCloud = async () => {
    setBusy(true); setError('');
    try {
      const { db } = fb();
      const data = {
        songs:     JSON.parse(localStorage.getItem('pro_songs')     || '[]'),
        libraries: JSON.parse(localStorage.getItem('pro_libraries') || '[]'),
        playlists: JSON.parse(localStorage.getItem('pro_playlists') || '[]'),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'userdata', user.uid), data);
      alert('Saved to cloud ✓');
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  const pullCloud = async () => {
    setBusy(true); setError('');
    try {
      const { db } = fb();
      const snap = await getDoc(doc(db, 'userdata', user.uid));
      if (!snap.exists()) { alert('No cloud data found.'); setBusy(false); return; }
      const d = snap.data();
      if (d.songs)     localStorage.setItem('pro_songs',     JSON.stringify(d.songs));
      if (d.libraries) localStorage.setItem('pro_libraries', JSON.stringify(d.libraries));
      if (d.playlists) localStorage.setItem('pro_playlists', JSON.stringify(d.playlists));
      alert('Loaded ✓ — restart ElevateFlow to apply.');
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  if (view === 'loading') return (
    <div style={{ ...root, alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 12, color: C.dim }}>Connecting…</div>
    </div>
  );

  if (view === 'profile') return (
    <>
      <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={handlePhotoUpload} />
      <ProfileView
        user={user} nickname={nickname} photoURL={photoURL}
        onSignOut={doSignOut} onPhotoChange={handlePhotoChange}
        onSaveCloud={pushCloud} onLoadCloud={pullCloud}
        busy={busy} error={error}
      />
    </>
  );

  return <AuthView onSignIn={doSignIn} onSignUp={doSignUp} busy={busy} error={error} />;
}