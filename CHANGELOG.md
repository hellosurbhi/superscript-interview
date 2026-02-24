# CHANGELOG

## fix: pointer offset, resize data loss, session persistence, tip copy
**Date:** 2026-02-24
**Commit:** 09142be

### What changed

Four fixes applied in a single commit.

**Bug 1 — Pointer offset (`DrawingCanvas.tsx`, `useDrawing.ts`)**
`getEventPos` was calling `getBoundingClientRect()` on `drawingCanvasRef` (the canvas element inside the CSS-transformed div), which double-counted the translation. Fixed by using `wrapperRef` instead — the wrapper has no CSS transform so its rect is always the ground-truth origin. Simultaneously refactored `startStroke` and `continueStroke` in `useDrawing.ts` to accept pre-computed `(x, y, pressure)` instead of a raw `PointerEvent` + transform object, eliminating a second redundant coord calculation in the hook. DrawingCanvas is now the single source of truth for coordinate mapping.

**Bug 2a — Canvas clears on resize (`DrawingCanvas.tsx`)**
The ResizeObserver only repainted on the first resize when `initialStrokes` were present. Replaced `let painted = false` guard with unconditional `drawing.redrawFromHistory()` on every resize — canvas pixel buffer clears on any dimension change, so always repainting is correct.

**Bug 2b — sessionStorage persistence (`useDrawing.ts`)**
Strokes are now saved to `sessionStorage` under `surbhidraw_strokes` after every mutation (endStroke, undoLast, deleteSelectedStroke, clearCanvas, addTextStroke). On mount the hook restores strokes from session storage; the ResizeObserver then repaints them once the canvas is sized. Both read and write are gated by `initialStrokes?.length` so shared `/draw/[id]` views never overwrite the session key.

**Copy — session tip (`WelcomeCanvas.tsx`)**
Added a subtle tip line above "CLICK ANYWHERE TO BEGIN" in the welcome CTA overlay: "tip: your drawing is saved for this session, but not between sessions (yet)". Styled at `clamp(4px, 0.55vw, 7px)` in `text-white/20`.

**Docs (`README.md`)**
Added Known Limitations section documenting the canvas-clears-on-resize behavior and sessionStorage workaround.

### Files affected
- `src/hooks/useDrawing.ts` — added `useEffect` import; `SESSION_KEY` constant; sessionStorage restore effect; `saveToSession` callback; refactored `startStroke`/`continueStroke` signatures; added `saveToSession()` calls in `endStroke`, `undoLast`, `deleteSelectedStroke`, `clearCanvas`, `addTextStroke`
- `src/components/canvas/DrawingCanvas.tsx` — `getEventPos` uses `wrapperRef`; ResizeObserver always calls `redrawFromHistory()`; `handlePointerDown` and `handlePointerMove` call sites updated; removed `transformArgs` local
- `src/components/welcome/WelcomeCanvas.tsx` — session tip `<p>` added in CTA overlay
- `README.md` — Known Limitations section added

### Trade-offs
- sessionStorage is cleared on tab close — not a full persistence solution but appropriate for an ephemeral canvas tool. The tip copy sets correct expectations.
- The ResizeObserver repaint adds ~1ms overhead on every resize event but is negligible and necessary for correctness.

## fix: delete→undo, soft-tap dot, hover cursor, ⌘⌥ toggle, onboarding tutorial
**Date:** 2026-02-24
**Commit:** 2d3e268

### What changed

Six UX improvements across `useDrawing.ts`, `DrawingCanvas.tsx`, and `LeftToolbar.tsx`.

**Fix 1 — Delete key undoes when nothing selected**
Previously `Delete`/`Backspace` was a no-op when no stroke was selected. Now falls back to `undoLast()`, matching user expectation that "delete means undo last thing."

**Fix 2 — Soft tap on empty canvas draws a dot**
The `isTap` path in `handlePointerUp` always called `cancelCurrentStroke()` — discarding the dot that `startStroke()` already rendered on pointerdown. New logic: check hit with `hitTestAtPoint` first; if empty space, call `endStroke()` instead to commit the dot.

**Fix 3 — Real-time hover cursor + no paint splash**
Added `hitTestAtPoint` to `useDrawing` (pure hit test, no side effect on `selectedStrokeIdRef`). `handlePointerMove` runs a throttled (~30fps) hover check updating `hoverStrokeId` state + ref. Cursor now shows `grab` as soon as pointer hovers over any stroke. `handlePointerDown` blocks freehand start when `hoverStrokeIdRef.current` is set — prevents the brief freehand paint-splash before tap-select fires.

**Fix 4 — ⌘⌥ keyboard shortcut for pencil↔eraser toggle**
Added `(e.metaKey || e.ctrlKey) && e.altKey` handler in LeftToolbar's keyboard `useEffect`. Toggles: eraser → pencil, anything else → eraser. `activeTool` added to effect dependency array.

**Fix 5 — Hover tooltips + 5-second onboarding tutorial**
`LeftToolbar` receives new `showTutorial: boolean` prop. `DrawingCanvas` drives it via `useState(true)` + 5s `setTimeout`. Each sidebar button (and undo/clear/share) renders a tooltip label to the right when hovered or when `showTutorial` is true. Tooltip shows tool name + keyboard shortcuts including the new ⌘⌥ toggle. Sidebar `overflow: visible` added so tooltips extend outside the 56px sidebar width.

### Files affected
- `src/hooks/useDrawing.ts` — Added + exported `hitTestAtPoint`
- `src/components/canvas/DrawingCanvas.tsx` — Hover state + refs, tutorial state, all pointer handler changes
- `src/components/canvas/LeftToolbar.tsx` — Rewrote with tooltips, tutorial prop, ⌘⌥ shortcut, `activeTool` dep

## feat: add AI animation feature — prompt-to-canvas animation via Claude
**Date:** 2026-02-24
**Commit:** 0e2f3b1

### What changed
Unlocked the ⚡ Animate button in the left sidebar. Users can now type a natural-language prompt describing how they want their drawing to animate. Claude generates a looping Canvas 2D animation script that plays over the original drawing.

### Interaction flow
1. Click ⚡ in sidebar → bottom sheet slides up with prompt textarea
2. Type prompt + hit Generate (or Enter) → pixel-block loader appears
3. Claude returns JS animation code → plays back immediately in full-screen
4. Controls: Pause/Play, Restart, Regenerate (re-prompts), Back to Drawing

### Files affected
- `src/app/api/animate/route.ts` (**new**) — POST handler: receives `{imageDataUrl, prompt, strokes}`, calls Anthropic Messages API with vision, sanitizes returned code, returns `{code}`
- `src/components/canvas/AnimateOverlay.tsx` (**new**) — Full state machine component: idle → loading → playing → error. Pixel-block loader canvas, animation playback with rAF loop, floating controls pill, progress bar
- `src/components/canvas/LeftToolbar.tsx` — Removed `comingSoon: true` from animate button
- `src/components/canvas/DrawingCanvas.tsx` — Added `animateSnapshot` state (captured via `toDataURL` when animate activates), renders `AnimateOverlay` at z-[100]

### Decisions made
- **Direct fetch to Anthropic API** (no SDK) — avoids a heavy dependency for a small number of API calls; uses `claude-sonnet-4-6` with vision
- **`new Function('return (' + code + ')')()` for execution** — wraps function expression and calls it, returning the function. Safer than `eval` because `new Function` has no access to local scope; still inside try-catch per frame
- **`sanitize()`**: strips markdown fences, extracts the `animate` function, blocks 12 dangerous APIs (`fetch`, `document`, `window`, `eval`, `setTimeout`, etc.)
- **Canvas snapshot on tool switch**: `toDataURL('image/png')` is called once when the user clicks ⚡ — the animation always plays over the drawing at that moment, not a live capture
- **`ANIM_DURATION = 7000ms`** per loop — long enough for complex animations, short enough for satisfying loops
- **Pixel loader**: shuffled block-reveal animation matching the WelcomeCanvas aesthetic; loops indefinitely with random re-shuffle
- **`isPausedRef`** (not state) for pause: avoids stale closure in rAF loop; `isPaused` in phase state only drives UI rendering
- **Phase-driven `useEffect`**: detects `phase.name === 'playing'` via code dependency — recompiles + reloads bg image each time a new code string arrives (handles Regenerate correctly)

## feat: add text tool with canvas baking, selection, drag, and delete
**Date:** 2026-02-24
**Commit:** 988b90f

### What changed
Added a full text tool to SurbhiDraw. Users can now place typed text anywhere on the canvas that integrates with the existing selection/drag/delete system.

### Files affected
- `src/types/drawing.ts` — Added `'text'` to `DrawTool` union; split `CompletedStroke` into a union of `FreehandStroke | TextStroke`; added `isTextStroke()` type guard; added `strokeWidthToFontSize()` utility; reassigned keyboard shortcut `t` from `'triangle'` to `'text'`
- `src/components/canvas/LeftToolbar.tsx` — Added "T" button between Eraser and Animate; added `t`/`T` keyboard handler; added font-size px display when text tool is active; added `isContentEditable` guard
- `src/components/canvas/Toolbar.tsx` — Removed triangle's `'T'` shortcut label; added `isContentEditable` guard to prevent tool-switching while typing in the overlay
- `src/hooks/useDrawing.ts` — `redrawAll` renders text strokes via `ctx.fillText`; added `addTextStroke()`; fixed `selectStrokeAtPoint`, `isPointOnStroke`, `moveStroke`, `drawSelectionHalo` to handle the union type
- `src/components/canvas/DrawingCanvas.tsx` — Added text overlay state + contenteditable div; `commitTextOverlay()` bakes text on Enter; `handlePointerDown` commits open overlay then blocks freehand; `handlePointerUp` opens overlay on tap; zoom/pan auto-commits; cursor = `'text'`; tool hint shows font size

### Decisions made
- **Union type with discriminant**: `TextStroke.type = 'text'` distinguishes from legacy freehand strokes. Old Supabase strokes lack this field → `isTextStroke` returns false → zero migration needed
- **`textBaseline: 'top'`**: Both overlay div and canvas rendering use top-left origin for text, ensuring the overlay's position exactly matches where the baked text appears
- **`textValueRef` (not useState)**: Avoids stale closure issue where the commit callback would capture an old text value
- **No return after commit-on-click**: Letting pointer events fall through after `commitTextOverlay()` means the same click opens a new overlay (chain placement UX)
- **Bounding-box hit detection**: `ctx.measureText` width × fontSize height, not offscreen pixel sampling — appropriate since text has no irregular shape
- **`isContentEditable` guard added to all keyboard handlers**: Without this, typing "brush" in the text overlay would switch tools (b → brush, r → rect, etc.)

## feat: unified draw-select-drag interaction model
**Date:** 2026-02-24
**Commit:** 6b266a6

### What changed and why

Collapsed the multi-mode (pencil / eraser / select) friction model into a single gesture-driven interaction. Users no longer need to switch tools to select or erase — the gesture determines the action.

**New interaction table:**
- `pointerdown` + drag → draw stroke (pencil/brush/highlighter based on active tool)
- `pointerdown` + release < 5px + < 200ms on a stroke → **select** (amber halo, cursor → grab)
- `pointerdown` + release < 5px + < 200ms on empty space → **deselect**
- `pointerdown` ON selected stroke + drag → **move** (stroke and halo track in realtime)
- `Delete`/`Backspace` with selection → **delete** (now works in any tool mode, removed eraser guard)
- `Shift` + drag → **eraser** (temporary, reverts on shift release; eraser button in sidebar highlights)
- Eraser sidebar / `E` key → **explicit persistent eraser mode**

**`useDrawing.ts` additions:**
- `isPointOnStroke(x, y, id)` — renders a single stroke to offscreen canvas, pixel-tests the exact point. Used to detect if a pointerdown on a selected stroke should start a drag vs. a new stroke
- `moveStroke(id, dx, dy)` — mutates all points of a stroke by (dx, dy) in canvas coords, triggers immediate redraw. Called per-frame during drag for smooth realtime movement

**`DrawingCanvas.tsx` full pointer handler rewrite:**
- Removed `eraserHasMovedRef`, `eraserDownPosRef`, `ERASER_MOVE_THRESHOLD`
- Added `hasMovedRef`, `downPosRef`, `downTimeRef`, `isDraggingRef`, `dragLastPosRef` for unified tap/drag detection
- Added `shiftHeld` state (shift key tracking useEffect) — drives eraser visual highlight and temporary eraser mode
- Added `isDragging` state alongside ref for cursor re-renders
- `handlePointerDown`: checks shift/eraser first, then drag-on-selected, then starts draw stroke
- `handlePointerMove`: handles drag (moveStroke + redraw halo), then eraser, then draw
- `handlePointerUp`: ends drag / commits eraser / tap-selects / commits draw stroke
- Cursor: `grabbing` (dragging) → `grab` (selected) → `cell` (eraser/shift) → `crosshair` (draw)
- LeftToolbar receives `shiftHeld ? 'eraser' : activeTool` so the eraser button lights up on shift
- Hint text updated: "DRAG TO MOVE · DELETE TO REMOVE" when stroke selected; shows shift state in tool name

**Files affected:** `src/hooks/useDrawing.ts`, `src/components/canvas/DrawingCanvas.tsx`

---

## feat: selection halo + cursor feedback for eraser component-select
**Date:** 2026-02-24

### What changed and why

When the eraser click-selects a stroke, the user now sees an amber/orange glow halo drawn around the selected shape and the cursor changes to a pointer (finger). Switching back to pencil or any other tool clears the selection and reverts the cursor to crosshair.

**Halo implementation:**
- Added `drawSelectionHalo(haloCtx, w, h)` to `useDrawing` — reads `selectedStrokeIdRef` and `completedStrokesRef` directly (no reactive deps)
- For single-dot strokes: draws a `strokeStyle` ring + `shadowBlur` glow
- For multi-point strokes: recomputes `perfect-freehand` path with `size + 8` (so halo sits outside the original stroke), fills with 18% opacity amber + `shadowBlur: 18` for soft glow
- Added `haloCanvasRef` in `DrawingCanvas` — second transparent canvas inside the same CSS-transform div, `pointerEvents: none`
- `useEffect` on `selectedStrokeId` state triggers `drawing.drawSelectionHalo(...)` on every selection change
- Both canvases included in `ResizeObserver` so halo canvas stays correctly sized

**Also fixed:** `scheduleSave` was declared after `handlePointerUp` referenced it, causing TS2448/2454 errors. Moved `scheduleSave` above `handlePointerUp`.

**Also added to `useDrawing`:** `drawSelectionHalo` export; `getStrokes` and `redrawFromHistory` (already present from linter update, now fully wired).

### Files modified
- `src/hooks/useDrawing.ts` — Added `drawSelectionHalo`, exported it
- `src/components/canvas/DrawingCanvas.tsx` — Added `haloCanvasRef`, halo canvas layer, halo redraw `useEffect`, moved `scheduleSave` before `handlePointerUp`

---

## feat: redesign as SurbhiDraw — left sidebar, click-anywhere landing, component-level eraser
**Date:** 2026-02-24

### What changed and why

Rebranded and redesigned the full UX per product spec. Key changes:

**Landing page (`/`)**
- Animation canvas now confined to a centered `60% × 60%` box with ~20% dark space on each side, giving the Minecraft animation a "stage" rather than filling the whole screen
- Full outer wrapper is `onClick={handleEnter}` — clicking anywhere (including dark margins) navigates to `/draw` with zero friction
- "SUPRSCRIPT" → "SURBHIDRAW" branding in the typed logo animation
- Feature list updated: `DRAW  SKETCH  WIREFRAME` / `PENCIL  ERASE  ANIMATE` / `FLUID DRAWING  MOBILE`
- Welcome text overlay (bottom-right) shows after animation completes: "Welcome to SurbhiDraw!", description, and "▶ CLICK ANYWHERE TO BEGIN"

**Drawing tool (`/draw`)**
- **Left sidebar** (`LeftToolbar.tsx` — new file): Replaces the 11-tool bottom dock with a minimal vertical sidebar (3 tools: Pencil, Eraser, Animate placeholder). Animate is visually dimmed with "SOON" label.
- **Vertical thickness slider**: Appears below Pencil button when active. Uses CSS `transform: rotate(-90deg)` for cross-browser vertical range input.
- **Immediate drawing feedback** (`useDrawing.ts`): Drawing now responds on `pointerDown` with an immediate dot. Previously `perfect-freehand` required 2+ points before rendering; now single-point taps render a circle at the click position immediately.
- **Component-level eraser**: Eraser now distinguishes between drag (paint-erase) and click (select component). Clicking with eraser selects the topmost stroke at that point using offscreen canvas pixel hit-testing. "PRESS DELETE TO REMOVE" hint appears. `Delete`/`Backspace` removes the entire selected stroke.
- **Light canvas background**: Drawing surface is now warm off-white `#f5f5f0` with subtle light grid lines — feels like paper rather than a dark terminal.
- Removed shape tools (EaselJS shapes, select tool, shape preview canvas) from the simplified UI.

**CSS (`globals.css`)**
- Added `.canvas-grid-light` for the light-background drawing canvas
- Added `.panel-slide-up` utility class (reuses `slide-up-fade` keyframe)

### Files modified
- `src/types/drawing.ts` — Added `'animate'` to `DrawTool` union
- `src/hooks/useDrawing.ts` — `drawDot` helper, single-point stroke fix, `cancelCurrentStroke`, `selectStrokeAtPoint`, `deleteSelectedStroke`
- `src/components/canvas/DrawingCanvas.tsx` — Full rewrite: LeftToolbar, light canvas, eraser click/drag distinction, Delete key handler, removed EaselJS layers
- `src/components/welcome/WelcomeCanvas.tsx` — Full rewrite: confined canvas box, full-page click, SurbhiDraw branding, updated feature list, CTA overlay
- `src/app/globals.css` — Added `.canvas-grid-light`, `.panel-slide-up`

### Files created
- `src/components/canvas/LeftToolbar.tsx` — Vertical 3-tool sidebar with vertical thickness slider

### Trade-offs
- Removed EaselJS shape tools from the UI (code still present in old hooks) to focus on the core pencil/erase/animate flow. Can be reintroduced as a 4th "Shapes" tool later.
- `selectStrokeAtPoint` uses offscreen canvas pixel sampling — O(n) strokes per click. Fast enough in practice since it's not on every pointer event.
- Eraser `ERASER_MOVE_THRESHOLD = 5px` distinguishes tap from drag. Touch devices naturally have ~2-3px jitter; 5px provides comfortable headroom.

---

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
