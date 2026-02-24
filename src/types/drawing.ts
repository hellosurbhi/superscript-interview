export type DrawTool =
  | 'pencil'
  | 'brush'
  | 'highlighter'
  | 'eraser'
  | 'select'
  | 'rect'
  | 'circle'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'triangle'
  | 'text'
  | 'animate'

export type ShapeType = 'rect' | 'circle' | 'ellipse' | 'line' | 'arrow' | 'triangle'

export interface StrokePoint {
  x: number
  y: number
  pressure: number
}

export interface FreehandStroke {
  id: string
  points: StrokePoint[]
  color: string
  size: number
  opacity: number
  tool: Extract<DrawTool, 'pencil' | 'brush' | 'highlighter' | 'eraser'>
}

export interface TextStroke {
  id: string
  type: 'text'
  text: string
  x: number
  y: number
  fontSize: number
  color: string
}

export type CompletedStroke = FreehandStroke | TextStroke

export function isTextStroke(s: CompletedStroke): s is TextStroke {
  return (s as TextStroke).type === 'text'
}

// strokeWidth 1..60 → fontSize 12..72px (linear)
export function strokeWidthToFontSize(strokeWidth: number): number {
  return Math.round(12 + ((strokeWidth - 1) / 59) * 60)
}

export interface DrawingShape {
  id: string
  type: ShapeType
  x: number
  y: number
  width: number
  height: number
  fill: string
  stroke: string
  strokeWidth: number
  opacity: number
  selected: boolean
}

export interface CanvasTransform {
  scale: number
  translateX: number
  translateY: number
}

export interface DrawingState {
  activeTool: DrawTool
  activeColor: string
  strokeWidth: number
  opacity: number
  isDrawing: boolean
}

export const KEYBOARD_SHORTCUTS: Record<string, DrawTool> = {
  p: 'pencil',
  b: 'brush',
  h: 'highlighter',
  e: 'eraser',
  v: 'select',
  r: 'rect',
  c: 'circle',
  l: 'line',
  a: 'arrow',
  t: 'text',
}

export const TOOL_OPTIONS = {
  pencil: { size: 4, thinning: 0.5, smoothing: 0.5, streamline: 0.5 },
  brush: { size: 14, thinning: 0.7, smoothing: 0.6, streamline: 0.4 },
  highlighter: { size: 22, thinning: 0, smoothing: 0.8, streamline: 0.3 },
  eraser: { size: 18, thinning: 0, smoothing: 0.5, streamline: 0.5 },
} as const

export const PALETTE_COLORS = [
  '#000000', '#434343', '#666666', '#ffffff',
  '#ff0000', '#ff6600', '#ffff00', '#00ff00',
  '#f72585', '#0000ff', '#9900ff', '#ff00ff',
  '#ff4d94', '#ff006e', '#8338ec', '#06d6a0',
  '#ffd60a', '#fb5607', '#3a0ca3', '#ff85b3',
] as const

export const FREEHAND_TOOLS: DrawTool[] = ['pencil', 'brush', 'highlighter', 'eraser']
export const SHAPE_TOOLS: DrawTool[] = ['rect', 'circle', 'ellipse', 'line', 'arrow', 'triangle']
