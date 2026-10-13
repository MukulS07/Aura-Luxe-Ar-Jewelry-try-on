# agent.md — AI Jewelry Try-On Booth

Instructions for the AI coding agent that builds this project. Read this file first on every session. Humans can use it as the contributor guide.

## 1. Mission

Build a touchscreen kiosk web app where a visitor picks earrings or a necklace, the webcam turns on, and a 3D piece follows their face and neck in real time at about 30 FPS. They can take a photo and share it by QR code. The same web app later runs on phones.

**MVP scope:** earrings and necklaces only, 5–10 pieces, booth screen first. Everything else is out of scope until the PRD says otherwise.

## 2. Source-of-truth documents

Read these before working. If they conflict, use this order:

1. **PRD** ("AI Jewelry Try-On Booth — PRD"): scope, requirement IDs (FR-1 to FR-21), stages and gates.
2. **security-privacy.md**: data, consent, security rules. Never weaken these.
3. **skills.md**: how to do each kind of task (S1 tracking, S2 rendering, S3 3D assets, S4 catalog/admin, S5 kiosk, S6 photo/QR, S7 privacy, S8 testing, S9 SDK check).
4. **design.md** (when it exists): screens, look and feel. Do not invent a visual style.
5. **terms-and-conditions.md**: public wording; keep on-screen text consistent with it.
6. This file.

If something is not covered anywhere, do not guess. Add a `TODO(confirm)` and list it in your hand-off note.

## 3. Hard rules (never break these)

1. **No camera frames, landmarks or faces leave the browser**, are logged, or are stored. Only a photo the visitor explicitly saves is uploaded.
2. **Privacy notice before the camera starts**, every session. Separate "save" tap before any upload.
3. **No face recognition or identification.** No face templates, no user profiles.
4. **No secrets in front-end code.** No admin keys, service keys or tokens in the repo.
5. **Backend is default-deny.** Write the access rules before the feature that needs them.
6. **Try-on works offline.** MediaPipe files, models and the cached catalog are served locally. Do not load them from a third-party CDN at runtime.
7. **Do not invent numbers** (thresholds, sizes, retention periods, targets). If the PRD does not state it, use `TODO(confirm)`.
8. **Do not add dependencies, trackers or analytics** that send data to third parties without asking.
9. **Do not expand scope.** No outfit try-on, makeup, native apps or depth cameras in the MVP. Hand tracking for rings and bangles is allowed only as an experimental, flagged track (owner decision 2026-10-12); it never blocks the earring and necklace MVP.
10. **Do not recommend anything that could damage real jewelry** (for example matte scanning spray) in docs or tooling you write.

## 4. Tech stack

Fixed by the PRD:
- Tracking: MediaPipe Tasks Vision (Face Landmarker, Pose Landmarker), in the browser.
- Rendering: Three.js (WebGL), `.glb` models.
- Backend: Firebase **or** Supabase (not yet chosen: `TODO(confirm)`). Used only for the catalog, saved photos and share links.
- Kiosk: Chrome in full-screen kiosk mode.
- One web app; phone later via PWA (Capacitor only if a store listing is wanted).

Proposed by this file (confirm before locking in):
- TypeScript, Vite, plain DOM or a light UI library (no heavy framework needed for a kiosk).
- ESLint + Prettier; Vitest for unit tests; Playwright for end-to-end checks.
- Package manager: `TODO(confirm)` (npm or pnpm). Use whichever the repo already uses.

## 5. Proposed repo layout

```
/
├─ agent.md
├─ docs/                 PRD export, skills.md, security-privacy.md, design.md, terms-and-conditions.md
├─ public/
│  ├─ models/            .glb jewelry models (compressed)
│  ├─ thumbs/            catalog thumbnails
│  ├─ mediapipe/         self-hosted WASM + model files
│  └─ catalog.json       seed catalog (booth cache source)
├─ src/
│  ├─ tracking/          S1: landmarkers, closest-person pick, smoothing, TrackingResult
│  ├─ render/            S2: scene, video background, anchors, occluder, env map, disposal
│  ├─ catalog/           S4: load/cache catalog, types
│  ├─ ui/                S5: screens (start, notice, picker, try-on, photo, qr, idle)
│  ├─ share/             S6: capture, consent gate, upload, QR
│  ├─ privacy/           S7: notice state, consent state, idle reset
│  ├─ backend/           client for Firebase/Supabase + access rules in /backend-rules
│  ├─ admin/             S4: admin page (P1)
│  └─ main.ts
├─ backend-rules/        security rules / RLS, scheduled cleanup
├─ tests/
└─ scripts/              kiosk setup notes, model checks
```

This layout is a proposal. If the repo already has a structure, follow it and note the difference.

## 6. Commands

`TODO(confirm)` once the project is scaffolded. When it is, record them here exactly:

```
(run inside ar-jewel-app/)
install:   npm install
setup:     npm run setup      # downloads the self-hosted MediaPipe models
dev:       npm run dev
build:     npm run build
test:      npm test
lint:      npm run lint
format:    npm run format
e2e:       npm run e2e        # real Chrome + MediaPipe on public/hero.jpg (e2e/tracking.spec.ts)
```

Before you say a task is done, run lint, unit tests and the build. Run e2e when the change touches the visitor flow.

## 7. Architecture rules

- **One tracking result object** goes from `tracking/` to `render/`: head pose, ear anchors, neck anchor, confidence, rough scale. The renderer never calls MediaPipe.
- **Screens are a small state machine:** `start → notice → pick → live → photo → (save | discard) → start`, plus `idle → start`. Illegal transitions must be impossible. The camera runs only in `live` and `photo`.
- **Switching a piece never restarts the camera or tracking** (FR-11).
- **Dispose everything** you create in the render loop (geometry, textures, materials). No per-frame allocations in hot paths.
- **Idle reset** stops the camera and clears any in-memory photo (FR-17).
- **Catalog entries are data, not code.** A new piece must need no code change.
- Keep modules small and typed. No `any` unless commented why.
- Debug tools (FPS counter, landmarks overlay) sit behind a debug flag and are off in kiosk builds.

## 8. Work plan by stage

Follow the PRD stages in order. Do not start a stage until the previous gate is met.

| Stage | Build | Skills | Gate (from the PRD) |
| --- | --- | --- | --- |
| 0 Prepare | Build-or-buy comparison; CAD requests; freelancer trial; fix catalog size and hardware list | S9, S3 | Build or buy decided; CAD requested for top 5 |
| 1 Prototype (weeks 1–3) | Earrings + necklace on a laptop webcam; 5–10 test pieces; head-turn occlusion; closest-person tracking | S1, S2, S3 | Smooth at about 30 FPS and look right in motion |
| 2 Booth app (weeks 4–5) | Touchscreen UI, catalog picker, photo, QR share, kiosk mode, privacy notice, idle reset, backend rules, admin page | S4, S5, S6, S7 | Visitor goes start screen → QR photo on booth hardware |
| 3 Booth test (week 6) | Real booth, lighting, customers; fix findings | S8 | Findings fixed; metric targets set |
| 4 After MVP | Phone PWA, more jewelry types, analytics, more catalog | S1–S8 | n/a |

### Suggested task order inside Stage 1

1. Scaffold the app and a webcam page; get Face + Pose Landmarker running on the laptop (self-hosted files).
2. Draw the mirrored video and a Three.js scene aligned to it.
3. Place a simple test object on the ears and neck from the tracking result.
4. Load a real `.glb`; add the shared environment map and material library.
5. Add smoothing and the closest-person rule.
6. Add the head occluder for earrings (FR-5).
7. Test on several faces and lighting conditions; record the results.

### Suggested task order inside Stage 2

1. Screen state machine and the privacy notice.
2. Catalog loading and local cache; picker UI with the type filter.
3. Photo capture, consent gate, upload, QR.
4. Backend rules, expiry job, token links, `noindex` photo page.
5. Idle reset and kiosk setup notes.
6. Admin page with sign-in and MFA.

## 9. Testing and quality

- Unit tests for pure logic: closest-person pick, smoothing, catalog parsing, state machine transitions, consent gate.
- E2E tests (Playwright with a fake camera stream) for: notice before camera; declined photo leaves nothing stored; idle reset; switching pieces keeps the camera on.
- Backend rules tests: an unauthenticated client cannot write the catalog, list photos, or read a photo without its token.
- Performance check on the booth PC: FPS, and 30 minutes of use with flat memory.
- For anything visual, run it and look at it. A passing type-check does not prove the earrings sit on the ears.

## 10. When to ask the human

Stop and ask (do not guess) when:
- a decision is listed under Open Questions in the PRD or `TODO(confirm)` in any doc (retention period, backend choice, region, SDK choice, catalog size);
- a change would add data collection, a third-party service, or a paid SDK;
- the PRD and another doc disagree;
- real jewelry models, CAD files, brand assets or booth hardware are needed and you do not have them;
- an action is hard to undo (deleting data, changing backend access rules in production, rotating keys).

Otherwise, make the most reasonable choice, state it, and keep going.

## 11. Git and change hygiene

- Small, focused commits; message says what and why.
- Do not commit `.glb` files that exceed the size limit, secrets, `.env` files, or personal photos.
- Never commit real visitor photos or test photos of real people without their permission. Use synthetic or consented test images.
- Update the docs when behaviour changes (PRD requirement status, `security-privacy.md` data table, `skills.md` procedures).

## 12. Definition of done (every task)

- [ ] Meets the relevant requirement IDs and the skill's "Done when" list
- [ ] Hard rules in section 3 still hold
- [ ] Lint, unit tests and build pass; e2e passes if the visitor flow changed
- [ ] Tried visually on screen, not only by reading code
- [ ] No new `any`, dead code, or unused dependencies
- [ ] Docs updated if behaviour or data changed
- [ ] Hand-off note written

## 13. Hand-off note format

At the end of every task, write:

1. **What changed** (files and behaviour, briefly)
2. **Requirements covered** (FR IDs) and skills followed (S-numbers)
3. **How I checked it** (commands run, what I looked at)
4. **Not done / not tested** (and why)
5. **New `TODO(confirm)` items** and questions for the human
6. **Next suggested step**

Keep it short. No recap of every step you took.
