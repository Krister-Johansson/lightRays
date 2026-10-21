// Board coordinates are design pixels: x to the right, y down, origin top-left.
// Angles are degrees, counter-clockwise as seen on screen (0° points right).

export type Vec2 = { x: number; y: number }

export type { LevelDef, MirrorDef, WallDef } from './schema'

export type TraceResult = {
  points: Vec2[]
  lit: boolean
  hits: Set<string>
}
