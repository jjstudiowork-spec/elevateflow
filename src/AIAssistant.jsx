/**
 * AIAssistant.jsx — ElevateFlow Custom AI Engine
 *
 * 100% local — zero third-party APIs, no network calls.
 * Built-in NLP: tokenisation, fuzzy matching, multi-intent parsing,
 * context memory, and a full lyric-to-slides formatter.
 *
 * Covers every feature in the app:
 *   · All useAppState dispatch actions
 *   · Output window management (launchOutputWindow / closeOutputWindow)
 *   · Rust backend commands via invoke()
 *   · Slide CRUD, styling, grouping
 *   · Timer / stage messages / sync
 *   · Media · audio · overlay routing
 *   · Canvas ratio · card size · fade · underscan
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { launchOutputWindow, closeOutputWindow } from './utils/outputManager';

const HISTORY_KEY = 'ef_ai_history';

// ─────────────────────────────────────────────────────────────────
// GROUP COLOUR MAP
// ─────────────────────────────────────────────────────────────────
const GROUP_COLORS = {
  'verse 1':    '#3a86ff', 'verse 2': '#4361ee', 'verse 3': '#3a0ca3',
  verse:        '#3a86ff', chorus:    '#ff006e', bridge:    '#8338ec',
  'pre-chorus': '#e63946', prechorus: '#e63946', intro:     '#06d6a0',
  outro:        '#fb5607', tag:       '#ffbe0b', hook:      '#ff006e',
  refrain:      '#ff006e', interlude: '#9b5de5', none:      '#333333',
};
function groupColor(name) {
  const k = (name || '').toLowerCase();
  for (const [key, c] of Object.entries(GROUP_COLORS)) if (k.includes(key)) return c;
  return '#333333';
}

// ─────────────────────────────────────────────────────────────────
// LYRIC PARSER  →  slide array
// ─────────────────────────────────────────────────────────────────
function parseLyricsToSlides(lyrics) {
  const sections = lyrics.split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
  return sections.map((section, i) => {
    const lines = section.split('\n');
    let group = 'None', color = '#333333', text = section;
    const firstLine = lines[0].trim();
    const labelRx = /^[\[({*#\s]*([\w\s'-]+?)[\])}*\s]*:?\s*$/i;
    const lm = firstLine.match(labelRx);
    if (lm && lm[1].length < 30 && lines.length > 1) {
      const raw = lm[1].trim();
      group = raw.charAt(0).toUpperCase() + raw.slice(1);
      color = groupColor(raw);
      text  = lines.slice(1).join('\n').trim();
    } else {
      for (const [key, c] of Object.entries(GROUP_COLORS)) {
        if (section.toLowerCase().startsWith(key)) {
          group = key.charAt(0).toUpperCase() + key.slice(1);
          color = c;
          break;
        }
      }
    }
    return {
      id: Date.now() + i + Math.random(),
      text, group, color,
      textColor: '#ffffff', fontFamily: 'Arial, sans-serif',
      fontSize: 5, fontWeight: 800, italic: false, underline: false,
      strikethrough: false, transform: 'uppercase', lineSpacing: 1.2,
      x: 50, y: 50, width: 60, height: 30, video: null,
    };
  });
}

// ─────────────────────────────────────────────────────────────────
// FUZZY MATCH
// ─────────────────────────────────────────────────────────────────
function fuzzyScore(query, target) {
  const q = query.toLowerCase(), t = target.toLowerCase();
  if (t.includes(q)) return 1;
  let score = 0, qi = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) { score++; qi++; }
  }
  return qi === q.length ? score / t.length : 0;
}
function bestMatch(query, items, key = 'title') {
  if (!query || !items?.length) return null;
  let best = null, bestScore = 0;
  for (const item of items) {
    const s = fuzzyScore(query, item[key] || '');
    if (s > bestScore) { bestScore = s; best = item; }
  }
  return bestScore > 0.25 ? best : null;
}

// ─────────────────────────────────────────────────────────────────
// PARSERS
// ─────────────────────────────────────────────────────────────────
function parseTime(str) {
  if (!str) return null;
  const s = str.trim().toLowerCase();
  let m = s.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?)/);
  if (m) return Math.round(parseFloat(m[1]) * 60);
  m = s.match(/(\d+(?:\.\d+)?)\s*(?:seconds?|secs?|s\b)/);
  if (m) return Math.round(parseFloat(m[1]));
  m = s.match(/^(\d+):(\d{2})$/);
  if (m) return parseInt(m[1]) * 60 + parseInt(m[2]);
  m = s.match(/^(\d+)$/);
  if (m) return parseInt(m[1]);
  if (s.includes('half') && s.includes('hour')) return 1800;
  if (s.includes('hour')) { const hm = s.match(/(\d+)/); if (hm) return parseInt(hm[1]) * 3600; }
  return null;
}
function parseVolume(str) {
  if (!str) return null;
  const s = str.trim().toLowerCase();
  if (/\b(full|max|100)\b/.test(s)) return 1;
  if (/\bhalf\b/.test(s)) return 0.5;
  if (/\b(mute|silent|0%|zero)\b/.test(s)) return 0;
  const m = s.match(/(\d+)\s*%?/);
  return m ? Math.min(1, parseInt(m[1]) / 100) : null;
}
function parseFontSize(str) {
  if (!str) return null;
  const s = str.toLowerCase();
  if (/\bsmall\b/.test(s)) return 3;
  if (/\b(medium|normal|default)\b/.test(s)) return 5;
  if (/\blarge\b/.test(s)) return 7;
  if (/\b(huge|very\s+large|big)\b/.test(s)) return 10;
  const m = s.match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}
const COLOR_NAMES = {
  white:'#ffffff',black:'#000000',red:'#ef4444',blue:'#3b82f6',green:'#22c55e',
  yellow:'#eab308',orange:'#f97316',purple:'#a855f7',pink:'#ec4899',cyan:'#06b6d4',
  gold:'#D4AF37',grey:'#6b7280',gray:'#6b7280',teal:'#14b8a6',lime:'#84cc16',indigo:'#6366f1',
};
function parseColor(str) {
  if (!str) return null;
  const s = str.trim().toLowerCase();
  if (COLOR_NAMES[s]) return COLOR_NAMES[s];
  const hex = str.match(/#[0-9a-fA-F]{3,6}/);
  return hex ? hex[0] : null;
}
const FONT_MAP = {
  arial:'Arial, sans-serif',helvetica:'Helvetica, sans-serif',georgia:'Georgia, serif',
  times:'Times New Roman, serif','times new roman':'Times New Roman, serif',
  courier:'Courier New, monospace',impact:'Impact, sans-serif',verdana:'Verdana, sans-serif',
  trebuchet:'Trebuchet MS, sans-serif',inter:'Inter, sans-serif',poppins:'Poppins, sans-serif',
  montserrat:'Montserrat, sans-serif',oswald:'Oswald, sans-serif',roboto:'Roboto, sans-serif',
  raleway:'Raleway, sans-serif',lato:'Lato, sans-serif','open sans':'Open Sans, sans-serif',
};
function parseFont(str) {
  if (!str) return null;
  const s = str.toLowerCase().trim();
  return FONT_MAP[s] || (str.length > 2 ? str : null);
}

// ─────────────────────────────────────────────────────────────────
// CORE NLP ENGINE
// ─────────────────────────────────────────────────────────────────
function parseIntent(raw, appState) {
  const t    = raw.trim();
  const text = t.toLowerCase();
  const res  = [];

  const has  = (...words) => words.every(w => text.includes(w));
  const any  = (...words) => words.some(w => text.includes(w));

  // ── EMERGENCY ────────────────────────────────────────────────
  if (any('blackout','emergency clear','kill screen') ||
     (any('clear','blank') && any('screen','output','everything','all outputs'))) {
    return [{ type: 'CLEAR_ALL_OUTPUT' }];
  }

  // ── MODE ─────────────────────────────────────────────────────
  if (any('show mode','go live mode','live mode','presentation mode') ||
     (any('switch','go to','enter','open') && any('show mode','live mode'))) {
    res.push({ type: 'SET_MODE', payload: 'show' });
  }
  if (text === 'edit' || any('edit mode','editing mode','go to edit','enter edit','switch to edit','open edit')) {
    res.push({ type: 'SET_MODE', payload: 'edit' });
  }
  if (any('stage mode','confidence monitor mode') ||
     (any('switch','go to','enter') && text.includes('stage mode'))) {
    res.push({ type: 'SET_MODE', payload: 'stage' });
  }
  if (any('graphics mode','vj mode','resolume mode')) res.push({ type: 'SET_MODE', payload: 'graphics' });
  if (any('theme editor','theme mode','typography editor'))   res.push({ type: 'SET_MODE', payload: 'theme-editor' });

  // ── OUTPUTS ───────────────────────────────────────────────────
  if (any('open audience','launch audience','audience output','main output','main screen','projector output','audience window','start audience','show audience output')) {
    res.push({ type: 'LAUNCH_OUTPUT', role: 'audience' });
  }
  if (any('close audience','stop audience','hide audience','kill audience')) {
    res.push({ type: 'CLOSE_OUTPUT', role: 'audience' });
  }
  if (any('open stage','launch stage','stage output','confidence monitor','foldback output','stage window','start stage','show stage output')) {
    res.push({ type: 'LAUNCH_OUTPUT', role: 'stage' });
  }
  if (any('close stage','stop stage','hide stage','kill stage')) {
    res.push({ type: 'CLOSE_OUTPUT', role: 'stage' });
  }
  if (any('configure screen','screen setup','configure display','setup screens','screen configuration','assign screen','display setup')) {
    res.push({ type: 'RUST_WIN', action: 'configure_screens' });
  }

  // ── RUST WINDOWS ─────────────────────────────────────────────
  if (any('open settings','show settings','settings window','preferences window')) {
    res.push({ type: 'RUST_WIN', action: 'view_settings' });
  }
  if (any('open timecode','timecode window','ltc window','smpte window','open clock')) {
    res.push({ type: 'RUST_WIN', action: 'view_timecode' });
  }
  if (any('open about','about window','about elevateflow','version info')) {
    res.push({ type: 'RUST_WIN', action: 'view_about' });
  }

  // ── SLIDE NAVIGATION ──────────────────────────────────────────
  if (any('next slide','advance slide','go forward','forward slide','go to next')) {
    res.push({ type: 'NEXT_SLIDE' });
  }
  if (any('previous slide','prev slide','go back','back a slide','last slide','go to previous')) {
    res.push({ type: 'PREV_SLIDE' });
  }
  if (any('send to audience','push to screen','send live','go live slide') && !any('output')) {
    res.push({ type: 'SEND_TO_AUDIENCE' });
  }
  if (/\bfirst slide\b|\bslide 1\b|\bslide one\b/.test(text)) {
    res.push({ type: 'SELECT_SLIDE_BY_INDEX', index: 0 });
  }
  const slideN = text.match(/\bslide\s+(\d+)\b/);
  if (slideN && parseInt(slideN[1]) > 1) {
    res.push({ type: 'SELECT_SLIDE_BY_INDEX', index: parseInt(slideN[1]) - 1 });
  }

  // ── SLIDE CRUD ────────────────────────────────────────────────
  if ((any('add','create','new','insert') && any('slide','blank slide')) || text === 'add slide') {
    res.push({ type: 'SLIDE_ADD', overrides: {} });
  }
  if ((any('delete','remove','trash') && text.includes('slide')) || text === 'delete slide') {
    res.push({ type: 'SLIDE_DELETE' });
  }
  if ((any('duplicate','clone') && text.includes('slide')) || text === 'duplicate slide') {
    res.push({ type: 'SLIDE_DUPLICATE' });
  }
  if (has('copy','slide') && !any('copy style','copy format')) res.push({ type: 'SLIDE_COPY' });
  if (has('cut','slide'))   res.push({ type: 'SLIDE_CUT' });
  if (any('paste slide') || text === 'paste') res.push({ type: 'SLIDE_PASTE' });
  if (any('deselect','unselect') && text.includes('slide')) res.push({ type: 'SLIDE_DESELECT' });

  // ── SLIDE TEXT ────────────────────────────────────────────────
  const changeText = t.match(/(?:set|change|update)\s+(?:slide\s+)?text\s+to\s+["']?(.+?)["']?\s*$/i);
  if (changeText) res.push({ type: 'SLIDE_TEXT', text: changeText[1] });

  // ── SLIDE STYLE — FONT ────────────────────────────────────────
  const fontFamilyMatch = t.match(/(?:set|change|use)\s+font\s+(?:to\s+|family\s+(?:to\s+)?)?["']?([A-Za-z\s]+?)["']?\s*$/i)
    || t.match(/font\s+["']?([A-Za-z\s]{3,30})["']?/i);
  if (fontFamilyMatch) {
    const fam = parseFont(fontFamilyMatch[1]);
    if (fam) res.push({ type: 'SLIDE_STYLE', key: 'fontFamily', value: fam });
  }
  const fontSizeMatch = t.match(/(?:font\s*size|text\s*size|size)\s+(?:to\s+)?(\w+)/i);
  if (fontSizeMatch) {
    const fs = parseFontSize(fontSizeMatch[1]);
    if (fs) res.push({ type: 'SLIDE_STYLE', key: 'fontSize', value: fs });
  }
  if (any('bold','make bold'))                  res.push({ type: 'SLIDE_STYLE', key: 'fontWeight',    value: 800 });
  if (any('unbold','not bold','regular weight')) res.push({ type: 'SLIDE_STYLE', key: 'fontWeight',    value: 400 });
  if (any('italic','italicise','make italic'))  res.push({ type: 'SLIDE_STYLE', key: 'italic',         value: true });
  if (any('remove italic','no italic'))         res.push({ type: 'SLIDE_STYLE', key: 'italic',         value: false });
  if (any('underline') && !any('remove underline','no underline')) res.push({ type: 'SLIDE_STYLE', key: 'underline', value: true });
  if (any('remove underline','no underline'))   res.push({ type: 'SLIDE_STYLE', key: 'underline',      value: false });
  if (any('strikethrough','strike through'))    res.push({ type: 'SLIDE_STYLE', key: 'strikethrough',  value: true });
  if (any('remove strike','no strikethrough'))  res.push({ type: 'SLIDE_STYLE', key: 'strikethrough',  value: false });
  if (any('uppercase','all caps'))              res.push({ type: 'SLIDE_STYLE', key: 'transform',      value: 'uppercase' });
  if (any('lowercase','all lower'))             res.push({ type: 'SLIDE_STYLE', key: 'transform',      value: 'lowercase' });
  if (any('capitalize','title case'))           res.push({ type: 'SLIDE_STYLE', key: 'transform',      value: 'capitalize' });
  if (any('no transform','normal case','remove transform')) res.push({ type: 'SLIDE_STYLE', key: 'transform', value: 'none' });

  const textColMatch = t.match(/(?:text|font)\s*colou?r\s+(?:to\s+)?(.+)/i)
    || t.match(/colou?r\s+(?:the\s+)?text\s+(.+)/i);
  if (textColMatch) {
    const c = parseColor(textColMatch[1]);
    if (c) res.push({ type: 'SLIDE_STYLE', key: 'textColor', value: c });
  }
  const lsMatch = t.match(/line\s*(?:height|spacing)\s+(?:to\s+)?(\d+(?:\.\d+)?)/i);
  if (lsMatch) res.push({ type: 'SLIDE_STYLE', key: 'lineSpacing', value: parseFloat(lsMatch[1]) });

  // ── SLIDE GROUP ───────────────────────────────────────────────
  for (const [key] of Object.entries(GROUP_COLORS)) {
    if (key === 'none') continue;
    if (new RegExp(`(?:set|mark|label|group)\\s+(?:as|to)?\\s*${key.replace('-','\\s*')}|make\\s+(?:this\\s+)?(?:a\\s+)?${key.replace('-','\\s*')}`, 'i').test(text)) {
      const gName = key.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      res.push({ type: 'SLIDE_GROUP', slideId: null, groupName: gName, color: groupColor(key) });
    }
  }

  // ── APPLY THEME TO ALL ────────────────────────────────────────
  if (any('apply theme','apply to all','theme all slides','style all slides')) {
    const payload = {};
    if (fontFamilyMatch) { const ff = parseFont(fontFamilyMatch[1]); if (ff) payload.fontFamily = ff; }
    if (fontSizeMatch)   { const fs = parseFontSize(fontSizeMatch[1]); if (fs) payload.fontSize = fs; }
    if (Object.keys(payload).length) res.push({ type: 'APPLY_THEME_TO_ALL', payload });
  }

  // ── COPY / PASTE STYLE ────────────────────────────────────────
  if (any('copy style','copy format','copy formatting'))  res.push({ type: 'COPY_STYLE' });
  if (any('paste style','paste format','apply format'))   res.push({ type: 'PASTE_STYLE' });

  // ── OPEN SONG ─────────────────────────────────────────────────
  const openSong = t.match(/(?:open|load|switch to|go to|activate|select)\s+(?:song\s+)?["']?(.+?)["']?\s*$/i);
  if (openSong && !any('mode','output','window','settings','timecode','edit mode','show mode','stage mode')) {
    const found = bestMatch(openSong[1], appState.librarySongs || []);
    if (found) res.push({ type: 'SET_ACTIVE_ITEM', payload: found.id });
  }

  // ── CREATE SONG ───────────────────────────────────────────────
  const createSong = t.match(/(?:create|make|add|new)\s+(?:a\s+)?song\s+(?:called|named|titled)?\s*["']?(.+?)["']?\s*$/i);
  if (createSong && !any('library','playlist')) {
    res.push({ type: 'CREATE_SONG_PROMPT', title: createSong[1].trim() });
  }

  // ── DELETE SONG ───────────────────────────────────────────────
  const delSong = t.match(/(?:delete|remove|trash)\s+(?:song\s+)["']?(.+?)["']?\s*$/i);
  if (delSong) {
    const found = bestMatch(delSong[1], appState.librarySongs || []);
    if (found) res.push({ type: 'DELETE_SONG', payload: found.id });
  }

  // ── RENAME SONG ───────────────────────────────────────────────
  const renameSong = t.match(/rename\s+(?:song\s+)?["']?(.+?)["']?\s+to\s+["']?(.+?)["']?\s*$/i);
  if (renameSong) {
    const found = bestMatch(renameSong[1], appState.librarySongs || []);
    if (found) res.push({ type: 'UPDATE_SONG', payload: { id: found.id, title: renameSong[2] } });
  }

  // ── LIBRARY MANAGEMENT ───────────────────────────────────────
  const createLib = t.match(/(?:create|add|new)\s+(?:a\s+)?library\s+(?:called|named)?\s*["']?(.+?)["']?\s*$/i);
  if (createLib) res.push({ type: 'ADD_LIBRARY', payload: { id: `lib_${Date.now()}`, title: createLib[1].trim() } });

  const deleteLib = t.match(/(?:delete|remove)\s+(?:the\s+)?library\s+["']?(.+?)["']?\s*$/i);
  if (deleteLib) {
    const found = bestMatch(deleteLib[1], appState.libraries || []);
    if (found) res.push({ type: 'DELETE_LIBRARY', payload: found.id });
  }

  // ── PLAYLIST MANAGEMENT ──────────────────────────────────────
  const createPl = t.match(/(?:create|add|new)\s+(?:a\s+)?playlist\s+(?:called|named)?\s*["']?(.+?)["']?\s*$/i);
  if (createPl) res.push({ type: 'ADD_PLAYLIST', payload: { id: `pl_${Date.now()}`, title: createPl[1].trim(), songIds: [] } });

  const deletePl = t.match(/(?:delete|remove)\s+(?:the\s+)?playlist\s+["']?(.+?)["']?\s*$/i);
  if (deletePl) {
    const found = bestMatch(deletePl[1], appState.playlists || [], 'title');
    if (found) res.push({ type: 'DELETE_PLAYLIST', payload: found.id });
  }

  // ── MEDIA ─────────────────────────────────────────────────────
  if (any('clear video','remove video','stop video','no video','kill video')) res.push({ type: 'SET_LIVE_VIDEO', payload: null });
  if (any('clear overlay','remove overlay','stop overlay','no overlay','kill overlay')) res.push({ type: 'SET_ACTIVE_OVERLAY', payload: null });

  const setVideoMatch = t.match(/(?:set|use|play|load)\s+["']?(.+?)["']?\s+as\s+(?:background|video|bg)/i);
  if (setVideoMatch) {
    const found = (appState.mediaFiles || []).find(f =>
      f.type === 'video' && f.name.toLowerCase().includes(setVideoMatch[1].toLowerCase())
    );
    if (found) res.push({ type: 'SET_LIVE_VIDEO', payload: found.src });
  }

  // ── AUDIO ─────────────────────────────────────────────────────
  if (any('stop audio','pause audio','mute audio','stop music','pause music','stop sound','kill audio','end audio')) {
    res.push({ type: 'SET_ACTIVE_AUDIO_URL', payload: null });
  }

  const setAudioMatch = t.match(/(?:play|start|load)\s+(?:audio\s+|track\s+|sound\s+)?["']?(.+?)["']?\s*$/i);
  if (setAudioMatch && any('play track','play audio','play sound','load audio','start audio')) {
    const found = (appState.audioFiles || []).find(f =>
      f.name.toLowerCase().includes(setAudioMatch[1].toLowerCase())
    );
    if (found) res.push({ type: 'SET_ACTIVE_AUDIO_URL', payload: found.src });
  }

  // ── VOLUME ────────────────────────────────────────────────────
  const volMatch = t.match(/(?:set|change|make|adjust|turn)\s+(?:the\s+)?volume\s+(?:to\s+|up\s+to\s+)?(.+)/i)
    || t.match(/volume\s+(?:to\s+|at\s+|=\s*)?(.+)/i);
  if (volMatch) {
    const v = parseVolume(volMatch[1]);
    if (v !== null) res.push({ type: 'SET_VOLUME', payload: v });
  }
  if (any('mute','volume off') && !any('audio url')) res.push({ type: 'SET_VOLUME', payload: 0 });
  if (any('unmute','volume on','restore volume'))     res.push({ type: 'SET_VOLUME', payload: 1 });

  // ── FADE ──────────────────────────────────────────────────────
  const fadeMatch = t.match(/(?:set|change)\s+fade\s+(?:duration\s+)?(?:to\s+)?(.+)/i)
    || t.match(/fade\s+(?:time|duration|speed)\s+(?:to\s+)?(.+)/i);
  if (fadeMatch) {
    const secs = parseTime(fadeMatch[1]);
    if (secs !== null) res.push({ type: 'SET_FADE_DURATION', payload: Math.min(5, secs) });
  }

  // ── TIMER ─────────────────────────────────────────────────────
  const timerSet = t.match(/(?:set\s+timer\s+(?:to|for)|timer\s+to|start\s+timer\s+(?:at|for)?)\s+(.+)/i);
  if (timerSet) { const s = parseTime(timerSet[1]); if (s !== null) res.push({ type: 'SET_TIMER_INITIAL', payload: s }); }

  if (any('start timer','begin timer','run timer','play timer','resume timer','unpause timer')) {
    res.push({ type: 'SET_TIMER_RUNNING', payload: true });
  }
  if (any('stop timer','pause timer','halt timer','freeze timer')) {
    res.push({ type: 'SET_TIMER_RUNNING', payload: false });
  }
  if (any('reset timer','restart timer','clear timer')) res.push({ type: 'RESET_TIMER' });

  // ── STAGE MESSAGE ─────────────────────────────────────────────
  const stageMsg = t.match(/(?:set|send|show|display|change)\s+(?:stage\s+)?message\s+(?:to\s+)?["']?(.+?)["']?\s*$/i);
  if (stageMsg) res.push({ type: 'SET_STAGE_MESSAGE', payload: stageMsg[1] });
  if (any('clear stage message','remove stage message','hide stage message','no stage message')) {
    res.push({ type: 'SET_STAGE_MESSAGE', payload: '' });
  }

  // ── SYNC ──────────────────────────────────────────────────────
  if (any('start hosting','host session','start sync','begin sync','host a sync','go live sync')) {
    res.push({ type: 'START_HOSTING' });
  }
  if (any('end session','stop hosting','end sync','stop sync','leave session','disconnect sync')) {
    res.push({ type: 'END_SESSION' });
  }
  if (any('toggle sync','sync panel','show sync panel','open sync panel')) res.push({ type: 'TOGGLE_SYNC_PANEL' });

  // ── TIMELINE ─────────────────────────────────────────────────
  if (any('toggle timeline','show timeline','open timeline','hide timeline')) res.push({ type: 'TOGGLE_TIMELINE' });
  if (any('play timeline','start timeline'))  res.push({ type: 'SET_TIMELINE_PLAYING', payload: true });
  if (any('stop timeline','pause timeline'))  res.push({ type: 'SET_TIMELINE_PLAYING', payload: false });
  if (any('loop timeline','enable loop'))     res.push({ type: 'SET_TIMELINE_LOOP',    payload: true });

  // ── CANVAS RATIO ─────────────────────────────────────────────
  if (any('16:9','16 9','widescreen') && any('canvas','ratio','aspect')) res.push({ type: 'SET_CANVAS_RATIO', payload: '16 / 9' });
  if (any('4:3','4 3') && any('canvas','ratio','aspect'))               res.push({ type: 'SET_CANVAS_RATIO', payload: '4 / 3' });
  if (any('1:1','square') && any('canvas','ratio','aspect'))            res.push({ type: 'SET_CANVAS_RATIO', payload: '1 / 1' });
  if (any('9:16','portrait') && any('canvas','ratio','aspect'))         res.push({ type: 'SET_CANVAS_RATIO', payload: '9 / 16' });

  // ── CARD SIZE ─────────────────────────────────────────────────
  const cardMatch = t.match(/(?:card|slide\s*card|thumbnail)\s+size\s+(?:to\s+)?(\d+)/i);
  if (cardMatch) res.push({ type: 'SET_SLIDE_CARD_SIZE', payload: Math.max(100, Math.min(400, parseInt(cardMatch[1]))) });
  if (any('smaller cards','small cards','small thumbnails'))   res.push({ type: 'SET_SLIDE_CARD_SIZE', payload: 120 });
  if (any('medium cards','medium thumbnails'))                 res.push({ type: 'SET_SLIDE_CARD_SIZE', payload: 180 });
  if (any('bigger cards','large cards','larger cards','big thumbnails')) res.push({ type: 'SET_SLIDE_CARD_SIZE', payload: 280 });

  // ── UNDERSCAN ─────────────────────────────────────────────────
  const underscanMatch = t.match(/underscan\s+(?:to\s+)?(\d+(?:\.\d+)?)/i);
  if (underscanMatch) res.push({ type: 'SET_UNDERSCAN_SCALE', payload: parseFloat(underscanMatch[1]) });

  // ── MEDIA BIN TABS ────────────────────────────────────────────
  if (any('background bin','backgrounds tab','show backgrounds','open backgrounds')) res.push({ type: 'SET_MEDIA_BIN_TAB', payload: 'backgrounds' });
  if (any('overlay bin','overlays tab','show overlays','open overlays'))             res.push({ type: 'SET_MEDIA_BIN_TAB', payload: 'overlays' });
  if (any('audio bin','audio tab','show audio bin','open audio bin'))                res.push({ type: 'SET_MEDIA_BIN_TAB', payload: 'audio' });

  // ── SEARCH ────────────────────────────────────────────────────
  const searchMatch = t.match(/(?:search|find|look\s+for)\s+(?:song\s+)?["']?(.+?)["']?\s*$/i);
  if (searchMatch && any('search','find','look for')) res.push({ type: 'SEARCH', query: searchMatch[1] });

  // ── ARRANGEMENTS ─────────────────────────────────────────────
  if (any('toggle arrangements','show arrangements','open arrangements')) res.push({ type: 'TOGGLE_ARRANGEMENTS' });

  // ── STAGE LAYOUT ─────────────────────────────────────────────
  const stageLayoutMatch = t.match(/(?:switch|use|activate|load|select)\s+(?:stage\s+)?layout\s+["']?(.+?)["']?\s*$/i);
  if (stageLayoutMatch) {
    const found = (appState.stageLayouts || []).find(l =>
      l.name.toLowerCase().includes(stageLayoutMatch[1].toLowerCase())
    );
    if (found) res.push({ type: 'SET_ACTIVE_STAGE_LAYOUT', payload: found.id });
  }

  // ── QUERIES ───────────────────────────────────────────────────
  if (any('what mode','current mode','which mode','am i in')) res.push({ type: 'QUERY_MODE' });
  if (any('how many songs','list songs','show all songs','all songs','show songs','song count')) res.push({ type: 'QUERY_SONGS' });
  if (any('how many slides','slide count','count slides')) res.push({ type: 'QUERY_SLIDES' });
  if (any('timer status','timer time',"what's the timer",'timer count') && text.includes('timer')) res.push({ type: 'QUERY_TIMER' });
  if (any('sync status','are we synced','is sync on','session code','sync code')) res.push({ type: 'QUERY_SYNC' });
  if (any("what's playing",'what is playing','current video','current audio','is anything playing')) res.push({ type: 'QUERY_MEDIA' });
  if (any('help','what can you do','list commands','what commands','show commands','what do you know')) res.push({ type: 'HELP' });

  return res;
}

// ─────────────────────────────────────────────────────────────────
// REPLY BUILDER
// ─────────────────────────────────────────────────────────────────
function buildReply(actions, appState, rawInput) {
  if (!actions.length) {
    const t = rawInput.toLowerCase();
    if (/^(hey|hi|hello|yo|sup)\b/.test(t))               return `Hey! I'm the ElevateFlow AI. Try "open audience output", "add a slide", "set timer to 5 minutes", or type "help".`;
    if (/^(thanks?|thank you|cheers|nice one|great)\b/.test(t)) return `Anytime! What else do you need?`;
    return `I didn't understand that. Try rephrasing, or type "help" to see everything I can do.`;
  }
  const replies = [];
  for (const a of actions) {
    switch (a.type) {
      case 'CLEAR_ALL_OUTPUT':        replies.push('⚠ Emergency clear — all outputs are now blank.'); break;
      case 'SET_MODE':                replies.push(`Switched to ${a.payload.replace('-',' ')} mode.`); break;
      case 'LAUNCH_OUTPUT':           replies.push(`Launching ${a.role} output window…`); break;
      case 'CLOSE_OUTPUT':            replies.push(`${a.role.charAt(0).toUpperCase()+a.role.slice(1)} output closed.`); break;
      case 'RUST_WIN':                replies.push(`Opening ${a.action.replace(/_/g,' ')} window.`); break;
      case 'NEXT_SLIDE':              replies.push('Advanced to the next slide.'); break;
      case 'PREV_SLIDE':              replies.push('Went back to the previous slide.'); break;
      case 'SELECT_SLIDE_BY_INDEX':   replies.push(`Selected slide ${a.index + 1}.`); break;
      case 'SEND_TO_AUDIENCE':        replies.push('Current slide pushed live to audience output.'); break;
      case 'SLIDE_ADD':               replies.push('New blank slide added.'); break;
      case 'SLIDE_DELETE':            replies.push('Slide deleted.'); break;
      case 'SLIDE_DUPLICATE':         replies.push('Slide duplicated.'); break;
      case 'SLIDE_COPY':              replies.push('Slide copied.'); break;
      case 'SLIDE_CUT':               replies.push('Slide cut.'); break;
      case 'SLIDE_PASTE':             replies.push('Slide pasted.'); break;
      case 'SLIDE_DESELECT':          replies.push('Slide deselected.'); break;
      case 'SLIDE_TEXT':              replies.push(`Slide text updated.`); break;
      case 'SLIDE_STYLE':             replies.push(`Slide ${a.key} set to ${a.value}.`); break;
      case 'SLIDE_STYLES':            replies.push('Slide styles updated.'); break;
      case 'SLIDE_GROUP':             replies.push(`Slide grouped as ${a.groupName}.`); break;
      case 'APPLY_THEME_TO_ALL':      replies.push('Theme applied to all slides.'); break;
      case 'COPY_STYLE':              replies.push('Style copied — say "paste style" to apply it elsewhere.'); break;
      case 'PASTE_STYLE':             replies.push('Style pasted onto current slide.'); break;
      case 'CREATE_SONG_PROMPT':      replies.push(`Ready to create "${a.title}". Paste the raw lyrics now — I'll auto-format them into slides with groups.`); break;
      case 'ADD_SONG':                replies.push(`Song "${a.payload?.title}" added.`); break;
      case 'DELETE_SONG':             replies.push('Song deleted from library.'); break;
      case 'UPDATE_SONG':             replies.push('Song renamed.'); break;
      case 'SET_ACTIVE_ITEM': {
        const song = (appState.librarySongs||[]).find(s => s.id === a.payload);
        replies.push(song ? `Opened "${song.title}".` : 'Song activated.'); break;
      }
      case 'ADD_LIBRARY':             replies.push(`Library "${a.payload.title}" created.`); break;
      case 'DELETE_LIBRARY':          replies.push('Library deleted.'); break;
      case 'ADD_PLAYLIST':            replies.push(`Playlist "${a.payload.title}" created.`); break;
      case 'DELETE_PLAYLIST':         replies.push('Playlist deleted.'); break;
      case 'ADD_SONG_TO_PLAYLIST':    replies.push('Song added to playlist.'); break;
      case 'REMOVE_SONG_FROM_PLAYLIST': replies.push('Song removed from playlist.'); break;
      case 'MOVE_SONG_TO_LIB':        replies.push('Song moved to library.'); break;
      case 'SET_LIVE_VIDEO':          replies.push(a.payload ? 'Background video set.' : 'Background video cleared.'); break;
      case 'SET_ACTIVE_AUDIO_URL':    replies.push(a.payload ? 'Audio track set.' : 'Audio stopped.'); break;
      case 'SET_ACTIVE_OVERLAY':      replies.push(a.payload ? 'Overlay set.' : 'Overlay cleared.'); break;
      case 'SET_VOLUME':              replies.push(`Volume set to ${Math.round(a.payload * 100)}%.`); break;
      case 'SET_FADE_DURATION':       replies.push(`Fade duration set to ${a.payload}s.`); break;
      case 'SET_TIMER_INITIAL':       replies.push(`Timer set to ${Math.floor(a.payload/60)}m ${a.payload%60}s.`); break;
      case 'SET_TIMER_RUNNING':       replies.push(a.payload ? 'Timer started.' : 'Timer paused.'); break;
      case 'RESET_TIMER':             replies.push('Timer reset.'); break;
      case 'SET_STAGE_MESSAGE':       replies.push(a.payload ? `Stage message: "${a.payload}"` : 'Stage message cleared.'); break;
      case 'START_HOSTING':           replies.push('Starting a sync host session…'); break;
      case 'END_SESSION':             replies.push('Sync session ended.'); break;
      case 'TOGGLE_SYNC_PANEL':       replies.push('Sync panel toggled.'); break;
      case 'TOGGLE_TIMELINE':         replies.push('Timeline toggled.'); break;
      case 'SET_TIMELINE_PLAYING':    replies.push(a.payload ? 'Timeline playing.' : 'Timeline stopped.'); break;
      case 'SET_CANVAS_RATIO':        replies.push(`Canvas ratio set to ${a.payload.replace(' / ',':')}.`); break;
      case 'SET_SLIDE_CARD_SIZE':     replies.push(`Slide card size set to ${a.payload}px.`); break;
      case 'SET_UNDERSCAN_SCALE':     replies.push(`Underscan set to ${a.payload}.`); break;
      case 'SET_MEDIA_BIN_TAB':       replies.push(`Media bin showing ${a.payload}.`); break;
      case 'SET_ACTIVE_STAGE_LAYOUT': replies.push('Stage layout activated.'); break;
      case 'SEARCH': {
        const found = (appState.librarySongs||[]).filter(s =>
          s.title.toLowerCase().includes(a.query.toLowerCase())
        );
        replies.push(found.length
          ? `Found ${found.length} song${found.length>1?'s':''}: ${found.map(f=>`"${f.title}"`).join(', ')}.`
          : `No songs found matching "${a.query}".`
        ); break;
      }
      case 'QUERY_MODE':    replies.push(`You're in ${appState.mode} mode.`); break;
      case 'QUERY_SONGS': {
        const songs = appState.librarySongs || [];
        if (!songs.length) { replies.push('No songs in your library yet.'); break; }
        const preview = songs.slice(0,8).map(s => `"${s.title}"`).join(', ');
        replies.push(`${songs.length} song${songs.length>1?'s':''} in library: ${preview}${songs.length>8?` and ${songs.length-8} more`:''}.`);
        break;
      }
      case 'QUERY_SLIDES': {
        const song = (appState.librarySongs||[]).find(s => s.id === appState.activeItemId);
        replies.push(song ? `"${song.title}" has ${song.slides?.length||0} slides.` : 'No song is currently open.'); break;
      }
      case 'QUERY_TIMER': {
        const m = Math.floor(appState.timerSeconds/60), s = appState.timerSeconds%60;
        replies.push(`Timer: ${m}:${String(s).padStart(2,'0')} — ${appState.timerRunning?'running':'paused'}.`); break;
      }
      case 'QUERY_SYNC':  replies.push(appState.isSynced ? `Sync active. Session code: ${appState.sessionCode}` : 'Not currently synced.'); break;
      case 'QUERY_MEDIA': {
        const parts = [
          appState.liveVideo     && 'video playing',
          appState.activeAudioUrl && 'audio playing',
          appState.activeOverlay  && 'overlay active',
        ].filter(Boolean);
        replies.push(parts.length ? parts.join(', ') + '.' : 'Nothing is playing right now.'); break;
      }
      case 'HELP':
        replies.push(
          `Here's everything I can do:\n\n` +
          `🖥  OUTPUTS\nopen/close audience output · open/close stage output · blackout / clear screen\n\n` +
          `📑  SLIDES\nadd / delete / duplicate / copy / paste slide · next/prev slide · slide 3\nset font, size, colour · bold / italic / uppercase · set group to chorus\n\n` +
          `🎵  SONGS\ncreate a song called [title] · open song [title] · delete song [title]\nsearch for [title] · create a library · create a playlist\n\n` +
          `🎛  MEDIA\nstop audio · clear video · clear overlay · set volume to 70%\nfade duration to 1 second\n\n` +
          `⏱  STAGE\nset stage message to "Welcome" · start/stop/reset timer\nset timer to 10 minutes\n\n` +
          `⚙  APP\nswitch to edit mode · show mode · stage mode · graphics mode\nopen settings · open timecode · toggle timeline · 16:9 canvas\nstart hosting sync · end session`
        );
        break;
      default: break;
    }
  }
  return replies.filter(Boolean).join('\n') || 'Done.';
}

// ─────────────────────────────────────────────────────────────────
// QUICK CHIPS
// ─────────────────────────────────────────────────────────────────
const CHIPS = [
  { label: '⬛ Blackout',       cmd: 'clear the screen' },
  { label: '📺 Audience Out',  cmd: 'open audience output' },
  { label: '🖥 Stage Out',     cmd: 'open stage output' },
  { label: '▶ Show Mode',      cmd: 'switch to show mode' },
  { label: '✏️ Edit Mode',     cmd: 'switch to edit mode' },
  { label: '⏹ Stop Audio',    cmd: 'stop audio' },
  { label: '⏱ Start Timer',   cmd: 'start timer' },
  { label: '⏹ Stop Timer',    cmd: 'stop timer' },
  { label: '🔄 Reset Timer',   cmd: 'reset timer' },
  { label: '➕ Add Slide',     cmd: 'add a new slide' },
  { label: '→ Next Slide',     cmd: 'next slide' },
  { label: '← Prev Slide',     cmd: 'previous slide' },
  { label: '🔍 List Songs',    cmd: 'show all songs' },
  { label: '📡 Start Sync',    cmd: 'start hosting sync' },
  { label: '❓ Help',           cmd: 'help' },
];

// ─────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────
export default function AIAssistant({ state, dispatch, slidesActions, onClose }) {
  const [messages,    setMessages]    = useState([]);
  const [input,       setInput]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [awaitLyrics, setAwaitLyrics] = useState(null);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);
  const stateRef  = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    const saved = (() => { try { return JSON.parse(sessionStorage.getItem(HISTORY_KEY)); } catch { return null; } })();
    if (saved?.length) { setMessages(saved); return; }
    setMessages([{ id: 1, role: 'assistant',
      content: `ElevateFlow AI ready.\n\n100% local — no internet required.\n\nI can control slides, outputs, media, timer, sync, fonts, and more. Try:\n• "Open audience output"\n• "Set timer to 5 minutes"\n• "Create a song called Amazing Grace"\n• Type "help" for the full command list.`,
    }]);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    try { sessionStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-60))); } catch {}
  }, [messages]);

  // Typewriter
  const streamMessage = useCallback(async (text) => {
    const id = Date.now() + Math.random();
    setMessages(prev => [...prev, { id, role: 'assistant', content: '' }]);
    let current = '';
    for (let i = 0; i < text.length; i++) {
      current += text[i];
      setMessages(prev => prev.map(m => m.id === id ? { ...m, content: current } : m));
      await new Promise(r => setTimeout(r, Math.random() * 8 + 3));
    }
  }, []);

  const addLog = useCallback((text) => {
    setMessages(prev => [...prev, { id: Date.now() + Math.random(), role: 'action', content: text }]);
  }, []);

  // Execute actions
  const executeActions = useCallback(async (actions) => {
    const s = stateRef.current;
    for (const action of actions) {
      try {
        switch (action.type) {
          case 'CLEAR_ALL_OUTPUT':
            dispatch({ type: 'SET_SELECTED_SLIDE',  payload: null });
            dispatch({ type: 'SET_LIVE_VIDEO',       payload: null });
            dispatch({ type: 'SET_ACTIVE_OVERLAY',   payload: null });
            dispatch({ type: 'SET_ACTIVE_AUDIO_URL', payload: null });
            addLog('⚠ EMERGENCY CLEAR');
            break;
          case 'SET_MODE':
            dispatch({ type: 'SET_MODE', payload: action.payload });
            addLog(`MODE → ${String(action.payload).toUpperCase()}`);
            break;
          case 'LAUNCH_OUTPUT':
            try { await launchOutputWindow(action.role); } catch {}
            addLog(`OUTPUT LAUNCH → ${String(action.role).toUpperCase()}`);
            break;
          case 'CLOSE_OUTPUT':
            try { await closeOutputWindow(action.role); } catch {}
            addLog(`OUTPUT CLOSE → ${String(action.role).toUpperCase()}`);
            break;
          case 'RUST_WIN':
            await invoke('menu_action', { action: action.action }).catch(() => {});
            addLog(`WINDOW → ${action.action}`);
            break;
          case 'NEXT_SLIDE': {
            const song = (s.librarySongs||[]).find(x => x.id === s.activeItemId);
            const slides = song?.slides || [];
            const idx = slides.findIndex(sl => sl.id === s.selectedSlideId);
            if (idx < slides.length - 1) dispatch({ type: 'SET_SELECTED_SLIDE', payload: slides[idx+1].id });
            addLog('SLIDE → NEXT');
            break;
          }
          case 'PREV_SLIDE': {
            const song = (s.librarySongs||[]).find(x => x.id === s.activeItemId);
            const slides = song?.slides || [];
            const idx = slides.findIndex(sl => sl.id === s.selectedSlideId);
            if (idx > 0) dispatch({ type: 'SET_SELECTED_SLIDE', payload: slides[idx-1].id });
            addLog('SLIDE → PREV');
            break;
          }
          case 'SELECT_SLIDE_BY_INDEX': {
            const song = (s.librarySongs||[]).find(x => x.id === s.activeItemId);
            const sl = song?.slides?.[action.index];
            if (sl) dispatch({ type: 'SET_SELECTED_SLIDE', payload: sl.id });
            addLog(`SLIDE → INDEX ${action.index}`);
            break;
          }
          case 'SEND_TO_AUDIENCE': {
            const song  = (s.librarySongs||[]).find(x => x.id === s.activeItemId);
            const slide = song?.slides?.find(sl => sl.id === s.selectedSlideId);
            if (slide && slidesActions?.sendToAudience) await slidesActions.sendToAudience(slide);
            addLog('AUDIENCE → PUSHED LIVE');
            break;
          }
          case 'SLIDE_ADD':
            if (slidesActions?.addSlide) slidesActions.addSlide(action.overrides || {});
            addLog('SLIDE → ADDED');
            break;
          case 'SLIDE_DELETE':
            if (slidesActions?.deleteSlide) slidesActions.deleteSlide(s.selectedSlideId);
            addLog('SLIDE → DELETED');
            break;
          case 'SLIDE_DUPLICATE':
            if (slidesActions?.duplicateSlide) slidesActions.duplicateSlide(s.selectedSlideId);
            addLog('SLIDE → DUPLICATED');
            break;
          case 'SLIDE_COPY':
            if (slidesActions?.copySlide) slidesActions.copySlide(s.selectedSlideId);
            addLog('SLIDE → COPIED');
            break;
          case 'SLIDE_CUT':
            if (slidesActions?.cutSlide) slidesActions.cutSlide(s.selectedSlideId);
            addLog('SLIDE → CUT');
            break;
          case 'SLIDE_PASTE':
            if (slidesActions?.pasteSlide) slidesActions.pasteSlide();
            addLog('SLIDE → PASTED');
            break;
          case 'SLIDE_DESELECT':
            dispatch({ type: 'SET_SELECTED_SLIDE', payload: null });
            break;
          case 'SLIDE_TEXT': {
            if (slidesActions?.updateSlideText) { slidesActions.updateSlideText(action.text); }
            else {
              const song = (s.librarySongs||[]).find(x => x.id === s.activeItemId);
              if (song) {
                dispatch({ type: 'UPDATE_SONG_SLIDES', payload: (song.slides||[]).map(sl =>
                  sl.id === s.selectedSlideId ? { ...sl, text: action.text } : sl
                )});
              }
            }
            addLog('SLIDE TEXT → UPDATED');
            break;
          }
          case 'SLIDE_STYLE': {
            const song = (s.librarySongs||[]).find(x => x.id === s.activeItemId);
            if (song) {
              dispatch({ type: 'UPDATE_SONG_SLIDES', payload: (song.slides||[]).map(sl =>
                sl.id === s.selectedSlideId ? { ...sl, [action.key]: action.value } : sl
              )});
            }
            addLog(`STYLE → ${action.key}: ${action.value}`);
            break;
          }
          case 'SLIDE_GROUP': {
            const sid = action.slideId || s.selectedSlideId;
            const song = (s.librarySongs||[]).find(x => x.id === s.activeItemId);
            if (song) {
              dispatch({ type: 'UPDATE_SONG_SLIDES', payload: (song.slides||[]).map(sl =>
                sl.id === sid ? { ...sl, group: action.groupName, color: action.color } : sl
              )});
            }
            addLog(`GROUP → ${action.groupName}`);
            break;
          }
          case 'APPLY_THEME_TO_ALL':
            dispatch({ type: 'APPLY_THEME_TO_ALL', payload: action.payload });
            addLog('THEME → ALL SLIDES');
            break;
          case 'COPY_STYLE': {
            const song = (s.librarySongs||[]).find(x => x.id === s.activeItemId);
            const sel  = song?.slides?.find(sl => sl.id === s.selectedSlideId);
            if (sel) dispatch({ type: 'SET_STYLE_CLIPBOARD', payload: sel });
            addLog('STYLE → CLIPBOARD');
            break;
          }
          case 'PASTE_STYLE': {
            if (!s.styleClipboard) break;
            const { textColor, fontFamily, fontSize, fontWeight, italic, underline, strikethrough, transform, lineSpacing } = s.styleClipboard;
            const song = (s.librarySongs||[]).find(x => x.id === s.activeItemId);
            if (song) {
              dispatch({ type: 'UPDATE_SONG_SLIDES', payload: (song.slides||[]).map(sl =>
                sl.id === s.selectedSlideId
                  ? { ...sl, textColor, fontFamily, fontSize, fontWeight, italic, underline, strikethrough, transform, lineSpacing }
                  : sl
              )});
            }
            addLog('STYLE → PASTED');
            break;
          }
          case 'CREATE_SONG_PROMPT':
            setAwaitLyrics({ title: action.title });
            addLog(`AWAITING LYRICS → "${action.title}"`);
            break;
          case 'ADD_SONG':
            dispatch({ type: 'ADD_SONG', payload: action.payload });
            addLog(`SONG → "${action.payload?.title}"`);
            break;
          case 'DELETE_SONG':
            dispatch({ type: 'DELETE_SONG', payload: action.payload });
            addLog('SONG → DELETED');
            break;
          case 'UPDATE_SONG':
            dispatch({ type: 'UPDATE_SONG', payload: action.payload });
            addLog('SONG → RENAMED');
            break;
          case 'SET_ACTIVE_ITEM':
            dispatch({ type: 'SET_ACTIVE_ITEM', payload: action.payload });
            addLog('SONG → ACTIVATED');
            break;
          case 'ADD_LIBRARY':
            dispatch({ type: 'ADD_LIBRARY', payload: action.payload });
            addLog(`LIBRARY → "${action.payload.title}"`);
            break;
          case 'DELETE_LIBRARY':
            dispatch({ type: 'DELETE_LIBRARY', payload: action.payload });
            addLog('LIBRARY → DELETED');
            break;
          case 'ADD_PLAYLIST':
            dispatch({ type: 'ADD_PLAYLIST', payload: action.payload });
            addLog(`PLAYLIST → "${action.payload.title}"`);
            break;
          case 'DELETE_PLAYLIST':
            dispatch({ type: 'DELETE_PLAYLIST', payload: action.payload });
            addLog('PLAYLIST → DELETED');
            break;
          case 'ADD_SONG_TO_PLAYLIST':
            dispatch({ type: 'ADD_SONG_TO_PLAYLIST', payload: action.payload });
            addLog('PLAYLIST → SONG ADDED');
            break;
          case 'REMOVE_SONG_FROM_PLAYLIST':
            dispatch({ type: 'REMOVE_SONG_FROM_PLAYLIST', payload: action.payload });
            addLog('PLAYLIST → SONG REMOVED');
            break;
          case 'MOVE_SONG_TO_LIB':
            dispatch({ type: 'MOVE_SONG_TO_LIB', payload: action.payload });
            addLog('SONG → MOVED');
            break;
          case 'SET_LIVE_VIDEO':
            dispatch({ type: 'SET_LIVE_VIDEO', payload: action.payload });
            addLog(`VIDEO → ${action.payload ? 'SET' : 'CLEARED'}`);
            break;
          case 'SET_ACTIVE_AUDIO_URL':
            dispatch({ type: 'SET_ACTIVE_AUDIO_URL', payload: action.payload });
            addLog(`AUDIO → ${action.payload ? 'SET' : 'STOPPED'}`);
            break;
          case 'SET_ACTIVE_OVERLAY':
            dispatch({ type: 'SET_ACTIVE_OVERLAY', payload: action.payload });
            addLog(`OVERLAY → ${action.payload ? 'SET' : 'CLEARED'}`);
            break;
          case 'SET_VOLUME':
            dispatch({ type: 'SET_VOLUME', payload: action.payload });
            addLog(`VOLUME → ${Math.round(action.payload * 100)}%`);
            break;
          case 'SET_FADE_DURATION':
            dispatch({ type: 'SET_FADE_DURATION', payload: action.payload });
            addLog(`FADE → ${action.payload}s`);
            break;
          case 'SET_TIMER_INITIAL':
            dispatch({ type: 'SET_TIMER_INITIAL', payload: action.payload });
            addLog(`TIMER → SET ${action.payload}s`);
            break;
          case 'SET_TIMER_SECONDS':
            dispatch({ type: 'SET_TIMER_SECONDS', payload: action.payload });
            break;
          case 'SET_TIMER_RUNNING':
            dispatch({ type: 'SET_TIMER_RUNNING', payload: action.payload });
            addLog(`TIMER → ${action.payload ? 'START' : 'STOP'}`);
            break;
          case 'RESET_TIMER':
            dispatch({ type: 'RESET_TIMER' });
            addLog('TIMER → RESET');
            break;
          case 'SET_STAGE_MESSAGE':
            dispatch({ type: 'SET_STAGE_MESSAGE', payload: action.payload });
            addLog(`STAGE MSG → "${action.payload}"`);
            break;
          case 'START_HOSTING':
            dispatch({ type: 'TRIGGER_HOSTING' });
            addLog('SYNC → HOST STARTED');
            break;
          case 'END_SESSION':
            dispatch({ type: 'END_SESSION' });
            addLog('SYNC → ENDED');
            break;
          case 'TOGGLE_SYNC_PANEL':    dispatch({ type: 'TOGGLE_SYNC_PANEL' }); break;
          case 'TOGGLE_TIMELINE':
            dispatch({ type: 'TOGGLE_TIMELINE' });
            addLog('TIMELINE → TOGGLED');
            break;
          case 'SET_TIMELINE_PLAYING': dispatch({ type: 'SET_TIMELINE_PLAYING', payload: action.payload }); break;
          case 'SET_TIMELINE_LOOP':    dispatch({ type: 'SET_TIMELINE_LOOP',    payload: action.payload }); break;
          case 'SET_CANVAS_RATIO':
            dispatch({ type: 'SET_CANVAS_RATIO', payload: action.payload });
            addLog(`CANVAS → ${action.payload}`);
            break;
          case 'SET_SLIDE_CARD_SIZE':
            dispatch({ type: 'SET_SLIDE_CARD_SIZE', payload: action.payload });
            addLog(`CARD SIZE → ${action.payload}px`);
            break;
          case 'SET_UNDERSCAN_SCALE':
            dispatch({ type: 'SET_UNDERSCAN_SCALE', payload: action.payload });
            addLog(`UNDERSCAN → ${action.payload}`);
            break;
          case 'SET_MEDIA_BIN_TAB':    dispatch({ type: 'SET_MEDIA_BIN_TAB', payload: action.payload }); break;
          case 'TOGGLE_ARRANGEMENTS':  dispatch({ type: 'TOGGLE_ARRANGEMENTS' }); break;
          case 'SET_ACTIVE_STAGE_LAYOUT':
            dispatch({ type: 'SET_ACTIVE_STAGE_LAYOUT', payload: action.payload });
            addLog('STAGE LAYOUT → ACTIVATED');
            break;
          // Query/help types need no dispatch
          case 'SEARCH': case 'QUERY_MODE': case 'QUERY_SONGS': case 'QUERY_SLIDES':
          case 'QUERY_TIMER': case 'QUERY_SYNC': case 'QUERY_MEDIA': case 'HELP':
            break;
          default:
            dispatch(action);
        }
      } catch (err) {
        addLog(`ERROR → ${action.type}: ${err.message}`);
        console.error('[AI]', action.type, err);
      }
    }
  }, [dispatch, slidesActions, addLog]);

  // Send message
  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setMessages(prev => [...prev, { id: Date.now(), role: 'user', content: text }]);
    setLoading(true);
    await new Promise(r => setTimeout(r, 70));

    // Lyrics step
    if (awaitLyrics) {
      const slides = parseLyricsToSlides(text);
      const newSong = {
        id: `ai_${Date.now()}`, title: awaitLyrics.title, slides,
        libId: stateRef.current.libraries?.[0]?.id || null,
      };
      dispatch({ type: 'ADD_SONG',        payload: newSong });
      dispatch({ type: 'SET_ACTIVE_ITEM',  payload: newSong.id });
      addLog(`SONG CREATED → "${awaitLyrics.title}" — ${slides.length} slides`);
      await streamMessage(`"${awaitLyrics.title}" created with ${slides.length} slide${slides.length!==1?'s':''} and added to your library. It's now the active song.`);
      setAwaitLyrics(null);
      setLoading(false);
      inputRef.current?.focus();
      return;
    }

    const actions = parseIntent(text, stateRef.current);
    await executeActions(actions);
    await streamMessage(buildReply(actions, stateRef.current, text));
    setLoading(false);
    inputRef.current?.focus();
  }, [input, loading, awaitLyrics, executeActions, streamMessage, addLog, dispatch]);

  const fireChip = useCallback(async (cmd) => {
    if (loading) return;
    setMessages(prev => [...prev, { id: Date.now(), role: 'user', content: cmd }]);
    setLoading(true);
    await new Promise(r => setTimeout(r, 60));
    const actions = parseIntent(cmd, stateRef.current);
    await executeActions(actions);
    await streamMessage(buildReply(actions, stateRef.current, cmd));
    setLoading(false);
  }, [loading, executeActions, streamMessage]);

  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };
  const clearHistory = () => {
    sessionStorage.removeItem(HISTORY_KEY);
    setMessages([{ id: Date.now(), role: 'assistant', content: 'Chat cleared. How can I help?' }]);
  };

  // ── RENDER ───────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes efAiIn{from{transform:translateX(110%) scale(.96);opacity:0}to{transform:translateX(0) scale(1);opacity:1}}
        @keyframes efAiGlow{0%,100%{box-shadow:0 0 8px rgba(212,175,55,.4)}50%{box-shadow:0 0 22px rgba(212,175,55,.9)}}
        @keyframes efDot{0%,100%{opacity:.25;transform:scale(.8)}50%{opacity:1;transform:scale(1.15)}}
        @keyframes efFadeUp{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}
        .ef-ai-panel{animation:efAiIn .48s cubic-bezier(.16,1,.3,1) forwards}
        .ef-ai-msg{animation:efFadeUp .2s ease forwards}
        .ef-ai-scroll::-webkit-scrollbar{width:4px}
        .ef-ai-scroll::-webkit-scrollbar-thumb{background:rgba(212,175,55,.18);border-radius:10px}
        .ef-chip:hover{background:rgba(212,175,55,.14)!important;border-color:rgba(212,175,55,.4)!important;color:#D4AF37!important}
        .ef-send:not(:disabled):hover{transform:scale(1.08)!important;box-shadow:0 4px 22px rgba(212,175,55,.55)!important}
        .ef-xbtn:hover{background:rgba(255,255,255,.12)!important;color:#fff!important}
        .ef-clr:hover{color:#D4AF37!important}
        .ef-inp:focus{border-color:rgba(212,175,55,.45)!important;box-shadow:0 0 0 2px rgba(212,175,55,.1)!important}
      `}</style>

      <div className="ef-ai-panel" style={{
        position:'fixed',right:18,top:18,bottom:18,width:390,zIndex:99999,
        background:'linear-gradient(160deg,rgba(14,14,18,.96) 0%,rgba(8,8,12,.98) 100%)',
        backdropFilter:'blur(48px) saturate(200%)',WebkitBackdropFilter:'blur(48px) saturate(200%)',
        border:'1px solid rgba(212,175,55,.13)',borderRadius:22,
        boxShadow:'0 40px 100px rgba(0,0,0,.7),inset 0 1px 0 rgba(255,255,255,.06)',
        display:'flex',flexDirection:'column',overflow:'hidden',
        fontFamily:'-apple-system,BlinkMacSystemFont,"SF Pro Text",Arial,sans-serif',
      }}>

        {/* HEADER */}
        <div style={{
          padding:'13px 15px',flexShrink:0,
          borderBottom:'1px solid rgba(255,255,255,.055)',
          background:'rgba(212,175,55,.02)',
          display:'flex',alignItems:'center',justifyContent:'space-between',
        }}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{
              width:34,height:34,borderRadius:11,
              background:'linear-gradient(135deg,rgba(212,175,55,.25),rgba(212,175,55,.07))',
              border:'1px solid rgba(212,175,55,.25)',
              display:'flex',alignItems:'center',justifyContent:'center',
              animation:'efAiGlow 2.5s ease infinite',flexShrink:0,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="1.8" strokeLinecap="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            </div>
            <div>
              <div style={{fontSize:12,fontWeight:800,color:'#f0f0f0',letterSpacing:'.4px'}}>ELEVATEFLOW AI</div>
              <div style={{fontSize:10,color:loading?'#D4AF37':'rgba(212,175,55,.55)',fontWeight:500,marginTop:1}}>
                {loading ? '● Processing…' : `● ${(state.librarySongs||[]).length} songs · ${state.mode} mode · local`}
              </div>
            </div>
          </div>
          <div style={{display:'flex',gap:6,alignItems:'center'}}>
            <button className="ef-clr" onClick={clearHistory} title="Clear chat" style={{
              background:'none',border:'none',color:'#333',fontSize:14,cursor:'pointer',
              padding:'4px 6px',borderRadius:6,transition:'color .15s',
            }}>⌫</button>
            <button className="ef-xbtn" onClick={onClose} style={{
              background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.1)',
              color:'#666',width:28,height:28,borderRadius:'50%',
              display:'flex',alignItems:'center',justifyContent:'center',
              cursor:'pointer',transition:'all .15s',padding:0,flexShrink:0,
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        {/* QUICK CHIPS */}
        <div style={{
          padding:'7px 11px 6px',flexShrink:0,
          borderBottom:'1px solid rgba(255,255,255,.045)',
          display:'flex',flexWrap:'wrap',gap:4,
        }}>
          {CHIPS.map(({label,cmd}) => (
            <button key={cmd} className="ef-chip" onClick={() => fireChip(cmd)} disabled={loading}
              style={{
                padding:'3px 8px',borderRadius:20,cursor:loading?'not-allowed':'pointer',
                background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.09)',
                color:'#555',fontSize:10,fontWeight:600,whiteSpace:'nowrap',
                transition:'all .14s',opacity:loading?.5:1,
              }}
            >{label}</button>
          ))}
        </div>

        {/* CHAT */}
        <div className="ef-ai-scroll" style={{
          flex:1,overflowY:'auto',padding:'12px',
          display:'flex',flexDirection:'column',gap:7,
        }}>
          {messages.map(m => (
            <div key={m.id} className="ef-ai-msg" style={{
              display:'flex',
              justifyContent:m.role==='user'?'flex-end':m.role==='action'?'center':'flex-start',
            }}>
              {m.role === 'action' ? (
                <div style={{
                  fontSize:10,fontWeight:700,letterSpacing:'.3px',
                  color:'#4ade80',background:'rgba(74,222,128,.07)',
                  border:'1px solid rgba(74,222,128,.16)',
                  padding:'3px 10px',borderRadius:8,
                  fontFamily:'"SF Mono","JetBrains Mono",monospace',
                  display:'flex',alignItems:'center',gap:5,maxWidth:'90%',
                }}>
                  <span style={{opacity:.6}}>✓</span>{m.content}
                </div>
              ) : (
                <div style={{
                  maxWidth:'88%',padding:'10px 13px',
                  borderRadius:m.role==='user'?'16px 16px 4px 16px':'16px 16px 16px 4px',
                  fontSize:13,lineHeight:1.55,wordBreak:'break-word',whiteSpace:'pre-wrap',
                  ...(m.role==='user'
                    ? { background:'linear-gradient(135deg,rgba(212,175,55,.18),rgba(212,175,55,.06))', color:'#e8d48a', border:'1px solid rgba(212,175,55,.26)' }
                    : { background:'rgba(255,255,255,.055)', color:'#ddd', border:'1px solid rgba(255,255,255,.08)' }
                  ),
                }}>
                  {m.content}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div style={{display:'flex',justifyContent:'flex-start'}}>
              <div style={{
                padding:'10px 16px',borderRadius:'16px 16px 16px 4px',
                background:'rgba(255,255,255,.055)',border:'1px solid rgba(255,255,255,.08)',
                display:'flex',gap:5,alignItems:'center',
              }}>
                {[0,1,2].map(i => (
                  <span key={i} style={{
                    width:5,height:5,borderRadius:'50%',background:'#D4AF37',display:'inline-block',
                    animation:`efDot 1.1s ease ${i*.22}s infinite`,
                  }}/>
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef}/>
        </div>

        {/* LYRICS BANNER */}
        {awaitLyrics && (
          <div style={{
            padding:'8px 14px',flexShrink:0,
            background:'rgba(212,175,55,.07)',
            borderTop:'1px solid rgba(212,175,55,.18)',
            display:'flex',alignItems:'center',gap:7,
            fontSize:11,color:'#D4AF37',fontWeight:600,
          }}>
            <span style={{fontSize:15}}>♪</span>
            <span>Paste lyrics for <strong>"{awaitLyrics.title}"</strong> — I'll auto-format into slides</span>
            <button onClick={() => setAwaitLyrics(null)} style={{
              marginLeft:'auto',background:'none',border:'none',color:'#666',cursor:'pointer',fontSize:15,padding:0,
            }}>✕</button>
          </div>
        )}

        {/* INPUT */}
        <div style={{padding:'10px 12px 14px',flexShrink:0,borderTop:'1px solid rgba(255,255,255,.055)'}}>
          <div style={{display:'flex',gap:8,alignItems:'flex-end'}}>
            <textarea
              ref={inputRef}
              className="ef-inp"
              value={input}
              onChange={e => {
                setInput(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 130) + 'px';
              }}
              onKeyDown={handleKey}
              placeholder={awaitLyrics ? `Paste lyrics for "${awaitLyrics.title}" here…` : 'Give a command or ask a question…'}
              rows={1}
              autoFocus
              style={{
                flex:1,resize:'none',maxHeight:130,overflowY:'auto',
                background:'rgba(255,255,255,.05)',
                border:'1px solid rgba(255,255,255,.11)',
                borderRadius:14,color:'#f0f0f0',fontSize:13,
                padding:'9px 13px',outline:'none',lineHeight:1.45,
                fontFamily:'inherit',transition:'border-color .15s,box-shadow .15s',
              }}
            />
            <button className="ef-send" onClick={send} disabled={loading||!input.trim()}
              style={{
                width:38,height:38,borderRadius:13,flexShrink:0,
                background:input.trim()&&!loading?'#D4AF37':'rgba(212,175,55,.12)',
                border:'none',
                color:input.trim()&&!loading?'#000':'rgba(212,175,55,.3)',
                display:'flex',alignItems:'center',justifyContent:'center',
                cursor:input.trim()&&!loading?'pointer':'not-allowed',
                transition:'all .18s ease',
                boxShadow:input.trim()&&!loading?'0 2px 14px rgba(212,175,55,.38)':'none',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
              </svg>
            </button>
          </div>
          <div style={{marginTop:5,fontSize:10,color:'rgba(255,255,255,.15)',textAlign:'center'}}>
            Enter to send · Shift+Enter for new line · 100% local · no internet required
          </div>
        </div>

      </div>
    </>
  );
}