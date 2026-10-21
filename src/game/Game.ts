import * as THREE from 'three'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { dashedCircle, dotGridTexture, ribbon } from './geometry'
import { BEAM_Y, buildPieceView, disposeObject, PALETTE, type PieceView, S } from './pieceMeshes'
import { COLOR_HEX, PIECE_INFO, toBoard } from './pieces'
import type { LevelDef, Piece, PieceType } from './schema'
import { isSolved, receivers, trace } from './trace'
import type { TraceResult } from './types'

const DOT_CELL = 40
const SNAP = 10
const BACKGROUND = '#0C0D0F'

// Dial radii in board pixels (from the approved design).
const DIAL = { inner: 48, fine: 110, finest: 180, minArm: 60, maxArm: 240, defaultArm: 80 }
const DIAL_Y = 0.004

export type GameMode = 'play' | 'edit'

export type GameSnapshot = {
  mode: GameMode
  level: LevelDef
  pieces: Piece[]
  /** Kit pieces still waiting in the tray (play mode). */
  tray: Piece[]
  selected: Piece | null
  dragging: boolean
  goals: { lit: number; total: number }
  solved: boolean
  /** True once the unlock light has reached the receivers; the finish button opens then. */
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

type Drag =
  | { kind: 'rotate'; id: string; startAngle: number }
  | { kind: 'move'; id: string; dx: number; dy: number; startX: number; startY: number; moved: boolean; fromTray: boolean }
  | { kind: 'resize'; id: string; hx: -1 | 0 | 1; hy: -1 | 0 | 1; anchor: { x: number; y: number } }

type ViewEntry = { view: PieceView; key: string }

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
  private container: HTMLElement
  /** Screen space kept free above and below the board for HUD bars, in CSS px. */
  private insets = { top: 84, bottom: 112 }

  private boardGroup = new THREE.Group()
  private pieceGroup = new THREE.Group()
  private beamGroup = new THREE.Group()
  private cometGroup = new THREE.Group()
  private dialGroup = new THREE.Group()
  private handleGroup = new THREE.Group()
  private views = new Map<string, ViewEntry>()
  private dialParts!: {
    arm: THREE.Mesh
    refDot: THREE.Mesh
    handle: THREE.Group
    handleHit: THREE.Mesh
    materials: THREE.MeshBasicMaterial[]
  }

  private mode: GameMode = 'play'
  private level!: LevelDef
  private pieces: Piece[] = []
  private tray: Piece[] = []
  private arms: Record<string, number> = {}
  private selected: string | null = null
  private hovered: string | null = null
  private drag: Drag | null = null
  private shift = false
  private moves = 0
  private result!: TraceResult
  private snapshot!: GameSnapshot

  // Animated values, eased toward their targets each frame.
  private litAmount = new Map<string, number>()
  private pulses = new Map<string, number>()
  private dialAppear = 0
  private dialTarget = 0
  // Unlock sequence: light races down every beam at constant speed, receivers burst on arrival.
  private solved = false
  private unlocked = false
  /** Seconds into the unlock sequence; Infinity when it isn't playing. */
  private unlockT = Infinity
  private surge = 0

  constructor(container: HTMLElement) {
    this.container = container
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setClearColor(BACKGROUND)
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

    this.scene.background = new THREE.Color(BACKGROUND)
    this.scene.add(new THREE.HemisphereLight('#c9d4e3', '#0b0c0e', 0.6))
    const sun = new THREE.DirectionalLight('#ffffff', 0.9)
    sun.position.set(-4, 9, 3)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 6, bottom: -6 })
    sun.shadow.radius = 4
    sun.shadow.bias = -0.0005
    this.scene.add(sun)

    this.scene.add(this.boardGroup, this.pieceGroup, this.beamGroup, this.cometGroup, this.dialGroup, this.handleGroup)
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

  load(level: LevelDef, mode: GameMode) {
    const sameBoard = this.level && this.level.width === level.width && this.level.height === level.height
    this.level = level
    this.mode = mode
    this.pieces = level.pieces.filter((p) => mode === 'edit' || p.lock !== 'kit').map((p) => ({ ...p }))
    this.tray = mode === 'play' ? level.pieces.filter((p) => p.lock === 'kit').map((p) => ({ ...p })) : []
    this.arms = {}
    this.moves = 0
    this.selected = null
    this.drag = null
    this.dialAppear = this.dialTarget = 0
    this.litAmount.clear()
    this.pulses.clear()
    this.solved = this.unlocked = false
    this.unlockT = Infinity
    this.surge = 0
    if (!sameBoard) this.buildBoard()
    for (const { view } of this.views.values()) {
      this.pieceGroup.remove(view.root)
      disposeObject(view.root)
    }
    this.views.clear()
    this.update()
    this.resize()
  }

  reset() {
    this.load(this.level, this.mode)
  }

  setInsets(top: number, bottom: number) {
    this.insets = { top, bottom }
    this.resize()
  }

  /** The level as currently arranged on the board (edit mode saves this). */
  currentLevel(): LevelDef {
    return { ...this.level, pieces: [...this.pieces.map((p) => ({ ...p })), ...this.tray.map((p) => ({ ...p }))] }
  }

  select(id: string | null) {
    if (id === this.selected) return
    this.selected = id
    if (id && this.canRotate(this.piece(id)!)) {
      this.dialAppear = prefersReducedMotion() ? 1 : 0
      this.dialTarget = 1
    } else {
      this.dialTarget = 0
      if (!id) this.dialAppear = Math.min(this.dialAppear, 1)
    }
    this.update()
  }

  /** Changes a piece's properties (edit mode inspector). */
  updatePiece(id: string, patch: Partial<Piece>) {
    this.pieces = this.pieces.map((p) => (p.id === id ? ({ ...p, ...patch } as Piece) : p))
    this.update()
  }

  removePiece(id: string) {
    this.pieces = this.pieces.filter((p) => p.id !== id)
    if (this.selected === id) this.select(null)
    this.update()
  }

  clear() {
    this.pieces = []
    this.selected = null
    this.update()
  }

  /** Adds a new piece of `type` in the middle of the board (palette click). */
  addPiece(type: PieceType) {
    const piece = this.makePiece(type, this.level.width / 2, this.level.height / 2)
    this.pieces.push(piece)
    this.select(piece.id)
    this.update()
  }

  /**
   * Starts dragging a new piece (from the sandbox palette) or a kit piece (from the tray) onto
   * the board. The pointer began outside the canvas, so this follows it at window level.
   */
  beginPlace(source: PieceType | string, e: PointerEvent) {
    const fromTray = this.tray.find((p) => p.id === source)
    let placed: Piece | null = null
    let moved = false
    const startX = e.clientX
    const startY = e.clientY
    const onMove = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 4) return
      moved = true
      const b = this.pointerToBoard(ev)
      const inside = b && this.insideBoard(b.x, b.y)
      if (inside && !placed) {
        placed = fromTray ? { ...fromTray } : this.makePiece(source as PieceType, b.x, b.y)
        if (fromTray) this.tray = this.tray.filter((p) => p.id !== fromTray.id)
        this.pieces.push(placed)
        this.selected = placed.id
        this.dialTarget = 0
      }
      if (placed && b) {
        const p = placed
        this.pieces = this.pieces.map((q) => (q.id === p.id ? { ...q, x: this.snap(b.x), y: this.snap(b.y) } : q))
        if (!inside) {
          // Dragged back off the board: put it away again.
          this.pieces = this.pieces.filter((q) => q.id !== p.id)
          if (fromTray) this.tray.push(fromTray)
          placed = null
          this.selected = null
        }
        this.update()
      }
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      if (!moved) {
        if (fromTray) this.placeFromTray(fromTray.id)
        else this.addPiece(source as PieceType)
        return
      }
      if (placed) {
        if (fromTray) this.moves++
        const id = (placed as Piece).id
        this.selected = null
        this.select(id)
      }
      this.emit()
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  /** Rotates the selected piece by `delta` degrees (keyboard control). */
  nudge(delta: number) {
    const p = this.selected ? this.piece(this.selected) : null
    if (!p || !this.canRotate(p)) return
    this.setPiece(p.id, { angle: normalize(p.angle + delta) })
    this.moves++
    this.update()
  }

  cycleSelection(dir: 1 | -1) {
    const free = this.pieces.filter((p) => this.canRotate(p) || this.canMove(p))
    if (!free.length) return
    const i = free.findIndex((p) => p.id === this.selected)
    this.select(free[(i + dir + free.length) % free.length].id)
  }

  /** Board pixel → CSS pixel position inside the canvas. */
  toScreen(x: number, y: number) {
    const v = this.toWorld(x, y, DIAL_Y).project(this.camera)
    const r = this.renderer.domElement.getBoundingClientRect()
    return { x: ((v.x + 1) / 2) * r.width, y: ((1 - v.y) / 2) * r.height }
  }

  dispose() {
    cancelAnimationFrame(this.frame)
    this.resizeObserver.disconnect()
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    disposeObject(this.scene)
    this.composer.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  // ------------------------------------------------------------- helpers

  private piece(id: string) {
    return this.pieces.find((p) => p.id === id)
  }

  private setPiece(id: string, patch: Partial<Piece>) {
    this.pieces = this.pieces.map((p) => (p.id === id ? ({ ...p, ...patch } as Piece) : p))
  }

  private canRotate(p: Piece) {
    if (!PIECE_INFO[p.type].rotatable) return false
    return this.mode === 'edit' || p.lock !== 'fixed'
  }

  private canMove(p: Piece) {
    return this.mode === 'edit' || p.lock === 'kit'
  }

  private snap(v: number) {
    return Math.round(v / SNAP) * SNAP
  }

  private insideBoard(x: number, y: number) {
    return x >= 0 && y >= 0 && x <= this.level.width && y <= this.level.height
  }

  private makePiece(type: PieceType, x: number, y: number): Piece {
    let n = 1
    const prefix = type.replace('double-mirror', 'dmirror')
    while (this.pieces.some((p) => p.id === `${prefix}${n}`) || this.tray.some((p) => p.id === `${prefix}${n}`)) n++
    const base = { id: `${prefix}${n}`, x: this.snap(x), y: this.snap(y), angle: type === 'mirror' || type === 'double-mirror' || type === 'splitter' ? 135 : 0, lock: 'rotate' as const }
    switch (type) {
      case 'laser':
        return { ...base, type, color: 'yellow', lock: 'fixed' }
      case 'prism':
        return { ...base, type, size: 90 }
      case 'glass':
        return { ...base, type, w: 100, h: 60 }
      case 'filter':
        return { ...base, type, color: 'red' }
      case 'receiver':
        return { ...base, type, lock: 'fixed' }
      case 'tube':
        return { ...base, type, cone: 8, angle: 180, lock: 'fixed' }
      case 'wall':
        return { ...base, type, w: 60, h: 120, lock: 'fixed' }
      default:
        return { ...base, type } as Piece
    }
  }

  private placeFromTray(id: string) {
    const p = this.tray.find((q) => q.id === id)
    if (!p) return
    // Drop it at its own spot if free, else the board centre.
    this.tray = this.tray.filter((q) => q.id !== id)
    this.pieces.push({ ...p, x: this.snap(this.level.width / 2), y: this.snap(this.level.height / 2) })
    this.moves++
    this.select(id)
    this.update()
  }

  // ------------------------------------------------------------- coordinates

  private toWorld(x: number, y: number, h = 0) {
    return new THREE.Vector3((x - this.level.width / 2) * S, h, (y - this.level.height / 2) * S)
  }

  private toBoardXY(v: THREE.Vector3) {
    return { x: v.x / S + this.level.width / 2, y: v.z / S + this.level.height / 2 }
  }

  private pointerRay(e: { clientX: number; clientY: number }) {
    const r = this.renderer.domElement.getBoundingClientRect()
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
    this.raycaster.setFromCamera(ndc, this.camera)
    return this.raycaster
  }

  private pointerToBoard(e: { clientX: number; clientY: number }) {
    const hit = new THREE.Vector3()
    if (!this.pointerRay(e).ray.intersectPlane(this.boardPlane, hit)) return null
    return this.toBoardXY(hit)
  }

  // ------------------------------------------------------------------ build

  private buildBoard() {
    disposeObject(this.boardGroup)
    this.boardGroup.clear()
    const { width: W, height: H } = this.level
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry((W + 24) * S, 0.12, (H + 24) * S),
      new THREE.MeshStandardMaterial({ color: '#101214', roughness: 0.95 }),
    )
    frame.position.y = -0.065
    frame.receiveShadow = true
    const tex = dotGridTexture(DOT_CELL, 1.3, '#131518', '#262A2F')
    tex.repeat.set(W / DOT_CELL, H / DOT_CELL)
    const board = new THREE.Mesh(new THREE.PlaneGeometry(W * S, H * S), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }))
    board.rotation.x = -Math.PI / 2
    board.receiveShadow = true
    this.boardGroup.add(frame, board)
  }

  /** Creates, rebuilds or moves each piece's 3D view to match state. */
  private syncViews() {
    const seen = new Set<string>()
    for (const p of this.pieces) {
      seen.add(p.id)
      const { x: _x, y: _y, angle: _a, ...shape } = p
      const key = JSON.stringify(shape)
      let entry = this.views.get(p.id)
      if (!entry || entry.key !== key) {
        if (entry) {
          this.pieceGroup.remove(entry.view.root)
          disposeObject(entry.view.root)
        }
        entry = { view: buildPieceView(p), key }
        this.views.set(p.id, entry)
        this.pieceGroup.add(entry.view.root)
      }
      entry.view.root.position.copy(this.toWorld(p.x, p.y))
      entry.view.pivot.rotation.y = (p.angle * Math.PI) / 180
    }
    for (const [id, entry] of this.views) {
      if (seen.has(id)) continue
      this.pieceGroup.remove(entry.view.root)
      disposeObject(entry.view.root)
      this.views.delete(id)
    }
  }

  private buildDial() {
    const mat = (opacity: number) =>
      new THREE.MeshBasicMaterial({ color: PALETTE.dial, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide })
    const guideMat = new THREE.MeshBasicMaterial({ color: '#3a4049', transparent: true, opacity: 1, depthWrite: false, side: THREE.DoubleSide })
    const fillMat = new THREE.MeshBasicMaterial({ color: BACKGROUND, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide })

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
      ;(isMajor ? major : minor).push(
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
    const handleFillMat = new THREE.MeshBasicMaterial({ color: BACKGROUND, transparent: true, depthWrite: false, side: THREE.DoubleSide })
    const handleFill = new THREE.Mesh(new THREE.CircleGeometry(10 * S, 32), handleFillMat)
    const handleRingMat = mat(1)
    const handleRing = new THREE.Mesh(new THREE.RingGeometry(8.5 * S, 11.5 * S, 32), handleRingMat)
    handleRing.position.y = 0.0005
    const handleHit = new THREE.Mesh(new THREE.CircleGeometry(24 * S, 24), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide }))
    handle.add(handleFill, handleRing, handleHit)

    // Ribbons are built flat already; primitives need laying down on the board.
    for (const m of [fill, inner, refDot, handleFill, handleRing, handleHit]) m.rotation.x = -Math.PI / 2
    arm.position.y = 0.0002
    refDot.position.y = 0.0006
    handle.position.y = 0.001
    this.dialGroup.add(fill, inner, fine, finest, ticksMinor, ticksMajor, arm, refDot, handle)
    this.dialGroup.position.y = DIAL_Y
    this.dialGroup.visible = false

    const materials = [fillMat, innerMat, guideMat, minorMat, majorMat, armMat, refDotMat, handleFillMat, handleRingMat]
    for (const m of materials) m.userData.baseOpacity = m.opacity
    this.dialParts = { arm, refDot, handle, handleHit, materials }
  }

  // ----------------------------------------------------------------- update

  /** Re-traces the beams and syncs every scene object and the snapshot to state. */
  private update() {
    this.syncViews()
    this.result = trace(this.level, this.pieces)
    const solved = this.mode === 'play' && isSolved(this.pieces, this.result) && this.tray.every((p) => !p.mustHit)
    if (solved && !this.solved) {
      this.unlockT = 0
      this.unlocked = false
    } else if (!solved) {
      this.unlockT = Infinity
      this.unlocked = false
      disposeObject(this.cometGroup)
      this.cometGroup.clear()
    }
    this.solved = solved
    this.buildBeams()
    this.updateDial()
    this.updateResizeHandles()
    this.emit()
    this.requestFrame()
  }

  private buildBeams() {
    disposeObject(this.beamGroup)
    this.beamGroup.clear()
    const byMask = new Map<number, THREE.Vector2[]>()
    for (const s of this.result.segments) {
      const a = this.toWorld(s.x1, s.y1)
      const b = this.toWorld(s.x2, s.y2)
      const list = byMask.get(s.mask) ?? []
      list.push(new THREE.Vector2(a.x, a.z), new THREE.Vector2(b.x, b.z))
      byMask.set(s.mask, list)
    }
    for (const [mask, pts] of byMask) {
      const color = new THREE.Color(COLOR_HEX[mask])
      const layer = (width: number, c: THREE.Color, opacity: number, y: number) => {
        const mat = new THREE.MeshBasicMaterial({
          color: c,
          transparent: true,
          opacity,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
        })
        mat.userData.base = c.clone()
        const mesh = new THREE.Mesh(ribbon(pts, width * S, { joints: true, pairs: true }), mat)
        mesh.position.y = y
        this.beamGroup.add(mesh)
      }
      // Light spill on the board, then the beam itself: coloured body and a hot white core.
      layer(22, color.clone().multiplyScalar(0.12), 1, 0.002)
      layer(5, color.clone().multiplyScalar(0.9), 0.85, BEAM_Y)
      layer(2.4, color.clone().multiplyScalar(1.8), 1, BEAM_Y + 0.0005)
      layer(1, new THREE.Color(1, 1, 1).multiplyScalar(1.6), 1, BEAM_Y + 0.001)
    }
    // Impact flares where beams stop on something other than a receiver.
    for (const s of this.result.segments) {
      const end = this.toWorld(s.x2, s.y2, BEAM_Y)
      const ends = this.result.segments.some((o) => o !== s && Math.abs(o.x1 - s.x2) < 0.01 && Math.abs(o.y1 - s.y2) < 0.01)
      if (ends) continue
      const flare = new THREE.Mesh(
        new THREE.CircleGeometry(6 * S, 20),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(COLOR_HEX[s.mask]).multiplyScalar(2.5), transparent: true, depthWrite: false, side: THREE.DoubleSide }),
      )
      flare.rotation.x = -Math.PI / 2
      flare.position.copy(end)
      this.beamGroup.add(flare)
    }
  }

  private updateDial() {
    const p = this.selected ? this.piece(this.selected) : null
    if (!p || !this.canRotate(p)) return
    const a = (p.angle * Math.PI) / 180
    const arm = this.arms[p.id] ?? DIAL.defaultArm
    const c = Math.cos(a)
    const s = -Math.sin(a)
    const w = this.toWorld(p.x, p.y)
    this.dialGroup.position.x = w.x
    this.dialGroup.position.z = w.z
    const { arm: armMesh, refDot, handle } = this.dialParts
    armMesh.geometry.dispose()
    armMesh.geometry = ribbon([new THREE.Vector2(0, 0), new THREE.Vector2(c * arm * S, s * arm * S)], 1.5 * S)
    refDot.position.set(c * DIAL.inner * S, refDot.position.y, s * DIAL.inner * S)
    handle.position.set(c * arm * S, handle.position.y, s * arm * S)
  }

  /** Eight resize handles around a selected wall or glass block (edit mode). */
  private updateResizeHandles() {
    disposeObject(this.handleGroup)
    this.handleGroup.clear()
    const p = this.selected ? this.piece(this.selected) : null
    if (!p || this.mode !== 'edit' || (p.type !== 'wall' && p.type !== 'glass')) return
    const outline: THREE.Vector2[] = []
    const corners = [
      [-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1],
    ]
    for (const [sx, sy] of corners) {
      const b = toBoard(p, (sx * (p.w + 12)) / 2, (sy * (p.h + 12)) / 2)
      const w = this.toWorld(b.x, b.y)
      outline.push(new THREE.Vector2(w.x, w.z))
    }
    const lineMat = new THREE.MeshBasicMaterial({ color: PALETTE.dial, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide })
    const line = new THREE.Mesh(ribbon(outline, 1.4 * S), lineMat)
    line.position.y = 0.29
    this.handleGroup.add(line)
    for (const hx of [-1, 0, 1] as const) {
      for (const hy of [-1, 0, 1] as const) {
        if (!hx && !hy) continue
        const b = toBoard(p, (hx * (p.w + 12)) / 2, (hy * (p.h + 12)) / 2)
        const g = new THREE.Group()
        g.position.copy(this.toWorld(b.x, b.y, 0.29))
        g.rotation.y = (p.angle * Math.PI) / 180
        const fill = new THREE.Mesh(new THREE.PlaneGeometry(10 * S, 10 * S), new THREE.MeshBasicMaterial({ color: BACKGROUND, side: THREE.DoubleSide }))
        const ring = new THREE.Mesh(
          new THREE.RingGeometry(5 * S, 7 * S, 4, 1, Math.PI / 4),
          new THREE.MeshBasicMaterial({ color: PALETTE.dial, side: THREE.DoubleSide }),
        )
        const hit = new THREE.Mesh(new THREE.PlaneGeometry(26 * S, 26 * S), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide }))
        for (const m of [fill, ring, hit]) m.rotation.x = -Math.PI / 2
        ring.position.y = 0.001
        hit.userData.resize = { hx, hy }
        g.add(fill, ring, hit)
        this.handleGroup.add(g)
      }
    }
  }

  private emit() {
    const sel = this.selected ? (this.piece(this.selected) ?? null) : null
    let dial: GameSnapshot['dial'] = null
    if (sel && this.canRotate(sel) && this.renderer.domElement.clientWidth > 0 && !(this.drag?.kind === 'move')) {
      const a = (sel.angle * Math.PI) / 180
      const arm = this.arms[sel.id] ?? DIAL.defaultArm
      const step = stepFor(arm, this.shift)
      dial = {
        ...this.toScreen(sel.x + Math.cos(a) * (arm + 52), sel.y - Math.sin(a) * (arm + 52)),
        deg: sel.angle.toFixed(1) + '°',
        step: this.shift ? 'snap 15°' : `${step}° steps`,
      }
    }
    const goals = receivers(this.pieces)
    const must = [...this.pieces, ...this.tray].filter((p) => p.mustHit)
    this.snapshot = {
      mode: this.mode,
      level: this.level,
      pieces: this.pieces,
      tray: this.tray,
      selected: sel,
      dragging: this.drag !== null,
      goals: { lit: goals.filter((g) => this.result.lit.has(g.id)).length, total: goals.length },
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
    const reserveTop = this.insets.top
    const reserveBottom = this.insets.bottom
    const boardW = (this.level.width + 80) * S
    const boardH = (this.level.height + 60) * S
    const availH = Math.max(0.3, (h - reserveTop - reserveBottom) / h)
    const vFov = (this.camera.fov * Math.PI) / 180
    const distH = boardH / availH / 2 / Math.tan(vFov / 2)
    const distW = boardW / 2 / (Math.tan(vFov / 2) * this.camera.aspect)
    const dist = Math.max(distH, distW) * 1.02
    // Shift the look target so the board sits between the HUD bars.
    const offset = ((reserveBottom - reserveTop) / h) * dist * Math.tan(vFov / 2)
    this.camera.position.set(0, Math.cos(tilt) * dist, Math.sin(tilt) * dist + offset)
    this.camera.lookAt(new THREE.Vector3(0, 0, offset))
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
    const dialTarget = this.drag?.kind === 'move' ? 0 : this.dialTarget
    if (this.dialAppear !== dialTarget) {
      const d = dialTarget - this.dialAppear
      const speed = d > 0 ? 1 / 0.18 : 1 / 0.12
      this.dialAppear = reduced ? dialTarget : this.dialAppear + Math.sign(d) * Math.min(Math.abs(d), dt * speed)
      busy = true
    }
    const k = easeOut(this.dialAppear)
    this.dialGroup.visible = this.dialAppear > 0.001
    this.dialGroup.scale.setScalar(reduced ? 1 : 0.94 + 0.06 * k)
    for (const m of this.dialParts.materials) m.opacity = (m.userData.baseOpacity as number) * k

    for (const p of this.pieces) {
      const view = this.views.get(p.id)?.view
      if (!view) continue
      // Selection / hover ring.
      const interactive = this.canRotate(p) || this.canMove(p)
      const target = p.id === this.selected ? (this.canRotate(p) ? 0 : 0.8) : p.id === this.hovered && interactive ? 0.45 : interactive && this.mode === 'play' ? 0.12 : 0
      const mat = view.base.material as THREE.MeshBasicMaterial
      mat.opacity = approach(mat.opacity, target, dt, 0.08)
      if (Math.abs(mat.opacity - target) > 0.002) busy = true

      // Receiver glow eases in quickly; light reaching a target should feel immediate.
      if (view.sensor) {
        const lit = this.result.lit.has(p.id) ? 1 : 0
        const was = this.litAmount.get(p.id) ?? 0
        if (lit && was < 0.05 && !reduced && !this.pulses.has(p.id)) this.pulses.set(p.id, 0)
        const now = approach(was, lit, dt, 0.06)
        this.litAmount.set(p.id, now)
        if (Math.abs(now - lit) > 0.002) busy = true
        const s = view.sensor
        s.ring.color.copy(s.color).multiplyScalar(0.42 + (2.2 - 0.42) * now)
        s.core.color.copy(s.color).multiplyScalar(0.16 + (4 - 0.16) * now)
        ;(s.halo.material as THREE.MeshBasicMaterial).opacity = 0.35 * now + 0.5 * this.surge * now
        const pt = this.pulses.get(p.id)
        if (pt !== undefined) {
          const t = Math.min(1, pt + dt / 0.6)
          const e = easeOut(t)
          s.pulse.scale.setScalar(1 + e * 1.6)
          ;(s.pulse.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - e)
          if (t >= 1) this.pulses.delete(p.id)
          else this.pulses.set(p.id, t)
          busy = true
        }
        if (!lit) this.pulses.delete(p.id)
      }

      // Must-hit outline turns solid once a beam touches the piece.
      if (view.mustRing) {
        const hit = this.result.hits.has(p.id) ? 1 : 0
        const sm = view.mustRing.solid.material as THREE.MeshBasicMaterial
        sm.opacity = approach(sm.opacity, hit, dt, 0.06)
        ;(view.mustRing.dashed.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - sm.opacity)
        if (Math.abs(sm.opacity - hit) > 0.002) busy = true
      }
    }

    busy = this.animateUnlock(dt, reduced) || busy
    return busy
  }

  /**
   * Plays the unlock: light runs at constant speed from every laser along every branch and
   * flows into the receivers. As it lands, each receiver bursts and the beams surge brighter.
   */
  private animateUnlock(dt: number, reduced: boolean) {
    const SPEED = 1500 // board px per second; constant so the light never slows down
    const BURST = 0.7
    if (!Number.isFinite(this.unlockT) && this.surge < 0.002) return false

    if (Number.isFinite(this.unlockT)) {
      const segs = this.result.segments
      const maxD = segs.reduce((m, s) => Math.max(m, s.d1), 0)
      const arrival = Math.max(0, ...this.result.lit.values()) / SPEED
      const len = Math.max(140, maxD * 0.2)
      const end = Math.max((maxD + len) / SPEED, arrival + BURST)
      this.unlockT = reduced ? end : this.unlockT + dt
      const t = this.unlockT
      disposeObject(this.cometGroup)
      this.cometGroup.clear()

      const head = t * SPEED
      const tail = head - len
      const byMask = new Map<number, THREE.Vector2[]>()
      for (const s of segs) {
        const from = Math.max(s.d0, tail)
        const to = Math.min(s.d1, head)
        if (to <= from) continue
        const span = s.d1 - s.d0 || 1
        const at = (d: number) => {
          const f = (d - s.d0) / span
          const w = this.toWorld(s.x1 + (s.x2 - s.x1) * f, s.y1 + (s.y2 - s.y1) * f)
          return new THREE.Vector2(w.x, w.z)
        }
        const list = byMask.get(s.mask) ?? []
        list.push(at(from), at(to))
        byMask.set(s.mask, list)
      }
      for (const [mask, pts] of byMask) {
        const color = new THREE.Color(COLOR_HEX[mask])
        for (const [w, c, o] of [
          [16, color.clone().multiplyScalar(1.4), 0.6],
          [5, new THREE.Color(1, 1, 1).multiplyScalar(4), 1],
        ] as const) {
          const mesh = new THREE.Mesh(
            ribbon(pts, w * S, { joints: true, pairs: true }),
            new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
          )
          mesh.position.y = BEAM_Y + 0.002
          this.cometGroup.add(mesh)
        }
      }

      // Each receiver bursts as the light reaches it.
      for (const [id, d] of this.result.lit) {
        const view = this.views.get(id)?.view
        if (!view?.sensor) continue
        const b = (t - d / SPEED) / BURST
        const bm = view.sensor.burst.material as THREE.MeshBasicMaterial
        if (b > 0 && b < 1 && !reduced) {
          const k = easeOut(b)
          view.sensor.burst.scale.setScalar(1 + k * 4)
          bm.opacity = 1 - k
        } else bm.opacity = 0
      }

      if (t >= arrival && !this.unlocked) {
        this.unlocked = true
        this.surge = 1
        this.emit()
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
    return true
  }

  // ---------------------------------------------------------------- input

  private pick(e: PointerEvent):
    | { kind: 'handle' }
    | { kind: 'resize'; hx: -1 | 0 | 1; hy: -1 | 0 | 1 }
    | { kind: 'piece'; id: string }
    | { kind: 'board' } {
    const ray = this.pointerRay(e)
    if (this.selected && this.dialAppear > 0.5 && ray.intersectObject(this.dialParts.handleHit, false).length) return { kind: 'handle' }
    const rh = ray.intersectObjects(this.handleGroup.children, true).find((h) => h.object.userData.resize)
    if (rh) return { kind: 'resize', ...(rh.object.userData.resize as { hx: -1 | 0 | 1; hy: -1 | 0 | 1 }) }
    const targets = [...this.views.values()].map((v) => v.view.hit)
    const hit = ray.intersectObjects(targets, false)[0]
    if (hit) return { kind: 'piece', id: hit.object.userData.pieceId as string }
    return { kind: 'board' }
  }

  private onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return
    const el = this.renderer.domElement
    const p = this.pick(e)
    if (p.kind === 'handle') {
      const piece = this.piece(this.selected!)!
      this.drag = { kind: 'rotate', id: piece.id, startAngle: piece.angle }
      el.setPointerCapture(e.pointerId)
      el.style.cursor = 'grabbing'
      this.emit()
    } else if (p.kind === 'resize') {
      const piece = this.piece(this.selected!)!
      if (piece.type !== 'wall' && piece.type !== 'glass') return
      // The opposite edge or corner stays put while dragging.
      this.drag = { kind: 'resize', id: piece.id, hx: p.hx, hy: p.hy, anchor: toBoard(piece, (-p.hx * piece.w) / 2, (-p.hy * piece.h) / 2) }
      el.setPointerCapture(e.pointerId)
      this.emit()
    } else if (p.kind === 'piece') {
      const piece = this.piece(p.id)!
      if (this.selected !== p.id) this.select(p.id)
      if (this.canMove(piece)) {
        const b = this.pointerToBoard(e)
        if (b) {
          this.drag = { kind: 'move', id: piece.id, dx: piece.x - b.x, dy: piece.y - b.y, startX: piece.x, startY: piece.y, moved: false, fromTray: false }
          el.setPointerCapture(e.pointerId)
        }
      }
    } else {
      this.select(null)
    }
  }

  private onPointerMove = (e: PointerEvent) => {
    const drag = this.drag
    const el = this.renderer.domElement
    if (drag) {
      const b = this.pointerToBoard(e)
      if (!b) return
      const p = this.piece(drag.id)
      if (!p) return
      if (drag.kind === 'rotate') {
        const vx = b.x - p.x
        const vy = p.y - b.y
        const arm = clamp(Math.hypot(vx, vy), DIAL.minArm, DIAL.maxArm)
        this.shift = e.shiftKey
        const step = stepFor(arm, e.shiftKey)
        const deg = Math.round(((Math.atan2(vy, vx) * 180) / Math.PI) / step) * step
        this.setPiece(p.id, { angle: Math.round(normalize(deg) * 10) / 10 })
        this.arms[p.id] = arm
      } else if (drag.kind === 'move') {
        const x = this.snap(b.x + drag.dx)
        const y = this.snap(b.y + drag.dy)
        if (!drag.moved && Math.hypot(x - drag.startX, y - drag.startY) < SNAP) return
        drag.moved = true
        el.style.cursor = 'grabbing'
        this.setPiece(p.id, { x, y })
      } else if (drag.kind === 'resize' && (p.type === 'wall' || p.type === 'glass')) {
        // Work in the piece's own frame so rotated glass resizes along its sides.
        const r = (p.angle * Math.PI) / 180
        const c = Math.cos(r)
        const s = Math.sin(r)
        const dx = b.x - drag.anchor.x
        const dy = b.y - drag.anchor.y
        const lx = dx * c - dy * s
        const ly = dx * s + dy * c
        const w = drag.hx ? Math.max(SNAP * 2, this.snap(Math.abs(lx))) : p.w
        const h = drag.hy ? Math.max(SNAP * 2, this.snap(Math.abs(ly))) : p.h
        const centre = toBoard({ ...drag.anchor, angle: p.angle }, (drag.hx * w) / 2, (drag.hy * h) / 2)
        this.setPiece(p.id, { w, h, x: drag.hx ? centre.x : p.x, y: drag.hy ? centre.y : p.y } as Partial<Piece>)
      }
      this.update()
      return
    }
    const p = this.pick(e)
    const hovered = p.kind === 'piece' ? p.id : null
    if (hovered !== this.hovered) {
      this.hovered = hovered
      this.requestFrame()
    }
    const piece = hovered ? this.piece(hovered) : null
    el.style.cursor =
      p.kind === 'handle' ? 'grab' : p.kind === 'resize' ? 'nwse-resize' : piece && this.canMove(piece) ? 'move' : piece && this.canRotate(piece) ? 'pointer' : 'default'
  }

  private onPointerUp = (e: PointerEvent) => {
    const drag = this.drag
    if (!drag) return
    this.drag = null
    this.shift = false
    const el = this.renderer.domElement
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
    el.style.cursor = 'default'
    const p = this.piece(drag.id)
    if (drag.kind === 'rotate' && p && p.angle !== drag.startAngle) this.moves++
    if (drag.kind === 'move' && p && drag.moved) {
      const b = this.pointerToBoard(e)
      if (!b || !this.insideBoard(b.x, b.y)) {
        // Dropped off the board: kit pieces go back to the tray, sandbox pieces are deleted.
        this.pieces = this.pieces.filter((q) => q.id !== p.id)
        if (this.mode === 'play') this.tray.push({ ...p })
        this.selected = null
        this.dialTarget = 0
      } else {
        this.moves++
        if (this.canRotate(p)) {
          this.dialAppear = prefersReducedMotion() ? 1 : 0
          this.dialTarget = 1
        }
      }
    }
    this.update()
  }

  private onPointerLeave = () => {
    if (this.hovered) {
      this.hovered = null
      this.requestFrame()
    }
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable]')) return
    if (e.key === 'Shift' && this.drag?.kind === 'rotate') {
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
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && this.mode === 'edit' && this.selected) {
      e.preventDefault()
      this.removePiece(this.selected)
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

