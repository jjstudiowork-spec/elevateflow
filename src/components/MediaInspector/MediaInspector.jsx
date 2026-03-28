/**
 * MediaInspector.jsx
 * Standalone window component — reads file from localStorage key
 * 'ef_inspector_file', set by MediaBin before opening the window.
 */
import React, { useRef, useState, useEffect } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import './MediaInspector.css';

function fmt(s) {
  if (!s || isNaN(s)) return '00:00:00;00';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const fr = Math.floor((s % 1) * 30);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')};${String(fr).padStart(2,'0')}`;
}

export default function MediaInspector() {
  const [file, setFile] = useState(null);
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [videoSize, setVideoSize] = useState({ w: 0, h: 0 });
  const [thumbnail, setThumbnail] = useState(null);
  const [actionName, setActionName] = useState('');
  const [fit, setFit] = useState('cover');

  // Load file from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('ef_inspector_file');
      if (raw) {
        const f = JSON.parse(raw);
        setFile(f);
        setActionName(f.name || '');
        setFit(f.videoFit || 'cover');
      }
    } catch {}
  }, []);

  const src = file
    ? (file.src || (file.path ? convertFileSrc(file.path) : null))
    : null;

  // Wire up video events
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onMeta = () => { setDuration(v.duration || 0); setVideoSize({ w: v.videoWidth, h: v.videoHeight }); };
    const onTime = () => setCurrentTime(v.currentTime);
    const onPlay  = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    v.addEventListener('loadedmetadata', onMeta);
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    return () => { v.removeEventListener('loadedmetadata', onMeta); v.removeEventListener('timeupdate', onTime); v.removeEventListener('play', onPlay); v.removeEventListener('pause', onPause); };
  }, [src]);

  const togglePlay = () => { const v = videoRef.current; if (!v) return; playing ? v.pause() : v.play(); };
  const skip = (s) => { const v = videoRef.current; if (v) v.currentTime = Math.max(0, Math.min(duration, v.currentTime + s)); };
  const seekStart = () => { if (videoRef.current) videoRef.current.currentTime = 0; };
  const seekEnd   = () => { if (videoRef.current) videoRef.current.currentTime = duration; };

  const captureFrame = () => {
    const v = videoRef.current;
    if (!v) return;
    const c = document.createElement('canvas');
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d').drawImage(v, 0, 0);
    setThumbnail(c.toDataURL('image/jpeg', 0.85));
  };

  if (!file) return (
    <div style={{ background:'#1c1c1e', height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', color:'#333', fontFamily:'Arial' }}>
      Loading…
    </div>
  );

  const isVideo = file.type === 'video';
  // VU bars
  const vu = [0.3,0.6,0.9,0.75,0.5,0.8,0.95,0.4,0.7,0.6,0.85,0.5,0.3,0.7,0.9,0.6];

  return (
    <div className="mi-win">

      {/* ── LEFT ── */}
      <div className="mi-win__left">
        <div className="mi-win__video-area">
          {/* VU meter */}
          <div className="mi-win__vu">
            {vu.map((h,i) => (
              <div key={i} className="mi-win__vu-bar"
                style={{ height:`${h*100}%`, background: h>0.85?'#ef4444':h>0.6?'#eab308':'#22c55e' }}
              />
            ))}
          </div>
          {/* Video */}
          {isVideo && src
            ? <video ref={videoRef} src={src} className="mi-win__video" playsInline onClick={togglePlay} />
            : src
            ? <img src={src} className="mi-win__video" alt={file.name} style={{objectFit:'contain'}} />
            : <div className="mi-win__no-preview">No Preview Available</div>
          }
        </div>

        {/* Scrubber */}
        <div className="mi-win__scrubber-wrap">
          <input type="range" className="mi-win__scrubber"
            min={0} max={duration||1} step={0.033} value={currentTime}
            onChange={e => { if (videoRef.current) videoRef.current.currentTime = parseFloat(e.target.value); }}
          />
        </div>

        {/* Transport bar */}
        <div className="mi-win__transport">
          <span className="mi-win__tc">{fmt(currentTime)}</span>
          <div className="mi-win__btns">
            <TB onClick={seekStart} title="Go to start"><GoStartIcon/></TB>
            <TB onClick={()=>skip(-0.033)} title="-1 frame"><StepBackIcon/></TB>
            <TB onClick={togglePlay} title={playing?'Pause':'Play'} primary>
              {playing ? <PauseIcon/> : <PlayIcon/>}
            </TB>
            <TB onClick={()=>skip(0.033)} title="+1 frame"><StepFwdIcon/></TB>
            <TB onClick={()=>skip(-15)} title="-15s"><span style={{fontSize:9,fontWeight:700}}>-15</span></TB>
            <TB onClick={()=>skip(15)}  title="+15s"><span style={{fontSize:9,fontWeight:700}}>+15</span></TB>
            <TB onClick={()=>skip(-30)} title="-30s"><span style={{fontSize:9,fontWeight:700}}>-30</span></TB>
            <TB onClick={seekEnd} title="Go to end"><GoEndIcon/></TB>
          </div>
          <span className="mi-win__tc">{fmt(duration)}</span>
        </div>
      </div>

      {/* Divider */}
      <div className="mi-win__divider" />

      {/* ── RIGHT ── */}
      <div className="mi-win__right">

        <div className="mi-win__row">
          <span className="mi-win__label">Action Name</span>
          <input className="mi-win__input" value={actionName}
            onChange={e => setActionName(e.target.value)} />
        </div>

        <div className="mi-win__row mi-win__row--path">
          <span className="mi-win__label">File Path</span>
          <span className="mi-win__path" title={file.path||''}>{file.path||'—'}</span>
        </div>

        <div className="mi-win__row mi-win__row--top">
          <span className="mi-win__label">Thumbnail</span>
          <div className="mi-win__thumb-col">
            <div className="mi-win__thumb">
              {thumbnail
                ? <img src={thumbnail} alt="thumb"/>
                : src && isVideo
                ? <video src={src} muted style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                : src ? <img src={src} alt="thumb"/> : null
              }
            </div>
            {isVideo && (
              <button className="mi-win__frame-btn" onClick={captureFrame}>
                Set To Current Frame
              </button>
            )}
          </div>
        </div>

        <div className="mi-win__sep"/>

        <div className="mi-win__details-wrap">
          <span className="mi-win__label mi-win__label--top">Details</span>
          <div className="mi-win__details">
            <Row k="Type"     v={file.type?.toUpperCase()||'—'}/>
            <Row k="Duration" v={fmt(duration)}/>
            <Row k="Size"     v={videoSize.w ? `${videoSize.w} x ${videoSize.h}` : '—'}/>
            <Row k="FPS"      v="29.97"/>
          </div>
        </div>

        <div className="mi-win__sep"/>

        <div className="mi-win__row">
          <span className="mi-win__label">Video Fit</span>
          <div className="mi-win__fit-btns">
            {[['cover','Fill'],['contain','Fit'],['fill','Stretch']].map(([id,label])=>(
              <button key={id}
                className={`mi-win__fit-btn ${fit===id?'mi-win__fit-btn--on':''}`}
                onClick={()=>{ setFit(id); /* write back */ const f2={...file,videoFit:id}; localStorage.setItem('ef_inspector_file',JSON.stringify(f2)); }}
              >{label}</button>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

function Row({k,v}) {
  return <>
    <span className="mi-win__dk">{k}</span>
    <span className="mi-win__dv">{v}</span>
  </>;
}

function TB({children,onClick,title,primary}) {
  return <button className={`mi-win__tbtn${primary?' mi-win__tbtn--p':''}`} onClick={onClick} title={title}>{children}</button>;
}

function PlayIcon()     { return <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><polygon points="5 3 19 12 5 21"/></svg>; }
function PauseIcon()    { return <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>; }
function GoStartIcon()  { return <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="19 20 9 12 19 4"/><line x1="5" y1="19" x2="5" y2="5"/></svg>; }
function GoEndIcon()    { return <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="5 4 15 12 5 20"/><line x1="19" y1="4" x2="19" y2="20"/></svg>; }
function StepBackIcon() { return <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/><line x1="9" y1="18" x2="9" y2="6"/></svg>; }
function StepFwdIcon()  { return <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/><line x1="15" y1="18" x2="15" y2="6"/></svg>; }