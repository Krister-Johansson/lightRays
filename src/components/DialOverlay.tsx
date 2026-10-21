import type { GameSnapshot } from '../game/Game'

/** Angle readout that rides along with the 3D rotation dial's handle. */
export function DialOverlay({ dial }: { dial: GameSnapshot['dial'] }) {
  if (!dial) return null
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <div
        className="enter-fade absolute flex h-[46px] w-[84px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-px rounded-lg border border-[#2F5E8C] bg-ink/90"
        style={{ left: dial.x, top: dial.y }}
      >
        <span className="font-mono text-[15px] font-medium tabular-nums text-fg">{dial.deg}</span>
        <span className="font-mono text-[10px] text-muted">{dial.step}</span>
      </div>
    </div>
  )
}
