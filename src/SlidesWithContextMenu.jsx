import React, { useState, useEffect } from "react";

const SlidesWithContextMenu = ({ 
  slides, 
  onUpdateSlides, 
  setSelectedSlideId, 
  selectedSlideId, 
  setLiveVideo, 
  onSlideDropMedia 
}) => {
  const [menu, setMenu] = useState(null);

  // Close menu on click elsewhere
  useEffect(() => {
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  const handleContextMenu = (e, id) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, slideId: id });
  };

  const updateGroup = (groupName, color) => {
    const newSlides = slides.map(s => 
      s.id === menu.slideId ? { ...s, group: groupName, color: color } : s
    );
    onUpdateSlides(newSlides);
    setMenu(null);
  };

  const deleteSlide = () => {
    onUpdateSlides(slides.filter(s => s.id !== menu.slideId));
    if (selectedSlideId === menu.slideId) setSelectedSlideId(null);
    setMenu(null);
  };

  return (
    <div 
      className="slides" 
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => onSlideDropMedia(e, null)}
      style={{ containerType: 'inline-size', display: 'flex', flexWrap: 'wrap', gap: '20px', padding: '24px', alignContent: 'flex-start', minHeight: '100%' }}
    >
      {slides.map((slide, i) => (
        <div key={slide.id} className={`slide-wrap ${slide.id === selectedSlideId ? "selected" : ""}`} 
             onClick={() => {
                setSelectedSlideId(slide.id);
                if (slide.video) setLiveVideo(slide.video);
             }}
             onContextMenu={(e) => handleContextMenu(e, slide.id)}
             onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
             onDrop={(e) => onSlideDropMedia(e, slide.id)}
             style={{
               width: '280px', position: 'relative', cursor: 'pointer', transition: 'transform 0.2s',
               transform: slide.id === selectedSlideId ? 'scale(1.02)' : 'scale(1)'
             }}>
          <div className="slide-thumb" style={{
            position: 'relative', width: '100%', aspectRatio: '16/9', background: '#000', borderRadius: '8px', overflow: 'hidden', 
            border: slide.id === selectedSlideId ? '2.5px solid #D4AF37' : '1px solid #333',
            boxShadow: slide.id === selectedSlideId ? '0 10px 20px rgba(0,0,0,0.5)' : 'none'
          }}>
            {slide.video && <video src={slide.video} style={{position:'absolute', width:'100%', height:'100%', objectFit:'cover', opacity: 0.5}} autoPlay muted loop />}
            <div style={{
              position: 'absolute', left: `${slide.x}%`, top: `${slide.y}%`, width: `${slide.width}%`, height: `${slide.height}%`,
              transform: 'translate(-50%, -50%)', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', whiteSpace: 'pre-wrap', 
              color: slide.textColor || 'white', fontWeight: slide.fontWeight || 800, fontSize: `${slide.fontSize || 5}cqw`, fontFamily: slide.fontFamily || 'inherit', textTransform: slide.transform || 'uppercase',
              fontStyle: slide.italic ? 'italic' : 'normal',
              textDecoration: `${slide.underline ? 'underline' : ''} ${slide.strikethrough ? 'line-through' : ''}`
            }}>{slide.text}</div>
            
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: '24px',
              background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)',
              display: 'flex', alignItems: 'center', padding: '0 8px', gap: '10px',
              borderTop: '1px solid rgba(255,255,255,0.1)'
            }}>
              <span style={{ color: '#aaa', fontSize: '11px', fontWeight: 700 }}>{i + 1}</span>
              <div style={{ height: '10px', width: '1px', background: 'rgba(255,255,255,0.2)' }}></div>
              <span style={{ 
                color: slide.color, fontSize: '10px', fontWeight: 800, letterSpacing: '0.5px', textTransform: 'uppercase' 
              }}>{slide.group}</span>
            </div>
          </div>
        </div>
      ))}

      {/* MATCHED ADD BUTTON */}
      <button className="add-slide-btn" onClick={() => {
        const newId = Date.now();
        onUpdateSlides([...slides, { id: newId, text: "NEW SLIDE", group: "Verse 1", color: "#3a86ff", x: 50, y: 50, width: 60, height: 30, video: null }]);
        setSelectedSlideId(newId);
      }} style={{ 
        width: '280px', height: '157.5px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px dashed #444', color: '#666', fontSize: '24px', cursor: 'pointer'
      }}>+</button>

      {/* CONTEXT MENU UI */}
      {menu && (
        <div style={{ 
          position: 'fixed', top: menu.y, left: menu.x, background: '#1a1a1a', border: '1px solid #333', 
          borderRadius: '4px', padding: '4px', zIndex: 10000, boxShadow: '0 10px 25px rgba(0,0,0,0.5)', minWidth: '140px'
        }}>
          <div style={{ color: '#555', fontSize: '9px', fontWeight: 800, padding: '8px', borderBottom: '1px solid #222' }}>SET GROUP</div>
          {[
            { n: 'Verse 1', c: '#3a86ff' },
            { n: 'Chorus', c: '#ff006e' },
            { n: 'Bridge', c: '#8338ec' }
          ].map(g => (
            <button key={g.n} onClick={() => updateGroup(g.n, g.c)} style={{
              display: 'block', width: '100%', padding: '8px', textAlign: 'left', background: 'none', border: 'none', color: '#ccc', fontSize: '11px', cursor: 'pointer'
            }} onMouseOver={e => e.target.style.background = '#333'} onMouseOut={e => e.target.style.background = 'none'}>
              {g.n}
            </button>
          ))}
          <div style={{ height: '1px', background: '#222', margin: '4px 0' }} />
          <button onClick={deleteSlide} style={{
            display: 'block', width: '100%', padding: '8px', textAlign: 'left', background: 'none', border: 'none', color: '#ff4d4d', fontSize: '11px', cursor: 'pointer'
          }} onMouseOver={e => e.target.style.background = '#333'} onMouseOut={e => e.target.style.background = 'none'}>
            Delete Slide
          </button>
        </div>
      )}
    </div>
  );
};

export default SlidesWithContextMenu;