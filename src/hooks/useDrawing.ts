'use client'

import { useRef, useCallback } from 'react'
import { getStroke } from 'perfect-freehand'
import type { DrawTool, StrokePoint, CompletedStroke } from '@/types/drawing'
import { TOOL_OPTIONS } from '@/types/drawing'

function getSvgPathFromStroke(stroke: number[][]): string {
  if (!stroke.length) return ''
  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length]
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2)
      return acc
    },
    ['M', ...stroke[0], 'Q']
  )
  d.push('Z')
  return d.join(' ')
}

function drawStrokeToCtx(
  ctx: CanvasRenderingContext2D,
  points: StrokePoint[],
  tool: Extract<DrawTool, 'pencil' | 'brush' | 'highlighter' | 'eraser'>,
  color: string,
  size: number,
  opacity: number
) {
  if (points.length < 2) return

  const opts = {
    ...TOOL_OPTIONS[tool],
    size: size,
    simulatePressure: true,
  }
  const outlinePoints = getStroke(
    points.map((p) => [p.x, p.y, p.pressure]),
    opts
  )
  const pathData = getSvgPathFromStroke(outlinePoints)
  const path = new Path2D(pathData)

  ctx.save()

  if (tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out'
    ctx.fillStyle = 'rgba(0,0,0,1)'
    ctx.globalAlpha = 1
  } else if (tool === 'highlighter') {
    ctx.globalCompositeOperation = 'multiply'
    ctx.fillStyle = color
    ctx.globalAlpha = 0.35
  } else {
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = color
    ctx.globalAlpha = opacity
  }

  ctx.fill(path)
  ctx.restore()
}

export function useDrawing(
  canvasRef: React.RefObject<HTMLCanvasElement | null>
) {
  const isDrawingRef = useRef(false)
  const currentPointsRef = useRef<StrokePoint[]>([])
  const completedStrokesRef = useRef<CompletedStroke[]>([])
  const animFrameRef = useRef<number | null>(null)

  const redrawAll = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      strokes: CompletedStroke[],
      livePoints?: StrokePoint[],
      liveTool?: Extract<DrawTool, 'pencil' | 'brush' | 'highlighter' | 'eraser'>,
      liveColor?: string,
      liveSize?: number,
      liveOpacity?: number
    ) => {
      const canvas = canvasRef.current
      if (!canvas) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      for (const stroke of strokes) {
        drawStrokeToCtx(ctx, stroke.points, stroke.tool, stroke.color, stroke.size, stroke.opacity)
      }

      if (livePoints && livePoints.length > 1 && liveTool && liveColor) {
        drawStrokeToCtx(ctx, livePoints, liveTool, liveColor, liveSize ?? 6, liveOpacity ?? 1)
      }
    },
    [canvasRef]
  )

  const startStroke = useCallback(
    (
      e: PointerEvent,
      tool: Extract<DrawTool, 'pencil' | 'brush' | 'highlighter' | 'eraser'>,
      color: string,
      size: number,
      opacity: number,
      transform: { scale: number; tx: number; ty: number }
    ) => {
      const canvas = canvasRef.current
      if (!canvas) return

      isDrawingRef.current = true
      canvas.setPointerCapture(e.pointerId)

      const rect = canvas.getBoundingClientRect()
      const x = (e.clientX - rect.left - transform.tx) / transform.scale
      const y = (e.clientY - rect.top - transform.ty) / transform.scale
      const pressure = e.pressure || 0.5

      currentPointsRef.current = [{ x, y, pressure }]

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const animate = () => {
        redrawAll(ctx, completedStrokesRef.current, currentPointsRef.current, tool, color, size, opacity)
        if (isDrawingRef.current) {
          animFrameRef.current = requestAnimationFrame(animate)
        }
      }
      animFrameRef.current = requestAnimationFrame(animate)
    },
    [canvasRef, redrawAll]
  )

  const continueStroke = useCallback(
    (e: PointerEvent, transform: { scale: number; tx: number; ty: number }) => {
      if (!isDrawingRef.current || !canvasRef.current) return

      const canvas = canvasRef.current
      const rect = canvas.getBoundingClientRect()
      const x = (e.clientX - rect.left - transform.tx) / transform.scale
      const y = (e.clientY - rect.top - transform.ty) / transform.scale
      const pressure = e.pressure || 0.5

      currentPointsRef.current.push({ x, y, pressure })
    },
    [canvasRef]
  )

  const endStroke = useCallback(
    (
      tool: Extract<DrawTool, 'pencil' | 'brush' | 'highlighter' | 'eraser'>,
      color: string,
      size: number,
      opacity: number
    ) => {
      if (!isDrawingRef.current) return

      isDrawingRef.current = false
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
        animFrameRef.current = null
      }

      if (currentPointsRef.current.length > 1) {
        completedStrokesRef.current.push({
          id: crypto.randomUUID(),
          points: [...currentPointsRef.current],
          color,
          size,
          opacity,
          tool,
        })
      }

      currentPointsRef.current = []

      // Final redraw
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      redrawAll(ctx, completedStrokesRef.current)
    },
    [canvasRef, redrawAll]
  )

  const clearCanvas = useCallback(() => {
    completedStrokesRef.current = []
    currentPointsRef.current = []
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
  }, [canvasRef])

  const undoLast = useCallback(() => {
    completedStrokesRef.current.pop()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (ctx) redrawAll(ctx, completedStrokesRef.current)
  }, [canvasRef, redrawAll])

  return {
    startStroke,
    continueStroke,
    endStroke,
    clearCanvas,
    undoLast,
    isDrawing: isDrawingRef,
  }
}
