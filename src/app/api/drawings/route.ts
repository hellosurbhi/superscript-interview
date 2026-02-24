import { NextRequest, NextResponse } from 'next/server'
import { createDrawing } from '@/lib/drawings'
import type { CompletedStroke } from '@/types/drawing'

export async function POST(req: NextRequest) {
  let strokes: CompletedStroke[]
  try {
    const body = await req.json()
    strokes = body.strokes ?? []
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 12)

  try {
    const expiresAt = await createDrawing(id, strokes)
    return NextResponse.json({ id, expiresAt })
  } catch (err) {
    console.error('[POST /api/drawings]', err)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
