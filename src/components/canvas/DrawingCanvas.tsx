'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import type { DrawTool, CanvasTransform, CompletedStroke } from '@/types/drawing'
import { useDrawing } from '@/hooks/useDrawing'
import LeftToolbar from './LeftToolbar'

const TAP_MOVE_THRESHOLD = 5
const TAP_TIME_MS = 200

interface DrawingCanvasProps {
  drawingId?: string
  initialStrokes?: CompletedStroke[]
}

export default function DrawingCanvas({ drawingId, initialStrokes }: DrawingCanvasProps = {}) {
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null)
  const haloCanvasRef = useRef<HTMLCanvasElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const [activeTool, setActiveTool] = useState<DrawTool>('pencil')
  const [strokeWidth, setStrokeWidth] = useState(4)
  const [activeColor] = useState('#1a1a2e')
  const [transform, setTransform] = useState<CanvasTransform>({ scale: 1, translateX: 0, translateY: 0 })
  const [selectedStrokeId, setSelectedStrokeId] = useState<string | null>(null)
  const [shiftHeld, setShiftHeld] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  // Share / save state
  const drawingIdRef = useRef<string | null>(drawingId ?? null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [shareState, setShareState] = useState<'idle' | 'saving' | 'copied' | 'error'>('idle')
  const [expiresAt, setExpiresAt] = useState<number | null>(null)

  // Interaction tracking refs
  const hasMovedRef = useRef(false)
  const downPosRef = useRef<{ x: number; y: number } | null>(null)
  const downTimeRef = useRef<number>(0)
  const isDraggingRef = useRef(false)
  const dragLastPosRef = useRef<{ x: number; y: number } | null>(null)

  // Pinch state
  const pinchRef = useRef<{ dist: number } | null>(null)

  const drawing = useDrawing(drawingCanvasRef, initialStrokes)

  // Resize both canvases; repaint initial strokes after first resize
  useEffect(() => {
    let painted = false
    const resize = () => {
      const wrapper = wrapperRef.current
      if (!wrapper) return
      const w = wrapper.clientWidth
      const h = wrapper.clientHeight
      if (drawingCanvasRef.current) {
        drawingCanvasRef.current.width = w
        drawingCanvasRef.current.height = h
      }
      if (haloCanvasRef.current) {
        haloCanvasRef.current.width = w
        haloCanvasRef.current.height = h
      }
      if (!painted && initialStrokes?.length) {
        painted = true
        drawing.redrawFromHistory()
      }
    }
    resize()
    const ro = new ResizeObserver(resize)
    if (wrapperRef.current) ro.observe(wrapperRef.current)
    return () => ro.disconnect()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Redraw halo whenever selection changes
  useEffect(() => {
    const haloCanvas = haloCanvasRef.current
    if (!haloCanvas) return
    const haloCtx = haloCanvas.getContext('2d')
    if (!haloCtx) return
    drawing.drawSelectionHalo(haloCtx, haloCanvas.width, haloCanvas.height)
  }, [selectedStrokeId, drawing])

  // Delete key — works in any tool mode
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedStrokeId) {
        drawing.deleteSelectedStroke()
        setSelectedStrokeId(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedStrokeId, drawing])

  // Shift key tracking for temporary eraser mode
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShiftHeld(true)
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShiftHeld(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

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

  const scheduleSave = useCallback(() => {
    if (!drawingIdRef.current) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      try {
        await fetch(`/api/drawings/${drawingIdRef.current}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ strokes: drawing.getStrokes() }),
        })
      } catch {
        // silent — auto-save failure is non-critical
      }
    }, 1500)
  }, [drawing])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.isPrimary === false) return
      if (activeTool === 'animate') return

      e.currentTarget.setPointerCapture(e.pointerId)

      const pos = getEventPos(e)
      downPosRef.current = pos
      downTimeRef.current = Date.now()
      hasMovedRef.current = false
      isDraggingRef.current = false

      const transformArgs = { scale: transform.scale, tx: transform.translateX, ty: transform.translateY }

      // Shift or explicit eraser → start erase stroke immediately
      if (e.shiftKey || activeTool === 'eraser') {
        drawing.startStroke(e.nativeEvent, 'eraser', activeColor, strokeWidth, 1, transformArgs)
        return
      }

      // If something is selected and we're clicking ON it → begin drag
      if (selectedStrokeId && drawing.isPointOnStroke(pos.x, pos.y, selectedStrokeId)) {
        isDraggingRef.current = true
        setIsDragging(true)
        dragLastPosRef.current = pos
        return
      }

      // Otherwise: start draw stroke (may be cancelled on tap)
      setSelectedStrokeId(null)
      drawing.selectedStrokeId.current = null
      drawing.startStroke(
        e.nativeEvent,
        activeTool as 'pencil' | 'brush' | 'highlighter',
        activeColor,
        strokeWidth,
        1,
        transformArgs
      )
    },
    [activeTool, activeColor, strokeWidth, drawing, getEventPos, transform, selectedStrokeId]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.isPrimary === false) return

      const pos = getEventPos(e)

      // Track movement for tap detection
      if (downPosRef.current && !hasMovedRef.current) {
        const dist = Math.hypot(pos.x - downPosRef.current.x, pos.y - downPosRef.current.y)
        if (dist > TAP_MOVE_THRESHOLD) hasMovedRef.current = true
      }

      // Drag: move selected stroke
      if (isDraggingRef.current && selectedStrokeId && dragLastPosRef.current) {
        const dx = pos.x - dragLastPosRef.current.x
        const dy = pos.y - dragLastPosRef.current.y
        drawing.moveStroke(selectedStrokeId, dx, dy)
        // Redraw halo at new position
        const haloCanvas = haloCanvasRef.current
        if (haloCanvas) {
          const haloCtx = haloCanvas.getContext('2d')
          if (haloCtx) drawing.drawSelectionHalo(haloCtx, haloCanvas.width, haloCanvas.height)
        }
        dragLastPosRef.current = pos
        return
      }

      if (!drawing.isDrawing.current) return

      const transformArgs = { scale: transform.scale, tx: transform.translateX, ty: transform.translateY }

      // Eraser stroke (shift or explicit eraser)
      if ((e.shiftKey || activeTool === 'eraser') && drawing.isDrawing.current) {
        drawing.continueStroke(e.nativeEvent, transformArgs)
        return
      }

      drawing.continueStroke(e.nativeEvent, transformArgs)
    },
    [activeTool, drawing, getEventPos, transform, selectedStrokeId]
  )

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.isPrimary === false) return

      const pos = getEventPos(e)
      const elapsed = Date.now() - downTimeRef.current

      // End drag
      if (isDraggingRef.current) {
        isDraggingRef.current = false
        setIsDragging(false)
        dragLastPosRef.current = null
        scheduleSave()
        return
      }

      // Eraser (shift or explicit)
      if (e.shiftKey || activeTool === 'eraser') {
        if (hasMovedRef.current) {
          drawing.endStroke('eraser', activeColor, strokeWidth, 1)
          scheduleSave()
        } else {
          drawing.cancelCurrentStroke()
        }
        return
      }

      // Tap detection: select or deselect
      const isTap = !hasMovedRef.current && elapsed < TAP_TIME_MS
      if (isTap) {
        drawing.cancelCurrentStroke()
        const hitId = drawing.selectStrokeAtPoint(pos.x, pos.y)
        setSelectedStrokeId(hitId)
        return
      }

      // Regular draw stroke
      drawing.endStroke(activeTool as 'pencil' | 'brush' | 'highlighter', activeColor, strokeWidth, 1)
      setSelectedStrokeId(null)
      drawing.selectedStrokeId.current = null
      scheduleSave()
    },
    [activeTool, activeColor, strokeWidth, drawing, getEventPos, scheduleSave]
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

  const handleShare = useCallback(async () => {
    if (shareState === 'saving') return
    setShareState('saving')
    try {
      if (!drawingIdRef.current) {
        const res = await fetch('/api/drawings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ strokes: drawing.getStrokes() }),
        })
        if (!res.ok) throw new Error('create_failed')
        const { id, expiresAt: exp } = await res.json() as { id: string; expiresAt: string }
        drawingIdRef.current = id
        setExpiresAt(new Date(exp).getTime())
        window.history.replaceState(null, '', `/draw/${id}`)
      }
      await navigator.clipboard.writeText(window.location.href)
      setShareState('copied')
      setTimeout(() => setShareState('idle'), 2000)
    } catch {
      setShareState('error')
      setTimeout(() => setShareState('idle'), 2000)
    }
  }, [drawing, shareState])

  const canvasStyle = {
    transform: `translate(${transform.translateX}px, ${transform.translateY}px) scale(${transform.scale})`,
    transformOrigin: '0 0',
  }

  const cursor = isDragging
    ? 'grabbing'
    : selectedStrokeId
      ? 'grab'
      : (shiftHeld || activeTool === 'eraser')
        ? 'cell'
        : activeTool === 'animate'
          ? 'default'
          : 'crosshair'

  return (
    <div className="fixed inset-0 bg-[#f5f5f0] overflow-hidden">
      {/* Left toolbar */}
      <LeftToolbar
        activeTool={shiftHeld ? 'eraser' : activeTool}
        onToolChange={setActiveTool}
        strokeWidth={strokeWidth}
        onStrokeWidthChange={setStrokeWidth}
        onUndo={drawing.undoLast}
        onClear={handleClear}
        onShare={handleShare}
        shareState={shareState}
        expiresAt={expiresAt}
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
          {/* Layer 1: freehand drawing */}
          <canvas
            ref={drawingCanvasRef}
            className="absolute inset-0 w-full h-full"
            style={{ touchAction: 'none' }}
          />
          {/* Layer 2: selection halo — transparent overlay, never receives pointer events */}
          <canvas
            ref={haloCanvasRef}
            className="absolute inset-0 w-full h-full"
            style={{ touchAction: 'none', pointerEvents: 'none' }}
          />
        </div>

        {/* Zoom indicator */}
        {transform.scale !== 1 && (
          <div className="absolute top-3 right-3 font-pixel text-[7px] text-black/30 pointer-events-none z-10">
            {Math.round(transform.scale * 100)}%
          </div>
        )}

        {/* Selection hint — shown whenever a stroke is selected */}
        {selectedStrokeId && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 font-pixel text-[7px] text-[#ff006e] pointer-events-none z-10 bg-white/90 px-3 py-1 border border-[#ff006e]/30 rounded">
            DRAG TO MOVE · DELETE TO REMOVE
          </div>
        )}

        {/* Tool hint — shown when nothing is selected */}
        {!selectedStrokeId && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 font-pixel text-[7px] text-black/20 pointer-events-none z-10">
            {shiftHeld ? 'ERASER' : activeTool.toUpperCase()}
          </div>
        )}
      </div>
    </div>
  )
}
