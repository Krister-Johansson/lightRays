import type { ReactNode } from 'react'
import { colorHex } from '../game/pieces'
import type { ColorName, PieceType } from '../game/schema'

/** Glyph per piece type. `c` is the piece colour, or the piece's default tint when it has none. */
const GLYPHS: Record<PieceType, (c: string) => ReactNode> = {
  laser: (c) => (
    <>
      <rect x="3" y="9" width="17" height="10" rx="2.5" fill="#2A2E34" stroke="#4A5058" />
      <rect x="20" y="11.5" width="4" height="5" rx="1" fill="#4A5058" />
      <circle cx="8" cy="14" r="2" fill={c} />
    </>
  ),
  mirror: () => (
    <>
      <line x1="5" y1="23" x2="23" y2="5" stroke="#2C3036" strokeWidth="6" strokeLinecap="round" />
      <line x1="7" y1="21" x2="23" y2="5" stroke="#DDE1E6" strokeWidth="1.5" strokeLinecap="round" />
    </>
  ),
  'double-mirror': () => (
    <>
      <line x1="5" y1="23" x2="23" y2="5" stroke="#2C3036" strokeWidth="5" strokeLinecap="round" />
      <line x1="4" y1="21" x2="21" y2="4" stroke="#DDE1E6" strokeWidth="1.3" strokeLinecap="round" />
      <line x1="7" y1="24" x2="24" y2="7" stroke="#DDE1E6" strokeWidth="1.3" strokeLinecap="round" />
    </>
  ),
  splitter: () => (
    <>
      <rect x="6" y="6" width="16" height="16" rx="1.5" fill="#4FA8FF" fillOpacity="0.12" stroke="#6E8CA8" />
      <line x1="6" y1="22" x2="22" y2="6" stroke="#DDE1E6" strokeWidth="1.2" strokeDasharray="2 2" />
    </>
  ),
  prism: () => <path d="M14 4 L25 23 H3 Z" fill="#9CCFFF" fillOpacity="0.14" stroke="#8FB3D6" strokeWidth="1.3" strokeLinejoin="round" />,
  filter: (c) => <rect x="11.5" y="4" width="5" height="20" rx="1.5" fill={c} fillOpacity="0.55" stroke={c} />,
  glass: () => <rect x="4" y="8" width="20" height="12" rx="1.5" fill="#9CCFFF" fillOpacity="0.14" stroke="#8FB3D6" />,
  receiver: (c) => (
    <>
      <circle cx="14" cy="14" r="9" fill="#1B1E22" stroke={c} strokeWidth="2.5" />
      <circle cx="14" cy="14" r="3.5" fill={c} />
    </>
  ),
  tube: (c) => (
    <>
      <path d="M24 8 H6 V20 H24" fill="none" stroke="#6E737B" strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="10.5" cy="14" r="3" fill={c} />
    </>
  ),
  wall: () => <rect x="5" y="7" width="18" height="14" rx="2" fill="#2E3238" stroke="#3A3F46" />,
  retro: () => (
    <>
      <rect x="6" y="5" width="7" height="18" rx="1.5" fill="#2C3036" />
      <path d="M13 5 L19 8 L13 11 L19 14 L13 17 L19 20 L13 23" fill="none" stroke="#DDE1E6" strokeWidth="1.4" strokeLinejoin="round" />
    </>
  ),
  concave: () => (
    <>
      <path d="M9 4 Q17 14 9 24" fill="none" stroke="#2C3036" strokeWidth="5" strokeLinecap="round" />
      <path d="M11 4 Q19 14 11 24" fill="none" stroke="#DDE1E6" strokeWidth="1.5" strokeLinecap="round" />
    </>
  ),
  dichroic: (c) => (
    <>
      <line x1="5" y1="23" x2="23" y2="5" stroke="#2A2E34" strokeWidth="5" strokeLinecap="round" />
      <line x1="6" y1="22" x2="22" y2="6" stroke={c} strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  grating: () => (
    <>
      <rect x="11.5" y="4" width="5" height="20" rx="1.5" fill="#B7C4FF" fillOpacity="0.35" stroke="#8FA0D6" />
      <path d="M11.5 8 H16.5 M11.5 12 H16.5 M11.5 16 H16.5 M11.5 20 H16.5" stroke="#E6ECFF" strokeWidth="1" />
    </>
  ),
  'right-prism': () => <path d="M5 23 V5 L23 23 Z" fill="#9CCFFF" fillOpacity="0.14" stroke="#8FB3D6" strokeWidth="1.3" strokeLinejoin="round" />,
  rhomboid: () => <path d="M3 20 L9 8 H25 L19 20 Z" fill="#9CCFFF" fillOpacity="0.14" stroke="#8FB3D6" strokeWidth="1.3" strokeLinejoin="round" />,
  wedge: () => <path d="M10 4 V24 H17 Z" fill="#9CCFFF" fillOpacity="0.14" stroke="#8FB3D6" strokeWidth="1.3" strokeLinejoin="round" />,
  'convex-lens': () => <path d="M14 3 Q22 14 14 25 Q6 14 14 3 Z" fill="#9CCFFF" fillOpacity="0.14" stroke="#8FB3D6" strokeWidth="1.3" />,
  'concave-lens': () => <path d="M9 3 H19 Q14 14 19 25 H9 Q14 14 9 3 Z" fill="#9CCFFF" fillOpacity="0.14" stroke="#8FB3D6" strokeWidth="1.3" strokeLinejoin="round" />,
  gate: (c) => <rect x="10" y="3" width="8" height="22" rx="1.5" fill={c} fillOpacity="0.3" stroke={c} strokeWidth="1.3" />,
  polariser: () => (
    <>
      <rect x="11.5" y="4" width="5" height="20" rx="1.5" fill="#8A9099" fillOpacity="0.5" stroke="#A3A7AE" />
      <line x1="14" y1="6" x2="14" y2="22" stroke="#E6E8EB" strokeWidth="1.2" />
    </>
  ),
  scientist: () => (
    <g stroke="#F4F4F2" strokeWidth="1.2" fill="#121314">
      <circle cx="14" cy="6.5" r="3.6" />
      <path d="M8.5 19 V12.5 A5.5 5.5 0 0 1 19.5 12.5 V19 Z" />
      <rect x="9.5" y="19" width="3.5" height="6" />
      <rect x="15" y="19" width="3.5" height="6" />
    </g>
  ),
  waveplate: () => <rect x="11.5" y="4" width="5" height="20" rx="1.5" fill="#C58BFF" fillOpacity="0.45" stroke="#B07EE6" />,
}

/** Tint for pieces whose colour defaults to something other than yellow. */
const DEFAULT_TINT: Partial<Record<PieceType, string>> = { filter: '#FF5A4E', gate: '#FF5A4E', dichroic: '#4FA8FF' }

/** Small top-down glyph for a piece type, used in the palette, kit tray and inspector. */
export function PieceIcon({ type, color, size = 24 }: { type: PieceType; color?: ColorName; size?: number }) {
  const c = color ? colorHex(color) : (DEFAULT_TINT[type] ?? '#FFC940')
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden>
      {GLYPHS[type](c)}
    </svg>
  )
}
