import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { CatalogItem, JewelType } from '../types';
import { material } from './materials';
import { keepsOwnMaterial, materialForName } from './naming';
import { buildProcedural } from './procedural';

/**
 * Load one catalog item as a ready-to-place group: model built or fetched, library materials applied,
 * scaled to unit size with its contact point at the origin (earring: top of the piece; necklace: top of the loop).
 */
export async function loadPiece(item: CatalogItem): Promise<THREE.Group> {
  const raw = item.model.startsWith('procedural:') ? buildProcedural(item.model, item.type, item.material) : await loadGlb(item);
  return normalise(raw, item.type);
}

async function loadGlb(item: CatalogItem): Promise<THREE.Object3D> {
  // Meshopt-compressed files load with the decoder bundled in the app (works offline)
  const root = (await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(item.model)).scene;
  const rules = item.materialRules ?? [];
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const names = [mesh.name, mesh.parent?.name];
    const rule = rules.find((r) => names.some((n) => n?.startsWith(r.match)));
    const byName = names.map(materialForName).find(Boolean); // CAD naming convention
    if (rule) mesh.material = material(rule.material);
    else if (byName && !names.some(keepsOwnMaterial)) mesh.material = material(byName);
    else (mesh.material as THREE.Material).transparent = true;
  });
  return root;
}

function normalise(root: THREE.Object3D, type: JewelType): THREE.Group {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const c = box.getCenter(new THREE.Vector3());
  // Earrings: height 1.0. Necklaces: width 1.0.
  const s = 1 / ((type === 'earrings' ? size.y : size.x) || 1);
  root.scale.setScalar(s);
  root.position.set(-c.x * s, -box.max.y * s, -c.z * s);
  const wrap = new THREE.Group();
  wrap.add(root);
  return wrap;
}

/** Second copy of a piece (the other ear) with its own materials, so each can fade alone. */
export function cloneIndependent(obj: THREE.Object3D): THREE.Object3D {
  const c = obj.clone(true);
  c.traverse((n) => {
    const m = n as THREE.Mesh;
    if (m.material) m.material = Array.isArray(m.material) ? m.material.map((x) => x.clone()) : m.material.clone();
  });
  return c;
}

export function disposeObject(o: THREE.Object3D) {
  o.traverse((n) => {
    const m = n as THREE.Mesh;
    m.geometry?.dispose();
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mat of mats) {
      for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose();
      mat.dispose();
    }
  });
}
