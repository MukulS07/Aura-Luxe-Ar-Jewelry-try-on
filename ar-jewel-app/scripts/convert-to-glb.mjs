import fs from 'node:fs';
import path from 'node:path';

// Browser shim for Node.js
if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buf) => {
        this.result = buf;
        this.onloadend?.({ target: this });
      });
    }
  };
}

import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

const dir = 'm:/WEBSITES/AR JEWEL/Ruby amulet';
const outDir = 'm:/WEBSITES/AR JEWEL/ar-jewel-app/public/models';
fs.mkdirSync(outDir, { recursive: true });

console.log('Loading OBJ files from', dir);

const loader = new OBJLoader();
const amuletGroup = new THREE.Group();
amuletGroup.name = 'RubyAmulet';

// PBR Materials
const goldMat = new THREE.MeshStandardMaterial({
  name: 'RoyalYellowGold',
  color: 0xf5b838,
  metalness: 0.95,
  roughness: 0.18,
  envMapIntensity: 2.5,
});

const rubyMat = new THREE.MeshStandardMaterial({
  name: 'PigeonBloodRuby',
  color: 0xbd0f34,
  metalness: 0.15,
  roughness: 0.05,
  envMapIntensity: 3.0,
});

for (let i = 0; i <= 4; i++) {
  const filePath = path.join(dir, `model_${i}.obj`);
  console.log(`Parsing model_${i}.obj...`);
  const content = fs.readFileSync(filePath, 'utf8');
  const obj = loader.parse(content);
  obj.name = `Part_${i}`;

  const isRuby = i === 4;
  const partMat = isRuby ? rubyMat : goldMat;

  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.name = `Part_${i}`;
      child.material = partMat;
      child.geometry.computeVertexNormals();
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  amuletGroup.add(obj);
}

// Compute accurate necklace bounds
const bbox = new THREE.Box3().setFromObject(amuletGroup);
console.log('Raw BBox:', { min: bbox.min, max: bbox.max });

// Top neck arch: Part 1 top is around Y = 8.0 to 8.88
// The chain loop rests at the base of the throat / nape at the top of the model.
// We align the top neck collar arch to Y = 0 so that:
// 1. The necklace wraps around the neck at Y = 0.
// 2. The chain drops down in negative Y towards the chest.
// 3. The ruby pendant hangs at the bottom (Y < 0).
const topNeckArchY = 7.6; // average collar resting height at the neck
const centerX = 0.0; // gem is centered at X = 0

// Width of the collar opening across the shoulders/neck:
const collarWidth = bbox.max.x - bbox.min.x; // ~4.06 units
const scaleFactor = 1.0 / collarWidth; // normalize width to 1.0 unit

const normalizedGroup = new THREE.Group();
normalizedGroup.name = 'RubyAmuletNecklace';

// Center X at 0, align collar arch at Y = 0, center Z
amuletGroup.position.set(-centerX, -topNeckArchY, -bbox.min.z);
amuletGroup.scale.setScalar(scaleFactor);
normalizedGroup.add(amuletGroup);

// Verify resulting bounds
const finalBBox = new THREE.Box3().setFromObject(normalizedGroup);
console.log('Final Normalized BBox:', {
  min: finalBBox.min,
  max: finalBBox.max,
  size: finalBBox.getSize(new THREE.Vector3()),
});

// Export to binary .glb
console.log('Exporting to binary GLB...');
const exporter = new GLTFExporter();
exporter.parse(
  normalizedGroup,
  (glb) => {
    const glbBuffer = Buffer.from(glb);
    const destPath = path.join(outDir, 'ruby-amulet.glb');
    fs.writeFileSync(destPath, glbBuffer);
    console.log(`Successfully exported ${destPath} (${(glbBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
    // Also copy to dist
    const distPath = path.join('m:/WEBSITES/AR JEWEL/ar-jewel-app/dist/models/ruby-amulet.glb');
    fs.mkdirSync(path.dirname(distPath), { recursive: true });
    fs.writeFileSync(distPath, glbBuffer);
    console.log(`Mirrored to ${distPath}`);
  },
  (err) => {
    console.error('Export failed:', err);
  },
  { binary: true },
);
