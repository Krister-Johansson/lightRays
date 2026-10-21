import * as THREE from 'three'
import { ribbon } from './geometry'
import {
  colorHex,
  FILTER_HALF,
  halfSize,
  MIRROR_HALF,
  prismCorners,
  RECEIVER_R,
  SPLITTER_HALF,
  TUBE,
} from './pieces'
import type { Piece } from './schema'

/** World units per board pixel. */
export const S = 0.01
export const BEAM_Y = 0.07

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

function buildSensor(p: Extract<Piece, { type: 'receiver' | 'tube' }>, pivot: THREE.Group, view: Partial<PieceView>) {
  const tint = new THREE.Color(p.color ? colorHex(p.color) : PALETTE.amber)
  const r = p.type === 'tube' ? TUBE.sensorR : RECEIVER_R
  const cx = p.type === 'tube' ? (-TUBE.length / 2 + TUBE.sensorR + 4) * S : 0
  const g = new THREE.Group()
  g.position.x = cx
  if (p.type === 'receiver') {
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(r * S, r * S * 1.05, 0.16, 48), std('#1B1E22'))
    housing.position.y = 0.08
    housing.castShadow = true
    g.add(housing)
  }
  const top = p.type === 'tube' ? 0.03 : 0.161
  const ring = new THREE.MeshBasicMaterial({ color: tint.clone().multiplyScalar(0.42) })
  const core = new THREE.MeshBasicMaterial({ color: tint.clone().multiplyScalar(0.16) })
  g.add(flat(new THREE.RingGeometry((r - 4) * S, r * S, 48), ring, top))
  g.add(flat(new THREE.CircleGeometry((r * 0.4) * S, 32), core, top + 0.001))
  const additive = (o = 0) =>
    new THREE.MeshBasicMaterial({ color: tint, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending })
  const halo = flat(new THREE.RingGeometry(r * S, (r + 18) * S, 48), additive(), 0.003)
  const pulse = flat(new THREE.RingGeometry(r * S, (r + 3) * S, 48), additive(), top + 0.002)
  const burstMat = additive()
  burstMat.color.multiplyScalar(2)
  const burst = flat(new THREE.RingGeometry(r * S, (r + 6) * S, 64), burstMat, 0.004)
  g.add(halo, pulse, burst)
  pivot.add(g)
  view.sensor = { ring, core, halo, pulse, burst, color: tint }
}

/** Builds the 3D object for one piece. Position and rotation are applied by the caller. */
export function buildPieceView(p: Piece): PieceView {
  const root = new THREE.Group()
  const pivot = new THREE.Group()
  root.add(pivot)
  const view: Partial<PieceView> = { root, pivot }

  switch (p.type) {
    case 'laser': {
      pivot.add(box(54 * S, 0.18, 44 * S, std('#1B1E22'), -27 * S))
      pivot.add(box(10 * S, 0.1, 16 * S, std('#3A3F46', { metalness: 0.4, roughness: 0.5 }), 0, 0.05 + 0.02))
      const led = flat(new THREE.CircleGeometry(5 * S, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(colorHex(p.color)).multiplyScalar(3) }), 0.181)
      led.position.x = -40 * S
      pivot.add(led)
      break
    }
    case 'mirror':
      pivot.add(flatOptic(MIRROR_HALF, PALETTE.mirrorFace, PALETTE.mirrorBack))
      break
    case 'double-mirror': {
      const g = flatOptic(MIRROR_HALF, PALETTE.mirrorFace, null)
      g.add(box(2 * S, 0.15, MIRROR_HALF * 2 * S, std(PALETTE.mirrorBack), -2.5 * S))
      g.add(box(2 * S, 0.15, MIRROR_HALF * 2 * S, std(PALETTE.mirrorFace, { metalness: 0.6, roughness: 0.25, emissive: '#9aa0a8', emissiveIntensity: 0.55 }), -5 * S))
      pivot.add(g)
      break
    }
    case 'splitter': {
      // Glass cube with a half-silvered diagonal; the diagonal is the optical surface.
      const side = (SPLITTER_HALF * 2) / Math.SQRT2
      const cube = box(side * S, 0.15, side * S, glassMaterial())
      cube.castShadow = false
      cube.rotation.y = Math.PI / 4
      cube.add(edges(cube.geometry, PALETTE.glassEdge))
      pivot.add(cube)
      pivot.add(flatOptic(SPLITTER_HALF, '#C9D6E3', null, { faceOpacity: 0.55, emissive: '#7d8fa3' }))
      break
    }
    case 'filter': {
      const c = colorHex(p.color)
      const mat = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.35, transparent: true, opacity: 0.55, roughness: 0.3, depthWrite: false })
      pivot.add(box(4 * S, 0.15, FILTER_HALF * 2 * S, mat))
      pivot.add(box(8 * S, 0.03, FILTER_HALF * 2 * S + 6 * S, std('#2A2E34'), 0, 0.015))
      break
    }
    case 'prism': {
      const pts = prismCorners({ x: 0, y: 0, angle: 0 }, p.size)
      const shape = new THREE.Shape(pts.map((v) => new THREE.Vector2(v.x * S, -v.y * S)))
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: false })
      geo.rotateX(-Math.PI / 2)
      const mesh = new THREE.Mesh(geo, glassMaterial())
      mesh.add(edges(geo, PALETTE.glassEdge))
      pivot.add(mesh)
      break
    }
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
    case 'receiver':
      buildSensor(p, pivot, view)
      break
    case 'tube': {
      const L = TUBE.length * S
      const W = TUBE.width * S
      const mat = std('#1B1E22')
      pivot.add(box(6 * S, 0.14, W, mat, -L / 2 + 3 * S))
      pivot.add(box(L, 0.14, 6 * S, mat, 0, 0.07, -W / 2 + 3 * S))
      pivot.add(box(L, 0.14, 6 * S, mat, 0, 0.07, W / 2 - 3 * S))
      buildSensor(p, pivot, view)
      break
    }
  }

  // Lock badges: a screwed plate for fixed optics, a pin for rotate-only.
  const optic = !['laser', 'receiver', 'wall', 'tube', 'glass'].includes(p.type)
  if (optic && p.lock === 'fixed') {
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
