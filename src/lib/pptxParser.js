/**
 * pptxParser.js — ElevateFlow
 *
 * Reads a .pptx file (JSZip), renders every slide onto an offscreen <canvas>,
 * and returns { title, slides[] } where each slide has a pptxImageUrl (JPEG data-URL).
 *
 * Handles: solid / gradient / picture backgrounds, images, text boxes, group shapes.
 * Theme colour cascade: slide → layout → master.
 *
 * Install dependency:   npm install jszip
 */

import JSZip from 'jszip';

// ─── Output dimensions ───────────────────────────────────────────────────────
const RENDER_W = 960;
const RENDER_H = 540;

// ─── OOXML relationship namespace ────────────────────────────────────────────
const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

// ─── XML helpers (fully namespace-agnostic) ──────────────────────────────────

function* iterEls(node) {
  if (node.nodeType === 1) yield node;
  for (const c of node.childNodes) yield* iterEls(c);
}

/** First descendant with matching localName */
const $q = (node, name) => {
  if (!node) return null;
  for (const el of iterEls(node)) if (el.localName === name) return el;
  return null;
};

/** Direct children with matching localName */
const $kids = (node, name) =>
  Array.from(node?.childNodes || []).filter(n => n.localName === name);

/** First direct child with matching localName */
const $kid = (node, name) => $kids(node, name)[0] || null;

// ─── Preset named colours ────────────────────────────────────────────────────

const PRSTCLR = {
  aliceBlue:'#f0f8ff', antiqueWhite:'#faebd7', aqua:'#00ffff', aquamarine:'#7fffd4',
  azure:'#f0ffff', beige:'#f5f5dc', bisque:'#ffe4c4', black:'#000000',
  blanchedAlmond:'#ffebcd', blue:'#0000ff', blueViolet:'#8a2be2', brown:'#a52a2a',
  burlyWood:'#deb887', cadetBlue:'#5f9ea0', chartreuse:'#7fff00', chocolate:'#d2691e',
  coral:'#ff7f50', cornflowerBlue:'#6495ed', cornsilk:'#fff8dc', crimson:'#dc143c',
  cyan:'#00ffff', darkBlue:'#00008b', darkCyan:'#008b8b', darkGoldenrod:'#b8860b',
  darkGray:'#a9a9a9', darkGreen:'#006400', darkKhaki:'#bdb76b', darkMagenta:'#8b008b',
  darkOliveGreen:'#556b2f', darkOrange:'#ff8c00', darkOrchid:'#9932cc', darkRed:'#8b0000',
  darkSalmon:'#e9967a', darkSeaGreen:'#8fbc8f', darkSlateBlue:'#483d8b',
  darkSlateGray:'#2f4f4f', darkTurquoise:'#00ced1', darkViolet:'#9400d3',
  deepPink:'#ff1493', deepSkyBlue:'#00bfff', dimGray:'#696969', dodgerBlue:'#1e90ff',
  fireBrick:'#b22222', floralWhite:'#fffaf0', forestGreen:'#228b22', fuchsia:'#ff00ff',
  gainsboro:'#dcdcdc', ghostWhite:'#f8f8ff', gold:'#ffd700', goldenrod:'#daa520',
  gray:'#808080', green:'#008000', greenYellow:'#adff2f', honeydew:'#f0fff0',
  hotPink:'#ff69b4', indianRed:'#cd5c5c', indigo:'#4b0082', ivory:'#fffff0',
  khaki:'#f0e68c', lavender:'#e6e6fa', lavenderBlush:'#fff0f5', lawnGreen:'#7cfc00',
  lemonChiffon:'#fffacd', lightBlue:'#add8e6', lightCoral:'#f08080', lightCyan:'#e0ffff',
  lightGoldenrodYellow:'#fafad2', lightGray:'#d3d3d3', lightGreen:'#90ee90',
  lightPink:'#ffb6c1', lightSalmon:'#ffa07a', lightSeaGreen:'#20b2aa',
  lightSkyBlue:'#87cefa', lightSlateGray:'#778899', lightSteelBlue:'#b0c4de',
  lightYellow:'#ffffe0', lime:'#00ff00', limeGreen:'#32cd32', linen:'#faf0e6',
  magenta:'#ff00ff', maroon:'#800000', medAquamarine:'#66cdaa', medBlue:'#0000cd',
  medOrchid:'#ba55d3', medPurple:'#9370db', medSeaGreen:'#3cb371', medSlateBlue:'#7b68ee',
  medSpringGreen:'#00fa9a', medTurquoise:'#48d1cc', medVioletRed:'#c71585',
  midnightBlue:'#191970', mintCream:'#f5fffa', mistyRose:'#ffe4e1', moccasin:'#ffe4b5',
  navajoWhite:'#ffdead', navy:'#000080', oldLace:'#fdf5e6', olive:'#808000',
  oliveDrab:'#6b8e23', orange:'#ffa500', orangeRed:'#ff4500', orchid:'#da70d6',
  paleGoldenrod:'#eee8aa', paleGreen:'#98fb98', paleTurquoise:'#afeeee',
  paleVioletRed:'#db7093', papayaWhip:'#ffefd5', peachPuff:'#ffdab9', peru:'#cd853f',
  pink:'#ffc0cb', plum:'#dda0dd', powderBlue:'#b0e0e6', purple:'#800080',
  red:'#ff0000', rosyBrown:'#bc8f8f', royalBlue:'#4169e1', saddleBrown:'#8b4513',
  salmon:'#fa8072', sandyBrown:'#f4a460', seaGreen:'#2e8b57', seaShell:'#fff5ee',
  sienna:'#a0522d', silver:'#c0c0c0', skyBlue:'#87ceeb', slateBlue:'#6a5acd',
  slateGray:'#708090', snow:'#fffafa', springGreen:'#00ff7f', steelBlue:'#4682b4',
  tan:'#d2b48c', teal:'#008080', thistle:'#d8bfd8', tomato:'#ff6347',
  turquoise:'#40e0d0', violet:'#ee82ee', wheat:'#f5deb3', white:'#ffffff',
  whiteSmoke:'#f5f5f5', yellow:'#ffff00', yellowGreen:'#9acd32',
};

// ─── Colour resolution ───────────────────────────────────────────────────────

/** Apply lumMod / lumOff / shade / tint / alpha to a hex colour string */
function applyMods(hex, mods) {
  if (!mods?.length || !hex) return hex;
  let r = parseInt(hex.slice(1, 3), 16);
  let g = parseInt(hex.slice(3, 5), 16);
  let b = parseInt(hex.slice(5, 7), 16);
  for (const [type, val] of mods) {
    const p = val / 100000;
    if (type === 'lumMod')  { r *= p; g *= p; b *= p; }
    if (type === 'lumOff')  { r += 255 * p; g += 255 * p; b += 255 * p; }
    if (type === 'shade')   { r *= p; g *= p; b *= p; }
    if (type === 'tint')    { r += (255-r)*p; g += (255-g)*p; b += (255-b)*p; }
  }
  const cl = v => Math.min(255, Math.max(0, Math.round(v)));
  return '#' + cl(r).toString(16).padStart(2,'0')
             + cl(g).toString(16).padStart(2,'0')
             + cl(b).toString(16).padStart(2,'0');
}

/** Resolve an OOXML colour element (srgbClr / sysClr / schemeClr / prstClr) */
function resolveClr(el, tc = {}) {
  if (!el) return null;
  const ch = el.firstElementChild;
  if (!ch) return null;
  const mods = Array.from(ch.childNodes)
    .filter(n => n.nodeType === 1)
    .map(n => [n.localName, parseInt(n.getAttribute('val') || '0')]);
  if (ch.localName === 'srgbClr')   return applyMods('#' + ch.getAttribute('val'), mods);
  if (ch.localName === 'sysClr')    return applyMods('#' + (ch.getAttribute('lastClr') || '000000'), mods);
  if (ch.localName === 'prstClr')   return applyMods(PRSTCLR[ch.getAttribute('val')] || '#888888', mods);
  if (ch.localName === 'schemeClr') return applyMods(tc[ch.getAttribute('val')] || '#888888', mods);
  return null;
}

/** Return the first solidFill colour inside el, or null */
function solidClr(el, tc) {
  const sf = $q(el, 'solidFill');
  return sf ? resolveClr(sf, tc) : null;
}

// ─── Relationships ────────────────────────────────────────────────────────────

async function loadRels(zip, path) {
  const m = {};
  try {
    const xml = await zip.file(path)?.async('text');
    if (!xml) return m;
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    for (const el of iterEls(doc)) {
      if (el.localName === 'Relationship') m[el.getAttribute('Id')] = el.getAttribute('Target');
    }
  } catch {}
  return m;
}

/** Resolve a relative target against a base path */
function joinPath(base, target) {
  if (!target) return '';
  if (target.startsWith('/')) return target.slice(1);
  const segs = base.split('/'); segs.pop();
  for (const s of target.split('/')) {
    if (s === '..') segs.pop();
    else if (s && s !== '.') segs.push(s);
  }
  return segs.join('/');
}

/** Derive the .rels path for any OOXML part */
function relsFor(filePath) {
  const i = filePath.lastIndexOf('/');
  const dir = i >= 0 ? filePath.slice(0, i) : '';
  const name = i >= 0 ? filePath.slice(i + 1) : filePath;
  return (dir ? dir + '/' : '') + '_rels/' + name + '.rels';
}

// ─── Image loading ────────────────────────────────────────────────────────────

const _imgCache = new Map();

async function loadZipImg(zip, path) {
  if (!path) return null;
  if (_imgCache.has(path)) return _imgCache.get(path);

  const promise = (async () => {
    const file = zip.file(path);
    if (!file) return null;

    const b64 = await file.async('base64');
    const ext = path.split('.').pop().toLowerCase();

    const mime = {
      png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg',
      gif:'image/gif', webp:'image/webp', bmp:'image/bmp',
      svg:'image/svg+xml', tiff:'image/tiff'
    }[ext] || 'image/jpeg';

    const img = new Image();
    img.decoding = "async";
    img.src = `data:${mime};base64,${b64}`;

    await img.decode?.().catch(() => {});

    return img;
  })();

  _imgCache.set(path, promise);
  return promise;
}

// ─── Theme colours ────────────────────────────────────────────────────────────

async function loadTheme(zip, path) {
  const tc = {};
  try {
    const xml = await zip.file(path)?.async('text');
    if (!xml) return tc;
    const doc = new DOMParser().parseFromString(xml, 'text/xml');
    const cs = $q(doc, 'clrScheme');
    if (!cs) return tc;
    for (const el of cs.childNodes) {
      if (el.nodeType !== 1) continue;
      const ch = el.firstElementChild;
      if (!ch) continue;
      if (ch.localName === 'srgbClr') tc[el.localName] = '#' + ch.getAttribute('val');
      else if (ch.localName === 'sysClr') tc[el.localName] = '#' + (ch.getAttribute('lastClr') || '000000');
    }
  } catch {}
  return tc;
}

// ─── Transform ────────────────────────────────────────────────────────────────

function EMU(v, scale) { return (parseInt(v || 0) / 9525) * scale; }

function getXfrm(spPr) {
  const xf = $q(spPr, 'xfrm');
  if (!xf) return null;
  const off = $kid(xf, 'off'), ext = $kid(xf, 'ext');
  return {
    x:   parseInt(off?.getAttribute('x')  || 0),
    y:   parseInt(off?.getAttribute('y')  || 0),
    cx:  parseInt(ext?.getAttribute('cx') || 0),
    cy:  parseInt(ext?.getAttribute('cy') || 0),
    rot: parseInt(xf.getAttribute('rot') || 0),
  };
}

// ─── Background fill ─────────────────────────────────────────────────────────

async function drawBg(ctx, bgEl, zip, rels, baseDir, tc) {
  if (!bgEl) return false;
  const bgPr = $kid(bgEl, 'bgPr');
  if (!bgPr) return false;
  if ($q(bgPr, 'noFill')) return false;

  // Solid
  const c = solidClr(bgPr, tc);
  if (c) { ctx.fillStyle = c; ctx.fillRect(0, 0, RENDER_W, RENDER_H); return true; }

  // Gradient
  const gf = $q(bgPr, 'gradFill');
  if (gf) {
    const gsLst = $kid(gf, 'gsLst');
    const stops = gsLst ? $kids(gsLst, 'gs') : [];
    if (stops.length >= 2) {
      const lin = $q(gf, 'lin');
      const angDeg = parseInt(lin?.getAttribute('ang') || 0) / 60000;
      const rad = (angDeg - 90) * Math.PI / 180;
      const d = Math.sqrt(RENDER_W ** 2 + RENDER_H ** 2) / 2;
      const cx = RENDER_W / 2, cy = RENDER_H / 2;
      const grd = ctx.createLinearGradient(
        cx - Math.cos(rad) * d, cy - Math.sin(rad) * d,
        cx + Math.cos(rad) * d, cy + Math.sin(rad) * d,
      );
      for (const st of stops) {
        const pos = parseInt(st.getAttribute('pos') || 0) / 100000;
        const sc = solidClr(st, tc) || '#000000';
        try { grd.addColorStop(pos, sc); } catch {}
      }
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, RENDER_W, RENDER_H);
      return true;
    }
  }

  // Blip / picture fill
  const blip = $q(bgPr, 'blip');
  if (blip) {
    const rId = blip.getAttributeNS(REL_NS, 'embed') || blip.getAttribute('r:embed');
    if (rId && rels[rId]) {
      const img = await loadZipImg(zip, joinPath(baseDir, rels[rId]));
      if (img) { ctx.drawImage(img, 0, 0, RENDER_W, RENDER_H); return true; }
    }
  }

  return false;
}

// ─── Text body ────────────────────────────────────────────────────────────────

function drawTxBody(ctx, txBody, bx, by, bw, bh, sx, sy, tc) {
  const bPr = $kid(txBody, 'bodyPr');
  const anchor = bPr?.getAttribute('anchor') || 'ctr';
  const lIns = EMU(bPr?.getAttribute('lIns') ?? 91440, sx);
  const rIns = EMU(bPr?.getAttribute('rIns') ?? 91440, sx);
  const tIns = EMU(bPr?.getAttribute('tIns') ?? 45720, sy);
  const bIns = EMU(bPr?.getAttribute('bIns') ?? 45720, sy);

  const paras = $kids(txBody, 'p');
  if (!paras.length) return;

  // Build line list
  const lines = [];
  for (const p of paras) {
    const pPr = $kid(p, 'pPr');
    const align = pPr?.getAttribute('algn') || 'l';
    const spc   = parseInt($kid(pPr, 'lnSpc')
                    ? $q(pPr, 'spcPct')?.getAttribute('val') || '100000'
                    : '100000') / 100000;

    const nodes = Array.from(p.childNodes).filter(n => n.localName === 'r' || n.localName === 'br' || n.localName === 'fld');
    if (!nodes.length) { lines.push({ segs: [], align, spc }); continue; }

    let segs = [];
    for (const n of nodes) {
      if (n.localName === 'br') { lines.push({ segs, align, spc }); segs = []; continue; }

      const rPr = $kid(n, 'rPr');
      const t   = $kid(n, 't');
      const text = t?.textContent || '';
      if (!text) continue;

      const szHundPt = parseInt(rPr?.getAttribute('sz') || '1800');
      const fsPx = Math.round((szHundPt / 100) * (96 / 72) * sy);

      const bold   = rPr?.getAttribute('b') === '1';
      const italic = rPr?.getAttribute('i') === '1';

      const sfEl = $q(rPr || { childNodes: [] }, 'solidFill');
      const color = (sfEl ? resolveClr(sfEl, tc) : null) || '#000000';

      segs.push({ text, fsPx, bold, italic, color });
    }
    lines.push({ segs, align, spc });
  }

  // Measure total height
  const DEFAULT_FS = Math.round(18 * (96 / 72) * sy);
  let totalH = 0;
  for (const ln of lines) {
    const maxFs = ln.segs.length ? Math.max(...ln.segs.map(s => s.fsPx)) : DEFAULT_FS;
    totalH += maxFs * 1.25 * (ln.spc || 1);
  }

  let curY = by + tIns;
  if (anchor === 'ctr') curY = by + bh / 2 - totalH / 2;
  else if (anchor === 'b') curY = by + bh - bIns - totalH;

  ctx.save();
  ctx.beginPath();
  ctx.rect(bx, by, bw, bh);
  ctx.clip();

  for (const ln of lines) {
    const maxFs = ln.segs.length ? Math.max(...ln.segs.map(s => s.fsPx)) : DEFAULT_FS;
    const lineH = maxFs * 1.25 * (ln.spc || 1);

    // Measure line width for alignment
    let lineW = 0;
    for (const seg of ln.segs) {
      ctx.font = `${seg.italic ? 'italic ' : ''}${seg.bold ? 'bold ' : ''}${seg.fsPx}px Arial, sans-serif`;
      lineW += ctx.measureText(seg.text).width;
    }

    let curX = bx + lIns;
    if (ln.align === 'ctr') curX = bx + bw / 2 - lineW / 2;
    else if (ln.align === 'r') curX = bx + bw - rIns - lineW;

    for (const seg of ln.segs) {
      ctx.font = `${seg.italic ? 'italic ' : ''}${seg.bold ? 'bold ' : ''}${seg.fsPx}px Arial, sans-serif`;
      ctx.fillStyle = seg.color;
      ctx.fillText(seg.text, curX, curY + maxFs * 0.82);
      curX += ctx.measureText(seg.text).width;
    }
    curY += lineH;
  }
  ctx.restore();
}

// ─── Shape (p:sp) ─────────────────────────────────────────────────────────────

async function drawSp(ctx, el, zip, rels, baseDir, sx, sy, tc) {
  const spPr = $kid(el, 'spPr');
  if (!spPr) return;
  const xf = getXfrm(spPr);
  if (!xf) return;

  const x = EMU(xf.x, sx), y = EMU(xf.y, sy);
  const w = EMU(xf.cx, sx), h = EMU(xf.cy, sy);

  ctx.save();
  if (xf.rot) {
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(xf.rot * Math.PI / 10800000);
    ctx.translate(-(x + w / 2), -(y + h / 2));
  }

  const noFill = $q(spPr, 'noFill');
  if (!noFill) {
    // Solid fill
    const c = solidClr(spPr, tc);
    if (c) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }

    // Gradient fill (when no solid)
    if (!c) {
      const gf = $q(spPr, 'gradFill');
      if (gf) {
        const gsLst = $kid(gf, 'gsLst');
        const stops = gsLst ? $kids(gsLst, 'gs') : [];
        if (stops.length >= 2) {
          const lin = $q(gf, 'lin');
          const angDeg = parseInt(lin?.getAttribute('ang') || 0) / 60000;
          const rad = (angDeg - 90) * Math.PI / 180;
          const d = Math.sqrt(w ** 2 + h ** 2) / 2;
          const grd = ctx.createLinearGradient(
            x + w/2 - Math.cos(rad)*d, y + h/2 - Math.sin(rad)*d,
            x + w/2 + Math.cos(rad)*d, y + h/2 + Math.sin(rad)*d,
          );
          for (const st of stops) {
            const pos = parseInt(st.getAttribute('pos') || 0) / 100000;
            const sc = solidClr(st, tc) || '#000000';
            try { grd.addColorStop(pos, sc); } catch {}
          }
          ctx.fillStyle = grd;
          ctx.fillRect(x, y, w, h);
        }
      }
    }
  }

  // Stroke
  const ln = $kid(spPr, 'ln');
  if (ln && !$q(ln, 'noFill')) {
    const lc = solidClr(ln, tc);
    if (lc) {
      const lw = Math.max(0.5, EMU(ln.getAttribute('w') || 12700, Math.min(sx, sy)));
      ctx.strokeStyle = lc;
      ctx.lineWidth = lw;
      ctx.strokeRect(x, y, w, h);
    }
  }

  ctx.restore();

  // Text (drawn after shape fill, outside the rotation clip so it renders cleanly)
  const txBody = $kid(el, 'txBody');
  if (txBody) {
    ctx.save();
    if (xf.rot) {
      ctx.translate(x + w / 2, y + h / 2);
      ctx.rotate(xf.rot * Math.PI / 10800000);
      ctx.translate(-(x + w / 2), -(y + h / 2));
    }
    drawTxBody(ctx, txBody, x, y, w, h, sx, sy, tc);
    ctx.restore();
  }
}

// ─── Picture (p:pic) ──────────────────────────────────────────────────────────

async function drawPic(ctx, el, zip, rels, baseDir, sx, sy) {
  const spPr = $kid(el, 'spPr');
  if (!spPr) return;
  const xf = getXfrm(spPr);
  if (!xf) return;

  const bf = $kid(el, 'blipFill');
  if (!bf) return;
  const blip = $kid(bf, 'blip');
  if (!blip) return;

  let rId = blip.getAttributeNS(REL_NS, 'embed');
  if (!rId) {
    // Fallback: scan attributes for one with localName 'embed'
    for (const attr of blip.attributes) {
      if (attr.localName === 'embed') { rId = attr.value; break; }
    }
  }
  if (!rId || !rels[rId]) return;

  const imgPath = joinPath(baseDir, rels[rId]);
  const img = await loadZipImg(zip, imgPath);
  if (!img) return;

  const x = EMU(xf.x, sx), y = EMU(xf.y, sy);
  const w = EMU(xf.cx, sx), h = EMU(xf.cy, sy);

  ctx.save();
  if (xf.rot) {
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(xf.rot * Math.PI / 10800000);
    ctx.translate(-(x + w / 2), -(y + h / 2));
  }

  // Crop (srcRect)
  const sr = $kid(bf, 'srcRect');
  if (sr) {
    const l  = parseInt(sr.getAttribute('l') || 0) / 100000;
    const t  = parseInt(sr.getAttribute('t') || 0) / 100000;
    const rv = parseInt(sr.getAttribute('r') || 0) / 100000;
    const bv = parseInt(sr.getAttribute('b') || 0) / 100000;
    const sw = img.width  * (1 - l - rv);
    const sh = img.height * (1 - t - bv);
    if (sw > 0 && sh > 0) {
      ctx.drawImage(img, img.width * l, img.height * t, sw, sh, x, y, w, h);
    }
  } else {
    ctx.drawImage(img, x, y, w, h);
  }
  ctx.restore();
}

// ─── Shape tree (recursive, handles group shapes) ────────────────────────────

async function drawSpTree(ctx, tree, zip, rels, baseDir, sx, sy, tc) {
  if (!tree) return;
  const nodes = Array.from(tree.childNodes);
for (const el of nodes) {
    if (el.nodeType !== 1) continue;
    switch (el.localName) {
      case 'sp':    await drawSp  (ctx, el, zip, rels, baseDir, sx, sy, tc); break;
      case 'pic':   await drawPic (ctx, el, zip, rels, baseDir, sx, sy);     break;
      case 'grpSp': await drawSpTree(ctx, el, zip, rels, baseDir, sx, sy, tc); break;
      // graphicFrame (tables / charts) intentionally skipped
    }
  }
}

// ─── Render a single slide → JPEG data-URL ───────────────────────────────────

async function renderSlide(
  zip, slideFile,
  masterBg, masterRels, masterBase,
  layoutBg, layoutRels, layoutBase,
  slideW, slideH, tc,
) {
  const canvas = document.createElement('canvas');
  canvas.width  = RENDER_W;
  canvas.height = RENDER_H;
  const ctx = canvas.getContext('2d');
  console.log("START render:", slideFile);

  const slideWpx = slideW / 9525;
  const slideHpx = slideH / 9525;
  const sx = RENDER_W / slideWpx;
  const sy = RENDER_H / slideHpx;

  const xml = await zip.file(slideFile)?.async('text');
  if (!xml) return null;

  const doc      = new DOMParser().parseFromString(xml, 'text/xml');
  const slideRels = await loadRels(zip, relsFor(slideFile));
  const baseDir  = slideFile.replace(/[^/]+$/, '');

  // Default background
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, RENDER_W, RENDER_H);

  // Background cascade
  const slideBg = $kid($q(doc, 'cSld'), 'bg');
  let bgDone = false;
  if (slideBg) bgDone = await drawBg(ctx, slideBg, zip, slideRels, baseDir, tc);
  if (!bgDone && layoutBg) bgDone = await drawBg(ctx, layoutBg, zip, layoutRels, layoutBase, tc);
  if (!bgDone && masterBg) bgDone = await drawBg(ctx, masterBg, zip, masterRels, masterBase, tc);
  if (!bgDone) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, RENDER_W, RENDER_H); }

  // Shapes
  const cSld = $q(doc, 'cSld');
const spTree = cSld ? $kid(cSld, 'spTree') : null;
  await drawSpTree(ctx, spTree, zip, slideRels, baseDir, sx, sy, tc);
  console.log("Rendering shapes done:", slideFile);
await new Promise(r => setTimeout(r, 0));

  await new Promise(r => setTimeout(r, 50));
console.log("Rendering slide done:", slideFile);

console.log("FINISHED render:", slideFile);

return canvas.toDataURL('image/jpeg', 0.85);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse a .pptx File/Blob and render all slides to canvas images.
 *
 * @param {File} file          The .pptx file selected by the user
 * @param {Function} onProgress  Called with 0–100 as each slide finishes
 * @returns {Promise<{ title: string, slides: Array }>}
 */
export async function parsePptxFile(file, onProgress) {
  _imgCache.clear();

  const zip = await JSZip.loadAsync(file);

  // ── Presentation XML ───────────────────────────────────────────
  const presXml = await zip.file('ppt/presentation.xml')?.async('text');
  if (!presXml) throw new Error('Not a valid PPTX file (missing ppt/presentation.xml).');
  const presDoc = new DOMParser().parseFromString(presXml, 'text/xml');

  // Slide canvas dimensions
  const sldSz = $q(presDoc, 'sldSz');
  const slideW = parseInt(sldSz?.getAttribute('cx') || 9144000);
  const slideH = parseInt(sldSz?.getAttribute('cy') || 6858000);

  // ── Slide file order from presentation rels ────────────────────
  const presRels  = await loadRels(zip, 'ppt/_rels/presentation.xml.rels');
  const sldIdLst  = $q(presDoc, 'sldIdLst');
  const sldIdEls  = sldIdLst ? $kids(sldIdLst, 'sldId') : [];

  const slideFiles = sldIdEls.map(el => {
    // r:id attribute — namespace-safe
    let rid = el.getAttributeNS(REL_NS, 'id');
    if (!rid) {
      for (const attr of el.attributes) {
        if (attr.localName === 'id' && attr.value.startsWith('rId')) { rid = attr.value; break; }
      }
    }
    const target = rid && presRels[rid];
    if (!target) return null;
    return target.startsWith('ppt/')
  ? target
  : 'ppt/' + target.replace(/^\//, '');
  }).filter(Boolean);

  // Fallback: enumerate slide files directly when rels parsing fails
  if (!slideFiles.length) {
    let i = 1;
    while (zip.file(`ppt/slides/slide${i}.xml`)) {
      slideFiles.push(`ppt/slides/slide${i}.xml`);
      i++;
    }
  }

  if (!slideFiles.length) throw new Error('No slides found in this PPTX file.');

  // ── Master ─────────────────────────────────────────────────────
  const masterEntry = Object.entries(presRels).find(([, v]) => v.includes('slideMaster'));
  const masterFile  = masterEntry
    ? 'ppt/' + masterEntry[1].replace(/^\//, '').replace(/^ppt\//, '')
    : 'ppt/slideMasters/slideMaster1.xml';
  const masterBase  = masterFile.replace(/[^/]+$/, '');

  const masterXml = await zip.file(masterFile)?.async('text');
  let masterBg = null, masterRels = {};
  let tc = {};

  if (masterXml) {
    const mDoc = new DOMParser().parseFromString(masterXml, 'text/xml');
    masterBg   = $kid($q(mDoc, 'cSld'), 'bg');
    masterRels = await loadRels(zip, relsFor(masterFile));

    const themeEntry = Object.entries(masterRels).find(([, v]) => v.includes('theme'));
    if (themeEntry) tc = await loadTheme(zip, joinPath(masterFile, themeEntry[1]));
  }
  // Fallback theme
  if (!Object.keys(tc).length) tc = await loadTheme(zip, 'ppt/theme/theme1.xml');

  // ── Render each slide ──────────────────────────────────────────
  const slides = [];

  for (let i = 0; i < slideFiles.length; i++) {
    const sf = slideFiles[i];

    // Slide rels → layout
    const sRels      = await loadRels(zip, relsFor(sf));
    const layEntry   = Object.entries(sRels).find(([, v]) => v.includes('slideLayout'));
    let layoutBg = null, layoutRels = {}, layoutBase = '';

    if (layEntry) {
      const layoutFile = joinPath(sf, layEntry[1]);
      const layoutXml  = await zip.file(layoutFile)?.async('text');
      if (layoutXml) {
        const lDoc = new DOMParser().parseFromString(layoutXml, 'text/xml');
        layoutBg   = $kid($q(lDoc, 'cSld'), 'bg');
        layoutRels = await loadRels(zip, relsFor(layoutFile));
        layoutBase = layoutFile.replace(/[^/]+$/, '');
      }
    }

    const dataUrl = await renderSlide(
      zip, sf,
      masterBg, masterRels, masterBase,
      layoutBg, layoutRels, layoutBase,
      slideW, slideH, tc,
    );

    if (dataUrl) {
  slides.push({
    id:           `pptx_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
    text:         '',
    textColor:    '#ffffff',
    pptxImageUrl: dataUrl,
    video:        dataUrl,
    videoFit:     'contain',
    isPptxSlide:  true,
  });
}

    onProgress?.(Math.round((i + 1) / slideFiles.length * 100));
  }

  return {
    title:  file.name.replace(/\.pptx$/i, ''),
    slides,
  };
}