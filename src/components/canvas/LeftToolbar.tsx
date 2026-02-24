'use client'

import { useState, useEffect } from 'react'
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
  showTutorial: boolean
  onShowShortcuts: () => void
}

const SIDEBAR_TOOLS: Array<{
  id: DrawTool
  icon: string
  label: string
  shortcut: string
  comingSoon?: boolean
}> = [
  { id: 'pencil',  icon: '✏', label: 'Pencil',  shortcut: 'P  ·  ⌘⌥ toggle' },
  { id: 'eraser',  icon: '◻', label: 'Eraser',  shortcut: 'E  ·  ⌘⌥  ·  ⇧ hold' },
  { id: 'text',    icon: 'T',  label: 'Text',    shortcut: 'T' },
  { id: 'animate', icon: '⚡', label: 'Animate', shortcut: '' },
]

type HoverTarget = DrawTool | 'undo' | 'clear' | 'share' | 'shortcuts' | null

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
  showTutorial,
  onShowShortcuts,
}: LeftToolbarProps) {
  const [hoveredTarget, setHoveredTarget] = useState<HoverTarget>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if ((e.target as HTMLElement)?.isContentEditable) return

      // ⌘⌥ (or Ctrl+Alt) → toggle pencil ↔ eraser
      if ((e.metaKey || e.ctrlKey) && e.altKey) {
        e.preventDefault()
        onToolChange(activeTool === 'eraser' ? 'pencil' : 'eraser')
        return
      }

      if (e.key === 'p' || e.key === 'P') onToolChange('pencil')
      if (e.key === 'e' || e.key === 'E') onToolChange('eraser')
      if (e.key === 't' || e.key === 'T') onToolChange('text')
      if (e.key === 'a' || e.key === 'A') onToolChange('animate')
      if (e.key === '[') onStrokeWidthChange(Math.max(1, strokeWidth - 2))
      if (e.key === ']') onStrokeWidthChange(Math.min(60, strokeWidth + 2))
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault()
        onUndo()
      }
      if (e.key === '?') onShowShortcuts()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeTool, onToolChange, onUndo, strokeWidth, onStrokeWidthChange, onShowShortcuts])

  const showLabel = (target: HoverTarget) =>
    hoveredTarget === target || showTutorial

  return (
    <div
      className="fixed left-0 top-0 bottom-0 z-50 flex flex-col items-center gap-2 py-4 px-2 w-14"
      style={{
        background: 'rgba(26, 8, 18, 0.95)',
        borderRight: '1px solid rgba(255, 0, 110, 0.10)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        overflow: 'visible',
      }}
    >
      {/* Brand mark */}
      <div
        className="font-pixel text-[5px] text-[#ff006e]/60 mb-1 tracking-widest select-none"
        style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
      >
        SD
      </div>

      {/* Divider */}
      <div className="w-6 h-px bg-white/10" />

      {/* Tool buttons */}
      {SIDEBAR_TOOLS.map(({ id, icon, label, shortcut, comingSoon }) => {
        const isActive = activeTool === id
        return (
          <div key={id} className="relative flex flex-col items-center w-full gap-0.5">
            <button
              onClick={() => !comingSoon && onToolChange(id)}
              title={comingSoon ? `${label} — Coming Soon` : label}
              disabled={comingSoon}
              onMouseEnter={() => setHoveredTarget(id)}
              onMouseLeave={() => setHoveredTarget(null)}
              className={[
                'relative flex items-center justify-center w-10 h-10 rounded transition-all duration-150 text-base select-none',
                comingSoon
                  ? 'opacity-25 cursor-not-allowed border border-white/5 text-white/40'
                  : isActive
                    ? 'bg-[#ff006e]/15 border border-[#ff006e] text-[#ff006e] shadow-[0_0_8px_rgba(255,0,110,0.25)]'
                    : 'border border-white/10 text-white/60 hover:border-white/30 hover:text-white/90 hover:bg-white/5',
              ].join(' ')}
            >
              <span className="leading-none">{icon}</span>
              {isActive && !comingSoon && (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#ff006e] shadow-[0_0_6px_#ff006e]" />
              )}
            </button>

            {comingSoon && (
              <span className="font-pixel text-[4px] text-white/20 tracking-wider">SOON</span>
            )}

            {/* Font size indicator — shown below text tool when active */}
            {id === 'text' && isActive && (
              <div className="flex flex-col items-center mt-1 gap-1">
                <span className="font-pixel text-[5px] text-[#ff006e]">{strokeWidthToFontSize(strokeWidth)}px</span>
              </div>
            )}

            {/* Vertical thickness slider — shown below pencil when active */}
            {id === 'pencil' && isActive && (
              <div className="flex flex-col items-center mt-1 gap-1">
                <span className="font-pixel text-[5px] text-[#ff006e]">{strokeWidth}px</span>
                <div className="h-20 flex items-center justify-center overflow-hidden">
                  <input
                    type="range"
                    min={1}
                    max={60}
                    value={strokeWidth}
                    onChange={(e) => onStrokeWidthChange(Number(e.target.value))}
                    className="accent-[#ff006e] cursor-pointer"
                    style={{ transform: 'rotate(-90deg)', width: '72px' }}
                    title="Stroke thickness"
                  />
                </div>
              </div>
            )}

            {/* Tooltip — shown on hover or during tutorial */}
            {!comingSoon && showLabel(id) && (
              <div
                className="absolute left-full ml-3 top-0 z-[60] flex flex-col gap-0.5 pointer-events-none"
                style={{ animation: showTutorial ? 'none' : undefined }}
              >
                <span
                  className="font-pixel text-[7px] text-white/90 whitespace-nowrap px-2 py-1 rounded"
                  style={{
                    background: 'rgba(26,8,18,0.97)',
                    border: '1px solid rgba(255,0,110,0.2)',
                    boxShadow: '0 0 8px rgba(255,0,110,0.1)',
                  }}
                >
                  {label}
                </span>
                {shortcut && (
                  <span className="font-pixel text-[5px] text-[#ff006e]/60 whitespace-nowrap px-1">
                    {shortcut}
                  </span>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Divider */}
      <div className="w-6 h-px bg-white/10" />

      {/* Undo */}
      <div className="relative">
        <button
          onClick={onUndo}
          onMouseEnter={() => setHoveredTarget('undo')}
          onMouseLeave={() => setHoveredTarget(null)}
          title="Undo (⌘Z)"
          className="flex items-center justify-center w-10 h-10 rounded border border-white/10 text-white/60 hover:border-white/30 hover:text-white/90 hover:bg-white/5 transition-all duration-150 text-sm"
        >
          ↩
        </button>
        {showLabel('undo') && (
          <div className="absolute left-full ml-3 top-0 z-[60] flex flex-col gap-0.5 pointer-events-none">
            <span
              className="font-pixel text-[7px] text-white/90 whitespace-nowrap px-2 py-1 rounded"
              style={{
                background: 'rgba(26,8,18,0.97)',
                border: '1px solid rgba(255,0,110,0.2)',
                boxShadow: '0 0 8px rgba(255,0,110,0.1)',
              }}
            >
              Undo
            </span>
            <span className="font-pixel text-[5px] text-[#ff006e]/60 whitespace-nowrap px-1">
              ⌘Z  ·  Delete (no sel.)
            </span>
          </div>
        )}
      </div>

      {/* Clear */}
      <div className="relative">
        <button
          onClick={onClear}
          onMouseEnter={() => setHoveredTarget('clear')}
          onMouseLeave={() => setHoveredTarget(null)}
          title="Clear canvas"
          className="flex items-center justify-center w-10 h-10 rounded border border-white/10 text-white/60 hover:border-[#ff006e]/60 hover:text-[#ff006e] hover:bg-[#ff006e]/10 transition-all duration-150 text-sm"
        >
          ✕
        </button>
        {showLabel('clear') && (
          <div className="absolute left-full ml-3 top-0 z-[60] pointer-events-none">
            <span
              className="font-pixel text-[7px] text-white/90 whitespace-nowrap px-2 py-1 rounded"
              style={{
                background: 'rgba(26,8,18,0.97)',
                border: '1px solid rgba(255,0,110,0.2)',
                boxShadow: '0 0 8px rgba(255,0,110,0.1)',
              }}
            >
              Clear canvas
            </span>
          </div>
        )}
      </div>

      {/* Share — very bottom */}
      <div className="relative flex flex-col items-center gap-0.5">
        <button
          onClick={() => onShare()}
          disabled={shareState === 'saving'}
          onMouseEnter={() => setHoveredTarget('share')}
          onMouseLeave={() => setHoveredTarget(null)}
          title={
            shareState === 'error'  ? 'Error — try again' :
            'Share drawing'
          }
          className={[
            'flex items-center justify-center w-10 h-10 rounded border transition-all duration-150 text-sm',
            shareState === 'error'
              ? 'border-[#ff006e]/60 text-[#ff006e] bg-[#ff006e]/10'
              : shareState === 'saving'
                ? 'border-white/10 text-white/30 animate-pulse cursor-not-allowed'
                : 'border-white/10 text-white/60 hover:border-[#ff006e]/50 hover:text-[#ff006e] hover:bg-[#ff006e]/5',
          ].join(' ')}
        >
          {shareState === 'saving' ? '…' : shareState === 'error' ? '✕' : '↗'}
        </button>

        {expiresAt && shareState !== 'error' && (
          <span className="font-pixel text-[4px] text-[#ff006e]/40 leading-none">
            {Math.max(0, Math.ceil((expiresAt - Date.now()) / 3_600_000))}h
          </span>
        )}

        {showLabel('share') && (
          <div className="absolute left-full ml-3 top-0 z-[60] pointer-events-none">
            <span
              className="font-pixel text-[7px] text-white/90 whitespace-nowrap px-2 py-1 rounded"
              style={{
                background: 'rgba(26,8,18,0.97)',
                border: '1px solid rgba(255,0,110,0.2)',
                boxShadow: '0 0 8px rgba(255,0,110,0.1)',
              }}
            >
              Share  ·  ↗
            </span>
          </div>
        )}
      </div>

      {/* Shortcuts help */}
      <div className="relative">
        <button
          onClick={onShowShortcuts}
          onMouseEnter={() => setHoveredTarget('shortcuts')}
          onMouseLeave={() => setHoveredTarget(null)}
          title="Keyboard shortcuts (?)"
          className="flex items-center justify-center w-10 h-10 rounded border border-white/8 text-white/25 hover:border-[#ff006e]/30 hover:text-[#ff006e]/70 hover:bg-[#ff006e]/5 transition-all duration-150 font-pixel text-[9px]"
        >
          ?
        </button>
        {hoveredTarget === 'shortcuts' && (
          <div className="absolute left-full ml-3 top-0 z-[60] flex flex-col gap-0.5 pointer-events-none">
            <span
              className="font-pixel text-[7px] text-white/90 whitespace-nowrap px-2 py-1 rounded"
              style={{
                background: 'rgba(26,8,18,0.97)',
                border: '1px solid rgba(255,0,110,0.2)',
                boxShadow: '0 0 8px rgba(255,0,110,0.1)',
              }}
            >
              Shortcuts
            </span>
            <span className="font-pixel text-[5px] text-[#ff006e]/60 whitespace-nowrap px-1">
              ?
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
