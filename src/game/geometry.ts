import * as THREE from 'three'

/**
 * Flat ribbon geometry lying on the XZ plane. Each consecutive pair of points
 * becomes a quad of the given width; `joints` adds round caps so bends look
 * continuous, which matters for the beam.
 */
export function ribbon(
  points: THREE.Vector2[],
  width: number,
  { joints = false, pairs = false, dist }: { joints?: boolean; pairs?: boolean; dist?: number[] } = {},
): THREE.BufferGeometry {
  const pos: number[] = []
  // Optional distance along the beam per point, exposed to shaders as `aDist`, plus `aAcross`:
  // 0 on the centre line, 1 at the edges, so shaders can feather the ribbon.
  const d: number[] = []
  const across: number[] = []
  const half = width / 2
  const step = pairs ? 2 : 1
  for (let i = 0; i + 1 < points.length; i += step) {
    const a = points[i]
    const b = points[i + 1]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.hypot(dx, dy)
    if (len < 1e-6) continue
    const nx = (-dy / len) * half
    const ny = (dx / len) * half
    const v = [
      [a.x + nx, a.y + ny],
      [a.x - nx, a.y - ny],
      [b.x - nx, b.y - ny],
      [b.x + nx, b.y + ny],
    ]
    for (const k of [0, 1, 2, 0, 2, 3]) {
      pos.push(v[k][0], 0, v[k][1])
      if (dist) {
        d.push(k < 2 ? dist[i] : dist[i + 1])
        across.push(k === 0 || k === 3 ? 1 : -1)
      }
    }
  }
  if (joints) {
    const seg = 12
    points.forEach((p, i) => {
      for (let s = 0; s < seg; s++) {
        const t0 = (s / seg) * Math.PI * 2
        const t1 = ((s + 1) / seg) * Math.PI * 2
        pos.push(p.x, 0, p.y)
        pos.push(p.x + Math.cos(t1) * half, 0, p.y + Math.sin(t1) * half)
        pos.push(p.x + Math.cos(t0) * half, 0, p.y + Math.sin(t0) * half)
        if (dist) {
          d.push(dist[i], dist[i], dist[i])
          across.push(0, 1, 1)
        }
      }
    })
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  if (dist) {
    g.setAttribute('aDist', new THREE.Float32BufferAttribute(d, 1))
    g.setAttribute('aAcross', new THREE.Float32BufferAttribute(across, 1))
  }
  g.computeVertexNormals()
  return g
}

/** Dashed circle as flat ribbon segments. */
export function dashedCircle(radius: number, width: number, dash: number, gap: number) {
  const circumference = Math.PI * 2 * radius
  const count = Math.floor(circumference / (dash + gap))
  const pts: THREE.Vector2[] = []
  for (let i = 0; i < count; i++) {
    const t0 = (i / count) * Math.PI * 2
    const t1 = t0 + dash / radius
    pts.push(new THREE.Vector2(Math.cos(t0) * radius, Math.sin(t0) * radius))
    pts.push(new THREE.Vector2(Math.cos(t1) * radius, Math.sin(t1) * radius))
  }
  return ribbon(pts, width, { pairs: true })
}

/** Dot grid texture for the matte board surface. */
export function dotGridTexture(cell: number, dot: number, bg: string, fg: string) {
  const size = 128
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, size, size)
  ctx.fillStyle = fg
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, (dot / cell) * size, 0, Math.PI * 2)
  ctx.fill()
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}
