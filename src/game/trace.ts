import type { LevelDef, TraceResult, Vec2 } from './types'

export const MIRROR_HALF_LENGTH = 30
const MAX_BOUNCES = 32

type Segment = { x1: number; y1: number; x2: number; y2: number; mirror?: string }

export function degToDir(deg: number): Vec2 {
  const r = (deg * Math.PI) / 180
  return { x: Math.cos(r), y: -Math.sin(r) }
}

function mirrorSegment(x: number, y: number, angle: number, id: string): Segment {
  // The reflective face runs perpendicular to its normal.
  const d = degToDir(angle + 90)
  return {
    x1: x - d.x * MIRROR_HALF_LENGTH,
    y1: y - d.y * MIRROR_HALF_LENGTH,
    x2: x + d.x * MIRROR_HALF_LENGTH,
    y2: y + d.y * MIRROR_HALF_LENGTH,
    mirror: id,
  }
}

function rectSegments(x: number, y: number, w: number, h: number): Segment[] {
  const r = x + w
  const b = y + h
  return [
    { x1: x, y1: y, x2: r, y2: y },
    { x1: r, y1: y, x2: r, y2: b },
    { x1: r, y1: b, x2: x, y2: b },
    { x1: x, y1: b, x2: x, y2: y },
  ]
}

/** Traces the laser through the level with the given mirror angles. */
export function trace(level: LevelDef, angles: Record<string, number>): TraceResult {
  const segs: Segment[] = [
    ...level.mirrors.map((m) => mirrorSegment(m.x, m.y, angles[m.id] ?? m.angle, m.id)),
    ...level.walls.flatMap((w) => rectSegments(w.x, w.y, w.w, w.h)),
    ...rectSegments(0, 0, level.width, level.height),
  ]
  const rc = level.receiver
  const dir = degToDir(level.laser.angle)
  let px = level.laser.x
  let py = level.laser.y
  let dx = dir.x
  let dy = dir.y
  let last: Segment | null = null
  const points: Vec2[] = [{ x: px, y: py }]
  const hits = new Set<string>()
  let lit = false

  for (let i = 0; i < MAX_BOUNCES; i++) {
    let best = Infinity
    let hit: Segment | null = null
    for (const s of segs) {
      if (s === last) continue
      const ex = s.x2 - s.x1
      const ey = s.y2 - s.y1
      const den = dx * ey - dy * ex
      if (Math.abs(den) < 1e-9) continue
      const t = ((s.x1 - px) * ey - (s.y1 - py) * ex) / den
      const u = ((s.x1 - px) * dy - (s.y1 - py) * dx) / den
      if (t > 1e-6 && u >= 0 && u <= 1 && t < best) {
        best = t
        hit = s
      }
    }

    // Receiver is a circle; check it before the nearest segment.
    const fx = rc.x - px
    const fy = rc.y - py
    const tc = fx * dx + fy * dy
    if (tc > 0) {
      const d2 = fx * fx + fy * fy - tc * tc
      if (d2 < rc.r * rc.r) {
        const th = tc - Math.sqrt(rc.r * rc.r - d2)
        if (th < best) {
          points.push({ x: px + dx * th, y: py + dy * th })
          lit = true
          break
        }
      }
    }

    if (!hit) break
    px += dx * best
    py += dy * best
    points.push({ x: px, y: py })
    if (!hit.mirror) break

    hits.add(hit.mirror)
    const ex = hit.x2 - hit.x1
    const ey = hit.y2 - hit.y1
    const len = Math.hypot(ex, ey)
    const ux = ex / len
    const uy = ey / len
    const dot = dx * ux + dy * uy
    dx = 2 * dot * ux - dx
    dy = 2 * dot * uy - dy
    last = hit
  }

  return { points, lit, hits }
}

export function isSolved(level: LevelDef, result: TraceResult): boolean {
  return result.lit && level.mirrors.every((m) => !m.mustHit || result.hits.has(m.id))
}
