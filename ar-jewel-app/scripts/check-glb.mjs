// Check a delivered jewelry .glb against docs/CAD-BRIEF.md before it goes into the catalog.
//
//   node scripts/check-glb.mjs <file.glb> [--id ear-001] [--type earrings|necklace|ring|bangle] [--size <mm>]
//
// --id reads type and real size from public/catalog.json. Exit code 1 when any check FAILs.
import { readFileSync, statSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { getBounds } from '@gltf-transform/functions';
import { MeshoptDecoder } from 'meshoptimizer';
import draco3d from 'draco3dgltf';

// Keep in sync with src/render/naming.ts
const PREFIXES = ['ROSEGOLD_', 'GOLD_', 'SILVER_', 'PLATINUM_', 'WHITEGOLD_', 'DIAMOND_', 'POLKI_', 'RUBY_', 'EMERALD_', 'PEARL_', 'KEEP_'];
const BUDGET_TRIS = { earrings: 40_000, necklace: 80_000, ring: 30_000, bangle: 40_000 };
const MB = 1024 * 1024;
// Plausible real sizes in mm for the biggest dimension, used when no expected size is given
const PLAUSIBLE_MM = { earrings: [8, 120], necklace: [60, 260], ring: [10, 40], bangle: [50, 100] };

const args = process.argv.slice(2);
const file = args[0];
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
if (!file || file.startsWith('--')) {
  console.error('usage: node scripts/check-glb.mjs <file.glb> [--id ear-001] [--type earrings|necklace|ring|bangle] [--size <mm>]');
  process.exit(2);
}

let type = opt('type');
let expectedMm = opt('size') ? Number(opt('size')) : undefined;
if (opt('id')) {
  const item = JSON.parse(readFileSync('public/catalog.json', 'utf8')).find((i) => i.id === opt('id'));
  if (!item) {
    console.error(`id ${opt('id')} is not in public/catalog.json`);
    process.exit(2);
  }
  type ??= item.type;
  expectedMm ??= item.dimensions?.sizeMm;
}
if (!BUDGET_TRIS[type]) {
  console.error('give --type earrings|necklace|ring|bangle (or --id)');
  process.exit(2);
}

const results = [];
const add = (level, msg) => results.push([level, msg]);

await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'draco3d.decoder': await draco3d.createDecoderModule() });
const doc = await io.read(file);
const root = doc.getRoot();

// 1. file size
const bytes = statSync(file).size;
const mb = (bytes / MB).toFixed(2);
add(bytes > 8 * MB ? 'FAIL' : bytes > 5 * MB ? 'WARN' : 'PASS', `file size ${mb} MB (aim for under 5, hard limit 8)`);

// 2. scene structure
const scenes = root.listScenes();
add(scenes.length === 1 ? 'PASS' : 'FAIL', `${scenes.length} scene(s) (need exactly 1)`);
const extra = [
  root.listCameras().length && 'cameras',
  root.listAnimations().length && 'animations',
  root.listExtensionsUsed().some((e) => e.extensionName === 'KHR_lights_punctual') && 'lights',
].filter(Boolean);
add(extra.length ? 'WARN' : 'PASS', extra.length ? `contains ${extra.join(', ')} (remove them)` : 'no cameras, lights or animations');

// 3. triangles
let tris = 0;
for (const mesh of root.listMeshes())
  for (const prim of mesh.listPrimitives()) {
    const idx = prim.getIndices();
    const count = idx ? idx.getCount() : (prim.getAttribute('POSITION')?.getCount() ?? 0);
    if (prim.getMode() === 4) tris += count / 3;
  }
const budget = BUDGET_TRIS[type];
add(
  tris > budget * 2 ? 'FAIL' : tris > budget ? 'WARN' : 'PASS',
  `${Math.round(tris).toLocaleString()} triangles (budget ${budget.toLocaleString()} for ${type})`,
);

// 4. size, orientation, centring
const { min, max } = getBounds(scenes[0]);
const dim = { x: (max[0] - min[0]) * 1000, y: (max[1] - min[1]) * 1000, z: (max[2] - min[2]) * 1000 };
add(
  'INFO',
  `bounding box ${dim.x.toFixed(1)} x ${dim.y.toFixed(1)} x ${dim.z.toFixed(1)} mm (width x height x depth; glTF unit is the metre)`,
);
const measured = type === 'earrings' ? dim.y : type === 'necklace' ? dim.x : Math.max(dim.x, dim.y, dim.z);
if (expectedMm) {
  const off = Math.abs(measured - expectedMm) / expectedMm;
  add(
    off > 0.4 ? 'FAIL' : off > 0.15 ? 'WARN' : 'PASS',
    `${type === 'earrings' ? 'height' : type === 'necklace' ? 'width' : 'largest size'} ${measured.toFixed(1)} mm vs ${expectedMm} mm expected (${(off * 100).toFixed(0)}% off)`,
  );
} else {
  const [lo, hi] = PLAUSIBLE_MM[type];
  add(
    measured < lo || measured > hi ? 'FAIL' : 'PASS',
    `size ${measured.toFixed(1)} mm (plausible ${lo} to ${hi} for ${type}); wrong units are the usual cause when this fails`,
  );
}
if (type === 'earrings') add(dim.y >= dim.x * 0.8 ? 'PASS' : 'WARN', 'earring is at least as tall as wide (hangs along Y)');
if (type === 'necklace') add(dim.x >= dim.y * 0.8 ? 'PASS' : 'WARN', 'necklace is at least as wide as tall (spans X)');
const cx = ((max[0] + min[0]) / 2) * 1000;
add(Math.abs(cx) <= dim.x * 0.1 ? 'PASS' : 'WARN', `centred left to right (offset ${cx.toFixed(1)} mm)`);
if (type === 'necklace') add(dim.z >= 8 ? 'PASS' : 'WARN', `necklace has curve/depth (${dim.z.toFixed(0)} mm); a flat lay looks pasted on`);

// 5. part names -> materials
const meshNodes = root.listNodes().filter((n) => n.getMesh());
const named = meshNodes.filter((n) =>
  PREFIXES.some((p) => n.getName().toUpperCase().startsWith(p) || n.getParentNode()?.getName().toUpperCase().startsWith(p)),
);
const unnamed = meshNodes.filter((n) => !named.includes(n)).map((n) => n.getName() || '(unnamed)');
add(
  unnamed.length === 0 ? 'PASS' : named.length === 0 ? 'FAIL' : 'WARN',
  unnamed.length === 0
    ? `all ${meshNodes.length} parts follow the naming convention`
    : `${unnamed.length} of ${meshNodes.length} parts have no GOLD_/DIAMOND_/... prefix: ${unnamed.slice(0, 6).join(', ')}${unnamed.length > 6 ? ', ...' : ''}`,
);

// 6. textures
const texs = root.listTextures();
let worst = 0;
for (const t of texs) {
  try {
    const [w, h] = t.getSize() ?? [0, 0];
    worst = Math.max(worst, w, h);
  } catch {
    /* unreadable size: ignore */
  }
}
add(
  worst > 2048 ? 'FAIL' : worst > 1024 ? 'WARN' : 'PASS',
  texs.length
    ? `${texs.length} texture(s), largest ${worst}px (aim for 1024 or less)`
    : 'no textures (good: the app lights metal and stones itself)',
);

// report
const width = Math.max(...results.map(([l]) => l.length));
for (const [level, msg] of results) console.log(`${level.padEnd(width)}  ${msg}`);
const fails = results.filter(([l]) => l === 'FAIL').length;
const warns = results.filter(([l]) => l === 'WARN').length;
console.log(`\n${fails ? 'NOT READY' : warns ? 'READY WITH WARNINGS' : 'READY'}: ${fails} fail, ${warns} warn  (${file})`);
process.exitCode = fails ? 1 : 0;
