# AI Jewelry Try-On Booth — PRD

Oct 7, 2026 · @Sarang Shaw

## 1. Overview

The booth is a touchscreen kiosk where a customer picks a jewelry piece, the camera turns on, and the piece appears on them in real time and follows their movement. This is virtual (AR) try-on, the same idea Tanishq, CaratLane and Kalyan already use.

Version 1 is **one web app** that runs on the booth screen first and is reused as the phone experience later. The MVP covers **earrings and necklaces only**, with **5–10 pieces**, built on MediaPipe (tracking) and Three.js (3D rendering). A working prototype takes about 3 weeks; the real-booth test happens in week 6.

The hardest part of this project is not the code. It is making good 3D models of the jewelry, so the catalog size and model sourcing decide cost and schedule.

This PRD is the master document. Design, agent and security/privacy details will move into their own files (section 14).

## 2. Problem, goals and non-goals

**Problem.** A booth visitor cannot see how a piece looks on them without trying physical stock, and a booth visit leaves no follow-up once the person walks away. Virtual try-on removes the first problem and the shareable photo plus QR link addresses the second.

**Goals**

1. Realistic real-time try-on of earrings and necklaces, smooth at about 30 FPS on the booth PC.
2. A take-photo and QR-share flow, so visitors keep the result and the booth gets free marketing.
3. A catalog that staff can extend without a developer, through a small admin page.
4. One codebase that serves both the booth screen and, later, customers' phones.
5. A small system: browser tracking, a light backend (Firebase or Supabase), no big server.

**Non-goals for v1**

- Rings and bangles as finished features. **Update (2026-10-12):** hand tracking (MediaPipe Hand Landmarker) is now being built as an experimental track in Phase 1, behind a flag, so rings and bangles can be prototyped early. They are not part of the MVP acceptance criteria. Hand tracking is less stable (fingers move, rotate and block each other); `TODO(confirm)` when rings and bangles join the catalog.
- Outfit try-on and virtual makeup (possible but much harder).
- A depth camera, and true-to-size measurement (a single camera gives approximate size only).
- Native iOS/Android apps (only if the web version proves too slow on cheap phones).
- Full catalog coverage. Start with the best sellers.

## 3. Users and use cases

Three kinds of people use the system; the booth visitor is the one the MVP is built around.

| User | What they want | What the product must do |
| --- | --- | --- |
| Booth visitor | See a piece on themselves in seconds, without help | Start with one tap, show a convincing result, let them switch pieces fast, take a photo |
| Phone visitor (later) | Keep trying pieces at home after the event | Open from a QR link, run on their own phone camera, work on low-end Android and iPhone Safari |
| Booth staff / owner | Run the kiosk and keep the catalog fresh | Auto-start in kiosk mode, add or hide pieces from an admin page, recover without a developer |

**Core use cases**

1. A visitor walks up, browses the catalog on the touchscreen and taps an earring or necklace.
2. The camera turns on and the piece follows the visitor's face or neck as they move.
3. The visitor switches between pieces and takes a photo.
4. The visitor scans a QR code to get the photo on their phone and share it.
5. Staff add a new piece to the catalog and check it looks right before the next event.

## 4. Scope

The MVP is earrings and necklaces on the booth screen, tested in real conditions by week 6. Everything else waits.

| Phase | Included | Notes |
| --- | --- | --- |
| MVP (weeks 1–6) | Earrings and necklaces; 5–10 test pieces; touchscreen UI; JSON catalog; take-photo; QR share; kiosk mode; real-booth test | In the MVP the QR link opens the saved photo. Full try-on on phones comes next. |
| Phase 2 (after MVP) | Phone version as a PWA (Capacitor only if a Play Store / App Store listing is wanted); nose pins and maang tikka (face landmarks); analytics; craft story (Details) panel; more catalog pieces | Same code as the booth app |
| Phase 3 (only if needed) | Rings and bangles via hand tracking; depth camera; native apps; a paid AR SDK in place of custom tracking | Triggered by test results, not planned dates |
| Not planned | Outfit try-on, virtual makeup | Much harder; keep v1 jewelry only |

## 5. Booth experience: step by step

A visitor can go from the start screen to a shared photo in a few taps, and the booth always returns to a clean start screen for the next person.

&#91;embedded content: booth visitor journey · 6 steps, 1 decision\]

The camera turns on only after the privacy notice. Switching pieces keeps the camera and tracking running. A photo is saved only if the visitor agrees; otherwise it is discarded, and an idle booth resets itself after a period of inactivity.

## 6. Functional requirements

P0 = needed for the week-6 booth test. P1 = in the MVP if time allows. P2 = after the MVP.

| ID | Area | Requirement | Priority |
| --- | --- | --- | --- |
| FR-1 | Try-on | Camera starts when a visitor picks a piece; video is mirrored like a mirror | P0 |
| FR-2 | Try-on | Detect face landmarks and shoulder/neck points with MediaPipe Face Landmarker and Pose Landmarker | P0 |
| FR-3 | Try-on | Earrings anchor to the ear landmarks and follow the head in real time at about 30 FPS | P0 |
| FR-4 | Try-on | Necklaces anchor to neck and shoulder points and follow the body | P0 |
| FR-5 | Try-on | Earrings hide behind the face when the head turns (depth/occlusion logic) | P0 |
| FR-6 | Try-on | Handle hair covering the ear or neck so jewelry does not look pasted on top | P1 |
| FR-7 | Try-on | When several people are in frame, track only the closest person | P0 |
| FR-8 | Try-on | Scale each piece from face or shoulder width; size is approximate and is not presented as exact | P1 |
| FR-9 | Catalog | Each item has an id, name, type, .glb model, material and thumbnail, stored in a JSON catalog | P0 |
| FR-10 | Catalog | Touchscreen picker with a filter by type (earrings, necklace) | P0 |
| FR-11 | Catalog | Switching pieces does not restart the camera or tracking | P0 |
| FR-12 | Photo | Take a photo with the jewelry overlay, with a short countdown | P0 |
| FR-13 | Photo | Upload the photo to the backend and show a QR code that opens it | P0 |
| FR-14 | Privacy | Show a notice before the camera is used; do not store any image without consent | P0 |
| FR-15 | Admin | Admin page to add, edit and hide catalog items and upload .glb files | P1 |
| FR-16 | Kiosk | Chrome opens full-screen in kiosk mode and starts automatically when the PC boots | P0 |
| FR-17 | Kiosk | After a period of inactivity the app returns to the start screen and turns the camera off | P0 |
| FR-18 | Kiosk | Try-on runs offline; internet is needed only for catalog updates and QR sharing | P0 |
| FR-19 | Phone | Same web app runs on phones from a link or QR, installable as a PWA | P2 |
| FR-20 | Analytics | Count pieces tried, photos taken and QR scans | P2 |
| FR-21 | Catalog | Additional jewelry types: nose pins, maang tikka (face landmarks) | P2 |
| FR-22 | Catalog | Details panel: an optional craft story per piece (1–3 callouts, each with a short title, short text and macro photo, optional sketch); the Details button is hidden when a piece has no story | P2 |

## 7. How it works: AI pipeline and architecture

The try-on is a four-step loop that runs in the browser on the booth PC: the webcam feeds MediaPipe, MediaPipe returns ear, neck, shoulder and chin points, Three.js anchors the .glb piece to those points, and the result is drawn over the live video.

&#91;embedded content: system architecture · booth PC, backend, admin, phone\]

Tracking and drawing happen in the browser, so the try-on itself runs offline. The backend is needed only for catalog updates, saved photos and QR links.

| Layer | Choice | Notes |
| --- | --- | --- |
| Tracking | MediaPipe Face Landmarker and Pose Landmarker | Free; runs in the browser or on a PC; gives face landmarks, shoulders and hands |
| Rendering | Three.js (WebGL) with .glb models | Environment lighting map for metal and sparkle |
| App | One web app | Booth screen first; phone later through a PWA, or Capacitor for a store listing |
| Backend | Firebase or Supabase | Catalog, saved photos and the QR share link |
| Kiosk | Chrome in full-screen kiosk mode | Starts automatically when the PC boots |

**Build-or-buy.** Paid AR SDKs (Banuba, DeepAR, Snap Camera Kit, Perfect Corp) are much faster to ship and give a polished result sooner; Unity or Unreal give very high rendering quality. The recommended path is MediaPipe + Three.js unless the Stage 0 comparison shows an SDK is the better fit.

## 8. Hardware and booth setup

The minimum booth is a portrait touchscreen, a mini PC, a 1080p webcam and good lighting. Lighting matters more than PC power.

| Part | Minimum | Why |
| --- | --- | --- |
| Touchscreen | 24–32 inch portrait touch display | Portrait fits a person's face and neck naturally |
| Computer | Mini PC or laptop, Core i5 (12th gen+) or Ryzen 5, 16 GB RAM | Enough for earrings and necklaces |
| GPU | Integrated is fine to start; add GTX 1650 / RTX 3050 for heavy 3D models | Keeps video smooth at about 30 FPS |
| Camera | 1080p webcam (Logitech C920/C922 or similar) at eye level | Tracking quality depends heavily on camera position |
| Lighting | Ring light or softbox, soft and even | Bad lighting breaks tracking faster than a weak PC does |
| Internet | Optional for tracking; needed for catalog updates and QR sharing | The try-on itself can run offline |

Skip a depth camera at the start. It is a later upgrade (Intel RealSense, iPad LiDAR) that improves size accuracy.

**Booth conditions to control.** Bright or uneven light, and a dupatta or dark clothing near the neck, make tracking worse and the jewelry look off. Test with the real lighting in week 6, not only at a desk.

## 9. Jewelry catalog and 3D models

3D assets are the biggest ongoing cost, because every new design needs a new model with realistic metal and stones. Decide the catalog size early and start with 5–10 best sellers.

**Where models come from**, cheapest to best:

| Route | Quality | Cost | Use it for |
| --- | --- | --- | --- |
| 1. Manufacturer CAD files (Matrix, RhinoGold, JewelCAD), converted to .glb | Exact | Low | Try first for the top 5 designs |
| 2. Photo capture (40–70 photos on a turntable in a light tent) plus a freelance 3D artist in Blender | Best for the price | A few thousand rupees per piece; get a quote first | Pieces with no CAD file |
| 3. AI image-to-3D or scan apps (Polycam, Kiri Engine, Meshy, Tripo) | Lumpy on reflective metal, gems and thin chains | Lowest | Testing the idea, not the hero catalog |
| 4. Hardware scanners | Reflective surfaces fool them | High | Skip for now |

Do not use matte scanning spray on real pieces; it can leave residue and is risky on pearls and soft stones.

**Keeping cost and weight down**

- One shared material library (yellow gold, rose gold, silver, diamond, ruby, emerald, pearl) reused on every piece.
- Fake the sparkle with a good environment lighting map instead of modeling gem optics.
- Low polygon count and compressed .glb, ideally a few MB per piece, so phones run smoothly.
- Test every model in the try-on app early; a model that looks fine alone can look wrong on a moving face.

**Catalog entry (proposed shape).** Each piece is one JSON record; the admin page edits these. The optional story field feeds the Details panel (FR-22, P2); the text and photos come from the business.

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

## 10. Non-functional requirements

| Area | Requirement |
| --- | --- |
| Performance | About 30 FPS on the booth PC with earrings and necklaces; each .glb a few MB at most |
| Offline | Try-on works with no internet; catalog is cached on the booth PC and refreshed when online |
| Reliability | Kiosk starts on boot and returns to the start screen after inactivity, so staff never need to restart it by hand |
| Devices | Booth PC first. On low-end Android the tracking will be slower and less accurate; iPhone Safari has camera quirks. Test on real phones early. |
| Lighting | Works under soft, even booth lighting; behaviour in harsh or uneven light is tested in week 6 |
| Privacy | Show a notice before the camera is used. Do not store images without consent. Full rules go in security-privacy.md. |
| Maintainability | Staff add pieces through the admin page; no code change for a new catalog item |

## 11. How to start: staged build plan

Build in stages, and do not move to the next stage until its gate is met. Stage 0 is the preparation that should start this week; the 3D models are the slowest part, so they start first.

&#91;embedded content: staged build plan · 5 stages, 4 gates\]

The week-6 booth test is highlighted because its findings decide the catalog size, the phone work and whether a paid SDK is needed.

**Start here (Stage 0 checklist)**

1. Ask the manufacturer for CAD files of your top 5 designs.
2. Try one AI scan on a matte piece to see if the quality is acceptable.
3. Hire one freelancer for a paid trial on 2–3 pieces; compare quality and price before committing.
4. Compare ready-made SDKs (DeepAR, Banuba) with building it yourself.
5. Set up the starter project (MediaPipe + Three.js) and see earrings track your own face on a laptop webcam.

## 12. Success metrics

Only the frame-rate target comes from the plan. The other targets are set after the week-6 booth test, once there is a real baseline.

| Metric | Target | How it is measured |
| --- | --- | --- |
| Frame rate on the booth PC | About 30 FPS | FPS counter during the booth test |
| Tracking stays on the right person | Locks on the closest person in a busy booth | Observed in the week-6 test |
| Model size | A few MB per piece | File size check at upload |
| Visitors who take a photo | Set after week 6 | Photo count ÷ sessions (FR-20) |
| QR codes scanned | Set after week 6 | QR link opens (FR-20) |
| Pieces tried per session | Set after week 6 | Session log (FR-20) |
| Visits and sales after the event from QR | Set after the phone version ships | QR link traffic and sales follow-up |

## 13. Risks, assumptions and open questions

| Risk | Effect | Mitigation |
| --- | --- | --- |
| 3D model cost and effort | Slows the catalog and drives ongoing cost | Ask for CAD first; start with 5–10 pieces; shared materials; paid freelancer trial on 2–3 pieces |
| Hair covers ears or neck | Earrings look pasted on top of the hair | Occlusion handling (FR-6); test with real hairstyles |
| Head turns | Earrings look fake if they stay visible behind the face | Depth/occlusion logic (FR-5) |
| Flat 2D images | Look cheap | Use 3D .glb models with proper metal and stone materials |
| Uneven light, dupatta, dark clothing | Tracking drifts; jewelry looks off | Ring light or softbox; test at the real booth |
| Size is approximate | Single camera cannot measure true size | Say so in the UI; add a depth camera later if needed |
| Rings and hands | Unstable tracking | Experimental, behind a flag; not in the MVP acceptance criteria |
| Weak PC | Lag below 30 FPS | Core i5 12th gen or Ryzen 5, 16 GB; add GTX 1650 / RTX 3050 for heavy models |
| Many people in frame | Camera locks on the wrong face | Track only the closest person (FR-7) |
| Low-end Android, iPhone Safari | Slower or quirky tracking on phones | Test on real devices early |
| Filming customers | Privacy and trust problem | Notice before the camera; no storage without consent (FR-14) |

**Open questions**

- Build with MediaPipe and Three.js, or pay for an SDK (DeepAR, Banuba) to ship a polished version faster? Compare both before week 1 ends.
- Does the manufacturer have CAD files for the top 5 designs?
- What is the final catalog size and the budget for 3D artists?
- What is the date and venue of the first booth, and which lighting will it have?
- How long are saved photos kept, and who can see them? (Answered in security-privacy.md.)
- Which languages and which brand look does the screen use? (Answered in design.md.)

## 14. Companion documents

This PRD says what to build and in what order. Three separate files will go deeper, in this order:

| File | What it will cover |
| --- | --- |
| design.md | Editorial look (paper screens, dark camera screen), booth screens and flow, the Details (craft story) panel, touch layout for a portrait display, visual style, how jewelry should look (lighting map, materials), photo and QR screens, admin page layout |
| agent.md | Instructions for the AI coding agent that builds this: tech stack, folder layout, commands, coding rules, and a task list and definition of done for each stage in section 11 |
| security-privacy.md | Camera consent notice, what is stored and for how long, on-device processing, access to the admin page and backend, QR link rules, deleting photos |

**Next step:** review this PRD, answer the open questions in section 13, then ask for the three files one by one.
