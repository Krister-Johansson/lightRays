import { CircleHelp } from 'lucide-react'

const MOUSE: [string, string][] = [
  ['Click a mirror', 'Select it and show the rotation dial'],
  ['Drag the handle', 'Rotate. Further out means finer steps: 5°, 1°, 0.1°'],
]

const KEYS: [string, string][] = [
  ['Shift', 'Snap to 15° while dragging'],
  ['← →', 'Nudge 1° (Shift 15°, Alt 0.1°)'],
  ['Tab', 'Next mirror'],
  ['Esc', 'Deselect'],
  ['Enter', 'Finish round once it unlocks'],
]

/**
 * (?) button with a light-dismiss popover. Uses the native popover API, so Esc and
 * clicking outside close it without extra code.
 */
export function HelpPopover() {
  return (
    <>
      <button
        type="button"
        popoverTarget="help-popover"
        aria-label="How to play"
        title="How to play"
        className="pressable flex size-11 cursor-pointer items-center justify-center rounded-[10px] border border-line-strong bg-panel text-fg outline-none focus-visible:ring-2 focus-visible:ring-dial"
      >
        <CircleHelp className="size-[18px]" aria-hidden />
      </button>
      <div
        id="help-popover"
        popover="auto"
        className="help-popover fixed top-[76px] right-4 bottom-auto left-auto m-0 w-[min(340px,calc(100vw-32px))] rounded-2xl border border-line-strong bg-card p-5 text-fg shadow-[0_16px_48px_rgb(0_0_0/0.5)] sm:right-8"
      >
        <h2 className="m-0 text-base font-semibold">How to play</h2>
        <p className="mt-1.5 mb-4 text-sm leading-snug text-muted">
          Rotate the mirrors to guide the laser into the receiver. Mirrors with an amber diamond must be in the beam's
          path. Mirrors on a screwed plate are fixed.
        </p>
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-sm">
          {MOUSE.map(([action, what]) => (
            <div key={action} className="contents">
              <dt className="font-medium whitespace-nowrap text-fg">{action}</dt>
              <dd className="m-0 leading-snug text-muted">{what}</dd>
            </div>
          ))}
          <div className="col-span-2 my-1 h-px bg-line" aria-hidden />
          {KEYS.map(([key, what]) => (
            <div key={key} className="contents">
              <dt>
                <kbd className="inline-block rounded-md border border-line-strong bg-panel-2 px-1.5 py-0.5 font-mono text-xs whitespace-nowrap text-fg">
                  {key}
                </kbd>
              </dt>
              <dd className="m-0 leading-snug text-muted">{what}</dd>
            </div>
          ))}
        </dl>
      </div>
    </>
  )
}
