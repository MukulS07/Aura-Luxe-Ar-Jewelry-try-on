import type { CatalogItem, Tracking } from '../types';
import { Measurer, type MeasureState } from '../tracking/measurer';
import { Tracker } from '../tracking/tracker';
import { clampFit, defaultFit, Placement, type Fit, type Frame } from './placement';
import { Foreground, drawCover } from './foreground';
import { farSide, type Zone } from './masking';
import { Scene3D } from './scene';

export type Hint = 'none' | 'noface' | 'multi' | 'dark';

const NO_FACE_MS = 1200;
const MULTI_MS = 3000;
const LOW_LUMA = 60; // TODO(confirm) darkness threshold, tune at the booth
const LUMA_EVERY_MS = 1000;

let trackerP: Promise<Tracker> | undefined;
/** Load the models once; call early (no camera involved). */
export const preloadTracker = () =>
  (trackerP ??= Tracker.create()
    .then(async (t) => {
      await t.warmup().catch(() => undefined); // a failed warm-up only means a slower first frame
      return t;
    })
    .catch((e) => {
      trackerP = undefined;
      throw e;
    }));

/** Camera + tracking + render loop for one display surface. Camera runs only between start() and stop(). */
export class TryOn {
  readonly video = document.createElement('video');
  readonly canvas = document.createElement('canvas');
  onHint: (h: Hint) => void = () => {};
  /** Debug hooks. Set only by the debug overlay (`?debug`); the kiosk never sets them. */
  onFps?: (fps: number) => void;
  onFrame?: (tr: Tracking | null, nowMs: number) => void;
  private _fit: Fit = defaultFit();
  /** Last placement frame (reused object; read it right away). For the debug overlay and motion checks. */
  lastFrame?: Frame;
  /** Smoothed time one tracking pass takes (ms). Also used to compensate the drawing delay. */
  detectMs = 0;
  /** The measuring step: jewelry stays hidden until this reports `ready`. */
  onMeasure?: (s: MeasureState) => void;
  private measurer = new Measurer();
  private measureKey = '';
  measure: MeasureState = { phase: 'measuring', face: false, ears: false, neck: false, progress: 0, hint: 'noface' };
  private item?: CatalogItem;
  private scene: Scene3D;
  private fg: Foreground;
  private tracker?: Tracker;
  private placement: Placement;
  private stream?: MediaStream;
  private raf = 0;
  private running = false;
  private lastFace = 0;
  private multiUntil = 0;
  private dark = false;
  private lastLuma = 0;
  private hint: Hint = 'none';
  private frames = 0;
  private fpsT = 0;
  private lumaCtx = Object.assign(document.createElement('canvas'), { width: 16, height: 16 }).getContext('2d', {
    willReadFrequently: true,
  })!;

  constructor(
    host: HTMLElement,
    readonly W: number,
    readonly H: number,
  ) {
    this.video.playsInline = true;
    this.video.muted = true;
    this.video.className = 'cam';
    this.canvas.className = 'gl';
    host.prepend(this.canvas);
    host.prepend(this.video);
    this.scene = new Scene3D(this.canvas, W, H);
    this.fg = new Foreground(W, H);
    this.canvas.after(this.fg.canvas); // above the jewelry, below the screen's own controls
    this.placement = new Placement(H);
  }

  setPiece(item: CatalogItem) {
    this.item = item;
    this.placement.restartFade();
    return this.scene.setPiece(item);
  }

  get fit(): Fit {
    return this._fit;
  }
  set fit(f: Fit) {
    this._fit = clampFit(f);
  }

  async start(): Promise<void> {
    if (this.running) return;
    const tracker = (this.tracker = await preloadTracker());
    this.stream = await navigator.mediaDevices.getUserMedia({
      // Ask for a frame shaped like the screen (a phone held upright wants a portrait frame)
      video:
        this.H > this.W
          ? { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 1280 } }
          : { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
    this.video.srcObject = this.stream;
    await this.video.play();
    this.running = true;
    this.lastFace = performance.now();
    const loop = () => {
      if (!this.running) return;
      const now = performance.now();
      const tr = tracker.detect(this.video, this.W, this.H, now);
      const spent = performance.now() - now;
      this.detectMs += (spent - this.detectMs) * 0.1; // smoothed cost of one tracking pass
      this.measure = this.measurer.update(tr, now);
      const m = this.measure;
      const key = `${m.phase}${+m.face}${+m.ears}${+m.neck}${m.hint}${Math.round(m.progress * 20)}`;
      if (key !== this.measureKey) {
        this.measureKey = key;
        this.onMeasure?.(m);
      }
      // No jewelry until the visitor has been measured
      this.lastFrame = this.placement.update(tr, m.phase === 'ready' ? this.item : undefined, now, this._fit, this.detectMs);
      this.scene.apply(this.lastFrame);
      this.scene.render();
      this.maskForeground(tr);
      this.onFrame?.(tr, now);
      this.updateHint(tr ? tr.faceCount : 0, now);
      this.frames++;
      if (now - this.fpsT >= 1000) {
        this.onFps?.(this.frames);
        this.frames = 0;
        this.fpsT = now;
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  /** Put the face and hair in front of the jewelry where they belong. Needs the segmentation mask (not on phones). */
  private maskForeground(tr: Tracking | null) {
    const f = this.lastFrame;
    let zone: Zone | undefined;
    if (tr && f && f.opacity > 0.05 && this.item)
      zone =
        this.item.type === 'earrings'
          ? { kind: 'earrings', lobes: [tr.ears.lobeL, tr.ears.lobeR], far: farSide(tr.yaw), faceCx: tr.center.x, ppm: tr.pxPerMm }
          : { kind: 'necklace' };
    this.fg.render(this.video, this.video.videoWidth, this.video.videoHeight, this.tracker?.mask, zone);
  }

  private updateHint(faces: number, now: number) {
    if (faces) this.lastFace = now;
    if (faces > 1) this.multiUntil = now + MULTI_MS;
    if (now - this.lastLuma > LUMA_EVERY_MS) {
      this.lastLuma = now;
      this.lumaCtx.drawImage(this.video, 0, 0, 16, 16);
      const d = this.lumaCtx.getImageData(0, 0, 16, 16).data;
      let sum = 0;
      for (let i = 0; i < d.length; i += 4) sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      this.dark = sum / 256 < LOW_LUMA;
    }
    const h: Hint = now - this.lastFace > NO_FACE_MS ? 'noface' : now < this.multiUntil ? 'multi' : this.dark ? 'dark' : 'none';
    if (h !== this.hint) {
      this.hint = h;
      this.onHint(h);
    }
  }

  /** Mirrored video + jewelry as one JPEG. Camera feed plus 3D jewelry; the debug overlay is a separate canvas and never included. */
  capture(): Promise<Blob> {
    const c = document.createElement('canvas');
    c.width = this.W;
    c.height = this.H;
    const g = c.getContext('2d')!;
    drawCover(g, this.video, this.video.videoWidth, this.video.videoHeight, this.W, this.H);
    g.drawImage(this.canvas, 0, 0, this.W, this.H);
    g.drawImage(this.fg.canvas, 0, 0, this.W, this.H); // hair and face stay in front of the jewelry in the photo too
    return new Promise((ok, fail) => c.toBlob((b) => (b ? ok(b) : fail(new Error('capture failed'))), 'image/jpeg', 0.9));
  }

  stop(): void {
    this.running = false;
    this.measurer.reset(); // the next visit is measured from scratch
    this.measureKey = '';
    this.fg.clear();
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = undefined;
    this.video.srcObject = null;
    this.hint = 'none';
  }

  dispose(): void {
    this.stop();
    this.scene.dispose();
    this.video.remove();
    this.canvas.remove();
    this.fg.dispose();
  }
}
