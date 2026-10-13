import fs from 'node:fs';
import path from 'node:path';

// Analyze the OBJ files of Ruby amulet
const dir = 'm:/WEBSITES/AR JEWEL/Ruby amulet';

// Let's inspect model_0, model_1, model_3 (the chain)
// and model_2, model_4 (the pendant)
for (let i = 0; i <= 4; i++) {
  const content = fs.readFileSync(path.join(dir, `model_${i}.obj`), 'utf8');
  let minY = Infinity,
    maxY = -Infinity,
    minX = Infinity,
    maxX = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;
  for (const line of content.split('\n')) {
    if (line.startsWith('v ')) {
      const p = line.trim().split(/\s+/).slice(1).map(Number);
      if (p[0] < minX) minX = p[0];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[1] > maxY) maxY = p[1];
      if (p[2] < minZ) minZ = p[2];
      if (p[2] > maxZ) maxZ = p[2];
    }
  }
  console.log(`Part ${i}:`, {
    X: [minX.toFixed(2), maxX.toFixed(2)],
    Y: [minY.toFixed(2), maxY.toFixed(2)],
    Z: [minZ.toFixed(2), maxZ.toFixed(2)],
  });
}
