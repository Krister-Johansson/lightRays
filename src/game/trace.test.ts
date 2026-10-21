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

  const at = (x: number, y: number) => ({ ...laser(), x, y })
  /** Shortest distance from (px, py) to the infinite line through a segment. */
  const lineDist = (s: { x1: number; y1: number; x2: number; y2: number }, px: number, py: number) =>
    Math.abs((s.x2 - s.x1) * (s.y1 - py) - (s.x1 - px) * (s.y2 - s.y1)) / Math.hypot(s.x2 - s.x1, s.y2 - s.y1)
  const heading = (s: { x1: number; y1: number; x2: number; y2: number }) => (Math.atan2(-(s.y2 - s.y1), s.x2 - s.x1) * 180) / Math.PI

  it('a retroreflector sends the beam back, mirrored across its centre', () => {
    const level = board([laser(), { id: 'C', type: 'retro', x: 400, y: 320, angle: 180 }, { id: 'R', type: 'receiver', x: 150, y: 340 }])
    expect(trace(level).lit.has('R')).toBe(true)
  })

  it('a concave mirror focuses a parallel beam at its focal point', () => {
    const level = board([at(50, 280), { id: 'C', type: 'concave', x: 600, y: 300, angle: 180, focal: 100 }])
    const back = trace(level).segments[1]
    expect(lineDist(back, 500, 300)).toBeLessThan(2)
  })

  it('a dichroic mirror reflects its colour and passes the rest', () => {
    const level = board([
      laser('white'),
      { id: 'D', type: 'dichroic', x: 400, y: 300, angle: 135, color: 'blue' },
      { id: 'A', type: 'receiver', x: 400, y: 80, color: 'blue' },
      { id: 'B', type: 'receiver', x: 900, y: 300, color: 'yellow' },
    ])
    expect([...trace(level).lit.keys()].sort()).toEqual(['A', 'B'])
  })

  it('a grating splits a beam in three', () => {
    const level = board([
      laser(),
      { id: 'G', type: 'grating', x: 300, y: 300, angle: 0, spread: 25 },
      { id: 'A', type: 'receiver', x: 662, y: 131 },
      { id: 'B', type: 'receiver', x: 900, y: 300 },
      { id: 'C', type: 'receiver', x: 662, y: 469 },
    ])
    expect(trace(level).lit.size).toBe(3)
  })

  it('a right-angle prism U-turns off its long face and turns 90° off a short one', () => {
    const porro = board([laser(), { id: 'P', type: 'right-prism', x: 400, y: 320, angle: 180, size: 90 }, { id: 'R', type: 'receiver', x: 150, y: 340 }])
    expect(trace(porro).lit.has('R')).toBe(true)
    const turn = trace(board([laser(), { id: 'P', type: 'right-prism', x: 400, y: 300, angle: 315, size: 90 }])).segments
    expect(Math.abs(heading(turn[turn.length - 1]))).toBeCloseTo(90, 3)
  })

  it('a rhomboid prism shifts the beam sideways without turning it', () => {
    const segs = trace(board([laser(), { id: 'P', type: 'rhomboid', x: 400, y: 250, angle: 90, length: 100 }])).segments
    const last = segs[segs.length - 1]
    expect(heading(last)).toBeCloseTo(0, 3)
    expect(last.y2).toBeCloseTo(200, 3)
  })

  it('a wedge bends the beam by a small angle', () => {
    const segs = trace(board([laser(), { id: 'W', type: 'wedge', x: 400, y: 300, angle: 0 }])).segments
    const bend = Math.abs(heading(segs[segs.length - 1]))
    expect(bend).toBeGreaterThan(5)
    expect(bend).toBeLessThan(15)
  })

  it('a convex lens converges at its focus and a concave lens spreads', () => {
    const convex = trace(board([at(50, 280), { id: 'L1', type: 'convex-lens', x: 400, y: 300, angle: 0, focal: 150 }])).segments
    expect(lineDist(convex[1], 550, 300)).toBeLessThan(0.5)
    const concave = trace(board([at(50, 280), { id: 'L1', type: 'concave-lens', x: 400, y: 300, angle: 0, focal: 150 }])).segments
    // Diverging: the outgoing beam looks like it came from the focus behind the lens.
    expect(lineDist(concave[1], 250, 300)).toBeLessThan(0.5)
  })

  it('a colour gate only passes beams of its colour', () => {
    const gate = { id: 'G', type: 'gate', x: 400, y: 300, angle: 0, color: 'red', w: 20, h: 100 }
    const R = { id: 'R', type: 'receiver', x: 900, y: 300 }
    expect(trace(board([laser('red'), gate, R])).lit.has('R')).toBe(true)
    expect(trace(board([laser('white'), gate, R])).lit.has('R')).toBe(false)
  })

  it('crossed polarisers block light until a wave plate turns it', () => {
    const p1 = { id: 'P1', type: 'polariser', x: 300, y: 300, angle: 0, axis: 'vertical' }
    const p2 = { id: 'P2', type: 'polariser', x: 600, y: 300, angle: 0, axis: 'horizontal' }
    const R = { id: 'R', type: 'receiver', x: 900, y: 300 }
    expect(trace(board([laser(), p1, p2, R])).lit.has('R')).toBe(false)
    expect(trace(board([laser(), p1, { id: 'W', type: 'waveplate', x: 450, y: 300, angle: 0 }, p2, R])).lit.has('R')).toBe(true)
  })

  it('a scaled mirror catches a beam its normal size would miss', () => {
    const mirror = { id: 'M', type: 'mirror', x: 400, y: 340, angle: 135 }
    const R = { id: 'R', type: 'receiver', x: 400, y: 80 }
    expect(trace(board([laser(), mirror, R])).lit.has('R')).toBe(false)
    expect(trace(board([laser(), { ...mirror, scale: 2 }, R])).hits.has('M')).toBe(true)
  })
})
