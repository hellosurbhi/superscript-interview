import { NextRequest, NextResponse } from 'next/server'
import { createAnimation } from '@/lib/animations'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://superscript-interview.vercel.app'

// POST /api/animations — create a new animation record linked to a drawing
export async function POST(req: NextRequest) {
  let body: {
    drawing_id: string
    animation_code: string
    animation_prompt: string
    preview_image?: string | null
    canvas_width?: number | null
    canvas_height?: number | null
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const { drawing_id, animation_code, animation_prompt, preview_image, canvas_width, canvas_height } = body

  if (!drawing_id || !animation_code || !animation_prompt) {
    return NextResponse.json({ error: 'missing_required_fields' }, { status: 400 })
  }

  try {
    const { animation, expiresAt } = await createAnimation(
      drawing_id,
      animation_code,
      animation_prompt,
      preview_image ?? null,
      canvas_width ?? null,
      canvas_height ?? null
    )

    const share_url = `${APP_URL}/share/animation/${animation.share_token}`
    return NextResponse.json({
      id: animation.id,
      share_token: animation.share_token,
      share_url,
      expiresAt,
      animation,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
