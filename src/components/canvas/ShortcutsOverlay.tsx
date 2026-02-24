'use client'

import { useEffect, useRef } from 'react'

interface ShortcutsOverlayProps {
  onClose: () => void
}

const SHORTCUTS: Array<{ keys: string; desc: string; dim?: boolean }> = [
  { keys: 'P',           desc: 'Pencil tool' },
  { keys: 'E',           desc: 'Eraser tool' },
  { keys: '⇧ hold',     desc: 'Temporary eraser' },
  { keys: 'T',           desc: 'Text tool' },
  { keys: 'A',           desc: 'Open animate panel' },
  { keys: '[ / ]',       desc: 'Decrease / increase stroke' },
  { keys: '⌘Z',          desc: 'Undo last stroke' },
  { keys: 'Del / ⌫',    desc: 'Delete selected · or undo' },
  { keys: '?',           desc: 'Show this help', dim: true },
  { keys: 'Esc',         desc: 'Close panels · deselect', dim: true },
]

export default function ShortcutsOverlay({ onClose }: ShortcutsOverlayProps) {
  const backdropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === '?') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      ref={backdropRef}
      onClick={(e) => { if (e.target === backdropRef.current) onClose() }}
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="relative w-full max-w-xs mx-4 rounded overflow-hidden"
        style={{
          background: '#1a0812',
          border: '1px solid rgba(255,0,110,0.15)',
          boxShadow: '0 0 60px rgba(255,0,110,0.06), 0 24px 64px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
        >
          <span
            className="font-pixel text-[8px] tracking-widest"
            style={{ color: '#ff006e', textShadow: '0 0 8px #ff006e66' }}
          >
            KEYBOARD SHORTCUTS
          </span>
          <button
            onClick={onClose}
            className="text-white/25 hover:text-white/60 transition-colors text-base leading-none ml-4"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Shortcut rows */}
        <div className="px-4 py-3 flex flex-col gap-2.5">
          {SHORTCUTS.map(({ keys, desc, dim }) => (
            <div key={keys} className="flex items-center gap-3">
              <kbd
                className="font-pixel shrink-0 text-[6px] px-1.5 py-0.5 rounded leading-normal"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.14)',
                  color: dim ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.85)',
                  minWidth: '3.5rem',
                  textAlign: 'center',
                  fontStyle: 'normal',
                }}
              >
                {keys}
              </kbd>
              <span
                className="font-pixel text-[6px] leading-relaxed"
                style={{ color: dim ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.45)' }}
              >
                {desc}
              </span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          className="px-4 py-2.5 text-center"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
        >
          <span className="font-pixel text-[5px] text-white/20 tracking-wider">
            ? or ESC to close
          </span>
        </div>
      </div>
    </div>
  )
}
