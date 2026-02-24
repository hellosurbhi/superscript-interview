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

function drawDot(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  tool: Extract<DrawTool, 'pencil' | 'brush' | 'highlighter' | 'eraser'>
) {
  ctx.save()
  if (tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out'
    ctx.fillStyle = 'rgba(0,0,0,1)'
  } else if (tool === 'highlighter') {
    ctx.globalCompositeOperation = 'multiply'
    ctx.fillStyle = color
    ctx.globalAlpha = 0.35
  } else {
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = color
  }
  ctx.beginPath()
  ctx.arc(x, y, size / 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawStrokeToCtx(
  ctx: CanvasRenderingContext2D,
  points: StrokePoint[],
  tool: Extract<DrawTool, 'pencil' | 'brush' | 'highlighter' | 'eraser'>,
  color: string,
  size: number,
  opacity: number
) {
  if (points.length === 1) {
    drawDot(ctx, points[0].x, points[0].y, size, color, tool)
    return
  }
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
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  initialStrokes?: CompletedStroke[]
) {
  const isDrawingRef = useRef(false)
  const currentPointsRef = useRef<StrokePoint[]>([])
  const completedStrokesRef = useRef<CompletedStroke[]>(initialStrokes ?? [])
  const animFrameRef = useRef<number | null>(null)
  const selectedStrokeIdRef = useRef<string | null>(null)

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

      if (livePoints && livePoints.length === 1 && liveTool && liveColor) {
        drawDot(ctx, livePoints[0].x, livePoints[0].y, liveSize ?? 6, liveColor, liveTool)
      } else if (livePoints && livePoints.length > 1 && liveTool && liveColor) {
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

      if (currentPointsRef.current.length >= 1) {
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

      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      redrawAll(ctx, completedStrokesRef.current)
    },
    [canvasRef, redrawAll]
  )

  const cancelCurrentStroke = useCallback(() => {
    isDrawingRef.current = false
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    currentPointsRef.current = []
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (ctx) redrawAll(ctx, completedStrokesRef.current)
  }, [canvasRef, redrawAll])

  const selectStrokeAtPoint = useCallback(
    (x: number, y: number): string | null => {
      const canvas = canvasRef.current
      if (!canvas) return null

      const strokes = completedStrokesRef.current
      for (let i = strokes.length - 1; i >= 0; i--) {
        const stroke = strokes[i]
        if (stroke.tool === 'eraser') continue

        const offscreen = document.createElement('canvas')
        offscreen.width = canvas.width
        offscreen.height = canvas.height
        const offCtx = offscreen.getContext('2d')
        if (!offCtx) continue

        drawStrokeToCtx(offCtx, stroke.points, stroke.tool, '#ffffff', stroke.size, 1)

        const px = Math.round(x)
        const py = Math.round(y)
        if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) continue

        const pixel = offCtx.getImageData(px, py, 1, 1).data
        if (pixel[3] > 0) {
          selectedStrokeIdRef.current = stroke.id
          return stroke.id
        }
      }
      selectedStrokeIdRef.current = null
      return null
    },
    [canvasRef]
  )

  const isPointOnStroke = useCallback(
    (x: number, y: number, id: string): boolean => {
      const canvas = canvasRef.current
      if (!canvas) return false
      const stroke = completedStrokesRef.current.find((s) => s.id === id)
      if (!stroke || stroke.tool === 'eraser') return false

      const offscreen = document.createElement('canvas')
      offscreen.width = canvas.width
      offscreen.height = canvas.height
      const offCtx = offscreen.getContext('2d')
      if (!offCtx) return false

      drawStrokeToCtx(offCtx, stroke.points, stroke.tool, '#ffffff', stroke.size, 1)

      const px = Math.round(x)
      const py = Math.round(y)
      if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) return false
      return offCtx.getImageData(px, py, 1, 1).data[3] > 0
    },
    [canvasRef]
  )

  const moveStroke = useCallback(
    (id: string, dx: number, dy: number) => {
      const strokes = completedStrokesRef.current
      const stroke = strokes.find((s) => s.id === id)
      if (!stroke) return
      stroke.points = stroke.points.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy }))
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (ctx) redrawAll(ctx, strokes)
    },
    [canvasRef, redrawAll]
  )

  const deleteSelectedStroke = useCallback(() => {
    const id = selectedStrokeIdRef.current
    if (!id) return
    completedStrokesRef.current = completedStrokesRef.current.filter((s) => s.id !== id)
    selectedStrokeIdRef.current = null
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (ctx) redrawAll(ctx, completedStrokesRef.current)
  }, [canvasRef, redrawAll])

  const clearCanvas = useCallback(() => {
    completedStrokesRef.current = []
    currentPointsRef.current = []
    selectedStrokeIdRef.current = null
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
  }, [canvasRef])

  const undoLast = useCallback(() => {
    completedStrokesRef.current.pop()
    selectedStrokeIdRef.current = null
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (ctx) redrawAll(ctx, completedStrokesRef.current)
  }, [canvasRef, redrawAll])

  const drawSelectionHalo = useCallback(
    (haloCtx: CanvasRenderingContext2D, canvasWidth: number, canvasHeight: number) => {
      haloCtx.clearRect(0, 0, canvasWidth, canvasHeight)

      const id = selectedStrokeIdRef.current
      if (!id) return

      const stroke = completedStrokesRef.current.find((s) => s.id === id)
      if (!stroke) return

      haloCtx.save()

      if (stroke.points.length === 1) {
        // Single dot: draw a glowing ring around it
        haloCtx.shadowColor = 'rgba(255, 120, 0, 0.95)'
        haloCtx.shadowBlur = 16
        haloCtx.strokeStyle = 'rgba(255, 140, 0, 0.8)'
        haloCtx.lineWidth = 2.5
        haloCtx.beginPath()
        haloCtx.arc(stroke.points[0].x, stroke.points[0].y, stroke.size / 2 + 5, 0, Math.PI * 2)
        haloCtx.stroke()
      } else {
        // Multi-point stroke: recompute path with size+8 so halo wraps outside the original
        const opts = {
          ...TOOL_OPTIONS[stroke.tool],
          size: stroke.size + 8,
          simulatePressure: true,
        }
        const outlinePoints = getStroke(
          stroke.points.map((p) => [p.x, p.y, p.pressure]),
          opts
        )
        const pathData = getSvgPathFromStroke(outlinePoints)
        const path = new Path2D(pathData)

        haloCtx.shadowColor = 'rgba(255, 130, 0, 0.85)'
        haloCtx.shadowBlur = 18
        haloCtx.fillStyle = 'rgba(255, 140, 0, 0.18)'
        haloCtx.fill(path)
      }

      haloCtx.restore()
    },
    [] // reads refs directly — no reactive deps needed
  )

  const getStrokes = useCallback(() => completedStrokesRef.current, [])

  const redrawFromHistory = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (ctx) redrawAll(ctx, completedStrokesRef.current)
  }, [canvasRef, redrawAll])

  return {
    startStroke,
    continueStroke,
    endStroke,
    cancelCurrentStroke,
    clearCanvas,
    undoLast,
    getStrokes,
    redrawFromHistory,
    drawSelectionHalo,
    isDrawing: isDrawingRef,
    selectStrokeAtPoint,
    isPointOnStroke,
    moveStroke,
    deleteSelectedStroke,
    selectedStrokeId: selectedStrokeIdRef,
  }
}
