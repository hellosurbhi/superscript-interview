'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { CompletedStroke } from '@/types/drawing'

type AnimFn = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  frameData: { strokes: CompletedStroke[] },
  progress: number
) => void

type Phase =
  | { name: 'idle' }
  | { name: 'loading' }
  | { name: 'playing'; code: string; isPaused: boolean }
  | { name: 'error'; message: string }

interface AnimateOverlayProps {
  canvasDataUrl: string
  canvasWidth: number
  canvasHeight: number
  strokes: CompletedStroke[]
  onBack: () => void
  onShare?: (animationCode: string, animationPrompt: string) => void
  preloadedCode?: string
}

const ANIM_DURATION = 7000
const LOADER_COLORS = ['#00f5ff', '#ff006e', '#8338ec', '#06d6a0', '#ffd60a']
const BLOCK_SIZE = 10

// ── Pixel loader canvas ────────────────────────────────────────────────────

function PixelLoader() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    const cols = Math.ceil(W / BLOCK_SIZE)
    const rows = Math.ceil(H / BLOCK_SIZE)
    const total = cols * rows

    // Shuffle block order
    const order = Array.from({ length: total }, (_, i) => i)
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]]
    }

    let revealed = 0
    let colorIdx = 0

    const tick = () => {
      const batch = 3
      for (let b = 0; b < batch; b++) {
        const idx = order[revealed % total]
        const col = idx % cols
        const row = Math.floor(idx / cols)
        ctx.fillStyle = LOADER_COLORS[colorIdx % LOADER_COLORS.length]
        ctx.fillRect(col * BLOCK_SIZE, row * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE)
        colorIdx++
        revealed++
        if (revealed % total === 0) {
          // Restart — clear and re-shuffle
          ctx.clearRect(0, 0, W, H)
          for (let i = order.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [order[i], order[j]] = [order[j], order[i]]
          }
          revealed = 0
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return <canvas ref={canvasRef} width={360} height={180} className="rounded" />
}

// ── Main component ─────────────────────────────────────────────────────────

export default function AnimateOverlay({
  canvasDataUrl,
  canvasWidth,
  canvasHeight,
  strokes,
  onBack,
  onShare,
  preloadedCode,
}: AnimateOverlayProps) {
  const [phase, setPhase] = useState<Phase>(
    preloadedCode ? { name: 'playing', code: preloadedCode, isPaused: false } : { name: 'idle' }
  )
  const [promptText, setPromptText] = useState('')

  // Playing phase refs
  const animCanvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number>(0)
  const pausedAtRef = useRef<number>(0)
  const isPausedRef = useRef(false)
  const animFnRef = useRef<AnimFn | null>(null)
  const bgImageRef = useRef<HTMLImageElement | null>(null)
  const [progress, setProgress] = useState(0)

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const startLoop = useCallback(() => {
    const canvas = animCanvasRef.current
    if (!canvas || !animFnRef.current || !bgImageRef.current) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    const animFn = animFnRef.current
    const bgImage = bgImageRef.current
    const frameData = { strokes }

    const loop = (timestamp: number) => {
      if (isPausedRef.current) return
      if (startRef.current === 0) startRef.current = timestamp

      const elapsed = (timestamp - startRef.current) % ANIM_DURATION
      const p = elapsed / ANIM_DURATION

      ctx.clearRect(0, 0, w, h)
      ctx.drawImage(bgImage, 0, 0, w, h)

      try {
        animFn(ctx, w, h, frameData, p)
      } catch (e) {
        stopLoop()
        setPhase({ name: 'error', message: 'Animation crashed: ' + String(e) })
        return
      }

      setProgress(p)
      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
  }, [strokes, stopLoop])

  // When phase enters 'playing', compile function and load bg image
  useEffect(() => {
    if (phase.name !== 'playing') {
      stopLoop()
      return
    }

    // Compile animation function
    try {
      animFnRef.current = new Function(`return (${phase.code})`)() as AnimFn
    } catch (e) {
      setPhase({ name: 'error', message: 'Failed to compile animation: ' + String(e) })
      return
    }

    // Load background image
    const img = new Image()
    img.onload = () => {
      bgImageRef.current = img
      startRef.current = 0
      isPausedRef.current = false
      startLoop()
    }
    img.onerror = () => {
      setPhase({ name: 'error', message: 'Failed to load canvas snapshot' })
    }
    img.src = canvasDataUrl

    return () => stopLoop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase.name === 'playing' ? phase.code : null])

  const handleGenerate = useCallback(async (prompt: string) => {
    setPhase({ name: 'loading' })
    try {
      const res = await fetch('/api/animate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageDataUrl: canvasDataUrl,
          prompt,
          strokes,
        }),
      })
      if (!res.ok) {
        const body = await res.json() as { error: string }
        throw new Error(body.error ?? `HTTP ${res.status}`)
      }
      const { code } = await res.json() as { code: string }
      setPhase({ name: 'playing', code, isPaused: false })
    } catch (e) {
      setPhase({ name: 'error', message: String(e) })
    }
  }, [canvasDataUrl, strokes])

  const handlePauseToggle = useCallback(() => {
    if (phase.name !== 'playing') return
    const nowPaused = !isPausedRef.current
    isPausedRef.current = nowPaused

    if (!nowPaused) {
      // Resume: adjust startRef so elapsed time accounts for pause duration
      startRef.current = performance.now() - pausedAtRef.current
      startLoop()
    } else {
      pausedAtRef.current = (performance.now() - startRef.current) % ANIM_DURATION
      stopLoop()
    }

    setPhase({ ...phase, isPaused: nowPaused })
  }, [phase, startLoop, stopLoop])

  const handleRestart = useCallback(() => {
    if (phase.name !== 'playing') return
    stopLoop()
    startRef.current = 0
    isPausedRef.current = false
    setPhase({ ...phase, isPaused: false })
    // Re-trigger the playing useEffect
    requestAnimationFrame(() => startLoop())
  }, [phase, startLoop, stopLoop])

  const handleRegenerate = useCallback(() => {
    stopLoop()
    animFnRef.current = null
    bgImageRef.current = null
    setPhase({ name: 'idle' })
  }, [stopLoop])

  const handleRetry = useCallback(() => {
    setPhase({ name: 'idle' })
  }, [])

  // ── Idle phase ─────────────────────────────────────────────────────────
  if (phase.name === 'idle') {
    return (
      <div
        className="fixed bottom-0 left-0 right-0 z-[100] flex flex-col"
        style={{
          height: '260px',
          background: 'rgba(13,13,26,0.97)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(0,245,255,0.15)',
          animation: 'slideUpFade 300ms ease-out both',
        }}
      >
        {/* Close / back */}
        <button
          onClick={onBack}
          className="absolute top-3 right-4 font-pixel text-[7px] text-white/30 hover:text-white/70 transition-colors"
        >
          ✕ BACK
        </button>

        <div className="flex flex-col gap-3 px-6 pt-5 pb-4 h-full">
          <div className="font-pixel text-[9px] text-[#00f5ff] tracking-widest"
            style={{ textShadow: '0 0 8px #00f5ff88' }}>
            ⚡ ANIMATE YOUR DRAWING
          </div>

          <textarea
            autoFocus
            value={promptText}
            onChange={e => setPromptText(e.target.value)}
            placeholder="Describe the animation... (e.g. make the shapes bounce, rain drops falling, particles bursting outward)"
            rows={3}
            className="flex-1 resize-none rounded border border-white/10 bg-white/5 text-white/80 text-sm px-3 py-2 placeholder:text-white/20 focus:outline-none focus:border-[#00f5ff]/40 focus:bg-white/8 transition-colors"
            style={{ caretColor: '#00f5ff', fontFamily: 'inherit' }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey && promptText.trim()) {
                e.preventDefault()
                handleGenerate(promptText.trim())
              }
            }}
          />

          <button
            onClick={() => promptText.trim() && handleGenerate(promptText.trim())}
            disabled={!promptText.trim()}
            className="w-full h-10 rounded font-pixel text-[8px] tracking-widest transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: promptText.trim()
                ? 'linear-gradient(135deg, #00f5ff22, #8338ec22)'
                : 'transparent',
              border: promptText.trim()
                ? '1px solid #00f5ff88'
                : '1px solid rgba(255,255,255,0.1)',
              color: promptText.trim() ? '#00f5ff' : 'rgba(255,255,255,0.3)',
              boxShadow: promptText.trim() ? '0 0 12px rgba(0,245,255,0.15)' : 'none',
            }}
          >
            GENERATE ANIMATION
          </button>
        </div>
      </div>
    )
  }

  // ── Loading phase ───────────────────────────────────────────────────────
  if (phase.name === 'loading') {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-[#0d0d1a]">
        <PixelLoader />

        <div className="flex flex-col items-center gap-2">
          <div
            className="font-pixel text-[10px] text-[#00f5ff] tracking-widest"
            style={{ textShadow: '0 0 12px #00f5ff' }}
          >
            GENERATING ANIMATION...
          </div>
          <div className="font-pixel text-[6px] text-white/25 tracking-wider">
            Claude is writing your animation · 10–20 seconds
          </div>
        </div>

        {/* Fake progress pulse bar */}
        <div className="fixed bottom-0 left-0 right-0 h-0.5 overflow-hidden">
          <div
            className="h-full bg-[#00f5ff]"
            style={{ animation: 'loadingBar 2s ease-in-out infinite' }}
          />
        </div>

        <style>{`
          @keyframes loadingBar {
            0%   { width: 0%;   margin-left: 0%; }
            50%  { width: 60%;  margin-left: 20%; }
            100% { width: 0%;   margin-left: 100%; }
          }
          @keyframes slideUpFade {
            from { transform: translateY(100%); opacity: 0; }
            to   { transform: translateY(0);    opacity: 1; }
          }
        `}</style>
      </div>
    )
  }

  // ── Error phase ─────────────────────────────────────────────────────────
  if (phase.name === 'error') {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-[#0d0d1a]">
        <div className="flex flex-col items-center gap-3 max-w-sm text-center px-6">
          <div className="font-pixel text-[9px] text-[#ff006e] tracking-widest"
            style={{ textShadow: '0 0 8px #ff006e' }}>
            ✕ ANIMATION FAILED
          </div>
          <p className="text-white/40 text-xs font-mono leading-relaxed">
            {phase.message}
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleRetry}
            className="px-5 h-9 rounded border border-[#00f5ff]/40 text-[#00f5ff] font-pixel text-[7px] tracking-widest hover:bg-[#00f5ff]/10 transition-colors"
          >
            TRY AGAIN
          </button>
          <button
            onClick={onBack}
            className="px-5 h-9 rounded border border-white/10 text-white/50 font-pixel text-[7px] tracking-widest hover:bg-white/5 transition-colors"
          >
            BACK TO DRAWING
          </button>
        </div>
      </div>
    )
  }

  // ── Playing phase ───────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[100] bg-[#0d0d1a]">
      {/* Animation canvas — fills the full screen */}
      <canvas
        ref={animCanvasRef}
        width={canvasWidth}
        height={canvasHeight}
        className="absolute inset-0 w-full h-full"
        style={{ objectFit: 'contain' }}
      />

      {/* Floating controls pill */}
      <div
        className="fixed top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 px-3 py-2 rounded-full"
        style={{
          background: 'rgba(13,13,26,0.92)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(0,245,255,0.15)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
        }}
      >
        {/* Back */}
        <ControlButton onClick={onBack} label="BACK" icon="←" />

        <div className="w-px h-5 bg-white/10 mx-1" />

        {/* Restart */}
        <ControlButton onClick={handleRestart} label="RESTART" icon="↺" />

        {/* Pause / Play */}
        <ControlButton
          onClick={handlePauseToggle}
          label={phase.isPaused ? 'PLAY' : 'PAUSE'}
          icon={phase.isPaused ? '▶' : '⏸'}
          active={!phase.isPaused}
        />

        <div className="w-px h-5 bg-white/10 mx-1" />

        {/* Regenerate */}
        <ControlButton onClick={handleRegenerate} label="REDO" icon="⚡" />

        {onShare && (
          <>
            <div className="w-px h-5 bg-white/10 mx-1" />
            <ControlButton
              onClick={() => onShare(phase.code, promptText)}
              label="SHARE"
              icon="↗"
            />
          </>
        )}
      </div>

      {/* Progress bar */}
      <div className="fixed bottom-0 left-0 right-0 h-0.5 bg-white/5">
        <div
          className="h-full bg-[#00f5ff] transition-none"
          style={{
            width: `${progress * 100}%`,
            boxShadow: '0 0 4px #00f5ff',
          }}
        />
      </div>
    </div>
  )
}

// ── Control button ─────────────────────────────────────────────────────────

function ControlButton({
  onClick,
  label,
  icon,
  active,
}: {
  onClick: () => void
  label: string
  icon: string
  active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-all duration-150 hover:bg-white/8"
      style={active ? { color: '#00f5ff' } : { color: 'rgba(255,255,255,0.6)' }}
    >
      <span className="text-sm leading-none">{icon}</span>
      <span className="font-pixel text-[5px] leading-none tracking-wider">{label}</span>
    </button>
  )
}
