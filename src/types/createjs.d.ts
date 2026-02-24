declare namespace createjs {
  class EventDispatcher {
    addEventListener(type: string, listener: (event: Event) => void): void
    removeEventListener(type: string, listener: (event: Event) => void): void
    removeAllEventListeners(type?: string): void
    dispatchEvent(event: Event | string): boolean
    on(type: string, listener: (event: MouseEvent | Event) => void): object
    off(type: string, listener: (event: Event) => void): void
  }

  class DisplayObject extends EventDispatcher {
    x: number
    y: number
    alpha: number
    scaleX: number
    scaleY: number
    rotation: number
    visible: boolean
    cursor: string
    hitArea: DisplayObject | null
    parent: Container | null
    getBounds(): { x: number; y: number; width: number; height: number } | null
  }

  class Container extends DisplayObject {
    addChild(...children: DisplayObject[]): DisplayObject
    removeChild(...children: DisplayObject[]): boolean
    removeAllChildren(): void
    getChildAt(index: number): DisplayObject
    numChildren: number
    children: DisplayObject[]
  }

  class Stage extends Container {
    constructor(canvas: HTMLCanvasElement | string)
    update(event?: Event): void
    clear(): void
    enableMouseOver(frequency?: number): void
    canvas: HTMLCanvasElement
  }

  class Shape extends DisplayObject {
    graphics: Graphics
    constructor(graphics?: Graphics)
  }

  class Text extends DisplayObject {
    constructor(text?: string, font?: string, color?: string)
    text: string
    font: string
    color: string
    textAlign: string
    textBaseline: string
    lineHeight: number
    lineWidth: number
    getMeasuredWidth(): number
    getMeasuredHeight(): number
  }

  class Graphics {
    beginFill(color: string): Graphics
    endFill(): Graphics
    beginStroke(color: string): Graphics
    setStrokeStyle(thickness: number, caps?: string | number, joints?: string | number, miterLimit?: number): Graphics
    endStroke(): Graphics
    drawRect(x: number, y: number, w: number, h: number): Graphics
    drawRoundRect(x: number, y: number, w: number, h: number, radius: number): Graphics
    drawCircle(x: number, y: number, radius: number): Graphics
    drawEllipse(x: number, y: number, w: number, h: number): Graphics
    moveTo(x: number, y: number): Graphics
    lineTo(x: number, y: number): Graphics
    curveTo(cpx: number, cpy: number, x: number, y: number): Graphics
    clear(): Graphics
    beginLinearGradientFill(colors: string[], ratios: number[], x0: number, y0: number, x1: number, y1: number): Graphics
    beginRadialGradientFill(colors: string[], ratios: number[], x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): Graphics
    closePath(): Graphics
    decodePath(str: string): Graphics
  }

  class Bitmap extends DisplayObject {
    constructor(imageOrUri: HTMLImageElement | HTMLCanvasElement | string)
    image: HTMLImageElement | HTMLCanvasElement
  }

  class MouseEvent extends EventDispatcher {
    stageX: number
    stageY: number
    localX: number
    localY: number
    target: DisplayObject
    nativeEvent: PointerEvent | MouseEvent | TouchEvent
    pointerID: number
    primary: boolean
    preventDefault(): void
  }

  namespace Ticker {
    let timingMode: string
    let framerate: number
    const RAF_SYNCHED: string
    const RAF: string
    const TIMEOUT: string
    function addEventListener(type: string, listener: (event: { delta: number; paused: boolean; time: number }) => void): void
    function removeAllEventListeners(type?: string): void
    function on(type: string, listener: (event: { delta: number }) => void): object
    function off(type: string, listener: object): void
    function getTime(runTime?: boolean): number
    function getFPS(): number
  }

  namespace Touch {
    function enable(stage: Stage, singleTouch?: boolean, allowDefault?: boolean): boolean
    function disable(stage: Stage): void
    function isSupported(): boolean
  }
}

declare module '@createjs/easeljs' {
  export = createjs
}
