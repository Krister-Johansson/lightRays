import type { GameSnapshot } from '../game/Game'

/** Angle readout that rides along with the 3D rotation dial, opposite its handle. */
export function DialOverlay({ dial }: { dial: GameSnapshot['dial'] }) {
  if (!dial) return null
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <div
        className="enter-fade absolute flex h-9 min-w-[76px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-lg px-2.5 border border-[#2F5E8C] bg-ink/90"
        style={{ left: dial.x, top: dial.y }}
      >
        <span className="font-mono text-[15px] font-medium tabular-nums text-fg">{dial.deg}</span>
      </div>
    </div>
  )
}
