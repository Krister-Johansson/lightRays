import type { Game } from '../game/Game'
import { PIECE_INFO, PIECE_TYPES } from '../game/pieces'
import type { PieceType } from '../game/schema'
import { PieceIcon } from './PieceIcon'

const GROUPS = ['Sources', 'Optics', 'Goals and terrain'] as const

/** Sandbox piece palette: drag a piece onto the board, or click to drop it in the middle. */
export function Palette({ game }: { game: Game }) {
  return (
    <nav aria-label="Pieces" className="flex flex-col gap-6">
      {GROUPS.map((group) => (
        <section key={group} className="flex flex-col gap-2">
          <h2 className="m-0 font-mono text-[11px] tracking-[1.5px] text-muted uppercase">{group}</h2>
          <div className="grid grid-cols-2 gap-2">
            {PIECE_TYPES.filter((t) => PIECE_INFO[t].group === group).map((type) => (
              <PaletteItem key={type} type={type} game={game} />
            ))}
          </div>
        </section>
      ))}
      <p className="m-0 text-xs leading-normal text-faint">
        Drag a piece onto the board. Drag it off the board to remove it.
      </p>
    </nav>
  )
}

function PaletteItem({ type, game }: { type: PieceType; game: Game }) {
  const info = PIECE_INFO[type]
  return (
    <button
      type="button"
      title={info.blurb}
      onPointerDown={(e) => {
        if (e.button !== 0) return
        e.preventDefault()
        game.beginPlace(type, e.nativeEvent)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          game.addPiece(type)
        }
      }}
      className="pressable flex h-[72px] cursor-grab touch-none flex-col items-center justify-center gap-1.5 rounded-[10px] border border-line bg-card px-1 text-center text-xs text-fg outline-none focus-visible:ring-2 focus-visible:ring-dial active:cursor-grabbing"
    >
      <PieceIcon type={type} size={26} />
      <span className="leading-tight">{info.label}</span>
    </button>
  )
}
