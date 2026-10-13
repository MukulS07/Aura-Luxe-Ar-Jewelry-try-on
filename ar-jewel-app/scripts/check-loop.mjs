import fs from 'node:fs';
import path from 'node:path';

const dir = 'm:/WEBSITES/AR JEWEL/Ruby amulet';

// Let's find:
// 1. Center of the top loop (Part 1 is the top loop):
const part1 = fs.readFileSync(path.join(dir, 'model_1.obj'), 'utf8');
let topMinY = Infinity,
  topMaxY = -Infinity,
  topMinX = Infinity,
  topMaxX = -Infinity;
for (const line of part1.split('\n')) {
  if (line.startsWith('v ')) {
    const p = line.trim().split(/\s+/).slice(1).map(Number);
    if (p[0] < topMinX) topMinX = p[0];
    if (p[0] > topMaxX) topMaxX = p[0];
    if (p[1] < topMinY) topMinY = p[1];
    if (p[1] > topMaxY) topMaxY = p[1];
  }
}

// 2. Center of Part 4 (the Ruby gem):
const part4 = fs.readFileSync(path.join(dir, 'model_4.obj'), 'utf8');
let gemMinY = Infinity,
  gemMaxY = -Infinity,
  gemMinX = Infinity,
  gemMaxX = -Infinity;
for (const line of part4.split('\n')) {
  if (line.startsWith('v ')) {
    const p = line.trim().split(/\s+/).slice(1).map(Number);
    if (p[0] < gemMinX) gemMinX = p[0];
    if (p[0] > gemMaxX) gemMaxX = p[0];
    if (p[1] < gemMinY) gemMinY = p[1];
    if (p[1] > gemMaxY) gemMaxY = p[1];
  }
}

console.log('Top loop (Part 1):', {
  X: [topMinX, topMaxX],
  Y: [topMinY, topMaxY],
  midX: (topMinX + topMaxX) / 2,
  midY: (topMinY + topMaxY) / 2,
});
console.log('Gemstone (Part 4):', {
  X: [gemMinX, gemMaxX],
  Y: [gemMinY, gemMaxY],
  midX: (gemMinX + gemMaxX) / 2,
  midY: (gemMinY + gemMaxY) / 2,
});
