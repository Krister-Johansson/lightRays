import { Check, ChevronLeft, Lock } from 'lucide-react'
import { useState } from 'react'
import { IconButton } from '../components/controls'
import { LevelPreview } from '../components/LevelPreview'
import { PieceIcon } from '../components/PieceIcon'
import { LEVELS } from '../game/levels'
import { PIECE_INFO } from '../game/pieces'
import type { LevelDef, PieceType } from '../game/schema'
import { go } from '../lib/route'
import { loadSolved } from '../lib/storage'

const CHAPTERS = [
  { n: 1, name: 'Reflection', intro: 'Mirrors only', color: '#FFC940' },
  { n: 2, name: 'Splitting', intro: 'Beam splitters, more receivers', color: '#4FA8FF' },
  { n: 3, name: 'Spectrum', intro: 'Prisms break white light into colours', color: '#45E08A' },
  { n: 4, name: 'Filters', intro: 'Colour filters and colour-locked receivers', color: '#FF5A4E' },
]

function goalText(level: LevelDef) {
  const goals = level.pieces.filter((p) => p.type === 'receiver' || p.type === 'tube').length
  const must = level.pieces.some((p) => p.mustHit)
  const what = goals === 1 ? 'Light the receiver' : `Light all ${goals} receivers`
  const goal = must ? `${what} and hit the marked piece.` : `${what}.`
  return level.pieces.some((p) => p.type === 'scientist') ? `${goal} Don't zap the test figures.` : goal
}

function kitSummary(level: LevelDef) {
  const counts = new Map<PieceType, number>()
  for (const p of level.pieces) if (p.lock !== 'fixed') counts.set(p.type, (counts.get(p.type) ?? 0) + 1)
  return [...counts]
}

export function LevelSelectScreen() {
  const solved = loadSolved()
  const unlocked = (i: number) => i === 0 || solved.has(LEVELS[i - 1].id)
  const firstOpen = LEVELS.findIndex((l, i) => unlocked(i) && !solved.has(l.id))
  const [picked, setPicked] = useState(() => Math.max(0, firstOpen))
  const level = LEVELS[picked]

  return (
    <div className="flex h-full flex-col bg-ink">
      <header className="flex h-[76px] shrink-0 items-center gap-5 border-b border-[#1F2227] px-4 sm:px-10">
        <IconButton label="Back to menu" onClick={() => go('/')}>
          <ChevronLeft className="size-5" aria-hidden />
        </IconButton>
        <h1 className="m-0 text-[26px] font-semibold">Levels</h1>
        <div className="flex-1" />
        <div className="font-mono text-[13px] text-muted">
          {LEVELS.filter((l) => solved.has(l.id)).length} of {LEVELS.length} solved
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <main className="flex flex-1 flex-col gap-8 overflow-y-auto px-4 py-8 sm:px-10">
          {CHAPTERS.map((ch) => {
            const levels = LEVELS.map((l, i) => ({ l, i })).filter(({ l }) => l.id.startsWith(`${ch.n}-`))
            return (
              <section key={ch.n} className="flex flex-col gap-3">
                <div className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
                  <span className="font-mono text-xs text-muted">CH {ch.n}</span>
                  <h2 className="m-0 text-xl font-semibold">{ch.name}</h2>
                  <span className="text-sm text-muted">{ch.intro}</span>
                  <span className="size-2.5 rounded-full" style={{ background: ch.color }} aria-hidden />
                </div>
                {levels.length === 0 ? (
                  <p className="m-0 rounded-xl border border-dashed border-[#262A2F] px-4 py-5 text-sm text-faint">
                    Coming soon. Try these pieces in the sandbox.
                  </p>
                ) : (
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-3">
                    {levels.map(({ l, i }) => {
                      const open = unlocked(i)
                      const done = solved.has(l.id)
                      const current = picked === i
                      return (
                        <button
                          type="button"
                          key={l.id}
                          disabled={!open}
                          onClick={() => setPicked(i)}
                          onDoubleClick={() => open && go(`/play/${l.id}`)}
                          aria-pressed={current}
                          aria-label={`Level ${l.id}${done ? ', solved' : open ? '' : ', locked'}`}
                          className="pressable flex h-[92px] cursor-pointer flex-col justify-between rounded-xl border p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-dial disabled:cursor-default"
                          style={{
                            background: current ? '#1E1A0E' : open ? '#15171A' : '#111315',
                            borderColor: current ? '#FFC940' : open ? '#2A2E34' : '#262A2F',
                            borderStyle: open ? 'solid' : 'dashed',
                            borderWidth: current ? 2 : 1,
                            color: open ? '#ECEAE4' : '#8A8F97',
                          }}
                        >
                          <span className="font-mono text-sm">{l.id}</span>
                          {done ? (
                            <span className="flex items-center gap-1.5 text-xs text-amber">
                              <Check className="size-3.5" strokeWidth={2.5} aria-hidden /> Solved
                            </span>
                          ) : open ? (
                            <span className="text-xs font-semibold text-amber">Up next</span>
                          ) : (
                            <Lock className="size-4" aria-hidden />
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </section>
            )
          })}
        </main>

        {level && (
          <aside className="flex shrink-0 flex-col gap-5 border-t border-[#1F2227] bg-panel-2 p-6 lg:w-[380px] lg:border-t-0 lg:border-l lg:p-8">
            <div className="font-mono text-xs tracking-[1px] text-muted">LEVEL {level.id}</div>
            <h2 className="m-0 text-[32px] leading-[1.1] font-semibold">{level.name}</h2>
            <LevelPreview level={level} className="w-full rounded-[10px] border border-line" />
            <div className="flex flex-col gap-2">
              <div className="text-[13px] text-muted">Goal</div>
              <div>{goalText(level)}</div>
            </div>
            <div className="flex flex-col gap-2">
              <div className="text-[13px] text-muted">Your kit</div>
              {kitSummary(level).map(([type, n]) => (
                <div key={type} className="flex items-center gap-3 rounded-[10px] border border-line bg-card px-3.5 py-3">
                  <PieceIcon type={type} size={28} />
                  <span className="flex-1">{PIECE_INFO[type].label}</span>
                  <span className="font-mono">×{n}</span>
                </div>
              ))}
            </div>
            <div className="flex-1" />
            <a
              href={`#/play/${level.id}`}
              className="pressable pressable-primary flex h-14 items-center justify-center rounded-[10px] bg-amber text-lg font-semibold text-amber-ink no-underline outline-none focus-visible:ring-2 focus-visible:ring-fg"
            >
              Play level
            </a>
          </aside>
        )}
      </div>
    </div>
  )
}
