import { describe, expect, it } from 'vitest'
import { applyPlacements } from './levelTools'
import { LEVELS } from './levels'
import { collides, footprint, polygonsOverlap } from './pieces'
import { PieceSchema } from './schema'

const piece = (p: Record<string, unknown>) => PieceSchema.parse({ id: 'x', x: 0, y: 0, ...p })

describe('collisions', () => {
  it('detects overlapping and separate polygons, and lets edges touch', () => {
    const sq = (x: number) => [
      { x, y: 0 },
      { x: x + 10, y: 0 },
      { x: x + 10, y: 10 },
      { x, y: 10 },
    ]
    expect(polygonsOverlap(sq(0), sq(5))).toBe(true)
    expect(polygonsOverlap(sq(0), sq(10))).toBe(false)
    expect(polygonsOverlap(sq(0), sq(20))).toBe(false)
  })

  it('uses rotated footprints, so a thin mirror fits beside a wall', () => {
    const wall = piece({ id: 'w', type: 'wall', x: 100, y: 100, w: 40, h: 100 })
    const near = piece({ id: 'm', type: 'mirror', x: 130, y: 100, angle: 0 })
    const inside = piece({ id: 'm', type: 'mirror', x: 110, y: 100, angle: 0 })
    expect(collides(near, [wall])).toBe(false)
    expect(collides(inside, [wall])).toBe(true)
  })

  it('every footprint is a proper polygon', () => {
    for (const type of PieceSchema.options.map((o) => o.shape.type.value)) {
      expect(footprint(piece({ type })).length, type).toBeGreaterThanOrEqual(3)
    }
  })

  for (const level of LEVELS) {
    it(`${level.id} has no overlapping pieces, at the start or solved`, () => {
      for (const pieces of [level.pieces, applyPlacements(level.pieces, level.solution ?? {})]) {
        for (const p of pieces) expect(collides(p, pieces), p.id).toBe(false)
      }
    })
  }
})
