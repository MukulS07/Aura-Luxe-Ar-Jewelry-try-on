// Self-host MediaPipe files so try-on works offline (agent.md rule 6).
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
const out = 'public/mediapipe';
mkdirSync(out, { recursive: true });
cpSync('node_modules/@mediapipe/tasks-vision/wasm', `${out}/wasm`, { recursive: true });
const base = 'https://storage.googleapis.com/mediapipe-models';
const models = {
  'face_landmarker.task': `${base}/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
  'pose_landmarker_lite.task': `${base}/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
  'pose_landmarker_full.task': `${base}/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task`,
  'hand_landmarker.task': `${base}/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
  'selfie_multiclass_256x256.tflite': `${base}/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite`,
};
for (const [name, url] of Object.entries(models)) {
  const dest = `${out}/${name}`;
  if (existsSync(dest)) continue;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  console.log('downloaded', name);
}
