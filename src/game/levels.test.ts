import { describe, expect, it } from 'vitest'
import { applyPlacements, boardPieces, solutionWorks } from './levelTools'
import { LEVELS } from './levels'
import { distanceToSegment, FIGURE, playerCanRotate } from './pieces'
import type { LevelDef, Piece } from './schema'
import { isSolved, trace } from './trace'
import type { BeamSegment } from './types'

const STEP = 0.5

/** Brute-forces every rotatable piece at STEP° resolution. Only for levels without kit pieces. */
function bruteForce(level: LevelDef): Piece[] | null {
  const pieces: Piece[] = level.pieces.map((p) => ({ ...p }))
  const free = pieces.filter((p) => p.lock !== 'kit' && playerCanRotate(p))
  const search = (i: number): boolean => {
    if (i === free.length) return isSolved(pieces, trace(level, pieces)) && figuresSafe(pieces, trace(level, pieces).segments)
    for (let a = 0; a < 360; a += STEP) {
      free[i].angle = a
      if (search(i + 1)) return true
    }
    return false
  }
  return search(0) ? pieces : null
}

/** No beam crosses any part of a figure's walkway (checked every few px along it). */
function figuresSafe(pieces: Piece[], segments: BeamSegment[]) {
  return pieces.every((p) => {
    if (p.type !== 'scientist') return true
    const end = { x: p.x + Math.cos((p.angle * Math.PI) / 180) * p.walk, y: p.y - Math.sin((p.angle * Math.PI) / 180) * p.walk }
    for (let d = 0; d <= 1; d += 0.02) {
      const x = p.x + (end.x - p.x) * d
      const y = p.y + (end.y - p.y) * d
      if (segments.some((s) => distanceToSegment(x, y, s) < FIGURE.r)) return false
    }
    return true
  })
}

describe('levels', () => {
  for (const level of LEVELS) {
    it(`${level.id} is not solved at the start`, () => {
      const start = boardPieces(level)
      expect(isSolved(start, trace(level, start))).toBe(false)
    })
    it(`${level.id} has every test figure safe at the start`, () => {
      const start = boardPieces(level)
      expect(figuresSafe(start, trace(level, start).segments)).toBe(true)
    })
    it(`${level.id} has a solution`, () => {
      if (level.solution) {
        expect(solutionWorks(level)).toBe(true)
        const solved = applyPlacements(level.pieces, level.solution)
        expect(figuresSafe(solved, trace(level, solved).segments), 'a walking figure crosses the solved beam').toBe(true)
      } else {
        expect(level.pieces.some((p) => p.lock === 'kit'), 'kit levels need a stored solution').toBe(false)
        expect(bruteForce(level)).not.toBeNull()
      }
    })
  }
})
