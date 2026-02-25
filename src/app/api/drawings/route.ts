import { NextRequest, NextResponse } from 'next/server'
import { nanoid } from 'nanoid'
import { createDrawing } from '@/lib/drawings'
import type { CompletedStroke } from '@/types/drawing'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://superscript-interview.vercel.app'

export async function POST(req: NextRequest) {
  console.log('[POST /api/drawings] APP_URL:', APP_URL)
  console.log('[POST /api/drawings] SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'UNDEFINED')
  let strokes: CompletedStroke[]
  let canvasImage: string | null = null
  try {
    const body = await req.json()
    strokes = body.strokes ?? []
    canvasImage = body.canvas_image ?? null
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const id = crypto.randomUUID()
  const shareToken = nanoid(10)

  try {
    const expiresAt = await createDrawing(id, shareToken, strokes, canvasImage)
    const shareUrl = `${APP_URL}/share/${shareToken}`
    return NextResponse.json({ id, share_token: shareToken, share_url: shareUrl, expiresAt })
  } catch (err) {
    console.error('[POST /api/drawings]', err)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
