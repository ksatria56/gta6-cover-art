// Vice Cover Studio — UI, state and export.
// Wires the controls in index.html to the cover engine in cover.js,
// keeps an undo/redo history, and exports PNGs at 1080x1080,
// 1080x1350 and 1920x1080. Also powers deterministic screenshot
// scenes (?shot=cover / ?shot=editor) for the entry's screenshots.

import {
  SIZES, LAYOUTS, GRADES,
  defaultState, defaultSlots, renderCover, hitPanel,
} from './cover.js';

const $ = (id) => document.getElementById(id);
const canvas = $('cover');
const query = new URLSearchParams(location.search);

const state = defaultState();
const slots = defaultSlots();
let lastRects = [];
let lastZone = null;

const past = [];
const future = [];

function snapshot() {
  return JSON.stringify({
    ...state,
    slots: slots.map((s) => ({ zoom: s.zoom, ox: s.ox, oy: s.oy, name: s.name })),
    panels: state.panels,
  });
}
function pushHistory() {
  past.push(snapshot());
  if (past.length > 60) past.shift();
  future.length = 0;
  syncUndoButtons();
}
function restoreSnapshot(json) {
  const data = JSON.parse(json);
  const keepSlots = slots.map((s) => s.img);
  Object.assign(state, data);
  state.panels = data.panels;
  data.slots.forEach((saved, i) => {
    Object.assign(slots[i], saved);
    slots[i].img = keepSlots[i];
  });
  syncAllControls();
  draw();
}
function undo() {
  if (!past.length) return;
  future.push(snapshot());
  restoreSnapshot(past.pop());
  syncUndoButtons();
}
function redo() {
  if (!future.length) return;
  past.push(snapshot());
  restoreSnapshot(future.pop());
  syncUndoButtons();
}
function syncUndoButtons() {
  $('undoBtn').disabled = past.length === 0;
  $('redoBtn').disabled = future.length === 0;
}

function draw() {
  const out = renderCover(canvas, state, slots);
  lastRects = out.rects;
  lastZone = out.zone;
  $('stageLabel').textContent = `Live preview · ${SIZES[state.size].label}`;
}

function setStatus(text) {
  $('status').textContent = text;
}

// ---------------------------------------------------------------- photos

function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('could not read that image')); };
    img.src = url;
  });
}

function loadSample(name) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`sample ${name} did not load`));
    img.src = `./samples/${name}.jpg`;
  });
}

async function fillSlot(i, img, name) {
  slots[i].img = img;
  slots[i].name = name;
  slots[i].zoom = 1.2;
  slots[i].ox = 0;
  slots[i].oy = 0;
  renderSlots();
  draw();
}

function renderSlots() {
  const host = $('slots');
  host.innerHTML = '';
  slots.forEach((slot, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `slot${slot.img ? ' filled' : ''}`;
    button.title = slot.img ? `${slot.name} — click to replace` : `Add photo ${i + 1}`;
    button.innerHTML = `<span class="num">${i + 1}</span>` +
      (slot.img ? '' : '<span class="plus">＋</span>');
    if (slot.img) {
      const thumb = document.createElement('img');
      thumb.alt = slot.name;
      thumb.src = slot.img.src;
      button.appendChild(thumb);
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      pushHistory();
      try {
        await fillSlot(i, await loadImageFile(file), file.name);
        setStatus(`${file.name} loaded into photo ${i + 1}.`);
      } catch {
        setStatus('That file could not be read as an image.');
      }
      input.value = '';
    });
    button.appendChild(input);
    button.addEventListener('click', (event) => {
      if (event.target !== input) input.click();
    });
    host.appendChild(button);
  });
}

// ---------------------------------------------------------------- controls

function buildChoices() {
  const layouts = $('layoutChoices');
  layouts.innerHTML = '';
  for (const [key, layout] of Object.entries(LAYOUTS)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = layout.name;
    b.title = layout.blurb;
    b.setAttribute('aria-pressed', String(state.layout === key));
    b.addEventListener('click', () => {
      if (state.layout === key) return;
      pushHistory();
      state.layout = key;
      buildChoices();
      draw();
    });
    layouts.appendChild(b);
  }

  const grades = $('gradeChoices');
  grades.innerHTML = '';
  for (const [key, grade] of Object.entries(GRADES)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-pressed', String(state.grade === key));
    b.innerHTML = `<span class="dot" style="--a:${grade.sky[1]};--b:${grade.sky[3]}"></span>${grade.name}`;
    b.addEventListener('click', () => {
      if (state.grade === key) return;
      pushHistory();
      state.grade = key;
      buildChoices();
      draw();
    });
    grades.appendChild(b);
  }

  const sizes = $('sizeChoices');
  sizes.innerHTML = '';
  for (const [key, size] of Object.entries(SIZES)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = size.label;
    b.setAttribute('aria-pressed', String(state.size === key));
    b.addEventListener('click', () => {
      if (state.size === key) return;
      pushHistory();
      state.size = key;
      buildChoices();
      draw();
    });
    sizes.appendChild(b);
  }
}

function syncPanelEditor() {
  const i = state.activePanel;
  $('panelTitle').textContent = `Panel ${i + 1} · ${LAYOUTS[state.layout].name}`;
  const select = $('panelPhoto');
  select.innerHTML = '';
  slots.forEach((slot, si) => {
    const option = document.createElement('option');
    option.value = String(si);
    option.textContent = slot.img ? `${si + 1} · ${slot.name}` : `${si + 1} · (empty)`;
    select.appendChild(option);
  });
  select.value = String(state.panels[i] ?? 0);
  const slot = slots[state.panels[i] ?? 0];
  $('zoomSlider').value = String(slot?.zoom ?? 1.2);
  $('panXSlider').value = String(slot?.ox ?? 0);
  $('panYSlider').value = String(slot?.oy ?? 0);
  $('zoomVal').textContent = `${(slot?.zoom ?? 1.2).toFixed(2)}×`;
}

function syncAllControls() {
  $('titleInput').value = state.title;
  $('subtitleInput').value = state.subtitle;
  $('taglineInput').value = state.tagline;
  $('sunToggle').checked = state.sun;
  $('palmsToggle').checked = state.palms;
  $('grainToggle').checked = state.grain;
  $('vignetteToggle').checked = state.vignette;
  $('frameToggle').checked = state.frame;
  buildChoices();
  syncPanelEditor();
}

function bindControls() {
  $('titleInput').addEventListener('input', (e) => { state.title = e.target.value; draw(); });
  $('titleInput').addEventListener('change', pushHistory);
  $('subtitleInput').addEventListener('input', (e) => { state.subtitle = e.target.value; draw(); });
  $('subtitleInput').addEventListener('change', pushHistory);
  $('taglineInput').addEventListener('input', (e) => { state.tagline = e.target.value; draw(); });
  $('taglineInput').addEventListener('change', pushHistory);

  const toggles = [
    ['sunToggle', 'sun'], ['palmsToggle', 'palms'], ['grainToggle', 'grain'],
    ['vignetteToggle', 'vignette'], ['frameToggle', 'frame'],
  ];
  for (const [id, key] of toggles) {
    $(id).addEventListener('change', (e) => {
      pushHistory();
      state[key] = e.target.checked;
      draw();
    });
  }

  $('undoBtn').addEventListener('click', undo);
  $('redoBtn').addEventListener('click', redo);
  $('shuffleBtn').addEventListener('click', () => {
    pushHistory();
    const layoutKeys = Object.keys(LAYOUTS);
    const gradeKeys = Object.keys(GRADES);
    state.layout = layoutKeys[Math.floor(Math.random() * layoutKeys.length)];
    state.grade = gradeKeys[Math.floor(Math.random() * gradeKeys.length)];
    const filled = slots.map((s, i) => (s.img ? i : -1)).filter((i) => i >= 0);
    if (filled.length) {
      state.panels = state.panels.map(() => filled[Math.floor(Math.random() * filled.length)]);
    }
    buildChoices();
    syncPanelEditor();
    draw();
    setStatus(`Shuffled: ${LAYOUTS[state.layout].name} × ${GRADES[state.grade].name}.`);
  });

  $('panelPhoto').addEventListener('change', (e) => {
    pushHistory();
    state.panels[state.activePanel] = Number(e.target.value);
    syncPanelEditor();
    draw();
  });
  $('zoomSlider').addEventListener('input', (e) => {
    const slot = slots[state.panels[state.activePanel] ?? 0];
    if (!slot) return;
    slot.zoom = Number(e.target.value);
    $('zoomVal').textContent = `${slot.zoom.toFixed(2)}×`;
    draw();
  });
  $('zoomSlider').addEventListener('change', pushHistory);
  $('panXSlider').addEventListener('input', (e) => {
    const slot = slots[state.panels[state.activePanel] ?? 0];
    if (!slot) return;
    slot.ox = Number(e.target.value);
    draw();
  });
  $('panXSlider').addEventListener('change', pushHistory);
  $('panYSlider').addEventListener('input', (e) => {
    const slot = slots[state.panels[state.activePanel] ?? 0];
    if (!slot) return;
    slot.oy = Number(e.target.value);
    draw();
  });
  $('panYSlider').addEventListener('change', pushHistory);

  $('samplePier').addEventListener('click', async () => {
    pushHistory();
    await fillSlot(0, await loadSample('pier'), 'Pier (sample)');
    await fillSlot(1, await loadSample('boulevard'), 'Boulevard (sample)');
    setStatus('Sample photos loaded — swap in your own any time.');
  });
  $('sampleBoulevard').addEventListener('click', async () => {
    pushHistory();
    await fillSlot(0, await loadSample('boulevard'), 'Boulevard (sample)');
    setStatus('Sample photo loaded.');
  });

  // Drag to pan, wheel to zoom, click to pick a panel.
  let dragging = null;
  let dragBefore = null;
  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }
  canvas.addEventListener('pointerdown', (event) => {
    const p = canvasPoint(event);
    const panel = hitPanel(p.x, p.y, lastRects);
    if (panel < 0) return;
    state.activePanel = panel;
    syncPanelEditor();
    dragBefore = snapshot();
    dragging = { panel, x: p.x, y: p.y, moved: false };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const p = canvasPoint(event);
    const slot = slots[state.panels[dragging.panel] ?? 0];
    if (!slot?.img) return;
    const r = lastRects[dragging.panel];
    if (!r || r.w <= 0) return;
    const dx = (p.x - dragging.x) / r.w;
    const dy = (p.y - dragging.y) / r.h;
    if (Math.abs(dx) + Math.abs(dy) > 0.005) dragging.moved = true;
    slot.ox = Math.max(-0.5, Math.min(0.5, slot.ox + dx * 0.9));
    slot.oy = Math.max(-0.5, Math.min(0.5, slot.oy + dy * 0.9));
    dragging.x = p.x;
    dragging.y = p.y;
    syncPanelEditor();
    draw();
  });
  canvas.addEventListener('pointerup', () => {
    if (dragging?.moved && dragBefore) {
      past.push(dragBefore);
      if (past.length > 60) past.shift();
      future.length = 0;
      syncUndoButtons();
    }
    dragBefore = null;
    dragging = null;
  });
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    const p = canvasPoint(event);
    const panel = hitPanel(p.x, p.y, lastRects);
    if (panel < 0) return;
    const slot = slots[state.panels[panel] ?? 0];
    if (!slot?.img) return;
    state.activePanel = panel;
    slot.zoom = Math.max(1, Math.min(2.6, slot.zoom - Math.sign(event.deltaY) * 0.08));
    syncPanelEditor();
    draw();
  }, { passive: false });

  $('exportOne').addEventListener('click', () => exportPng(state.size));
  $('exportAll').addEventListener('click', exportAllPngs);
}

// ---------------------------------------------------------------- export

function renderToCanvas(sizeKey) {
  const off = document.createElement('canvas');
  const keep = state.size;
  state.size = sizeKey;
  renderCover(off, state, slots);
  state.size = keep;
  return off;
}

function downloadCanvas(off, filename) {
  return new Promise((resolve) => {
    off.toBlob((blob) => {
      if (!blob) { resolve(false); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      resolve(true);
    }, 'image/png');
  });
}

async function exportPng(sizeKey) {
  const size = SIZES[sizeKey];
  const off = renderToCanvas(sizeKey);
  const ok = await downloadCanvas(off, `vice-cover-${sizeKey}-${size.w}x${size.h}.png`);
  setStatus(ok
    ? `Exported ${size.w} × ${size.h} PNG.`
    : 'Export failed — try again.');
}

async function exportAllPngs() {
  setStatus('Exporting all three sizes…');
  for (const key of Object.keys(SIZES)) {
    const size = SIZES[key];
    const off = renderToCanvas(key);
    await downloadCanvas(off, `vice-cover-${key}-${size.w}x${size.h}.png`);
    await new Promise((r) => setTimeout(r, 350));
  }
  setStatus('Done — three PNGs: 1080 × 1080, 1080 × 1350, 1920 × 1080.');
}

// Test hook used by the maker's own checks: renders all three sizes and
// reports their real pixel dimensions and PNG magic bytes.
async function probeExports() {
  const results = [];
  for (const key of Object.keys(SIZES)) {
    const off = renderToCanvas(key);
    const blob = await new Promise((resolve) => off.toBlob(resolve, 'image/png'));
    const head = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
    const pngMagic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
      .every((b, i) => head[i] === b);
    results.push({ size: key, w: off.width, h: off.height, bytes: blob.size, pngMagic });
  }
  return results;
}
window.__probeExports = probeExports;

// ---------------------------------------------------------------- shots

async function runShot() {
  const shot = query.get('shot');
  if (!shot) return false;
  const photo = query.get('photo') ?? 'pier';
  const caption = query.get('caption') ?? 'Sunset Heist';
  if (query.get('layout')) state.layout = query.get('layout');
  if (query.get('grade')) state.grade = query.get('grade');
  if (query.get('size')) state.size = query.get('size');
  if (query.get('subtitle') !== null) state.subtitle = query.get('subtitle');
  if (query.get('tagline') !== null) state.tagline = query.get('tagline');
  state.title = caption;
  try {
    await document.fonts.load('90px Anton');
    await document.fonts.load('40px Pacifico');
    await document.fonts.ready;
  } catch { /* fall back to system fonts */ }
  try {
    await fillSlot(0, await loadSample(photo), `${photo} (sample)`);
    await fillSlot(1, await loadSample(photo === 'pier' ? 'boulevard' : 'pier'), 'second sample');
  } catch (err) {
    setStatus(`Sample failed: ${err.message}`);
  }
  state.panels = [0, 1, 0, 1];
  if (state.layout === 'fullbleed') state.panels = [0, 0, 0, 0];
  if (state.layout === 'tilted') state.panels = [0, 1, 0, 0];
  syncAllControls();
  draw();
  if (shot === 'cover') document.body.classList.add('shot-cover');
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.__shotReady = true;
  return true;
}

// ---------------------------------------------------------------- boot

async function boot() {
  buildChoices();
  renderSlots();
  bindControls();
  syncAllControls();
  syncUndoButtons();
  const shotMode = await runShot();
  if (!shotMode) {
    // First visit: preload the pier sample so the preview is alive at once.
    try {
      await fillSlot(0, await loadSample('pier'), 'Pier (sample)');
      await fillSlot(1, await loadSample('boulevard'), 'Boulevard (sample)');
    } catch { /* editor still works with uploads */ }
    syncPanelEditor();
    draw();
  }
  draw();
}

boot();
