# AI Jewelry Try-On Booth

Vite + TypeScript, MediaPipe (face + pose), Three.js, small Node API (no extra deps).

## Commands
```
install:  npm install && npm run setup     # setup copies MediaPipe wasm + downloads the 2 .task models (self-hosted, offline try-on)
dev:      ADMIN_TOKEN=pick-a-secret npm run api   # terminal 1: API on :8787
          npm run dev                              # terminal 2: app on :5173 (proxies /api, /uploads)
build:    npm run build
start:    ADMIN_TOKEN=... PUBLIC_BASE_URL=http://<booth-lan-ip>:8787 npm start   # serves dist + API
test:     npm test
```
Pages: `/` booth · `/admin.html` catalog admin · `/share.html?p=&t=` visitor photo page · `/terms.html`.
Add `?debug=1` to the booth URL for an FPS counter.

## Kiosk
`scripts/kiosk-windows.bat` starts the server and Chrome `--kiosk`. Put a shortcut in `shell:startup`. Edit `ADMIN_TOKEN` and `PUBLIC_BASE_URL` first.
`PUBLIC_BASE_URL` must be an address the visitor's phone can reach, or the QR link will not open.

## Models
Catalog `model` is a `.glb` path or `procedural:<kind>` (built-in placeholders: jhumka, stud, hoop, drop, choker, pendant, haar).
Earring `.glb`: hangs down from its top. Necklace `.glb`: centred, lowest point is the collarbone dip. Both are auto-normalised.
Anchor `offset` = fraction of face width (earrings) or neck width (necklace). Upload via the admin page.

## TODO(confirm)
Backend choice (Firebase/Supabase vs this Node API), admin accounts + MFA, photo retention (`PHOTO_TTL_HOURS`, default 24), idle/QR timings (`src/main.ts`),
low-light threshold, ear/neck placement constants (`src/tracking/solve.ts`), brand kit, hero/category photos, Hindi copy review, 90° rotated webcam,
terms text, soft contact shadow, jewelry crossfade (new piece fades in; old one is swapped immediately).
