'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'

const DrawingCanvas = dynamic(
  () => import('@/components/canvas/DrawingCanvas'),
  { ssr: false }
)

const WelcomeOverlay = dynamic(
  () => import('@/components/welcome/WelcomeCanvas'),
  { ssr: false }
)

export default function Home() {
  const [showWelcome, setShowWelcome] = useState(true)
  const [dismissing, setDismissing] = useState(false)

  const handleEnter = () => {
    if (dismissing) return
    setDismissing(true)
    setTimeout(() => setShowWelcome(false), 650)
  }

  return (
    <main className="w-screen h-screen overflow-hidden bg-[#111]">
      <DrawingCanvas />
      {showWelcome && (
        <WelcomeOverlay onEnter={handleEnter} dismissing={dismissing} />
      )}
    </main>
  )
}
