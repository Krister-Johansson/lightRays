import { useEffect, useRef } from 'react'
import type { GameSnapshot } from '../game/Game'

type Props = {
  snap: GameSnapshot
  hasNext: boolean
  onNext: () => void
  onReplay: () => void
}

export function LevelComplete({ snap, hasNext, onNext, onReplay }: Props) {
  const primary = useRef<HTMLButtonElement>(null)
  useEffect(() => primary.current?.focus(), [])
  const beam = snap.level.laser.color
  const free = snap.level.mirrors.filter((m) => !m.fixed).length

  return (
    <div className="enter-fade absolute inset-0 flex items-center justify-center bg-[rgba(8,9,10,0.55)] p-4">
      <div
        role="dialog"
        aria-labelledby="lc-title"
        className="enter-pop flex w-full max-w-[400px] flex-col items-center gap-6 rounded-[18px] border border-line-strong bg-card p-9 text-center"
      >
        <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden>
          <defs>
            <filter id="lcg" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="6" />
            </filter>
          </defs>
          <circle cx="36" cy="36" r="22" fill={beam} opacity="0.6" filter="url(#lcg)" />
          <circle cx="36" cy="36" r="22" fill="#1B1E22" stroke={beam} strokeWidth="4" />
          <circle cx="36" cy="36" r="10" fill={beam} />
        </svg>
        <div className="flex flex-col gap-2">
          <div className="font-mono text-xs tracking-[2px] text-muted">LEVEL {snap.level.id}</div>
          <h2 id="lc-title" className="m-0 text-[34px] font-semibold">
            Receiver lit
          </h2>
        </div>
        <div className="grid w-full grid-cols-3 gap-2.5">
          <Stat label="Moves" value={snap.moves} />
          <Stat label="Par" value={snap.level.par} />
          <Stat label="Mirrors" value={`${free}`} />
        </div>
        <div className="flex w-full flex-col gap-2.5">
          {hasNext ? (
            <button
              ref={primary}
              type="button"
              onClick={onNext}
              className="pressable pressable-primary h-14 cursor-pointer rounded-[10px] bg-amber text-lg font-semibold text-amber-ink outline-none focus-visible:ring-2 focus-visible:ring-fg"
            >
              Next level
            </button>
          ) : (
            <p className="m-0 text-sm text-muted">That's every level in this build.</p>
          )}
          <button
            ref={hasNext ? undefined : primary}
            type="button"
            onClick={onReplay}
            className="pressable h-12 cursor-pointer rounded-[10px] border border-line-strong bg-transparent text-base text-fg outline-none focus-visible:ring-2 focus-visible:ring-dial"
          >
            Replay
          </button>
        </div>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-1 rounded-[10px] border border-line bg-panel-2 px-2 py-3">
      <span className="text-xs text-muted">{label}</span>
      <span className="font-mono text-xl tabular-nums">{value}</span>
    </div>
  )
}
