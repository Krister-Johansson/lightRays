import { Maximize, Minus, Plus } from 'lucide-react'
import type { Game } from '../game/Game'

/** Small floating zoom cluster. Wheel, +/- and 0 do the same from the board. */
export function ZoomControls({ game, zoom, className = '' }: { game: Game; zoom: number; className?: string }) {
  const btn =
    'pressable flex size-9 cursor-pointer items-center justify-center rounded-lg text-fg outline-none hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-dial disabled:cursor-default disabled:opacity-40'
  return (
    <div className={`flex items-center gap-0.5 rounded-xl border border-line-strong bg-panel/90 p-1 backdrop-blur ${className}`}>
      <button type="button" aria-label="Zoom out" title="Zoom out (-)" className={btn} onClick={() => game.zoomBy(1 / 1.2)}>
        <Minus className="size-4" aria-hidden />
      </button>
      <span className="w-12 text-center font-mono text-xs text-muted tabular-nums" aria-live="polite">
        {Math.round(zoom * 100)}%
      </span>
      <button type="button" aria-label="Zoom in" title="Zoom in (+)" className={btn} onClick={() => game.zoomBy(1.2)}>
        <Plus className="size-4" aria-hidden />
      </button>
      <button type="button" aria-label="Fit board" title="Fit board (0)" className={btn} onClick={() => game.resetView()}>
        <Maximize className="size-4" aria-hidden />
      </button>
    </div>
  )
}
