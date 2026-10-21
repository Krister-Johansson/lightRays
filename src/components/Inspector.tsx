import { Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Game, GameSnapshot } from '../game/Game'
import { COLOR_HEX, PIECE_INFO } from '../game/pieces'
import { COLOR_BITS, type ColorName, type LevelDef, type Piece, type PieceType } from '../game/schema'
import { Button } from './controls'
import { PieceIcon } from './PieceIcon'

const LOCKS: { value: Piece['lock']; title: string; detail: string }[] = [
  { value: 'fixed', title: 'Fixed on the table', detail: "Player can't move or rotate it" },
  { value: 'kit', title: "In the player's kit", detail: 'Starts in the tray, player places it' },
  { value: 'rotate', title: 'Fixed position, free rotation', detail: 'Player can only turn it' },
]

const COLORS = Object.keys(COLOR_BITS) as ColorName[]

const BOARD_SIZES = [
  { label: 'Standard', width: 1120, height: 620 },
  { label: 'Large', width: 1440, height: 800 },
  { label: 'Huge', width: 1760, height: 980 },
]

type Props = {
  snap: GameSnapshot
  game: Game
  meta: Pick<LevelDef, 'name' | 'id' | 'par'>
  onMeta: (patch: Partial<Pick<LevelDef, 'name' | 'id' | 'par'>>) => void
}

/** Sandbox right panel: properties of the selected piece, or the level when nothing is selected. */
export function Inspector({ snap, game, meta, onMeta }: Props) {
  const p = snap.selected
  if (!p) return <LevelPanel snap={snap} game={game} meta={meta} onMeta={onMeta} />
  const info = PIECE_INFO[p.type]
  const set = (patch: Partial<Piece>) => game.updatePiece(p.id, patch)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <PieceIcon type={p.type} color={'color' in p ? p.color : undefined} size={32} />
        <div className="min-w-0">
          <div className="font-mono text-[11px] tracking-[1.5px] text-muted">SELECTED PIECE</div>
          <h2 className="m-0 truncate text-xl font-semibold">{info.label}</h2>
        </div>
      </div>
      <p className="m-0 -mt-2 text-sm text-muted">{info.blurb}.</p>

      <LockPicker piece={p} rotatable={info.rotatable} onPick={(lock) => set({ lock })} />

      <Toggle
        label="Must be hit"
        detail="Level isn't solved until a beam touches it"
        checked={!!p.mustHit}
        onChange={(v) => set({ mustHit: v || undefined })}
      />

      <ColorField piece={p} onChange={(color) => set({ color } as Partial<Piece>)} />

      <AxisField piece={p} set={set} />

      <NumberFields piece={p} rotatable={info.rotatable} set={set} />

      <Button variant="danger" onClick={() => game.removePiece(p.id)}>
        <Trash2 className="size-4" aria-hidden /> Remove piece
      </Button>
    </div>
  )
}

function LockPicker({ piece, rotatable, onPick }: { piece: Piece; rotatable: boolean; onPick: (lock: Piece['lock']) => void }) {
  return (
    <Field label="Who places it">
      <div className="flex flex-col gap-2" role="radiogroup" aria-label="Who places it">
        {LOCKS.filter((l) => rotatable || l.value !== 'rotate').map((l) => (
          <button
            type="button"
            role="radio"
            aria-checked={piece.lock === l.value}
            key={l.value}
            onClick={() => onPick(l.value)}
            className="pressable flex cursor-pointer items-start gap-3 rounded-[10px] border p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-dial"
            style={{ borderColor: piece.lock === l.value ? '#2F5E8C' : '#23272C', background: piece.lock === l.value ? '#13202d' : '#15171A' }}
          >
            <span
              className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2"
              style={{ borderColor: piece.lock === l.value ? '#4FA8FF' : '#3A3F46' }}
              aria-hidden
            >
              {piece.lock === l.value && <span className="size-1.5 rounded-full bg-dial" />}
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-sm text-fg">{l.title}</span>
              <span className="text-xs text-muted">{l.detail}</span>
            </span>
          </button>
        ))}
      </div>
    </Field>
  )
}

function ColorField({ piece, onChange }: { piece: Piece; onChange: (color: ColorName | undefined) => void }) {
  if (!('color' in piece) && piece.type !== 'receiver' && piece.type !== 'tube') return null
  const goal = piece.type === 'receiver' || piece.type === 'tube'
  return (
    <Field label={goal ? 'Needs colour' : 'Colour'}>
      <div className="flex flex-wrap gap-2">
        {goal && <Swatch label="Any" selected={!piece.color} onClick={() => onChange(undefined)} />}
        {COLORS.map((c) => (
          <Swatch key={c} label={c} color={COLOR_HEX[COLOR_BITS[c]]} selected={piece.color === c} onClick={() => onChange(c)} />
        ))}
      </div>
    </Field>
  )
}

type NumberSpec = { key: string; label: string; step: number; min: number; max?: number }

const SIZE: NumberSpec[] = [
  { key: 'w', label: 'Width', step: 10, min: 20 },
  { key: 'h', label: 'Height', step: 10, min: 20 },
]
const FOCAL: NumberSpec[] = [{ key: 'focal', label: 'Focal length', step: 10, min: 40, max: 600 }]

/** Type-specific number fields, besides the angle. */
const NUMBER_FIELDS: Partial<Record<PieceType, NumberSpec[]>> = {
  wall: SIZE,
  glass: SIZE,
  gate: SIZE,
  prism: [{ key: 'size', label: 'Size', step: 10, min: 40 }],
  'right-prism': [{ key: 'size', label: 'Size', step: 10, min: 40 }],
  rhomboid: [{ key: 'length', label: 'Shift', step: 10, min: 40 }],
  concave: FOCAL,
  'convex-lens': FOCAL,
  'concave-lens': FOCAL,
  grating: [{ key: 'spread', label: 'Spread °', step: 1, min: 5, max: 80 }],
  tube: [{ key: 'cone', label: 'Cone ±°', step: 1, min: 1, max: 45 }],
}

function NumberFields({ piece, rotatable, set }: { piece: Piece; rotatable: boolean; set: (patch: Partial<Piece>) => void }) {
  const values = piece as unknown as Record<string, number>
  return (
    <div className="grid grid-cols-2 gap-3">
      {rotatable && <NumberField label="Angle °" value={piece.angle} step={1} onChange={(v) => set({ angle: ((v % 360) + 360) % 360 })} />}
      {NUMBER_FIELDS[piece.type]?.map((f) => (
        <NumberField key={f.key} label={f.label} value={values[f.key]} step={f.step} min={f.min} max={f.max} onChange={(v) => set({ [f.key]: v } as Partial<Piece>)} />
      ))}
    </div>
  )
}

function AxisField({ piece, set }: { piece: Piece; set: (patch: Partial<Piece>) => void }) {
  if (piece.type !== 'polariser') return null
  return (
    <Field label="Polarisation">
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Polarisation">
        {(['vertical', 'horizontal'] as const).map((axis) => (
          <button
            key={axis}
            type="button"
            role="radio"
            aria-checked={piece.axis === axis}
            onClick={() => set({ axis } as Partial<Piece>)}
            className="pressable h-10 cursor-pointer rounded-[10px] border text-sm text-fg capitalize outline-none focus-visible:ring-2 focus-visible:ring-dial"
            style={{ borderColor: piece.axis === axis ? '#2F5E8C' : '#23272C', background: piece.axis === axis ? '#13202d' : '#15171A' }}
          >
            {axis === 'vertical' ? '| Vertical' : '— Horizontal'}
          </button>
        ))}
      </div>
    </Field>
  )
}

function LevelPanel({ snap, game, meta, onMeta }: Props) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="font-mono text-[11px] tracking-[1.5px] text-muted">LEVEL</div>
        <p className="m-0 mt-1 text-sm text-muted">Select a piece to edit it. Build a solved layout, mark which pieces the player gets, then test play.</p>
      </div>
      <Field label="Name">
        <input
          aria-label="Level name"
          value={meta.name}
          onChange={(e) => onMeta({ name: e.target.value })}
          className="h-10 rounded-[10px] border border-line-strong bg-card px-3 text-sm text-fg outline-none focus-visible:ring-2 focus-visible:ring-dial"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Level id">
          <input
            aria-label="Level id"
            value={meta.id}
            placeholder="2-1"
            onChange={(e) => onMeta({ id: e.target.value })}
            className="h-10 w-full rounded-[10px] border border-line-strong bg-card px-3 font-mono text-sm text-fg outline-none focus-visible:ring-2 focus-visible:ring-dial"
          />
        </Field>
        <NumberField label="Par moves" value={meta.par} step={1} min={0} onChange={(par) => onMeta({ par })} />
      </div>
      <Field label="Board size">
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Board size">
          {BOARD_SIZES.map((b) => {
            const on = snap.level.width === b.width && snap.level.height === b.height
            return (
              <button
                key={b.label}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => game.setBoardSize(b.width, b.height)}
                className="pressable flex h-12 cursor-pointer flex-col items-center justify-center rounded-[10px] border text-sm text-fg outline-none focus-visible:ring-2 focus-visible:ring-dial"
                style={{ borderColor: on ? '#2F5E8C' : '#23272C', background: on ? '#13202d' : '#15171A' }}
              >
                <span>{b.label}</span>
                <span className="font-mono text-[10px] text-muted">
                  {b.width}×{b.height}
                </span>
              </button>
            )
          })}
        </div>
      </Field>
      <dl className="m-0 grid grid-cols-2 gap-2 text-sm">
        <Stat label="Receivers lit" value={`${snap.goals.lit} / ${snap.goals.total}`} />
        <Stat label="Pieces" value={String(snap.pieces.length)} />
      </dl>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] border border-line bg-card px-3 py-2.5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="m-0 font-mono text-base tabular-nums">{value}</dd>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] text-muted">{label}</span>
      {children}
    </div>
  )
}

function NumberField({
  label,
  value,
  step,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  step: number
  min?: number
  max?: number
  onChange: (v: number) => void
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        aria-label={label}
        value={Number(value.toFixed(1))}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const v = e.target.valueAsNumber
          if (!Number.isNaN(v) && Number.isFinite(v) && (min === undefined || v >= min) && (max === undefined || v <= max)) onChange(v)
        }}
        className="h-10 w-full rounded-[10px] border border-line-strong bg-card px-3 font-mono text-sm text-fg tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-dial"
      />
    </Field>
  )
}

function Toggle({ label, detail, checked, onChange }: { label: string; detail: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="pressable flex cursor-pointer items-center gap-3 rounded-[10px] border border-line bg-card p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-dial"
    >
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="text-sm text-fg">{label}</span>
        <span className="text-xs text-muted">{detail}</span>
      </span>
      <span
        className="relative h-6 w-10 shrink-0 rounded-full transition-colors duration-200 ease-out"
        style={{ background: checked ? '#FFC940' : '#2E3238' }}
        aria-hidden
      >
        <span
          className="absolute top-1 left-1 size-4 rounded-full bg-fg transition-transform duration-200"
          style={{ transform: checked ? 'translateX(16px)' : 'none', transitionTimingFunction: 'var(--ease-out-strong)' }}
        />
      </span>
    </button>
  )
}

function Swatch({ label, color, selected, onClick }: { label: string; color?: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={selected}
      title={label}
      className="pressable flex size-8 cursor-pointer items-center justify-center rounded-full border-2 outline-none focus-visible:ring-2 focus-visible:ring-dial"
      style={{ borderColor: selected ? '#ECEAE4' : 'transparent' }}
    >
      {color ? (
        <span className="size-5 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}66` }} />
      ) : (
        <span className="font-mono text-[10px] text-muted">any</span>
      )}
    </button>
  )
}
