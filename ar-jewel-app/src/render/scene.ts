import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { CatalogItem } from '../types';
import { cloneIndependent, disposeObject, loadPiece } from './piece';
import { OVAL_N, type Frame } from './placement';

const OVAL_Z = 20; // in front of a far earring including its own depth (z < -2), behind a near one (z > 2)

/** Luxury Orthographic 3D scene in display pixels, aligned with mirrored video stream. */
export class Scene3D {
  readonly renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private cam: THREE.OrthographicCamera;
  private occluder: THREE.Mesh;
  private oval: THREE.Mesh;
  private pieces: THREE.Object3D[] = [];
  private wanted?: CatalogItem; // latest requested piece, to drop stale async loads
  private opacities: number[] = [];

  constructor(
    readonly canvas: HTMLCanvasElement,
    private W: number,
    private H: number,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(W, H, false);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    // Studio Environment Lighting Map for Realistic Reflections and Sparkle
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();

    // 3-Point Luxury Atelier Studio Lighting
    this.scene.add(new THREE.AmbientLight(0xfff8ed, 0.75));

    // Warm Key Light (Luxury gold specular highlight)
    const keyLight = new THREE.DirectionalLight(0xfff5e4, 2.4);
    keyLight.position.set(-280, 550, 750);
    this.scene.add(keyLight);

    // Cool Rim Light (Gemstone fire & edge definition)
    const rimLight = new THREE.DirectionalLight(0xdbe9ff, 1.8);
    rimLight.position.set(320, 600, -250);
    this.scene.add(rimLight);

    // Soft Upward Bounce Light
    const fillLight = new THREE.DirectionalLight(0xffeec7, 0.8);
    fillLight.position.set(0, -300, 500);
    this.scene.add(fillLight);

    this.cam = new THREE.OrthographicCamera(0, W, H, 0, 0.1, 3500);
    this.cam.position.z = 1600;

    // Invisible Head Occluder: writes depth only, smoothly masking earrings behind face on turns (FR-5)
    this.occluder = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), new THREE.MeshBasicMaterial({ colorWrite: false }));
    this.occluder.renderOrder = -1;
    this.occluder.visible = false;
    this.scene.add(this.occluder);

    // Face outline as a flat depth-only fan: hides the far earring behind the cheek and jaw on a head turn
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((OVAL_N + 1) * 3), 3));
    const idx: number[] = [];
    for (let i = 0; i < OVAL_N; i++) idx.push(0, 1 + i, 1 + ((i + 1) % OVAL_N));
    g.setIndex(idx);
    this.oval = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide }));
    this.oval.renderOrder = -1;
    this.oval.frustumCulled = false;
    this.oval.visible = false;
    this.scene.add(this.oval);
  }

  async setPiece(item: CatalogItem): Promise<void> {
    this.wanted = item;
    const obj = await loadPiece(item);
    if (this.wanted !== item) {
      disposeObject(obj);
      return;
    }
    this.clearPieces();
    obj.traverse((o) => {
      o.renderOrder = 1;
    });
    this.pieces = item.type === 'earrings' ? [obj, cloneIndependent(obj)] : [obj];
    this.opacities = this.pieces.map(() => -1);
    this.pieces.forEach((p) => {
      p.visible = false;
      this.scene.add(p);
    });
  }

  /** Apply one placement frame. The only place transforms reach Three.js. */
  apply(fr: Frame): void {
    const o = fr.occluder;
    this.occluder.visible = o.visible;
    this.oval.visible = o.visible;
    if (o.visible) {
      const pos = this.oval.geometry.getAttribute('position') as THREE.BufferAttribute;
      let cx = 0,
        cy = 0;
      for (let i = 0; i < OVAL_N; i++) {
        cx += o.oval[i * 2];
        cy += o.oval[i * 2 + 1];
        pos.setXYZ(1 + i, o.oval[i * 2], o.oval[i * 2 + 1], OVAL_Z);
      }
      pos.setXYZ(0, cx / OVAL_N, cy / OVAL_N, OVAL_Z);
      pos.needsUpdate = true;
      this.occluder.position.set(o.x, o.y, 0);
      this.occluder.scale.set(o.sx, o.sy, o.sz);
      this.occluder.rotation.set(o.rx, 0, o.rz);
    }
    for (let i = 0; i < this.pieces.length; i++) {
      const p = this.pieces[i];
      const t = i < fr.count ? fr.pieces[i] : null;
      const a = t ? t.opacity : fr.opacity;
      if (t) {
        p.position.set(t.x, t.y, t.z);
        p.scale.setScalar(t.scale);
        p.rotation.set(t.rx, t.ry, t.rz);
      }
      p.visible = a > 0.01;
      if (Math.abs(a - this.opacities[i]) > 0.003) {
        this.opacities[i] = a;
        setOpacity(p, a);
      }
    }
  }

  render(): void {
    this.renderer.render(this.scene, this.cam);
  }

  private clearPieces() {
    this.pieces.forEach((p) => {
      this.scene.remove(p);
      disposeObject(p);
    });
    this.pieces = [];
  }

  dispose(): void {
    this.clearPieces();
    this.occluder.geometry.dispose();
    (this.occluder.material as THREE.Material).dispose();
    this.oval.geometry.dispose();
    (this.oval.material as THREE.Material).dispose();
    this.scene.environment?.dispose();
    this.renderer.dispose();
  }
}

function setOpacity(p: THREE.Object3D, a: number) {
  p.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    if (!m) return;
    for (const x of Array.isArray(m) ? m : [m]) x.opacity = a;
  });
}
