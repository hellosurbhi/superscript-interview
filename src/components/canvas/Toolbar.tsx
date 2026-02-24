'use client'

import { useRef, useCallback, useEffect } from 'react'
import type { DrawTool } from '@/types/drawing'
import { KEYBOARD_SHORTCUTS } from '@/types/drawing'

interface ToolbarProps {
  activeTool: DrawTool
  onToolChange: (tool: DrawTool) => void
  onColorClick: () => void
  onClear: () => void
  onUndo: () => void
  activeColor: string
  strokeWidth: number
  onStrokeWidthChange: (w: number) => void
}

const TOOLS: Array<{ id: DrawTool; icon: string; label: string; shortcut: string }> = [
  { id: 'pencil',      icon: '✏',  label: 'Pencil',      shortcut: 'P' },
  { id: 'brush',       icon: '🖌',  label: 'Brush',       shortcut: 'B' },
  { id: 'highlighter', icon: 'H',   label: 'Highlight',   shortcut: 'H' },
  { id: 'eraser',      icon: '◻',   label: 'Eraser',      shortcut: 'E' },
  { id: 'select',      icon: '↖',   label: 'Select',      shortcut: 'V' },
  { id: 'rect',        icon: '▬',   label: 'Rectangle',   shortcut: 'R' },
  { id: 'circle',      icon: '○',   label: 'Circle',      shortcut: 'C' },
  { id: 'ellipse',     icon: '⬭',   label: 'Ellipse',     shortcut: 'O' },
  { id: 'line',        icon: '╱',   label: 'Line',        shortcut: 'L' },
  { id: 'arrow',       icon: '→',   label: 'Arrow',       shortcut: 'A' },
  { id: 'triangle',    icon: '▲',   label: 'Triangle',    shortcut: '' },
]

export default function Toolbar({
  activeTool,
  onToolChange,
  onColorClick,
  onClear,
  onUndo,
  activeColor,
  strokeWidth,
  onStrokeWidthChange,
}: ToolbarProps) {
  const buttonRefs = useRef<Map<DrawTool, HTMLButtonElement>>(new Map())

  const triggerPulse = useCallback((tool: DrawTool) => {
    const btn = buttonRefs.current.get(tool)
    if (!btn) return
    btn.classList.remove('tool-active-pulse')
    void btn.offsetWidth // force reflow to restart animation
    btn.classList.add('tool-active-pulse')
    const cleanup = () => btn.classList.remove('tool-active-pulse')
    btn.addEventListener('animationend', cleanup, { once: true })
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't fire when typing in an input or contenteditable
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if ((e.target as HTMLElement)?.isContentEditable) return

      const tool = KEYBOARD_SHORTCUTS[e.key.toLowerCase()]
      if (tool) {
        onToolChange(tool)
        triggerPulse(tool)
        return
      }

      if (e.key === '[') onStrokeWidthChange(Math.max(1, strokeWidth - 2))
      if (e.key === ']') onStrokeWidthChange(Math.min(60, strokeWidth + 2))

      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault()
        onUndo()
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onToolChange, triggerPulse, strokeWidth, onStrokeWidthChange, onUndo])

  const isDrawTool = ['pencil', 'brush', 'highlighter', 'eraser'].includes(activeTool)

  return (
    <div className="toolbar-glass fixed bottom-0 left-0 right-0 z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 8px)' }}>

      {/* Stroke width slider — visible for freehand tools */}
      {isDrawTool && (
        <div className="flex items-center gap-3 px-4 pt-2 pb-1">
          <span className="font-pixel text-[7px] text-[#00f5ff] w-6">{strokeWidth}</span>
          <input
            type="range"
            min={1}
            max={60}
            value={strokeWidth}
            onChange={(e) => onStrokeWidthChange(Number(e.target.value))}
            className="flex-1 h-1 accent-[#00f5ff] cursor-pointer"
            style={{
              background: `linear-gradient(to right, #00f5ff ${(strokeWidth / 60) * 100}%, #333 0)`,
              WebkitAppearance: 'none',
              borderRadius: '2px',
            }}
          />
          <span className="font-pixel text-[7px] text-white/30">WIDTH</span>
        </div>
      )}

      {/* Tool buttons row */}
      <div className="flex items-center gap-1 px-3 py-2 overflow-x-auto scrollbar-none">
        {TOOLS.map(({ id, icon, label }) => {
          const isActive = activeTool === id
          return (
            <button
              key={id}
              ref={(el) => {
                if (el) buttonRefs.current.set(id, el)
              }}
              onClick={() => {
                onToolChange(id)
                triggerPulse(id)
              }}
              title={`${label} (${id.toUpperCase()[0]})`}
              className={`
                relative flex-shrink-0 flex flex-col items-center justify-center
                w-11 h-11 rounded text-lg
                transition-all duration-150
                ${isActive
                  ? 'bg-[#00f5ff]/15 border border-[#00f5ff] text-[#00f5ff] shadow-[0_0_8px_rgba(0,245,255,0.3)]'
                  : 'border border-white/10 text-white/60 hover:border-white/30 hover:text-white/90 hover:bg-white/5'
                }
              `}
            >
              <span className="text-sm leading-none select-none">{icon}</span>
              {isActive && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#00f5ff] shadow-[0_0_6px_#00f5ff]" />
              )}
            </button>
          )
        })}

        {/* Divider */}
        <div className="flex-shrink-0 w-px h-8 bg-white/10 mx-1" />

        {/* Undo */}
        <button
          onClick={onUndo}
          title="Undo (⌘Z)"
          className="flex-shrink-0 flex items-center justify-center w-11 h-11 rounded border border-white/10 text-white/60 hover:border-white/30 hover:text-white/90 hover:bg-white/5 transition-all duration-150 text-sm"
        >
          ↩
        </button>

        {/* Clear */}
        <button
          onClick={onClear}
          title="Clear canvas"
          className="flex-shrink-0 flex items-center justify-center w-11 h-11 rounded border border-white/10 text-white/60 hover:border-[#ff006e]/60 hover:text-[#ff006e] hover:bg-[#ff006e]/10 transition-all duration-150 text-sm"
        >
          ✕
        </button>

        {/* Divider */}
        <div className="flex-shrink-0 w-px h-8 bg-white/10 mx-1" />

        {/* Color swatch */}
        <button
          onClick={onColorClick}
          title="Color palette"
          className="flex-shrink-0 w-11 h-11 rounded border-2 border-white/20 hover:border-white/50 transition-all duration-150 shadow-inner"
          style={{ backgroundColor: activeColor }}
        />
      </div>
    </div>
  )
}
