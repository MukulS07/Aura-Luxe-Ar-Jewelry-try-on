import * as THREE from 'three';

/**
 * Luxury PBR Material Library for Fine Jewelry (Haute Joaillerie).
 * Utilizes MeshPhysicalMaterial for high-fidelity metal reflections,
 * diamond dispersion/transmission, pearl iridescence, and rich gem luster.
 */

// Procedural micro-surface normal map for brushed/gleaming metal and gem facets
function createSparkleNormalMap(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(size, size);
  for (let i = 0; i < imgData.data.length; i += 4) {
    const nx = 128 + Math.floor((Math.random() - 0.5) * 40);
    const ny = 128 + Math.floor((Math.random() - 0.5) * 40);
    imgData.data[i] = nx;
    imgData.data[i + 1] = ny;
    imgData.data[i + 2] = 255;
    imgData.data[i + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

let bumpTex: THREE.CanvasTexture | null = null;
function getBumpTex(): THREE.CanvasTexture {
  bumpTex ??= createSparkleNormalMap();
  return bumpTex;
}

const LIB: Record<string, () => THREE.MeshPhysicalMaterial> = {
  // 22K Royal Yellow Gold: rich warm yellow, high luster, micro specular sheen
  'yellow-gold': () =>
    new THREE.MeshPhysicalMaterial({
      color: 0xf5b838,
      emissive: 0x221502,
      metalness: 0.98,
      roughness: 0.16,
      clearcoat: 0.6,
      clearcoatRoughness: 0.15,
      reflectivity: 1.0,
      envMapIntensity: 2.8,
      normalMap: getBumpTex(),
      normalScale: new THREE.Vector2(0.02, 0.02),
    }),

  // 18K Rose Gold: copper-gold alloy, warm romantic luster
  'rose-gold': () =>
    new THREE.MeshPhysicalMaterial({
      color: 0xeca592,
      emissive: 0x1f0d08,
      metalness: 0.96,
      roughness: 0.18,
      clearcoat: 0.5,
      clearcoatRoughness: 0.18,
      reflectivity: 0.95,
      envMapIntensity: 2.5,
    }),

  // Platinum / Pure Silver: mirror brilliance, crisp cool specular
  silver: () =>
    new THREE.MeshPhysicalMaterial({
      color: 0xf0f3f6,
      metalness: 0.98,
      roughness: 0.12,
      clearcoat: 0.8,
      clearcoatRoughness: 0.1,
      reflectivity: 1.0,
      envMapIntensity: 3.0,
    }),

  // Brilliant Cut Diamond: high IOR (2.417), fiery dispersion, bright specular highlights
  diamond: () =>
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      emissive: 0x111622,
      metalness: 0.05,
      roughness: 0.02,
      transmission: 0.65,
      ior: 2.417,
      thickness: 1.2,
      specularIntensity: 2.0,
      specularColor: new THREE.Color(0xffffff),
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      envMapIntensity: 3.5,
      transparent: true,
      opacity: 0.96,
    }),

  // Pigeon Blood Ruby: deep saturated red with internal glow and high luster
  ruby: () =>
    new THREE.MeshPhysicalMaterial({
      color: 0xbd0f34,
      emissive: 0x44020a,
      metalness: 0.1,
      roughness: 0.06,
      transmission: 0.5,
      ior: 1.77,
      thickness: 1.0,
      specularIntensity: 1.6,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      envMapIntensity: 2.6,
      transparent: true,
      opacity: 0.95,
    }),

  // Colombian Emerald: deep radiant green with rich specular
  emerald: () =>
    new THREE.MeshPhysicalMaterial({
      color: 0x0c995e,
      emissive: 0x022915,
      metalness: 0.1,
      roughness: 0.06,
      transmission: 0.5,
      ior: 1.58,
      thickness: 1.0,
      specularIntensity: 1.6,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      envMapIntensity: 2.6,
      transparent: true,
      opacity: 0.95,
    }),

  // South Sea Pearl: soft satin luster, delicate iridescence orient
  pearl: () =>
    new THREE.MeshPhysicalMaterial({
      color: 0xfcf8f2,
      emissive: 0x14100c,
      metalness: 0.15,
      roughness: 0.22,
      clearcoat: 0.9,
      clearcoatRoughness: 0.12,
      iridescence: 0.65,
      iridescenceIOR: 1.35,
      reflectivity: 0.8,
      envMapIntensity: 1.8,
    }),
};

export const MATERIAL_NAMES = Object.keys(LIB);

export function material(name: string): THREE.MeshPhysicalMaterial {
  const factory = LIB[name] ?? LIB['yellow-gold'];
  const m = factory();
  m.transparent = true;
  return m;
}
