import { isSolved, trace } from './trace'
import { playerCanResize, playerCanRotate } from './pieces'
import type { LevelDef, Piece, Placement } from './schema'

/** Pieces on the board when a level starts: kit pieces wait in the tray. */
export function boardPieces(level: LevelDef): Piece[] {
  return level.pieces.filter((p) => p.lock !== 'kit')
}

export function applyPlacements(pieces: Piece[], placements: Record<string, Placement>): Piece[] {
  return pieces.map((p) => (placements[p.id] ? { ...p, ...placements[p.id] } : p))
}

/** True when the level's stored solution (with every kit piece placed) solves it. */
export function solutionWorks(level: LevelDef): boolean {
  if (!level.solution) return false
  const pieces = applyPlacements(level.pieces, level.solution)
  return isSolved(pieces, trace(level, pieces))
}

/**
 * Turns a solved sandbox arrangement into a playable level: the current layout becomes the
 * stored solution, and rotatable pieces are turned away from it so the player has to work.
 */
export function toPlayable(level: LevelDef): LevelDef {
  const solution: Record<string, Placement> = {}
  for (const p of level.pieces) {
    if (p.lock === 'kit' || playerCanRotate(p) || playerCanResize(p)) {
      solution[p.id] = { x: p.x, y: p.y, angle: p.angle, ...(p.scale !== undefined && { scale: p.scale }) }
    }
  }
  let k = 0
  const scramble = (pieces: Piece[]): Piece[] =>
    pieces.map((p, i) =>
      p.lock !== 'kit' && playerCanRotate(p) ? { ...p, angle: Math.round(((p.angle + 70 + 25 * i + 35 * k) % 360) / 5) * 5 % 360 } : p,
    )
  let pieces = scramble(level.pieces)
  const start = (ps: Piece[]) => ps.filter((p) => p.lock !== 'kit')
  // Make sure the scrambled start isn't already solved.
  while (k < 12 && isSolved(start(pieces), trace(level, start(pieces)))) {
    k++
    pieces = scramble(level.pieces)
  }
  return { ...level, pieces, solution }
}
