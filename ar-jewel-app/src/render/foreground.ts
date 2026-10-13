import { fromView, type CategoryMask } from '../tracking/occlusion';
import { occludes, type Zone } from './masking';

const STEP = 6; // display px per mask cell; the canvas scaling smooths the edge

/** Draw `src` (a camera frame) mirrored and cover-fitted into `g`, the same way the video element is shown. */
export function drawCover(g: CanvasRenderingContext2D, src: CanvasImageSource, sw: number, sh: number, W: number, H: number) {
  const s = Math.max(W / sw, H / sh);
  const dw = sw * s,
    dh = sh * s;
  g.save();
  g.translate(W, 0);
  g.scale(-1, 1);
  g.drawImage(src, (W - dw) / 2, (H - dh) / 2, dw, dh);
  g.restore();
}

/**
 * A transparent layer on top of the jewelry that repaints the camera pixels which belong in front of it
 * (face over the necklace, hair over an earring). The jewelry looks tucked in, as if it were really worn.
 */
export class Foreground {
  readonly canvas = document.createElement('canvas');
  private g = this.canvas.getContext('2d')!;
  private alpha = document.createElement('canvas');
  private ag: CanvasRenderingContext2D;
  private img: ImageData;
  /** Non-zero pixels in the last render, for tests */
  covered = 0;

  constructor(
    readonly W: number,
    readonly H: number,
  ) {
    this.canvas.width = W;
    this.canvas.height = H;
    Object.assign(this.canvas.style, { position: 'absolute', left: '0', top: '0', width: '100%', height: '100%', pointerEvents: 'none' });
    this.alpha.width = Math.ceil(W / STEP);
    this.alpha.height = Math.ceil(H / STEP);
    this.ag = this.alpha.getContext('2d', { willReadFrequently: true })!;
    this.img = this.ag.createImageData(this.alpha.width, this.alpha.height);
  }

  clear() {
    this.g.clearRect(0, 0, this.W, this.H);
    this.covered = 0;
  }

  /** Returns true when something was drawn. Without a mask or a zone the layer is simply empty. */
  render(src: CanvasImageSource, sw: number, sh: number, mask: CategoryMask | undefined, zone: Zone | undefined): boolean {
    if (!mask || !zone || !sw || !sh) {
      this.clear();
      return false;
    }
    const { W, H } = this;
    const view = { W, H, vw: sw, vh: sh };
    const gw = this.alpha.width,
      gh = this.alpha.height,
      px = this.img.data;
    let n = 0;
    for (let gy = 0; gy < gh; gy++) {
      for (let gx = 0; gx < gw; gx++) {
        const x = gx * STEP + STEP / 2,
          y = gy * STEP + STEP / 2;
        const p = fromView({ x, y }, view);
        const mx = Math.min(mask.w - 1, Math.max(0, Math.floor(p.x * mask.w)));
        const my = Math.min(mask.h - 1, Math.max(0, Math.floor(p.y * mask.h)));
        const on = occludes(mask.data[my * mask.w + mx], x, y, zone);
        px[(gy * gw + gx) * 4 + 3] = on ? 255 : 0;
        if (on) n++;
      }
    }
    this.covered = n;
    if (!n) {
      this.clear();
      return false;
    }
    this.ag.putImageData(this.img, 0, 0);
    const g = this.g;
    g.clearRect(0, 0, W, H);
    drawCover(g, src, sw, sh, W, H);
    g.globalCompositeOperation = 'destination-in'; // keep the camera pixels only where the mask says "in front"
    g.imageSmoothingEnabled = true;
    g.drawImage(this.alpha, 0, 0, W, H);
    g.globalCompositeOperation = 'source-over';
    return true;
  }

  dispose() {
    this.canvas.remove();
  }
}
