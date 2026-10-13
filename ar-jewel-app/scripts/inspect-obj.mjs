import fs from 'node:fs';
import path from 'node:path';

const dir = 'm:/WEBSITES/AR JEWEL/Ruby amulet';
for (const file of fs.readdirSync(dir)) {
  if (!file.endsWith('.obj')) continue;
  const content = fs.readFileSync(path.join(dir, file), 'utf8');
  const lines = content.split('\n');
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;
  let vCount = 0,
    fCount = 0,
    mtl = '',
    usemtl = new Set();
  for (const line of lines) {
    if (line.startsWith('v ')) {
      vCount++;
      const parts = line.trim().split(/\s+/).slice(1).map(Number);
      if (parts[0] < minX) minX = parts[0];
      if (parts[0] > maxX) maxX = parts[0];
      if (parts[1] < minY) minY = parts[1];
      if (parts[1] > maxY) maxY = parts[1];
      if (parts[2] < minZ) minZ = parts[2];
      if (parts[2] > maxZ) maxZ = parts[2];
    } else if (line.startsWith('f ')) {
      fCount++;
    } else if (line.startsWith('mtllib ')) {
      mtl = line.trim();
    } else if (line.startsWith('usemtl ')) {
      usemtl.add(line.trim());
    }
  }
  console.log(file, {
    vCount,
    fCount,
    mtl,
    usemtl: [...usemtl],
    size: [+(maxX - minX).toFixed(3), +(maxY - minY).toFixed(3), +(maxZ - minZ).toFixed(3)],
    center: [+((minX + maxX) / 2).toFixed(3), +((minY + maxY) / 2).toFixed(3), +((minZ + maxZ) / 2).toFixed(3)],
  });
}
