# Stage 0 Technical Evaluation: Virtual Jewelry Try-On SDKs & Engine Architecture

Comprehensive comparative analysis of technology alternatives for the AI Jewelry Try-On Booth as specified in PRD Section 7, Section 13, and `skills.md` (Skill S9).

---

## 1. Executive Summary

| Architecture / SDK | Rendering Quality | Face/Body Tracking | Offline Kiosk Support | Time to Market | Cost / Licensing | Mobile / Phone Extensibility |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **MediaPipe + Three.js** *(Current)* | ★★★★☆ (High PBR with MeshPhysicalMaterial) | ★★★★★ (478 face landmarks + 33 pose points, closest person) | ★★★★★ (100% offline, self-hosted WASM & tasks) | Medium (Scaffolded & verified) | **Free / Open-Source** (Zero royalty) | ★★★★★ (Direct web app / PWA on mobile browsers) |
| **Banuba Web AR SDK** | ★★★★☆ (WebGL PBR) | ★★★★★ (Specialized jewelry & face tracking) | ★★★★☆ (Requires on-prem license file) | Fast (Turnkey jewelry models) | ~$1,500 – $3,000/mo (Commercial license per kiosk) | ★★★★☆ (Web SDK or Native Mobile SDK) |
| **DeepAR Web SDK** | ★★★★☆ (WebGL PBR) | ★★★★☆ (Face tracking & occluders) | ★★★☆☆ (License activation check) | Fast (DeepAR Studio authoring) | ~$1,000+/mo (Commercial tiers) | ★★★★☆ (Web & iOS/Android native) |
| **Snap Camera Kit** | ★★★★☆ (Lens Studio engine) | ★★★★★ (High-precision face mesh) | ★★☆☆☆ (Cloud connectivity dependencies) | Fast (Uses Lens Studio templates) | Custom Enterprise pricing (Requires approval) | ★★★★★ (Integrated web or mobile) |
| **Unity / Unreal Engine** | ★★★★★ (Cinema-grade ray tracing/HDRP/Lumen) | ★★★☆☆ (Requires external tracking bridge / NDI stream) | ★★★★★ (100% offline standalone binary) | Slow (Custom kiosk application rewrite) | High dev & hardware cost (Requires discrete RTX GPU) | ★★☆☆☆ (Heavy native apps, no instant web link) |

---

## 2. Deep-Dive Comparison

### Option A: MediaPipe + Three.js (Recommended Production Baseline)
- **Strengths**:
  - **Zero Licensing Fees**: Completely free and open source, with zero per-seat, per-kiosk, or per-try-on costs.
  - **100% Offline Capability**: Runs entirely from local disk on the booth PC without any external internet connection required.
  - **Unified Web Codebase**: The exact same application runs on the 24–32" portrait touchscreen kiosk and later on visitors' smartphones via QR link (PWA).
  - **Customizable PBR Shaders**: Full control over `MeshPhysicalMaterial`, allowing custom 22K gold reflections, diamond transmission, pearl iridescence, and inertial dangle physics.
- **Trade-offs**: Requires custom geometry creation or `.glb` CAD imports and custom occlusion tuning.

### Option B: Turnkey Web AR SDKs (Banuba / DeepAR / Snap Camera Kit)
- **Strengths**:
  - Ready-made asset pipeline with proprietary jewelry shaders and ear tracking presets out of the box.
  - Faster initial setup if proprietary content authoring tools (DeepAR Studio, Banuba Studio) are used.
- **Trade-offs**:
  - Significant recurring licensing cost (hundreds to thousands of dollars per booth per month).
  - Vendor lock-in: Assets created in proprietary formats cannot be easily migrated.
  - Offline licensing restrictions often require intermittent internet checks.

### Option C: Standalone Native Engine (Unity / Unreal Engine)
- **Strengths**:
  - Unrivaled optical realism with real-time ray-traced reflections, refractions, and sub-surface scattering.
- **Trade-offs**:
  - Cannot run directly in the phone browser via QR code (breaks PRD goal FR-19).
  - Heavy hardware requirements: Demands a dedicated gaming GPU (RTX 3060/4060+).
  - Substantially higher engineering and maintenance complexity.

---

## 3. Recommendation & Roadmap

1. **Phase 1 (Kiosk MVP & Test)**: Deploy the upgraded **MediaPipe + Three.js** engine. It delivers luxury PBR rendering, inertial earring physics, 100% offline operation, zero recurring software license fees, and instant compatibility with phone sharing.
2. **Phase 2 (Content Sourcing)**: Ingest manufacturer CAD files (converted to `.glb` via Blender) with the shared PBR material library for all commercial hero jewelry lines.
3. **Trigger for Commercial SDK Pivot**: If the Week-6 real-booth test reveals that specific hardware configurations struggle to maintain 30 FPS, consider a paid commercial SDK (Banuba/DeepAR) strictly if performance bottlenecks justify the recurring enterprise license fee.
