# CHANGELOG

## feat: build SuprScript art tool with Minecraft welcome animation + drawing canvas
**Date:** 2026-02-24

### What was built and why

Full implementation of SuprScript — a mobile-first canvas art tool (Excalidraw-meets-MS-Paint-2026) built from a clean Next.js 16 scaffold. The goal was to showcase Canvas API capabilities with a funky Minecraft/90s arcade-style welcome experience and a fluid multi-layer drawing tool.

---

### Welcome Page (`/`)

**What:** Full-screen Minecraft-inspired pixel animation using raw Canvas 2D API at a retro 30fps.

**Animation phases (state machine via `phaseRef`):**
1. Single pixel fades in at center with particle burst
2. Pixel blocks fill screen in random order (Minecraft chunk-load aesthetic) — pre-shuffled array of all grid coordinates, revealed in batches
3. "SUPRSCRIPT" types itself character by character with multi-layer neon glow (`shadowBlur` trick for depth)
4. Feature list types in line-by-line below
5. Animated pixel paint strokes sweep across screen in 6 sinusoidal rows
6. "▶ PRESS START" React button fades in with neon CSS blink animation; click → `/draw`

**CRT overlay:** Pure CSS `repeating-linear-gradient` + `animation` on background-position. Zero JS cost.

**Decision:** Chose raw Canvas 2D over EaselJS for the welcome animation. EaselJS is overkill for a single-canvas state machine with particles, and raw Canvas gives full control over pixel rendering with `image-rendering: pixelated`.

---

### Drawing Tool (`/draw`)

**Architecture — 3 stacked `<canvas>` elements:**
- `drawingCanvas` (z=1): Raw Canvas 2D for freehand strokes
- `shapesCanvas` (z=2): EaselJS Stage for interactive vector shapes
- `previewCanvas` (z=3): Live dashed shape outline while dragging to create

**Freehand Drawing (`useDrawing.ts`):**
- Uses `perfect-freehand`'s `getStroke()` to convert `{x,y,pressure}` point arrays into smooth outline polygons
- Each tool has tuned parameters: pencil (small/tapered), brush (larger/pressure-sensitive), highlighter (wide/flat with `globalCompositeOperation: multiply`), eraser (`destination-out`)
- rAF render loop during active stroke for smooth 60fps feedback
- Completed strokes stored in ref array for undo support
- Uses `Pointer Events API` (not mouse/touch) for native stylus pressure on iPad

**Vector Shapes (`useShapes.ts`):**
- EaselJS `Shape` + `Graphics` API for rect, circle, ellipse, line, arrow, triangle
- Drag-to-create: pointer down → preview → pointer up → commit to EaselJS stage
- EaselJS `pressmove` event drives drag — offsets calculated on `mousedown`
- Arrow shape: uses trig (`atan2`) to calculate arrowhead lines at ±30°

**EaselJS Stage (`useEaselStage.ts`):**
- Dynamic import in `useEffect` (EaselJS accesses `window` at module load — SSR would crash)
- `createjs.Touch.enable(stage)` for normalized pointer→touch events
- `Ticker.RAF_SYNCHED` at 60fps with auto cleanup on unmount

**Keyboard shortcuts + visual feedback:**
- `window.addEventListener('keydown')` maps single keys to tools
- `triggerPulse()`: removes/re-adds CSS class to force keyframe re-trigger via `offsetWidth` reflow trick
- `[` / `]` change stroke width; `⌘Z` triggers undo

**Canvas pan + zoom:**
- CSS `transform: translate() scale()` on canvas wrapper — no canvas redraw needed
- Pinch via `Touch` events (`Math.hypot` for distance), scroll via `wheel` event
- Pointer coordinates adjusted: `(clientX - rect.left - tx) / scale`

**Toolbar (`Toolbar.tsx`):**
- Fixed bottom dock with `env(safe-area-inset-bottom)` for notched phones
- 44px minimum touch targets (WCAG 2.1 criterion 2.5.5)
- `backdrop-filter: blur(12px)` frosted glass effect
- Active tool indicator: neon ring + dot badge

**Color Palette (`ColorPalette.tsx`):**
- 20-color 90s-inspired grid (4 rows × 5 columns → black-to-white + saturated + neon)
- Closes on outside click via `pointerdown` listener with 50ms delay to avoid self-closing
- Native `<input type="color">` for custom colors

---

### Files created

| File | Purpose |
|------|---------|
| `src/types/createjs.d.ts` | Ambient type declarations for EaselJS global namespace |
| `src/types/drawing.ts` | Tool types, shape types, keyboard map, tool configs, palette |
| `src/app/globals.css` | CRT overlay, pixel rendering, tool pulse animation, toolbar glass |
| `src/app/layout.tsx` | Metadata, viewport (no user-scale), dark theme color |
| `src/components/welcome/WelcomeCanvas.tsx` | Welcome animation (6 phases, particles, CTA) |
| `src/components/canvas/DrawingCanvas.tsx` | Main canvas orchestrator (3 layers, transforms) |
| `src/components/canvas/Toolbar.tsx` | Bottom dock with 11 tools, keyboard shortcuts |
| `src/components/canvas/ColorPalette.tsx` | Slide-up color grid panel |
| `src/hooks/useDrawing.ts` | Freehand stroke logic + pressure + rAF render loop |
| `src/hooks/useShapes.ts` | EaselJS shape CRUD + drag-to-create + pressmove drag |
| `src/hooks/useEaselStage.ts` | Stage lifecycle, ticker, touch, cleanup |
| `src/app/page.tsx` | Welcome page (client component, dynamic import) |
| `src/app/draw/page.tsx` | Drawing tool page (client component, dynamic import) |

---

### Dependencies added

- `@createjs/easeljs` — Vector shape rendering, drag events, display list
- `perfect-freehand` — Pressure-sensitive smooth stroke outline generation

---

### Trade-offs and decisions

- **Raw Canvas vs EaselJS for welcome animation**: Raw Canvas is simpler for a state machine animation. EaselJS would add overhead for no benefit here.
- **`dynamic({ ssr: false })` in client components**: Next.js 16 requires `ssr: false` to be inside a Client Component. Pages marked `'use client'` satisfy this.
- **EaselJS `Ticker` singleton**: Only one Ticker exists per page — the drawing canvas registers it. If both canvases were active simultaneously, only one would control the ticker rate. Isolated to `/draw` page only, so no conflict.
- **`shapesCanvas` `pointerEvents` toggle**: When not in select mode, the shapes canvas is `pointer-events: none` so freehand drawing clicks pass through to the drawing canvas.
