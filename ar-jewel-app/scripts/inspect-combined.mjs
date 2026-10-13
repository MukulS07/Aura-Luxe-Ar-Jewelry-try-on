import fs from 'node:fs';
import path from 'node:path';

const dir = 'm:/WEBSITES/AR JEWEL/Ruby amulet';
let minX = Infinity,
  maxX = -Infinity,
  minY = Infinity,
  maxY = -Infinity,
  minZ = Infinity,
  maxZ = -Infinity;
let totalV = 0,
  totalF = 0;

for (let i = 0; i <= 4; i++) {
  const content = fs.readFileSync(path.join(dir, `model_${i}.obj`), 'utf8');
  for (const line of content.split('\n')) {
    if (line.startsWith('v ')) {
      totalV++;
      const p = line.trim().split(/\s+/).slice(1).map(Number);
      if (p[0] < minX) minX = p[0];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[1] > maxY) maxY = p[1];
      if (p[2] < minZ) minZ = p[2];
      if (p[2] > maxZ) maxZ = p[2];
    } else if (line.startsWith('f ')) {
      totalF++;
    }
  }
}

console.log('Combined Amulet:', {
  totalVertices: totalV,
  totalFaces: totalF,
  bounds: {
    x: [minX, maxX],
    y: [minY, maxY],
    z: [minZ, maxZ],
  },
  width: +(maxX - minX).toFixed(3),
  height: +(maxY - minY).toFixed(3),
  depth: +(maxZ - minZ).toFixed(3),
  centerX: +((minX + maxX) / 2).toFixed(3),
  lowestY: minY,
  highestY: maxY,
});
