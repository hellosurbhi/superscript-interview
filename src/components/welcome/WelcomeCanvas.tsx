'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

const BLOCK_SIZE = 8
const PIXEL_COLORS = [
  '#00f5ff', '#ff006e', '#8338ec', '#06d6a0',
  '#ffd60a', '#fb5607', '#3a0ca3', '#4cc9f0',
  '#ff4d6d', '#c77dff', '#48cae4', '#f72585',
]

const LOGO_PIXELS = [
  // "SUPR" pixel art bitmap — each row is a string of 1s and 0s
  '11100 10100 01010 10101 0111',
  '10000 11100 01110 10001 1000',
  '11100 10100 01010 11111 1110',
  '10000 10100 01010 10001 1000',
  '11100 10100 01010 10001 0111',
]

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  color: string
  size: number
  alpha: number
  decay: number
}

export default function WelcomeCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const phaseRef = useRef(0)
  const tickRef = useRef(0)
  const particlesRef = useRef<Particle[]>([])
  const rafRef = useRef<number | null>(null)
  const [showCta, setShowCta] = useState(false)
  const [ctaHovered, setCtaHovered] = useState(false)
  const router = useRouter()

  const spawnParticles = useCallback((cx: number, cy: number) => {
    for (let i = 0; i < 24; i++) {
      const angle = (Math.PI * 2 * i) / 24
      const speed = 1.5 + Math.random() * 3
      particlesRef.current.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: PIXEL_COLORS[Math.floor(Math.random() * PIXEL_COLORS.length)],
        size: BLOCK_SIZE * (0.5 + Math.random()),
        alpha: 1,
        decay: 0.015 + Math.random() * 0.02,
      })
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const resize = () => {
      canvas.width = container.clientWidth
      canvas.height = container.clientHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const ctx = canvas.getContext('2d')!

    // ── Draw helpers ────────────────────────────────────────
    const drawPixelBlock = (x: number, y: number, color: string, alpha = 1) => {
      ctx.globalAlpha = alpha
      ctx.fillStyle = color
      ctx.fillRect(
        Math.round(x) * BLOCK_SIZE,
        Math.round(y) * BLOCK_SIZE,
        BLOCK_SIZE - 1,
        BLOCK_SIZE - 1
      )
      ctx.globalAlpha = 1
    }

    // Pre-generate grid blocks for phase 1
    const gridCols = Math.ceil(canvas.width / BLOCK_SIZE)
    const gridRows = Math.ceil(canvas.height / BLOCK_SIZE)
    const totalBlocks = gridCols * gridRows
    const blockRevealOrder: Array<{ gx: number; gy: number; color: string }> = []
    for (let gy = 0; gy < gridRows; gy++) {
      for (let gx = 0; gx < gridCols; gx++) {
        blockRevealOrder.push({ gx, gy, color: '#111' })
      }
    }
    // Shuffle for random fill effect
    for (let i = blockRevealOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[blockRevealOrder[i], blockRevealOrder[j]] = [blockRevealOrder[j], blockRevealOrder[i]]
    }

    let blocksRevealed = 0
    const blocksPerTick = Math.ceil(totalBlocks / 45) // fill in ~45 frames at 30fps

    // Phase 2: Logo text (typed character by character)
    const LOGO_TEXT = 'SUPRSCRIPT'
    let logoCharsShown = 0
    let logoBlinkOn = true
    let logoCursorTick = 0

    // Phase 3: Feature list
    const features = ['PENCIL  BRUSH  HIGHLIGHT', 'VECTORS  CIRCLES  DRAG', 'FLUID DRAWING  MOBILE']
    let featureIdx = 0
    let featureCharIdx = 0
    let featureTypeTick = 0

    // Phase 6: CTA blink (handled via React state)
    let ctaShown = false

    // Tool preview icons — positions for phase 4 "painting" characters
    const toolPreviewX = canvas.width * 0.5
    const toolPreviewY = canvas.height * 0.55
    let paintProgress = 0

    // ── Main loop ────────────────────────────────────────────
    const loop = () => {
      const W = canvas.width
      const H = canvas.height
      tickRef.current++
      const t = tickRef.current

      // Clear
      ctx.fillStyle = '#0a0a0a'
      ctx.fillRect(0, 0, W, H)

      // ── Phase 0: Initial single pixel (0–15 ticks) ─────────
      if (phaseRef.current === 0) {
        const alpha = Math.min(1, t / 10)
        const cx = Math.floor(W / 2 / BLOCK_SIZE)
        const cy = Math.floor(H / 2 / BLOCK_SIZE)
        drawPixelBlock(cx, cy, '#00f5ff', alpha)
        if (t >= 15) {
          phaseRef.current = 1
          spawnParticles(W / 2, H / 2)
        }
      }

      // ── Phase 1: Minecraft block explosion (16–90 ticks) ───
      if (phaseRef.current >= 1) {
        for (let i = 0; i < blocksRevealed; i++) {
          const b = blockRevealOrder[i]
          drawPixelBlock(b.gx, b.gy, b.color, 1)
        }
        if (phaseRef.current === 1) {
          blocksRevealed = Math.min(totalBlocks, blocksRevealed + blocksPerTick)
          if (blocksRevealed >= totalBlocks) phaseRef.current = 2
        }
      }

      // ── Phase 2: Logo typing (91–200 ticks) ─────────────────
      if (phaseRef.current >= 2) {
        // Neon grid overlay lines for logo area
        ctx.strokeStyle = 'rgba(0,245,255,0.06)'
        ctx.lineWidth = 1
        for (let lx = 0; lx < W; lx += BLOCK_SIZE * 4) {
          ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, H); ctx.stroke()
        }
        for (let ly = 0; ly < H; ly += BLOCK_SIZE * 4) {
          ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(W, ly); ctx.stroke()
        }

        if (phaseRef.current === 2) {
          if (t % 3 === 0 && logoCharsShown < LOGO_TEXT.length) logoCharsShown++
          if (logoCharsShown >= LOGO_TEXT.length) phaseRef.current = 3
        }

        // Draw typed logo
        const displayText = LOGO_TEXT.slice(0, logoCharsShown)
        ctx.font = `${Math.max(14, Math.floor(W / 22))}px 'Press Start 2P', monospace`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'

        // Glow layers
        for (const [blur, alpha] of [[30, 0.3], [15, 0.5], [6, 0.8], [0, 1]] as const) {
          ctx.shadowBlur = blur
          ctx.shadowColor = '#00f5ff'
          ctx.fillStyle = `rgba(0,245,255,${alpha})`
          ctx.fillText(displayText, W / 2, H * 0.28)
        }
        ctx.shadowBlur = 0

        // Cursor blink
        logoCursorTick++
        if (logoCursorTick % 30 === 0) logoBlinkOn = !logoBlinkOn
        if (logoCharsShown < LOGO_TEXT.length && logoBlinkOn) {
          const logoFontSize = Math.max(14, Math.floor(W / 22))
          const charWidth = logoFontSize * 0.6
          const textWidth = logoCharsShown * charWidth
          ctx.fillStyle = '#00f5ff'
          ctx.fillRect(W / 2 - textWidth / 2 + textWidth, H * 0.28 - logoFontSize * 0.6, 3, logoFontSize * 1.2)
        }
      }

      // ── Phase 3: Feature list typing (201–330 ticks) ────────
      if (phaseRef.current >= 3) {
        featureTypeTick++
        if (phaseRef.current === 3 && featureTypeTick % 2 === 0) {
          featureCharIdx++
          const current = features[featureIdx]
          if (featureCharIdx >= current.length) {
            featureCharIdx = current.length
            if (featureTypeTick % 40 === 0) {
              featureIdx++
              featureCharIdx = 0
              if (featureIdx >= features.length) {
                featureIdx = features.length - 1
                phaseRef.current = 4
              }
            }
          }
        }

        const featFontSize = Math.max(7, Math.floor(W / 55))
        ctx.font = `${featFontSize}px 'Press Start 2P', monospace`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'

        features.slice(0, featureIdx + 1).forEach((feat, idx) => {
          const displayFeat = idx === featureIdx ? feat.slice(0, featureCharIdx) : feat
          const alpha = idx === featureIdx ? 1 : 0.5
          ctx.fillStyle = `rgba(6,214,160,${alpha})`
          ctx.shadowColor = '#06d6a0'
          ctx.shadowBlur = idx === featureIdx ? 8 : 0
          ctx.fillText(displayFeat, W / 2, H * 0.42 + idx * (featFontSize + 10))
        })
        ctx.shadowBlur = 0
      }

      // ── Phase 4: Pixel paint strokes across screen ────────
      if (phaseRef.current >= 4) {
        paintProgress = Math.min(1, paintProgress + 0.008)

        // Animated pixel brush strokes
        const strokeCount = 6
        for (let s = 0; s < strokeCount; s++) {
          const progress = Math.max(0, paintProgress - s * 0.12)
          if (progress <= 0) continue
          const strokeLen = Math.floor(W / BLOCK_SIZE * progress * 0.7)
          const startGx = Math.floor(W / BLOCK_SIZE * 0.1) + s * 3
          const gy = Math.floor(H / BLOCK_SIZE * (0.58 + s * 0.04))
          const col = PIXEL_COLORS[s % PIXEL_COLORS.length]
          for (let i = 0; i < strokeLen; i++) {
            const wobble = Math.sin((i + s * 7) * 0.4) * 1
            drawPixelBlock(startGx + i, gy + Math.round(wobble), col, 0.7)
          }
        }

        if (paintProgress >= 1 && phaseRef.current === 4) phaseRef.current = 5
      }

      // ── Phase 5: Sub-label + transition to CTA ───────────
      if (phaseRef.current >= 5) {
        const subFontSize = Math.max(6, Math.floor(W / 65))
        ctx.font = `${subFontSize}px 'Press Start 2P', monospace`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = 'rgba(255,255,255,0.5)'
        ctx.fillText('DRAW. PAINT. CREATE. 2026.', W / 2, H * 0.72)

        if (!ctaShown) {
          ctaShown = true
          setTimeout(() => setShowCta(true), 600)
        }
      }

      // ── Particles ─────────────────────────────────────────
      particlesRef.current = particlesRef.current.filter((p) => {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.05
        p.alpha -= p.decay
        if (p.alpha <= 0) return false
        ctx.globalAlpha = p.alpha
        ctx.fillStyle = p.color
        ctx.fillRect(p.x, p.y, p.size, p.size)
        ctx.globalAlpha = 1
        return true
      })

      rafRef.current = requestAnimationFrame(loop)
    }

    // Throttle to ~30fps for retro vibe
    let lastTime = 0
    const throttledLoop = (time: number) => {
      if (time - lastTime > 33) {
        lastTime = time
        loop()
      } else {
        rafRef.current = requestAnimationFrame(throttledLoop)
      }
    }
    rafRef.current = requestAnimationFrame(throttledLoop)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [spawnParticles])

  const handleEnter = useCallback(() => {
    router.push('/draw')
  }, [router])

  return (
    <div ref={containerRef} className="relative w-full h-full bg-[#0a0a0a] overflow-hidden">
      {/* CRT overlay */}
      <div className="crt-overlay" />

      {/* Main animation canvas */}
      <canvas
        ref={canvasRef}
        className="pixel-canvas absolute inset-0 w-full h-full"
        style={{ display: 'block' }}
      />

      {/* CTA Button — React-rendered on top */}
      {showCta && (
        <div className="absolute inset-x-0 bottom-[18%] flex flex-col items-center gap-4 z-10">
          <button
            onClick={handleEnter}
            onMouseEnter={() => setCtaHovered(true)}
            onMouseLeave={() => setCtaHovered(false)}
            className={`
              font-pixel text-xs sm:text-sm px-6 py-4
              border-2 border-[#00f5ff] text-[#00f5ff]
              transition-all duration-200
              ${ctaHovered
                ? 'bg-[#00f5ff] text-[#0a0a0a] shadow-[0_0_30px_#00f5ff]'
                : 'bg-transparent neon-blink shadow-[0_0_12px_rgba(0,245,255,0.4)]'
              }
            `}
            style={{ letterSpacing: '0.15em' }}
          >
            ▶ PRESS START
          </button>

          <p className="font-pixel text-[8px] text-white/30 tracking-widest">
            TOUCH OR CLICK TO ENTER
          </p>
        </div>
      )}

      {/* Corner version tag */}
      <div className="absolute bottom-4 right-4 font-pixel text-[7px] text-white/20 z-10">
        v0.1 2026
      </div>
    </div>
  )
}
