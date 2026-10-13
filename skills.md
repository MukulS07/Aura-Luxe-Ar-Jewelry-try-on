# skills.md — AI Jewelry Try-On Booth

Skills the AI coding agent (and any human contributor) should apply to each designated area of this project. Source of truth for scope and priorities is the PRD. If this file and the PRD disagree, the PRD wins; flag the conflict.

## How to use this file

1. Find the area you are working on in the **Skill map** below.
2. Read that skill section fully before writing code.
3. Follow its **Rules**; finish only when its **Done when** list is true.
4. If a skill says "verify", test it on screen with a real face before relying on it. Do not assume.
5. Do not invent numbers, thresholds or file paths that the PRD does not state. Mark them `TODO(confirm)` and list them in your hand-off note.

## Project in one paragraph

A touchscreen kiosk web app. A visitor picks earrings or a necklace, the webcam turns on, and a 3D `.glb` piece is anchored to their face/neck and follows them in real time at about 30 FPS. Photo plus QR share. One web app: booth first, phone later (PWA). MVP = earrings and necklaces only, 5–10 pieces. Stack: MediaPipe (Face + Pose Landmarker), Three.js, Firebase or Supabase, Chrome kiosk mode.

## Skill map

| Area | Skill | PRD stage | Related PRD items |
| --- | --- | --- | --- |
| Tracking | S1 Face and body tracking | Stage 1 | FR-2, FR-7, FR-8 |
| Rendering | S2 Jewelry rendering and occlusion | Stage 1 | FR-3, FR-4, FR-5, FR-6 |
| 3D models | S3 3D asset pipeline | Stage 0–1 | Section 9 |
| Data | S4 Catalog and admin | Stage 2 | FR-9, FR-10, FR-11, FR-15 |
| Booth | S5 Kiosk UI and operations | Stage 2 | FR-1, FR-16, FR-17, FR-18 |
| Sharing | S6 Photo and QR share | Stage 2 | FR-12, FR-13 |
| Privacy | S7 Consent and privacy | Stage 2–3 | FR-14, security-privacy.md |
| Quality | S8 Testing and booth test | Stage 1–3 | Section 12 |
| Decision | S9 Build-or-buy SDK check | Stage 0 | Section 13 |

---

## S1 — Face and body tracking

**Use when:** getting landmarks from the webcam, choosing which person to track, stabilising the signal.

**Tools:** MediaPipe Tasks Vision — Face Landmarker and Pose Landmarker, running in the browser. Hand tracking is out of the MVP.

**Procedure**
1. Create the landmarkers once, with `runningMode: "VIDEO"`, and call `detectForVideo` on each new video frame. Never recreate them per frame.
2. Ask Face Landmarker for the facial transformation matrix (head position and rotation); the renderer needs it for earrings and occlusion.
3. Allow more than one face, then keep only the **closest person** (largest face size in frame). Keep that choice stable for a short hold time so tracking does not flip between people.
4. Smooth landmarks and the head pose with a light filter (exponential moving average or One Euro). Tune on a real face: too little = jitter, too much = lag.
5. Starting points for anchors — **verify on screen**:
   - Ears: Pose Landmarker ear points (7, 8) and the face-edge landmarks near each ear (234, 454), plus a per-piece offset.
   - Neck/necklace: shoulder points (11, 12) and chin (152). Place the necklace between the shoulders and below the chin.
6. Expose one tracking result object to the renderer: head pose, ear anchors, neck anchor, a confidence flag, and a rough scale (face width or shoulder width). The renderer must never call MediaPipe itself.
7. Host the MediaPipe WASM files and model files with the app (not from a CDN) so tracking works offline.

**Rules**
- Scale is approximate. Derive it from face or shoulder width. Do not claim true size.
- When confidence drops (no face, hair, turned away), fade the piece out instead of freezing it in place.
- No images or landmarks leave the browser. See S7.

**Done when**
- Earrings and necklace anchors follow a real person's movement at about 30 FPS on the booth PC.
- With two people in frame, only the closest is tracked.
- Works with the network disconnected.

**Pitfalls:** hair over ears; dark clothing or dupatta near the neck; harsh or uneven light; camera not at eye level.

---

## S2 — Jewelry rendering and occlusion

**Use when:** drawing `.glb` pieces over the live video, lighting, hiding parts of jewelry behind the head.

**Tools:** Three.js (WebGL), `GLTFLoader`, an environment map.

**Procedure**
1. Draw the mirrored video as the background, and a Three.js scene on top using the same camera framing, so 3D positions line up with video pixels.
2. Load a piece by catalog id, add it to an anchor group, and move the group each frame from the S1 tracking object. Switching pieces swaps the model only; never restart the camera or tracking (FR-11).
3. Lighting: one shared environment map for all pieces (for example from `PMREMGenerator`). Fake sparkle with the environment map, not with real gem optics.
4. Use the shared material library from S3. Do not hand-tune a material per piece unless a piece truly needs it.
5. **Occlusion for head turns:** add an invisible head-shaped occluder mesh to the scene (writes depth, draws no colour) placed from the head pose, so earrings hide behind the face when the head turns (FR-5).
6. **Hair occlusion** (FR-6) is P1: attempt only after FR-5 works; one approach is a segmentation mask on the neck/ear region. Mark it `TODO(confirm)` if not done.
7. Dispose geometries, textures and materials when a piece is swapped. A kiosk runs all day; memory must stay flat.

**Rules**
- Do not use flat 2D images as a final look; they look cheap. 2D is acceptable only as a temporary placeholder.
- Keep per-frame work small: no per-frame allocations in the render loop.
- Show a frame-rate counter in a debug mode only.

**Done when**
- Earrings follow the ears and disappear behind the face on head turns.
- A necklace follows the neck and shoulders.
- 30 minutes of continuous use shows no growing memory or falling frame rate.

---

## S3 — 3D asset pipeline

**Brief for artists and manufacturers:** `docs/CAD-BRIEF.md` (orientation, units, part names, budgets). Check a delivered file with `npm run check:glb -- file.glb --id <catalog id>`; shrink with `npm run optimize:glb -- in.glb out.glb`.

**Use when:** getting a real piece into the catalog as a `.glb`, or checking a model someone else made.

**Sourcing order (cheapest to best)**
1. Manufacturer CAD (Matrix, RhinoGold, JewelCAD) → convert to `.glb`. Try this first for the top 5 designs.
2. Turntable photos (about 40–70, soft even light, light tent) → freelance 3D artist rebuilds a clean model in Blender. Get a quote first; cost varies with complexity.
3. AI image-to-3D or scan apps (Polycam, Kiri Engine, Meshy, Tripo): only for testing the idea. They struggle with reflective metal, gems and thin chains.
4. Hardware scanners: skip.

**Rules**
- **Never** use matte scanning spray on real pieces (residue; risky on pearls and soft stones).
- One shared material library, reused everywhere: yellow gold, rose gold, silver, diamond, ruby, emerald, pearl.
- Low polygon count, compressed `.glb`, a few MB at most per piece, so phones can run it later.
- Consistent units and orientation across all models (decide once, document it here as `TODO(confirm)` until fixed).
- Start with 5–10 best sellers, not the full catalog.

**Acceptance checklist for each model** (copy into the catalog PR)
- [ ] Opens in the viewer; correct scale and orientation
- [ ] Uses library materials only (or an approved exception)
- [ ] File size within the agreed limit
- [ ] Anchor offset and scale set in its catalog entry
- [ ] **Tested on a moving face in the try-on app**, not just alone in a viewer

**Done when** the piece passes the checklist and a person has judged it on the booth setup.

---

## S4 — Catalog and admin

**Use when:** the catalog data model, loading items, the admin page, Firebase/Supabase.

**Proposed catalog record** (confirm against PRD section 9). `story` is optional (FR-22, P2): 1–3 callouts for the Details panel. Text and photos come from the business; never invent craft claims.

```json
{
  "id": "ear-001",
  "name": "Jhumka Gold",
  "type": "earrings",
  "model": "models/ear-001.glb",
  "thumbnail": "thumbs/ear-001.jpg",
  "material": "yellow-gold",
  "anchor": { "offset": [0, -0.01, 0], "scale": 1.0 },
  "story": [{ "title": "Double cut kundan", "text": "Short note on the craft.", "photo": "story/ear-001-a.jpg" }],
  "active": true
}
```

**Procedure**
1. Catalog is a JSON list. The booth caches it and the `.glb` files locally; it refreshes only when online (FR-18).
2. The picker filters by type (earrings, necklace). Inactive items are hidden.
3. Admin page (P1): add, edit, hide items; upload `.glb` and thumbnail; preview the piece on a face before publishing.
4. Backend is Firebase or Supabase, used only for the catalog, saved photos and share links. No large server.
5. The admin page must require sign-in. Details in `security-privacy.md`.

**Done when** staff can add a piece with no code change, and the booth shows it after the next online refresh.

---

## S5 — Kiosk UI and operations

**Use when:** screens, touch layout, kiosk behaviour, idle reset, offline mode.

**Procedure**
1. Design for a 24–32 inch **portrait** touchscreen. Targets are big and thumb-friendly; no hover states; no tiny text.
2. Flow follows the PRD journey: start screen → privacy notice → pick a piece → live try-on → take photo → save + QR or discard → return to start.
3. Chrome in full-screen kiosk mode, starting on boot. The camera permission must not prompt in front of visitors; configure this at the browser/OS level for the kiosk machine and document it.
4. **Idle reset (FR-17):** after inactivity, return to the start screen, stop the camera, clear any in-memory photo.
5. Try-on must work offline (FR-18). Load MediaPipe files, models and the catalog from local cache.
6. Visual style comes from `design.md`. Do not invent a style here.

**Done when** a visitor with no instructions can go from start screen to try-on, and the kiosk recovers by itself after idle, reboot or a lost connection.

---

## S6 — Photo and QR share

**Use when:** capture, upload, QR code, the share page.

**Procedure**
1. Capture the composited frame (video + jewelry) with a short countdown.
2. Ask for consent **before** saving anything (S7). No consent → discard from memory.
3. On consent, upload to the backend, create a share link, and show it as a QR code on the booth screen.
4. The link opens a simple photo page that works on phones. In the MVP this page shows the photo; full try-on on phones is Stage 4.
5. Link expiry and who can see photos: follow `security-privacy.md`. Until it exists, mark as `TODO(confirm)`.

**Done when** a photo taken at the booth can be opened on a phone by scanning the QR code, and a declined photo is stored nowhere.

---

## S7 — Consent and privacy

**Use when:** anything that touches the camera, images, stored data or the QR link. Full rules will live in `security-privacy.md`; this is the working summary.

**Rules**
- Show a clear notice **before** the camera is used.
- Process video in the browser. Do not store or transmit camera frames except a photo the visitor agrees to save.
- Do not store any image without consent (FR-14).
- Idle reset clears photos from memory.
- Admin and backend access are restricted; no public write access to the catalog or photo storage.
- Never log images, landmarks or faces. Analytics (P2) count events only.

**Done when** the privacy notice is shown on every session, a declined photo leaves no copy, and no backend route is open to the public for writing.

---

## S8 — Testing and the booth test

**Use when:** verifying a stage gate, or preparing the week-6 test.

**Per-change checks**
- FPS on the booth PC (target about 30).
- Earrings and necklace on at least several different faces, with and without hair over the ears, glasses, a dupatta or dark clothing.
- Head turns left and right; moving closer and farther.
- Two or more people in frame.
- Offline run (disconnect network).

**Device checks (before Phase 2):** a low-end Android phone and an iPhone in Safari. Tracking will be slower on cheap phones and Safari has camera quirks.

**Booth test (Stage 3):** real booth, real lighting, real customers. Record what broke (hair, head turns, lighting, crowds) and set the missing metric targets in PRD section 12 from the results.

**Done when** each gate in PRD section 11 has a written pass/fail note.

---

## S9 — Build-or-buy SDK check

**Use when:** Stage 0, before committing to custom tracking and rendering.

**Procedure**
1. Compare building with MediaPipe + Three.js against paid SDKs (DeepAR, Banuba; also Snap Camera Kit and Perfect Corp).
2. Same test for every option: earrings and necklace on a real face, head turns, a 3D `.glb` from the catalog, run on the booth PC.
3. Record: quality, time to ship, cost, licence terms for a kiosk, offline support, and whether it can later run on phones.
4. Output a one-page recommendation. Default is MediaPipe + Three.js unless an SDK is clearly better.

**Done when** a decision is recorded and the PRD open question is closed.

---

## Hand-off note (end of every task)

Write, in this order: what changed; which skill sections you followed; which "Done when" items are met; any `TODO(confirm)` you added; anything you could not test.
