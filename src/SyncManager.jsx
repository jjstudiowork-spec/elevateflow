import React, { useState, useEffect } from 'react';
import { db } from './firebaseConfig';
import { doc, setDoc, onSnapshot, updateDoc, getDoc } from "firebase/firestore";

const SyncManager = ({ currentSlide, onSlideChange }) => {
  const [sessionCode, setSessionCode] = useState(null);
  const [inputCode, setInputCode] = useState("");

  // Create a new session (Host)
  const startHosting = async () => {
    const newCode = Math.floor(1000 + Math.random() * 9000).toString();
    const sessionRef = doc(db, "sessions", newCode);
    
    await setDoc(sessionRef, {
      slideIndex: currentSlide,
      lastUpdated: Date.now()
    });

    setSessionCode(newCode);
    setupListener(newCode);
  };

  // Join a session (Remote)
  const joinSession = async () => {
    const sessionRef = doc(db, "sessions", inputCode);
    const snap = await getDoc(sessionRef);

    if (snap.exists()) {
      setSessionCode(inputCode);
      setupListener(inputCode);
    } else {
      alert("Code not found!");
    }
  };

  // Real-time listener
  const setupListener = (code) => {
    const sessionRef = doc(db, "sessions", code);
    onSnapshot(sessionRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.slideIndex !== currentSlide) {
          onSlideChange(data.slideIndex);
        }
      }
    });
  };

  // Push local changes to cloud
  useEffect(() => {
    if (sessionCode) {
      const sessionRef = doc(db, "sessions", sessionCode);
      updateDoc(sessionRef, { 
        slideIndex: currentSlide,
        lastUpdated: Date.now()
      });
    }
  }, [currentSlide, sessionCode]);

  return (
    <div style={{ padding: '15px', background: '#1e1e1e', borderRadius: '8px', border: '1px solid #333', marginTop: '10px' }}>
      {!sessionCode ? (
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button onClick={startHosting} style={{ background: '#4a90e2', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer' }}>Host</button>
          <span style={{ color: '#666' }}>or</span>
          <input 
            value={inputCode} 
            onChange={(e) => setInputCode(e.target.value)} 
            placeholder="Code"
            style={{ padding: '8px', borderRadius: '4px', border: '1px solid #444', background: '#000', color: '#fff', width: '80px' }}
          />
          <button onClick={joinSession} style={{ background: '#27ae60', color: 'white', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer' }}>Join</button>
        </div>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: '12px', color: '#aaa' }}>SYNC CODE</p>
          <h2 style={{ margin: '5px 0', color: '#4ade80' }}>{sessionCode}</h2>
        </div>
      )}
    </div>
  );
};

export default SyncManager;