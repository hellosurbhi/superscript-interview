import { NextRequest, NextResponse } from 'next/server'
import { getAnimationByToken, touchAnimation, deleteAnimation } from '@/lib/animations'
import { getDrawingById } from '@/lib/drawings'
import type { CompletedStroke } from '@/types/drawing'

type Params = { params: Promise<{ token: string }> }

// GET /api/animations/[token] — fetch animation by share token
export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params

  const animation = await getAnimationByToken(token)
  if (!animation) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  // Extend expiry on view (rolling 24h)
  await touchAnimation(token)

  // Fetch drawing for strokes + back-link (may be null if drawing expired)
  let drawing: { share_token: string; strokes: CompletedStroke[] } | null = null
  try {
    const raw = await getDrawingById(animation.drawing_id)
    if (raw) {
      drawing = { share_token: raw.share_token, strokes: raw.strokes }
    }
  } catch {
    // Drawing expired or missing — animation still plays with empty strokes
  }

  return NextResponse.json({
    animation_code: animation.animation_code,
    animation_prompt: animation.animation_prompt,
    preview_image: animation.preview_image,
    canvas_width: animation.canvas_width,
    canvas_height: animation.canvas_height,
    drawing,
  })
}

// DELETE /api/animations/[token] — delete animation by UUID (token = animation.id)
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { token: id } = await params
  const ok = await deleteAnimation(id)
  if (!ok) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
