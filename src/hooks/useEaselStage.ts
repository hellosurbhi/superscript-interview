'use client'

import { useEffect, useRef, useCallback } from 'react'

type EaselReadyCallback = (stage: createjs.Stage, cjs: typeof createjs) => void

export function useEaselStage(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  onReady: EaselReadyCallback,
  fps = 60
) {
  const stageRef = useRef<createjs.Stage | null>(null)
  const cjsRef = useRef<typeof createjs | null>(null)

  const getStage = useCallback(() => stageRef.current, [])
  const getCjs = useCallback(() => cjsRef.current, [])

  useEffect(() => {
    if (!canvasRef.current) return
    let mounted = true

    const init = async () => {
      // EaselJS must be dynamically imported — it accesses window at module load
      const cjs = await import('@createjs/easeljs')
      const createjs = (cjs as unknown as { default: typeof window.createjs }).default ?? (cjs as unknown as typeof window.createjs)
      if (!mounted || !canvasRef.current) return

      cjsRef.current = createjs
      const stage = new createjs.Stage(canvasRef.current)
      stageRef.current = stage

      createjs.Touch.enable(stage, false)
      stage.enableMouseOver(20)

      createjs.Ticker.timingMode = createjs.Ticker.RAF_SYNCHED
      createjs.Ticker.framerate = fps
      createjs.Ticker.addEventListener('tick', () => {
        if (mounted) stage.update()
      })

      onReady(stage, createjs)
    }

    init()

    return () => {
      mounted = false
      if (cjsRef.current) {
        cjsRef.current.Ticker.removeAllEventListeners()
      }
      if (stageRef.current) {
        stageRef.current.enableMouseOver(0)
        stageRef.current.removeAllChildren()
        stageRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fps])

  return { getStage, getCjs }
}
