'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import type { CompletedStroke } from '@/types/drawing'

const DrawingCanvas = dynamic(
  () => import('@/components/canvas/DrawingCanvas'),
  { ssr: false }
)

type LoadState = 'loading' | 'found' | 'expired'

interface SharedData {
  id: string
  strokes: CompletedStroke[]
  animation_code: string | null
  animation_prompt: string | null
  animations: Array<{ share_token: string; animation_prompt: string; created_at: string }>
}

export default function SharedDrawPage() {
  const params = useParams()
  const token = params.token as string

  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [shared, setShared] = useState<SharedData | null>(null)

  useEffect(() => {
    fetch(`/api/drawings/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          setLoadState('expired')
          return
        }
        const data = await res.json() as SharedData
        setShared(data)
        setLoadState('found')
      })
      .catch(() => setLoadState('expired'))
  }, [token])

  if (loadState === 'loading') {
    return (
      <main className="w-screen h-screen flex items-center justify-center bg-[#f5f5f0]">
        <span className="font-pixel text-[9px] text-black/30 animate-pulse">LOADING…</span>
      </main>
    )
  }

  if (loadState === 'expired') {
    return (
      <main className="w-screen h-screen flex flex-col items-center justify-center bg-[#f5f5f0] gap-6">
        <p className="font-pixel text-xs text-black/40 text-center leading-relaxed">
          This drawing has expired<br />or doesn&apos;t exist.
        </p>
        <a
          href="/draw"
          className="font-pixel text-[9px] text-[#ff006e] underline underline-offset-4 hover:opacity-70 transition-opacity"
        >
          Start a new one →
        </a>
      </main>
    )
  }

  return (
    <main className="w-screen h-screen overflow-hidden bg-[#111]">
      <DrawingCanvas
        drawingId={shared!.id}
        initialStrokes={shared!.strokes}
        initialAnimationCode={shared!.animation_code ?? undefined}
        initialAnimationPrompt={shared!.animation_prompt ?? undefined}
        shareToken={token}
      />

      {/* Animations list — top-right corner */}
      {shared!.animations.length > 0 && (
        <div className="fixed top-4 right-4 z-50 flex flex-col gap-1 items-end pointer-events-auto">
          <span className="font-pixel text-[6px] text-white/25 tracking-widest">ANIMATIONS</span>
          {shared!.animations.map((a) => (
            <a
              key={a.share_token}
              href={`/share/animation/${a.share_token}`}
              className="font-pixel text-[7px] text-[#ff006e]/60 hover:text-[#ff006e] tracking-wider transition-colors"
            >
              ▶ {a.animation_prompt.length > 28
                ? a.animation_prompt.slice(0, 28) + '…'
                : a.animation_prompt}
            </a>
          ))}
        </div>
      )}
    </main>
  )
}
