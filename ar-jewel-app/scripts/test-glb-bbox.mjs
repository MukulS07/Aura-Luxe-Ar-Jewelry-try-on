import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import fs from 'node:fs';

const loader = new GLTFLoader();
const buf = fs.readFileSync('m:/WEBSITES/AR JEWEL/ar-jewel-app/public/models/ruby-amulet.glb');

loader.parse(buf.buffer, '', (gltf) => {
  const root = gltf.scene;
  const box = new THREE.Box3().setFromObject(root);
  console.log('Parsed GLB BBox:', {
    min: box.min,
    max: box.max,
    size: box.getSize(new THREE.Vector3()),
    center: box.getCenter(new THREE.Vector3()),
  });
});
