'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import type { CompletedStroke } from '@/types/drawing'

const AnimateOverlay = dynamic(
  () => import('@/components/canvas/AnimateOverlay'),
  { ssr: false }
)

type LoadState = 'loading' | 'found' | 'expired'

interface AnimationData {
  animation_code: string
  animation_prompt: string
  preview_image: string | null
  canvas_width: number | null
  canvas_height: number | null
  drawing: { share_token: string; strokes: CompletedStroke[] } | null
}

export default function AnimationSharePage() {
  const params = useParams()
  const token = params.token as string

  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [data, setData] = useState<AnimationData | null>(null)

  useEffect(() => {
    fetch(`/api/animations/${token}`)
      .then(async (res) => {
        if (!res.ok) { setLoadState('expired'); return }
        const json = await res.json() as AnimationData
        setData(json)
        setLoadState('found')
      })
      .catch(() => setLoadState('expired'))
  }, [token])

  if (loadState === 'loading') {
    return (
      <main className="w-screen h-screen flex items-center justify-center bg-[#1a0812]">
        <span className="font-pixel text-[9px] text-white/20 animate-pulse tracking-widest">LOADING…</span>
      </main>
    )
  }

  if (loadState === 'expired') {
    return (
      <main className="w-screen h-screen flex flex-col items-center justify-center bg-[#1a0812] gap-6">
        <p className="font-pixel text-[9px] text-white/30 text-center leading-relaxed tracking-wider">
          This animation has expired<br />or doesn&apos;t exist.
        </p>
        <a
          href="/draw"
          className="font-pixel text-[8px] text-[#ff006e]/60 hover:text-[#ff006e] transition-colors tracking-widest"
        >
          Start drawing →
        </a>
      </main>
    )
  }

  const handleBack = () => {
    if (data?.drawing?.share_token) {
      window.location.href = `/share/${data.drawing.share_token}`
    } else {
      window.location.href = '/'
    }
  }

  return (
    <main className="w-screen h-screen overflow-hidden bg-[#1a0812]">
      <AnimateOverlay
        canvasDataUrl={data!.preview_image ?? ''}
        canvasWidth={data!.canvas_width ?? 800}
        canvasHeight={data!.canvas_height ?? 600}
        strokes={(data!.drawing?.strokes ?? []) as CompletedStroke[]}
        onBack={handleBack}
        preloadedCode={data!.animation_code}
        viewerMode={true}
      />
    </main>
  )
}
