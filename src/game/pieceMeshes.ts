import * as THREE from 'three'
import { ribbon } from './geometry'
import {
  colorHex,
  concaveLocal,
  FILTER_HALF,
  halfSize,
  LENS_HALF,
  localPolygon,
  MIRROR_HALF,
  PLATE_HALF,
  RECEIVER_R,
  playerCanResize,
  playerCanRotate,
  RETRO_HALF,
  scaleOf,
  SPLITTER_HALF,
  TUBE,
} from './pieces'
import type { Piece } from './schema'
import type { Vec2 } from './types'

/** World units per board pixel. */
export const S = 0.01
export const BEAM_Y = 0.07
/** Sensor ring and core brightness while dark. */
export const SENSOR_IDLE = { ring: 0.75, core: 0.35 }

export const PALETTE = {
  wall: '#24272C',
  wallEdge: '#33373D',
  mirrorBack: '#2C3036',
  mirrorFace: '#DDE1E6',
  plate: '#16181B',
  dial: '#4FA8FF',
  amber: '#FFC940',
  receiverDark: '#6B5A26',
  receiverCore: '#2A2617',
  glass: '#9CCFFF',
  glassEdge: '#6E8CA8',
}

export type PieceView = {
  root: THREE.Group
  /** Rotates with the piece angle. */
  pivot: THREE.Group
  /** Invisible pick target. */
  hit: THREE.Mesh
  /** Selection / hover ring. */
  base: THREE.Mesh
  mustRing?: { dashed: THREE.Mesh; solid: THREE.Mesh }
  sensor?: { ring: THREE.MeshBasicMaterial; core: THREE.MeshBasicMaterial; halo: THREE.Mesh; pulse: THREE.Mesh; burst: THREE.Mesh; color: THREE.Color }
}

const std = (color: string, opts: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.2, ...opts })

function box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = h / 2, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
  m.position.set(x, y, z)
  m.castShadow = true
  m.receiveShadow = true
  return m
}

function flat(geo: THREE.BufferGeometry, mat: THREE.Material, y: number) {
  const m = new THREE.Mesh(geo, mat)
  m.rotation.x = -Math.PI / 2
  m.position.y = y
  return m
}

function glassMaterial() {
  return new THREE.MeshStandardMaterial({
    color: PALETTE.glass,
    transparent: true,
    opacity: 0.16,
    roughness: 0.05,
    metalness: 0.1,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
}

function edges(geo: THREE.BufferGeometry, color: string) {
  return new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color }))
}

function flatOptic(half: number, face: string, back: string | null, opts: { faceOpacity?: number; emissive?: string } = {}) {
  const g = new THREE.Group()
  const len = half * 2 * S
  if (back) g.add(box(6 * S, 0.15, len, std(back, { roughness: 0.5, metalness: 0.3 }), -4 * S))
  const faceMat = std(face, {
    roughness: 0.25,
    metalness: 0.6,
    emissive: opts.emissive ?? '#9aa0a8',
    emissiveIntensity: 0.55,
    transparent: opts.faceOpacity !== undefined,
    opacity: opts.faceOpacity ?? 1,
  })
  g.add(box(3 * S, 0.15, len, faceMat, back ? 0 : 0))
  return g
}

/** Extrudes a flat outline (piece-local board px, y down) into a slab lying on the board. */
function slab(outline: Vec2[], mat: THREE.Material, depth = 0.16) {
  const shape = new THREE.Shape(outline.map((v) => new THREE.Vector2(v.x * S, -v.y * S)))
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false })
  geo.rotateX(-Math.PI / 2)
  return new THREE.Mesh(geo, mat)
}

function glassSlab(outline: Vec2[]) {
  const mesh = slab(outline, glassMaterial())
  mesh.add(edges(mesh.geometry, PALETTE.glassEdge))
  return mesh
}

/** Thin plate standing on a dark foot, used for gratings, polarisers and wave plates. */
function plate(tint: string, opacity: number) {
  const g = new THREE.Group()
  const len = PLATE_HALF * 2 * S
  g.add(box(10 * S, 0.03, len + 8 * S, std('#2A2E34'), 0, 0.015))
  const mat = new THREE.MeshStandardMaterial({ color: tint, emissive: tint, emissiveIntensity: 0.3, transparent: true, opacity, roughness: 0.3, depthWrite: false })
  g.add(box(4 * S, 0.15, len, mat))
  return g
}

/** Short ticks spaced along a plate face. */
function faceTicks(count: number, color: string) {
  const g = new THREE.Group()
  const mat = std(color, { roughness: 0.5 })
  for (let i = 0; i < count; i++) g.add(box(5 * S, 0.004, 1.6 * S, mat, 0, 0.152, ((i + 0.5) / count - 0.5) * PLATE_HALF * 2 * S))
  return g
}

/** One line running the length of a plate face. */
function faceLine(color: string) {
  return box(1.2 * S, 0.004, PLATE_HALF * 1.8 * S, std(color, { roughness: 0.5 }), 0, 0.152)
}

function buildSensor(p: Extract<Piece, { type: 'receiver' | 'tube' }>, pivot: THREE.Group, view: Partial<PieceView>) {
  const tint = new THREE.Color(p.color ? colorHex(p.color) : PALETTE.amber)
  const r = p.type === 'tube' ? TUBE.sensorR : RECEIVER_R
  const cx = p.type === 'tube' ? (-TUBE.length / 2 + TUBE.sensorR + 4) * S : 0
  const g = new THREE.Group()
  g.position.x = cx
  if (p.type === 'receiver') {
    // Light metal housing like the laser, so goals read clearly on the dark board.
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(r * S, r * S * 1.08, 0.16, 48), std('#4A5059', { roughness: 0.45, metalness: 0.5 }))
    housing.position.y = 0.08
    housing.castShadow = true
    g.add(housing)
    g.add(flat(new THREE.RingGeometry(r * S, (r + 1.5) * S, 48), new THREE.MeshBasicMaterial({ color: '#7A818B' }), 0.1605))
  }
  const top = p.type === 'tube' ? 0.03 : 0.161
  const ring = new THREE.MeshBasicMaterial({ color: tint.clone().multiplyScalar(SENSOR_IDLE.ring) })
  const core = new THREE.MeshBasicMaterial({ color: tint.clone().multiplyScalar(SENSOR_IDLE.core) })
  g.add(flat(new THREE.RingGeometry((r - 4) * S, r * S, 48), ring, top))
  g.add(flat(new THREE.CircleGeometry((r * 0.4) * S, 32), core, top + 0.001))
  const additive = (o = 0) =>
    new THREE.MeshBasicMaterial({ color: tint, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending })
  const halo = flat(new THREE.RingGeometry(r * S, (r + 18) * S, 48), additive(), 0.003)
  const pulse = flat(new THREE.RingGeometry(r * S, (r + 3) * S, 48), additive(), top + 0.002)
  const burstMat = additive()
  burstMat.color.multiplyScalar(2)
  const burst = flat(new THREE.RingGeometry(r * S, (r + 6) * S, 64), burstMat, 0.004)
  // A faint coloured pool marks the goal even while it's dark.
  const pool = flat(new THREE.CircleGeometry((r + 16) * S, 48), additive(0.1), 0.0025)
  g.add(pool, halo, pulse, burst)
  pivot.add(g)
  view.sensor = { ring, core, halo, pulse, burst, color: tint }
}

/** Builds the 3D object for one piece. Position and rotation are applied by the caller. */
export function buildPieceView(p: Piece): PieceView {
  const root = new THREE.Group()
  const pivot = new THREE.Group()
  root.add(pivot)
  const view: Partial<PieceView> = { root, pivot }

  // Flat optics are built at scale 1 and stretched along their face; the splitter cube both ways.
  const body = new THREE.Group()
  pivot.add(body)
  const k = scaleOf(p)
  body.scale.set(p.type === 'splitter' ? k : 1, 1, k)

  switch (p.type) {
    case 'laser': {
      // Light metal body with a glowing colour stripe and aperture, so it reads on the dark board.
      const c = new THREE.Color(colorHex(p.color))
      const body = box(54 * S, 0.2, 40 * S, std('#4A5059', { roughness: 0.45, metalness: 0.5 }), -29 * S)
      body.add(edges(body.geometry, '#6E757F'))
      pivot.add(body)
      pivot.add(box(46 * S, 0.02, 30 * S, std('#5A616B', { roughness: 0.4, metalness: 0.5 }), -29 * S, 0.21))
      pivot.add(box(40 * S, 0.012, 6 * S, new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(1.6) }), -29 * S, 0.226))
      pivot.add(box(10 * S, 0.14, 20 * S, std('#6E757F', { metalness: 0.6, roughness: 0.35 }), -1 * S, 0.07))
      const aperture = flat(new THREE.CircleGeometry(5 * S, 24), new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(2.4) }), BEAM_Y)
      aperture.rotation.set(0, Math.PI / 2, 0)
      aperture.position.x = 4.1 * S
      pivot.add(aperture)
      const glow = flat(
        new THREE.CircleGeometry(30 * S, 32),
        new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(0.18), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
        0.003,
      )
      glow.position.x = -20 * S
      pivot.add(glow)
      break
    }
    case 'mirror':
      body.add(flatOptic(MIRROR_HALF, PALETTE.mirrorFace, PALETTE.mirrorBack))
      break
    case 'double-mirror': {
      const g = flatOptic(MIRROR_HALF, PALETTE.mirrorFace, null)
      g.add(box(2 * S, 0.15, MIRROR_HALF * 2 * S, std(PALETTE.mirrorBack), -2.5 * S))
      g.add(box(2 * S, 0.15, MIRROR_HALF * 2 * S, std(PALETTE.mirrorFace, { metalness: 0.6, roughness: 0.25, emissive: '#9aa0a8', emissiveIntensity: 0.55 }), -5 * S))
      body.add(g)
      break
    }
    case 'splitter': {
      // Glass cube with a half-silvered diagonal; the diagonal is the optical surface.
      const side = (SPLITTER_HALF * 2) / Math.SQRT2
      const cube = box(side * S, 0.15, side * S, glassMaterial())
      cube.castShadow = false
      cube.rotation.y = Math.PI / 4
      cube.add(edges(cube.geometry, PALETTE.glassEdge))
      body.add(cube)
      body.add(flatOptic(SPLITTER_HALF, '#C9D6E3', null, { faceOpacity: 0.55, emissive: '#7d8fa3' }))
      break
    }
    case 'filter': {
      const c = colorHex(p.color)
      const mat = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.35, transparent: true, opacity: 0.55, roughness: 0.3, depthWrite: false })
      body.add(box(4 * S, 0.15, FILTER_HALF * 2 * S, mat))
      body.add(box(8 * S, 0.03, FILTER_HALF * 2 * S + 6 * S, std('#2A2E34'), 0, 0.015))
      break
    }
    case 'prism':
    case 'right-prism':
    case 'rhomboid':
    case 'wedge':
      pivot.add(glassSlab(localPolygon(p)!))
      break
    case 'glass': {
      const mesh = box(p.w * S, 0.16, p.h * S, glassMaterial())
      mesh.castShadow = false
      mesh.add(edges(mesh.geometry, PALETTE.glassEdge))
      pivot.add(mesh)
      break
    }
    case 'wall': {
      const mesh = box(p.w * S, 0.26, p.h * S, std(PALETTE.wall, { roughness: 0.8, metalness: 0 }))
      mesh.add(edges(mesh.geometry, PALETTE.wallEdge))
      pivot.add(mesh)
      break
    }
    case 'gate': {
      const c = colorHex(p.color)
      const mat = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.45, transparent: true, opacity: 0.32, roughness: 0.4, depthWrite: false })
      const mesh = box(p.w * S, 0.2, p.h * S, mat)
      mesh.castShadow = false
      mesh.add(edges(mesh.geometry, c))
      pivot.add(mesh)
      break
    }
    case 'retro': {
      // Dark housing with three corner-cube facets on its face.
      const len = RETRO_HALF * 2 * S
      body.add(box(14 * S, 0.15, len, std('#2C3036', { roughness: 0.5, metalness: 0.3 }), -6 * S))
      const facet = std('#C9D3DE', { metalness: 0.7, roughness: 0.2, emissive: '#7d8896', emissiveIntensity: 0.5 })
      for (let i = 0; i < 3; i++) {
        const z = ((i + 0.5) / 3 - 0.5) * len
        const cone = new THREE.Mesh(new THREE.ConeGeometry(8 * S, 6 * S, 3), facet)
        cone.rotation.z = -Math.PI / 2
        cone.position.set(3 * S, 0.075, z)
        body.add(cone)
      }
      break
    }
    case 'concave': {
      const pts = concaveLocal(p.focal, p.scale)
      const face = std(PALETTE.mirrorFace, { roughness: 0.25, metalness: 0.6, emissive: '#9aa0a8', emissiveIntensity: 0.55 })
      const back = std(PALETTE.mirrorBack, { roughness: 0.5, metalness: 0.3 })
      for (let i = 0; i + 1 < pts.length; i++) {
        const a = pts[i]
        const b = pts[i + 1]
        const len = Math.hypot(b.x - a.x, b.y - a.y) * S + 0.002
        const seg = new THREE.Group()
        seg.position.set(((a.x + b.x) / 2) * S, 0, ((a.y + b.y) / 2) * S)
        seg.rotation.y = Math.atan2(b.x - a.x, b.y - a.y)
        seg.add(box(3 * S, 0.15, len, face), box(6 * S, 0.15, len, back, -4.5 * S))
        pivot.add(seg)
      }
      break
    }
    case 'dichroic': {
      const c = colorHex(p.color)
      body.add(box(8 * S, 0.03, SPLITTER_HALF * 2 * S + 6 * S, std('#2A2E34'), 0, 0.015))
      body.add(flatOptic(SPLITTER_HALF, c, null, { faceOpacity: 0.7, emissive: c }))
      break
    }
    case 'grating':
      body.add(plate('#B7C4FF', 0.45), faceTicks(7, '#E6ECFF'))
      break
    case 'polariser':
      body.add(plate('#8A9099', 0.6), p.axis === 'vertical' ? faceLine('#E6E8EB') : faceTicks(6, '#E6E8EB'))
      break
    case 'waveplate':
      body.add(plate('#C58BFF', 0.5))
      break
    case 'convex-lens':
    case 'concave-lens': {
      // Lens outline: thick in the middle for convex, thick at the rims for concave.
      const n = 16
      const outline: Vec2[] = []
      const half = (t: number) => (p.type === 'convex-lens' ? 3 + 9 * (1 - t * t) : 3 + 8 * t * t)
      for (let i = 0; i <= n; i++) {
        const t = -1 + (2 * i) / n
        outline.push({ x: half(t), y: t * LENS_HALF })
      }
      for (let i = n; i >= 0; i--) {
        const t = -1 + (2 * i) / n
        outline.push({ x: -half(t), y: t * LENS_HALF })
      }
      pivot.add(glassSlab(outline))
      break
    }
    case 'receiver':
      buildSensor(p, pivot, view)
      break
    case 'tube': {
      const L = TUBE.length * S
      const W = TUBE.width * S
      const mat = std('#4A5059', { roughness: 0.45, metalness: 0.5 })
      const walls = [
        box(6 * S, 0.14, W, mat, -L / 2 + 3 * S),
        box(L, 0.14, 6 * S, mat, 0, 0.07, -W / 2 + 3 * S),
        box(L, 0.14, 6 * S, mat, 0, 0.07, W / 2 - 3 * S),
      ]
      for (const w of walls) w.add(edges(w.geometry, '#6E757F'))
      pivot.add(...walls)
      // Coloured lips on the mouth show which way the tube faces.
      const lip = new THREE.MeshBasicMaterial({ color: new THREE.Color(p.color ? colorHex(p.color) : PALETTE.amber).multiplyScalar(0.9) })
      pivot.add(box(3 * S, 0.012, 6 * S, lip, L / 2 - 1.5 * S, 0.146, -W / 2 + 3 * S), box(3 * S, 0.012, 6 * S, lip, L / 2 - 1.5 * S, 0.146, W / 2 - 3 * S))
      buildSensor(p, pivot, view)
      break
    }
  }

  // Lock badges: a screwed plate for fixed optics, a pin for rotate-only.
  const optic = !['laser', 'receiver', 'wall', 'tube', 'glass', 'gate'].includes(p.type)
  if (optic && p.lock !== 'kit' && !playerCanRotate(p) && !playerCanResize(p)) {
    const plate = box(72 * S, 0.02, 72 * S, std(PALETTE.plate, { roughness: 0.7 }), 0, 0.01)
    plate.castShadow = false
    root.add(plate)
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const screw = new THREE.Mesh(new THREE.CylinderGeometry(2.5 * S, 2.5 * S, 0.01, 12), std('#3A3F46', { metalness: 0.6, roughness: 0.4 }))
      screw.position.set(sx * 27 * S, 0.025, sz * 27 * S)
      root.add(screw)
    }
  }

  // Selection ring sized to the piece.
  const hs = halfSize(p)
  const ringR = Math.max(32, Math.hypot(hs.w, hs.h) * 0.8)
  view.base = flat(
    new THREE.RingGeometry(ringR * S, (ringR + 2) * S, 64),
    new THREE.MeshBasicMaterial({ color: PALETTE.dial, transparent: true, opacity: 0, depthWrite: false }),
    0.003,
  )
  root.add(view.base)

  if (p.mustHit) {
    const d = (ringR + 12) * S
    const pts = [
      [0, -d], [d, 0], [0, d], [-d, 0], [0, -d],
    ].map(([a, b]) => new THREE.Vector2(a, b))
    const dashes: THREE.Vector2[] = []
    for (let i = 0; i < 4; i++) {
      for (let k = 0; k < 6; k++) dashes.push(pts[i].clone().lerp(pts[i + 1], k / 6), pts[i].clone().lerp(pts[i + 1], (k + 0.5) / 6))
    }
    const dashed = new THREE.Mesh(
      ribbon(dashes, 1.6 * S, { pairs: true }),
      new THREE.MeshBasicMaterial({ color: PALETTE.amber, transparent: true, opacity: 0.7, depthWrite: false }),
    )
    const solid = new THREE.Mesh(
      ribbon(pts, 1.6 * S, { joints: true }),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.amber).multiplyScalar(1.4), transparent: true, opacity: 0, depthWrite: false }),
    )
    dashed.position.y = 0.003
    solid.position.y = 0.0035
    root.add(dashed, solid)
    view.mustRing = { dashed, solid }
  }

  // Pick target covering the piece footprint, rotating with it.
  const hit = new THREE.Mesh(
    new THREE.BoxGeometry(Math.max(hs.w * 2, 56) * S, 0.3, Math.max(hs.h * 2, 56) * S),
    new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }),
  )
  hit.position.y = 0.15
  hit.userData.pieceId = p.id
  pivot.add(hit)
  view.hit = hit

  root.traverse((o) => {
    if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshBasicMaterial) o.material.side = THREE.DoubleSide
  })
  return view as PieceView
}

export function disposeObject(obj: THREE.Object3D) {
  obj.traverse((o) => {
    if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
      o.geometry.dispose()
      const mats = Array.isArray(o.material) ? o.material : [o.material]
      mats.forEach((m: THREE.Material) => {
        ;(m as THREE.MeshStandardMaterial).map?.dispose()
        m.dispose()
      })
    }
  })
}
