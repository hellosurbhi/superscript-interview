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

export default function SharedDrawPage() {
  const params = useParams()
  const id = params.id as string

  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [strokes, setStrokes] = useState<CompletedStroke[]>([])

  useEffect(() => {
    fetch(`/api/drawings/${id}`)
      .then(async (res) => {
        if (!res.ok) {
          setLoadState('expired')
          return
        }
        const data = await res.json() as { strokes: CompletedStroke[] }
        setStrokes(data.strokes ?? [])
        setLoadState('found')
      })
      .catch(() => setLoadState('expired'))
  }, [id])

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
          className="font-pixel text-[9px] text-[#00f5ff] underline underline-offset-4 hover:opacity-70 transition-opacity"
        >
          Start a new one →
        </a>
      </main>
    )
  }

  return (
    <main className="w-screen h-screen overflow-hidden bg-[#111]">
      <DrawingCanvas drawingId={id} initialStrokes={strokes} />
    </main>
  )
}
