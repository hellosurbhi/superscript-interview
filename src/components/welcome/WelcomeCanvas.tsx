'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

const BLOCK_SIZE = 8

const PIXEL_COLORS = [
  '#ff2d9e', '#ff6eb4', '#ff9ecd', '#ff6b35',
  '#ffb347', '#ffd700', '#e040fb', '#f48fb1',
  '#ff4081', '#ff80ab', '#ffcc02', '#ff5722',
]

// ─── Pixel girl sprite ────────────────────────────────────────
const GIRL_SPR = 5  // canvas pixels per sprite pixel

const GIRL_PAL: Record<string, string> = {
  K: '#111118',  // outline
  H: '#1a0834',  // dark hair
  h: '#6b21a8',  // purple hair highlight
  S: '#8B5E3C',  // brown skin
  s: '#c49060',  // lighter skin
  P: '#e91e8c',  // hot pink outfit
  p: '#ff80ab',  // light pink
  W: '#ffffff',  // white (eyes)
  e: '#2d0055',  // eye pupils
  Y: '#ffd700',  // gold accessories
  G: '#8B4513',  // brush handle
  T: '#ffd166',  // brush tip/bristles
}

// 12 cols × 16 rows — '.' = transparent
const GIRL_FRAMES: string[][] = [
  // Frame 0: right leg forward
  [
    '..KKKKKK....',
    '.KHHhHhHK...',
    '.KHHHHHHK...',
    'KHHSSSSHHK..',
    'KHSssSSsHK..',
    'KHSWeWeWHK..',
    'KHS.SSS.HK..',
    '.KHSSSSSK...',
    '.KPPpPpPK..G',
    'KPPPPPPPPpKG',
    'KPPYPPPPPpKG',
    '.KppPPPpK..T',
    '..KPK.KPK...',
    '..KPK.KSK...',
    '..KSK.KKK...',
    '..KKK.......',
  ],
  // Frame 1: left leg forward
  [
    '..KKKKKK....',
    '.KHHhHhHK...',
    '.KHHHHHHK...',
    'KHHSSSSHHK..',
    'KHSssSSsHK..',
    'KHSWeWeWHK..',
    'KHS.SSS.HK..',
    '.KHSSSSSK...',
    '.KPPpPpPKP.G',
    'KPPPPPPPPpKG',
    'KPPYPPPPPpKG',
    '.KppPPPpK..T',
    '..KSK.KPK...',
    '..KSK.KPK...',
    '..KKK.KSK...',
    '.......KKK..',
  ],
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

interface TrailDot {
  x: number
  y: number
  color: string
  alpha: number
}

interface WelcomeCanvasProps {
  onEnter: () => void
  dismissing: boolean
}

export default function WelcomeCanvas({ onEnter, dismissing }: WelcomeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animBoxRef = useRef<HTMLDivElement>(null)
  const phaseRef = useRef(0)
  const tickRef = useRef(0)
  const particlesRef = useRef<Particle[]>([])
  const rafRef = useRef<number | null>(null)
  const [showCta, setShowCta] = useState(false)

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

    const drawGirl = (gx: number, gy: number, frame: number) => {
      const rows = GIRL_FRAMES[frame]
      for (let row = 0; row < rows.length; row++) {
        for (let col = 0; col < rows[row].length; col++) {
          const ch = rows[row][col]
          if (ch === '.' || ch === ' ') continue
          const color = GIRL_PAL[ch]
          if (!color) continue
          ctx.fillStyle = color
          ctx.fillRect(
            Math.round(gx + col * GIRL_SPR),
            Math.round(gy + row * GIRL_SPR),
            GIRL_SPR - 1,
            GIRL_SPR - 1
          )
        }
      }
    }

    const gridCols = Math.ceil(animBox.clientWidth / BLOCK_SIZE)
    const gridRows = Math.ceil(animBox.clientHeight / BLOCK_SIZE)
    const totalBlocks = gridCols * gridRows
    const blockRevealOrder: Array<{ gx: number; gy: number; color: string }> = []
    for (let gy = 0; gy < gridRows; gy++) {
      for (let gx = 0; gx < gridCols; gx++) {
        blockRevealOrder.push({ gx, gy, color: '#f8e4f0' })
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

    // Phase 4: pixel girl walk state
    const GIRL_W = 12 * GIRL_SPR
    const GIRL_H = 16 * GIRL_SPR
    let girlX = -GIRL_W
    let walkFrame = 0
    let walkTick = 0
    const trail: TrailDot[] = []
    let trailColorIdx = 0

    const loop = () => {
      const W = canvas.width
      const H = canvas.height
      tickRef.current++
      const t = tickRef.current

      // Warm gradient background (replaces flat dark fill)
      const grad = ctx.createLinearGradient(0, 0, 0, H)
      grad.addColorStop(0, '#fff0f7')
      grad.addColorStop(1, '#ffd6ea')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, W, H)

      // Phase 0: Initial single pixel
      if (phaseRef.current === 0) {
        const alpha = Math.min(1, t / 10)
        const cx = Math.floor(W / 2 / BLOCK_SIZE)
        const cy = Math.floor(H / 2 / BLOCK_SIZE)
        drawPixelBlock(cx, cy, '#e91e8c', alpha)
        if (t >= 15) {
          phaseRef.current = 1
          spawnParticles(W / 2, H / 2)
        }
      }

      // Phase 1: Block reveal
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
        ctx.strokeStyle = 'rgba(233,30,140,0.04)'
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

        for (const [blur, alpha] of [[30, 0.2], [15, 0.45], [6, 0.75], [0, 1]] as const) {
          ctx.shadowBlur = blur
          ctx.shadowColor = '#e91e8c'
          ctx.fillStyle = `rgba(233,30,140,${alpha})`
          ctx.fillText(displayText, W / 2, H * 0.28)
        }
        ctx.shadowBlur = 0

        logoCursorTick++
        if (logoCursorTick % 30 === 0) logoBlinkOn = !logoBlinkOn
        if (logoCharsShown < LOGO_TEXT.length && logoBlinkOn) {
          const logoFontSize = Math.max(12, Math.floor(W / 22))
          const charWidth = logoFontSize * 0.6
          const textWidth = logoCharsShown * charWidth
          ctx.fillStyle = '#e91e8c'
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
          const alpha = idx === featureIdx ? 0.85 : 0.5
          ctx.fillStyle = `rgba(100,20,60,${alpha})`
          ctx.shadowColor = '#c2185b'
          ctx.shadowBlur = idx === featureIdx ? 6 : 0
          ctx.fillText(displayFeat, W / 2, H * 0.42 + idx * (featFontSize + 10))
        })
        ctx.shadowBlur = 0
      }

      // Phase 4: Pixel girl walking left→right, leaving sparkle trail
      if (phaseRef.current >= 4) {
        const girlY = Math.floor(H * 0.68) - GIRL_H

        if (phaseRef.current === 4) {
          girlX += 3
          walkTick++
          if (walkTick % 8 === 0) walkFrame = 1 - walkFrame

          // Sparkle trail dots
          if (walkTick % 3 === 0) {
            trail.push({
              x: girlX + Math.round(Math.random() * GIRL_W * 0.5),
              y: girlY + GIRL_H - Math.round(Math.random() * GIRL_H * 0.3),
              color: PIXEL_COLORS[trailColorIdx % PIXEL_COLORS.length],
              alpha: 1,
            })
            trailColorIdx++
          }

          if (girlX > W + GIRL_W) phaseRef.current = 5
        }

        // Draw trail (fade each dot out)
        for (let i = trail.length - 1; i >= 0; i--) {
          const dot = trail[i]
          dot.alpha -= 0.006
          if (dot.alpha <= 0) { trail.splice(i, 1); continue }
          ctx.globalAlpha = dot.alpha
          ctx.fillStyle = dot.color
          ctx.fillRect(dot.x, dot.y, GIRL_SPR, GIRL_SPR)
          ctx.globalAlpha = 1
        }

        // Draw girl (only while she's actively walking)
        if (phaseRef.current === 4) {
          drawGirl(girlX, girlY, walkFrame)
        }
      }

      // Phase 5: Subtitle + CTA reveal
      if (phaseRef.current >= 5) {
        const subFontSize = Math.max(5, Math.floor(W / 65))
        ctx.font = `${subFontSize}px 'Press Start 2P', monospace`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = 'rgba(100,20,60,0.5)'
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

  return (
    <div
      onClick={onEnter}
      style={{
        background: 'linear-gradient(180deg, #fff0f7 0%, #ffd6ea 100%)',
        transition: 'opacity 600ms ease-out, transform 600ms ease-out',
        opacity: dismissing ? 0 : 1,
        transform: dismissing ? 'scale(1.04)' : 'scale(1)',
        pointerEvents: dismissing ? 'none' : 'auto',
      }}
      className="fixed inset-0 z-[100] overflow-hidden cursor-pointer flex items-center justify-center"
    >
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
          style={{ border: '1px solid rgba(233,30,140,0.10)' }}
        />
      </div>

      {/* Welcome panel — bottom right */}
      {showCta && (
        <div
          className="absolute bottom-8 right-8 text-right z-10 pointer-events-none panel-slide-up max-w-xs"
          style={{
            background: 'rgba(255,240,247,0.88)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            border: '1px solid rgba(233,30,140,0.15)',
            borderRadius: '4px',
            padding: '12px 16px',
            boxShadow: '0 0 24px rgba(233,30,140,0.08)',
          }}
        >
          <h1
            className="font-pixel leading-relaxed mb-3 text-[#3d1025]"
            style={{ fontSize: 'clamp(8px, 1.2vw, 13px)' }}
          >
            Welcome to SurbhiDraw!
          </h1>
          <p
            className="font-pixel leading-relaxed mb-4 text-[#7a3550]"
            style={{ fontSize: 'clamp(5px, 0.7vw, 8px)', opacity: 0.7 }}
          >
            Draw wireframes, art prototypes, pretty much anything
            your heart desires — and let&apos;s see if we can help
            you animate it (still in progress)
          </p>
          <p
            className="font-pixel leading-relaxed mb-2 text-[#7a3550]"
            style={{ fontSize: 'clamp(4px, 0.55vw, 7px)', opacity: 0.4 }}
          >
            tip: your drawing is saved for this session,<br />but not between sessions (yet)
          </p>
          <p
            className="font-pixel leading-relaxed mb-3 text-[#7a3550]"
            style={{ fontSize: 'clamp(4px, 0.55vw, 7px)', opacity: 0.4 }}
          >
            Press ? for keyboard shortcuts
          </p>
          <p className="font-pixel text-[#e91e8c] neon-blink tracking-widest" style={{ fontSize: 'clamp(6px, 0.8vw, 9px)' }}>
            ▶ CLICK ANYWHERE TO BEGIN
          </p>
        </div>
      )}

      {/* Corner version tag */}
      <div className="absolute bottom-4 left-4 font-pixel text-[7px] text-[#c2185b]/30 z-10">
        v0.1 2026
      </div>
    </div>
  )
}
