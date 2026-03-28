import React, { useState } from "react";

// CONFIGURATION CONSTANTS
const ROW_HEIGHT = 90; // Height of each layer row in pixels
const LAYER_COUNT = 6;
const COLUMN_COUNT = 12;

export default function Graphics() {
  const [activeTab, setActiveTab] = useState("Clip");

  return (
    <div style={styles.appContainer}>
      {/* --- TOP MENU BAR --- */}
      <header style={styles.topBar}>
        <div style={styles.logoArea}>ARENA</div>
        <div style={styles.menuLinks}>
          <span style={styles.menuItem}>Composition</span>
          <span style={styles.menuItem}>Deck</span>
          <span style={styles.menuItem}>Layer</span>
          <span style={styles.menuItem}>Column</span>
          <span style={styles.menuItem}>Output</span>
          <span style={styles.menuItem}>Shortcuts</span>
          <span style={styles.menuItem}>View</span>
        </div>
        <div style={styles.sysInfo}>
          <span style={{ color: "#00ffcc" }}>FPS 60.0</span>
          <span>1920x1080</span>
        </div>
      </header>

      {/* --- MAIN WORKSPACE (SPLIT VIEW) --- */}
      <div style={styles.mainWorkspace}>
        
        {/* LEFT: LAYER CONTROLS */}
        <div style={styles.layerSidebar}>
          {/* Header for Layer Column */}
          <div style={styles.columnHeaderRow}>
            <div style={styles.headerLabel}>LAYERS</div>
          </div>

          {/* Layer Controls Loop */}
          <div style={styles.layerScrollContainer}>
            {Array.from({ length: LAYER_COUNT }).map((_, i) => {
              const layerNum = LAYER_COUNT - i;
              return (
                <div key={i} style={styles.layerControlBlock}>
                  {/* Top: Name & Blend Mode */}
                  <div style={styles.layerHeaderLine}>
                    <span style={styles.layerName}>Layer {layerNum}</span>
                    <span style={styles.blendMode}>Add</span>
                  </div>
                  
                  {/* Middle: Fader & Buttons */}
                  <div style={styles.layerTools}>
                    <div style={styles.bsvButtons}>
                      <div style={styles.tinyBtn}>B</div> {/* Blind */}
                      <div style={styles.tinyBtn}>S</div> {/* Solo */}
                      <div style={styles.tinyBtn}>X</div> {/* Eject */}
                    </div>
                    <div style={styles.opacitySliderTrack}>
                      <div style={{...styles.opacitySliderFill, width: `${50 + (i * 10)}%`}} />
                      <div style={{...styles.opacitySliderHandle, left: `${50 + (i * 10)}%`}} />
                    </div>
                  </div>

                  {/* Bottom: Transition Select */}
                  <div style={styles.layerFooterLine}>
                    <div style={styles.transitionIcon}>T</div>
                    <div style={styles.transitionBar} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT: CLIP MATRIX */}
        <div style={styles.matrixArea}>
          {/* Column Headers (Triggers) */}
          <div style={styles.columnHeaderRow}>
            {Array.from({ length: COLUMN_COUNT }).map((_, i) => (
              <div key={i} style={styles.columnTriggerBox}>
                <div style={styles.columnLabel}>Column {i + 1}</div>
              </div>
            ))}
          </div>

          {/* The Grid */}
          <div style={styles.gridScrollContainer}>
            {Array.from({ length: LAYER_COUNT }).map((_, rowIdx) => (
              <div key={rowIdx} style={styles.gridRow}>
                {Array.from({ length: COLUMN_COUNT }).map((_, colIdx) => (
                  <div key={colIdx} style={styles.clipSlot}>
                    {/* Visual styling for a populated clip vs empty */}
                    {(rowIdx + colIdx) % 3 === 0 ? (
                      <div style={styles.clipActive}>
                        <div style={styles.clipThumbPlaceholder} />
                        <div style={styles.clipNameBar}>
                          <span style={styles.clipNameText}>Loop_0{colIdx}.mov</span>
                        </div>
                      </div>
                    ) : (
                      <div style={styles.clipEmpty} />
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* --- BOTTOM DASHBOARD --- */}
      <footer style={styles.bottomDashboard}>
        
        {/* PREVIEW MONITOR (LEFT) */}
        <div style={styles.monitorPanel}>
          <div style={styles.panelTitleBar}>PREVIEW</div>
          <div style={styles.monitorScreen}>
            <div style={styles.monitorCrosshair}>NO SIGNAL</div>
          </div>
        </div>

        {/* CENTRAL TABS (PROPERTIES) */}
        <div style={styles.propertiesPanel}>
          <div style={styles.tabBar}>
            {["Composition", "Layer", "Clip"].map((tab) => (
              <div 
                key={tab} 
                style={activeTab === tab ? styles.tabActive : styles.tabInactive}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </div>
            ))}
          </div>
          
          <div style={styles.propertiesContent}>
             <div style={styles.propRow}>
               <label style={styles.propLabel}>Dashboard</label>
               <div style={styles.dialContainer}>
                 {[1,2,3,4].map(n => (
                   <div key={n} style={styles.dialWrapper}>
                     <div style={styles.dialCircle} />
                     <span style={styles.dialLabel}>Link {n}</span>
                   </div>
                 ))}
               </div>
             </div>
             <div style={styles.propRow}>
               <label style={styles.propLabel}>Transport</label>
               <div style={styles.transportBar}>
                  <button style={styles.btnAction}>&lt;</button>
                  <button style={styles.btnAction}>||</button>
                  <button style={styles.btnAction}>&gt;</button>
                  <div style={styles.timecode}>00:00:04:22</div>
               </div>
             </div>
          </div>
        </div>

        {/* OUTPUT MONITOR (RIGHT) */}
        <div style={styles.monitorPanel}>
          <div style={styles.panelTitleBar}>COMPOSITION OUTPUT</div>
          <div style={styles.monitorScreen}>
             <div style={styles.monitorLiveIndicator}>LIVE</div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// --- JSS STYLES ---

const styles = {
  appContainer: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    width: "100vw",
    backgroundColor: "#121212", // Very dark gray, almost black
    color: "#e0e0e0",
    fontFamily: "'Segoe UI', 'Roboto Condensed', sans-serif",
    fontSize: "11px",
    overflow: "hidden",
    userSelect: "none",
  },

  /* TOP BAR */
  topBar: {
    height: "30px",
    backgroundColor: "#1f1f1f",
    borderBottom: "1px solid #000",
    display: "flex",
    alignItems: "center",
    padding: "0 10px",
    gap: "20px",
  },
  logoArea: {
    fontWeight: "900",
    letterSpacing: "1px",
    color: "#fff",
  },
  menuLinks: {
    display: "flex",
    gap: "15px",
    flex: 1,
  },
  menuItem: {
    color: "#aaa",
    cursor: "pointer",
  },
  sysInfo: {
    display: "flex",
    gap: "15px",
    color: "#666",
    fontWeight: "600",
  },

  /* WORKSPACE */
  mainWorkspace: {
    flex: 1,
    display: "flex",
    backgroundColor: "#181818",
    overflow: "hidden", // Prevent full page scroll
  },

  /* LEFT SIDEBAR (LAYERS) */
  layerSidebar: {
    width: "240px",
    backgroundColor: "#1a1a1a",
    display: "flex",
    flexDirection: "column",
    borderRight: "2px solid #000",
    zIndex: 10,
  },
  layerScrollContainer: {
    overflowY: "hidden", // Syncs with grid usually, set to auto if independent
    flex: 1,
  },
  layerControlBlock: {
    height: `${ROW_HEIGHT}px`,
    borderBottom: "1px solid #333",
    padding: "6px 10px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    backgroundColor: "#1d1d1d",
  },
  layerHeaderLine: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "4px",
  },
  layerName: {
    fontWeight: "bold",
    color: "#ccc",
    fontSize: "12px",
  },
  blendMode: {
    color: "#666",
    fontSize: "10px",
    border: "1px solid #333",
    padding: "1px 4px",
    borderRadius: "2px",
  },
  layerTools: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flex: 1,
  },
  bsvButtons: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  tinyBtn: {
    width: "16px",
    height: "14px",
    fontSize: "9px",
    backgroundColor: "#2a2a2a",
    color: "#888",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid #444",
    cursor: "pointer",
  },
  opacitySliderTrack: {
    flex: 1,
    height: "6px",
    backgroundColor: "#000",
    borderRadius: "2px",
    position: "relative",
    border: "1px solid #333",
  },
  opacitySliderFill: {
    height: "100%",
    backgroundColor: "#48c2f9", // Resolume Blue/Cyan
    opacity: 0.6,
  },
  opacitySliderHandle: {
    position: "absolute",
    top: "-3px",
    width: "10px",
    height: "12px",
    backgroundColor: "#ccc",
    borderRadius: "2px",
    boxShadow: "0 1px 2px rgba(0,0,0,0.5)",
  },
  layerFooterLine: {
    marginTop: "4px",
    display: "flex",
    alignItems: "center",
    gap: "5px",
  },
  transitionIcon: {
    width: "16px",
    height: "16px",
    background: "#333",
    color: "#aaa",
    fontSize: "9px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  transitionBar: {
    flex: 1,
    height: "4px",
    background: "#222",
  },

  /* MATRIX / GRID */
  matrixArea: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflowX: "auto",
    backgroundColor: "#121212",
  },
  columnHeaderRow: {
    display: "flex",
    height: "24px",
    backgroundColor: "#1f1f1f",
    borderBottom: "1px solid #000",
  },
  columnTriggerBox: {
    minWidth: "120px",
    borderRight: "1px solid #333",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#252525",
    cursor: "pointer",
  },
  columnLabel: {
    color: "#888",
    fontWeight: "bold",
  },
  headerLabel: {
    padding: "0 10px",
    color: "#666",
    fontWeight: "bold",
    display: "flex",
    alignItems: "center",
    height: "100%",
  },
  
  gridScrollContainer: {
    overflowY: "auto",
    flex: 1,
  },
  gridRow: {
    display: "flex",
    height: `${ROW_HEIGHT}px`,
    borderBottom: "1px solid #000", // Darker border for rows
  },
  clipSlot: {
    minWidth: "120px",
    borderRight: "1px solid #2a2a2a",
    padding: "3px",
    position: "relative",
  },
  /* Clip States */
  clipEmpty: {
    width: "100%",
    height: "100%",
    border: "1px dashed #333",
    borderRadius: "3px",
    opacity: 0.5,
  },
  clipActive: {
    width: "100%",
    height: "100%",
    backgroundColor: "#2a2a2a",
    borderRadius: "3px",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    border: "1px solid #444",
    boxShadow: "inset 0 0 10px rgba(0,0,0,0.5)",
    cursor: "pointer",
  },
  clipThumbPlaceholder: {
    flex: 1,
    backgroundColor: "#000", // This would be the video thumb
    backgroundImage: "linear-gradient(45deg, #111 25%, transparent 25%, transparent 75%, #111 75%), linear-gradient(45deg, #111 25%, transparent 25%, transparent 75%, #111 75%)",
    backgroundSize: "10px 10px",
    backgroundPosition: "0 0, 5px 5px",
    opacity: 0.5,
  },
  clipNameBar: {
    height: "18px",
    backgroundColor: "rgba(0,0,0,0.8)",
    display: "flex",
    alignItems: "center",
    padding: "0 4px",
    borderTop: "1px solid #333",
  },
  clipNameText: {
    color: "#fff",
    fontSize: "10px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },

  /* BOTTOM DASHBOARD */
  bottomDashboard: {
    height: "280px",
    backgroundColor: "#222",
    borderTop: "2px solid #000",
    display: "flex",
  },
  monitorPanel: {
    width: "280px",
    display: "flex",
    flexDirection: "column",
    backgroundColor: "#181818",
    borderRight: "1px solid #000",
    borderLeft: "1px solid #000",
  },
  panelTitleBar: {
    padding: "4px 8px",
    backgroundColor: "#2a2a2a",
    color: "#aaa",
    fontSize: "10px",
    fontWeight: "bold",
    letterSpacing: "0.5px",
  },
  monitorScreen: {
    flex: 1,
    margin: "10px",
    backgroundColor: "#000",
    border: "1px solid #333",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  monitorCrosshair: {
    color: "#333",
    fontWeight: "bold",
    letterSpacing: "2px",
  },
  monitorLiveIndicator: {
    position: "absolute",
    top: "5px",
    right: "5px",
    color: "red",
    fontWeight: "bold",
    fontSize: "9px",
  },

  /* CENTER PROPERTIES */
  propertiesPanel: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    backgroundColor: "#1d1d1d",
  },
  tabBar: {
    display: "flex",
    backgroundColor: "#111",
    height: "26px",
  },
  tabActive: {
    padding: "0 20px",
    backgroundColor: "#1d1d1d",
    color: "#e0e0e0",
    borderTop: "2px solid #48c2f9", // Active cyan line
    display: "flex",
    alignItems: "center",
    fontWeight: "bold",
    cursor: "default",
  },
  tabInactive: {
    padding: "0 20px",
    backgroundColor: "#111",
    color: "#666",
    borderTop: "2px solid transparent",
    display: "flex",
    alignItems: "center",
    cursor: "pointer",
    borderRight: "1px solid #222",
  },
  propertiesContent: {
    padding: "15px",
    display: "flex",
    flexDirection: "column",
    gap: "15px",
  },
  propRow: {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
  },
  propLabel: {
    color: "#888",
    fontSize: "10px",
    textTransform: "uppercase",
  },
  dialContainer: {
    display: "flex",
    gap: "15px",
  },
  dialWrapper: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "5px",
  },
  dialCircle: {
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    border: "2px solid #444",
    borderTop: "2px solid #48c2f9",
    transform: "rotate(-45deg)",
    backgroundColor: "#111",
  },
  dialLabel: {
    color: "#aaa",
    fontSize: "9px",
  },
  transportBar: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    backgroundColor: "#111",
    padding: "8px",
    borderRadius: "4px",
    border: "1px solid #333",
    width: "fit-content",
  },
  btnAction: {
    background: "#333",
    border: "none",
    color: "#eee",
    width: "24px",
    height: "24px",
    borderRadius: "2px",
    cursor: "pointer",
  },
  timecode: {
    fontFamily: "monospace",
    fontSize: "14px",
    color: "#48c2f9",
    marginLeft: "10px",
  },
};