import { describe, expect, it } from 'vitest'
import { parseLevel } from './schema'
import { isSolved, trace } from './trace'

const board = (pieces: unknown[]) =>
  parseLevel({ version: 2, id: '9-9', name: 't', par: 0, width: 1000, height: 600, pieces })

const laser = (color = 'yellow', angle = 0) => ({ id: 'L', type: 'laser', x: 50, y: 300, angle, color })

describe('trace', () => {
  it('reflects off the shiny side of a 45° mirror into a receiver', () => {
    const level = board([laser(), { id: 'M', type: 'mirror', x: 400, y: 300, angle: 135 }, { id: 'R', type: 'receiver', x: 400, y: 80 }])
    const r = trace(level)
    expect(r.lit.has('R')).toBe(true)
    expect(isSolved(level.pieces, r)).toBe(true)
  })

  it('absorbs on the back of a one-sided mirror but not a double mirror', () => {
    const back = board([laser(), { id: 'M', type: 'mirror', x: 400, y: 300, angle: 315 }, { id: 'R', type: 'receiver', x: 400, y: 80 }])
    expect(trace(back).lit.has('R')).toBe(false)
    const dbl = board([laser(), { id: 'M', type: 'double-mirror', x: 400, y: 300, angle: 315 }, { id: 'R', type: 'receiver', x: 400, y: 80 }])
    expect(trace(dbl).lit.has('R')).toBe(true)
  })

  it('splits a beam so it can light two receivers', () => {
    const level = board([
      laser(),
      { id: 'S', type: 'splitter', x: 400, y: 300, angle: 135 },
      { id: 'A', type: 'receiver', x: 400, y: 80 },
      { id: 'B', type: 'receiver', x: 900, y: 300 },
    ])
    const r = trace(level)
    expect([...r.lit.keys()].sort()).toEqual(['A', 'B'])
  })

  it('fans white light into red, green and blue through a prism', () => {
    const level = board([laser('white', 0), { id: 'P', type: 'prism', x: 400, y: 300, angle: 90, size: 120 }])
    const masks = new Set(trace(level).segments.map((s) => s.mask))
    expect(masks).toEqual(new Set([0b111, 0b001, 0b010, 0b100]))
  })

  it('a filter only passes its colour, and coloured receivers need that colour', () => {
    const level = board([
      laser('white'),
      { id: 'F', type: 'filter', x: 300, y: 300, angle: 0, color: 'red' },
      { id: 'R', type: 'receiver', x: 800, y: 300, color: 'red' },
    ])
    expect(trace(level).lit.has('R')).toBe(true)
    const wrong = board([laser('white'), { id: 'R', type: 'receiver', x: 800, y: 300, color: 'red' }])
    expect(trace(wrong).lit.has('R')).toBe(false)
  })

  it('a glass block shifts the beam but keeps its direction', () => {
    const level = board([laser('yellow', 10), { id: 'G', type: 'glass', x: 400, y: 240, angle: 0, w: 120, h: 200 }])
    const segs = trace(level).segments
    const first = segs[0]
    const last = segs[segs.length - 1]
    const dir = (s: typeof first) => Math.atan2(s.y2 - s.y1, s.x2 - s.x1)
    expect(dir(last)).toBeCloseTo(dir(first), 6)
  })

  it('a tube receiver only lights for beams entering its mouth head-on', () => {
    // Tube at 180° faces left, towards the laser.
    const straight = board([laser(), { id: 'T', type: 'tube', x: 800, y: 300, angle: 180 }])
    expect(trace(straight).lit.has('T')).toBe(true)
    const backwards = board([laser(), { id: 'T', type: 'tube', x: 800, y: 300, angle: 0 }])
    expect(trace(backwards).lit.has('T')).toBe(false)
  })
})
