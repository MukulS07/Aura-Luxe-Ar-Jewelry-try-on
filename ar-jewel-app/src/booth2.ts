import type { MeasureState, Profile } from './tracking/measurer';
import { ScanOverlay } from './ui/scan-overlay';
import type { CatalogItem, JewelType } from './types';
import { preloadTracker, TryOn, type Hint } from './render/tryon';
import { swatch } from './ui/swatch';

/**
 * New-design booth (booth-v2.html): the camera, tracking and 3D jewelry from the app, in the redesigned screens.
 * Camera and tracking run only on the live screen and only after the privacy notice was accepted this session.
 * Upload and the QR code are still placeholders (backend step).
 */

const W = 1920,
  H = 1080;
const IDLE_WARN_MS = 45_000, // proposed, TODO(confirm)
  IDLE_RESET_S = 10,
  GUIDE_FADE_MS = 3500;

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;
const $$ = <T extends HTMLElement = HTMLElement>(s: string) => [...document.querySelectorAll<T>(s)];
const $in = <T extends HTMLElement = HTMLElement>(root: ParentNode, s: string) => root.querySelector<T>(s)!;

const HINTS: Record<Exclude<Hint, 'none'>, string> = {
  noface: 'Look at the camera and step a little closer',
  multi: "We're tracking the closest person",
  dark: "It's a bit dark. Face the light.",
};

let catalog: CatalogItem[] = [];
let cat: JewelType = 'earrings';
let cur: CatalogItem | undefined;
let tryon: TryOn | undefined;
let scanTry: TryOn | undefined; // camera and tracking for the scan screen (no jewelry)
let scanOverlay: ScanOverlay | undefined;
let profile: Profile | undefined; // this visitor's measurements, kept in memory until Start
let measured = false; // jewelry and the shutter wait for the measuring step
let noticeAccepted = false; // camera never starts without this (agent.md rule 2)
let photoUrl = '';
let idleT = 0,
  idleI = 0,
  guideT = 0;

// ---------- layout ----------
const stage = $('#stage');
/** Phones get a real-px portrait layout (CSS media query); the kiosk keeps the scaled 1920x1080 stage. */
const isPhone = () => matchMedia('(max-width: 820px)').matches;
const stageSize = () => (isPhone() ? { w: innerWidth, h: innerHeight } : { w: W, h: H });
const fit = () => {
  if (isPhone()) {
    stage.style.transform = '';
    return;
  }
  stage.style.transform = `translate(-50%,-50%) scale(${Math.min(innerWidth / W, innerHeight / H)})`;
};
let resizeT = 0;
addEventListener('resize', () => {
  fit();
  clearTimeout(resizeT);
  resizeT = window.setTimeout(onResize, 250);
});
fit();

// ---------- placeholder QR (not scannable until the upload step) ----------
function fakeQR(): string {
  const n = 29,
    cells: string[] = [];
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const finder = (x: number, y: number): number | null => {
    for (const [ox, oy] of [
      [0, 0],
      [n - 7, 0],
      [0, n - 7],
    ]) {
      const dx = x - ox,
        dy = y - oy;
      if (dx >= 0 && dx < 7 && dy >= 0 && dy < 7)
        return dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4) ? 1 : 0;
      if (dx >= -1 && dx < 8 && dy >= -1 && dy < 8) return 0;
    }
    return null;
  };
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const f = finder(x, y);
      if (f === 1 || (f === null && rnd() > 0.52)) cells.push(`<rect x="${x}" y="${y}" width="1.02" height="1.02"/>`);
    }
  return `<svg viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" fill="#111">${cells.join('')}</svg>`;
}
$$('[data-qr]').forEach((e) => (e.innerHTML = fakeQR()));

// ---------- catalog ----------
const list = () => catalog.filter((p) => p.type === cat);
const nice = (m: string) => m.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
const glyph = (p: CatalogItem) => `<svg class="ico"><use href="#i-${p.type === 'earrings' ? 'ear' : 'neck'}"/></svg>`;
/** Real thumbnail when there is one, else the material swatch. */
const paint = (el: HTMLElement, p: CatalogItem) => Object.assign(el.style, swatch(p));

async function loadCatalog() {
  try {
    const r = await fetch('/api/catalog');
    if (!r.ok) throw new Error(String(r.status));
    catalog = (await r.json()) as CatalogItem[];
  } catch {
    catalog = ((await (await fetch('/catalog.json')).json()) as CatalogItem[]).filter((p) => p.active);
  }
  cur = list()[0];
}

function renderPick() {
  $$('#cats .cat').forEach((b) => b.classList.toggle('on', b.dataset.cat === cat));
  const items = list();
  $('#secName').textContent = cat === 'earrings' ? 'Earrings' : 'Necklaces';
  $('#secCount').textContent = `${items.length} pieces`;
  $('#grid').innerHTML = items
    .map(
      (p) => `<button class="card" data-pick="${p.id}"><div class="th" data-th="${p.id}">${p.thumbnail ? '' : glyph(p)}</div>
      <div class="nm"></div><div class="mt">${nice(p.material)}</div></button>`,
    )
    .join('');
  items.forEach((p) => {
    const card = $(`[data-pick="${p.id}"]`);
    $in(card, '.nm').textContent = p.name;
    paint($in(card, '.th'), p);
  });
}

function renderStrip() {
  $$('.tab').forEach((t) => t.classList.toggle('on', t.dataset.cat2 === cat));
  $('#strip').innerHTML = '';
  list().forEach((p) => {
    const b = document.createElement('button');
    b.className = `thumb${p.id === cur?.id ? ' on' : ''}`;
    b.dataset.sw = p.id;
    b.innerHTML = `<div class="t"></div><span></span>`;
    $in(b, 'span').textContent = p.name;
    paint($in(b, '.t'), p);
    $('#strip').append(b);
  });
  if (cur) {
    $('#liveName').textContent = cur.name;
    $('#liveMat').textContent = nice(cur.material);
    $('#liveNote').textContent = cur.story?.[0]?.text ?? 'Drawn to its real size on your own reflection.';
    $('#liveType').textContent = cur.type === 'earrings' ? 'Earrings' : 'Necklace';
    $('#craftBtn').style.display = cur.story?.length ? 'flex' : 'none';
  }
}

// ---------- screens ----------
/** Change screen with an iris wipe that opens from the last touch (falls back to a plain switch). */
function go(id: string) {
  if ((id === 'live' || id === 'scan') && !noticeAccepted) id = 'notice'; // camera only after the privacy notice
  const target = id;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!document.startViewTransition || reduced) return show(target);
  const t = document.startViewTransition(() => show(target));
  t.ready.catch(() => undefined);
  t.finished.catch(() => undefined);
}

function show(id: string) {
  $$('.screen').forEach((s) => s.classList.toggle('on', s.id === id));
  $$('.sheet-bg').forEach((s) => s.classList.remove('on'));
  $$('#dev button').forEach((b) => b.classList.toggle('on', b.dataset.go === id));
  clearInterval(idleI);
  if (id !== 'live') tryon?.stop(); // camera off everywhere except the scan and live screens
  if (id !== 'scan') scanTry?.stop();
  if (id === 'start') {
    replayOpening();
    noticeAccepted = false; // every session sees the notice
    profile = undefined; // and is measured again
    clearPhoto();
    clearTimeout(idleT);
  } else bump();
  if (id === 'notice') void preloadTracker().catch(() => undefined); // models load before the camera does
  if (id === 'photoS') phoneCopy();
  if (id === 'qrS') prepareDone();
  if (id === 'pick') renderPick();
  if (id === 'scan') void startScan();
  if (id === 'live') void startLive();
}

/** On a phone the photo stays on the phone: no upload, no QR. */
function phoneCopy() {
  $('#photoS [data-go="qrS"]').textContent = isPhone() ? 'Save photo' : 'Save & get link';
  $('#photoS .sub').textContent = isPhone()
    ? 'It stays on this phone. Nothing is uploaded.'
    : 'Saved only if you tap Save. Deleted after 24 hours.';
}

function prepareDone() {
  const dl = $<HTMLAnchorElement>('#dl');
  if (isPhone() && photoUrl) {
    dl.hidden = false;
    dl.href = photoUrl;
    $('#qrTitle').textContent = 'Your photo is ready';
    $('#qrCaption').textContent = 'Saved on this phone only. Nothing is uploaded.';
  } else {
    dl.hidden = true;
    $('#qrTitle').innerHTML = 'Scan to<br>take it home';
    $('#qrCaption').textContent = 'Link works for 24 hours.';
  }
}

function clearPhoto() {
  if (photoUrl) URL.revokeObjectURL(photoUrl);
  photoUrl = '';
  $('.frame .img').style.backgroundImage = '';
}

const bump = () => {
  clearTimeout(idleT);
  idleT = window.setTimeout(idle, IDLE_WARN_MS);
};
function idle() {
  let n = IDLE_RESET_S;
  $('#idleN').textContent = String(n);
  $('#idle').classList.add('on');
  const fg = $('.ring .fg');
  fg.style.animation = 'none';
  void fg.getBoundingClientRect();
  fg.style.animation = '';
  idleI = window.setInterval(() => {
    $('#idleN').textContent = String(--n);
    if (n <= 0) go('start');
  }, 1000);
}

// ---------- scan: face layout and measuring, before any jewelry ----------
const SCAN_NOTE: Record<MeasureState['hint'], string> = {
  none: 'Hold still, measuring…',
  noface: 'Look at the camera and step a little closer',
  turn: 'Look straight at the camera',
  shoulders: 'Step back a little so your shoulders are in view',
};
const mm = (v: number | undefined) => (v ? `≈ ${Math.round(v)} mm` : '–');
let valuesAt = 0;

function showScan(s: MeasureState) {
  $('#scan').classList.toggle('measuring', s.phase === 'measuring');
  $$('#scan .mlist li').forEach((li) => li.classList.toggle('ok', Boolean(s[li.dataset.m as 'face' | 'ears' | 'neck'])));
  $('#scanFill').style.transform = `scaleX(${s.progress})`;
  const go = $<HTMLButtonElement>('#scanContinue');
  if (s.phase === 'ready' && s.profile) {
    profile = s.profile;
    $('#vFace').textContent = mm(s.profile.faceWidthMm);
    $('#vEars').textContent = mm(s.profile.earSpanMm);
    $('#vNeck').textContent = s.profile.neckMm ? mm(s.profile.neckMm) : 'not in view';
    $('#scanNote').textContent = 'All set. Your fit is measured.';
    $('#scanChip').classList.add('hide');
    go.disabled = false;
  } else {
    profile = undefined; // lost the face for a while: measure again
    go.disabled = true;
    $('#scanNote').textContent = SCAN_NOTE[s.hint];
    $('#scanChipT').textContent = SCAN_NOTE[s.hint];
    $('#scanChip').classList.remove('hide');
  }
}

async function startScan() {
  const frame = $('#scanFrame');
  const w = frame.clientWidth,
    h = frame.clientHeight;
  if (!scanTry || scanTry.W !== w || scanTry.H !== h) {
    scanOverlay?.dispose();
    scanTry?.dispose();
    const t = (scanTry = new TryOn(frame, w, h, false));
    const o = (scanOverlay = new ScanOverlay(frame, w, h));
    t.onMeasure = showScan;
    t.onFrame = (tr, now) => {
      o.draw(tr, t.measure, now);
      if (!tr || t.measure.phase === 'ready' || now - valuesAt < 150) return; // live estimates while measuring
      valuesAt = now;
      const m = t.measure;
      if (m.face) $('#vFace').textContent = mm(tr.faceW / tr.pxPerMm);
      if (m.ears) $('#vEars').textContent = mm(tr.ears.spanMm);
      if (m.neck) $('#vNeck').textContent = mm(tr.neckline.widthMm);
    };
  }
  $$('#scan .mlist .mval').forEach((v) => (v.textContent = '–'));
  showScan(scanTry.measure);
  $('#scanChipT').textContent = 'Starting camera…';
  try {
    await scanTry.start();
    if (!$('#scan').classList.contains('on')) scanTry.stop();
  } catch {
    $('#scanChipT').textContent = "Camera isn't available. Please ask staff for help.";
  }
}

// ---------- live try-on ----------
function setChip(text: string | null) {
  const chip = $('#chip');
  chip.classList.toggle('hide', !text);
  if (text) $('#chipT').textContent = text;
}

const MEASURE_HINT: Record<MeasureState['hint'], string> = {
  none: 'Hold still, measuring…',
  noface: 'Look at the camera and step a little closer',
  turn: 'Look straight at the camera',
  shoulders: 'Step back a little so your shoulders are in view',
};
let measureTimer = 0;
function showMeasure(s: MeasureState) {
  $('#live').classList.toggle('measuring', s.phase === 'measuring');
  $$('.mchip').forEach((c) => c.classList.toggle('ok', Boolean(s[c.dataset.m as 'face' | 'ears' | 'neck'])));
  $('#mFill').style.transform = `scaleX(${s.progress})`;
  if (s.phase === 'ready') {
    if (measured) return;
    measured = true;
    ($('#shutter') as HTMLButtonElement).disabled = false;
    setChip(profile ? null : 'Measured. Choose your piece'); // no repeat message after the scan screen
    clearTimeout(measureTimer);
    measureTimer = window.setTimeout(() => {
      $('#measure').classList.add('done');
      setChip(null);
    }, 1800);
  } else {
    if (measured) {
      measured = false; // face lost for a while: measure again
      ($('#shutter') as HTMLButtonElement).disabled = true;
    }
    clearTimeout(measureTimer);
    $('#measure').classList.remove('done');
    setChip(MEASURE_HINT[s.hint]);
  }
}

async function startLive() {
  if (!cur) return;
  renderStrip();
  if (!tryon) {
    const sz = stageSize();
    tryon = new TryOn($('#live'), sz.w, sz.h);
    tryon.onHint = (h) => {
      if (measured) setChip(h === 'none' ? null : HINTS[h]); // measuring has its own hints
    };
    tryon.onMeasure = showMeasure;
    if (new URLSearchParams(location.search).has('debug')) {
      const t = tryon;
      void import('./debug/overlay').then((m) => m.attachDebug(t, $('#live')));
    }
  }
  const g = $('#guide'),
    gt = $('#guideT');
  g.classList.remove('off');
  gt.style.opacity = '1';
  if (profile) tryon.assumeMeasured(profile); // already measured on the scan screen
  measured = false;
  ($('#shutter') as HTMLButtonElement).disabled = true;
  $('#measure').classList.remove('done');
  showMeasure(tryon.measure);
  setChip('Starting camera…');
  clearTimeout(guideT);
  guideT = window.setTimeout(() => {
    g.classList.add('off');
    gt.style.opacity = '0';
  }, GUIDE_FADE_MS);
  try {
    await tryon.setPiece(cur);
    await tryon.start();
    if (!$('#live').classList.contains('on'))
      tryon.stop(); // left the screen while the permission prompt was open
    else showMeasure(tryon.measure); // measuring hints take over from "Starting camera"
  } catch {
    setChip("Camera isn't available. Please ask staff for help.");
  }
}

async function switchPiece(it: CatalogItem) {
  cur = it;
  renderStrip();
  await tryon?.setPiece(it); // swaps the model only; camera and tracking keep running (FR-11)
}

async function shoot() {
  if (!tryon) return;
  let n = 3;
  const c = $('#count');
  c.textContent = String(n);
  c.classList.add('on');
  await new Promise<void>((done) => {
    const i = window.setInterval(() => {
      if (--n > 0) c.textContent = String(n);
      else {
        clearInterval(i);
        done();
      }
    }, 1000);
  });
  c.classList.remove('on');
  try {
    const blob = await tryon.capture(); // mirrored video plus jewelry, held in memory only until the visitor saves
    clearPhoto();
    photoUrl = URL.createObjectURL(blob);
    $('.frame .img').style.backgroundImage = `url(${photoUrl})`;
  } catch {
    setChip("Couldn't take the photo. Please try again.");
    return;
  }
  const f = $('#flash');
  f.classList.remove('go');
  void f.getBoundingClientRect();
  f.classList.add('go');
  window.setTimeout(() => go('photoS'), 350);
}

function openStory() {
  const s = cur?.story?.[0];
  if (!cur || !s) return;
  $('#sEy').textContent = cur.name;
  $('#sTitle').textContent = s.title;
  $('#sText').textContent = s.text;
  $('#sTag').textContent = s.title;
  const photo = s.photo ?? cur.thumbnail;
  $('.macro').style.backgroundImage = photo ? `url(${photo})` : '';
  $('#story').classList.add('on');
}

/** Phone turned or window resized: the camera surface must match the screen, so rebuild it. */
function onResize() {
  sizeDust();
  if (
    scanTry &&
    $('#scan').classList.contains('on') &&
    (scanTry.W !== $('#scanFrame').clientWidth || scanTry.H !== $('#scanFrame').clientHeight)
  ) {
    scanOverlay?.dispose();
    scanTry.dispose();
    scanTry = scanOverlay = undefined;
    void startScan();
  }
  if (!tryon) return;
  const sz = stageSize();
  if (tryon.W === sz.w && tryon.H === sz.h) return;
  tryon.dispose();
  tryon = undefined;
  if ($('#live').classList.contains('on')) void startLive();
}

// ---------- opening: curtains, rising text and drifting gold dust ----------
function replayOpening() {
  const s = $('#start');
  s.classList.remove('play');
  void s.offsetWidth; // restart the CSS animations
  s.classList.add('play');
  startDust();
}

const dust = $<HTMLCanvasElement>('#dust');
const dctx = dust.getContext('2d')!;
function sizeDust() {
  const sz = stageSize();
  dust.width = sz.w;
  dust.height = sz.h;
}
sizeDust();
const motes = Array.from({ length: 90 }, () => ({
  x: Math.random() * dust.width,
  y: Math.random() * dust.height,
  r: 0.8 + Math.random() * 2.2,
  vy: 6 + Math.random() * 16, // px per second, upward
  vx: -4 + Math.random() * 8,
  ph: Math.random() * Math.PI * 2,
}));
let dustOn = false;
function startDust() {
  if (dustOn || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  dustOn = true;
  let last = performance.now();
  const frame = (now: number) => {
    if (!$('#start').classList.contains('on')) {
      dustOn = false; // nobody is watching: stop spending CPU
      return;
    }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    dctx.clearRect(0, 0, dust.width, dust.height);
    dctx.globalCompositeOperation = 'lighter';
    for (const m of motes) {
      m.y -= m.vy * dt;
      m.x += m.vx * dt;
      m.ph += dt * 1.6;
      if (m.y < -10) {
        m.y = dust.height + 10;
        m.x = Math.random() * dust.width;
      }
      const a = 0.25 + 0.35 * Math.sin(m.ph) ** 2;
      dctx.fillStyle = `rgba(240,216,152,${a.toFixed(3)})`;
      dctx.beginPath();
      dctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      dctx.fill();
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
startDust();

// ---------- input ----------
document.addEventListener(
  'pointerdown',
  (e) => {
    document.documentElement.style.setProperty('--tx', `${e.clientX}px`); // where the iris opens from
    document.documentElement.style.setProperty('--ty', `${e.clientY}px`);
    if (!$('#start').classList.contains('on')) bump();
  },
  true,
);
document.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('button');
  if (!el) return;
  const d = el.dataset;
  if (d.go) {
    if (d.go === 'scan' && el.closest('#notice')) noticeAccepted = true; // Accept
    go(d.go);
  } else if (d.cat) {
    cat = d.cat as JewelType;
    renderPick();
  } else if (d.cat2) {
    cat = d.cat2 as JewelType;
    const first = list()[0];
    if (first) void switchPiece(first);
  } else if (d.pick) {
    cur = catalog.find((p) => p.id === d.pick);
    go('live');
  } else if (d.sw) {
    const it = catalog.find((p) => p.id === d.sw);
    if (it) void switchPiece(it);
  } else if (d.scroll) $('#strip').scrollBy({ left: Number(d.scroll) * 360, behavior: 'smooth' });
  else if (d.sheet) openStory();
  else if ('close' in d) {
    el.closest('.sheet-bg')?.classList.remove('on');
    clearInterval(idleI);
  } else if (el.id === 'shutter') void shoot();
});

// ---------- dev menu (hidden with ?clean) ----------
const dev = $('#dev');
dev.innerHTML += [
  ['start', '1 Start'],
  ['notice', '2 Notice'],
  ['scan', '3 Scan'],
  ['pick', '4 Pick'],
  ['live', '5 Live'],
  ['photoS', '6 Photo'],
  ['qrS', '7 QR'],
]
  .map(([k, l]) => `<button data-go="${k}">${l}</button>`)
  .join('');
if (!new URLSearchParams(location.search).has('dev')) dev.style.display = 'none'; // dev menu only with ?dev

if (isPhone())
  $('#notice .terms .caption').textContent = 'Adults, or children with a parent or guardian. Full terms are on the Terms page.';

void loadCatalog().then(() => {
  renderPick();
  renderStrip();
  $$('#dev button').forEach((b) => b.classList.toggle('on', b.dataset.go === 'start'));
});
