'use client'

import { useEffect } from 'react'
import type { DrawTool } from '@/types/drawing'
import { strokeWidthToFontSize } from '@/types/drawing'

interface LeftToolbarProps {
  activeTool: DrawTool
  onToolChange: (tool: DrawTool) => void
  strokeWidth: number
  onStrokeWidthChange: (w: number) => void
  onUndo: () => void
  onClear: () => void
  onShare: () => void
  shareState: 'idle' | 'saving' | 'copied' | 'error'
  expiresAt: number | null
}

const SIDEBAR_TOOLS: Array<{
  id: DrawTool
  icon: string
  label: string
  comingSoon?: boolean
}> = [
  { id: 'pencil', icon: '✏', label: 'Pencil' },
  { id: 'eraser', icon: '◻', label: 'Eraser' },
  { id: 'text', icon: 'T', label: 'Text (T)' },
  { id: 'animate', icon: '⚡', label: 'Animate' },
]

export default function LeftToolbar({
  activeTool,
  onToolChange,
  strokeWidth,
  onStrokeWidthChange,
  onUndo,
  onClear,
  onShare,
  shareState,
  expiresAt,
}: LeftToolbarProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if ((e.target as HTMLElement)?.isContentEditable) return
      if (e.key === 'p' || e.key === 'P') onToolChange('pencil')
      if (e.key === 'e' || e.key === 'E') onToolChange('eraser')
      if (e.key === 't' || e.key === 'T') onToolChange('text')
      if (e.key === '[') onStrokeWidthChange(Math.max(1, strokeWidth - 2))
      if (e.key === ']') onStrokeWidthChange(Math.min(60, strokeWidth + 2))
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault()
        onUndo()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onToolChange, onUndo, strokeWidth, onStrokeWidthChange])

  return (
    <div
      className="fixed left-0 top-0 bottom-0 z-50 flex flex-col items-center gap-2 py-4 px-2 w-14"
      style={{
        background: 'rgba(13, 13, 26, 0.95)',
        borderRight: '1px solid rgba(0, 245, 255, 0.10)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      {/* Brand mark */}
      <div
        className="font-pixel text-[5px] text-[#00f5ff]/60 mb-1 tracking-widest select-none"
        style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
      >
        SD
      </div>

      {/* Divider */}
      <div className="w-6 h-px bg-white/10" />

      {/* Tool buttons */}
      {SIDEBAR_TOOLS.map(({ id, icon, label, comingSoon }) => {
        const isActive = activeTool === id
        return (
          <div key={id} className="flex flex-col items-center w-full gap-0.5">
            <button
              onClick={() => !comingSoon && onToolChange(id)}
              title={comingSoon ? `${label} — Coming Soon` : label}
              disabled={comingSoon}
              className={[
                'relative flex items-center justify-center w-10 h-10 rounded transition-all duration-150 text-base select-none',
                comingSoon
                  ? 'opacity-25 cursor-not-allowed border border-white/5 text-white/40'
                  : isActive
                    ? 'bg-[#00f5ff]/15 border border-[#00f5ff] text-[#00f5ff] shadow-[0_0_8px_rgba(0,245,255,0.25)]'
                    : 'border border-white/10 text-white/60 hover:border-white/30 hover:text-white/90 hover:bg-white/5',
              ].join(' ')}
            >
              <span className="leading-none">{icon}</span>
              {isActive && !comingSoon && (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#00f5ff] shadow-[0_0_6px_#00f5ff]" />
              )}
            </button>

            {comingSoon && (
              <span className="font-pixel text-[4px] text-white/20 tracking-wider">SOON</span>
            )}

            {/* Font size indicator — shown below text tool when active */}
            {id === 'text' && isActive && (
              <div className="flex flex-col items-center mt-1 gap-1">
                <span className="font-pixel text-[5px] text-[#00f5ff]">{strokeWidthToFontSize(strokeWidth)}px</span>
              </div>
            )}

            {/* Vertical thickness slider — shown below pencil when active */}
            {id === 'pencil' && isActive && (
              <div className="flex flex-col items-center mt-1 gap-1">
                <span className="font-pixel text-[5px] text-[#00f5ff]">{strokeWidth}px</span>
                <div className="h-20 flex items-center justify-center overflow-hidden">
                  <input
                    type="range"
                    min={1}
                    max={60}
                    value={strokeWidth}
                    onChange={(e) => onStrokeWidthChange(Number(e.target.value))}
                    className="accent-[#00f5ff] cursor-pointer"
                    style={{
                      transform: 'rotate(-90deg)',
                      width: '72px',
                    }}
                    title="Stroke thickness"
                  />
                </div>
              </div>
            )}
          </div>
        )
      })}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Divider */}
      <div className="w-6 h-px bg-white/10" />

      {/* Share */}
      <div className="flex flex-col items-center gap-0.5">
        <button
          onClick={onShare}
          disabled={shareState === 'saving'}
          title={
            shareState === 'copied' ? 'Link copied!' :
            shareState === 'error'  ? 'Error — try again' :
            'Share drawing'
          }
          className={[
            'flex items-center justify-center w-10 h-10 rounded border transition-all duration-150 text-sm',
            shareState === 'copied'
              ? 'border-[#06d6a0]/60 text-[#06d6a0] bg-[#06d6a0]/10'
              : shareState === 'error'
                ? 'border-[#ff006e]/60 text-[#ff006e] bg-[#ff006e]/10'
                : shareState === 'saving'
                  ? 'border-white/10 text-white/30 animate-pulse cursor-not-allowed'
                  : 'border-white/10 text-white/60 hover:border-[#00f5ff]/50 hover:text-[#00f5ff] hover:bg-[#00f5ff]/5',
          ].join(' ')}
        >
          {shareState === 'saving' ? '…' : shareState === 'copied' ? '✓' : shareState === 'error' ? '✕' : '↗'}
        </button>

        {expiresAt && shareState !== 'error' && (
          <span className="font-pixel text-[4px] text-[#00f5ff]/40 leading-none">
            {Math.max(0, Math.ceil((expiresAt - Date.now()) / 3_600_000))}h
          </span>
        )}
      </div>

      {/* Undo */}
      <button
        onClick={onUndo}
        title="Undo (⌘Z)"
        className="flex items-center justify-center w-10 h-10 rounded border border-white/10 text-white/60 hover:border-white/30 hover:text-white/90 hover:bg-white/5 transition-all duration-150 text-sm"
      >
        ↩
      </button>

      {/* Clear */}
      <button
        onClick={onClear}
        title="Clear canvas"
        className="flex items-center justify-center w-10 h-10 rounded border border-white/10 text-white/60 hover:border-[#ff006e]/60 hover:text-[#ff006e] hover:bg-[#ff006e]/10 transition-all duration-150 text-sm"
      >
        ✕
      </button>
    </div>
  )
}
