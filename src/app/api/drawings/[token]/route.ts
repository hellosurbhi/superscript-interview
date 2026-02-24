import { NextRequest, NextResponse } from 'next/server'
import { getDrawing, updateDrawing } from '@/lib/drawings'
import type { CompletedStroke } from '@/types/drawing'

type Params = { params: Promise<{ token: string }> }

// GET /api/drawings/[token] — fetch drawing by share_token
export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params
  const drawing = await getDrawing(token)
  if (!drawing) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  return NextResponse.json(drawing)
}

// PUT /api/drawings/[token] — update drawing by UUID id (token param is the UUID here)
export async function PUT(req: NextRequest, { params }: Params) {
  const { token: id } = await params

  let strokes: CompletedStroke[]
  let animationCode: string | null = null
  let animationPrompt: string | null = null
  try {
    const body = await req.json()
    strokes = body.strokes ?? []
    animationCode = body.animation_code ?? null
    animationPrompt = body.animation_prompt ?? null
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const expiresAt = await updateDrawing(id, strokes, animationCode, animationPrompt)
  if (!expiresAt) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  return NextResponse.json({ expiresAt })
}
