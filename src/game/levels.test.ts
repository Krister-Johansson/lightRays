import { describe, expect, it } from 'vitest'
import { LEVELS } from './levels'
import { isSolved, trace } from './trace'

const STEP = 0.5

function startAngles(level: (typeof LEVELS)[number]) {
  return Object.fromEntries(level.mirrors.map((m) => [m.id, m.angle]))
}

/** Brute-forces every free mirror at STEP° resolution and returns the first solution. */
function solve(level: (typeof LEVELS)[number]) {
  const free = level.mirrors.filter((m) => !m.fixed)
  const angles = startAngles(level)
  const search = (i: number): boolean => {
    if (i === free.length) return isSolved(level, trace(level, angles))
    for (let a = 0; a < 360; a += STEP) {
      angles[free[i].id] = a
      if (search(i + 1)) return true
    }
    return false
  }
  return search(0) ? { ...angles } : null
}

describe('levels', () => {
  for (const level of LEVELS) {
    it(`${level.id} is not solved at the start`, () => {
      expect(isSolved(level, trace(level, startAngles(level)))).toBe(false)
    })
    it(`${level.id} has a solution`, () => {
      expect(solve(level)).not.toBeNull()
    })
  }
})

describe('trace', () => {
  it('reflects off a 45° mirror', () => {
    const level = LEVELS[0]
    const r = trace(level, { A: 135 })
    expect(r.lit).toBe(true)
    expect(r.hits.has('A')).toBe(true)
  })
})
