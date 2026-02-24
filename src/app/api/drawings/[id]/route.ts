import { NextRequest, NextResponse } from 'next/server'
import { getDrawing, updateDrawing } from '@/lib/drawings'
import type { CompletedStroke } from '@/types/drawing'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const drawing = await getDrawing(id)
  if (!drawing) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  return NextResponse.json(drawing)
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params

  let strokes: CompletedStroke[]
  try {
    const body = await req.json()
    strokes = body.strokes ?? []
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const expiresAt = await updateDrawing(id, strokes)
  if (!expiresAt) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  return NextResponse.json({ expiresAt })
}
