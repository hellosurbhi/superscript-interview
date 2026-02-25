# BUGS

Tracked during QA testing session — 2026-02-25

---

## BUG-001: Escape key does not close AnimateOverlay

**Date found:** 2026-02-25
**File:** `src/components/canvas/AnimateOverlay.tsx:375`, `src/components/canvas/DrawingCanvas.tsx:193`
**Severity:** Medium
**Status:** Open

**What's happening:** Pressing Escape when the AnimateOverlay is open does nothing. The overlay stays open.

**Root cause:** `AnimateOverlay` textarea has `autoFocus` (line 368), so it receives focus immediately on open. The global Escape handler in `DrawingCanvas.tsx` (line 194) guards against `HTMLTextAreaElement` targets and returns early. The textarea's own `onKeyDown` handler (line 375) only handles `Enter`, not `Escape`. So Escape is silently swallowed.

**What should happen:** Pressing Escape should close the AnimateOverlay (same as clicking "× BACK") regardless of textarea focus state.

**Fix:** In `AnimateOverlay.tsx` textarea `onKeyDown`, add:
```js
if (e.key === 'Escape') { e.preventDefault(); onBack() }
```

---

## BUG-002: Welcome animation canvas text overflow on mobile

**Date found:** 2026-02-25
**File:** `src/components/welcome/WelcomeCanvas.tsx`
**Severity:** Low
**Status:** Open

**What's happening:** On mobile viewport (375px wide), the final row of the typewriter animation text in the WelcomeCanvas overflows the canvas boundary. The last word is truncated — "COLLA" is visible instead of the full word (likely "COLLABORATE").

**What should happen:** All text in the welcome canvas animation should be fully visible within the canvas bounds, wrapping or scaling to fit the smaller viewport.

**Fix:** The canvas text rendering should check available width per row and either wrap earlier or reduce font size on smaller viewports.

---

## BUG-003: Toolbar button clicks blocked by tooltip overlays in certain states

**Date found:** 2026-02-25
**File:** `src/components/canvas/LeftToolbar.tsx`
**Severity:** Low
**Status:** Open — needs manual verification

**What's happening:** When multiple toolbar tooltips are visible simultaneously (observed when AnimateOverlay was recently closed), clicking toolbar buttons (e.g., `?` shortcuts, bottom action buttons) returns "Element is blocked by another element." The tooltips appear to overlap the clickable targets.

**What should happen:** Tooltips should have `pointer-events: none` so they don't block underlying button clicks.

**Note:** This may be a testing artifact from `agent-browser` hover state persistence. Needs manual verification in a real browser.
