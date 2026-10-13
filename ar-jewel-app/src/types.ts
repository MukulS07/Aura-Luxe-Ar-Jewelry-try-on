export type JewelType = 'earrings' | 'necklace';

export interface Callout {
  title: string;
  text: string;
  photo?: string;
}

export interface CatalogItem {
  id: string;
  name: string;
  type: JewelType;
  /** `procedural:<kind>` (built-in placeholder) or a .glb path */
  model: string;
  thumbnail?: string;
  material: string;
  /** offset in fractions of face width (earrings) or neck width (necklace) */
  anchor: { offset: [number, number, number]; scale: number };
  /** Real-world size. `sizeMm` = drop height (earrings) or width (necklace). Missing = per-type default. */
  dimensions?: { sizeMm: number; yOffsetMm?: number; rigid?: boolean };
  /** For .glb pieces: first rule whose `match` prefixes a mesh (or its parent) name picks the library material. */
  materialRules?: { match: string; material: string }[];
  story?: Callout[];
  active: boolean;
}

export interface Pt {
  x: number;
  y: number;
}

export interface NecklineData {
  center: Pt; // suprasternal notch (collarbone hollow)
  left: Pt; // left neck base where chain rests
  right: Pt; // right neck base where chain rests
  widthPx: number; // measured width across neck base
  widthMm: number; // measured neck width in millimeters
  contour: Pt[]; // 5-point curve tracing the collarbone and neck base
  roll: number; // shoulder/clavicle tilt
  sternumDrop: Pt; // estimated center of sternum where pendant hangs
}

export interface EarData {
  lobeL: Pt; // left earlobe piercing point
  lobeR: Pt; // right earlobe piercing point
  spanMm: number; // earlobe-to-earlobe distance in mm
  isMeasured: boolean;
  /** Hair covers this lobe (segmentation); the renderer should fade that earring */
  hiddenL: boolean;
  hiddenR: boolean;
}

/** Experimental hand anchors for rings and bangles. All Pt in display px. */
export interface HandData {
  side: 'left' | 'right'; // screen side relative to the face
  score: number;
  wrist: Pt;
  palmCenter: Pt;
  ringBase: Pt; // ring-finger knuckle
  ringAnchor: Pt; // where a ring sits on the proximal phalanx
  ringAngle: number; // finger direction, screen space
  bangleAnchor: Pt; // just past the wrist toward the forearm
  roll: number; // wrist -> fingers, screen space
  palmWidthPx: number;
  pxPerMm: number; // scale at the hand's own depth
  palmFacing: boolean;
}

/** Single result handed from tracking to render. All coordinates are display px (already mirrored). */
export interface Tracking {
  faceCount: number;
  center: Pt;
  faceW: number;
  faceH: number;
  /** radians, + = face turned toward screen right */
  yaw: number;
  /** radians, + = face tilted up / down */
  pitch: number;
  /** radians, screen space (y down) */
  roll: number;
  earL: Pt; // screen-left lobe
  earR: Pt; // screen-right lobe
  chin: Pt;
  neck: { x: number; y: number; w: number; roll: number };
  hasPose: boolean;
  /** Anthropometric scale factor: display pixels per real-world millimeter */
  pxPerMm: number;
  /** Comprehensive measured anatomical neckline */
  neckline: NecklineData;
  /** Comprehensive measured anatomical earlobes */
  ears: EarData;
  /** Face outline (MediaPipe face oval, 36 points) in display px; hides the far earring on a head turn */
  faceOval: Pt[];
  /** True when face, earlobes, and neckline are stably tracked and measured */
  isLocked: boolean;
  /** Where yaw/pitch came from */
  poseSource: 'matrix' | 'landmarks';
  /** `face+body` when the shoulder-derived scale agreed with the face-derived one */
  scaleSource: 'face' | 'face+body';
  /** Empty unless hand tracking is enabled (experimental) */
  hands: HandData[];
}
