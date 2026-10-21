import { Lock } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Game, GameSnapshot } from '../game/Game'
import { PIECE_INFO, playerCanResize, playerCanRotate } from '../game/pieces'
import type { Piece } from '../game/schema'
import { PieceIcon } from './PieceIcon'

const pieceColor = (p: Piece) => ('color' in p ? p.color : undefined)

/**
 * Bottom tray. Kit pieces still to place can be dragged (or tapped) onto the board; pieces the
 * player can turn show their angle.
 */
export function KitTray({ snap, game, children }: { snap: GameSnapshot; game: Game; children?: ReactNode }) {
  const onBoard = snap.pieces.filter((p) => p.lock === 'kit' || playerCanRotate(p) || playerCanResize(p))
  return (
    <footer className="pointer-events-none absolute inset-x-0 bottom-0 flex h-[112px] items-center justify-center gap-4 px-4 sm:px-8">
      <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-line bg-panel-2 px-3.5 py-2.5">
        <span className="px-1 text-[13px] text-muted">Kit</span>
        {onBoard.map((p) => {
          const selected = snap.selected?.id === p.id
          return (
            <button
              type="button"
              key={p.id}
              onClick={() => game.select(p.id)}
              aria-label={`${PIECE_INFO[p.type].label}, ${p.angle.toFixed(0)} degrees`}
              className="pressable relative flex size-[60px] cursor-pointer flex-col items-center justify-center gap-0.5 rounded-[10px] border border-dashed outline-none focus-visible:ring-2 focus-visible:ring-dial"
              style={{ borderColor: selected ? '#2F5E8C' : '#33373D', backgroundColor: selected ? '#13202d' : 'transparent' }}
            >
              <PieceIcon type={p.type} color={pieceColor(p)} />
              <span className="font-mono text-[10px] text-muted">{p.angle.toFixed(0)}°</span>
              {p.mustHit && <MustBadge />}
            </button>
          )
        })}
        {snap.tray.length > 0 && onBoard.length > 0 && <div className="h-10 w-px bg-line" aria-hidden />}
        {snap.tray.map((p) => (
          <button
            type="button"
            key={p.id}
            onPointerDown={(e) => {
              e.preventDefault()
              game.beginPlace(p.id, e.nativeEvent)
            }}
            aria-label={`${PIECE_INFO[p.type].label}: drag onto the board`}
            className="pressable relative flex size-[60px] cursor-grab touch-none flex-col items-center justify-center gap-0.5 rounded-[10px] border border-line-strong bg-[#1A1D21] outline-none focus-visible:ring-2 focus-visible:ring-dial"
          >
            <PieceIcon type={p.type} color={pieceColor(p)} />
            <span className="font-mono text-[10px] text-muted">place</span>
            {p.mustHit && <MustBadge />}
          </button>
        ))}
        {onBoard.length === 0 && snap.tray.length === 0 && (
          <span className="flex items-center gap-1.5 px-1 text-xs text-faint">
            <Lock className="size-3.5" aria-hidden /> Nothing to place
          </span>
        )}
      </div>
      {children}
    </footer>
  )
}

function MustBadge() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" className="absolute -top-1.5 -right-1.5" role="img" aria-label="Must hit">
      <path d="M7 1l6 6-6 6-6-6z" fill="#0C0D0F" stroke="#FFC940" strokeWidth="1.5" />
    </svg>
  )
}
