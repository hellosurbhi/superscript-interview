import { NextRequest, NextResponse } from 'next/server'

const SYSTEM_PROMPT = `You are an animation engine for a 2D canvas drawing app.

The user has drawn something on a canvas and wants to animate it. You will receive a screenshot of their drawing, a text description of the desired animation, and a list of elements with their positions.

TASK: Generate a single JavaScript function that animates the drawing.

REQUIREMENTS:
- Output ONLY the function — no markdown, no explanation, no comments outside it
- Exact signature: function animate(ctx, width, height, frameData, progress) { ... }
- progress: number 0→1, represents one full animation cycle (loops back to 0 automatically)
- frameData.strokes — Array of stroke objects. Each stroke is one of two types:
    FreehandStroke: { id: string, tool: "pencil"|"eraser", points: Array<{x:number, y:number, pressure:number}>, color: string, size: number, opacity: number }
    TextStroke:     { id: string, type: "text", text: string, x: number, y: number, fontSize: number, color: string }
  Type check: stroke.type === "text" → TextStroke, otherwise FreehandStroke
  Points:     stroke.points[i].x and stroke.points[i].y  (ALWAYS guard: if (!stroke.points?.length) continue)
  IMPORTANT:  There is NO bbox, NO width/height, NO shape property — derive bounds from points array if needed
  Example usage:
    for (const s of frameData.strokes) {
      if (s.type === 'text') {
        ctx.fillText(s.text, s.x, s.y)
      } else {
        const pts = s.points
        if (!pts?.length) continue
        ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y)
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
        ctx.stroke()
      }
    }
- ctx: Canvas 2D rendering context (the original drawing is already painted as background)
- ONLY use Canvas 2D API methods (ctx.fillRect, ctx.arc, ctx.moveTo, ctx.lineTo, ctx.stroke, ctx.fill, etc.)
- FORBIDDEN: fetch, XMLHttpRequest, import, require, document, window, localStorage, eval, setTimeout, setInterval
- No global variables, no external state — function must be pure and self-contained
- The function CLEARS nothing — background is already drawn, just add animation on top

ANIMATION TECHNIQUES:
- Smooth movement: const lerp = (a, b, t) => a + (b - a) * t
- Oscillation: Math.sin(progress * Math.PI * 2)
- Easing in/out: const ease = t => t < 0.5 ? 2*t*t : -1+(4-2*t)*t
- Particles: use progress to control positions, alpha to fade
- Use ctx.save() / ctx.restore() for all transformations
- Use ctx.globalAlpha for transparency effects

Make the animation match the user's description. Be creative. Smooth. Loopable.`

interface StrokeRecord {
  type?: string
  text?: string
  x?: number
  y?: number
  fontSize?: number
  color?: string
  points?: Array<{ x: number; y: number }>
  tool?: string
}

function computeStrokeSummary(strokes: unknown[]): string {
  if (!strokes.length) return 'Canvas is empty.'
  const lines = (strokes as StrokeRecord[]).map((stroke, i) => {
    if (stroke.type === 'text') {
      return `[${i}] Text "${stroke.text}" at (${stroke.x},${stroke.y}) fontSize:${stroke.fontSize}px color:${stroke.color}`
    }
    const pts = stroke.points
    if (!pts?.length) return `[${i}] Empty stroke`
    const xs = pts.map(p => p.x)
    const ys = pts.map(p => p.y)
    const x1 = Math.min(...xs), y1 = Math.min(...ys)
    const x2 = Math.max(...xs), y2 = Math.max(...ys)
    return `[${i}] ${stroke.tool} stroke bbox:(${Math.round(x1)},${Math.round(y1)})-(${Math.round(x2)},${Math.round(y2)}) center:(${Math.round((x1 + x2) / 2)},${Math.round((y1 + y2) / 2)}) color:${stroke.color}`
  })
  return `Canvas elements (${strokes.length} total):\n${lines.join('\n')}`
}

function sanitize(code: string): string {
  let c = code.replace(/^```[\w]*\n?/gm, '').replace(/^```\s*$/gm, '').trim()
  const fnMatch = c.match(/function\s+animate\s*\([\s\S]*/)
  if (!fnMatch) throw new Error('No animate function found in response')
  c = fnMatch[0]
  const blocked = [
    'fetch(', 'XMLHttpRequest', 'import(', 'require(',
    'document.', 'window.', 'localStorage', 'sessionStorage',
    'eval(', 'Function(', 'setTimeout(', 'setInterval(',
  ]
  for (const b of blocked) {
    if (c.includes(b)) throw new Error(`Blocked: response contains "${b}"`)
  }
  return c
}

export async function POST(req: NextRequest) {
  let imageDataUrl: string, prompt: string, strokes: unknown[]
  try {
    const body = await req.json() as { imageDataUrl: string; prompt: string; strokes?: unknown[] }
    imageDataUrl = body.imageDataUrl
    prompt = body.prompt
    strokes = body.strokes ?? []
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  if (!imageDataUrl || !prompt) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })

  const base64 = imageDataUrl.replace(/^data:image\/png;base64,/, '')
  const strokeSummary = computeStrokeSummary(strokes)
  const userMessage = `Animation request: "${prompt}"\n\n${strokeSummary}\n\nCanvas size: see the image dimensions.`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: base64 } },
            { type: 'text', text: userMessage },
          ],
        }],
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('[POST /api/animate] Anthropic error:', errText)
      return NextResponse.json({ error: 'ai_error' }, { status: 502 })
    }

    const data = await res.json() as { content: Array<{ type: string; text: string }> }
    const rawCode = data.content.find(b => b.type === 'text')?.text ?? ''

    let code: string
    try {
      code = sanitize(rawCode)
    } catch (e) {
      console.error('[POST /api/animate] Sanitize failed:', e, '\nRaw:', rawCode)
      return NextResponse.json({ error: 'invalid_code' }, { status: 422 })
    }

    return NextResponse.json({ code })
  } catch (err) {
    console.error('[POST /api/animate]', err)
    return NextResponse.json({ error: 'server_error' }, { status: 500 })
  }
}
