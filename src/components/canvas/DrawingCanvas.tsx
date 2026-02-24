'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import type { DrawTool, DrawingShape, CanvasTransform } from '@/types/drawing'
import { FREEHAND_TOOLS, SHAPE_TOOLS } from '@/types/drawing'
import { useDrawing } from '@/hooks/useDrawing'
import { useShapes } from '@/hooks/useShapes'
import { useEaselStage } from '@/hooks/useEaselStage'
import Toolbar from './Toolbar'
import ColorPalette from './ColorPalette'

// ── Shape preview (while dragging to create) ─────────────────────────────────
function drawShapePreview(
  ctx: CanvasRenderingContext2D,
  tool: DrawTool,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  strokeWidth: number
) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = strokeWidth
  ctx.setLineDash([6, 4])
  ctx.globalAlpha = 0.8

  const absW = Math.abs(w)
  const absH = Math.abs(h)
  const ox = x + (w < 0 ? w : 0)
  const oy = y + (h < 0 ? h : 0)

  ctx.beginPath()
  switch (tool) {
    case 'rect':
      ctx.roundRect(ox, oy, absW, absH, 4)
      break
    case 'circle':
      ctx.arc(ox + absW / 2, oy + absH / 2, Math.min(absW, absH) / 2, 0, Math.PI * 2)
      break
    case 'ellipse':
      ctx.ellipse(ox + absW / 2, oy + absH / 2, absW / 2, absH / 2, 0, 0, Math.PI * 2)
      break
    case 'line':
    case 'arrow':
      ctx.moveTo(x, y); ctx.lineTo(x + w, y + h)
      break
    case 'triangle':
      ctx.moveTo(ox + absW / 2, oy)
      ctx.lineTo(ox + absW, oy + absH)
      ctx.lineTo(ox, oy + absH)
      ctx.closePath()
      break
  }
  ctx.stroke()
  ctx.restore()
}

// ── Canvas transform helpers ─────────────────────────────────────────────────
function transformPoint(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  t: CanvasTransform
): { x: number; y: number } {
  return {
    x: (clientX - rect.left - t.translateX) / t.scale,
    y: (clientY - rect.top - t.translateY) / t.scale,
  }
}

export default function DrawingCanvas() {
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null)
  const shapesCanvasRef = useRef<HTMLCanvasElement>(null)
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const [activeTool, setActiveTool] = useState<DrawTool>('pencil')
  const [activeColor, setActiveColor] = useState('#00f5ff')
  const [strokeWidth, setStrokeWidth] = useState(4)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [transform, setTransform] = useState<CanvasTransform>({ scale: 1, translateX: 0, translateY: 0 })

  // Shape dragging state
  const shapeStartRef = useRef<{ x: number; y: number } | null>(null)
  const isShapeDraggingRef = useRef(false)

  // Pinch-to-zoom state
  const pinchRef = useRef<{ dist: number; cx: number; cy: number } | null>(null)
  const panRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null)

  const drawing = useDrawing(drawingCanvasRef)
  const shapes = useShapes()

  const onEaselReady = useCallback(
    (stage: createjs.Stage) => {
      shapes.setStage(stage)
    },
    [shapes]
  )

  useEaselStage(shapesCanvasRef, onEaselReady, 60)

  // Resize canvases to match container
  useEffect(() => {
    const resize = () => {
      const wrapper = wrapperRef.current
      if (!wrapper) return
      const w = wrapper.clientWidth
      const h = wrapper.clientHeight
      for (const ref of [drawingCanvasRef, shapesCanvasRef, previewCanvasRef]) {
        if (ref.current) {
          ref.current.width = w
          ref.current.height = h
        }
      }
    }
    resize()
    const ro = new ResizeObserver(resize)
    if (wrapperRef.current) ro.observe(wrapperRef.current)
    return () => ro.disconnect()
  }, [])

  // ── Pointer event handlers ────────────────────────────────────────────────
  const getEventPos = useCallback(
    (e: PointerEvent | React.PointerEvent) => {
      const canvas = drawingCanvasRef.current
      if (!canvas) return { x: 0, y: 0 }
      const rect = canvas.getBoundingClientRect()
      return transformPoint(e.clientX, e.clientY, rect, transform)
    },
    [transform]
  )

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.isPrimary === false) return // ignore non-primary touches (let pinch handler deal)
      e.currentTarget.setPointerCapture(e.pointerId)

      const pos = getEventPos(e)

      if (FREEHAND_TOOLS.includes(activeTool)) {
        const tool = activeTool as 'pencil' | 'brush' | 'highlighter' | 'eraser'
        drawing.startStroke(e.nativeEvent, tool, activeColor, strokeWidth, 1, {
          scale: transform.scale,
          tx: transform.translateX,
          ty: transform.translateY,
        })
      } else if (SHAPE_TOOLS.includes(activeTool)) {
        shapeStartRef.current = pos
        isShapeDraggingRef.current = true
      }
    },
    [activeTool, activeColor, strokeWidth, drawing, getEventPos, transform]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.isPrimary === false) return

      if (FREEHAND_TOOLS.includes(activeTool) && drawing.isDrawing.current) {
        drawing.continueStroke(e.nativeEvent, {
          scale: transform.scale,
          tx: transform.translateX,
          ty: transform.translateY,
        })
      } else if (SHAPE_TOOLS.includes(activeTool) && isShapeDraggingRef.current && shapeStartRef.current) {
        const pos = getEventPos(e)
        const previewCtx = previewCanvasRef.current?.getContext('2d')
        if (previewCtx && previewCanvasRef.current) {
          previewCtx.clearRect(0, 0, previewCanvasRef.current.width, previewCanvasRef.current.height)
          drawShapePreview(
            previewCtx,
            activeTool,
            shapeStartRef.current.x,
            shapeStartRef.current.y,
            pos.x - shapeStartRef.current.x,
            pos.y - shapeStartRef.current.y,
            activeColor,
            strokeWidth
          )
        }
      }
    },
    [activeTool, drawing, getEventPos, activeColor, strokeWidth, transform]
  )

  const handlePointerUp = useCallback(
    async (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.isPrimary === false) return

      if (FREEHAND_TOOLS.includes(activeTool)) {
        const tool = activeTool as 'pencil' | 'brush' | 'highlighter' | 'eraser'
        drawing.endStroke(tool, activeColor, strokeWidth, 1)
      } else if (SHAPE_TOOLS.includes(activeTool) && isShapeDraggingRef.current && shapeStartRef.current) {
        const pos = getEventPos(e)
        const w = pos.x - shapeStartRef.current.x
        const h = pos.y - shapeStartRef.current.y

        // Only create shape if it has some size
        if (Math.abs(w) > 4 || Math.abs(h) > 4) {
          // Need createjs — dynamically import just to get the constructor reference
          const cjsMod = await import('@createjs/easeljs')
          const cjs = (cjsMod as unknown as { default: typeof createjs }).default ?? (cjsMod as unknown as typeof createjs)

          shapes.addShape(
            activeTool as Parameters<typeof shapes.addShape>[0],
            shapeStartRef.current.x,
            shapeStartRef.current.y,
            w,
            h,
            'transparent',
            activeColor,
            strokeWidth,
            1,
            cjs
          )
        }

        // Clear preview
        const previewCtx = previewCanvasRef.current?.getContext('2d')
        if (previewCtx && previewCanvasRef.current) {
          previewCtx.clearRect(0, 0, previewCanvasRef.current.width, previewCanvasRef.current.height)
        }
        isShapeDraggingRef.current = false
        shapeStartRef.current = null
      }
    },
    [activeTool, activeColor, strokeWidth, drawing, getEventPos, shapes]
  )

  // ── Two-finger pinch/pan ─────────────────────────────────────────────────
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const t0 = e.touches[0]
      const t1 = e.touches[1]
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY)
      pinchRef.current = {
        dist,
        cx: (t0.clientX + t1.clientX) / 2,
        cy: (t0.clientY + t1.clientY) / 2,
      }
    } else if (e.touches.length === 1) {
      panRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        tx: transform.translateX,
        ty: transform.translateY,
      }
    }
  }, [transform])

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
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
    },
    []
  )

  const handleTouchEnd = useCallback(() => {
    pinchRef.current = null
    panRef.current = null
  }, [])

  // Scroll-to-pan on desktop
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
    shapes.clearShapes()
  }, [drawing, shapes])

  const canvasStyle = {
    transform: `translate(${transform.translateX}px, ${transform.translateY}px) scale(${transform.scale})`,
    transformOrigin: '0 0',
  }

  return (
    <div className="fixed inset-0 bg-[#111] flex flex-col overflow-hidden">
      {/* CRT overlay */}
      <div className="crt-overlay" />

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/8 bg-[#0d0d1a] z-40">
        <span className="font-pixel text-[9px] text-[#00f5ff]">SUPRSCRIPT</span>
        <div className="flex items-center gap-2">
          <span className="font-pixel text-[7px] text-white/30 hidden sm:block">
            {Math.round(transform.scale * 100)}%
          </span>
          <button
            onClick={() => setTransform({ scale: 1, translateX: 0, translateY: 0 })}
            className="font-pixel text-[7px] text-white/40 hover:text-white/70 border border-white/10 hover:border-white/30 px-2 py-1 transition-all"
          >
            RESET
          </button>
        </div>
      </div>

      {/* Canvas area */}
      <div
        ref={wrapperRef}
        className="relative flex-1 canvas-grid-bg overflow-hidden"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
        style={{ touchAction: 'none', cursor: activeTool === 'eraser' ? 'cell' : activeTool === 'select' ? 'default' : 'crosshair' }}
      >
        <div style={canvasStyle} className="absolute inset-0">
          {/* Layer 1: Freehand drawing */}
          <canvas
            ref={drawingCanvasRef}
            className="absolute inset-0 w-full h-full"
            style={{ touchAction: 'none' }}
          />

          {/* Layer 2: EaselJS shapes */}
          <canvas
            ref={shapesCanvasRef}
            className="absolute inset-0 w-full h-full"
            style={{ touchAction: 'none', pointerEvents: activeTool === 'select' ? 'auto' : 'none' }}
          />

          {/* Layer 3: Shape preview (while dragging) */}
          <canvas
            ref={previewCanvasRef}
            className="absolute inset-0 w-full h-full"
            style={{ touchAction: 'none', pointerEvents: 'none' }}
          />
        </div>

        {/* Tool hint overlay */}
        {activeTool !== 'select' && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 font-pixel text-[7px] text-white/20 pointer-events-none z-10">
            {activeTool.toUpperCase()}
          </div>
        )}
      </div>

      {/* Color palette panel */}
      {paletteOpen && (
        <ColorPalette
          activeColor={activeColor}
          onColorSelect={setActiveColor}
          onClose={() => setPaletteOpen(false)}
        />
      )}

      {/* Toolbar */}
      <Toolbar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        onColorClick={() => setPaletteOpen((o) => !o)}
        onClear={handleClear}
        onUndo={drawing.undoLast}
        activeColor={activeColor}
        strokeWidth={strokeWidth}
        onStrokeWidthChange={setStrokeWidth}
      />
    </div>
  )
}
