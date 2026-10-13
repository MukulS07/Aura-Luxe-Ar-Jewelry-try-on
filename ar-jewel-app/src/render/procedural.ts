import * as THREE from 'three';
import type { JewelType } from '../types';
import { material } from './materials';

/**
 * Luxury 3D Procedural Fine Jewelry Generator.
 * Creates intricate, photorealistic geometries for:
 * - Royal Kundan Jhumkas (ornate filigree, ruby centerpiece, swinging pearl tassels)
 * - Solitaire Diamond Studs (6-prong platinum basket setting, faceted brilliant cut)
 * - Chandelier Diamond Drops (articulated tiers, pear-cut gems, delicate links)
 * - Eternity Pavé Hoops (channel-set diamond rim, high-gloss gold)
 * - Royal Polki & Emerald Choker (arched articulated gold plates, emerald drops)
 * - Solitaire Diamond Pendant (floating faceted diamond, delicate chain)
 * - Royal Rani Haar (multi-strand graduated pearls, majestic polki medallion)
 */

// Helper to generate a faceted brilliant-cut gemstone geometry
function createFacetedGemGeometry(radius: number): THREE.BufferGeometry {
  // Octahedron with detail 0 or 1 gives crisp faceted gem surfaces
  const geom = new THREE.OctahedronGeometry(radius, 1);
  geom.computeVertexNormals();
  // To get flat facets like real gems, convert to non-indexed
  return geom.toNonIndexed();
}

// Helper to generate a pear-cut teardrop gem
function createPearGemGeometry(r: number): THREE.BufferGeometry {
  const geom = new THREE.ConeGeometry(r, r * 2.2, 12, 1);
  geom.rotateX(Math.PI);
  return geom.toNonIndexed();
}

const ball = (r: number, mat: THREE.Material, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 16), mat);
  m.position.set(x, y, z);
  return m;
};

const facetedGem = (r: number, mat: THREE.Material, x = 0, y = 0, z = 0) => {
  const m = new THREE.Mesh(createFacetedGemGeometry(r), mat);
  m.position.set(x, y, z);
  return m;
};

const lathe = (pts: [number, number][], mat: THREE.Material, segments = 36) =>
  new THREE.Mesh(
    new THREE.LatheGeometry(
      pts.map(([r, y]) => new THREE.Vector2(r, y)),
      segments,
    ),
    mat,
  );

const chainTube = (curve: THREE.Curve<THREE.Vector3>, mat: THREE.Material, radius = 0.007) =>
  new THREE.Mesh(new THREE.TubeGeometry(curve, 90, radius, 10), mat);

const arc = (w: number, depth: number, lift = 0) =>
  new THREE.CatmullRomCurve3(
    Array.from({ length: 25 }, (_, i) => {
      const u = i / 24 - 0.5; // -0.5 .. 0.5
      return new THREE.Vector3(u * w, depth * (2 * u) ** 2 + lift, 0);
    }),
  );

/* =========================================================================
   1. EARRINGS
   ========================================================================= */

function buildJhumka(metal: string): THREE.Group {
  const g = new THREE.Group();
  const mGold = material(metal);
  const mRuby = material('ruby');
  const mPearl = material('pearl');
  const mDiamond = material('diamond');

  // --- Top Ear Stud Plate (Flower/Sun Motif) ---
  const studPlate = new THREE.Group();
  studPlate.position.set(0, -0.05, 0.01);
  // Central bezel ruby
  studPlate.add(ball(0.045, mRuby, 0, 0, 0.015));
  studPlate.add(new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 12, 24), mGold));
  // Surrounding 8-petal diamond halo
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const px = Math.cos(angle) * 0.08;
    const py = Math.sin(angle) * 0.08;
    studPlate.add(facetedGem(0.024, mDiamond, px, py, 0.008));
    studPlate.add(ball(0.014, mGold, px * 1.3, py * 1.3, 0.004));
  }
  g.add(studPlate);

  // --- Intermediate Connecting Link & Small Dome ---
  g.add(ball(0.025, mGold, 0, -0.15, 0));
  g.add(ball(0.02, mRuby, 0, -0.19, 0.01));

  // --- Main Filigree Bell (Chhatri / Jhumka Dome) ---
  const domePts: [number, number][] = [
    [0.015, -0.22],
    [0.1, -0.26],
    [0.22, -0.36],
    [0.28, -0.52],
    [0.31, -0.68],
    [0.28, -0.76],
    [0.24, -0.79],
  ];
  const bell = lathe(domePts, mGold, 40);
  g.add(bell);

  // Decorative filigree rings on the bell
  const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.014, 12, 36), mGold);
  ring1.position.set(0, -0.42, 0);
  ring1.rotation.x = Math.PI / 2;
  g.add(ring1);

  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.016, 12, 36), mGold);
  ring2.position.set(0, -0.65, 0);
  ring2.rotation.x = Math.PI / 2;
  g.add(ring2);

  // Ruby cabochons set around the midriff of the bell
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const rx = Math.cos(a) * 0.285;
    const rz = Math.sin(a) * 0.285;
    g.add(ball(0.035, mRuby, rx, -0.58, rz));
  }

  // --- Dangling Pearl & Bead Fringe Tassels ---
  const tasselCount = 14;
  for (let i = 0; i < tasselCount; i++) {
    const a = (i / tasselCount) * Math.PI * 2;
    const bx = Math.cos(a) * 0.24;
    const bz = Math.sin(a) * 0.24;
    // Tiny gold bead connector
    g.add(ball(0.015, mGold, bx, -0.82, bz));
    // Pearl drop
    g.add(ball(0.038, mPearl, bx, -0.88, bz));
    // Ruby micro-bead tip
    g.add(ball(0.016, mRuby, bx, -0.93, bz));
  }

  // Central majestic swinging finial inside/below the bell
  g.add(ball(0.065, mPearl, 0, -0.88, 0));
  g.add(ball(0.025, mGold, 0, -0.96, 0));

  return g;
}

function buildStud(metal: string): THREE.Group {
  const g = new THREE.Group();
  const mMetal = material(metal);
  const mDiamond = material('diamond');

  // Brilliant Solitaire Diamond (Faceted crown & pavilion)
  const gemMesh = facetedGem(0.18, mDiamond, 0, -0.08, 0.03);
  gemMesh.scale.set(1.1, 1.25, 1.1);
  g.add(gemMesh);

  // 6-Prong Basket Setting
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const px = Math.cos(a) * 0.17;
    const py = Math.sin(a) * 0.17;
    // Prong post
    const prong = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.16, 8), mMetal);
    prong.position.set(px, -0.08 + py * 0.1, -0.02);
    prong.rotation.z = -a;
    g.add(prong);
    // Prong tip claw gripping the diamond
    g.add(ball(0.026, mMetal, px * 0.95, -0.08 + py * 0.95, 0.06));
  }

  // Base circular basket gallery
  const gallery = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.02, 10, 24), mMetal);
  gallery.position.set(0, -0.08, -0.06);
  g.add(gallery);

  g.scale.setScalar(0.7);
  return g;
}

function buildHoop(metal: string): THREE.Group {
  const g = new THREE.Group();
  const mGold = material(metal);
  const mDiamond = material('diamond');

  // Tubular Gold Hoop
  const hoopMesh = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.038, 16, 50), mGold);
  hoopMesh.position.set(0, -0.45, 0);
  g.add(hoopMesh);

  // Front-facing pavé diamond stones embedded along the lower outer curvature
  const stones = 18;
  for (let i = 0; i < stones; i++) {
    const u = (i / (stones - 1)) * 1.6 - 0.8; // angle distribution
    const x = Math.sin(u) * 0.42;
    const y = -0.45 - Math.cos(u) * 0.42;
    g.add(facetedGem(0.022, mDiamond, x, y, 0.028));
  }

  // Secure latch hinge at the ear top
  g.add(ball(0.045, mGold, 0, -0.04, 0));
  return g;
}

function buildDrop(metal: string): THREE.Group {
  const g = new THREE.Group();
  const mGold = material(metal);
  const mDiamond = material('diamond');
  const mRuby = material('ruby');

  // Top stud gem
  g.add(facetedGem(0.06, mDiamond, 0, -0.06, 0.01));
  g.add(new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.014, 10, 20), mGold));

  // Articulated connection bar
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 8), mGold));
  g.children[g.children.length - 1].position.set(0, -0.18, 0);
  g.add(ball(0.024, mDiamond, 0, -0.26, 0.005));

  // Chandelier filigree tier
  const tier = lathe(
    [
      [0.02, -0.32],
      [0.15, -0.48],
      [0.2, -0.62],
      [0.12, -0.72],
      [0.01, -0.82],
    ],
    mGold,
    30,
  );
  g.add(tier);

  // Pear-cut Ruby drops
  const pearGeom = createPearGemGeometry(0.07);
  const rubyDrop = new THREE.Mesh(pearGeom, mRuby);
  rubyDrop.position.set(0, -0.88, 0);
  g.add(rubyDrop);

  // Accent side diamond drops
  for (const s of [-1, 1]) {
    g.add(ball(0.03, mDiamond, s * 0.16, -0.58, 0.01));
    const sideDrop = new THREE.Mesh(createPearGemGeometry(0.04), mDiamond);
    sideDrop.position.set(s * 0.16, -0.68, 0);
    g.add(sideDrop);
  }

  return g;
}

/* =========================================================================
   2. NECKLACES
   ========================================================================= */

function buildChoker(metal: string): THREE.Group {
  const g = new THREE.Group();
  const mGold = material(metal);
  const mEmerald = material('emerald');
  const mDiamond = material('diamond');
  const mRuby = material('ruby');

  // Multi-tier main structured gold collar curves
  const c1 = arc(1.05, 0.32, 0.04);
  const c2 = arc(0.96, 0.26, 0.0);
  const c3 = arc(0.88, 0.2, -0.04);

  g.add(chainTube(c1, mGold, 0.014));
  g.add(chainTube(c2, mGold, 0.018));
  g.add(chainTube(c3, mGold, 0.014));

  // Polki diamond tiles set between collar tiers
  const plates = 17;
  for (let i = 0; i < plates; i++) {
    const t = (i + 1) / (plates + 1);
    const p = c2.getPoint(t);
    // Gold square bezel
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.052, 0.02), mGold);
    plate.position.set(p.x, p.y, p.z);
    g.add(plate);
    // Uncut Polki / diamond crystal set inside bezel
    g.add(facetedGem(0.026, mDiamond, p.x, p.y, p.z + 0.014));
  }

  // Dangling Colombian Emerald drops with gold cup bails along lower contour
  const drops = 13;
  for (let i = 0; i < drops; i++) {
    const t = (i + 1) / (drops + 1);
    const p = c1.getPoint(t);
    // Gold link connector
    g.add(ball(0.016, mGold, p.x, p.y - 0.025, p.z));
    // Teardrop emerald bead
    const emDrop = new THREE.Mesh(createPearGemGeometry(0.038), mEmerald);
    emDrop.position.set(p.x, p.y - 0.075, p.z + 0.005);
    g.add(emDrop);
    // Accent ruby seed bead
    g.add(ball(0.014, mRuby, p.x, p.y - 0.12, p.z + 0.005));
  }

  return g;
}

function buildPendant(metal: string): THREE.Group {
  const g = new THREE.Group();
  const mGold = material(metal);
  const mDiamond = material('diamond');

  // Fine luxury delicate chain following catenary dip
  const c = arc(0.85, 0.52, 0.0);
  g.add(chainTube(c, mGold, 0.006));

  // Floating Solitaire Diamond Centerpiece
  const centerPt = c.getPoint(0.5); // lowest point of arc
  const pendantGroup = new THREE.Group();
  pendantGroup.position.set(centerPt.x, centerPt.y - 0.04, centerPt.z);

  // Bail (gold ring that slides on the chain)
  const bail = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.008, 10, 20), mGold);
  bail.rotation.y = Math.PI / 2;
  pendantGroup.add(bail);

  // Pear-cut or Brilliant Solitaire Diamond
  const diamondMesh = facetedGem(0.09, mDiamond, 0, -0.065, 0.01);
  pendantGroup.add(diamondMesh);

  // Diamond halo frame
  pendantGroup.add(new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.014, 12, 28), mGold));
  pendantGroup.children[pendantGroup.children.length - 1].position.set(0, -0.065, 0);

  // Micro-pavé halo diamonds
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    pendantGroup.add(facetedGem(0.018, mDiamond, Math.cos(a) * 0.095, -0.065 + Math.sin(a) * 0.095, 0.01));
  }

  g.add(pendantGroup);
  return g;
}

function buildHaar(metal: string): THREE.Group {
  const g = new THREE.Group();
  const mGold = material(metal);
  const mPearl = material('pearl');
  const mEmerald = material('emerald');
  const mRuby = material('ruby');
  const mDiamond = material('diamond');

  // Multi-strand graduated pearls cascading gracefully
  const strands = [
    { w: 1.05, d: 0.35, lift: 0.06, count: 26, pearlR: 0.024 },
    { w: 0.95, d: 0.52, lift: 0.02, count: 28, pearlR: 0.028 },
    { w: 0.85, d: 0.72, lift: -0.03, count: 32, pearlR: 0.032 },
  ];

  for (const s of strands) {
    const curve = arc(s.w, s.d, s.lift);
    g.add(chainTube(curve, mGold, 0.004));
    for (let i = 2; i < s.count - 2; i++) {
      const p = curve.getPoint(i / s.count);
      g.add(ball(s.pearlR, mPearl, p.x, p.y, p.z));
    }
  }

  // Grand Royal Centerpiece Medallion (at the lowest strand)
  const medPt = strands[2];
  const medCurve = arc(medPt.w, medPt.d, medPt.lift);
  const cp = medCurve.getPoint(0.5);

  const med = new THREE.Group();
  med.position.set(cp.x, cp.y - 0.06, cp.z + 0.01);

  // Ornate gold floral frame
  med.add(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.02, 28), mGold));
  med.children[0].rotation.x = Math.PI / 2;

  // Central large carved emerald/ruby cabochon
  med.add(ball(0.08, mRuby, 0, 0, 0.02));

  // Polki diamond halo
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    med.add(facetedGem(0.03, mDiamond, Math.cos(a) * 0.12, Math.sin(a) * 0.12, 0.02));
  }

  // Dangling South Sea Pearl drops with emerald tips
  for (let i = -2; i <= 2; i++) {
    const x = i * 0.055;
    const y = -0.15 - Math.abs(i) * 0.015;
    med.add(ball(0.032, mPearl, x, y, 0.01));
    med.add(ball(0.016, mEmerald, x, y - 0.045, 0.01));
  }

  g.add(med);
  return g;
}

/* =========================================================================
   EXPORT
   ========================================================================= */

export function buildProcedural(model: string, type: JewelType, metal: string): THREE.Group {
  const kind = model.replace('procedural:', '');
  if (type === 'earrings') {
    switch (kind) {
      case 'jhumka':
        return buildJhumka(metal);
      case 'stud':
        return buildStud(metal);
      case 'hoop':
        return buildHoop(metal);
      case 'drop':
      default:
        return buildDrop(metal);
    }
  } else {
    switch (kind) {
      case 'choker':
        return buildChoker(metal);
      case 'pendant':
        return buildPendant(metal);
      case 'haar':
      default:
        return buildHaar(metal);
    }
  }
}
