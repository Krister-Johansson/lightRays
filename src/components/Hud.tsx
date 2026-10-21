import { ChevronLeft, RotateCcw } from 'lucide-react'
import type { GameSnapshot } from '../game/Game'
import { IconButton, Pill, StatusDot } from './controls'
import { HelpPopover } from './HelpPopover'

type Props = {
  snap: GameSnapshot
  backLabel: string
  onBack: () => void
  onReset: () => void
}

export function Hud({ snap, backLabel, onBack, onReset }: Props) {
  const { goals, mustHit } = snap
  const allLit = goals.total > 0 && goals.lit === goals.total
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 flex h-[76px] items-center gap-3 px-4 sm:px-8">
      <div className="pointer-events-auto">
        <IconButton label={backLabel} onClick={onBack}>
          <ChevronLeft className="size-5" aria-hidden />
        </IconButton>
      </div>
      <span className="font-mono text-[13px] whitespace-nowrap text-muted">{snap.level.id === 'sandbox' ? 'TEST' : snap.level.id}</span>
      <h1 className="m-0 truncate text-[22px] font-semibold">{snap.level.name}</h1>
      <div className="flex-1" />

      <div className="pointer-events-auto hidden items-center gap-3 sm:flex">
        <Pill>
          <StatusDot on={allLit} color="#FFC940" />
          <span>{goals.total === 1 ? 'Receiver' : 'Receivers'}</span>
          <span className="font-mono text-xs tabular-nums" aria-live="polite" style={{ color: allLit ? '#FFC940' : undefined }}>
            {goals.total === 1 ? (allLit ? 'LIT' : 'DARK') : `${goals.lit} / ${goals.total}`}
          </span>
        </Pill>
        {mustHit.total > 0 && (
          <Pill>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
              <path d="M7 1l6 6-6 6-6-6z" fill={mustHit.hit === mustHit.total ? '#FFC940' : 'none'} stroke="#FFC940" strokeWidth="1.5" />
            </svg>
            <span>Must hit</span>
            <span className="font-mono text-xs tabular-nums">
              {mustHit.hit} / {mustHit.total}
            </span>
          </Pill>
        )}
        <Pill>
          <span className="text-muted">Moves</span>
          <span className="font-mono text-[13px] tabular-nums">{snap.moves}</span>
        </Pill>
      </div>

      <div className="pointer-events-auto flex items-center gap-2">
        <HelpPopover />
        <IconButton label="Reset level" onClick={onReset}>
          <RotateCcw className="size-[18px]" aria-hidden />
        </IconButton>
      </div>
    </header>
  )
}
