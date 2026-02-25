import { NextRequest, NextResponse } from 'next/server'
import { getAnimationsForDrawing } from '@/lib/animations'

type Params = { params: Promise<{ token: string }> }

// GET /api/drawings/[id]/animations — list all animations for a drawing by UUID
export async function GET(_req: NextRequest, { params }: Params) {
  const { token: drawing_id } = await params
  const animations = await getAnimationsForDrawing(drawing_id)
  return NextResponse.json(animations)
}
