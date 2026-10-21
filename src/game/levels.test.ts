import { describe, expect, it } from 'vitest'
import { boardPieces, solutionWorks } from './levelTools'
import { LEVELS } from './levels'
import { playerCanRotate } from './pieces'
import type { LevelDef, Piece } from './schema'
import { isSolved, trace } from './trace'

const STEP = 0.5

/** Brute-forces every rotatable piece at STEP° resolution. Only for levels without kit pieces. */
function bruteForce(level: LevelDef) {
  const pieces: Piece[] = level.pieces.map((p) => ({ ...p }))
  const free = pieces.filter((p) => p.lock !== 'kit' && playerCanRotate(p))
  const search = (i: number): boolean => {
    if (i === free.length) return isSolved(pieces, trace(level, pieces))
    for (let a = 0; a < 360; a += STEP) {
      free[i].angle = a
      if (search(i + 1)) return true
    }
    return false
  }
  return search(0)
}

describe('levels', () => {
  for (const level of LEVELS) {
    it(`${level.id} is not solved at the start`, () => {
      const start = boardPieces(level)
      expect(isSolved(start, trace(level, start))).toBe(false)
    })
    it(`${level.id} has a solution`, () => {
      if (level.solution) expect(solutionWorks(level)).toBe(true)
      else {
        expect(level.pieces.some((p) => p.lock === 'kit'), 'kit levels need a stored solution').toBe(false)
        expect(bruteForce(level)).toBe(true)
      }
    })
  }
})
