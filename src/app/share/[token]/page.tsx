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
      />
    </main>
  )
}
