import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: "What's Next — SurbhiDraw",
  description: 'Planned features that take SurbhiDraw from portfolio project to product.',
}

const ENHANCEMENTS = [
  {
    num: '01',
    emoji: '🖱️',
    title: 'MULTIPLAYER CANVAS',
    tag: 'REAL-TIME',
    desc: 'Share a canvas link and draw together. All cursors visible, all strokes synced in real time. Figma meets freehand sketching — powered by Supabase Realtime or WebSocket channels.',
  },
  {
    num: '02',
    emoji: '🎨',
    title: 'AI STYLE TRANSFER',
    tag: 'AI-POWERED',
    desc: 'Draw a rough sketch, pick a style — watercolor, oil painting, anime, pixel art. The AI redraws your composition in that style while keeping your shapes and layout intact.',
  },
  {
    num: '03',
    emoji: '⏱️',
    title: 'ANIMATION TIMELINE',
    tag: 'EDITOR',
    desc: 'A proper keyframe editor docked at the bottom of the canvas. Add easing curves, reorder layers, scrub frame by frame. Fine-tune every moment instead of regenerating from scratch.',
  },
  {
    num: '04',
    emoji: '📐',
    title: 'TEMPLATE LIBRARY',
    tag: 'CONTENT',
    desc: 'Wireframe kits, stick figures, UI components, common shapes — all drag-and-drop ready. Start from a solid foundation instead of staring at a blank canvas.',
  },
  {
    num: '05',
    emoji: '📦',
    title: 'EXPORT PIPELINE',
    tag: 'INTEGRATIONS',
    desc: 'Animations as MP4, GIF, WebM. Drawings as SVG or PNG. Direct export to Figma and Canva. Embeddable iframe code. Take your work anywhere it needs to go.',
  },
] as const

export default function EnhancementsPage() {
  return (
    <main
      style={{
        position: 'fixed',
        inset: 0,
        overflowY: 'auto',
        background: 'linear-gradient(180deg, #fff0f7 0%, #ffd6ea 100%)',
        padding: '56px 24px 72px',
      }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '56px' }}>
        <h1
          className="font-pixel text-[#e91e8c] leading-relaxed"
          style={{
            fontSize: 'clamp(10px, 2.5vw, 22px)',
            textShadow: '0 0 30px rgba(233,30,140,0.2), 0 0 10px rgba(233,30,140,0.15)',
            marginBottom: '20px',
            letterSpacing: '0.05em',
          }}
        >
          WHAT&apos;S NEXT<br />FOR SURBHIDRAW
        </h1>
        <p
          className="font-pixel text-[#7a3550]"
          style={{
            fontSize: 'clamp(5px, 0.9vw, 8px)',
            opacity: 0.65,
            lineHeight: 2,
          }}
        >
          where this goes from portfolio project to product
        </p>
      </div>

      {/* Cards grid */}
      <div
        style={{
          maxWidth: '900px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: '16px',
        }}
      >
        {ENHANCEMENTS.map(({ num, emoji, title, tag, desc }) => (
          <div
            key={num}
            className="transition-shadow duration-300 hover:shadow-[0_0_48px_rgba(233,30,140,0.14)]"
            style={{
              background: 'rgba(255,240,247,0.88)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid rgba(233,30,140,0.15)',
              borderRadius: '4px',
              padding: '24px',
              boxShadow: '0 0 24px rgba(233,30,140,0.05)',
            }}
          >
            {/* Number + Tag row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                marginBottom: '16px',
              }}
            >
              <span
                className="font-pixel"
                style={{ fontSize: '7px', color: 'rgba(233,30,140,0.35)' }}
              >
                {num}
              </span>
              <span
                className="font-pixel"
                style={{
                  fontSize: '5px',
                  color: 'rgba(233,30,140,0.6)',
                  border: '1px solid rgba(233,30,140,0.2)',
                  borderRadius: '2px',
                  padding: '2px 6px',
                  letterSpacing: '0.08em',
                }}
              >
                {tag}
              </span>
            </div>

            {/* Emoji icon */}
            <div style={{ fontSize: '36px', marginBottom: '16px', lineHeight: 1 }}>
              {emoji}
            </div>

            {/* Title */}
            <h2
              className="font-pixel text-[#3d1025]"
              style={{
                fontSize: '9px',
                letterSpacing: '0.06em',
                lineHeight: 1.8,
                marginBottom: '14px',
              }}
            >
              {title}
            </h2>

            {/* Description */}
            <p
              className="font-pixel text-[#7a3550]"
              style={{
                fontSize: '6px',
                lineHeight: 2.2,
                opacity: 0.7,
              }}
            >
              {desc}
            </p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', marginTop: '72px' }}>
        <a
          href="/"
          className="font-pixel text-[#ff006e]/45 hover:text-[#ff006e] transition-colors duration-200"
          style={{
            fontSize: '7px',
            textDecoration: 'none',
            letterSpacing: '0.08em',
          }}
        >
          ← BACK TO DRAWING
        </a>
      </div>
    </main>
  )
}
