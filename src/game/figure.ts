import * as THREE from 'three'
import { ribbon } from './geometry'

// The test figure: a flat pictogram standee (black fill, white rim) that faces the camera.
// Art is in the mockup's units with y up and the feet at 0; U converts to world units.
const U = 0.37 * 0.01
/** Camera tilt; the standee leans back by the same amount so it faces the lens. */
const LEAN = -((90 - 14) * Math.PI) / 180

export const FIGURE_COLORS = { fill: '#121314', rim: '#F4F4F2', red: '#FF3B30', orange: '#FF8A1F', blue: '#1F8FFF' }

export type FigureMood = 'idle' | 'worried' | 'cheer' | 'hit'

/** Seconds into the death sequence at which each beat starts. */
const DEATH = { flat: 0.58, dust: 0.84, gone: 1.26, ghost: 1.56, end: 2.0 }
const DEATH_REDUCED = { flat: 0.5, dust: 0.9, gone: 0.9, ghost: 0.9, end: 1.3 }

const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3)

function basic(color: string, opacity = 1) {
  return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false })
}

function rectShape(x: number, y: number, w: number, h: number) {
  const s = new THREE.Shape()
  s.moveTo(x, y)
  s.lineTo(x + w, y)
  s.lineTo(x + w, y + h)
  s.lineTo(x, y + h)
  s.closePath()
  return s
}

/** Body: square bottom, rounded shoulders. Bottom at y0, half width hw. */
function bodyShape(hw: number, y0: number, y1: number) {
  const s = new THREE.Shape()
  s.moveTo(-hw, y0)
  s.lineTo(hw, y0)
  s.lineTo(hw, y1)
  s.absarc(0, y1, hw, 0, Math.PI, false)
  s.closePath()
  return s
}

function circleShape(cx: number, cy: number, r: number) {
  const s = new THREE.Shape()
  s.absarc(cx, cy, r, 0, Math.PI * 2, false)
  return s
}

function mesh(shape: THREE.Shape, mat: THREE.Material, z = 0) {
  const m = new THREE.Mesh(new THREE.ShapeGeometry(shape, 24), mat)
  m.position.z = z
  return m
}

/** A dashed outline in the standee plane, built from flat ribbons. */
function dashedOutline(paths: THREE.Vector2[][], width: number, mat: THREE.Material) {
  const dashes: THREE.Vector2[] = []
  for (const pts of paths) {
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i]
      const b = pts[i + 1]
      const len = a.distanceTo(b)
      for (let d = 0; d < len; d += 12) {
        dashes.push(a.clone().lerp(b, d / len), a.clone().lerp(b, Math.min(1, (d + 7) / len)))
      }
    }
  }
  const m = new THREE.Mesh(ribbon(dashes, width, { pairs: true }), mat)
  // ribbon() builds on XZ; turn it into the XY plane of the standee.
  m.rotation.x = -Math.PI / 2
  return m
}

const arcPoints = (cx: number, cy: number, r: number, a0: number, a1: number, n = 20) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n
    return new THREE.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r)
  })

type Bit = { mesh: THREE.Mesh; x: number; y: number; dx: number; dy: number; rot: number; delay: number; dur: number }

/**
 * Animated test figure. `update` is called every frame with its mood; `die` starts the
 * zap sequence: red flashes, it tips flat like a cutout, fizzles into squares and its outline
 * floats away.
 */
export class FigureView {
  readonly group = new THREE.Group()
  private stand = new THREE.Group()
  private rig = new THREE.Group()
  private flatten = new THREE.Group()
  private upper = new THREE.Group()
  private legs: THREE.Group[] = []
  private fills: THREE.MeshBasicMaterial[] = []
  private signs: Record<'worried' | 'cheer' | 'hit', THREE.Group> = {} as never
  private signAmount = { worried: 0, cheer: 0, hit: 0 }
  private shadow: THREE.Mesh
  private scorch: THREE.Mesh
  private dust: THREE.Mesh[] = []
  private bits: Bit[] = []
  private bitsGroup = new THREE.Group()
  private ghost = new THREE.Group()
  private ghostMats: THREE.MeshBasicMaterial[] = []
  private t = 0
  private deathT = -1
  private reduced = false

  constructor() {
    const fill = basic(FIGURE_COLORS.fill)
    const rim = basic(FIGURE_COLORS.rim)
    this.fills.push(fill)

    // Legs pivot at the hip so a step lifts and shortens them.
    for (const x of [-28, 9]) {
      const leg = new THREE.Group()
      leg.position.y = 54
      leg.add(mesh(rectShape(x - 4.5, -58.5, 28, 63), rim, -0.2), mesh(rectShape(x, -54, 19, 54), fill))
      this.legs.push(leg)
    }
    this.upper.position.y = 48
    this.upper.add(
      mesh(bodyShape(40.5, -4.5, 62), rim, -0.2),
      mesh(bodyShape(36, 0, 62), fill),
      mesh(circleShape(0, 124, 29.5), rim, -0.1),
      mesh(circleShape(0, 124, 25), fill, 0.1),
    )
    this.flatten.add(...this.legs, this.upper)
    this.rig.add(this.flatten)
    this.stand.add(this.rig)

    // Signage above the head instead of facial expressions.
    const sign = (bg: string, mark: THREE.Object3D[]) => {
      const g = new THREE.Group()
      g.position.y = 209
      g.add(mesh(rectShape(-15, -15, 30, 30), basic(bg)), ...mark)
      g.visible = false
      this.stand.add(g)
      return g
    }
    const bang = (color: string) => [mesh(rectShape(-2.5, -4, 5, 13), basic(color), 0.1), mesh(circleShape(0, -9, 2.8), basic(color), 0.1)]
    const check = new THREE.Group()
    const tick = (x: number, y: number, len: number, a: number) => {
      const m = mesh(rectShape(-len / 2, -2, len, 4), basic('#FFFFFF'), 0.1)
      m.position.set(x, y, 0)
      m.rotation.z = a
      return m
    }
    check.add(tick(-4.5, -2.5, 9, -Math.PI / 4), tick(3, 0, 15, Math.PI / 3.6))
    this.signs.worried = sign(FIGURE_COLORS.orange, bang('#17191B'))
    this.signs.cheer = sign(FIGURE_COLORS.blue, [check])
    this.signs.hit = sign(FIGURE_COLORS.red, bang('#FFFFFF'))

    // Fizzle squares: fixed spots across the flattened figure, each with its own drift.
    for (let i = 0; i < 26; i++) {
      const s = 5 + (i % 3) * 2
      const color = i % 5 === 0 ? FIGURE_COLORS.orange : i % 2 ? FIGURE_COLORS.fill : FIGURE_COLORS.rim
      const m = mesh(rectShape(-s / 2, -s / 2, s, s), basic(color, 0), 0.3)
      const x = -34 + ((i * 37) % 68)
      const y = 4 + ((i * 7) % 12)
      m.position.set(x, y, 0.3)
      this.bitsGroup.add(m)
      this.bits.push({ mesh: m, x, y, dx: ((i * 13) % 21) - 10, dy: 36 + ((i * 29) % 60), rot: (((i * 47) % 90) - 45) * (Math.PI / 90), delay: (i % 6) * 0.035, dur: 0.7 + (i % 4) * 0.09 })
    }
    this.stand.add(this.bitsGroup)

    // Ghost: dashed blue outline with an orange halo, floats up and fades.
    const ghostLine = basic(FIGURE_COLORS.blue, 0)
    const halo = basic(FIGURE_COLORS.orange, 0)
    this.ghostMats.push(ghostLine, halo)
    const body = [new THREE.Vector2(-36, 48), ...arcPoints(0, 110, 36, Math.PI, 0), new THREE.Vector2(36, 48), new THREE.Vector2(-36, 48)]
    const legRect = (x: number) => [new THREE.Vector2(x, 8), new THREE.Vector2(x + 19, 8), new THREE.Vector2(x + 19, 48), new THREE.Vector2(x, 48), new THREE.Vector2(x, 8)]
    this.ghost.add(dashedOutline([arcPoints(0, 124, 25, 0, Math.PI * 2, 28), body, legRect(-28), legRect(9)], 4, ghostLine))
    const haloRing = new THREE.Mesh(new THREE.RingGeometry(17, 21, 32), halo)
    haloRing.scale.y = 0.28
    haloRing.position.y = 166
    this.ghost.add(haloRing)
    this.ghost.visible = false
    this.stand.add(this.ghost)

    this.stand.scale.setScalar(U)
    this.stand.rotation.x = LEAN
    this.stand.position.y = 0.012
    this.group.add(this.stand)

    // Floor decals: contact shadow, scorch mark and dust puffs.
    const floor = (geo: THREE.BufferGeometry, mat: THREE.Material, y: number) => {
      const m = new THREE.Mesh(geo, mat)
      m.rotation.x = -Math.PI / 2
      m.position.y = y
      this.group.add(m)
      return m
    }
    this.shadow = floor(new THREE.CircleGeometry(40 * U, 32), basic('#000000', 0.22), 0.004)
    this.shadow.scale.y = 0.3
    this.scorch = floor(new THREE.CircleGeometry(40 * U, 32), basic('#2B2D30', 0), 0.005)
    this.scorch.scale.y = 0.35
    for (const [x, r] of [[-44, 7], [44, 8], [-30, 5], [32, 5]] as const) {
      const d = floor(new THREE.CircleGeometry(r * U, 16), basic(r > 6 ? '#C9CBC8' : '#DCDEDB', 0), 0.02)
      d.position.x = x * U
      d.position.z = -6 * U
      this.dust.push(d)
    }
  }

  /** World height of the figure on screen, for placing it so the torso covers its hit point. */
  static readonly torsoOffset = 94 * U * Math.cos(LEAN + Math.PI / 2)

  get dead() {
    return this.deathT >= 0
  }

  /** Seconds since the zap started, or -1. */
  get deathTime() {
    return this.deathT
  }

  /** True once the sequence has played far enough to show the reset card. */
  get deathDone() {
    return this.deathT >= (this.reduced ? DEATH_REDUCED : DEATH).end
  }

  die(reduced: boolean) {
    if (this.dead) return
    this.reduced = reduced
    this.deathT = 0
  }

  /** Advances animation. Returns true while anything is still moving. */
  update(dt: number, mood: FigureMood, walking: boolean, reduced: boolean): boolean {
    this.t += dt
    if (this.dead) return this.animateDeath(dt)

    // Signage eases in over ~160ms.
    for (const key of ['worried', 'cheer', 'hit'] as const) {
      const target = mood === key ? 1 : 0
      const a = this.signAmount[key]
      this.signAmount[key] = reduced ? target : a + Math.sign(target - a) * Math.min(Math.abs(target - a), dt / 0.16)
      const g = this.signs[key]
      const k = easeOut(this.signAmount[key])
      g.visible = this.signAmount[key] > 0.001
      g.scale.setScalar(0.9 + 0.1 * k)
      g.position.y = 209 - 4 * (1 - k)
      g.traverse((o) => {
        if (o instanceof THREE.Mesh) (o.material as THREE.MeshBasicMaterial).opacity = k
      })
    }
    for (const m of this.fills) m.color.set(mood === 'hit' ? FIGURE_COLORS.red : FIGURE_COLORS.fill)

    const t = this.t
    this.rig.position.set(0, 0, 0)
    this.upper.position.set(0, 48, 0)
    this.upper.scale.set(1, 1, 1)
    for (const leg of this.legs) {
      leg.position.y = 54
      leg.scale.y = 1
    }
    if (reduced) return false
    if (mood === 'hit') return true
    const period = mood === 'worried' ? 0.32 : 0.5
    if (mood === 'cheer') {
      // Hop: quick rise, ease back down.
      const p = (t % 0.7) / 0.7
      this.rig.position.y = 12 * (p < 0.4 ? easeOut(p / 0.4) : 1 - easeOut((p - 0.4) / 0.6))
    } else if (walking) {
      const p = (t % period) / period
      this.upper.position.y = 48 + 3 * Math.abs(Math.sin(p * Math.PI * 2))
      this.legs.forEach((leg, i) => {
        const s = Math.max(0, Math.sin((p + i * 0.5) * Math.PI * 2))
        leg.position.y = 54 + 6 * s
        leg.scale.y = 1 - 0.1 * s
      })
    } else {
      this.upper.scale.y = 1 + 0.012 * Math.sin((t / 3.2) * Math.PI * 2)
    }
    if (mood === 'worried') this.upper.position.x = 1.2 * Math.sin((t / 0.18) * Math.PI * 2)
    return true
  }

  private animateDeath(dt: number) {
    this.deathT += dt
    const t = this.deathT
    const beats = this.reduced ? DEATH_REDUCED : DEATH
    for (const key of ['worried', 'cheer'] as const) this.signs[key].visible = false
    const hit = this.signs.hit
    hit.visible = t < beats.gone
    hit.scale.setScalar(1)
    hit.position.y = 209
    hit.traverse((o) => {
      if (o instanceof THREE.Mesh) (o.material as THREE.MeshBasicMaterial).opacity = 1
    })

    // Red flashes (two, well under three a second), with a shake.
    const red = this.reduced ? t < beats.flat : (t < 0.15 || (t >= 0.32 && t < beats.dust))
    for (const m of this.fills) m.color.set(red ? FIGURE_COLORS.red : FIGURE_COLORS.fill)
    this.rig.position.x = !this.reduced && t < 0.48 ? 3 * Math.sin((t / 0.12) * Math.PI * 2) : 0

    // Tip over like a cardboard cutout: fall, small bounce, settle.
    let sy = 1
    if (t >= beats.flat) {
      if (this.reduced) sy = 0.16
      else {
        const p = Math.min(1, (t - beats.flat) / 0.42)
        if (p < 0.62) sy = 1 - 0.86 * Math.pow(p / 0.62, 2)
        else if (p < 0.8) sy = 0.14 + 0.1 * easeOut((p - 0.62) / 0.18)
        else sy = 0.24 - 0.08 * Math.pow((p - 0.8) / 0.2, 2)
      }
    }
    this.flatten.scale.y = sy

    // Dust puff.
    const dp = (t - beats.dust) / 0.52
    for (const d of this.dust) {
      const m = d.material as THREE.MeshBasicMaterial
      m.opacity = !this.reduced && dp >= 0 && dp < 1 ? 1 - easeOut(dp) : 0
      d.scale.setScalar(0.8 + 0.55 * easeOut(Math.max(0, dp)))
    }

    // Fizzle into squares, leaving a scorch mark.
    const gone = t >= beats.gone
    this.rig.visible = !gone
    this.shadow.visible = !gone
    ;(this.scorch.material as THREE.MeshBasicMaterial).opacity = gone ? 0.85 : 0
    for (const b of this.bits) {
      const p = (t - beats.gone - b.delay) / b.dur
      const m = b.mesh.material as THREE.MeshBasicMaterial
      if (this.reduced || p < 0 || p >= 1 || !gone) {
        m.opacity = 0
        continue
      }
      const k = easeOut(p)
      m.opacity = 1 - k
      b.mesh.position.set(b.x + b.dx * k, b.y + b.dy * k, 0.3)
      b.mesh.rotation.z = b.rot * 2 * k
    }

    // The empty outline floats up and away.
    const gp = (t - beats.ghost) / (this.reduced ? 1.8 : 2.2)
    this.ghost.visible = gp >= 0 && gp < 1
    if (this.ghost.visible) {
      const o = this.reduced ? (gp < 0.3 ? gp / 0.3 : gp > 0.7 ? (1 - gp) / 0.3 : 1) : gp < 0.2 ? gp / 0.2 : 1 - (gp - 0.2) / 0.8
      for (const m of this.ghostMats) m.opacity = 0.9 * o
      this.ghost.position.y = this.reduced ? 0 : -6 + 106 * easeOut(gp)
      this.ghost.position.x = this.reduced ? 0 : -5 * Math.sin(gp * Math.PI)
    }
    return gp < 1
  }
}
