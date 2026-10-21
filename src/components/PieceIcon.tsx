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
}

/** Small top-down glyph for a piece type, used in the palette, kit tray and inspector. */
export function PieceIcon({ type, color, size = 24 }: { type: PieceType; color?: ColorName; size?: number }) {
  const c = color ? colorHex(color) : type === 'filter' ? '#FF5A4E' : '#FFC940'
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden>
      {GLYPHS[type](c)}
    </svg>
  )
}
