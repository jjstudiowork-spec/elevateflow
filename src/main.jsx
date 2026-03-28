import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import SplashScreen from "./SplashScreen";
import CloseConfirmWindow from "./CloseConfirmWindow";
import AboutWindow from "./AboutWindow";
import MediaInspector from "./components/MediaInspector/MediaInspector";
import Settings from "./Settings";
import Account from "./Account";
import Timecode from "./Timecode";
import ConfigureScreens from "./ConfigureScreens";
import Graphics from "./Graphics";
import AudienceView from "./AudienceView";
import StageView from "./StageView";
import Production from "./Production";

// Apply saved theme before render — prevents flash
const _savedTheme = localStorage.getItem('ef_theme') || 'dark';
document.documentElement.setAttribute('data-theme', _savedTheme);

// Listen for theme changes from Settings window (cross-window via Tauri events)
import('@tauri-apps/api/event').then(({ listen }) => {
  listen('ef-theme-changed', (e) => {
    const id = e.payload?.theme;
    if (id) {
      localStorage.setItem('ef_theme', id);
      document.documentElement.setAttribute('data-theme', id);
    }
  });
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <HashRouter>
    <Routes>
      <Route path="/"                  element={<App />} />
      <Route path="/splash"            element={<SplashScreen />} />
      <Route path="/close-confirm"     element={<CloseConfirmWindow />} />
      <Route path="/about"             element={<AboutWindow />} />
      <Route path="/media-inspector"   element={<MediaInspector />} />
      <Route path="/settings"          element={<Settings />} />
      <Route path="/account"           element={<Account />} />
      <Route path="/timecode"          element={<Timecode />} />
      <Route path="/production"        element={<Production />} />
      <Route path="/configure-screens" element={<ConfigureScreens />} />
      <Route path="/graphics"          element={<Graphics />} />
      <Route path="/audience"          element={<AudienceView />} />
      <Route path="/stage"             element={<StageView />} />
    </Routes>
  </HashRouter>
);