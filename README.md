# SurbhiDraw

A freehand drawing and AI animation tool. Draw anything, then describe how it should move — Claude handles the rest.

**Live:** [surbhi-draw.surbhi.tv](https://surbhi-draw.surbhi.tv)

---

## Features

- Freehand drawing with pencil and eraser tools
- Shape selection and deletion
- AI-powered animation via Claude API — describe it, watch it run
- Shareable links for drawings and animations (Supabase-backed, 30-day TTL)
- Session viewer — full Claude Code build log at [/session](https://surbhi-draw.surbhi.tv/session)

## Stack

Next.js · TypeScript · Canvas API · Supabase · Claude API · Vercel

## Links

- [Build log →](https://surbhi-draw.surbhi.tv/session)
- [What's next →](https://surbhi-draw.surbhi.tv/enhancements)

---

## Known Limitations

- **Canvas clears on window resize.** This is a Canvas API limitation — resizing the browser window clears the pixel buffer. Strokes are persisted in `sessionStorage` and repainted automatically after resize, but there may be a brief flash during window resize. Session storage is cleared when the tab closes.

---

_Built as part of a technical interview for Superscript NYC._
