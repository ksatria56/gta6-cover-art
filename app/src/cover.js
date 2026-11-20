// Vice Cover Studio — cover render engine.
// Draws a multi-panel, neon-sunset poster onto any canvas at any size.
// Pure canvas 2D, no network, no libraries. Fonts are the vendored OFL
// Anton (bold condensed titles) and Pacifico (neon script subtitles).

export const SIZES = {
  square: { w: 1080, h: 1080, label: '1080 × 1080 · Square' },
  portrait: { w: 1080, h: 1350, label: '1080 × 1350 · Portrait' },
  wide: { w: 1920, h: 1080, label: '1920 × 1080 · Wide' },
  story: { w: 1080, h: 1920, label: '1080 × 1920 · Story' },
};

export const LAYOUTS = {
  grid: { name: 'Four Corners', blurb: '2 × 2 panels + title band' },
  hero: { name: 'Hero + Three', blurb: 'one big moment, three small ones' },
  fullbleed: { name: 'Full Bleed', blurb: 'one photo edge to edge' },
  tilted: { name: 'Snapshot Stack', blurb: 'tilted polaroids on sunset' },
  strip: { name: 'Film Strip', blurb: 'three stacked bands' },
  neon: { name: 'Neon Grid', blurb: 'tall hero centre, stacked left, rail right' },
};

// A grade is a sunset sky, a sun, and the tint the photos get.
export const GRADES = {
  sunset: {
    name: 'Vice Sunset',
    sky: ['#1d0b4b', '#7b1e6e', '#ff5e62', '#ff9a3d', '#ffd319'],
    sun: ['#fff3a3', '#ffb347', '#ff2e88'],
    tint: '#ff7a4d', tintAlpha: 0.20, cool: '#3b2a8f', coolAlpha: 0.14,
    glow: '#ff2e88',
  },
  neon: {
    name: 'Neon Nights',
    sky: ['#050b2e', '#123a7a', '#0e7c86', '#2de2e6', '#ff2e88'],
    sun: ['#d8fbff', '#2de2e6', '#ff2e88'],
    tint: '#2de2e6', tintAlpha: 0.18, cool: '#120a4d', coolAlpha: 0.2,
    glow: '#2de2e6',
  },
  gold: {
    name: 'Golden Hour',
    sky: ['#2b1608', '#7a3b12', '#d97b2b', '#f7b733', '#fff1a8'],
    sun: ['#fffbe0', '#ffd319', '#ff7a18'],
    tint: '#ffb347', tintAlpha: 0.22, cool: '#5b2d12', coolAlpha: 0.12,
    glow: '#ffd319',
  },
  noir: {
    name: 'Palm Noir',
    sky: ['#04060f', '#0d1b2e', '#123f4d', '#1f7a6d', '#ffd319'],
    sun: ['#ffffff', '#cfe8ff', '#ffd319'],
    tint: '#9fd8ff', tintAlpha: 0.14, cool: '#06121f', coolAlpha: 0.24,
    glow: '#ffd319',
  },
  candy: {
    name: 'Bubblegum',
    sky: ['#2e0a4d', '#8a1e7a', '#ff2e88', '#ff7ab8', '#ffe3f1'],
    sun: ['#ffffff', '#ffd319', '#ff2e88'],
    tint: '#ff2e88', tintAlpha: 0.20, cool: '#4d0a5e', coolAlpha: 0.16,
    glow: '#ff7ab8',
  },
};

export function defaultState() {
  return {
    layout: 'hero',
    grade: 'sunset',
    size: 'square',
    title: 'Sunset Heist',
    subtitle: 'vice city nights',
    tagline: 'ONE LAST SCORE · SUMMER 2026',
    sun: true,
    palms: true,
    grain: true,
    vignette: true,
    frame: true,
    // per-panel photo slot (0..3), zoom and pan live on the slots instead.
    panels: [0, 1, 0, 1],
    activePanel: 0,
  };
}

export function defaultSlots() {
  return [
    { img: null, name: 'Photo 1', zoom: 1.2, ox: 0, oy: 0 },
    { img: null, name: 'Photo 2', zoom: 1.2, ox: 0, oy: 0 },
    { img: null, name: 'Photo 3', zoom: 1.2, ox: 0, oy: 0 },
    { img: null, name: 'Photo 4', zoom: 1.2, ox: 0, oy: 0 },
  ];
}

// ---------------------------------------------------------------- panels

// Panel rects as fractions of the canvas, per layout and aspect.
// Every layout returns 4 rects; layouts that show fewer photos reuse
// rects (a rect of zero area is skipped).
function panelRects(layout, w, h) {
  const sq = w / h;
  if (layout === 'grid') {
    const band = h * 0.3;
    const top = h - band;
    const gap = Math.round(w * 0.012);
    const cw = (w - gap * 3) / 2;
    const ch = (top - gap * 3) / 2;
    return [
      { x: gap, y: gap, w: cw, h: ch },
      { x: gap * 2 + cw, y: gap, w: cw, h: ch },
      { x: gap, y: gap * 2 + ch, w: cw, h: ch },
      { x: gap * 2 + cw, y: gap * 2 + ch, w: cw, h: ch },
    ];
  }
  if (layout === 'hero') {
    const gap = Math.round(w * 0.012);
    if (sq >= 1.4) {
      // wide: hero left, three stacked right
      const heroW = w * 0.62;
      const sideW = w - heroW - gap * 2;
      const sh = (h - gap * 4) / 3;
      return [
        { x: gap, y: gap, w: heroW - gap, h: h - gap * 2 },
        { x: heroW + gap, y: gap, w: sideW, h: sh },
        { x: heroW + gap, y: gap * 2 + sh, w: sideW, h: sh },
        { x: heroW + gap, y: gap * 3 + sh * 2, w: sideW, h: sh },
      ];
    }
    // square / portrait: hero on top, three across the bottom
    const heroH = h * (sq > 1 ? 0.6 : 0.58);
    const stripH = h - heroH - gap * 3;
    const sw = (w - gap * 4) / 3;
    return [
      { x: gap, y: gap, w: w - gap * 2, h: heroH - gap },
      { x: gap, y: heroH + gap, w: sw, h: stripH },
      { x: gap * 2 + sw, y: heroH + gap, w: sw, h: stripH },
      { x: gap * 3 + sw * 2, y: heroH + gap, w: sw, h: stripH },
    ];
  }
  if (layout === 'fullbleed') {
    return [
      { x: 0, y: 0, w, h },
      { x: 0, y: 0, w: 0, h: 0 },
      { x: 0, y: 0, w: 0, h: 0 },
      { x: 0, y: 0, w: 0, h: 0 },
    ];
  }
  if (layout === 'tilted') {
    // Three tilted polaroids; the fourth rect is the backdrop itself.
    const pw = w * 0.42;
    const ph = h * 0.46;
    return [
      { x: w * 0.06, y: h * 0.1, w: pw, h: ph, tilt: -0.09 },
      { x: w * 0.5, y: h * 0.06, w: pw, h: ph, tilt: 0.07 },
      { x: w * 0.28, y: h * 0.44, w: pw, h: ph, tilt: -0.03 },
      { x: 0, y: 0, w: 0, h: 0 },
    ];
  }
  if (layout === 'neon') {
    // Neon Grid: two stacked panels left, tall hero centre, tall rail
    // right — a downtown grid above the title band.
    const photoH = h * 0.72;
    const leftW = w * 0.28;
    const centreW = w * 0.4;
    const rightW = w - leftW - centreW - gap * 4;
    const halfH = (photoH - gap * 3) / 2;
    return [
      { x: gap, y: gap, w: leftW, h: halfH },
      { x: gap, y: gap * 2 + halfH, w: leftW, h: halfH },
      { x: gap * 2 + leftW, y: gap, w: centreW, h: photoH - gap * 2 },
      { x: gap * 3 + leftW + centreW, y: gap, w: rightW, h: photoH - gap * 2 },
    ];
  }
  // strip: three horizontal bands + one spare rect for the title zone.
  const gap = Math.round(w * 0.012);
  const bh = (h * 0.72 - gap * 4) / 3;
  return [
    { x: gap, y: gap, w: w - gap * 2, h: bh },
    { x: gap, y: gap * 2 + bh, w: w - gap * 2, h: bh },
    { x: gap, y: gap * 3 + bh * 2, w: w - gap * 2, h: bh },
    { x: 0, y: 0, w: 0, h: 0 },
  ];
}

function titleZone(layout, w, h) {
  if (layout === 'grid') return { x: 0, y: h * 0.7, w, h: h * 0.3 };
  if (layout === 'hero') {
    return w / h >= 1.4
      ? { x: 0, y: h * 0.78, w: w * 0.62, h: h * 0.22 }
      : { x: 0, y: h * 0.56, w, h: h * 0.2 };
  }
  if (layout === 'fullbleed') return { x: 0, y: h * 0.62, w, h: h * 0.38 };
  if (layout === 'tilted') return { x: 0, y: h * 0.82, w, h: h * 0.18 };
  if (layout === 'neon') return { x: 0, y: h * 0.72, w, h: h * 0.28 };
  return { x: 0, y: h * 0.72, w, h: h * 0.28 }; // strip
}

// ---------------------------------------------------------------- drawing

function drawCoverPhoto(ctx, img, r, slot) {
  if (!img || r.w <= 0 || r.h <= 0) return;
  const zoom = slot?.zoom ?? 1.2;
  const ox = slot?.ox ?? 0;
  const oy = slot?.oy ?? 0;
  const scale = Math.max(r.w / img.naturalWidth, r.h / img.naturalHeight) * zoom;
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const dx = r.x + (r.w - dw) / 2 + ox * r.w * 0.45;
  const dy = r.y + (r.h - dh) / 2 + oy * r.h * 0.45;
  ctx.drawImage(img, dx, dy, dw, dh);
}

function gradeWash(ctx, r, grade) {
  if (r.w <= 0 || r.h <= 0) return;
  const g = ctx.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
  g.addColorStop(0, grade.cool);
  g.addColorStop(1, grade.tint);
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = grade.tintAlpha + grade.coolAlpha;
  ctx.fillStyle = g;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = g;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.restore();
}

function skyGradient(ctx, w, h, grade) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  const stops = grade.sky;
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}

function retroSun(ctx, cx, cy, radius, grade) {
  const off = document.createElement('canvas');
  off.width = Math.max(2, Math.ceil(radius * 2));
  off.height = Math.max(2, Math.ceil(radius * 2));
  const o = off.getContext('2d');
  const g = o.createLinearGradient(0, 0, 0, off.height);
  grade.sun.forEach((c, i) => g.addColorStop(i / (grade.sun.length - 1), c));
  o.fillStyle = g;
  o.beginPath();
  o.arc(radius, radius, radius, 0, Math.PI * 2);
  o.fill();
  // Slits across the lower half, growing thicker toward the bottom.
  o.globalCompositeOperation = 'destination-out';
  let y = radius + radius * 0.08;
  let thick = Math.max(2, radius * 0.03);
  while (y < radius * 2) {
    o.fillRect(0, y, off.width, thick);
    y += thick + Math.max(6, radius * 0.12);
    thick *= 1.5;
  }
  ctx.save();
  ctx.shadowColor = grade.glow;
  ctx.shadowBlur = radius * 0.55;
  ctx.drawImage(off, cx - radius, cy - radius);
  ctx.restore();
}

function palmTree(ctx, x, y, s, lean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(lean);
  ctx.scale(s, s);
  ctx.fillStyle = 'rgba(12, 4, 28, 0.94)';
  // Trunk: a tapering curved strip from the ground to the crown.
  ctx.beginPath();
  ctx.moveTo(-9, 6);
  ctx.quadraticCurveTo(-16, -80, -2, -158);
  ctx.lineTo(10, -158);
  ctx.quadraticCurveTo(2, -80, 9, 6);
  ctx.closePath();
  ctx.fill();
  // Fronds: wide drooping leaves fanning from the crown.
  const crown = [4, -158];
  const spread = [-2.5, -2.0, -1.5, -1.0, -0.5, 0, 0.5, 1.0, 1.5, 2.0, 2.5];
  for (const a of spread) {
    const reach = 86 - Math.abs(a) * 10;
    const tipX = crown[0] + Math.sin(a) * reach;
    const tipY = crown[1] - Math.cos(a) * 26 + Math.abs(a) * 26;
    ctx.beginPath();
    ctx.moveTo(crown[0], crown[1]);
    ctx.quadraticCurveTo(
      crown[0] + Math.sin(a) * reach * 0.55, crown[1] - 34,
      tipX, tipY,
    );
    ctx.quadraticCurveTo(
      crown[0] + Math.sin(a) * reach * 0.5, crown[1] - 6,
      crown[0], crown[1] + 4,
    );
    ctx.closePath();
    ctx.fill();
  }
  // Coconuts under the crown.
  ctx.beginPath();
  ctx.arc(crown[0] - 5, crown[1] + 8, 6, 0, Math.PI * 2);
  ctx.arc(crown[0] + 6, crown[1] + 9, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

let grainTile = null;
function grain(ctx, w, h) {
  if (!grainTile) {
    grainTile = document.createElement('canvas');
    grainTile.width = 140;
    grainTile.height = 140;
    const g = grainTile.getContext('2d');
    const data = g.createImageData(140, 140);
    for (let i = 0; i < data.data.length; i += 4) {
      const v = Math.floor(Math.random() * 255);
      data.data[i] = v;
      data.data[i + 1] = v;
      data.data[i + 2] = v;
      data.data[i + 3] = 255;
    }
    g.putImageData(data, 0, 0);
  }
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = ctx.createPattern(grainTile, 'repeat');
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function vignette(ctx, w, h) {
  const g = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.42,
    w / 2, h / 2, Math.max(w, h) * 0.75,
  );
  g.addColorStop(0, 'rgba(10, 2, 24, 0)');
  g.addColorStop(1, 'rgba(10, 2, 24, 0.5)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function wrapLines(ctx, text, maxWidth) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawTitleBlock(ctx, state, grade, zone, w, h) {
  const cx = zone.x + zone.w / 2;
  const pad = Math.max(20, w * 0.02);
  const maxW = zone.w - pad * 2;
  const hasSub = state.subtitle.trim().length > 0;
  const hasTag = state.tagline.trim().length > 0;

  // Fit the whole stack (title lines + subtitle + tagline) inside the
  // zone: shrink the title until everything fits with breathing room.
  let size = Math.min(zone.h * 0.42, maxW * 0.22);
  let lines = [];
  let subSize = 0;
  let tagSize = 0;
  let total = Infinity;
  while (size > 20) {
    ctx.font = `${size}px Anton, 'Arial Black', sans-serif`;
    lines = wrapLines(ctx, state.title.toUpperCase(), maxW);
    const lineH = size * 0.98;
    subSize = hasSub ? Math.max(18, Math.min(size * 0.42, w * 0.04)) : 0;
    tagSize = hasTag ? Math.max(12, w * 0.016) : 0;
    total = lines.length * lineH
      + (hasSub ? size * 0.28 + subSize : 0)
      + (hasTag ? size * 0.3 + tagSize : 0);
    if (total <= zone.h * 0.94 || lines.length <= 1 && size <= 26) break;
    size *= 0.88;
  }
  const lineH = size * 0.98;
  const titleH = lines.length * lineH;
  let cursor = zone.y + (zone.h - total) / 2 + size * 0.42;

  // Main title: Anton, all caps, gradient fill, dark outline, slight tilt.
  ctx.save();
  ctx.translate(cx, cursor);
  ctx.rotate(-0.022);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${size}px Anton, 'Arial Black', sans-serif`;
  const grad = ctx.createLinearGradient(0, -titleH / 2 - size * 0.1, 0, titleH / 2 + size * 0.1);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.45, '#ffe95e');
  grad.addColorStop(1, grade.glow);
  lines.forEach((line, i) => {
    const y = (i - (lines.length - 1) / 2) * lineH;
    ctx.lineWidth = Math.max(4, size * 0.09);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(16, 4, 34, 0.95)';
    ctx.strokeText(line, 0, y);
    ctx.fillStyle = grad;
    ctx.fillText(line, 0, y);
    ctx.lineWidth = Math.max(1.5, size * 0.02);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.strokeText(line, 0, y);
  });
  ctx.restore();
  cursor += titleH / 2 + size * 0.28 + subSize / 2;

  // Neon script subtitle under the title.
  if (hasSub) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${subSize}px Pacifico, cursive`;
    ctx.lineWidth = Math.max(2, subSize * 0.14);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(16, 4, 34, 0.85)';
    ctx.strokeText(state.subtitle, cx, cursor);
    ctx.shadowColor = grade.glow;
    ctx.shadowBlur = subSize * 0.55;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(state.subtitle, cx, cursor);
    ctx.shadowBlur = 0;
    ctx.fillStyle = grade.glow;
    ctx.globalAlpha = 0.85;
    ctx.fillText(state.subtitle, cx, cursor);
    ctx.restore();
    cursor += subSize / 2 + size * 0.3 + tagSize / 2;
  }

  // Tagline: small tracked caps at the bottom of the stack.
  if (hasTag) {
    ctx.save();
    ctx.font = `700 ${tagSize}px 'Arial Narrow', Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const spaced = state.tagline.toUpperCase().split('').join(' ');
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.fillText(spaced, cx, cursor);
    ctx.restore();
  }
}

// ---------------------------------------------------------------- render

export function renderCover(canvas, state, slots) {
  const size = SIZES[state.size] ?? SIZES.square;
  const w = size.w;
  const h = size.h;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext('2d');
  const grade = GRADES[state.grade] ?? GRADES.sunset;
  const layout = state.layout;

  // Backdrop sky.
  ctx.fillStyle = skyGradient(ctx, w, h, grade);
  ctx.fillRect(0, 0, w, h);

  const rects = panelRects(layout, w, h);
  const zone = titleZone(layout, w, h);

  // Panels.
  const gap = Math.round(w * 0.012);
  rects.forEach((r, i) => {
    if (r.w <= 0 || r.h <= 0) return;
    ctx.save();
    if (r.tilt) {
      // Tilted polaroid: white card, shadow, photo inside.
      ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
      ctx.rotate(r.tilt);
      ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
      ctx.shadowBlur = w * 0.02;
      ctx.shadowOffsetY = w * 0.008;
      ctx.fillStyle = '#fdf8ef';
      ctx.fillRect(-r.w / 2, -r.h / 2, r.w, r.h * 1.08);
      ctx.shadowColor = 'transparent';
      const inner = { x: -r.w / 2 + gap, y: -r.h / 2 + gap, w: r.w - gap * 2, h: r.h - gap * 2 };
      ctx.beginPath();
      ctx.rect(inner.x, inner.y, inner.w, inner.h);
      ctx.clip();
      const s2 = slots[state.panels[i] ?? 0];
      const iw = s2?.img?.naturalWidth ?? 1;
      const ih = s2?.img?.naturalHeight ?? 1;
      const zoom = s2?.zoom ?? 1.2;
      const scale = Math.max((r.w - gap * 2) / iw, (r.h - gap * 2) / ih) * zoom;
      const dw = iw * scale;
      const dh = ih * scale;
      const dx = inner.x + (inner.w - dw) / 2 + (s2?.ox ?? 0) * r.w * 0.45;
      const dy = inner.y + (inner.h - dh) / 2 + (s2?.oy ?? 0) * r.h * 0.45;
      if (s2?.img) ctx.drawImage(s2.img, dx, dy, dw, dh);
      gradeWash(ctx, { x: -r.w / 2 + gap, y: -r.h / 2 + gap, w: r.w - gap * 2, h: r.h - gap * 2 }, grade);
      ctx.restore();
      return;
    }
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    const slot = slots[state.panels[i] ?? 0];
    if (slot?.img) {
      drawCoverPhoto(ctx, slot.img, r, slot);
    } else {
      // Empty panel: deep dusk gradient with a placeholder glyph.
      const g = ctx.createLinearGradient(r.x, r.y, r.x + r.w, r.y + r.h);
      g.addColorStop(0, '#3d1a6e');
      g.addColorStop(1, '#12082b');
      ctx.fillStyle = g;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = `${Math.round(Math.min(r.w, r.h) * 0.16)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('＋', r.x + r.w / 2, r.y + r.h / 2);
    }
    gradeWash(ctx, r, grade);
    ctx.restore();
    // Panel divider glow.
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = Math.max(2, w * 0.002);
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.restore();
  });

  // Retro sun rising inside the title zone, behind the lettering.
  if (state.sun) {
    const sunR = Math.min(zone.w, zone.h) * 0.72;
    ctx.save();
    ctx.beginPath();
    ctx.rect(zone.x, zone.y, zone.w, zone.h);
    ctx.clip();
    retroSun(ctx, zone.x + zone.w / 2, zone.y + zone.h * 0.48, sunR, grade);
    ctx.restore();
  }

  // Title band scrim for layouts where the title sits over photos.
  if (layout === 'fullbleed' || (layout === 'hero' && w / h < 1.4)) {
    const g = ctx.createLinearGradient(0, zone.y - zone.h * 0.3, 0, h);
    g.addColorStop(0, 'rgba(10, 3, 26, 0)');
    g.addColorStop(1, 'rgba(10, 3, 26, 0.82)');
    ctx.fillStyle = g;
    ctx.fillRect(0, zone.y - zone.h * 0.3, w, h - zone.y + zone.h * 0.3);
  }
  if (layout === 'grid' || layout === 'strip' || layout === 'neon') {
    ctx.fillStyle = skyGradient(ctx, w, h, grade);
    ctx.fillRect(zone.x, zone.y, zone.w, zone.h);
  }

  // Palm silhouettes along the bottom edge.
  if (state.palms) {
    const s = (Math.min(w, h) / 1080) * 1.5;
    palmTree(ctx, w * 0.05, h * 1.0, s, -0.1);
    palmTree(ctx, w * 0.95, h * 1.0, s * 1.2, 0.12);
    if (layout !== 'tilted') palmTree(ctx, w * 0.87, h * 1.0, s * 0.85, 0.05);
  }

  drawTitleBlock(ctx, state, grade, zone, w, h);

  if (state.vignette) vignette(ctx, w, h);
  if (state.grain) grain(ctx, w, h);

  if (state.frame) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = Math.max(3, w * 0.004);
    ctx.strokeRect(w * 0.012, h * 0.012, w * 0.976, h * 0.976);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = Math.max(1, w * 0.001);
    ctx.strokeRect(w * 0.028, h * 0.028, w * 0.944, h * 0.944);
    ctx.restore();
  }

  // Small corner badge: original mark, not a game logo.
  ctx.save();
  ctx.font = `700 ${Math.max(13, w * 0.014)}px Arial, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.fillText('VICE COVER STUDIO', w * 0.035, h * 0.035);
  ctx.restore();

  return { rects, zone };
}

export function hitPanel(x, y, lastRects) {
  // x, y in canvas pixels; returns the panel index or -1.
  for (let i = lastRects.length - 1; i >= 0; i--) {
    const r = lastRects[i];
    if (r.w > 0 && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}
