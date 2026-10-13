# design.md — AI Jewelry Try-On Booth

How the booth, the share page and the admin page should look, feel and behave. The agent builds from this file; if something is not here, ask or add a `TODO(confirm)`. Scope and flow come from the PRD. Privacy wording comes from `security-privacy.md` and `terms-and-conditions.md`.

> Values marked **(proposed)** are starting points to test on the real booth screen, not final decisions. Brand colours, logo and fonts are not yet supplied: use the placeholder tokens in section 3 and swap them when the brand kit arrives (`TODO(confirm)`).

---

## 1. Design principles

1. **The person is the hero.** The live camera view fills the screen. Controls stay at the edges and never cover the face, ears or neck.
2. **Zero instructions.** A stranger walking up should understand the booth in 3 seconds and need no help.
3. **One thing per screen.** One main action, large and obvious.
4. **Jewelry first, chrome last.** The jewelry must look rich. The interface stays quiet and does not compete with it.
5. **Honest results.** Never imply exact size or fit. Keep wording modest ("approximate").
6. **Calm and trustworthy.** The camera is on a person's face, so privacy messages are clear, short and friendly.
7. **Works for everyone:** different heights, skin tones, hair, headwear, glasses, abilities and languages.
8. **Craft is the story.** Beyond how a piece looks on you, let people see what makes it special: close-up detail, a short note on the craft. Editorial, never salesy.

## 2. Display and layout baseline

- Screen: 24–32 inch **portrait** touchscreen. Design at **1080 × 1920** and scale up (proposed; `TODO(confirm)` the real resolution).
- Use `vw`/`vh`-relative layout so it holds on other sizes. No fixed pixel layouts.
- **Reach zones:** interactive controls live in the **lower 60%** of the screen so seated users, children with a parent, and shorter users can reach them. The top 40% is mostly the camera view and passive labels.
- **Safe margins:** 48 px on all sides (proposed).
- **Touch targets:** at least **96 × 96 px** for any button; at least 24 px between targets (proposed). No hover states. No small close icons.
- **Camera orientation (important):** a landscape 1080p webcam cropped into a portrait screen leaves only about 608 px of width. Preferred fix: mount the webcam rotated 90° and rotate the stream in software so you get a true portrait image. Otherwise accept a lower-resolution crop. `TODO(confirm)` after testing on the booth PC. This affects PRD section 8.
- **Camera view:** mirrored (like a mirror), full-bleed, centred on the face. Show a faint face-position guide only on the first seconds of try-on, then fade it.

## 3. Visual language

### Direction (proposed): editorial luxury

Inspired by high-end jewellery editorial pages: quiet paper-like backgrounds, a refined serif for headlines, thin hairlines, black-and-white category photography, and short craft callouts with fine arrows. This is mood only. **Do not reuse any brand's artwork, wording, names, logos or layouts.** Use our own pieces, photography and copy.

- **Paper screens** (start, pick, photo preview, QR, details, share page): warm off-white background, near-black text, one gold accent, hairlines instead of boxes.
- **Camera screen** (live try-on): the camera view is full-bleed. Controls sit on a slim dark bar at the top and a soft dark gradient at the bottom, so text stays readable over any background.
- **Start hero** may use a dark, warm photograph (a close-up of a model wearing our jewelry) with the wordmark over it, falling to paper below.
- No heavy shadows, no gradients on paper screens, no stickers or badges.

### Colour tokens (placeholders, swap for the brand kit)

```css
:root {
  /* Paper screens */
  --paper:         #F6F2EA;  /* page background, warm off-white */
  --paper-2:       #EDE7DB;  /* cards, pressed states */
  --ink:           #1B1815;  /* primary text */
  --ink-muted:     #6B635A;  /* secondary text */
  --hairline:      #D9D1C3;  /* thin lines, dividers */
  --accent:        #C9A24A;  /* gold: primary button fill, selected state, thin accents */
  --accent-press:  #B38E3C;
  --on-accent:     #1B1305;  /* text on gold */

  /* Over the camera view */
  --night:         #0E0D0C;  /* top bar, hero backdrop */
  --cam-text:      #F7F2E8;  /* text on dark/camera */
  --cam-scrim:     rgba(14,13,12,0.72);
  --cam-gradient:  linear-gradient(to top, rgba(14,13,12,0.85), rgba(14,13,12,0));

  /* States */
  --success:       #3E8F5E;
  --warning:       #B7791F;
  --danger:        #C0483A;
}
```

Rules:
- Text meets WCAG AA contrast (4.5:1 body, 3:1 large). **Gold is not used for text on paper** (too low contrast); use it for fills, lines and the selected state, and put ink text on gold.
- Never use colour alone to carry meaning. Pair it with text or an icon.
- Over the live video, text always sits on `--cam-scrim` or `--cam-gradient`.

### Typography (proposed; `TODO(confirm)` brand fonts)

- **Headlines and callout titles:** an elegant serif (a Cormorant- or Playfair-style face; `TODO(confirm)`). Generous letter-spacing on small uppercase titles.
- **Everything else:** a clean sans-serif (a system font stack is acceptable for the MVP).
- Scale at 1080 px width: Display 72 / Title 48 / Body 32 / Label 28 / Caption 24. Minimum text on the booth: **24 px**.
- Line height 1.3 for body, 1.1 for display. Sentence case for body text; callout titles may be small uppercase.
- Support the scripts needed for the languages chosen (see section 9).

### Spacing, shape, depth

- Spacing steps: 8, 16, 24, 32, 48, 64.
- Corner radius: 24 for cards and sheets, full pill for buttons.
- Borders over shadows: 1–2 px `--hairline`. Use at most one soft shadow, for floating sheets.

### Icons

- Simple line icons, 3 px stroke, with a text label beside any icon that is not universally obvious. Needed: camera, back, home, check, close, QR, trash, info, wifi-off.

## 4. Screens

Flow (matches the PRD): **Start → Privacy notice → Pick a piece → Live try-on → Photo preview → Save / Don't save → QR → back to Start.** Idle at any point returns to Start.

### 4.1 Start (attract) screen

Purpose: invite a visitor and show what the booth does, with no camera on.

```
┌────────────────────────────┐
│ [ dark, warm hero photo:   │
│   close-up of a model with │
│   our earrings/necklace ]  │
│                            │
│        BRAND WORDMARK      │  ← serif, over the photo
├────────────────────────────┤  ← falls to paper
│  See jewelry on you        │  ← Display, serif
│  Try earrings and          │
│  necklaces in seconds      │  ← Body, muted
│                            │
│   ┌──────────────────┐     │
│   │   Touch to start │     │  ← primary, gold, pill, 96+ px tall
│   └──────────────────┘     │
│        EN | हिन्दी          │  ← language toggle (if enabled)
└────────────────────────────┘
```

- The hero is our own photograph or a slow loop, **not** the live camera and not another brand's image.
- A quiet pulse on the button invites touch. Respect reduced motion.
- Camera is **off** here.

### 4.2 Privacy notice

Purpose: inform and get consent before the camera turns on. Text comes from `security-privacy.md` (section 3). Shown **every** session.

```
┌────────────────────────────┐
│  [camera icon]             │
│  Camera in use             │  ← Title
│                            │
│  Your video stays on this  │
│  screen. It is not         │
│  recorded or uploaded.     │
│  We don't identify you.    │
│  Photos are saved only if  │
│  you choose, and deleted   │
│  after [retention].        │
│  For adults, or children   │
│  with a parent or guardian.│
│                            │
│  Terms and privacy: [QR]   │
│                            │
│ ┌──────────┐ ┌───────────┐ │
│ │ No thanks│ │  Accept   │ │  ← both equal size; Accept = gold
│ └──────────┘ └───────────┘ │
└────────────────────────────┘
```

- Short sentences, plain words, 32 px body. No scrolling. No pre-ticked boxes.
- "No thanks" returns to Start and the camera never starts.
- The full Terms open by QR on the visitor's own phone, not on the kiosk.

### 4.3 Pick a piece (no camera yet)

Purpose: choose what to try. FR-9, FR-10.

```
┌────────────────────────────┐
│ ← Home                     │
│ Choose your jewellery      │  ← Title, serif
│                            │
│ ┌────────────┐┌───────────┐│
│ │ black &    ││ black &   ││  ← category cards = the type filter
│ │ white photo││ white photo│
│ │  Earrings  ││ Necklaces ││  ← serif label over the image
│ └────────────┘└───────────┘│
│                            │
│  Earrings                  │  ← selected category, hairline under
│ ┌────────┐  ┌────────┐     │
│ │ thumb  │  │ thumb  │     │
│ │ Name   │  │ Name   │     │
│ └────────┘  └────────┘     │
│ ┌────────┐  ┌────────┐     │
│ │ thumb  │  │ thumb  │     │
│ └────────┘  └────────┘     │
│   Tap a piece to try it on │
└────────────────────────────┘
```

- Two large category cards (Earrings, Necklaces) work as the type filter. The selected card turns to colour; the other stays black and white.
- Below them, a 2-column grid of piece cards (thumbnail, name). With 5–10 pieces, no search is needed.
- Tapping a piece card starts the camera and moves to Live try-on (FR-1).
- **Do not show Rings or Bangles** until they are supported (PRD Phase 3). A quiet "More coming soon" line is optional.
- Hide inactive items. If the catalog is empty or fails to load, show the unavailable state (section 7).

### 4.4 Live try-on

Purpose: the main experience. Camera full-bleed, mirrored, jewelry rendered on top. FR-1 to FR-8, FR-11.

```
┌────────────────────────────┐
│ ←  Jhumka Gold [Details] ⌂ │  ← slim dark top bar
│                            │
│                            │
│       (live camera view)   │
│       jewelry on the       │
│       person               │
│                            │
│                            │
│ [Earrings] [Necklaces]     │  ← tabs, lower third
│ ◀ [▢][▢][▣][▢][▢] ▶        │  ← piece carousel, big thumbs
│                            │
│          ( ◯ )             │  ← big camera/shutter button
└────────────────────────────┘
```

- **Switching pieces:** tap a thumbnail; the new piece swaps without restarting the camera. Crossfade the jewelry (about 200–300 ms, proposed).
- **Details button** (only for pieces that have a craft story, see 4.10): opens the Details panel without leaving the session. Closing it returns to the same live view.
- **Controls never cover the face.** Keep the top 55% for the person. Controls sit on a soft bottom scrim.
- **Guide:** an oval face guide with "Look at the camera" shows for the first moments, then fades once a face is locked.
- **Status hints** (one line, below the top bar): see section 7 for tracking states.
- **Shutter button:** 120 px circle, centre bottom. Pressing starts a 3-second countdown (proposed) with a large number overlay.
- No on-screen debug text in kiosk builds.

### 4.5 Photo preview and save choice

Purpose: let the visitor judge the photo and decide. FR-12, FR-14.

```
┌────────────────────────────┐
│                            │
│     (captured photo with   │
│      jewelry, framed)      │
│                            │
│  Save this photo and get   │
│  a link on your phone?     │
│  Deleted after [retention] │
│                            │
│ ┌────────────┐ ┌─────────┐ │
│ │Retake      │ │ Save    │ │
│ └────────────┘ └─────────┘ │
│        Don't save          │  ← text button, still 96 px tall
└────────────────────────────┘
```

- Three clear choices: **Save**, **Retake**, **Don't save**. Nothing is uploaded until **Save** is tapped.
- "Don't save" discards the photo and returns to Live try-on or Start (`TODO(confirm)`: proposed return to Live try-on).

### 4.6 QR screen

Purpose: hand the photo to the visitor's phone. FR-13.

```
┌────────────────────────────┐
│  Scan to get your photo    │
│                            │
│        ┌──────────┐        │
│        │   QR     │        │  ← at least 400 px, white quiet zone
│        └──────────┘        │
│                            │
│  Open your phone camera and│
│  point it at the code.     │
│  Link works for [retention]│
│                            │
│ ┌──────────────────────┐   │
│ │ Done                 │   │
│ └──────────────────────┘   │
│ Auto-closing in 30 s       │
└────────────────────────────┘
```

- The QR is large, black on a white square with a clear margin, whatever the theme.
- **Done** returns to Start, clears the photo from memory and ends the session. Auto-close after a short timeout (proposed 30 s).
- If upload fails, see section 7.

### 4.7 Idle behaviour

- After inactivity (`TODO(confirm)` duration), show "Still there?" with a countdown and a button to continue. If ignored, stop the camera, clear photos from memory and return to Start (FR-17).
- A person walking away mid-session must never leave a photo on screen.

### 4.8 Photo share page (visitor's phone, via QR)

- Mobile-first, single column. Shows the photo large, a **Download** button, a **Share** button (system share sheet), a **Delete my photo** button, and the expiry date in plain words.
- Small footer links: Terms and Privacy.
- No gallery, no "next photo", no ads. Marked `noindex`.
- Same colour and type tokens as the booth, scaled for phones.
- After the phone try-on arrives (Stage 4), add a "Try more at home" button here.

### 4.9 Admin page (staff, P1)

- Desktop-first, plain and functional; it does not need the booth's visual polish.
- Sign-in with MFA (see `security-privacy.md`).
- Pieces list: thumbnail, name, type, active toggle, edit, delete.
- Add/edit form: name, type (earrings / necklace), `.glb` upload, thumbnail upload, material, anchor offset and scale, active.
- **Live preview:** a try-on preview of the piece on the admin's own webcam before publishing. Warn on file size or missing fields.
- Show validation errors in plain words ("Model is larger than the allowed size").

### 4.10 Details panel: the craft story (P2, after the MVP)

Purpose: show what makes a piece special, in the spirit of an editorial craft page. Adds depth after the try-on and gives staff something to talk about. PRD requirement FR-22.

```
┌────────────────────────────┐
│ ← Back to try-on           │
│                            │
│   Meenakari                │  ← piece title, serif
│   ┌────────────────────┐   │
│   │  line sketch of    │   │  ← optional pencil-style sketch
│   │  the piece         │   │
│   └────────────────────┘   │
│                            │
│   DOUBLE CUT KUNDAN        │  ← callout title, small caps serif
│   One or two short lines   │  ← callout text, 28 px
│   about the craft.         │
│        ╲___ (thin arrow)   │
│   ┌────────────────────┐   │
│   │ macro photo detail │   │
│   └────────────────────┘   │
│                            │
│   [ Try it on ]  [ Next ]  │
└────────────────────────────┘
```

- **Paper background**, serif titles, thin curved arrows from each callout to its detail photo.
- Per piece: 1–3 callouts. Each callout has a short title (up to 3 words), a short text (up to about 25 words, proposed), and a macro photo. A pencil-style sketch is optional.
- **Content comes from the business** (real craft facts). The agent must never invent materials, techniques, origin or claims.
- Photos and sketches must be our own or licensed. Do not use another brand's artwork or copy.
- Swipe or tap Next to move between callouts. A close button and **Try it on** always return to the live view.
- Idle timer still applies. The panel never delays the privacy notice or the save choice.
- If a piece has no story, the Details button is hidden. No empty panels.
- On phones (Stage 4) the same panel is a scrolling page.

## 5. Components

| Component | Spec |
| --- | --- |
| Primary button | Gold pill, `--on-accent` text, 96+ px tall, label 32 px. Pressed: `--accent-press`, slight scale 0.98 |
| Secondary button | Transparent, 2 px `--hairline` border, `--ink` label |
| Text button | No border, still 96 px touch height |
| Piece card | `--paper-2` card, thumbnail 1:1, name below, 24 px radius. Selected: 3 px gold border |
| Tabs (Earrings / Necklaces) | Pill segmented control, 72+ px tall, selected = gold fill |
| Carousel | Horizontal, snap scrolling, big arrows for people who do not swipe, thumbnail at least 144 px |
| Shutter button | 120 px circle, white ring, gold centre |
| Countdown | Large numerals (160 px) centred on a scrim |
| Hint chip | One line on a scrim, 28 px, icon + words |
| Modal / sheet | `--paper`, 24 px radius, `--cam-scrim` behind. Only for notice, idle, errors |
| Toast | Bottom, 4 s, never covers primary buttons |
| Category card | Black-and-white photo, serif label over a dark gradient, 24 px radius. Selected: full colour + 3 px gold border |
| Callout (Details panel) | Small-caps serif title, 28 px text, thin curved arrow to the detail photo |
| Details button | Text button with a small "i" or sparkle icon, in the top bar, 96 px touch height |

## 6. How the jewelry should look

- **Rich, not plastic.** Real metal reflections and stone sparkle come from a good environment map, not from modelling gem optics (skills.md S2, S3).
- One shared warm studio environment map for all pieces so the catalog looks consistent. `TODO(confirm)` the exact map after testing on the booth lighting.
- Use the shared material library: yellow gold, rose gold, silver, diamond, ruby, emerald, pearl.
- **Contact and depth:** earrings hide behind the face when the head turns (occluder). A very soft shadow under necklaces and earrings helps them sit on the skin. Keep it subtle.
- **Position:** earrings hang from the earlobe; necklaces sit below the chin and across the collarbone without floating. Per-piece offset/scale in the catalog fixes small differences.
- **Smooth, not floaty:** follow the person with light smoothing. A small lag is better than jitter.
- **When tracking is lost:** fade the piece out over a short time instead of freezing or jumping (see section 7).
- **Scale:** approximate. Never show measurement numbers on the live view.
- **Do not** overlay logos, price tags or large labels on the face area. A small piece name at the top is enough.

## 7. States, errors and messages

One short line, friendly, with what to do. Shown as a hint chip or a sheet; never technical.

| Situation | What the person sees | Behaviour |
| --- | --- | --- |
| Camera starting | "Starting camera…" with spinner | Show after notice accept |
| No face found | "Look at the camera and step a little closer" | Fade the piece out; keep trying |
| Several people | "We're tracking the closest person" | Keep the closest; no blocking |
| Too dark / uneven light | "It's a bit dark. Face the light." | Hint only; `TODO(confirm)` detection method |
| Head turned away | (no message) | Earrings occlude; fade if face lost |
| Hair covering ear | (no message) | Best effort; PRD FR-6 is P1 |
| Camera blocked / permission denied | "Camera isn't available. Please ask staff for help." | Offer Back to Start; log a non-personal error |
| Offline (try-on) | Nothing; try-on keeps working | Cached catalog and models |
| Offline (save/QR) | "Can't save right now. Check the connection or try again." | Offer Retry and Don't save |
| Upload failed | Same as above | Photo stays in memory until the visitor leaves; clear at idle |
| Catalog empty/failed | "Jewelry is unavailable. Please ask staff." | Show staff contact hint |
| Photo expired (share page) | "This photo is no longer available." | Plain page, no details |

## 8. Motion and feedback

- Keep motion calm. Typical durations: tap feedback 100 ms, screen transitions 250–300 ms, crossfade of jewelry 200–300 ms (proposed). Easing: gentle ease-out.
- Always give feedback on touch (pressed state) within 100 ms.
- Respect reduced-motion settings: remove pulse and parallax, keep simple fades.
- The shutter gets a brief flash and a subtle sound only if the booth speaker is on (`TODO(confirm)`; off by default in noisy venues).

## 9. Language, tone and copy

- Plain, warm, short. No jargon ("landmarks", "AI model", "tracking" do not appear on screen).
- Second person, sentence case: "Try it on", "Save this photo".
- Languages: English first. `TODO(confirm)` whether Hindi or other languages are needed; build all text as translatable strings from the start. Test longer translations for button overflow.
- No claims of exact fit, size or "real" appearance. Use "approximate" wording where results are described.

| Key | English text (proposed) |
| --- | --- |
| start.title | See jewelry on you |
| start.sub | Try earrings and necklaces in seconds |
| start.cta | Touch to start |
| notice.title | Camera in use |
| notice.accept / notice.decline | Accept / No thanks |
| pick.hint | Tap a piece to try it on |
| live.guide | Look at the camera |
| photo.question | Save this photo and get a link on your phone? |
| photo.save / photo.retake / photo.discard | Save / Retake / Don't save |
| qr.title | Scan to get your photo |
| idle.title | Still there? |
| result.disclaimer (small) | Results are approximate. Real pieces may differ. |
| pick.title | Choose your jewellery |
| pick.soon (optional) | More coming soon |
| live.details | Details |
| details.back | Back to try-on |
| details.tryon / details.next | Try it on / Next |

## 10. Accessibility and inclusion

- **Reach and posture:** controls in the lower part of the screen; no need to stretch up. Works for a seated user and for a standing user.
- **Contrast and size:** AA contrast everywhere; text at least 24 px; large targets.
- **No time pressure** for the main flow beyond the idle timer, and the idle timer warns first.
- **Not colour-only:** states use icons and words as well.
- **Screen reader and keyboard** matter for the share page and admin page (semantic HTML, labels, focus order). The booth is touch-first but keep elements properly labelled.
- **Hearing and speech:** no audio-only information; no voice required.
- **Faces and appearance:** test with a range of skin tones, hair types, head coverings (dupatta, hijab, turban), glasses, beards and jewelry already worn. Failures must degrade gracefully (fade the piece, give a gentle hint) and never blame the person.
- **Neutral language:** earrings and necklaces are offered to everyone; do not gate content by gender in copy or imagery.
- **Lighting at the booth** is part of the design: soft, even front light (ring light or softbox), no strong backlight. This is a design requirement, not only a hardware one.

## 11. Responsive and phone (Stage 4)

- The same web app reflows to a phone: full-bleed camera, bottom carousel, shutter button, thumb-reachable controls.
- Keep the same tokens, components and copy. Touch targets stay at least 48 px on phones.
- The privacy notice appears before the phone camera permission is requested.
- Expect lower frame rate on cheap phones: reduce effects before reducing clarity of the piece.

## 12. Assets needed

- Brand kit: logo, colours, fonts (`TODO(confirm)`).
- Start-screen preview loop from a consenting model (or a styled still image).
- A thumbnail per catalog piece (square, neutral background, consistent lighting and crop).
- The shared environment map and the material library files.
- Icons set (section 3).
- Black-and-white category photos (Earrings, Necklaces) and a hero photograph, our own or licensed.
- For the Details panel (P2): per piece, 1–3 macro photos, optional pencil-style sketch, and the callout text written or approved by the business.
- Booth signage: a small printed sign near the camera explaining the camera and photos (wording from `security-privacy.md`).
- Translated strings, if more than one language.

## 13. Handoff notes for the agent

- Implement the tokens as CSS variables and use them everywhere; no hard-coded colours.
- Build screens as separate components driven by the state machine in `agent.md` section 7.
- Keep all user-facing strings in one file keyed by the names in section 9.
- Do not add text, icons or visuals that this file does not describe without asking.
- When a value is marked proposed, implement it as a named constant so it is easy to tune after the booth test.

## 14. Open decisions

- Look: light editorial paper screens with a dark camera screen (proposed) vs. fully dark with gold. Confirm.
- Brand colours, logo, fonts (replace the placeholder tokens).
- Who writes the craft story text and supplies macro photos (needed for the Details panel).
- Real screen resolution, and whether the webcam is mounted rotated 90°.
- Languages beyond English.
- Idle timeout duration and the QR screen auto-close time.
- Where "Don't save" returns (Live try-on or Start).
- Whether sound is used at the booth.
- Final look of the studio environment map and shadow strength, after testing under real booth lighting.
