# CHANGELOG

## fix: rename page title from SuprScript to SurbhiDraw
**Date:** 2026-02-25
**Commit:** 990de12

The `layout.tsx` title had been changed locally but never committed — Vercel was still serving "SuprScript — Draw. Paint. Create." in the browser tab. Committed the unstaged change and pushed along with the favicon commits so Vercel picks up all three updates.

**Files affected:** `src/app/layout.tsx`

---

## feat: add custom pencil favicon (amber on dark, matches app theme)
**Date:** 2026-02-25
**Commit:** 31048a3

Created `src/app/icon.svg` — a 32×32 SVG pencil icon with dark rounded background (`#0a0a0a`) and amber pencil (`#f59e0b`/`#fcd34d` tip/`#fde68a` eraser). Next.js App Router auto-serves `app/icon.svg` as the site favicon, taking priority over the default `favicon.ico` in modern browsers. Title was already correct (`SurbhiDraw — Draw. Paint. Create.`) so no changes to `layout.tsx` were needed. Colors chosen to match the app's existing amber selected-stroke aesthetic and dark theme.

**Files affected:** `src/app/icon.svg` (created)

---

## fix: Escape key now closes AnimateOverlay from textarea
**Date:** 2026-02-25
**Commit:** f042bbd

### What changed
**src/components/canvas/AnimateOverlay.tsx:**
- Added `if (e.key === 'Escape') { e.preventDefault(); onBack() }` to the textarea's `onKeyDown` handler

### Why
The AnimateOverlay textarea has `autoFocus`, so it immediately captures keyboard focus when the panel opens. The global Escape handler in `DrawingCanvas.tsx` guards against `HTMLTextAreaElement` targets and returns early — meaning Escape was silently swallowed and the overlay could never be dismissed via keyboard. The BACK button still worked because it's a click. Now Escape triggers `onBack()` directly from the textarea handler, restoring expected dismiss-on-Escape behavior consistent with every other panel in the app.

### Bugs logged
Created `BUGS.md` to track 3 findings from the 2026-02-25 QA session:
- BUG-001 (Medium): Escape not closing AnimateOverlay — **now fixed**
- BUG-002 (Low): Welcome animation text truncated on mobile canvas edge
- BUG-003 (Low): Tooltip overlays may block button clicks — needs manual verification

---

## fix: add supabase env validation + fix APP_URL fallbacks for production
**Date:** 2026-02-25
**Commit:** 10adfd7

### What changed
**src/lib/supabase-server.ts:**
- Added explicit env var validation before `createClient()` — logs `NEXT_PUBLIC_SUPABASE_URL` and whether `SUPABASE_SERVICE_ROLE_KEY` is present on every cold start
- Throws a clear `Error` if either is missing, making the failure a visible 500 in Vercel Function logs instead of a silent broken client that returns `null` on every query (which then masquerades as "drawing not found" 404s in the share pages)

**src/app/api/drawings/route.ts:**
- Fixed wrong fallback `APP_URL` from `'https://surbhidraw.vercel.app'` to `'https://superscript-interview.vercel.app'` (the actual Vercel project URL)
- Added diagnostic `console.log` for `APP_URL` and `SUPABASE_URL` at handler entry

**src/app/api/animations/route.ts:**
- Fixed completely broken fallback `APP_URL` from `'http://localhost:3000'` to `'https://superscript-interview.vercel.app'` — animation share URLs were pointing to localhost in production when `NEXT_PUBLIC_APP_URL` wasn't set

### Why
Share links were returning 404 in production but working locally. Root causes: (1) `SUPABASE_SERVICE_ROLE_KEY` not being set in Vercel env silently caused all Supabase queries to fail, making `getDrawing()` return null → API returning 404 → share page showing "expired" state. (2) Animation share URLs were generated with `http://localhost:3000` as the base in production, making them completely broken. (3) The fallback for drawing share URLs used a wrong domain (`surbhidraw.vercel.app` instead of `superscript-interview.vercel.app`).

### After deploying
Visit `https://superscript-interview.vercel.app/api/drawings` in browser:
- **405 Method Not Allowed** → routes are live, routing works ✓
- **500** → Supabase env vars missing in Vercel dashboard → add `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL` in Vercel Project Settings → Environment Variables

### Files affected
- `src/lib/supabase-server.ts`
- `src/app/api/drawings/route.ts`
- `src/app/api/animations/route.ts`

---

## fix: sort sessions chronologically by startTime after building
**Date:** 2026-02-25
**Commit:** f957484

### What changed
**scripts/parse-sessions.js:**
- After the session-building loop, added `sessions.sort((a, b) => (a.startTime > b.startTime ? 1 : -1))` and `sessions.forEach((s, i) => { s.index = i + 1 })`
- Removed the previous `let sessionIndex = 1` / `index: sessionIndex++` counter since indices are now assigned post-sort

### Why
Sessions were ordered by `Map` insertion order, which was determined by which session's first event appeared first when scanning all events sorted by timestamp. Noise events (`progress`, `file-history-snapshot`) from one session could appear before the first real event of another session, causing the session display order to be wrong. Explicit sort by `startTime` after building the array guarantees correct chronological ordering regardless of event noise.

### Files affected
- `scripts/parse-sessions.js`
- `public/session.json`

---

## fix: session parser filters system-injected messages + split prompt/response display
**Date:** 2026-02-25
**Commit:** 5472ebd

### What changed
**scripts/parse-sessions.js:**
- Changed tool_result filter from `every()` to `some()` — any message containing ANY tool_result block is now treated as a tool response, not a user prompt
- Added `isSystemInjectedMessage()` helper that filters out: skill/command markdown expansions (lines starting with `# Heading`), context compaction summaries ("This session is being continued..."), `[Request interrupted]` signals, `[Image:]` path descriptions, compact echo messages (`❯` prefix), and GSD plan submissions ("Implement the following plan:")
- Added `queue-operation` to the known event types list and skip list (encountered in the `6e14b79f` session)
- Regenerated `public/session.json`: 7 sessions → 10 sessions (added ec5c902e, 5a4e8210, 6e14b79f which weren't in the previous parse); 39 turns → 30 turns (9 noisy/system-injected turn headers removed)

**src/app/session/page.tsx:**
- Added `truncateHeader()` helper: takes first line of user message, truncates to 120 chars, appends `…` if multiline or truncated
- Card header now shows truncated text with CSS `overflow:hidden` + `textOverflow:ellipsis` — no more multi-paragraph walls of text as card headers
- Expanded card body restructured into two visually distinct sections:
  - **YOU block** (pink left border `rgba(255,0,110,0.45)`, warm tint): shows full user prompt text with "YOU" label
  - **Claude response block** (muted gray left border `rgba(255,255,255,0.08)`): file pills, bash commands, diffs, assistant text — same content as before, just properly labeled
- Search query highlighting works in both the truncated header AND the full YOU block in the expanded body

### Why
The session viewer was showing skill expansions, continuation summaries, and interrupt signals as top-level card headers — making it look like Claude's generated content was the user's prompts. The new `isSystemInjectedMessage()` guard filters these structurally, and the display changes make it immediately clear which text is the user's prompt vs Claude's response.

### Files affected
- `scripts/parse-sessions.js`
- `src/app/session/page.tsx`
- `public/session.json`

---

## feat: animation history panel with auto-save, play, share, delete
**Date:** 2026-02-25
**Commit:** 907d120

### What changed

**Auto-save on generation** — previously animations were only saved to DB when the user clicked the SHARE button. Now, the moment Claude returns animation code, it is automatically saved to the animations table (linked to the drawing). `handleGenerate` in AnimateOverlay fires-and-forgets `onAnimationGenerated(code, prompt)` after `setPhase('playing')`. The SHARE button in playback controls now just shows the pre-saved URL via `AnimShareOverlay` (no longer triggers the API call).

**New: `AnimationHistoryPanel`** — slide-out panel from the right side. Triggered by the `≡` button in LeftToolbar below Animate. Shows all animations for the current drawing as cards. Each card has:
- `v{n}` version badge (v1 = oldest, newest at top)
- Prompt text (truncated 1 line)
- Relative timestamp (`just now`, `5m ago`, `2h ago`, `3d ago`)
- Thumbnail: `<img>` if `preview_image` exists, else pink gradient placeholder
- ▶ Play, ↗ Share (copies link, shows "✓ Copied!" 2s), 🗑 Delete (with loading state)
- Empty state with friendly message when no animations yet

**Play from history** — clicking ▶ on any card calls `handlePlayFromHistory(anim)` in DrawingCanvas, which sets `animationToPlay` and `activeTool = 'animate'`. AnimateOverlay then uses `animationToPlay.preview_image` as background and `animationToPlay.animation_code` as `preloadedCode`. `onAnimationGenerated` is passed as `undefined` when playing from history (no re-save).

**Delete** — calls `DELETE /api/animations/{id}` (animation UUID). On success removes from `historyAnimations` state immediately.

**History fetch** — when panel opens and `drawingIdRef.current` is set, fetches `GET /api/drawings/{id}/animations`. Also updated live via prepend when a new animation is generated.

### API changes
- `getAnimationsForDrawing` now returns `StoredAnimation[]` (full objects, `select('*')` instead of minimal fields)
- `deleteAnimation(id)` added to `src/lib/animations.ts`
- `POST /api/animations` now returns `animation` (full `StoredAnimation`) alongside existing fields
- New `GET /api/drawings/[token]/animations/route.ts` — lists animations by drawing UUID
- New `DELETE` handler in `src/app/api/animations/[token]/route.ts` — deletes by animation UUID

### Prop rename
`onShareAnimation` on AnimateOverlay renamed to `onAnimationGenerated` to reflect that it's now called automatically after generation, not on share click.

### Files affected
- `src/lib/animations.ts`
- `src/app/api/animations/route.ts`
- `src/app/api/animations/[token]/route.ts`
- `src/app/api/drawings/[token]/animations/route.ts` (new)
- `src/components/canvas/AnimationHistoryPanel.tsx` (new)
- `src/components/canvas/AnimateOverlay.tsx`
- `src/components/canvas/DrawingCanvas.tsx`
- `src/components/canvas/LeftToolbar.tsx`

## feat: separate shareable links for drawings and animations
**Date:** 2026-02-25
**Commit:** 0f6db51

### What changed

**New: `animations` table** — run the SQL migration below in Supabase. Stores animation records independently of the drawings table, each with its own `share_token`, `preview_image` (canvas PNG at animate time), `canvas_width/height`, and rolling 24-hr expiry.

**New: `src/lib/animations.ts`** — DB helpers: `createAnimation`, `getAnimationByToken`, `getAnimationsForDrawing`, `touchAnimation` (reset expiry on view).

**`src/lib/drawings.ts`** — added `share_token` to `StoredDrawing` interface and `getDrawingById(id)` helper (no expiry check — used by animation API to fetch drawing even if expired).

**New: `POST /api/animations`** — creates animation record linked to `drawing_id`. Returns `{ share_url: /share/animation/[token], expiresAt }`.

**New: `GET /api/animations/[token]`** — fetches animation, touches expiry on view, fetches drawing (for strokes + back-link). Drawing being expired does not break the animation (strokes fall back to `[]`).

**`GET /api/drawings/[token]`** — now includes `animations: []` list in response (share_token, animation_prompt, created_at for each live animation on this drawing).

**`AnimateOverlay.tsx`**:
- `onShare` prop replaced with `onShareAnimation?: (code, prompt) => Promise<{ url }>` — async, returns the animation share URL
- New `viewerMode?: boolean` prop — hides REDO and SHARE buttons, relabels BACK → "DRAWING ↗"
- New `AnimShareOverlay` inline component — dark mini-modal with copy button that appears after sharing animation
- New `animShareState` / `animShareUrl` state for managing the share flow inside the overlay

**`DrawingCanvas.tsx`**:
- Extracted `ensureDrawingSaved()` — idempotent, creates drawing if needed, sets refs, updates URL
- `handleShare()` (toolbar) — now only calls `ensureDrawingSaved()` + shows modal; no animation_code saved to drawing anymore
- New `handleShareAnimation(code, prompt)` — ensures drawing saved, then POSTs to `/api/animations` with `preview_image` and canvas dimensions from `animateSnapshot`

**`ShareModal.tsx`** — added optional `title` prop (default: `'SHARE DRAWING'`).

**New: `/share/animation/[token]/page.tsx`** — view-only animation playback page. Fetches `/api/animations/[token]`, renders `AnimateOverlay` with `viewerMode=true` and `preloadedCode`. DRAWING ↗ button navigates to `/share/[drawing_token]` or home.

**`/share/[token]/page.tsx`** — added `animations` array to `SharedData` type. If drawing has any live animations, renders a fixed top-right "ANIMATIONS" section with links to `/share/animation/[token]`.

### SQL migration to run
```sql
CREATE TABLE animations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drawing_id    UUID REFERENCES drawings(id) ON DELETE CASCADE,
  animation_code    TEXT NOT NULL,
  animation_prompt  TEXT NOT NULL,
  preview_image     TEXT,
  canvas_width      INTEGER,
  canvas_height     INTEGER,
  share_token       TEXT UNIQUE NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at        TIMESTAMPTZ NOT NULL
);
CREATE INDEX animations_share_token_idx ON animations(share_token);
CREATE INDEX animations_drawing_id_idx  ON animations(drawing_id);
```

### Design decisions
- `drawings` table unchanged — existing share links with `animation_code` still work via `initialAnimationCode` prop (legacy auto-play)
- Animation viewer is self-contained: `preview_image` stored so animation plays even if drawing expires
- `ensureDrawingSaved` is idempotent so sharing an animation from an unsaved canvas creates the drawing first transparently
- Animation share overlay lives inside `AnimateOverlay` (not DrawingCanvas) so it stays visually close to where the user clicked SHARE

### Files affected
- `src/lib/animations.ts` (new)
- `src/lib/drawings.ts`
- `src/app/api/animations/route.ts` (new)
- `src/app/api/animations/[token]/route.ts` (new)
- `src/app/api/drawings/[token]/route.ts`
- `src/components/canvas/AnimateOverlay.tsx`
- `src/components/canvas/DrawingCanvas.tsx`
- `src/components/canvas/ShareModal.tsx`
- `src/app/share/animation/[token]/page.tsx` (new)
- `src/app/share/[token]/page.tsx`

## feat: cycling loading messages + linear progress bar in AnimateOverlay
**Date:** 2026-02-25
**Commit:** 247967d

### What changed
- Added `LOADING_MESSAGES` array (10 entries) above the component — wellness nudges, fun facts, hype lines
- Added `loadingMessage` + `loadingBarPct` state
- New `useEffect` keyed on `phase.name`: when phase enters `'loading'`, immediately picks a random message, then cycles every 4s; simultaneously ticks a progress bar increment (95/150 per 200ms) to reach 95% over ~30s, clamped there until phase changes
- Removed the old CSS `@keyframes loadingBar` pulse animation entirely
- Replaced static "GENERATING ANIMATION..." heading + "Claude is writing your animation · 10–20 seconds" subtitle with a single cycling message div (`text-[8px]`, `lineHeight: 2`, `maxWidth: 260` for wrapping)
- Progress bar: now a `bg-white/5` track rail with a width-driven fill (`width: ${loadingBarPct}%`, `transition: width 0.2s linear`, pink glow `boxShadow: 0 0 8px #ff006e`)

### Why
Loading screen felt static and dead — gave no feedback about time or progress. Cycling messages add warmth and personality. The deterministic linear fill (95% over 30s, holds) is more honest than an infinite pulse that implies no forward movement.

### Files affected
- `src/components/canvas/AnimateOverlay.tsx`

## feat: JSONL session parser + structured /session viewer
**Date:** 2026-02-24
**Commit:** ef081d9

### What changed
Replaced the `session.txt` / `❯⏺` text-parsing approach with a proper structured pipeline: a Node script that parses all Claude Code `.jsonl` session files and emits `public/session.json`, plus a fully rewritten `/session` page that consumes it.

### Files affected
- `scripts/parse-sessions.js` — new parser script
- `src/app/session/page.tsx` — full rewrite
- `public/session.json` — generated output (490KB, 7 sessions, 39 turns)

### scripts/parse-sessions.js
Pure Node.js (no deps), idempotent. Run: `node scripts/parse-sessions.js`

- Reads all 8 `.jsonl` files from `~/.claude/projects/-Users-surbhi-workspace-suprscript-interview/`
- Filters noise: skips `tool_result` user messages (Claude API sends tool results as `user` role events — these were previously inflating turn count to 566), empty messages after stripping system injections, and `progress` / `system` / `file-history-snapshot` events
- Groups events by `sessionId`, sorts by `timestamp` chronologically
- Builds turns per session: each actual user message = one turn, collecting all subsequent `assistant`/`direct` events until next user message
- Extracts from `tool_use` blocks in assistant content: `Read` → filesRead, `Write` → filesWritten, `Edit`/`MultiEdit` → filesModified + diff (old_string/new_string), `Bash` → bashCommands
- Strips `<system-reminder>`, `<local-command-caveat>`, and other injected XML tags from user messages
- Computes stats: 7 sessions, 39 turns, 441 tool calls, 24 files created, 20 modified, +2540/-1196 lines, 8h 59m total
- Logs unrecognized event types to stdout

### src/app/session/page.tsx
- Fetches `/session.json` (not `session.txt`) on mount
- Stats dashboard: 8 stat cards in auto-fill grid (sessions, turns, tool calls, files created, files modified, +lines, -lines, duration)
- Session sections: `"Session N — Feb 24, 10:24am · 12m"` header with pink left border, slug below
- Turn cards: user message as clickable header with `❯` accent, tool count pill; body collapsed by default
- Body: file pills (green=written, amber=modified, gray=read, capped at 5+N more), bash commands with `$` prefix, diffs (red removed / green added), assistant text with code-fence rendering
- Sticky controls: turn count, search input (filters + highlights), Expand All / Collapse All
- Search auto-expands filtered turns; highlight uses yellow `<mark>`

---

## feat: add 5s polling sync for /share/[token] views
**Date:** 2026-02-24
**Commit:** 81744b5

### What changed
Shared drawing viewers now automatically see updates without reloading. Every 5 seconds, the share page polls the drawing API, compares `updated_at`, and repaints the canvas if the drawing changed. A subtle "↻ synced" flash appears in the bottom-right corner on updates.

### Files affected
- `src/hooks/useDrawing.ts` — added `setExternalStrokes`
- `src/components/canvas/DrawingCanvas.tsx` — added `shareToken` prop + polling + toast
- `src/app/share/[token]/page.tsx` — passes `shareToken={token}` to DrawingCanvas

### Implementation details

**`setExternalStrokes(strokes)`** (useDrawing.ts): New function on the hook return that replaces `completedStrokesRef.current` and immediately calls `redrawAll`. Bypasses session storage and all draw state — pure external data injection.

**Polling effect** (DrawingCanvas.tsx):
- Activated only when `shareToken` prop is set (opt-in — normal draw page unaffected)
- `setInterval(poll, 5000)` — cleans up on unmount via returned `clearInterval`
- Skips poll if `drawing.isDrawing.current === true` (never interrupts an active stroke)
- First poll: seeds `lastUpdatedAtRef` with server's `updated_at`, no repaint (strokes already shown from initial render)
- Subsequent polls: if `updated_at` changed → calls `setExternalStrokes` + `setSyncFlash(true)` → resets after 1s
- Silent failure on network errors or non-200 responses

**Sync toast**: Always rendered (zero height impact), `opacity: 0` normally. On flash: `opacity: 0.7` with `transition: 'none'` (instant appear). When flash ends: `transition: 'opacity 0.5s ease-out'` (smooth fade). Font-pixel, `#ff006e`, bottom-right corner.

### Decisions
- Polling over WebSockets: simpler, zero infrastructure, good enough for a demo
- 5s interval: short enough to feel live, cheap enough to not spam the API
- `isDrawing` guard: prevents jarring mid-stroke canvas repaints from concurrent edits

---

## feat: add /session build log viewer page
**Date:** 2026-02-24
**Commit:** d97c5db

### What changed
New `/session` route that displays the full Claude Code session transcript as an interactive log viewer. Interviewers can drop `public/session.txt` (the raw Claude Code session output) and visit `/session` to browse the entire build session.

### Files affected
- `src/app/session/page.tsx` — new client component (full viewer)
- `src/components/welcome/WelcomeCanvas.tsx` — added "view build log →" link

### session/page.tsx details

**Parsing:** Scans `session.txt` line by line. Lines starting with `❯` are turn boundaries — their text becomes the card title. All subsequent lines (including `⏺` Claude response lines) up to the next `❯` are the card body.

**Viewer features:**
- Sticky controls bar: live turn count, search input, Expand All / Collapse All
- Cards default to collapsed; click header to expand/collapse
- Cards with >50 body lines show truncated content + "show more / show less" toggle
- Search filters turns in real time and highlights matches in yellow (`#facc15`)
- When search is active, matching turns auto-expand
- `` ``` `` code fences → `<pre>` block with `#111` bg and pink left border
- Lines starting with `+` → green (#4ade80); lines starting with `-` → red (#f87171); excludes `---`, `-->`, `+++`
- `⏺` markers stripped from display; a subtle `⏺` glyph shown as a Claude block separator
- Loading / error (file not found) / empty parse states all handled
- Dark theme: `#0a0a0a` bg, `#ff006e` accent, `#ededed` text, `font-pixel` headers, Geist Mono body
- Scrolling fix: `position:fixed; inset:0; overflow-y:auto` on `<main>` bypasses global `body { overflow:hidden }`

**Decisions:**
- No syntax highlighting library (Prism etc.) — kept it simple with just dark bg monospace code blocks. Adds no bundle weight.
- `'use client'` required because fetch + multiple useState/useMemo needed
- Auto-expand on search: UX is better than forcing manual expand when filtering

### WelcomeCanvas change
Added a third stacked link `view build log →` to `/session` below the existing `what's next →` link. `e.stopPropagation()` prevents the welcome-dismiss handler from firing on click.

---

## feat: add /enhancements page and landing link
**Date:** 2026-02-24
**Commit:** 3114dd8

### What changed
Added a `/enhancements` product roadmap page showcasing 5 planned features, plus a subtle "what's next →" link in the landing page's bottom-left corner.

### Files affected
- `src/app/enhancements/page.tsx` — new server component
- `src/components/welcome/WelcomeCanvas.tsx` — added nav link

### enhancements/page.tsx details
- Server component (no `'use client'`), purely static with CSS hover
- Warm gradient background matching WelcomeCanvas (`#fff0f7 → #ffd6ea`)
- 5 feature cards: Multiplayer Canvas, AI Style Transfer, Animation Timeline, Template Library, Export Pipeline
- Each card: num/tag row, emoji icon, pixel-font title, muted description
- CSS Grid `auto-fill minmax(260px,1fr)` — responsively stacks to single column on mobile
- Scrolling fix: `position:fixed; inset:0; overflow-y:auto` on `<main>` bypasses the global `html,body { overflow:hidden }` rule in globals.css
- Footer: `← BACK TO DRAWING` link to `/`

### WelcomeCanvas.tsx changes
- Bottom-left corner now stacks `v0.1 2026` above `what's next →`
- `e.stopPropagation()` on the anchor prevents the click from bubbling to the outer `div onClick={onEnter}` which would have dismissed the welcome screen instead of navigating

---

## feat: full pink/magenta retheme — zero cyan/blue remaining
**Date:** 2026-02-24
**Commit:** 27da112

### What changed
Replaced every trace of the `#00f5ff` cyan hacker aesthetic and `#0d0d1a` blue-black toolbar background with warm pink/magenta, making the entire app feel cohesive and personal.

### Color mapping
| Old | New | Where |
|-----|-----|-------|
| `#00f5ff` | `#ff006e` | Active states, glows, labels, sliders, progress bars, loaders, link text |
| `rgba(0,245,255,X)` | `rgba(255,0,110,X)` | All rgba variants of the above |
| `#0d0d1a` | `#1a0812` | Toolbar glass, modal/overlay backgrounds, tooltips |
| `rgba(13,13,26,X)` | `rgba(26,8,18,X)` | Expanded form of above |
| Palette `#00ffff` | `#f72585` | Drawing palette — vivid magenta |
| Palette `#00f5ff` | `#ff4d94` | Drawing palette — light pink |
| Palette `#4cc9f0` | `#ff85b3` | Drawing palette — soft rose |
| LOADER_COLORS `#00f5ff` | `#f72585` | Pixel loader animation |

### Files changed
- `src/app/globals.css` — CSS custom properties, tool-pulse keyframes, toolbar-glass border, neon-text-blue class
- `src/components/canvas/AnimateOverlay.tsx` — all four phases (idle/loading/error/playing), progress bars, controls pill, generate button
- `src/components/canvas/LeftToolbar.tsx` — sidebar bg/border, active tool highlight, all tooltips, slider, brand mark
- `src/components/canvas/Toolbar.tsx` — stroke width slider gradient/accent, active tool ring
- `src/components/canvas/ColorPalette.tsx` — COLOR header label, selected color ring + ring-offset
- `src/components/canvas/ShortcutsOverlay.tsx` — card background, border, glow, KEYBOARD SHORTCUTS title
- `src/app/share/[token]/page.tsx` — expired-state "Start a new one →" link
- `src/types/drawing.ts` — PALETTE_COLORS array

### Preserved
- `#ff006e` delete/clear danger actions — same pink, no conflict
- Amber/orange selected stroke halo — still works against pink
- `#1a1a2e` default drawing stroke color — dark ink on light canvas
- `#0000ff`, `#3a0ca3` — fundamental blue/indigo drawing colors kept
- WelcomeCanvas.tsx — was already fully warm/pink themed, untouched

### Verification
Grep for `00f5ff`, `0d0d1a`, `rgba(0,245,255`, `rgba(13,13` in `src/` → zero results.

---

## fix: make StoredDrawing.updated_at nullable to match DB column
**Date:** 2026-02-24
**Commit:** e4755f7

### What changed
`StoredDrawing.updated_at` was typed `string` (non-nullable) but the `drawings` table column is `NULL` on fresh rows — `updateDrawing()` is the only caller that sets it, and only after an animation save. Typing it as non-nullable was a silent type lie that would cause issues when reading back a freshly-created drawing.

**File:** `src/lib/drawings.ts:12`
- `updated_at: string` → `updated_at: string | null`

### Context
Part of fixing POST /api/drawings 500. The primary fix is creating the `drawings` table in Supabase (SQL below); this type fix is the companion code change. No behaviour changes — purely a type correction.

---

## fix: animation engine crash — accurate frameData schema, per-frame resilience, pre-eval check
**Date:** 2026-02-24
**Commit:** 56c1b18

### Root cause
Three compounding problems caused the "Cannot read properties of undefined (reading 'x')" crash:

1. **Wrong system prompt schema**: `frameData` was described with a `bbox: {x,y,w,h}` property that doesn't exist at runtime. The LLM faithfully generated `stroke.bbox.x` → undefined dereference. Also: `points` was shown as optional with no type detail, hiding the required `[i].x` access pattern.

2. **Stop-on-first-frame error**: The RAF loop's try-catch called `stopLoop()` on any throw, killing the whole animation immediately. One bad frame (e.g. on progress=0 before strokes were ready) was fatal.

3. **No pre-eval validation**: LLM-generated code was compiled with `new Function()` with no check for whether it even referenced `frameData.strokes`, so hallucinated data structures failed silently.

### Fixes

**`src/app/api/animate/route.ts`** — Replaced single-line `frameData:` description with:
- Exact `FreehandStroke` type: `{ id, tool, points: [{x,y,pressure}], color, size, opacity }`
- Exact `TextStroke` type: `{ id, type:"text", text, x, y, fontSize, color }`
- Explicit type guard pattern (`stroke.type === "text"`)
- Points access guard: `if (!stroke.points?.length) continue`
- Hard `IMPORTANT: There is NO bbox` warning
- Full usage example showing both stroke types

**`src/components/canvas/AnimateOverlay.tsx`**:
- Added `frameErrorCountRef = useRef(0)` to track consecutive frame errors
- Per-frame catch: `console.error` with progress + error, then continue the RAF (don't stop)
- Hard-stop only after 30 consecutive errors (prevents silent infinite loops)
- Pre-eval: warns to console if code omits `frameData` entirely or uses `frameData` without `.strokes`
- Resets `frameErrorCountRef` to 0 when a new animation compiles (no cross-animation bleed)

### Files affected
- `src/app/api/animate/route.ts`
- `src/components/canvas/AnimateOverlay.tsx`

---

## feat: warm landing retheme + seamless canvas transition
**Date:** 2026-02-24
**Commit:** 3f41bad

### Transition fix
`/` and `/draw` are now the same page. `DrawingCanvas` mounts immediately and runs silently behind the landing overlay. Clicking the overlay sets `dismissing=true` → CSS transition `opacity 0, scale 1.04` over 600ms → overlay unmounts at 650ms. `pointerEvents: none` is set on the overlay the instant dismissal starts, so the canvas is interactive before the animation even finishes. No `router.push`, no page reload, no flash.

### Vibe retheme — `WelcomeCanvas.tsx`
- **Background:** Canvas now draws a warm cream-to-pink linear gradient (`#fff0f7` → `#ffd6ea`) each frame instead of the flat `#0a0a0a` fill. Outer div also gets the matching CSS gradient.
- **PIXEL_COLORS:** Replaced cyan/blue/green neon palette with pinks, magentas, warm oranges, golds, and coral.
- **Phase 0:** Single center pixel now magenta `#e91e8c` instead of cyan.
- **Phase 1 (block reveal):** Blocks are soft pink-white `#f8e4f0` instead of `#111`.
- **Phase 2 (logo):** SURBHIDRAW types out in magenta `rgba(233,30,140)` with pink glow layers and pink cursor. Grid lines are a barely-visible pink tint.
- **Phase 3 (features):** Text is dark-rose `rgba(100,20,60)` with a soft `#c2185b` shadow instead of green.
- **Phase 4 (NEW — pixel girl):** Replaced 6 horizontal paint strokes with a pixel-art girl character (brown skin `#8B5E3C`, dark hair `#1a0834`, all-pink outfit `#e91e8c`). She walks left-to-right at 3px/tick with 2 walk frames (legs alternate every 8 ticks). Every 3 ticks she drops a sparkle trail dot (randomly positioned around her feet, cycling through PIXEL_COLORS, fading out at 0.006 alpha/tick). Phase advances to 5 when she exits the right edge.
- **Phase 5 (subtitle):** "DRAW. CREATE. ANIMATE. 2026." in dim warm rose `rgba(100,20,60,0.5)` instead of white.
- **CTA panel:** Warm `rgba(255,240,247,0.88)` glass panel with magenta border/glow. All text in dark-wine and warm mauve tones.
- **Removed:** `.crt-overlay` div (scanlines clash with warm background).
- **Props change:** `WelcomeCanvas` now accepts `{ onEnter, dismissing }` instead of using `useRouter` internally.

### `globals.css`
Updated `@keyframes neon-blink` text-shadow from cyan `#00f5ff` to pink `#e91e8c` (used by "▶ CLICK ANYWHERE TO BEGIN").

### `page.tsx`
Imports both `DrawingCanvas` and `WelcomeOverlay` dynamically. Maintains `showWelcome` + `dismissing` state. Passes `onEnter` and `dismissing` to the overlay.

### Files affected
- `src/app/page.tsx`
- `src/components/welcome/WelcomeCanvas.tsx`
- `src/app/globals.css`

---

## feat: add '?' shortcuts hint to welcome screen CTA
**Date:** 2026-02-24
**Commit:** 70e4d9d

### What changed
Added a dim "Press ? for keyboard shortcuts" line to the bottom-right CTA overlay in `WelcomeCanvas.tsx`, inserted between the session tip and the "CLICK ANYWHERE TO BEGIN" blink prompt. Uses the same `text-white/20` dim style and `clamp(4px, 0.55vw, 7px)` font size as the session tip — keeps visual hierarchy consistent and non-intrusive.

### Why
The `?` shortcuts overlay was added to `/draw` but had zero discoverability. New users landing on the welcome screen have no idea the shortcut exists. One unobtrusive hint line bridges that gap without cluttering the animation.

### Files affected
- `src/components/welcome/WelcomeCanvas.tsx` — added hint `<p>` in `{showCta}` block

---

## fix: share button crash — SyntheticEvent passed as animationCode to JSON.stringify
**Date:** 2026-02-24
**Commit:** b5201d0

### Root cause
`LeftToolbar.tsx:253` had `onClick={onShare}` (direct reference). React calls `onShare(syntheticMouseEvent)`, and since `handleShare` has signature `(animationCode?: string, animationPrompt?: string)`, the click event became `animationCode`. The SyntheticEvent is truthy, so `animationCode ?? null` kept the event object. `JSON.stringify({ ..., animation_code: SyntheticEvent })` then hit a circular reference inside React's fiber node (`_targetInst.return` → parent fiber → `child` → back), throwing "Converting circular structure to JSON". The catch block swallowed it silently, setting `shareState('error')` with no log. No network call was ever made.

### Fix
- `LeftToolbar.tsx` — Changed `onClick={onShare}` → `onClick={() => onShare()}`. Wrapping in an arrow function prevents the click event from being forwarded as an argument.
- `DrawingCanvas.tsx` — Added `console.error('[handleShare]', err)` to the main share catch block so future failures are always visible.
- `DrawingCanvas.tsx` — Added `console.error('[handleShare] animation PUT failed:', err)` to the silent `.catch(() => {})` in the already-shared branch.
- `DrawingCanvas.tsx` — Wrapped `canvas.toDataURL()` in its own try/catch: image capture failure now logs and falls back to `null` instead of aborting the entire share.

### Files affected
- `src/components/canvas/LeftToolbar.tsx` — root cause fix (1 char change)
- `src/components/canvas/DrawingCanvas.tsx` — logging + toDataURL guard

## feat: keyboard shortcuts overlay — ?, sidebar button, Escape to close
**Date:** 2026-02-24
**Commit:** fc0bf40

### What changed

**`ShortcutsOverlay.tsx`** (new) — Fixed `z-[200]` overlay with dark `#0d0d1a` card, `border-[#00f5ff]/15`, backdrop blur. Lists 10 shortcuts in two-column rows: `<kbd>` pill (pixel font, subtle border) on the left, faint description on the right. Meta entries (`?`, `Esc`) are dimmed to distinguish them from action shortcuts. Footer says "? or ESC to close". Closes on `Escape`, `?`, or click-outside the card.

**`LeftToolbar.tsx`** — Added `onShowShortcuts` prop. Wired `?` key into existing keyboard `useEffect` (also added `A` → animate tool which was missing). Added `?` button at the very bottom of the sidebar — 40×40, extra-subtle `text-white/25` resting state, cyan on hover, tooltip "Shortcuts · ?".

**`DrawingCanvas.tsx`** — Added `showShortcuts` state, imported `ShortcutsOverlay`, renders it when true. Passes `onShowShortcuts={() => setShowShortcuts(true)}` to LeftToolbar. Expanded the Delete-key `useEffect` to also handle `Escape`: closes shortcuts overlay and deselects any selected stroke.

### Files affected
- `src/components/canvas/ShortcutsOverlay.tsx` — CREATE
- `src/components/canvas/LeftToolbar.tsx` — add prop + `?` key + button + `A` key fix
- `src/components/canvas/DrawingCanvas.tsx` — state, import, render, Escape handler

## feat: Supabase sharing — share_token, modal, /share route, animation persistence
**Date:** 2026-02-24
**Commit:** 99bb07f

### What changed

Full sharing flow implemented from scratch on top of the partially-wired skeleton.

**Database** — Added 4 new columns: `share_token` (text, unique), `animation_code` (text, nullable), `animation_prompt` (text, nullable), `canvas_image` (text, nullable). Index on `share_token` for fast lookups. SQL migration provided in plan file.

**Server-only Supabase client** (`src/lib/supabase-server.ts`) — New file using `SUPABASE_SERVICE_ROLE_KEY` (never exposed to browser). All API routes and DB operations now use this client instead of the anon key.

**`src/lib/drawings.ts`** — Updated all 3 functions: `getDrawing` now looks up by `share_token` (not UUID), selects `id`/`animation_code`/`animation_prompt` in addition to existing fields. `createDrawing` now accepts `shareToken` and `canvasImage`. `updateDrawing` now optionally accepts `animationCode`/`animationPrompt` and sets them conditionally.

**API route rename** — `[id]` folder renamed to `[token]`. GET now queries Supabase by `share_token`; PUT still accepts UUID `id` (DrawingCanvas stores both). Avoids any naming collision: canvas auto-saves via UUID, shares load via short token.

**`POST /api/drawings`** — Now uses `nanoid(10)` for `share_token`, captures `canvas_image` from request body, returns `{ id, share_token, share_url, expiresAt }` instead of just `{ id, expiresAt }`. `share_url` uses `NEXT_PUBLIC_APP_URL` env var (defaults to `https://surbhidraw.vercel.app`).

**`/share/[token]` route** (`src/app/share/[token]/page.tsx`) — Replaced the old `/draw/[id]` route. Loads drawing by share token. Passes `drawingId` (UUID for auto-save), `initialStrokes`, `initialAnimationCode`, `initialAnimationPrompt` to DrawingCanvas. Same loading/expired states as old route.

**`ShareModal.tsx`** (`src/components/canvas/ShareModal.tsx`) — New modal component. Shows share URL in selectable input, COPY/COPIED! button with 2s feedback, expiry/edit disclaimer, close ×. Closes on Escape key and click-outside. Consistent pixel font + neutral card style.

**`DrawingCanvas.tsx`** — Added `initialAnimationCode` + `initialAnimationPrompt` props. Added `shareTokenRef` and `shareUrlRef` to store share metadata alongside UUID. `handleShare` reworked: opens modal instead of copying directly; if already shared, opens modal immediately; captures `canvas_image` via `drawingCanvasRef.toDataURL()`; navigates to `/share/{token}`. Auto-play animation effect: on mount, if `initialAnimationCode` is truthy, sets `activeTool = 'animate'`. Passes `onShare` and `preloadedCode` to AnimateOverlay. Renders `ShareModal`.

**`LeftToolbar.tsx`** — Share button moved to very bottom (below Clear), as requested. Removed "copied" state from button display — the modal handles feedback now.

**`AnimateOverlay.tsx`** — Added `onShare?: (code, prompt) => void` and `preloadedCode?: string` props. If `preloadedCode` is provided, phase initializes directly to `'playing'` (auto-plays without going through idle). Share button appears in playing controls when `onShare` is provided.

### Files affected
- `src/lib/supabase-server.ts` — CREATE
- `src/lib/drawings.ts` — MODIFY
- `src/app/api/drawings/route.ts` — MODIFY
- `src/app/api/drawings/[id]/` → `[token]/route.ts` — RENAME + MODIFY
- `src/app/share/[token]/page.tsx` — CREATE (was draw/[id])
- `src/app/draw/[id]/page.tsx` — DELETE
- `src/components/canvas/ShareModal.tsx` — CREATE
- `src/components/canvas/DrawingCanvas.tsx` — MODIFY
- `src/components/canvas/LeftToolbar.tsx` — MODIFY
- `src/components/canvas/AnimateOverlay.tsx` — MODIFY

### Before running
1. Run this SQL in Supabase dashboard:
   ```sql
   ALTER TABLE drawings ADD COLUMN IF NOT EXISTS share_token text UNIQUE;
   ALTER TABLE drawings ADD COLUMN IF NOT EXISTS animation_code text;
   ALTER TABLE drawings ADD COLUMN IF NOT EXISTS animation_prompt text;
   ALTER TABLE drawings ADD COLUMN IF NOT EXISTS canvas_image text;
   CREATE INDEX IF NOT EXISTS drawings_share_token_idx ON drawings(share_token);
   ```
2. Add to `.env.local`: `SUPABASE_SERVICE_ROLE_KEY=<service_role_key>`

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
