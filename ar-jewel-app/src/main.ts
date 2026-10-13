import QRCode from 'qrcode';
import type { CatalogItem, JewelType } from './types';
import { getCatalog, getConfig, uploadPhoto, type AppConfig, type SavedPhoto } from './backend/api';
import { Machine, CAMERA_SCREENS, type Screen } from './privacy/machine';
import { preloadTracker, TryOn, type Hint } from './render/tryon';
import { getLang, setLang, t, type Key, type Lang } from './ui/i18n';
import { swatch } from './ui/swatch';

// Proposed timings: tune after the booth test. TODO(confirm)
const IDLE_WARN_MS = 60_000;
const IDLE_RESET_S = 10;
const QR_AUTO_CLOSE_S = 30;
const COUNTDOWN_S = 3;
const GUIDE_FADE_MS = 4000;
const W = 1080,
  H = 1920;

const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;
const $$ = <T extends HTMLElement = HTMLElement>(s: string) => [...document.querySelectorAll<T>(s)];

let cfg: AppConfig = { retentionHours: 24, publicBase: location.origin, adminEnabled: false };
let catalog: CatalogItem[] = [];
let cat: JewelType = 'earrings';
let cur: CatalogItem | undefined;
let tryon: TryOn | undefined;
let photoBlob: Blob | null = null;
let photoUrl = '';
let saved: SavedPhoto | null = null;
let idleTimer = 0,
  idleTick = 0,
  qrTick = 0,
  guideTimer = 0;
let busy = false;

const machine = new Machine((to, from) => onScreen(to, from));

// ---------- layout ----------
const stage = $('#stage');
const fit = () => {
  stage.style.transform = `translate(-50%,-50%) scale(${Math.min(innerWidth / W, innerHeight / H)})`;
};
addEventListener('resize', fit);
fit();

// ---------- text ----------
function applyText() {
  $$('[data-i]').forEach((e) => {
    e.textContent = t(e.dataset.i as Key, { h: cfg.retentionHours });
  });
  $('#noticeBody').textContent = t('notice.body', { h: cfg.retentionHours });
  $('#photoExpiry').textContent = t('photo.expiry', { h: cfg.retentionHours });
  $('#qrHelp').textContent = t('qr.help', { h: cfg.retentionHours });
  $('#secName').textContent = t(cat === 'earrings' ? 'cat.earrings' : 'cat.necklace');
  document.documentElement.lang = getLang();
  renderGrid();
  renderStrip();
}

// ---------- screens ----------
function onScreen(to: Screen, from: Screen) {
  $$('.screen').forEach((s) => s.classList.toggle('on', s.id === to));
  clearInterval(qrTick);
  if (to === 'start') clearIdle();
  else armIdle();
  if (to === 'pick') preloadTracker().catch(() => {}); // models only: no camera yet
  const cam = CAMERA_SCREENS.includes(to);
  if (!cam && CAMERA_SCREENS.includes(from)) tryon?.stop();
  if (to === 'live' && from !== 'photo') void startLive();
  if (to === 'start') clearPhoto();
  if (to === 'qr') {
    let s = QR_AUTO_CLOSE_S;
    const label = () => {
      $('#qrAuto').textContent = t('qr.auto', { s });
    };
    label();
    qrTick = window.setInterval(() => {
      s--;
      label();
      if (s <= 0) machine.go('start');
    }, 1000);
  }
}

async function startLive() {
  if (!cur) return;
  if (!tryon) {
    tryon = new TryOn($('#live'), W, H);
    tryon.onHint = showHint;
    if (new URLSearchParams(location.search).has('debug')) {
      const t = tryon;
      void import('./debug/overlay').then((m) => m.attachDebug(t, $('#live')));
    }
  }
  $('#liveName').textContent = cur.name;
  const chip = $('#chip');
  chip.hidden = false;
  chip.textContent = t('live.starting');
  $('#face').classList.remove('off');
  $('#faceT').style.opacity = '1';
  clearTimeout(guideTimer);
  guideTimer = window.setTimeout(() => {
    $('#face').classList.add('off');
    $('#faceT').style.opacity = '0';
  }, GUIDE_FADE_MS);
  try {
    await tryon.setPiece(cur);
    await tryon.start();
    chip.hidden = true;
  } catch {
    fullReset();
    showError(t('err.camera'), [{ label: t('err.ok'), primary: true }]);
  }
}

function showHint(h: Hint) {
  const chip = $('#chip');
  if (h === 'none') {
    chip.hidden = true;
    return;
  }
  chip.hidden = false;
  chip.textContent = t(`hint.${h}` as Key);
}

// ---------- catalog UI ----------
const list = () => catalog.filter((i) => i.type === cat);

function renderGrid() {
  const g = $('#grid');
  $$('.cat').forEach((c) => c.classList.toggle('sel', c.dataset.cat === cat));
  if (!catalog.length) {
    g.innerHTML = `<p class="body muted">${t('err.catalog')}</p>`;
    return;
  }
  g.replaceChildren(
    ...list().map((it) => {
      const b = document.createElement('button');
      b.className = 'card';
      b.dataset.pick = it.id;
      b.innerHTML = '<div class="th"></div><span></span>';
      Object.assign((b.firstElementChild as HTMLElement).style, swatch(it));
      b.lastElementChild!.textContent = it.name;
      return b;
    }),
  );
}

function renderStrip() {
  $$('.tab').forEach((x) => x.classList.toggle('sel', x.dataset.cat2 === cat));
  $('#strip').replaceChildren(
    ...list().map((it) => {
      const b = document.createElement('button');
      b.className = 'thumb' + (cur?.id === it.id ? ' sel' : '');
      b.dataset.sw = it.id;
      b.setAttribute('aria-label', it.name);
      b.innerHTML = '<i></i>';
      Object.assign((b.firstElementChild as HTMLElement).style, swatch(it));
      return b;
    }),
  );
  const has = !!cur?.story?.length;
  $('#detailsBtn').hidden = !has;
  if (cur) $('#liveName').textContent = cur.name;
}

async function switchPiece(it: CatalogItem) {
  cur = it;
  renderStrip();
  await tryon?.setPiece(it); // camera and tracking keep running (FR-11)
}

// ---------- details sheet ----------
let step = 0;
function renderDetails() {
  const s = cur?.story ?? [];
  const c = s[step];
  if (!c) return;
  $('#dEyebrow').textContent = cur!.name;
  $('#dTitle').textContent = c.title;
  $('#dText').textContent = c.text;
  const p = $('#dPhoto');
  p.hidden = !c.photo;
  p.style.backgroundImage = c.photo ? `url("${c.photo}")` : '';
  $('#dDots').replaceChildren(...s.map((_, i) => Object.assign(document.createElement('i'), { className: i === step ? 'on' : '' })));
  $('#dNext').hidden = s.length < 2;
}

// ---------- sheets ----------
const openSheet = (id: string) => $(id).classList.add('on');
const closeSheets = () => $$('.sheet-bg').forEach((s) => s.classList.remove('on'));

function showError(msg: string, btns: { label: string; primary?: boolean; fn?: () => void }[]) {
  $('#errMsg').textContent = msg;
  $('#errBtns').replaceChildren(
    ...btns.map((b) => {
      const e = document.createElement('button');
      e.className = 'btn ' + (b.primary ? 'btn-primary' : 'btn-secondary');
      e.textContent = b.label;
      e.onclick = () => {
        closeSheets();
        b.fn?.();
      };
      return e;
    }),
  );
  openSheet('#errSheet');
}

// ---------- idle ----------
function armIdle() {
  clearTimeout(idleTimer);
  idleTimer = window.setTimeout(warnIdle, IDLE_WARN_MS);
}
function clearIdle() {
  clearTimeout(idleTimer);
  clearInterval(idleTick);
}
function warnIdle() {
  let s = IDLE_RESET_S;
  const body = $('#idleBody');
  body.textContent = t('idle.body', { s });
  openSheet('#idleSheet');
  clearInterval(idleTick);
  idleTick = window.setInterval(() => {
    s--;
    body.textContent = t('idle.body', { s });
    if (s <= 0) fullReset();
  }, 1000);
}
/** Stop camera, drop any photo, return to start (FR-17). */
function fullReset() {
  clearInterval(idleTick);
  clearIdle();
  closeSheets();
  tryon?.stop();
  clearPhoto();
  busy = false;
  machine.reset();
}
function clearPhoto() {
  if (photoUrl) URL.revokeObjectURL(photoUrl);
  photoBlob = null;
  photoUrl = '';
  saved = null;
  $<HTMLImageElement>('#photoImg').removeAttribute('src');
}

// ---------- photo ----------
async function shoot() {
  if (busy || !tryon) return;
  busy = true;
  const c = $('#count');
  c.classList.add('on');
  for (let n = COUNTDOWN_S; n > 0; n--) {
    c.textContent = String(n);
    await new Promise((r) => setTimeout(r, 1000));
  }
  c.classList.remove('on');
  const f = $('#flash');
  f.classList.remove('on');
  void f.offsetWidth;
  f.classList.add('on');
  try {
    photoBlob = await tryon.capture();
    photoUrl = URL.createObjectURL(photoBlob);
    $<HTMLImageElement>('#photoImg').src = photoUrl;
    if (machine.state === 'live') machine.go('photo');
  } finally {
    busy = false;
  }
}

async function save() {
  if (!photoBlob || busy) return;
  busy = true;
  try {
    saved = await uploadPhoto(photoBlob); // only after the visitor taps Save (FR-14)
    await QRCode.toCanvas($<HTMLCanvasElement>('#qrCanvas'), saved.url, {
      width: 480,
      margin: 0,
      color: { dark: '#000000', light: '#ffffff' },
    });
    machine.go('qr');
  } catch {
    showError(t('err.save'), [
      {
        label: t('photo.discard'),
        fn: () => {
          clearPhoto();
          machine.go('live');
        },
      },
      { label: t('err.retry'), primary: true, fn: () => void save() },
    ]);
  } finally {
    busy = false;
  }
}

// ---------- events ----------
document.addEventListener(
  'pointerdown',
  () => {
    if (machine.state !== 'start') armIdle();
  },
  true,
);

document.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('button');
  if (!el) return;
  const d = el.dataset;
  if (d.lang) {
    setLang(d.lang as Lang);
    applyText();
    return;
  }
  if (d.cat) {
    cat = d.cat as JewelType;
    applyText();
    return;
  }
  if (d.cat2) {
    cat = d.cat2 as JewelType;
    const first = list()[0];
    if (first) void switchPiece(first);
    applyText();
    return;
  }
  if (d.pick) {
    cur = catalog.find((i) => i.id === d.pick);
    if (cur && machine.state === 'pick') machine.go('live');
    return;
  }
  if (d.sw) {
    const it = catalog.find((i) => i.id === d.sw);
    if (it) void switchPiece(it);
    return;
  }
  if (d.scroll) {
    $('#strip').scrollBy({ left: Number(d.scroll) * 450, behavior: 'smooth' });
    return;
  }
  switch (d.act) {
    case 'begin':
      machine.go('notice');
      break;
    case 'decline':
      machine.go('start');
      break;
    case 'accept':
      machine.go('pick');
      break;
    case 'home':
      fullReset();
      break;
    case 'toPick':
      machine.go('pick');
      break;
    case 'details':
      step = 0;
      renderDetails();
      openSheet('#detailsSheet');
      break;
    case 'dNext':
      step = (step + 1) % (cur?.story?.length ?? 1);
      renderDetails();
      break;
    case 'closeSheet':
      closeSheets();
      break;
    case 'shoot':
      void shoot();
      break;
    case 'retake':
    case 'discard':
      clearPhoto();
      machine.go('live');
      break; // TODO(confirm): discard returns to live
    case 'save':
      void save();
      break;
    case 'done':
      machine.go('start');
      break;
    case 'idleContinue':
      clearInterval(idleTick);
      closeSheets();
      armIdle();
      break;
  }
});

// ---------- boot ----------
(async () => {
  [cfg, catalog] = await Promise.all([getConfig(), getCatalog().catch(() => [])]);
  cur = catalog[0];
  void QRCode.toCanvas($<HTMLCanvasElement>('#termsQr'), `${cfg.publicBase}/terms.html`, { width: 144, margin: 0 });
  applyText();
  if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register('/sw.js').catch(() => {});
})();
