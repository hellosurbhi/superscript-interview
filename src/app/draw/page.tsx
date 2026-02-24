'use client'

import dynamic from 'next/dynamic'

const DrawingCanvas = dynamic(
  () => import('@/components/canvas/DrawingCanvas'),
  { ssr: false }
)

export default function DrawPage() {
  return (
    <main className="w-screen h-screen overflow-hidden bg-[#111]">
      <DrawingCanvas />
    </main>
  )
}
