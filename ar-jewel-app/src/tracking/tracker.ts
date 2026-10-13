import { FaceLandmarker, FilesetResolver, HandLandmarker, ImageSegmenter, PoseLandmarker } from '@mediapipe/tasks-vision';
import type { Tracking } from '../types';
import { solveHands, type RawHand } from './hands';
import type { CategoryMask } from './occlusion';
import { solve, type LM } from './solve';

const BASE = '/mediapipe'; // self-hosted: no CDN at runtime
// Heavy models run on a rotating schedule so one frame never pays for all of them.
// Pose runs on even frames; hands and segmentation take turns on odd frames, so no frame pays for all three.
const POSE_EVERY = 2,
  HAND_EVERY = 4,
  HAND_AT = 3,
  SEG_EVERY = 4,
  SEG_AT = 1;

export interface TrackerOptions {
  /** Experimental rings/bangles track. Off in kiosk builds unless `?hands` is in the URL. */
  hands?: boolean;
  /** Hair/body mask so earrings can hide behind hair (FR-6). */
  segmentation?: boolean;
  /** Phones: lighter pose model and no segmentation. Reduce effects before clarity of the piece (design.md section 11). */
  lite?: boolean;
}

const phone = () => typeof matchMedia !== 'undefined' && matchMedia('(max-width: 820px)').matches;
const defaults = (): Required<TrackerOptions> => ({
  lite: phone(),
  hands: typeof location !== 'undefined' && new URLSearchParams(location.search).has('hands'),
  segmentation: !phone(),
});

interface Models {
  face: FaceLandmarker;
  pose: PoseLandmarker;
  hand?: HandLandmarker;
  seg?: ImageSegmenter;
}

export class Tracker {
  private frame = 0;
  private poses: LM[][] = [];
  private worldPoses: LM[][] = [];
  private rawHands: RawHand[] = [];
  /** Latest hair/body mask (updated every few frames), for the foreground layer. */
  mask?: CategoryMask;
  private constructor(private m: Models) {}

  static async create(opts: TrackerOptions = defaults()): Promise<Tracker> {
    const fileset = await FilesetResolver.forVisionTasks(`${BASE}/wasm`);
    const build = async (delegate: 'GPU' | 'CPU') => {
      const base = (file: string) => ({ modelAssetPath: `${BASE}/${file}`, delegate });
      const face = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: base('face_landmarker.task'),
        runningMode: 'VIDEO',
        numFaces: 3,
        outputFacialTransformationMatrixes: true,
      });
      const pose = await PoseLandmarker.createFromOptions(fileset, {
        baseOptions: base(opts.lite ? 'pose_landmarker_lite.task' : 'pose_landmarker_full.task'),
        runningMode: 'VIDEO',
        numPoses: 3,
      });
      const hand = opts.hands
        ? await HandLandmarker.createFromOptions(fileset, { baseOptions: base('hand_landmarker.task'), runningMode: 'VIDEO', numHands: 2 })
        : undefined;
      const seg = opts.segmentation
        ? await ImageSegmenter.createFromOptions(fileset, {
            baseOptions: base('selfie_multiclass_256x256.tflite'),
            runningMode: 'VIDEO',
            outputCategoryMask: true,
            outputConfidenceMasks: false,
          })
        : undefined;
      return new Tracker({ face, pose, hand, seg });
    };
    try {
      return await build('GPU');
    } catch {
      return build('CPU');
    }
  }

  /**
   * Run every model once on a still stock photo (not camera data), so the first-use shader and pipeline setup happens
   * now, while the visitor reads the notice, and not as a multi-second freeze when the camera starts.
   */
  async warmup(url = '/hero.jpg'): Promise<void> {
    const bmp = await createImageBitmap(await (await fetch(url)).blob());
    const c = Object.assign(document.createElement('canvas'), { width: 640, height: 640 });
    c.getContext('2d')!.drawImage(bmp, 0, 0, 640, 640);
    bmp.close();
    for (let i = 1; i <= 8; i++) this.run(c, { W: 640, H: 640, vw: 640, vh: 640 }, i); // 8 frames cover every rotating model
    this.frame = 0;
    this.poses = [];
    this.worldPoses = [];
    this.rawHands = [];
    this.mask = undefined;
  }

  /** `W`,`H` = display size in px. Returns null when no face. */
  detect(video: HTMLVideoElement, W: number, H: number, nowMs: number): Tracking | null {
    if (video.readyState < 2 || !video.videoWidth) return null;
    return this.run(video, { W, H, vw: video.videoWidth, vh: video.videoHeight }, nowMs);
  }

  /** Same pipeline for any image source (used by the offline check against a still photo). */
  private run(
    src: HTMLVideoElement | HTMLCanvasElement,
    view: { W: number; H: number; vw: number; vh: number },
    nowMs: number,
  ): Tracking | null {
    const { face, pose, hand, seg } = this.m;
    const fr = face.detectForVideo(src, nowMs);
    const n = this.frame++;
    if (n % POSE_EVERY === 0) {
      const r = pose.detectForVideo(src, nowMs + 0.01);
      this.poses = r.landmarks as LM[][];
      this.worldPoses = r.worldLandmarks as LM[][];
    }
    if (hand && n % HAND_EVERY === HAND_AT) {
      const r = hand.detectForVideo(src, nowMs + 0.02);
      this.rawHands = r.landmarks.map((landmarks, i) => ({
        landmarks: landmarks as LM[],
        label: r.handedness[i]?.[0]?.categoryName ?? '',
        score: r.handedness[i]?.[0]?.score ?? 0,
      }));
    }
    if (seg && n % SEG_EVERY === SEG_AT) {
      seg.segmentForVideo(src, nowMs + 0.03, (r) => {
        const m = r.categoryMask;
        if (m) this.mask = { data: m.getAsUint8Array().slice(), w: m.width, h: m.height };
      });
    }
    const faces = fr.faceLandmarks as LM[][];
    const tr = solve(faces, this.poses, view, {
      matrices: fr.facialTransformationMatrixes?.map((m) => m.data),
      worldPoses: this.worldPoses,
      mask: this.mask,
    });
    if (tr && hand) tr.hands = solveHands(this.rawHands, view, tr.center.x);
    return tr;
  }

  /** Check helper: run once on a canvas holding a still photo. */
  detectCanvas(c: HTMLCanvasElement, W: number, H: number, nowMs: number): Tracking | null {
    return this.run(c, { W, H, vw: c.width, vh: c.height }, nowMs);
  }

  close() {
    const { face, pose, hand, seg } = this.m;
    face.close();
    pose.close();
    hand?.close();
    seg?.close();
  }
}
