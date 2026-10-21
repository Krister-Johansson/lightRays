import { Lock } from 'lucide-react'
import type { GameSnapshot } from '../game/Game'

/** Bottom tray: what's in this level's kit, plus the control hint. */
export function KitTray({ snap, children }: { snap: GameSnapshot; children?: React.ReactNode }) {
  return (
    <footer className="pointer-events-none absolute inset-x-0 bottom-0 flex h-[112px] items-center justify-center gap-4 px-4 sm:px-8">
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-panel-2 px-3.5 py-2.5">
        <span className="px-1 text-[13px] text-muted">Kit</span>
        {snap.level.mirrors.map((m) => {
          const selected = snap.selected === m.id
          return (
            <div
              key={m.id}
              className="relative flex size-[60px] flex-col items-center justify-center gap-0.5 rounded-[10px] border transition-[border-color,background-color] duration-150 ease-out"
              style={{
                borderColor: selected ? '#2F5E8C' : '#33373D',
                borderStyle: m.fixed ? 'solid' : 'dashed',
                backgroundColor: selected ? '#13202d' : 'transparent',
              }}
            >
              <svg width="24" height="24" viewBox="0 0 28 28" aria-hidden>
                <line x1="5" y1="23" x2="23" y2="5" stroke="#2C3036" strokeWidth="6" strokeLinecap="round" />
                <line x1="7" y1="21" x2="23" y2="5" stroke="#DDE1E6" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span className="font-mono text-[10px] text-muted">
                {m.fixed ? 'fixed' : `${snap.angles[m.id].toFixed(0)}°`}
              </span>
              {m.fixed && (
                <Lock className="absolute -top-1.5 -right-1.5 size-3.5 rounded-full bg-ink p-0.5 text-muted" aria-label="Fixed" />
              )}
              {m.mustHit && (
                <svg width="14" height="14" viewBox="0 0 14 14" className="absolute -top-1.5 -right-1.5" role="img" aria-label="Must hit">
                  <path d="M7 1l6 6-6 6-6-6z" fill="#0C0D0F" stroke="#FFC940" strokeWidth="1.5" />
                </svg>
              )}
            </div>
          )
        })}
      </div>
      {children}
      <p className="absolute right-8 bottom-10 hidden w-[240px] text-right text-xs leading-normal text-faint lg:block">
        Click a mirror, then drag the handle. Drag it further out for finer steps, hold Shift to snap to 15°. Arrow keys
        nudge 1°, Tab cycles mirrors.
      </p>
    </footer>
  )
}
