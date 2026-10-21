import {
  degToDir,
  faceSegment,
  FILTER_HALF,
  MIRROR_HALF,
  prismCorners,
  RECEIVER_R,
  rectCorners,
  SPLITTER_HALF,
  TUBE,
  toBoard,
} from './pieces'
import { COLOR_BITS, type LevelDef, type Piece } from './schema'
import type { BeamSegment, TraceResult, Vec2 } from './types'

const MAX_SEGMENTS = 400
const MAX_DEPTH = 48
const EPS = 1e-6

/** Refractive index per colour bit. Exaggerated so prisms fan colours out visibly. */
const PRISM_N: Record<number, number> = { [COLOR_BITS.red]: 1.46, [COLOR_BITS.green]: 1.56, [COLOR_BITS.blue]: 1.68 }
const GLASS_N = 1.5

type SurfaceKind = 'mirror' | 'double' | 'split' | 'filter' | 'absorb' | 'refract' | 'tube-wall'

type Surface = {
  a: Vec2
  b: Vec2
  kind: SurfaceKind
  piece?: Piece
  /** Unit normal: the reflective side for mirrors, outward for polygons. */
  n: Vec2
  filterMask?: number
}

type Sensor = { piece: Extract<Piece, { type: 'receiver' | 'tube' }>; c: Vec2; r: number }

type Ray = {
  x: number
  y: number
  dx: number
  dy: number
  mask: number
  /** Piece whose glass the ray is travelling through, if any. */
  medium: Piece | null
  d0: number
  depth: number
  from: Surface | null
}

function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y }
}

function unit(v: Vec2): Vec2 {
  const l = Math.hypot(v.x, v.y) || 1
  return { x: v.x / l, y: v.y / l }
}

function polygonSurfaces(corners: Vec2[], kind: SurfaceKind, piece?: Piece): Surface[] {
  const cx = corners.reduce((s, p) => s + p.x, 0) / corners.length
  const cy = corners.reduce((s, p) => s + p.y, 0) / corners.length
  return corners.map((a, i) => {
    const b = corners[(i + 1) % corners.length]
    let n = unit({ x: -(b.y - a.y), y: b.x - a.x })
    const mx = (a.x + b.x) / 2 - cx
    const my = (a.y + b.y) / 2 - cy
    if (n.x * mx + n.y * my < 0) n = { x: -n.x, y: -n.y }
    return { a, b, kind, piece, n }
  })
}

function buildScene(level: LevelDef, pieces: Piece[]) {
  const surfaces: Surface[] = []
  const sensors: Sensor[] = []
  for (const p of pieces) {
    switch (p.type) {
      case 'mirror':
      case 'double-mirror': {
        const [a, b] = faceSegment(p, MIRROR_HALF)
        surfaces.push({ a, b, kind: p.type === 'mirror' ? 'mirror' : 'double', piece: p, n: degToDir(p.angle) })
        break
      }
      case 'splitter': {
        const [a, b] = faceSegment(p, SPLITTER_HALF)
        surfaces.push({ a, b, kind: 'split', piece: p, n: degToDir(p.angle) })
        break
      }
      case 'filter': {
        const [a, b] = faceSegment(p, FILTER_HALF)
        surfaces.push({ a, b, kind: 'filter', piece: p, n: degToDir(p.angle), filterMask: COLOR_BITS[p.color] })
        break
      }
      case 'prism':
        surfaces.push(...polygonSurfaces(prismCorners(p, p.size), 'refract', p))
        break
      case 'glass':
        surfaces.push(...polygonSurfaces(rectCorners(p, p.w, p.h), 'refract', p))
        break
      case 'wall':
        surfaces.push(...polygonSurfaces(rectCorners(p, p.w, p.h), 'absorb', p))
        break
      case 'receiver':
        sensors.push({ piece: p, c: { x: p.x, y: p.y }, r: RECEIVER_R })
        break
      case 'tube': {
        // Open mouth faces the tube's angle; side walls and back block anything off-axis.
        const L = TUBE.length / 2
        const W = TUBE.width / 2
        const back = [toBoard(p, -L, -W), toBoard(p, -L, W)] as const
        const left = [toBoard(p, -L, -W), toBoard(p, L, -W)] as const
        const right = [toBoard(p, -L, W), toBoard(p, L, W)] as const
        for (const [a, b] of [back, left, right]) surfaces.push({ a, b, kind: 'tube-wall', piece: p, n: unit(sub(b, a)) })
        sensors.push({ piece: p, c: toBoard(p, -L + TUBE.sensorR + 4, 0), r: TUBE.sensorR })
        break
      }
      case 'laser':
        break
    }
  }
  // Board edges absorb.
  surfaces.push(
    ...polygonSurfaces(
      [
        { x: 0, y: 0 },
        { x: 0, y: level.height },
        { x: level.width, y: level.height },
        { x: level.width, y: 0 },
      ],
      'absorb',
    ),
  )
  return { surfaces, sensors }
}

function bits(mask: number): number[] {
  return [COLOR_BITS.red, COLOR_BITS.green, COLOR_BITS.blue].filter((b) => mask & b)
}

function indexFor(piece: Piece, mask: number) {
  if (piece.type !== 'prism') return GLASS_N
  const b = bits(mask)
  return b.reduce((s, k) => s + PRISM_N[k], 0) / b.length
}

/**
 * Traces every laser through the board. Beams branch at splitters and prisms, so the result is
 * a flat list of segments, each tagged with its colour and its distance from the laser.
 */
export function trace(level: LevelDef, pieces: Piece[] = level.pieces): TraceResult {
  const { surfaces, sensors } = buildScene(level, pieces)
  const segments: BeamSegment[] = []
  const lit = new Map<string, number>()
  const hits = new Set<string>()
  const queue: Ray[] = []

  for (const p of pieces) {
    if (p.type !== 'laser') continue
    const d = degToDir(p.angle)
    queue.push({ x: p.x, y: p.y, dx: d.x, dy: d.y, mask: COLOR_BITS[p.color], medium: null, d0: 0, depth: 0, from: null })
  }

  while (queue.length && segments.length < MAX_SEGMENTS) {
    const ray = queue.shift()!
    if (ray.depth > MAX_DEPTH) continue

    let best = Infinity
    let hit: Surface | null = null
    for (const s of surfaces) {
      if (s === ray.from) continue
      const ex = s.b.x - s.a.x
      const ey = s.b.y - s.a.y
      const den = ray.dx * ey - ray.dy * ex
      if (Math.abs(den) < 1e-12) continue
      const t = ((s.a.x - ray.x) * ey - (s.a.y - ray.y) * ex) / den
      const u = ((s.a.x - ray.x) * ray.dy - (s.a.y - ray.y) * ray.dx) / den
      if (t > EPS && u >= 0 && u <= 1 && t < best) {
        best = t
        hit = s
      }
    }

    let sensor: Sensor | null = null
    for (const sn of sensors) {
      const fx = sn.c.x - ray.x
      const fy = sn.c.y - ray.y
      const tc = fx * ray.dx + fy * ray.dy
      if (tc <= 0) continue
      const d2 = fx * fx + fy * fy - tc * tc
      if (d2 >= sn.r * sn.r) continue
      const th = tc - Math.sqrt(sn.r * sn.r - d2)
      if (th > EPS && th < best) {
        best = th
        sensor = sn
        hit = null
      }
    }

    if (!Number.isFinite(best)) continue
    const x = ray.x + ray.dx * best
    const y = ray.y + ray.dy * best
    const d1 = ray.d0 + best
    segments.push({ x1: ray.x, y1: ray.y, x2: x, y2: y, mask: ray.mask, d0: ray.d0, d1 })

    const next = (dx: number, dy: number, extra: Partial<Ray> = {}) =>
      queue.push({ ...ray, x, y, dx, dy, d0: d1, depth: ray.depth + 1, from: hit, ...extra })

    if (sensor) {
      const p = sensor.piece
      hits.add(p.id)
      if (!p.color || COLOR_BITS[p.color] === ray.mask) lit.set(p.id, Math.max(lit.get(p.id) ?? 0, d1))
      continue
    }
    if (!hit) continue
    if (hit.piece) hits.add(hit.piece.id)

    const dot = ray.dx * hit.n.x + ray.dy * hit.n.y
    const reflect = () => next(ray.dx - 2 * dot * hit.n.x, ray.dy - 2 * dot * hit.n.y)

    switch (hit.kind) {
      case 'absorb':
      case 'tube-wall':
        break
      case 'mirror':
        // Only the face the angle points to is silvered.
        if (dot < 0) reflect()
        break
      case 'double':
        reflect()
        break
      case 'split':
        reflect()
        next(ray.dx, ray.dy)
        break
      case 'filter': {
        const mask = ray.mask & hit.filterMask!
        if (mask) next(ray.dx, ray.dy, { mask })
        break
      }
      case 'refract': {
        const piece = hit.piece!
        const entering = ray.medium !== piece
        // Mixed light entering a prism fans out into one ray per colour.
        const parts = entering && piece.type === 'prism' && bits(ray.mask).length > 1 ? bits(ray.mask) : [ray.mask]
        for (const mask of parts) {
          const nGlass = indexFor(piece, mask)
          const n1 = entering ? 1 : nGlass
          const n2 = entering ? nGlass : 1
          // Normal facing against the incoming ray.
          let nx = hit.n.x
          let ny = hit.n.y
          let cosi = -(ray.dx * nx + ray.dy * ny)
          if (cosi < 0) {
            nx = -nx
            ny = -ny
            cosi = -cosi
          }
          const eta = n1 / n2
          const k = 1 - eta * eta * (1 - cosi * cosi)
          if (k < 0) {
            // Total internal reflection: stays inside the glass.
            next(ray.dx + 2 * cosi * nx, ray.dy + 2 * cosi * ny, { mask })
          } else {
            const f = eta * cosi - Math.sqrt(k)
            const out = unit({ x: eta * ray.dx + f * nx, y: eta * ray.dy + f * ny })
            next(out.x, out.y, { mask, medium: entering ? piece : null })
          }
        }
        break
      }
    }
  }

  return { segments, lit, hits }
}

export function receivers(pieces: Piece[]) {
  return pieces.filter((p) => p.type === 'receiver' || p.type === 'tube')
}

export function isSolved(pieces: Piece[], result: TraceResult): boolean {
  const goals = receivers(pieces)
  return (
    goals.length > 0 &&
    goals.every((r) => result.lit.has(r.id)) &&
    pieces.every((p) => !p.mustHit || result.hits.has(p.id))
  )
}
