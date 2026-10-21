import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { dashedCircle, dotGridTexture, ribbon } from './geometry'
import { isSolved, MIRROR_HALF_LENGTH, trace } from './trace'
import type { LevelDef, MirrorDef, TraceResult } from './types'

/** World units per board pixel. */
const S = 0.01
const DOT_CELL = 40

const COLORS = {
  background: '#0C0D0F',
  frame: '#101214',
  board: '#131518',
  dot: '#262A2F',
  wall: '#24272C',
  wallEdge: '#33373D',
  mirrorBack: '#2C3036',
  mirrorFace: '#DDE1E6',
  plate: '#16181B',
  dial: '#4FA8FF',
  amber: '#FFC940',
  receiverDark: '#6B5A26',
  receiverCore: '#2A2617',
}

// Dial radii in board pixels (from the approved design).
const DIAL = { inner: 48, fine: 110, finest: 180, minArm: 60, maxArm: 240, defaultArm: 80 }

const BEAM_Y = 0.07
const DIAL_Y = 0.004

export type GameSnapshot = {
  level: LevelDef
  angles: Record<string, number>
  selected: string | null
  dragging: boolean
  lit: boolean
  solved: boolean
  /** True once the unlock light has reached the receiver; the finish button opens then. */
  unlocked: boolean
  mustHit: { hit: number; total: number }
  moves: number
  dial: { x: number; y: number; deg: string; step: string } | null
}

/** Rotation step for a handle at the given distance, per the design. */
export function stepFor(arm: number, shift: boolean) {
  if (shift) return 15
  if (arm >= DIAL.finest) return 0.1
  if (arm >= DIAL.fine) return 1
  return 5
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 4)
const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

type MirrorView = {
  def: MirrorDef
  root: THREE.Group
  pivot: THREE.Group
  hit: THREE.Mesh
  base?: THREE.Mesh
  mustRing?: THREE.Mesh
}

export class Game {
  private renderer: THREE.WebGLRenderer
  private composer: EffectComposer
  private bloom: UnrealBloomPass
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(24, 1, 0.1, 200)
  private raycaster = new THREE.Raycaster()
  private boardPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -DIAL_Y)
  private resizeObserver: ResizeObserver
  private frame = 0
  private animating = false
  private listeners = new Set<() => void>()

  private level!: LevelDef
  private levelGroup = new THREE.Group()
  private beamGroup = new THREE.Group()
  private dialGroup = new THREE.Group()
  private mirrors = new Map<string, MirrorView>()
  private receiver!: { ring: THREE.MeshBasicMaterial; core: THREE.MeshBasicMaterial; halo: THREE.Mesh; pulse: THREE.Mesh }
  private dialParts!: {
    arm: THREE.Mesh
    refDot: THREE.Mesh
    handle: THREE.Group
    handleHit: THREE.Mesh
    materials: THREE.MeshBasicMaterial[]
  }

  private angles: Record<string, number> = {}
  private arms: Record<string, number> = {}
  private selected: string | null = null
  private dragging = false
  private dragStartAngle = 0
  private shift = false
  private moves = 0
  private result!: TraceResult
  private snapshot!: GameSnapshot

  // Animated values, eased toward their targets each frame.
  private litAmount = 0
  private dialAppear = 0
  private dialTarget = 0
  private pulseT = 1
  private wasLit = false
  // Unlock sequence: a bright pulse races down the solved beam, then the receiver bursts.
  private solved = false
  private unlocked = false
  /** Seconds into the unlock sequence; Infinity when it isn't playing. */
  private unlockT = Infinity
  private surge = 0
  private beamPath: { pts: THREE.Vector2[]; lengths: number[]; total: number } = { pts: [], lengths: [], total: 0 }
  private cometGroup = new THREE.Group()
  private burst!: THREE.Mesh

  private container: HTMLElement

  constructor(container: HTMLElement) {
    this.container = container
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setClearColor(COLORS.background)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    this.renderer.domElement.style.display = 'block'
    this.renderer.domElement.style.touchAction = 'none'
    container.appendChild(this.renderer.domElement)

    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 })
    this.composer = new EffectComposer(this.renderer, target)
    this.composer.addPass(new RenderPass(this.scene, this.camera))
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.35, 1.0)
    this.composer.addPass(this.bloom)
    this.composer.addPass(new OutputPass())

    this.scene.background = new THREE.Color(COLORS.background)
    this.scene.add(new THREE.HemisphereLight('#c9d4e3', '#0b0c0e', 0.6))
    const sun = new THREE.DirectionalLight('#ffffff', 0.9)
    sun.position.set(-4, 9, 3)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.left = -8
    sun.shadow.camera.right = 8
    sun.shadow.camera.top = 6
    sun.shadow.camera.bottom = -6
    sun.shadow.radius = 4
    sun.shadow.bias = -0.0005
    this.scene.add(sun)

    this.scene.add(this.levelGroup, this.beamGroup, this.cometGroup, this.dialGroup)
    this.buildDial()

    const el = this.renderer.domElement
    el.addEventListener('pointerdown', this.onPointerDown)
    el.addEventListener('pointermove', this.onPointerMove)
    el.addEventListener('pointerup', this.onPointerUp)
    el.addEventListener('pointercancel', this.onPointerUp)
    el.addEventListener('pointerleave', this.onPointerLeave)
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)

    this.resizeObserver = new ResizeObserver(() => this.resize())
    this.resizeObserver.observe(container)
  }

  // ---------------------------------------------------------------- public API

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  getSnapshot = () => this.snapshot

  load(level: LevelDef) {
    this.level = level
    this.angles = Object.fromEntries(level.mirrors.map((m) => [m.id, m.angle]))
    this.arms = Object.fromEntries(level.mirrors.map((m) => [m.id, DIAL.defaultArm]))
    this.moves = 0
    this.selected = null
    this.dragging = false
    this.dialAppear = this.dialTarget = 0
    this.litAmount = 0
    this.wasLit = false
    this.pulseT = 1
    this.solved = this.unlocked = false
    this.unlockT = Infinity
    this.surge = 0
    this.buildLevel()
    this.update()
    this.resize()
  }

  reset() {
    this.load(this.level)
  }

  select(id: string | null) {
    const m = id ? this.mirrors.get(id) : null
    const next = m && !m.def.fixed ? m.def.id : null
    if (next === this.selected) return
    this.selected = next
    if (next) {
      // Re-appear from slightly smaller each time a new piece is picked.
      this.dialAppear = prefersReducedMotion() ? 1 : 0
      this.dialTarget = 1
    } else {
      this.dialTarget = 0
    }
    this.update()
  }

  /** Rotates the selected mirror by `delta` degrees (keyboard control). */
  nudge(delta: number) {
    if (!this.selected) return
    const id = this.selected
    this.angles[id] = normalize(this.angles[id] + delta)
    this.moves++
    this.update()
  }

  cycleSelection(dir: 1 | -1) {
    const free = this.level.mirrors.filter((m) => !m.fixed)
    if (!free.length) return
    const i = free.findIndex((m) => m.id === this.selected)
    const next = free[(i + dir + free.length) % free.length]
    this.select(next.id)
  }

  dispose() {
    cancelAnimationFrame(this.frame)
    this.resizeObserver.disconnect()
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
        o.geometry.dispose()
        const mats = Array.isArray(o.material) ? o.material : [o.material]
        mats.forEach((m: THREE.Material) => m.dispose())
      }
    })
    this.composer.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  // ------------------------------------------------------------- coordinates

  private toWorld(x: number, y: number, h = 0) {
    return new THREE.Vector3((x - this.level.width / 2) * S, h, (y - this.level.height / 2) * S)
  }

  private toBoard(v: THREE.Vector3) {
    return { x: v.x / S + this.level.width / 2, y: v.z / S + this.level.height / 2 }
  }

  /** Board pixel → CSS pixel position inside the canvas. */
  toScreen(x: number, y: number) {
    const v = this.toWorld(x, y, DIAL_Y).project(this.camera)
    const r = this.renderer.domElement.getBoundingClientRect()
    return { x: ((v.x + 1) / 2) * r.width, y: ((1 - v.y) / 2) * r.height }
  }

  private pointerRay(e: PointerEvent) {
    const r = this.renderer.domElement.getBoundingClientRect()
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    this.raycaster.setFromCamera(ndc, this.camera)
    return this.raycaster
  }

  // ------------------------------------------------------------------ build

  private buildLevel() {
    disposeChildren(this.levelGroup)
    this.mirrors.clear()
    const { width: W, height: H } = this.level

    // Recessed frame and matte dotted board.
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry((W + 24) * S, 0.12, (H + 24) * S),
      new THREE.MeshStandardMaterial({ color: COLORS.frame, roughness: 0.95 }),
    )
    frame.position.y = -0.065
    frame.receiveShadow = true
    this.levelGroup.add(frame)

    const tex = dotGridTexture(DOT_CELL, 1.3, COLORS.board, COLORS.dot)
    tex.repeat.set(W / DOT_CELL, H / DOT_CELL)
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(W * S, H * S),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0 }),
    )
    board.rotation.x = -Math.PI / 2
    board.receiveShadow = true
    this.levelGroup.add(board)

    // Walls
    const wallMat = new THREE.MeshStandardMaterial({ color: COLORS.wall, roughness: 0.8 })
    const edgeMat = new THREE.LineBasicMaterial({ color: COLORS.wallEdge })
    for (const w of this.level.walls) {
      const geo = new THREE.BoxGeometry(w.w * S, 0.26, w.h * S)
      const mesh = new THREE.Mesh(geo, wallMat)
      mesh.position.copy(this.toWorld(w.x + w.w / 2, w.y + w.h / 2, 0.13))
      mesh.castShadow = mesh.receiveShadow = true
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat)
      mesh.add(edges)
      this.levelGroup.add(mesh)
    }

    this.buildLaser()
    this.buildReceiver()
    for (const m of this.level.mirrors) this.buildMirror(m)
    flatDoubleSided(this.levelGroup)
  }

  private buildLaser() {
    const { x, y, angle, color } = this.level.laser
    const g = new THREE.Group()
    g.position.copy(this.toWorld(x, y))
    g.rotation.y = (angle * Math.PI) / 180

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(54 * S, 0.18, 44 * S),
      new THREE.MeshStandardMaterial({ color: '#1B1E22', roughness: 0.6, metalness: 0.2 }),
    )
    body.position.set(-27 * S, 0.09, 0)
    body.castShadow = true
    const nozzle = new THREE.Mesh(
      new THREE.BoxGeometry(10 * S, 0.1, 16 * S),
      new THREE.MeshStandardMaterial({ color: '#3A3F46', roughness: 0.5, metalness: 0.4 }),
    )
    nozzle.position.set(0, BEAM_Y, 0)
    const led = new THREE.Mesh(
      new THREE.CircleGeometry(5 * S, 24),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(3) }),
    )
    led.rotation.x = -Math.PI / 2
    led.position.set(-40 * S, 0.181, 0)
    g.add(body, nozzle, led)
    this.levelGroup.add(g)
  }

  private buildReceiver() {
    const { x, y, r } = this.level.receiver
    const g = new THREE.Group()
    g.position.copy(this.toWorld(x, y))

    const housing = new THREE.Mesh(
      new THREE.CylinderGeometry(r * S, r * S * 1.05, 0.16, 48),
      new THREE.MeshStandardMaterial({ color: '#1B1E22', roughness: 0.6, metalness: 0.2 }),
    )
    housing.position.y = 0.08
    housing.castShadow = true
    const ringMat = new THREE.MeshBasicMaterial({ color: COLORS.receiverDark })
    const ring = new THREE.Mesh(new THREE.RingGeometry((r - 4) * S, r * S, 48), ringMat)
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.161
    const coreMat = new THREE.MeshBasicMaterial({ color: COLORS.receiverCore })
    const core = new THREE.Mesh(new THREE.CircleGeometry(9 * S, 32), coreMat)
    core.rotation.x = -Math.PI / 2
    core.position.y = 0.162

    const halo = new THREE.Mesh(
      new THREE.RingGeometry(r * S, (r + 18) * S, 48),
      new THREE.MeshBasicMaterial({ color: this.level.laser.color, transparent: true, opacity: 0, depthWrite: false }),
    )
    halo.rotation.x = -Math.PI / 2
    halo.position.y = 0.003
    const pulse = new THREE.Mesh(
      new THREE.RingGeometry(r * S, (r + 3) * S, 48),
      new THREE.MeshBasicMaterial({ color: this.level.laser.color, transparent: true, opacity: 0, depthWrite: false }),
    )
    pulse.rotation.x = -Math.PI / 2
    pulse.position.y = 0.163

    const burst = new THREE.Mesh(
      new THREE.RingGeometry(r * S, (r + 6) * S, 64),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(this.level.laser.color).multiplyScalar(2), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
    )
    burst.rotation.x = -Math.PI / 2
    burst.position.y = 0.004
    this.burst = burst

    g.add(housing, ring, core, halo, pulse, burst)
    this.levelGroup.add(g)
    this.receiver = { ring: ringMat, core: coreMat, halo, pulse }
  }

  private buildMirror(def: MirrorDef) {
    const root = new THREE.Group()
    root.position.copy(this.toWorld(def.x, def.y))
    const pivot = new THREE.Group()
    root.add(pivot)

    const len = MIRROR_HALF_LENGTH * 2 * S
    const back = new THREE.Mesh(
      new THREE.BoxGeometry(6 * S, 0.15, len),
      new THREE.MeshStandardMaterial({ color: COLORS.mirrorBack, roughness: 0.5, metalness: 0.3 }),
    )
    back.position.set(-4 * S, 0.075, 0)
    back.castShadow = true
    const face = new THREE.Mesh(
      new THREE.BoxGeometry(3 * S, 0.15, len),
      new THREE.MeshStandardMaterial({ color: COLORS.mirrorFace, roughness: 0.25, metalness: 0.6, emissive: '#9aa0a8', emissiveIntensity: 0.55 }),
    )
    face.position.set(0, 0.075, 0)
    face.castShadow = true
    pivot.add(back, face)

    let base: THREE.Mesh | undefined
    if (def.fixed) {
      const plate = new THREE.Mesh(
        new THREE.BoxGeometry(72 * S, 0.02, 72 * S),
        new THREE.MeshStandardMaterial({ color: COLORS.plate, roughness: 0.7 }),
      )
      plate.position.y = 0.01
      plate.receiveShadow = true
      root.add(plate)
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const screw = new THREE.Mesh(
          new THREE.CylinderGeometry(2.5 * S, 2.5 * S, 0.01, 12),
          new THREE.MeshStandardMaterial({ color: '#3A3F46', metalness: 0.6, roughness: 0.4 }),
        )
        screw.position.set(sx * 27 * S, 0.025, sz * 27 * S)
        root.add(screw)
      }
    } else {
      base = new THREE.Mesh(
        new THREE.RingGeometry(30 * S, 32 * S, 64),
        new THREE.MeshBasicMaterial({ color: COLORS.dial, transparent: true, opacity: 0, depthWrite: false }),
      )
      base.rotation.x = -Math.PI / 2
      base.position.y = 0.003
      root.add(base)
    }

    let mustRing: THREE.Mesh | undefined
    if (def.mustHit) {
      const d = 44 * S
      const pts = [
        [0, -d], [d, 0], [0, d], [-d, 0], [0, -d],
      ].map(([a, b]) => new THREE.Vector2(a, b))
      // Dashes are drawn by splitting each edge into short pieces.
      const dashes: THREE.Vector2[] = []
      for (let i = 0; i < 4; i++) {
        const a = pts[i]
        const b = pts[i + 1]
        const n = 6
        for (let k = 0; k < n; k++) {
          dashes.push(a.clone().lerp(b, k / n), a.clone().lerp(b, (k + 0.5) / n))
        }
      }
      mustRing = new THREE.Mesh(
        ribbon(dashes, 1.6 * S, { pairs: true }),
        new THREE.MeshBasicMaterial({ color: COLORS.amber, transparent: true, opacity: 0.7, depthWrite: false }),
      )
      mustRing.position.y = 0.003
      mustRing.userData.solid = new THREE.Mesh(
        ribbon(pts, 1.6 * S, { joints: true }),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(COLORS.amber).multiplyScalar(1.4), transparent: true, opacity: 0, depthWrite: false }),
      )
      ;(mustRing.userData.solid as THREE.Mesh).position.y = 0.0035
      root.add(mustRing, mustRing.userData.solid as THREE.Mesh)
    }

    // Invisible pick target, a bit larger than the mirror for comfortable taps.
    const hit = new THREE.Mesh(
      new THREE.CylinderGeometry(34 * S, 34 * S, 0.2, 24),
      new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
    )
    hit.position.y = 0.1
    hit.userData.mirrorId = def.id
    root.add(hit)

    this.levelGroup.add(root)
    this.mirrors.set(def.id, { def, root, pivot, hit, base, mustRing })
  }

  private buildDial() {
    const mat = (opacity: number) =>
      new THREE.MeshBasicMaterial({ color: COLORS.dial, transparent: true, opacity, depthWrite: false })
    const guideMat = new THREE.MeshBasicMaterial({ color: '#3a4049', transparent: true, opacity: 1, depthWrite: false })
    const fillMat = new THREE.MeshBasicMaterial({ color: '#0C0D0F', transparent: true, opacity: 0.35, depthWrite: false })

    const fill = new THREE.Mesh(new THREE.CircleGeometry(DIAL.inner * S, 64), fillMat)
    const innerMat = mat(0.55)
    const inner = new THREE.Mesh(new THREE.RingGeometry((DIAL.inner - 0.75) * S, (DIAL.inner + 0.75) * S, 96), innerMat)
    const fine = new THREE.Mesh(dashedCircle(DIAL.fine * S, 1.1 * S, 2 * S, 6 * S), guideMat)
    const finest = new THREE.Mesh(dashedCircle(DIAL.finest * S, 1.1 * S, 2 * S, 6 * S), guideMat)

    const minor: THREE.Vector2[] = []
    const major: THREE.Vector2[] = []
    for (let d = 0; d < 360; d += 15) {
      const r = (d * Math.PI) / 180
      const isMajor = d % 45 === 0
      const out = isMajor ? 60 : 54
      const list = isMajor ? major : minor
      list.push(
        new THREE.Vector2(Math.cos(r) * DIAL.inner * S, -Math.sin(r) * DIAL.inner * S),
        new THREE.Vector2(Math.cos(r) * out * S, -Math.sin(r) * out * S),
      )
    }
    const minorMat = mat(0.5)
    const majorMat = mat(0.9)
    const ticksMinor = new THREE.Mesh(ribbon(minor, 1.5 * S, { pairs: true }), minorMat)
    const ticksMajor = new THREE.Mesh(ribbon(major, 2 * S, { pairs: true }), majorMat)

    const armMat = mat(1)
    const arm = new THREE.Mesh(new THREE.BufferGeometry(), armMat)
    const refDotMat = mat(1)
    const refDot = new THREE.Mesh(new THREE.CircleGeometry(4 * S, 24), refDotMat)

    const handle = new THREE.Group()
    const handleFillMat = new THREE.MeshBasicMaterial({ color: '#0C0D0F', transparent: true, depthWrite: false })
    const handleFill = new THREE.Mesh(new THREE.CircleGeometry(10 * S, 32), handleFillMat)
    const handleRingMat = mat(1)
    const handleRing = new THREE.Mesh(new THREE.RingGeometry(8.5 * S, 11.5 * S, 32), handleRingMat)
    handleRing.position.y = 0.0005
    const handleHit = new THREE.Mesh(
      new THREE.CircleGeometry(24 * S, 24),
      new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
    )
    handle.add(handleFill, handleRing, handleHit)

    // Ribbons are built flat already; primitives need laying down on the board.
    for (const m of [fill, inner, refDot, handleFill, handleRing, handleHit]) m.rotation.x = -Math.PI / 2
    arm.position.y = 0.0002
    refDot.position.y = 0.0006
    handle.position.y = 0.001
    this.dialGroup.add(fill, inner, fine, finest, ticksMinor, ticksMajor, arm, refDot, handle)
    this.dialGroup.position.y = DIAL_Y
    this.dialGroup.visible = false
    this.dialGroup.renderOrder = 10

    flatDoubleSided(this.dialGroup)
    const materials = [fillMat, innerMat, guideMat, minorMat, majorMat, armMat, refDotMat, handleFillMat, handleRingMat]
    for (const m of materials) m.userData.baseOpacity = m.opacity
    this.dialParts = { arm, refDot, handle, handleHit, materials }
  }

  // ----------------------------------------------------------------- update

  /** Re-traces the beam and syncs every scene object and the snapshot to state. */
  private update() {
    for (const [id, m] of this.mirrors) {
      m.pivot.rotation.y = (this.angles[id] * Math.PI) / 180
    }
    this.result = trace(this.level, this.angles)
    const solved = isSolved(this.level, this.result)
    if (solved && !this.solved) {
      this.unlockT = 0
      this.unlocked = false
    } else if (!solved) {
      this.unlockT = Infinity
      this.unlocked = false
      disposeChildren(this.cometGroup)
    }
    this.solved = solved
    this.buildBeam()
    this.updateDial()
    this.emit()
    this.requestFrame()
  }

  private buildBeam() {
    disposeChildren(this.beamGroup)
    const color = new THREE.Color(this.level.laser.color)
    const pts = this.result.points.map((p) => {
      const w = this.toWorld(p.x, p.y)
      return new THREE.Vector2(w.x, w.z)
    })
    const layer = (width: number, c: THREE.Color, opacity: number, y: number, additive = true) => {
      const mesh = new THREE.Mesh(
        ribbon(pts, width * S, { joints: true }),
        new THREE.MeshBasicMaterial({
          color: c,
          transparent: true,
          opacity,
          depthWrite: false,
          blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
        }),
      )
      mesh.position.y = y
      mesh.material.userData.base = c.clone()
      this.beamGroup.add(mesh)
    }
    const lengths = [0]
    for (let i = 1; i < pts.length; i++) lengths.push(lengths[i - 1] + pts[i].distanceTo(pts[i - 1]))
    this.beamPath = { pts, lengths, total: lengths[lengths.length - 1] }
    // Light spill on the board, then the beam itself: coloured body and a hot white core.
    layer(22, color.clone().multiplyScalar(0.12), 1, 0.002)
    layer(5, color.clone().multiplyScalar(0.9), 0.85, BEAM_Y)
    layer(2.4, color.clone().multiplyScalar(1.8), 1, BEAM_Y + 0.0005)
    layer(1, new THREE.Color(1, 1, 1).multiplyScalar(1.6), 1, BEAM_Y + 0.001)

    // Impact flare where the beam stops (wall or board edge).
    if (!this.result.lit) {
      const end = pts[pts.length - 1]
      const flare = new THREE.Mesh(
        new THREE.CircleGeometry(7 * S, 24),
        new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(3), transparent: true, depthWrite: false }),
      )
      flare.rotation.x = -Math.PI / 2
      flare.position.set(end.x, BEAM_Y, end.y)
      this.beamGroup.add(flare)
    }
    flatDoubleSided(this.beamGroup)
  }

  private updateDial() {
    const id = this.selected
    if (!id) return
    const m = this.mirrors.get(id)!
    const a = (this.angles[id] * Math.PI) / 180
    const arm = this.arms[id]
    const c = Math.cos(a)
    const s = -Math.sin(a)
    this.dialGroup.position.x = m.root.position.x
    this.dialGroup.position.z = m.root.position.z

    const { arm: armMesh, refDot, handle } = this.dialParts
    armMesh.geometry.dispose()
    armMesh.geometry = ribbon([new THREE.Vector2(0, 0), new THREE.Vector2(c * arm * S, s * arm * S)], 1.5 * S)
    refDot.position.set(c * DIAL.inner * S, refDot.position.y, s * DIAL.inner * S)
    handle.position.set(c * arm * S, handle.position.y, s * arm * S)
  }

  private emit() {
    const sel = this.selected
    let dial: GameSnapshot['dial'] = null
    if (sel && this.renderer.domElement.clientWidth > 0) {
      const m = this.mirrors.get(sel)!.def
      const a = (this.angles[sel] * Math.PI) / 180
      const arm = this.arms[sel]
      const step = stepFor(arm, this.shift)
      const label = this.toScreen(m.x + Math.cos(a) * (arm + 52), m.y - Math.sin(a) * (arm + 52))
      dial = {
        ...label,
        deg: this.angles[sel].toFixed(1) + '°',
        step: this.shift ? 'snap 15°' : `${step}° steps`,
      }
    }
    const must = this.level.mirrors.filter((m) => m.mustHit)
    this.snapshot = {
      level: this.level,
      angles: { ...this.angles },
      selected: sel,
      dragging: this.dragging,
      lit: this.result.lit,
      solved: this.solved,
      unlocked: this.unlocked,
      mustHit: { hit: must.filter((m) => this.result.hits.has(m.id)).length, total: must.length },
      moves: this.moves,
      dial,
    }
    this.listeners.forEach((fn) => fn())
  }

  // ------------------------------------------------------------- rendering

  private resize() {
    const w = this.container.clientWidth
    const h = this.container.clientHeight
    if (!w || !h || !this.level) return
    this.renderer.setSize(w, h)
    this.composer.setSize(w, h)
    this.bloom.setSize(w, h)
    this.camera.aspect = w / h

    // Slight tilt: camera sits ~14° off vertical, toward the player.
    const tilt = (14 * Math.PI) / 180
    const reserveTop = 84
    const reserveBottom = 112
    const boardW = (this.level.width + 80) * S
    const boardH = (this.level.height + 60) * S
    const availH = Math.max(0.3, (h - reserveTop - reserveBottom) / h)
    const vFov = (this.camera.fov * Math.PI) / 180
    const distH = boardH / availH / 2 / Math.tan(vFov / 2)
    const distW = boardW / 2 / (Math.tan(vFov / 2) * this.camera.aspect)
    const dist = Math.max(distH, distW) * 1.02
    // Shift the look target so the board sits between the HUD bars.
    const offset = ((reserveBottom - reserveTop) / h) * dist * Math.tan(vFov / 2)
    const target = new THREE.Vector3(0, 0, offset)
    this.camera.position.set(0, Math.cos(tilt) * dist, Math.sin(tilt) * dist + offset)
    this.camera.lookAt(target)
    this.camera.updateProjectionMatrix()
    this.emit()
    this.requestFrame()
  }

  private requestFrame() {
    if (this.animating) return
    this.animating = true
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const busy = this.animate(dt)
      this.composer.render()
      if (busy) this.frame = requestAnimationFrame(tick)
      else this.animating = false
    }
    this.frame = requestAnimationFrame(tick)
  }

  /** Advances eased values. Returns true while anything is still moving. */
  private animate(dt: number) {
    const reduced = prefersReducedMotion()
    let busy = false

    // Dial: 180ms ease-out in, 120ms out (exits are faster than entrances).
    const dialSpeed = this.dialTarget > this.dialAppear ? 1 / 0.18 : 1 / 0.12
    if (this.dialAppear !== this.dialTarget) {
      const d = this.dialTarget - this.dialAppear
      this.dialAppear = reduced ? this.dialTarget : this.dialAppear + Math.sign(d) * Math.min(Math.abs(d), dt * dialSpeed)
      busy = true
    }
    const k = easeOut(this.dialAppear)
    this.dialGroup.visible = this.dialAppear > 0.001
    const scale = reduced ? 1 : 0.94 + 0.06 * k
    this.dialGroup.scale.setScalar(scale)
    for (const m of this.dialParts.materials) m.opacity = (m.userData.baseOpacity as number) * k

    // Selection ring on free mirrors.
    for (const [id, m] of this.mirrors) {
      if (!m.base) continue
      const mat = m.base.material as THREE.MeshBasicMaterial
      const target = id === this.selected ? 0 : id === this.hovered ? 0.45 : 0.12
      const next = approach(mat.opacity, target, dt, 0.08)
      if (Math.abs(next - target) > 0.002) busy = true
      mat.opacity = next
    }

    // Receiver glow eases in quickly; light reaching a target should feel immediate.
    const lit = this.result.lit ? 1 : 0
    if (this.result.lit && !this.wasLit && !reduced) this.pulseT = 0
    this.wasLit = this.result.lit
    this.litAmount = approach(this.litAmount, lit, dt, 0.06)
    if (Math.abs(this.litAmount - lit) > 0.002) busy = true
    const beam = new THREE.Color(this.level.laser.color)
    this.receiver.ring.color.copy(new THREE.Color(COLORS.receiverDark).lerp(beam.clone().multiplyScalar(2.2), this.litAmount))
    this.receiver.core.color.copy(new THREE.Color(COLORS.receiverCore).lerp(beam.clone().multiplyScalar(4), this.litAmount))
    ;(this.receiver.halo.material as THREE.MeshBasicMaterial).opacity = 0.35 * this.litAmount

    if (this.pulseT < 1) {
      this.pulseT = Math.min(1, this.pulseT + dt / 0.6)
      const p = easeOut(this.pulseT)
      this.receiver.pulse.scale.setScalar(1 + p * 1.6)
      ;(this.receiver.pulse.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - p)
      busy = true
    }

    busy = this.animateUnlock(dt, reduced) || busy

    // Must-hit outline turns solid once the beam bounces off it.
    for (const [id, m] of this.mirrors) {
      if (!m.mustRing) continue
      const hit = this.result.hits.has(id) ? 1 : 0
      const solid = m.mustRing.userData.solid as THREE.Mesh
      const sm = solid.material as THREE.MeshBasicMaterial
      const dm = m.mustRing.material as THREE.MeshBasicMaterial
      sm.opacity = approach(sm.opacity, hit, dt, 0.06)
      dm.opacity = 0.7 * (1 - sm.opacity)
      if (Math.abs(sm.opacity - hit) > 0.002) busy = true
    }
    return busy
  }

  /**
   * Plays the unlock: a comet of light runs at constant speed from the laser into the
   * receiver and keeps flowing in until its tail is gone. As its head lands, the receiver
   * bursts and the whole beam surges brighter before settling.
   */
  private animateUnlock(dt: number, reduced: boolean) {
    const SPEED = 1500 * S // board px per second; constant so the light never slows down
    const BURST = 0.7
    if (!Number.isFinite(this.unlockT) && this.surge < 0.002) return false

    if (Number.isFinite(this.unlockT)) {
      const { total } = this.beamPath
      const len = Math.max(140 * S, total * 0.2)
      const arrival = total / SPEED
      const end = Math.max((total + len) / SPEED, arrival + BURST)
      this.unlockT = reduced ? end : this.unlockT + dt
      const t = this.unlockT
      disposeChildren(this.cometGroup)

      const head = t * SPEED
      const tail = head - len
      if (tail < total) {
        // The receiver swallows the comet: clip it at the beam's end instead of stopping.
        const sub = this.subPath(Math.max(0, tail), Math.min(head, total))
        const color = new THREE.Color(this.level.laser.color)
        for (const [w, c, o] of [
          [16, color.clone().multiplyScalar(1.4), 0.6],
          [5, new THREE.Color(1, 1, 1).multiplyScalar(4), 1],
        ] as const) {
          const mesh = new THREE.Mesh(
            ribbon(sub, w * S, { joints: true }),
            new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
          )
          mesh.position.y = BEAM_Y + 0.002
          this.cometGroup.add(mesh)
        }
      }

      if (t >= arrival && !this.unlocked) {
        this.unlocked = true
        this.surge = 1
        this.pulseT = reduced ? 1 : 0
        this.emit()
      }

      // Burst ring expands out of the receiver as the comet lands.
      const b = (t - arrival) / BURST
      const bm = this.burst.material as THREE.MeshBasicMaterial
      if (b > 0 && b < 1 && !reduced) {
        const k = easeOut(b)
        this.burst.scale.setScalar(1 + k * 4)
        bm.opacity = 1 - k
      } else {
        bm.opacity = 0
      }
      if (t >= end) this.unlockT = Infinity
    }

    // Beam surge decays back to normal.
    this.surge = approach(this.surge, 0, dt, 0.35)
    const boost = 1 + this.surge * 1.8
    for (const child of this.beamGroup.children) {
      const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial
      const base = mat.userData.base as THREE.Color | undefined
      if (base) mat.color.copy(base).multiplyScalar(boost)
    }
    ;(this.receiver.halo.material as THREE.MeshBasicMaterial).opacity = 0.35 * this.litAmount + 0.5 * this.surge
    return true
  }

  /** Slice of the current beam polyline between two arc lengths. */
  private subPath(from: number, to: number) {
    const { pts, lengths } = this.beamPath
    const at = (d: number) => {
      let i = 1
      while (i < lengths.length - 1 && lengths[i] < d) i++
      const seg = lengths[i] - lengths[i - 1] || 1
      return { i, p: pts[i - 1].clone().lerp(pts[i], (d - lengths[i - 1]) / seg) }
    }
    const a = at(from)
    const b = at(to)
    const out = [a.p]
    for (let i = a.i; i < b.i; i++) out.push(pts[i])
    out.push(b.p)
    return out
  }

  // ---------------------------------------------------------------- input

  private hovered: string | null = null

  private pick(e: PointerEvent): { kind: 'handle' } | { kind: 'mirror'; id: string } | { kind: 'board' } {
    const ray = this.pointerRay(e)
    if (this.selected && this.dialAppear > 0.5) {
      if (ray.intersectObject(this.dialParts.handleHit, false).length) return { kind: 'handle' }
    }
    const targets = [...this.mirrors.values()].filter((m) => !m.def.fixed).map((m) => m.hit)
    const hit = ray.intersectObjects(targets, false)[0]
    if (hit) return { kind: 'mirror', id: hit.object.userData.mirrorId as string }
    return { kind: 'board' }
  }

  private onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return
    const p = this.pick(e)
    if (p.kind === 'handle') {
      this.dragging = true
      this.dragStartAngle = this.angles[this.selected!]
      this.renderer.domElement.setPointerCapture(e.pointerId)
      this.renderer.domElement.style.cursor = 'grabbing'
      this.emit()
    } else if (p.kind === 'mirror') {
      this.select(p.id)
    } else {
      this.select(null)
    }
  }

  private onPointerMove = (e: PointerEvent) => {
    if (this.dragging && this.selected) {
      const ray = this.pointerRay(e)
      const hit = new THREE.Vector3()
      if (!ray.ray.intersectPlane(this.boardPlane, hit)) return
      const b = this.toBoard(hit)
      const id = this.selected
      const m = this.mirrors.get(id)!.def
      const vx = b.x - m.x
      const vy = m.y - b.y
      const arm = clamp(Math.hypot(vx, vy), DIAL.minArm, DIAL.maxArm)
      this.shift = e.shiftKey
      const step = stepFor(arm, e.shiftKey)
      let deg = (Math.atan2(vy, vx) * 180) / Math.PI
      deg = Math.round(deg / step) * step
      this.angles[id] = Math.round(normalize(deg) * 10) / 10
      this.arms[id] = arm
      this.update()
      return
    }
    const p = this.pick(e)
    const hovered = p.kind === 'mirror' ? p.id : null
    if (hovered !== this.hovered) {
      this.hovered = hovered
      this.requestFrame()
    }
    this.renderer.domElement.style.cursor = p.kind === 'handle' ? 'grab' : p.kind === 'mirror' ? 'pointer' : 'default'
  }

  private onPointerUp = (e: PointerEvent) => {
    if (!this.dragging) return
    this.dragging = false
    this.shift = false
    if (this.renderer.domElement.hasPointerCapture(e.pointerId)) this.renderer.domElement.releasePointerCapture(e.pointerId)
    this.renderer.domElement.style.cursor = 'grab'
    if (this.selected && this.angles[this.selected] !== this.dragStartAngle) this.moves++
    this.emit()
  }

  private onPointerLeave = () => {
    if (this.hovered) {
      this.hovered = null
      this.requestFrame()
    }
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLElement && e.target.closest('input, textarea, [contenteditable]')) return
    if (e.key === 'Shift' && this.dragging) {
      this.shift = true
      this.emit()
      return
    }
    const step = e.shiftKey ? 15 : e.altKey ? 0.1 : 1
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      if (!this.selected) return
      e.preventDefault()
      this.nudge(step)
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      if (!this.selected) return
      e.preventDefault()
      this.nudge(-step)
    } else if (e.key === 'Escape') {
      this.select(null)
    } else if (e.key === 'Tab' && !(e.target instanceof HTMLButtonElement || e.target instanceof HTMLAnchorElement)) {
      e.preventDefault()
      this.cycleSelection(e.shiftKey ? -1 : 1)
    }
  }

  private onKeyUp = (e: KeyboardEvent) => {
    if (e.key === 'Shift' && this.shift) {
      this.shift = false
      this.emit()
    }
  }
}

function normalize(deg: number) {
  return ((deg % 360) + 360) % 360
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

/** Frame-rate independent exponential approach; `tau` is the time constant in seconds. */
function approach(current: number, target: number, dt: number, tau: number) {
  return target + (current - target) * Math.exp(-dt / tau)
}

function disposeChildren(group: THREE.Group) {
  for (const child of [...group.children]) {
    child.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
        o.geometry.dispose()
        const mats = Array.isArray(o.material) ? o.material : [o.material]
        mats.forEach((m: THREE.Material) => {
          ;(m as THREE.MeshStandardMaterial).map?.dispose()
          m.dispose()
        })
      }
    })
    group.remove(child)
  }
}

/** Flat overlay meshes are seen from above only, so render both faces regardless of winding. */
function flatDoubleSided(group: THREE.Object3D) {
  group.traverse((o) => {
    if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshBasicMaterial) o.material.side = THREE.DoubleSide
  })
}
