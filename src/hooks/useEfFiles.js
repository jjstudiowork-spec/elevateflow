/**
 * useEfFiles.js
 * Import / export .ef (ElevateFlow Song) files.
 */
import { open, save } from '@tauri-apps/plugin-dialog';
import { writeTextFile, readTextFile } from '@tauri-apps/plugin-fs';

export async function exportSongAsEf(song) {
  if (!song) throw new Error('No song to export');

  const payload = JSON.stringify({
    version: 1,
    type: 'elevateflow-song',
    title: song.title || 'Untitled',
    slides: (song.slides || []).map(s => ({
      id:            s.id,
      text:          s.text,
      group:         s.group,
      color:         s.color,
      textColor:     s.textColor,
      fontFamily:    s.fontFamily,
      fontSize:      s.fontSize,
      fontWeight:    s.fontWeight,
      italic:        s.italic,
      underline:     s.underline,
      strikethrough: s.strikethrough,
      transform:     s.transform,
      lineSpacing:   s.lineSpacing,
      x:             s.x,
      y:             s.y,
      width:         s.width,
      height:        s.height,
      video:         s.video && !s.video.startsWith('asset://') ? s.video : null,
    })),
  }, null, 2);

  const filePath = await save({
    defaultPath: `${song.title || 'song'}.ef`,
    filters: [{ name: 'ElevateFlow Song', extensions: ['ef'] }],
  });

  if (!filePath) return null;
  await writeTextFile(filePath, payload);
  return filePath;
}

export async function importEfFile() {
  const selected = await open({
    multiple: false,
    filters: [{ name: 'ElevateFlow Song', extensions: ['ef'] }],
  });
  if (!selected) return null;

  const path = typeof selected === 'string' ? selected : selected.path;
  const raw = await readTextFile(path);
  const data = JSON.parse(raw);

  if (data.type !== 'elevateflow-song') {
    throw new Error('Not a valid ElevateFlow song file');
  }

  return {
    title:  data.title || 'Imported Song',
    slides: (data.slides || []).map(s => ({
      ...s,
      id: Date.now() + Math.random(),
    })),
  };
}