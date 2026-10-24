// Board coordinates are design pixels: x to the right, y down, origin top-left.
// Angles are degrees, counter-clockwise as seen on screen (0° points right).

export type Vec2 = { x: number; y: number }

export type { LevelDef, Piece, PieceType } from './schema'

export type BeamSegment = {
  x1: number
  y1: number
  x2: number
  y2: number
  /** RGB colour bits of the light on this segment. */
  mask: number
  /** Distance travelled from the laser at the start and end of the segment. */
  d0: number
  d1: number
}

export type TraceResult = {
  segments: BeamSegment[]
  /** Lit receivers, with the beam distance at which light arrives. */
  lit: Map<string, number>
  /** Every piece a beam touched. */
  hits: Set<string>
  /** Test figures a beam touched: the test fails. */
  zapped: Set<string>
}
