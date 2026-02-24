'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import type { DrawTool, CanvasTransform, CompletedStroke } from '@/types/drawing'
import { strokeWidthToFontSize } from '@/types/drawing'
import { useDrawing } from '@/hooks/useDrawing'
import LeftToolbar from './LeftToolbar'
import AnimateOverlay from './AnimateOverlay'
import ShareModal from './ShareModal'
import ShortcutsOverlay from './ShortcutsOverlay'

const TAP_MOVE_THRESHOLD = 5
const TAP_TIME_MS = 200

interface TextOverlayState {
  canvasX: number
  canvasY: number
  screenX: number
  screenY: number
}

interface DrawingCanvasProps {
  drawingId?: string
  initialStrokes?: CompletedStroke[]
  initialAnimationCode?: string
  initialAnimationPrompt?: string
}

export default function DrawingCanvas({ drawingId, initialStrokes, initialAnimationCode, initialAnimationPrompt }: DrawingCanvasProps = {}) {
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

  // Hover stroke detection — updates continuously on pointer move (throttled ~30fps)
  const [hoverStrokeId, setHoverStrokeId] = useState<string | null>(null)
  const hoverStrokeIdRef = useRef<string | null>(null)
  const hoverThrottleRef = useRef(0)

  // Tutorial — labels visible for first 5 seconds then disappear
  const [showTutorial, setShowTutorial] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setShowTutorial(false), 5000)
    return () => clearTimeout(t)
  }, [])

  // Animate tool — snapshot of drawing canvas at the moment animate is activated
  const [animateSnapshot, setAnimateSnapshot] = useState<{
    dataUrl: string
    width: number
    height: number
  } | null>(null)

  useEffect(() => {
    if (activeTool === 'animate') {
      const canvas = drawingCanvasRef.current
      if (canvas && canvas.width > 0) {
        setAnimateSnapshot({
          dataUrl: canvas.toDataURL('image/png'),
          width: canvas.width,
          height: canvas.height,
        })
      }
    } else {
      setAnimateSnapshot(null)
    }
  }, [activeTool])

  // Auto-play animation when viewing a shared link that has animation code
  useEffect(() => {
    if (initialAnimationCode) {
      setActiveTool('animate')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Text tool overlay
  const [textOverlay, setTextOverlay] = useState<TextOverlayState | null>(null)
  const textOverlayRef = useRef<HTMLDivElement>(null)
  const textValueRef = useRef('')

  // Share / save state
  const drawingIdRef = useRef<string | null>(drawingId ?? null)
  const shareTokenRef = useRef<string | null>(null)
  const shareUrlRef = useRef<string | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [shareState, setShareState] = useState<'idle' | 'saving' | 'copied' | 'error'>('idle')
  const [expiresAt, setExpiresAt] = useState<number | null>(null)
  const [shareModal, setShareModal] = useState<{ url: string } | null>(null)
  const [showShortcuts, setShowShortcuts] = useState(false)

  // Interaction tracking refs
  const hasMovedRef = useRef(false)
  const downPosRef = useRef<{ x: number; y: number } | null>(null)
  const downTimeRef = useRef<number>(0)
  const isDraggingRef = useRef(false)
  const dragLastPosRef = useRef<{ x: number; y: number } | null>(null)

  // Pinch state
  const pinchRef = useRef<{ dist: number } | null>(null)

  const drawing = useDrawing(drawingCanvasRef, initialStrokes)

  // Resize both canvases and always repaint — canvas clears on dimension change
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
      if (haloCanvasRef.current) {
        haloCanvasRef.current.width = w
        haloCanvasRef.current.height = h
      }
      drawing.redrawFromHistory()
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

  // Delete / Escape key — works in any tool mode
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if ((e.target as HTMLElement)?.isContentEditable) return
      if (e.key === 'Escape') {
        setShowShortcuts(false)
        setSelectedStrokeId(null)
        drawing.selectedStrokeId.current = null
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedStrokeId) {
          drawing.deleteSelectedStroke()
          setSelectedStrokeId(null)
        } else {
          drawing.undoLast()
        }
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
      const wrapper = wrapperRef.current
      if (!wrapper) return { x: 0, y: 0 }
      const rect = wrapper.getBoundingClientRect()
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

  const commitTextOverlay = useCallback(() => {
    if (!textOverlay) return
    const text = textValueRef.current.trim()
    if (text.length > 0) {
      const fontSize = strokeWidthToFontSize(strokeWidth)
      drawing.addTextStroke(text, textOverlay.canvasX, textOverlay.canvasY, fontSize, activeColor)
      scheduleSave()
    }
    setTextOverlay(null)
    textValueRef.current = ''
  }, [textOverlay, strokeWidth, activeColor, drawing, scheduleSave])

  const handleOverlayKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        commitTextOverlay()
      }
      if (e.key === 'Escape') {
        setTextOverlay(null)
        textValueRef.current = ''
      }
    },
    [commitTextOverlay]
  )

  // Auto-focus the text overlay when it opens
  useEffect(() => {
    if (textOverlay) textOverlayRef.current?.focus()
  }, [textOverlay])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.isPrimary === false) return
      if (activeTool === 'animate') return

      // Commit any open text overlay first, then let the click proceed
      if (textOverlay) commitTextOverlay()

      e.currentTarget.setPointerCapture(e.pointerId)

      const pos = getEventPos(e)
      downPosRef.current = pos
      downTimeRef.current = Date.now()
      hasMovedRef.current = false
      isDraggingRef.current = false

      // Text tool: don't start a freehand stroke; overlay will open on pointer-up tap
      if (activeTool === 'text') return

      // Shift or explicit eraser → start erase stroke immediately
      if (e.shiftKey || activeTool === 'eraser') {
        drawing.startStroke(pos.x, pos.y, e.nativeEvent.pressure || 0.5, 'eraser', activeColor, strokeWidth, 1)
        return
      }

      // If something is selected and we're clicking ON it → begin drag
      if (selectedStrokeId && drawing.isPointOnStroke(pos.x, pos.y, selectedStrokeId)) {
        isDraggingRef.current = true
        setIsDragging(true)
        dragLastPosRef.current = pos
        return
      }

      // Hovering over any stroke → don't start freehand (prevents paint splash);
      // tap-select will fire on pointerUp. If it's the selected stroke, start drag.
      if (hoverStrokeIdRef.current) {
        if (selectedStrokeId === hoverStrokeIdRef.current) {
          isDraggingRef.current = true
          setIsDragging(true)
          dragLastPosRef.current = pos
        }
        return
      }

      // Otherwise: start draw stroke (may be cancelled on tap)
      setSelectedStrokeId(null)
      drawing.selectedStrokeId.current = null
      drawing.startStroke(
        pos.x, pos.y, e.nativeEvent.pressure || 0.5,
        activeTool as 'pencil' | 'brush' | 'highlighter',
        activeColor, strokeWidth, 1
      )
    },
    [activeTool, activeColor, strokeWidth, drawing, getEventPos, selectedStrokeId, textOverlay, commitTextOverlay]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.isPrimary === false) return

      const pos = getEventPos(e)

      // Hover detection: update which stroke is under the cursor (throttled ~30fps)
      if (!drawing.isDrawing.current && !isDraggingRef.current) {
        const now = Date.now()
        if (now - hoverThrottleRef.current > 33) {
          hoverThrottleRef.current = now
          const hovered = drawing.hitTestAtPoint(pos.x, pos.y)
          if (hovered !== hoverStrokeIdRef.current) {
            hoverStrokeIdRef.current = hovered
            setHoverStrokeId(hovered)
          }
        }
      }

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

      drawing.continueStroke(pos.x, pos.y, e.nativeEvent.pressure || 0.5)
    },
    [activeTool, drawing, getEventPos, selectedStrokeId]
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

      // Tap detection: select, place text, or commit a dot on empty canvas
      const isTap = !hasMovedRef.current && elapsed < TAP_TIME_MS
      if (isTap) {
        if (activeTool === 'text') {
          drawing.cancelCurrentStroke()
          const rect = wrapperRef.current!.getBoundingClientRect()
          setTextOverlay({
            canvasX: pos.x,
            canvasY: pos.y,
            screenX: e.clientX - rect.left,
            screenY: e.clientY - rect.top,
          })
          textValueRef.current = ''
          return
        }
        // Check hit without side effects
        const hitId = drawing.hitTestAtPoint(pos.x, pos.y)
        if (hitId) {
          // Tap on existing stroke → select it (cancel any in-progress freehand)
          drawing.cancelCurrentStroke()
          drawing.selectedStrokeId.current = hitId
          setSelectedStrokeId(hitId)
        } else {
          // Tap on empty canvas → commit in-progress stroke as a dot
          drawing.endStroke(activeTool as 'pencil' | 'brush' | 'highlighter', activeColor, strokeWidth, 1)
          setSelectedStrokeId(null)
          drawing.selectedStrokeId.current = null
          scheduleSave()
        }
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
      if (textOverlay) commitTextOverlay()
      const t0 = e.touches[0]
      const t1 = e.touches[1]
      pinchRef.current = {
        dist: Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY),
      }
    }
  }, [textOverlay, commitTextOverlay])

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
    if (textOverlay) commitTextOverlay()
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
  }, [textOverlay, commitTextOverlay])

  const handleClear = useCallback(() => {
    drawing.clearCanvas()
    setSelectedStrokeId(null)
  }, [drawing])

  const handleShare = useCallback(async (animationCode?: string, animationPrompt?: string) => {
    if (shareState === 'saving') return

    // If already shared, just open the modal with existing URL
    if (shareUrlRef.current && drawingIdRef.current) {
      // If new animation data came in, save it via PUT
      if (animationCode) {
        await fetch(`/api/drawings/${drawingIdRef.current}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ strokes: drawing.getStrokes(), animation_code: animationCode, animation_prompt: animationPrompt ?? null }),
        }).catch((err: unknown) => console.error('[handleShare] animation PUT failed:', err))
      }
      setShareModal({ url: shareUrlRef.current })
      return
    }

    setShareState('saving')
    try {
      let canvasImage: string | null = null
      try {
        canvasImage = drawingCanvasRef.current?.toDataURL('image/png') ?? null
      } catch (imgErr) {
        console.error('[handleShare] toDataURL failed:', imgErr)
      }
      const res = await fetch('/api/drawings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strokes: drawing.getStrokes(),
          canvas_image: canvasImage,
          animation_code: animationCode ?? null,
          animation_prompt: animationPrompt ?? null,
        }),
      })
      if (!res.ok) throw new Error('create_failed')
      const { id, share_token, share_url, expiresAt: exp } = await res.json() as {
        id: string
        share_token: string
        share_url: string
        expiresAt: string
      }
      drawingIdRef.current = id
      shareTokenRef.current = share_token
      shareUrlRef.current = share_url
      setExpiresAt(new Date(exp).getTime())
      window.history.replaceState(null, '', `/share/${share_token}`)
      setShareState('idle')
      setShareModal({ url: share_url })
    } catch (err) {
      console.error('[handleShare]', err)
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
    : (hoverStrokeId || selectedStrokeId)
      ? 'grab'
      : (shiftHeld || activeTool === 'eraser')
        ? 'cell'
        : activeTool === 'text'
          ? 'text'
          : activeTool === 'animate'
            ? 'default'
            : 'crosshair'

  return (
    <div className="fixed inset-0 bg-[#f5f5f0] overflow-hidden">
      {/* Share modal */}
      {shareModal && (
        <ShareModal shareUrl={shareModal.url} onClose={() => setShareModal(null)} />
      )}

      {/* Shortcuts overlay */}
      {showShortcuts && (
        <ShortcutsOverlay onClose={() => setShowShortcuts(false)} />
      )}

      {/* Animate overlay — covers everything when animate tool is active */}
      {activeTool === 'animate' && animateSnapshot && (
        <AnimateOverlay
          canvasDataUrl={animateSnapshot.dataUrl}
          canvasWidth={animateSnapshot.width}
          canvasHeight={animateSnapshot.height}
          strokes={drawing.getStrokes()}
          onBack={() => setActiveTool('pencil')}
          onShare={(code, prompt) => handleShare(code, prompt)}
          preloadedCode={initialAnimationCode}
        />
      )}

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
        showTutorial={showTutorial}
        onShowShortcuts={() => setShowShortcuts(true)}
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
        onPointerLeave={() => { hoverStrokeIdRef.current = null; setHoverStrokeId(null) }}
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

        {/* Text input overlay — positioned in screen space, outside the CSS transform div */}
        {textOverlay && (
          <div
            ref={textOverlayRef}
            contentEditable
            suppressContentEditableWarning
            onInput={(e) => { textValueRef.current = e.currentTarget.textContent ?? '' }}
            onKeyDown={handleOverlayKeyDown}
            style={{
              position: 'absolute',
              left: textOverlay.screenX,
              top: textOverlay.screenY,
              fontSize: `${strokeWidthToFontSize(strokeWidth) * transform.scale}px`,
              fontFamily: 'Inter, system-ui, sans-serif',
              color: activeColor,
              caretColor: activeColor,
              outline: `1.5px dashed ${activeColor}55`,
              padding: 0,
              minWidth: '2ch',
              whiteSpace: 'pre',
              lineHeight: 1,
              zIndex: 20,
              background: 'transparent',
              cursor: 'text',
            }}
          />
        )}

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
            {activeTool === 'text'
              ? `TEXT · ${strokeWidthToFontSize(strokeWidth)}px`
              : shiftHeld
                ? 'ERASER'
                : activeTool.toUpperCase()}
          </div>
        )}
      </div>
    </div>
  )
}
