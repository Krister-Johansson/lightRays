// Board coordinates are design pixels: x to the right, y down, origin top-left.
// Angles are degrees, counter-clockwise as seen on screen (0° points right).

export type Vec2 = { x: number; y: number }

export type MirrorDef = {
  id: string
  x: number
  y: number
  /** Normal direction of the reflective face, in degrees. */
  angle: number
  /** Fixed mirrors can't be rotated by the player. */
  fixed?: boolean
  /** The beam must bounce off this mirror for the level to count as solved. */
  mustHit?: boolean
}

export type WallDef = { x: number; y: number; w: number; h: number }

export type LevelDef = {
  id: string
  name: string
  /** Fewest moves a tidy solution needs. */
  par: number
  width: number
  height: number
  laser: { x: number; y: number; angle: number; color: string }
  receiver: { x: number; y: number; r: number }
  mirrors: MirrorDef[]
  walls: WallDef[]
}

export type TraceResult = {
  points: Vec2[]
  lit: boolean
  hits: Set<string>
}
