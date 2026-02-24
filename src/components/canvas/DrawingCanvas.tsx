'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import type { DrawTool, CanvasTransform } from '@/types/drawing'
import { useDrawing } from '@/hooks/useDrawing'
import LeftToolbar from './LeftToolbar'

export default function DrawingCanvas() {
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const [activeTool, setActiveTool] = useState<DrawTool>('pencil')
  const [strokeWidth, setStrokeWidth] = useState(4)
  const [activeColor] = useState('#1a1a2e')
  const [transform, setTransform] = useState<CanvasTransform>({ scale: 1, translateX: 0, translateY: 0 })
  const [selectedStrokeId, setSelectedStrokeId] = useState<string | null>(null)

  // Eraser click-vs-drag tracking
  const eraserHasMovedRef = useRef(false)
  const eraserDownPosRef = useRef<{ x: number; y: number } | null>(null)
  const ERASER_MOVE_THRESHOLD = 5

  // Pinch state
  const pinchRef = useRef<{ dist: number } | null>(null)

  const drawing = useDrawing(drawingCanvasRef)

  // Resize canvas to match container
  useEffect(() => {
    const resize = () => {
      const wrapper = wrapperRef.current
      if (!wrapper) return
      const w = wrapper.clientWidth
      const h = wrapper.clientHeight
      if (drawingCanvasRef.current) {
        drawingCanvasRef.current.width = w
        drawingCanvasRef.current.height = h
      }
    }
    resize()
    const ro = new ResizeObserver(resize)
    if (wrapperRef.current) ro.observe(wrapperRef.current)
    return () => ro.disconnect()
  }, [])

  // Delete key handler for eraser-selected stroke
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && activeTool === 'eraser' && selectedStrokeId) {
        drawing.deleteSelectedStroke()
        setSelectedStrokeId(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [activeTool, selectedStrokeId, drawing])

  const getEventPos = useCallback(
    (e: PointerEvent | React.PointerEvent) => {
      const canvas = drawingCanvasRef.current
      if (!canvas) return { x: 0, y: 0 }
      const rect = canvas.getBoundingClientRect()
      return {
        x: (e.clientX - rect.left - transform.translateX) / transform.scale,
        y: (e.clientY - rect.top - transform.translateY) / transform.scale,
      }
    },
    [transform]
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.isPrimary === false) return
      if (activeTool === 'animate') return

      e.currentTarget.setPointerCapture(e.pointerId)

      // Clear selection on non-eraser tool use
      if (activeTool !== 'eraser') {
        setSelectedStrokeId(null)
        drawing.selectedStrokeId.current = null
      }

      if (activeTool === 'eraser') {
        const pos = getEventPos(e)
        eraserHasMovedRef.current = false
        eraserDownPosRef.current = { x: pos.x, y: pos.y }
        drawing.startStroke(e.nativeEvent, 'eraser', activeColor, strokeWidth, 1, {
          scale: transform.scale,
          tx: transform.translateX,
          ty: transform.translateY,
        })
        return
      }

      const tool = activeTool as 'pencil' | 'brush' | 'highlighter'
      drawing.startStroke(e.nativeEvent, tool, activeColor, strokeWidth, 1, {
        scale: transform.scale,
        tx: transform.translateX,
        ty: transform.translateY,
      })
    },
    [activeTool, activeColor, strokeWidth, drawing, getEventPos, transform]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.isPrimary === false) return
      if (!drawing.isDrawing.current) return

      if (activeTool === 'eraser') {
        const pos = getEventPos(e)
        const down = eraserDownPosRef.current
        if (down) {
          const dist = Math.hypot(pos.x - down.x, pos.y - down.y)
          if (dist > ERASER_MOVE_THRESHOLD) eraserHasMovedRef.current = true
        }
        if (eraserHasMovedRef.current) {
          drawing.continueStroke(e.nativeEvent, {
            scale: transform.scale,
            tx: transform.translateX,
            ty: transform.translateY,
          })
        }
        return
      }

      drawing.continueStroke(e.nativeEvent, {
        scale: transform.scale,
        tx: transform.translateX,
        ty: transform.translateY,
      })
    },
    [activeTool, drawing, getEventPos, transform]
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.isPrimary === false) return

      if (activeTool === 'eraser') {
        if (eraserHasMovedRef.current) {
          drawing.endStroke('eraser', activeColor, strokeWidth, 1)
        } else {
          drawing.cancelCurrentStroke()
          const pos = getEventPos(e)
          const hitId = drawing.selectStrokeAtPoint(pos.x, pos.y)
          setSelectedStrokeId(hitId)
        }
        eraserDownPosRef.current = null
        eraserHasMovedRef.current = false
        return
      }

      const tool = activeTool as 'pencil' | 'brush' | 'highlighter'
      drawing.endStroke(tool, activeColor, strokeWidth, 1)
    },
    [activeTool, activeColor, strokeWidth, drawing, getEventPos]
  )

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const t0 = e.touches[0]
      const t1 = e.touches[1]
      pinchRef.current = {
        dist: Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY),
      }
    }
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    if (e.touches.length === 2 && pinchRef.current) {
      const t0 = e.touches[0]
      const t1 = e.touches[1]
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY)
      const scaleDelta = dist / pinchRef.current.dist
      setTransform((prev) => ({
        ...prev,
        scale: Math.max(0.3, Math.min(5, prev.scale * scaleDelta)),
      }))
      pinchRef.current.dist = dist
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    pinchRef.current = null
  }, [])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    if (e.ctrlKey || e.metaKey) {
      const scaleDelta = e.deltaY > 0 ? 0.9 : 1.1
      setTransform((prev) => ({
        ...prev,
        scale: Math.max(0.3, Math.min(5, prev.scale * scaleDelta)),
      }))
    } else {
      setTransform((prev) => ({
        ...prev,
        translateX: prev.translateX - e.deltaX,
        translateY: prev.translateY - e.deltaY,
      }))
    }
  }, [])

  const handleClear = useCallback(() => {
    drawing.clearCanvas()
    setSelectedStrokeId(null)
  }, [drawing])

  const canvasStyle = {
    transform: `translate(${transform.translateX}px, ${transform.translateY}px) scale(${transform.scale})`,
    transformOrigin: '0 0',
  }

  const cursor = activeTool === 'eraser'
    ? (selectedStrokeId ? 'pointer' : 'cell')
    : activeTool === 'animate'
      ? 'default'
      : 'crosshair'

  return (
    <div className="fixed inset-0 bg-[#f5f5f0] overflow-hidden">
      {/* Left toolbar */}
      <LeftToolbar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        strokeWidth={strokeWidth}
        onStrokeWidthChange={setStrokeWidth}
        onUndo={drawing.undoLast}
        onClear={handleClear}
      />

      {/* Canvas area */}
      <div
        ref={wrapperRef}
        className="absolute canvas-grid-light overflow-hidden"
        style={{
          top: 0,
          left: '56px',
          right: 0,
          bottom: 0,
          touchAction: 'none',
          cursor,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
      >
        <div style={canvasStyle} className="absolute inset-0">
          <canvas
            ref={drawingCanvasRef}
            className="absolute inset-0 w-full h-full"
            style={{ touchAction: 'none' }}
          />
        </div>

        {/* Zoom indicator */}
        {transform.scale !== 1 && (
          <div className="absolute top-3 right-3 font-pixel text-[7px] text-black/30 pointer-events-none z-10">
            {Math.round(transform.scale * 100)}%
          </div>
        )}

        {/* Eraser selection hint */}
        {activeTool === 'eraser' && selectedStrokeId && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 font-pixel text-[7px] text-[#ff006e] pointer-events-none z-10 bg-white/90 px-3 py-1 border border-[#ff006e]/30 rounded">
            PRESS DELETE TO REMOVE
          </div>
        )}

        {/* Tool hint */}
        {activeTool !== 'eraser' && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 font-pixel text-[7px] text-black/20 pointer-events-none z-10">
            {activeTool.toUpperCase()}
          </div>
        )}
      </div>
    </div>
  )
}
