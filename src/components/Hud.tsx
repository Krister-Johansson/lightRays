import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react'
import type { GameSnapshot } from '../game/Game'

type Props = {
  snap: GameSnapshot
  levelIndex: number
  levelCount: number
  onPrev: () => void
  onNext: () => void
  onReset: () => void
}

export function Hud({ snap, levelIndex, levelCount, onPrev, onNext, onReset }: Props) {
  const beam = snap.level.laser.color
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 flex h-[76px] items-center gap-3 px-4 sm:px-8">
      <div className="pointer-events-auto flex items-center gap-2">
        <IconButton label="Previous level" onClick={onPrev} disabled={levelIndex === 0}>
          <ChevronLeft className="size-5" aria-hidden />
        </IconButton>
        <IconButton label="Next level" onClick={onNext} disabled={levelIndex === levelCount - 1}>
          <ChevronRight className="size-5" aria-hidden />
        </IconButton>
      </div>
      <span className="font-mono text-[13px] text-muted">{snap.level.id}</span>
      <h1 className="m-0 truncate text-[22px] font-semibold">{snap.level.name}</h1>
      <div className="flex-1" />

      <div className="pointer-events-auto hidden items-center gap-3 sm:flex">
        <Pill>
          <span
            className="size-2.5 rounded-full transition-[background-color,box-shadow] duration-200 ease-out"
            style={{
              backgroundColor: snap.lit ? beam : '#3A3F46',
              boxShadow: snap.lit ? `0 0 10px ${beam}` : 'none',
            }}
            aria-hidden
          />
          <span>Receiver</span>
          <span className="font-mono text-xs" style={{ color: snap.lit ? beam : undefined }} aria-live="polite">
            {snap.lit ? 'LIT' : 'DARK'}
          </span>
        </Pill>
        {snap.mustHit.total > 0 && (
          <Pill>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
              <path
                d="M7 1l6 6-6 6-6-6z"
                fill={snap.mustHit.hit === snap.mustHit.total ? '#FFC940' : 'none'}
                stroke="#FFC940"
                strokeWidth="1.5"
              />
            </svg>
            <span>Must hit</span>
            <span className="font-mono text-xs tabular-nums">
              {snap.mustHit.hit} / {snap.mustHit.total}
            </span>
          </Pill>
        )}
        <Pill>
          <span className="text-muted">Moves</span>
          <span className="font-mono text-[13px] tabular-nums">{snap.moves}</span>
        </Pill>
      </div>

      <div className="pointer-events-auto">
        <IconButton label="Reset level" onClick={onReset}>
          <RotateCcw className="size-[18px]" aria-hidden />
        </IconButton>
      </div>
    </header>
  )
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-11 items-center gap-2.5 rounded-full border border-line bg-panel px-3.5 text-sm">
      {children}
    </div>
  )
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="pressable flex size-11 cursor-pointer items-center justify-center rounded-[10px] border border-line-strong bg-panel text-fg outline-none focus-visible:ring-2 focus-visible:ring-dial disabled:cursor-default disabled:opacity-40"
    >
      {children}
    </button>
  )
}
