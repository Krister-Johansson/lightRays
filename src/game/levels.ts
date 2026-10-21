import type { LevelDef } from './types'

const W = 1120
const H = 620
const AMBER = '#FFC940'

export const LEVELS: LevelDef[] = [
  {
    id: '1-1',
    name: 'First bounce',
    par: 1,
    width: W,
    height: H,
    laser: { x: 70, y: 420, angle: 0, color: AMBER },
    receiver: { x: 600, y: 110, r: 22 },
    mirrors: [{ id: 'A', x: 600, y: 420, angle: 60 }],
    walls: [{ x: 380, y: 160, w: 60, h: 160 }],
  },
  {
    id: '1-2',
    name: 'Around the wall',
    par: 2,
    width: W,
    height: H,
    laser: { x: 70, y: 500, angle: 0, color: AMBER },
    receiver: { x: 980, y: 200, r: 22 },
    mirrors: [
      { id: 'A', x: 300, y: 500, angle: 30 },
      { id: 'B', x: 300, y: 110, angle: 300 },
    ],
    walls: [{ x: 520, y: 240, w: 60, h: 380 }],
  },
  {
    id: '1-3',
    name: 'Three turns',
    par: 2,
    width: W,
    height: H,
    laser: { x: 70, y: 150, angle: 0, color: AMBER },
    receiver: { x: 1000, y: 160, r: 22 },
    mirrors: [
      { id: 'M1', x: 480, y: 150, angle: 60 },
      { id: 'M2', x: 260, y: 470, angle: 90, mustHit: true },
      { id: 'F', x: 800, y: 500, angle: 118.2, fixed: true },
    ],
    walls: [
      { x: 620, y: 280, w: 60, h: 90 },
      { x: 1000, y: 360, w: 40, h: 260 },
    ],
  },
]
