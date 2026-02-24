'use client'

import { useRef, useCallback } from 'react'
import type { DrawingShape, ShapeType } from '@/types/drawing'

function drawShape(
  shape: createjs.Shape,
  type: ShapeType,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  stroke: string,
  strokeWidth: number,
  opacity: number
) {
  shape.graphics.clear()
  shape.alpha = opacity
  shape.x = x
  shape.y = y

  const g = shape.graphics
  if (fill !== 'transparent') g.beginFill(fill)
  if (strokeWidth > 0) g.setStrokeStyle(strokeWidth, 'round', 'round').beginStroke(stroke)

  const absW = Math.abs(w)
  const absH = Math.abs(h)
  const ox = w < 0 ? w : 0
  const oy = h < 0 ? h : 0

  switch (type) {
    case 'rect':
      g.drawRoundRect(ox, oy, absW, absH, 4)
      break
    case 'circle':
      g.drawCircle(absW / 2 + ox, absH / 2 + oy, Math.min(absW, absH) / 2)
      break
    case 'ellipse':
      g.drawEllipse(ox, oy, absW, absH)
      break
    case 'line':
      g.moveTo(0, 0).lineTo(w, h)
      break
    case 'arrow': {
      const len = Math.sqrt(w * w + h * h)
      const headLen = Math.min(20, len * 0.3)
      const angle = Math.atan2(h, w)
      g.moveTo(0, 0).lineTo(w, h)
      g.moveTo(w, h)
        .lineTo(
          w - headLen * Math.cos(angle - Math.PI / 6),
          h - headLen * Math.sin(angle - Math.PI / 6)
        )
      g.moveTo(w, h)
        .lineTo(
          w - headLen * Math.cos(angle + Math.PI / 6),
          h - headLen * Math.sin(angle + Math.PI / 6)
        )
      break
    }
    case 'triangle': {
      g.moveTo(absW / 2 + ox, oy)
        .lineTo(absW + ox, absH + oy)
        .lineTo(ox, absH + oy)
        .closePath()
      break
    }
  }

  if (fill !== 'transparent') g.endFill()
  if (strokeWidth > 0) g.endStroke()
}

export function useShapes() {
  const shapesRef = useRef<DrawingShape[]>([])
  const easelShapesRef = useRef<Map<string, createjs.Shape>>(new Map())
  const selectedIdRef = useRef<string | null>(null)
  const stageRef = useRef<createjs.Stage | null>(null)

  const setStage = useCallback((stage: createjs.Stage) => {
    stageRef.current = stage
  }, [])

  const addShape = useCallback(
    (
      type: ShapeType,
      x: number,
      y: number,
      w: number,
      h: number,
      fill: string,
      stroke: string,
      strokeWidth: number,
      opacity: number,
      cjs: typeof createjs
    ): DrawingShape => {
      const id = crypto.randomUUID()
      const shape: DrawingShape = {
        id,
        type,
        x,
        y,
        width: w,
        height: h,
        fill,
        stroke,
        strokeWidth,
        opacity,
        selected: false,
      }
      shapesRef.current.push(shape)

      const easelShape = new cjs.Shape()
      drawShape(easelShape, type, x, y, w, h, fill, stroke, strokeWidth, opacity)
      easelShapesRef.current.set(id, easelShape)

      const stage = stageRef.current
      if (stage) {
        stage.addChild(easelShape)

        // Drag logic
        let offsetX = 0
        let offsetY = 0

        easelShape.on('mousedown', (evt) => {
          const e = evt as createjs.MouseEvent
          selectShape(id)
          offsetX = e.stageX - shape.x
          offsetY = e.stageY - shape.y
        })

        easelShape.on('pressmove', (evt) => {
          const e = evt as createjs.MouseEvent
          shape.x = e.stageX - offsetX
          shape.y = e.stageY - offsetY
          easelShape.x = shape.x
          easelShape.y = shape.y
          stage.update()
        })
      }

      return shape
    },
    []
  )

  const selectShape = useCallback((id: string | null) => {
    // Deselect previous
    if (selectedIdRef.current) {
      const prev = shapesRef.current.find((s) => s.id === selectedIdRef.current)
      if (prev) prev.selected = false
    }
    selectedIdRef.current = id
    if (id) {
      const shape = shapesRef.current.find((s) => s.id === id)
      if (shape) shape.selected = true
    }
  }, [])

  const deleteSelected = useCallback(() => {
    const id = selectedIdRef.current
    if (!id) return
    const easelShape = easelShapesRef.current.get(id)
    if (easelShape && stageRef.current) {
      stageRef.current.removeChild(easelShape)
    }
    easelShapesRef.current.delete(id)
    shapesRef.current = shapesRef.current.filter((s) => s.id !== id)
    selectedIdRef.current = null
    stageRef.current?.update()
  }, [])

  const updateShapeStyle = useCallback(
    (id: string, fill: string, stroke: string, strokeWidth: number, opacity: number) => {
      const shape = shapesRef.current.find((s) => s.id === id)
      const easelShape = easelShapesRef.current.get(id)
      if (!shape || !easelShape) return
      shape.fill = fill
      shape.stroke = stroke
      shape.strokeWidth = strokeWidth
      shape.opacity = opacity
      drawShape(easelShape, shape.type, shape.x, shape.y, shape.width, shape.height, fill, stroke, strokeWidth, opacity)
      stageRef.current?.update()
    },
    []
  )

  const clearShapes = useCallback(() => {
    for (const [, easelShape] of easelShapesRef.current) {
      stageRef.current?.removeChild(easelShape)
    }
    easelShapesRef.current.clear()
    shapesRef.current = []
    selectedIdRef.current = null
    stageRef.current?.update()
  }, [])

  return {
    setStage,
    addShape,
    selectShape,
    deleteSelected,
    updateShapeStyle,
    clearShapes,
    shapes: shapesRef,
    selectedId: selectedIdRef,
  }
}
