# security-privacy.md — AI Jewelry Try-On Booth

Security and Privacy architecture, policies, data retention, and consent rules for the AI Jewelry Try-On Booth. This is a source-of-truth document. Never weaken the requirements defined in this file.

---

## 1. Core Principles

1. **On-Device by Default**: All live camera frames, facial landmarks, and pose points are processed strictly in-memory within the local browser runtime. Zero raw camera frames or biometric coordinates are ever logged, transmitted, or written to disk.
2. **Strict Consent Pre-Condition**: The camera is never initialized before the visitor explicitly accepts the privacy notice.
3. **No Biometric Identification**: The system calculates 3D transformations for jewelry anchoring only. It never performs facial recognition, creates biometric templates, or constructs user profiles.
4. **Ephemerality**: Any captured photo is held only in volatile memory until the visitor explicitly taps "Save". Declined or abandoned captures are permanently purged upon session reset or idle timeout.
5. **Default-Deny Access Control**: All backend endpoints require explicit capability tokens or admin authentication. Unauthenticated listing or arbitrary modification is rejected.

---

## 2. Data Classification and Lifecycle

| Data Type | Storage Location | Retention Period | Access Controls | Encryption |
| :--- | :--- | :--- | :--- | :--- |
| **Live Camera Frames** | Volatile browser memory (GPU/WebGL) | Immediate frame-by-frame discard | None (never leaves tab) | In-memory only |
| **MediaPipe Landmarks** | Volatile browser memory | Immediate frame-by-frame discard | None (never leaves tab) | In-memory only |
| **Unsaved Captured Photo** | Volatile browser memory (Blob URL) | Dropped upon Retake, Discard, or Idle reset (<= 60s) | In-memory only | In-memory only |
| **Saved Try-On Photo** | Local disk / Secure object storage (`photos/{id}.jpg`) | Configurable TTL (`PHOTO_TTL_HOURS`, default 24h) | Unpredictable 128-bit capability token via URL | HTTPS in transit, encrypted at rest |
| **Photo Metadata** | Local disk / DB (`photos/{id}.json`) | Tied to photo TTL (purged by background sweep) | Valid token match via timing-safe comparison | Local filesystem / DB permissions |
| **Catalog Data** | Local disk (`data/catalog.json`) | Persistent until edited | Public read, Admin write (Bearer token) | Standard HTTP/HTTPS |
| **Uploaded 3D Models / Assets** | Local disk (`data/uploads/*`) | Persistent until deleted by staff | Public read, Admin upload (Bearer token) | Standard HTTP/HTTPS |

---

## 3. Privacy Notice and Consent Architecture

### 3.1 Timing & State Machine Gating
- The privacy notice is shown **on every session** after the visitor taps the start screen.
- The `Machine` state machine blocks any transitions to `live` or `pick` without traversing `notice` and receiving explicit acceptance (`accept`).
- If the visitor taps "No thanks" (`decline`), the app returns to `start`, and the camera device is never requested (`navigator.mediaDevices.getUserMedia` is never called).

### 3.2 Display Notice Copy
- **Headline**: "Camera in use"
- **Body**: "Your video stays on this screen. It is not recorded or uploaded. We don't identify you. Photos are saved only if you choose, and deleted after 24 hours. For adults, or children with a parent or guardian."
- **QR Code Link**: Links to `/terms.html` for visitors wishing to read the detailed privacy statement on their personal smartphones.
- **Language Parity**: Full Hindi translation provided for bilingual deployment.

---

## 4. Photo Capture, Storage, and Sharing Rules

### 4.1 Capture Flow
1. **Visitor Triggers Shutter**: Visual countdown (3s) and flash animation.
2. **Client-Side Composition**: The active frame and rendered Three.js canvas are composited into a single JPEG blob client-side.
3. **Consent Gate**: Visitor is shown the preview with clear options:
   - "Retake" or "Discard": Immediate memory disposal via `URL.revokeObjectURL`. No network payload is sent.
   - "Save": Explicit user action initiates upload to `/api/photos`.

### 4.2 Storage and Expiring Links
- **ID & Token Generation**: Cryptographically secure pseudo-random bytes (`crypto.randomBytes(8)` for ID, `crypto.randomBytes(16)` for capability token).
- **No Search Indexing**: All photo endpoints and `share.html` pages return `X-Robots-Tag: noindex, noarchive` and `Cache-Control: no-store` headers.
- **Timing-Safe Token Verification**: Token validation uses `crypto.timingSafeEqual` to prevent timing attacks.
- **Automated Purging**: A background task runs every 10 minutes checking `expires <= Date.now()`, removing the image and metadata immediately.
- **Visitor Self-Deletion**: The visitor can tap "Delete my photo" on the share page at any time to instantly remove both the JPEG and its metadata.

---

## 5. Kiosk Security and Device Hardening

1. **Kiosk Profile Isolation**: Chrome runs in `--kiosk` mode with an isolated dedicated user profile directory (`--user-data-dir`).
2. **Restricted Navigation**: URL bar, menus, developer tools, and extensions are disabled or inaccessible on the touchscreen.
3. **Inactivity / Idle Reset**:
   - After 60 seconds of inactivity on interactive screens, a 10-second warning modal appears.
   - If unacknowledged, `fullReset()` terminates the webcam stream (`MediaStreamTrack.stop()`), wipes all in-memory photos, resets state to `start`, and closes sheets.
4. **Offline Resilience**:
   - Try-on tracking (WASM, vision tasks, procedural models, and cached catalog) functions 100% offline without Internet access.
   - Network connectivity is required solely for catalog sync and sharing links.

---

## 6. Admin and Backend Access Controls

1. **Default-Deny**:
   - Read catalog: Public (`/api/catalog`).
   - Modify catalog (`PUT /api/catalog`): Requires `ADMIN_TOKEN`.
   - Upload assets (`POST /api/upload`): Requires `ADMIN_TOKEN` and strict file extension verification (`.glb`, `.jpg`, `.jpeg`, `.png`, `.webp`) plus file size limits (<= 8 MB).
2. **Secrets Protection**:
   - `ADMIN_TOKEN` is supplied via server environment variables, never committed to git or exposed to the client.
   - If `ADMIN_TOKEN` is unset, all administrative routes are disabled by default.
3. **Session Hygiene**:
   - Admin token is stored only in `sessionStorage` in the admin browser tab.
   - Sign-out immediately purges the token from memory.
