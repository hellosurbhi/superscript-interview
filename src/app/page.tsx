'use client'

import dynamic from 'next/dynamic'

const WelcomeCanvas = dynamic(
  () => import('@/components/welcome/WelcomeCanvas'),
  { ssr: false }
)

export default function Home() {
  return (
    <main className="w-screen h-screen overflow-hidden bg-[#0a0a0a]">
      <WelcomeCanvas />
    </main>
  )
}
