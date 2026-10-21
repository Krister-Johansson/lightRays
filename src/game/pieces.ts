import { COLOR_BITS, type ColorName, type Piece, type PieceType } from './schema'
import type { Vec2 } from './types'

// Shared piece geometry, in board pixels. The tracer and the 3D scene both read these so what
// you see is exactly what the light hits.

export const MIRROR_HALF = 30
export const LENS_HALF = 34
export const PLATE_HALF = 28
export const RETRO_HALF = 26
export const CONCAVE_HALF = 36
export const RHOMBOID_WIDTH = 36
export const WEDGE = { h: 70, t: 24 }
export const SPLITTER_HALF = 28
export const FILTER_HALF = 26
export const RECEIVER_R = 22
export const TUBE = { length: 64, width: 40, sensorR: 14 }
export const GRID = 20

export const PIECE_GROUPS = ['Sources', 'Reflect', 'Split', 'Prisms and lenses', 'Colour and polarisation', 'Goals and terrain'] as const

export type PieceInfo = {
  label: string
  group: (typeof PIECE_GROUPS)[number]
  blurb: string
  rotatable: boolean
  resizable: boolean
}

const info = (label: string, group: PieceInfo['group'], blurb: string, extra: Partial<PieceInfo> = {}): PieceInfo => ({
  label,
  group,
  blurb,
  rotatable: true,
  resizable: false,
  ...extra,
})

export const PIECE_INFO: Record<PieceType, PieceInfo> = {
  laser: info('Laser', 'Sources', 'Emits a beam in its colour'),
  mirror: info('Mirror', 'Reflect', 'One shiny side. The back absorbs'),
  'double-mirror': info('Double mirror', 'Reflect', 'Reflects on both faces'),
  retro: info('Retroreflector', 'Reflect', 'Sends any beam straight back where it came from'),
  concave: info('Concave mirror', 'Reflect', 'Parallel beams bounce back and meet at the focus'),
  splitter: info('Splitter', 'Split', 'Half passes, half reflects'),
  dichroic: info('Dichroic mirror', 'Split', 'Reflects its colour, lets the others through'),
  grating: info('Grating', 'Split', 'Splits a beam in three: straight on and one each side'),
  prism: info('Prism', 'Prisms and lenses', 'Bends light and splits mixed colours'),
  'right-prism': info('Right-angle prism', 'Prisms and lenses', 'Turns a beam 90°, or U-turns it off the long face'),
  rhomboid: info('Rhomboid prism', 'Prisms and lenses', 'Periscope in glass: shifts a beam sideways'),
  wedge: info('Wedge prism', 'Prisms and lenses', 'Bends a beam by about 10°'),
  'convex-lens': info('Convex lens', 'Prisms and lenses', 'Bends beams toward its focus'),
  'concave-lens': info('Concave lens', 'Prisms and lenses', 'Spreads beams apart'),
  glass: info('Glass block', 'Prisms and lenses', 'Bends the beam, leaves it parallel', { resizable: true }),
  filter: info('Colour filter', 'Colour and polarisation', 'Only its colour gets through'),
  gate: info('Colour gate', 'Colour and polarisation', 'Only beams of its colour pass. The rest stop', { resizable: true }),
  polariser: info('Polariser', 'Colour and polarisation', 'Polarises light. Blocks light polarised the other way'),
  waveplate: info('Wave plate', 'Colour and polarisation', 'Turns polarisation 90°'),
  receiver: info('Open receiver', 'Goals and terrain', 'Lit from any side', { rotatable: false }),
  tube: info('Tube receiver', 'Goals and terrain', 'Beam must enter the mouth head-on'),
  wall: info('Wall', 'Goals and terrain', 'Blocks light', { rotatable: false, resizable: true }),
}

/** Pieces with a width and height the editor can drag to resize. */
export type SizedPiece = Extract<Piece, { w: number; h: number }>
export const isSized = (p: Piece): p is SizedPiece => PIECE_INFO[p.type].resizable

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
  const h = half * scaleOf(p)
  return [toBoard(p, 0, -h), toBoard(p, 0, h)]
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

/** 45-45-90 triangle with legs of `size`; the long face points along the piece angle. */
export function rightPrismLocal(size: number): Vec2[] {
  const k = size / Math.SQRT2
  return [
    { x: (-2 * k) / 3, y: 0 },
    { x: k / 3, y: k },
    { x: k / 3, y: -k },
  ]
}

/** Parallelogram with 45° ends. A beam entering a long side next to one end leaves `length` further along. */
export function rhomboidLocal(length: number): Vec2[] {
  const L = length / 2
  const w = RHOMBOID_WIDTH / 2
  return [
    { x: -L - w, y: -w },
    { x: L - w, y: -w },
    { x: L + w, y: w },
    { x: -L + w, y: w },
  ]
}

/** Thin right-angle wedge: flat back facing away from the angle, slanted front. */
export function wedgeLocal(): Vec2[] {
  const { h, t } = WEDGE
  return [
    { x: -t / 2, y: -h / 2 },
    { x: -t / 2, y: h / 2 },
    { x: t / 2, y: -h / 2 },
  ]
}

/** Points along a concave mirror, vertex at the centre, curving toward the angle. */
export function concaveLocal(focal: number, scale = 1, steps = 12): Vec2[] {
  const half = CONCAVE_HALF * scale
  const R = Math.max(focal * 2, half * 1.05)
  return Array.from({ length: steps + 1 }, (_, i) => {
    const ly = -half + (2 * half * i) / steps
    return { x: R - Math.sqrt(R * R - ly * ly), y: ly }
  })
}

/** Outline of a polygon piece in its own frame (x along the angle, y down), or null for flat optics. */
export function localPolygon(p: Piece): Vec2[] | null {
  const k = scaleOf(p)
  return unscaledPolygon(p)?.map((v) => ({ x: v.x * k, y: v.y * k })) ?? null
}

function unscaledPolygon(p: Piece): Vec2[] | null {
  switch (p.type) {
    case 'prism':
      return prismCorners({ x: 0, y: 0, angle: 0 }, p.size)
    case 'right-prism':
      return rightPrismLocal(p.size)
    case 'rhomboid':
      return rhomboidLocal(p.length)
    case 'wedge':
      return wedgeLocal()
    case 'glass':
    case 'wall':
    case 'gate':
      return rectCorners({ x: 0, y: 0, angle: 0 }, p.w, p.h)
    default:
      return null
  }
}

/** The polygon outline in board coordinates. */
export function boardPolygon(p: Piece): Vec2[] | null {
  return localPolygon(p)?.map((v) => toBoard(p, v.x, v.y)) ?? null
}

/** Size multiplier; pieces without one are 1. */
export const scaleOf = (p: Piece) => p.scale ?? 1

/** Optics the editor can resize with the end handles: everything but sources, goals and w×h pieces. */
export const canScale = (p: Piece) => !['laser', 'receiver', 'tube'].includes(p.type) && !isSized(p)

/** Whether the player may turn the piece in play. */
export const playerCanRotate = (p: Piece) => PIECE_INFO[p.type].rotatable && (p.rotate ?? p.lock !== 'fixed')

/** Whether the piece can be resized at all (editor), and by the player in play. */
export const resizable = (p: Piece) => isSized(p) || canScale(p)
export const playerCanResize = (p: Piece) => resizable(p) && !!p.resize

/** Half the piece's length along its face (local y) at scale 1, where the resize handles sit. */
export function baseSpan(p: Piece): number {
  return Math.max(...footprint({ ...p, x: 0, y: 0, angle: 0, scale: 1 }).map((v) => Math.abs(v.y)))
}

export function halfSize(p: Piece): { w: number; h: number } {
  const k = canScale(p) ? scaleOf(p) : 1
  const { w, h } = unscaledHalfSize(p)
  return { w: w * k, h: h * k }
}

function unscaledHalfSize(p: Piece): { w: number; h: number } {
  switch (p.type) {
    case 'wall':
    case 'glass':
    case 'gate':
      return { w: p.w / 2, h: p.h / 2 }
    case 'prism':
    case 'right-prism':
      return { w: p.size / 2, h: p.size / 2 }
    case 'rhomboid':
      return { w: p.length / 2 + RHOMBOID_WIDTH / 2, h: RHOMBOID_WIDTH / 2 }
    case 'laser':
      return { w: 30, h: 24 }
    case 'tube':
      return { w: TUBE.length / 2, h: TUBE.width / 2 }
    default:
      return { w: 32, h: 32 }
  }
}

/** Convex outline of the space a piece takes up on the board, used to stop pieces overlapping. */
export function footprint(p: Piece): Vec2[] {
  // Flat optics grow along their face; the splitter cube grows both ways.
  const k = scaleOf(p)
  const rect = (w: number, h: number, ox = 0) => rectCorners({ ...p, ...toBoard(p, ox, 0) }, w, h * k)
  const poly = boardPolygon(p)
  if (poly) return poly
  switch (p.type) {
    case 'laser':
      return rect(60, 40, -26)
    case 'receiver':
      return Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2
        return { x: p.x + Math.cos(a) * (RECEIVER_R + 2), y: p.y + Math.sin(a) * (RECEIVER_R + 2) }
      })
    case 'tube':
      return rect(TUBE.length, TUBE.width)
    case 'concave':
      return rect(24, CONCAVE_HALF * 2, 6)
    case 'retro':
      return rect(20, RETRO_HALF * 2, -3)
    case 'splitter':
      return rect(SPLITTER_HALF * Math.SQRT2 * k, SPLITTER_HALF * Math.SQRT2)
    case 'convex-lens':
    case 'concave-lens':
      return rect(24, LENS_HALF * 2)
    case 'double-mirror':
      return rect(12, MIRROR_HALF * 2)
    default:
      return rect(10, Math.max(MIRROR_HALF, PLATE_HALF) * 2)
  }
}

/** Separating-axis test for two convex polygons. Touching edges don't count as overlap. */
export function polygonsOverlap(a: Vec2[], b: Vec2[], tolerance = 0.5): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i]
      const q = poly[(i + 1) % poly.length]
      const nx = -(q.y - p.y)
      const ny = q.x - p.x
      const len = Math.hypot(nx, ny) || 1
      const project = (vs: Vec2[]) => {
        let min = Infinity
        let max = -Infinity
        for (const v of vs) {
          const d = (v.x * nx + v.y * ny) / len
          min = Math.min(min, d)
          max = Math.max(max, d)
        }
        return [min, max]
      }
      const [amin, amax] = project(a)
      const [bmin, bmax] = project(b)
      if (amax - bmin <= tolerance || bmax - amin <= tolerance) return false
    }
  }
  return true
}

/** True if `piece` overlaps any of `others` (itself excluded by id). */
export function collides(piece: Piece, others: Piece[]): boolean {
  const mine = footprint(piece)
  return others.some((o) => o.id !== piece.id && polygonsOverlap(mine, footprint(o)))
}
