// Shrink a delivered jewelry .glb for the booth: remove duplicates and unused data, weld vertices, cap textures at 1024px
// (WebP) and compress the geometry with meshopt (the app bundles the decoder, so it works offline).
//
//   node scripts/optimize-glb.mjs <in.glb> <out.glb> [--simplify 0.25]
//
// --simplify keeps that share of the triangles (0.25 = a quarter). Use it to reach the budget when a model is too heavy;
// ask the artist for a lighter model if it has to go below about 0.3, because detail on the stones suffers.
import { statSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, simplify, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';

const [input, output] = process.argv.slice(2);
const si = process.argv.indexOf('--simplify');
const ratio = si >= 0 ? Number(process.argv[si + 1]) : undefined;
if (!input || !output) {
  console.error('usage: node scripts/optimize-glb.mjs <in.glb> <out.glb>');
  process.exit(2);
}
await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.decoder': MeshoptDecoder,
  'meshopt.encoder': MeshoptEncoder,
  'draco3d.decoder': await draco3d.createDecoderModule(),
});
const doc = await io.read(input);
const steps = [dedup(), prune(), weld()];
if (ratio) steps.push(simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.01 }));
steps.push(
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024] }),
  meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
);
await doc.transform(...steps);
await io.write(output, doc);
const mb = (f) => (statSync(f).size / 1024 / 1024).toFixed(2);
console.log(`${input}  ${mb(input)} MB  ->  ${output}  ${mb(output)} MB`);
