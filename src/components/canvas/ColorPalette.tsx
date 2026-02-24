'use client'

import { useEffect, useRef } from 'react'
import { PALETTE_COLORS } from '@/types/drawing'

interface ColorPaletteProps {
  activeColor: string
  onColorSelect: (color: string) => void
  onClose: () => void
}

export default function ColorPalette({ activeColor, onColorSelect, onClose }: ColorPaletteProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    // Small delay so the button click that opened this doesn't close it immediately
    const id = setTimeout(() => document.addEventListener('pointerdown', handler), 50)
    return () => {
      clearTimeout(id)
      document.removeEventListener('pointerdown', handler)
    }
  }, [onClose])

  return (
    <div
      ref={panelRef}
      className="palette-panel fixed left-0 right-0 z-50 toolbar-glass rounded-t-2xl"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom, 8px) + 72px)',
        padding: '16px',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="font-pixel text-[8px] text-[#ff006e] tracking-wider">COLOR</span>
        <button
          onClick={onClose}
          className="text-white/40 hover:text-white/80 transition-colors text-sm w-8 h-8 flex items-center justify-center"
        >
          ✕
        </button>
      </div>

      {/* Color grid */}
      <div className="grid grid-cols-10 gap-1.5 mb-3">
        {PALETTE_COLORS.map((color) => (
          <button
            key={color}
            onClick={() => { onColorSelect(color); onClose() }}
            className={`
              w-full aspect-square rounded-sm transition-all duration-100
              ${color === activeColor
                ? 'ring-2 ring-[#ff006e] ring-offset-1 ring-offset-[#1a0812] scale-110'
                : 'hover:scale-110'
              }
            `}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>

      {/* Custom color input */}
      <div className="flex items-center gap-3 pt-2 border-t border-white/10">
        <span className="font-pixel text-[7px] text-white/40">CUSTOM</span>
        <div className="relative flex-1">
          <input
            type="color"
            value={activeColor}
            onChange={(e) => onColorSelect(e.target.value)}
            className="w-full h-8 cursor-pointer rounded bg-transparent border border-white/10"
            style={{ padding: '2px' }}
          />
        </div>
        <div
          className="w-8 h-8 rounded border border-white/20"
          style={{ backgroundColor: activeColor }}
        />
        <span className="font-pixel text-[7px] text-white/40 uppercase">{activeColor}</span>
      </div>
    </div>
  )
}
