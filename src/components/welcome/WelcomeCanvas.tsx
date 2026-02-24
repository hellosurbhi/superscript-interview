'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

const BLOCK_SIZE = 8
const PIXEL_COLORS = [
  '#00f5ff', '#ff006e', '#8338ec', '#06d6a0',
  '#ffd60a', '#fb5607', '#3a0ca3', '#4cc9f0',
  '#ff4d6d', '#c77dff', '#48cae4', '#f72585',
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
  const animBoxRef = useRef<HTMLDivElement>(null)
  const phaseRef = useRef(0)
  const tickRef = useRef(0)
  const particlesRef = useRef<Particle[]>([])
  const rafRef = useRef<number | null>(null)
  const [showCta, setShowCta] = useState(false)
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
    const animBox = animBoxRef.current
    if (!canvas || !animBox) return

    const resize = () => {
      canvas.width = animBox.clientWidth
      canvas.height = animBox.clientHeight
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(animBox)

    const ctx = canvas.getContext('2d')!

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

    const gridCols = Math.ceil(animBox.clientWidth / BLOCK_SIZE)
    const gridRows = Math.ceil(animBox.clientHeight / BLOCK_SIZE)
    const totalBlocks = gridCols * gridRows
    const blockRevealOrder: Array<{ gx: number; gy: number; color: string }> = []
    for (let gy = 0; gy < gridRows; gy++) {
      for (let gx = 0; gx < gridCols; gx++) {
        blockRevealOrder.push({ gx, gy, color: '#111' })
      }
    }
    for (let i = blockRevealOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[blockRevealOrder[i], blockRevealOrder[j]] = [blockRevealOrder[j], blockRevealOrder[i]]
    }

    let blocksRevealed = 0
    const blocksPerTick = Math.ceil(totalBlocks / 45)

    const LOGO_TEXT = 'SURBHIDRAW'
    let logoCharsShown = 0
    let logoBlinkOn = true
    let logoCursorTick = 0

    const features = ['DRAW  TEXT  ANIMATE', 'SELECT  DRAG  DELETE', 'SHARE  COLLABORATE  EXPIRE']
    let featureIdx = 0
    let featureCharIdx = 0
    let featureTypeTick = 0

    let ctaShown = false
    let paintProgress = 0

    const loop = () => {
      const W = canvas.width
      const H = canvas.height
      tickRef.current++
      const t = tickRef.current

      ctx.fillStyle = '#0a0a0a'
      ctx.fillRect(0, 0, W, H)

      // Phase 0: Initial single pixel
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

      // Phase 1: Minecraft block explosion
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

      // Phase 2: Logo typing
      if (phaseRef.current >= 2) {
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

        const displayText = LOGO_TEXT.slice(0, logoCharsShown)
        ctx.font = `${Math.max(12, Math.floor(W / 22))}px 'Press Start 2P', monospace`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'

        for (const [blur, alpha] of [[30, 0.3], [15, 0.5], [6, 0.8], [0, 1]] as const) {
          ctx.shadowBlur = blur
          ctx.shadowColor = '#00f5ff'
          ctx.fillStyle = `rgba(0,245,255,${alpha})`
          ctx.fillText(displayText, W / 2, H * 0.28)
        }
        ctx.shadowBlur = 0

        logoCursorTick++
        if (logoCursorTick % 30 === 0) logoBlinkOn = !logoBlinkOn
        if (logoCharsShown < LOGO_TEXT.length && logoBlinkOn) {
          const logoFontSize = Math.max(12, Math.floor(W / 22))
          const charWidth = logoFontSize * 0.6
          const textWidth = logoCharsShown * charWidth
          ctx.fillStyle = '#00f5ff'
          ctx.fillRect(W / 2 - textWidth / 2 + textWidth, H * 0.28 - logoFontSize * 0.6, 3, logoFontSize * 1.2)
        }
      }

      // Phase 3: Feature list typing
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

        const featFontSize = Math.max(6, Math.floor(W / 55))
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

      // Phase 4: Pixel paint strokes
      if (phaseRef.current >= 4) {
        paintProgress = Math.min(1, paintProgress + 0.008)

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

      // Phase 5: CTA reveal
      if (phaseRef.current >= 5) {
        const subFontSize = Math.max(5, Math.floor(W / 65))
        ctx.font = `${subFontSize}px 'Press Start 2P', monospace`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = 'rgba(255,255,255,0.4)'
        ctx.fillText('DRAW. CREATE. ANIMATE. 2026.', W / 2, H * 0.74)

        if (!ctaShown) {
          ctaShown = true
          setTimeout(() => setShowCta(true), 600)
        }
      }

      // Particles
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
      ro.disconnect()
    }
  }, [spawnParticles])

  const handleEnter = useCallback(() => {
    router.push('/draw')
  }, [router])

  return (
    <div
      onClick={handleEnter}
      className="relative w-full h-full bg-[#0a0a0a] overflow-hidden cursor-pointer flex items-center justify-center"
    >
      {/* CRT scanline overlay */}
      <div className="crt-overlay" />

      {/* Centered animation box — ~60% of screen */}
      <div
        ref={animBoxRef}
        className="relative"
        style={{ width: '60%', height: '60%' }}
      >
        <canvas
          ref={canvasRef}
          className="pixel-canvas absolute inset-0 w-full h-full"
          style={{ display: 'block' }}
        />

        {/* Subtle border on animation box */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ border: '1px solid rgba(0,245,255,0.08)' }}
        />
      </div>

      {/* Welcome text — bottom right of screen */}
      {showCta && (
        <div className="absolute bottom-8 right-8 text-right z-10 pointer-events-none panel-slide-up max-w-xs">
          <h1 className="font-pixel leading-relaxed mb-3 text-white" style={{ fontSize: 'clamp(8px, 1.2vw, 13px)' }}>
            Welcome to SurbhiDraw!
          </h1>
          <p className="font-pixel text-white/50 leading-relaxed mb-4" style={{ fontSize: 'clamp(5px, 0.7vw, 8px)' }}>
            Draw wireframes, art prototypes, pretty much anything
            your heart desires — and let&apos;s see if we can help
            you animate it (still in progress)
          </p>
          <p
            className="font-pixel text-white/20 leading-relaxed mb-3"
            style={{ fontSize: 'clamp(4px, 0.55vw, 7px)' }}
          >
            tip: your drawing is saved for this session,<br />but not between sessions (yet)
          </p>
          <p
            className="font-pixel text-white/20 leading-relaxed mb-3"
            style={{ fontSize: 'clamp(4px, 0.55vw, 7px)' }}
          >
            Press ? for keyboard shortcuts
          </p>
          <p className="font-pixel text-[#00f5ff] neon-blink tracking-widest" style={{ fontSize: 'clamp(6px, 0.8vw, 9px)' }}>
            ▶ CLICK ANYWHERE TO BEGIN
          </p>
        </div>
      )}

      {/* Corner version tag */}
      <div className="absolute bottom-4 left-4 font-pixel text-[7px] text-white/20 z-10">
        v0.1 2026
      </div>
    </div>
  )
}
