import { colorHex, faceSegment, MIRROR_HALF, prismCorners, rectCorners } from '../game/pieces'
import type { LevelDef, Piece } from '../game/schema'

/** Flat top-down thumbnail of a level's starting layout. */
export function LevelPreview({ level, className }: { level: LevelDef; className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${level.width} ${level.height}`}
      className={className}
      role="img"
      aria-label={`Preview of ${level.name}`}
    >
      <defs>
        <pattern id="pv-dots" width="40" height="40" patternUnits="userSpaceOnUse">
          <circle cx="20" cy="20" r="2.5" fill="#262A2F" />
        </pattern>
      </defs>
      <rect width={level.width} height={level.height} fill="#15171A" />
      <rect width={level.width} height={level.height} fill="url(#pv-dots)" />
      {level.pieces.map((p) => (
        <PreviewPiece key={p.id} p={p} />
      ))}
    </svg>
  )
}

const pts = (vs: { x: number; y: number }[]) => vs.map((v) => `${v.x},${v.y}`).join(' ')

function PreviewPiece({ p }: { p: Piece }) {
  if (p.lock === 'kit') {
    return <rect x={p.x - 28} y={p.y - 28} width="56" height="56" rx="8" fill="none" stroke="#A3A7AE" strokeWidth="4" strokeDasharray="10 8" />
  }
  switch (p.type) {
    case 'wall':
      return <polygon points={pts(rectCorners(p, p.w, p.h))} fill="#2A2E34" />
    case 'glass':
      return <polygon points={pts(rectCorners(p, p.w, p.h))} fill="#9CCFFF" fillOpacity="0.15" stroke="#6E8CA8" strokeWidth="3" />
    case 'prism':
      return <polygon points={pts(prismCorners(p, p.size))} fill="#9CCFFF" fillOpacity="0.15" stroke="#6E8CA8" strokeWidth="3" />
    case 'laser':
      return <circle cx={p.x} cy={p.y} r="16" fill={colorHex(p.color)} />
    case 'receiver':
    case 'tube':
      return <circle cx={p.x} cy={p.y} r="22" fill="none" stroke={p.color ? colorHex(p.color) : '#FFC940'} strokeWidth="6" />
    default: {
      const [a, b] = faceSegment(p, MIRROR_HALF)
      return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#DDE1E6" strokeWidth="6" strokeLinecap="round" />
    }
  }
}
