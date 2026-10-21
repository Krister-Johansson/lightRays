import { COLOR_BITS, type ColorName, type Piece, type PieceType } from './schema'
import type { Vec2 } from './types'

// Shared piece geometry, in board pixels. The tracer and the 3D scene both read these so what
// you see is exactly what the light hits.

export const MIRROR_HALF = 30
export const SPLITTER_HALF = 28
export const FILTER_HALF = 26
export const RECEIVER_R = 22
export const TUBE = { length: 64, width: 40, sensorR: 14 }
export const GRID = 20

export type PieceInfo = {
  label: string
  group: 'Sources' | 'Optics' | 'Goals and terrain'
  blurb: string
  rotatable: boolean
  resizable: boolean
}

export const PIECE_INFO: Record<PieceType, PieceInfo> = {
  laser: { label: 'Laser', group: 'Sources', blurb: 'Emits a beam in its colour', rotatable: true, resizable: false },
  mirror: { label: 'Mirror', group: 'Optics', blurb: 'One shiny side. The back absorbs', rotatable: true, resizable: false },
  'double-mirror': { label: 'Double mirror', group: 'Optics', blurb: 'Reflects on both faces', rotatable: true, resizable: false },
  splitter: { label: 'Splitter', group: 'Optics', blurb: 'Half passes, half reflects', rotatable: true, resizable: false },
  prism: { label: 'Prism', group: 'Optics', blurb: 'Bends light and splits mixed colours', rotatable: true, resizable: false },
  filter: { label: 'Colour filter', group: 'Optics', blurb: 'Only its colour gets through', rotatable: true, resizable: false },
  glass: { label: 'Glass block', group: 'Optics', blurb: 'Bends the beam, leaves it parallel', rotatable: true, resizable: true },
  receiver: { label: 'Open receiver', group: 'Goals and terrain', blurb: 'Lit from any side', rotatable: false, resizable: false },
  tube: { label: 'Tube receiver', group: 'Goals and terrain', blurb: 'Beam must enter the mouth head-on', rotatable: true, resizable: false },
  wall: { label: 'Wall', group: 'Goals and terrain', blurb: 'Blocks light', rotatable: false, resizable: true },
}

export const PIECE_TYPES = Object.keys(PIECE_INFO) as PieceType[]

export const COLOR_HEX: Record<number, string> = {
  [COLOR_BITS.red]: '#FF5A4E',
  [COLOR_BITS.green]: '#45E08A',
  [COLOR_BITS.blue]: '#4FA8FF',
  [COLOR_BITS.yellow]: '#FFC940',
  [COLOR_BITS.magenta]: '#E36BFF',
  [COLOR_BITS.cyan]: '#4FE3E0',
  [COLOR_BITS.white]: '#FFF4D6',
}

export const colorHex = (c: ColorName) => COLOR_HEX[COLOR_BITS[c]]

export function degToDir(deg: number): Vec2 {
  const r = (deg * Math.PI) / 180
  return { x: Math.cos(r), y: -Math.sin(r) }
}

/** Rotates a local offset (x right, y down) by the piece angle and moves it to the piece centre. */
export function toBoard(p: { x: number; y: number; angle: number }, lx: number, ly: number): Vec2 {
  const r = (p.angle * Math.PI) / 180
  const c = Math.cos(r)
  const s = Math.sin(r)
  // Screen-space CCW rotation with y pointing down.
  return { x: p.x + lx * c + ly * s, y: p.y - lx * s + ly * c }
}

/** Ends of a flat optic (mirror, splitter, filter): the face runs perpendicular to its angle. */
export function faceSegment(p: Piece, half: number): [Vec2, Vec2] {
  return [toBoard(p, 0, -half), toBoard(p, 0, half)]
}

/** Corners of a rectangle piece, counter-clockwise on screen. */
export function rectCorners(p: { x: number; y: number; angle: number }, w: number, h: number): Vec2[] {
  return [
    toBoard(p, -w / 2, -h / 2),
    toBoard(p, -w / 2, h / 2),
    toBoard(p, w / 2, h / 2),
    toBoard(p, w / 2, -h / 2),
  ]
}

/** Equilateral triangle, one vertex pointing along the prism's angle. */
export function prismCorners(p: { x: number; y: number; angle: number }, size: number): Vec2[] {
  const r = size / Math.sqrt(3)
  return [0, 120, 240].map((a) => {
    const t = (a * Math.PI) / 180
    return toBoard(p, Math.cos(t) * r, -Math.sin(t) * r)
  })
}

export function halfSize(p: Piece): { w: number; h: number } {
  switch (p.type) {
    case 'wall':
    case 'glass':
      return { w: p.w / 2, h: p.h / 2 }
    case 'prism':
      return { w: p.size / 2, h: p.size / 2 }
    case 'laser':
      return { w: 30, h: 24 }
    case 'tube':
      return { w: TUBE.length / 2, h: TUBE.width / 2 }
    default:
      return { w: 32, h: 32 }
  }
}
