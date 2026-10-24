import { RotateCcw } from 'lucide-react'
import { useEffect, useRef } from 'react'

/** Test-chamber signage card shown once a zapped figure has fizzled away. A modal dialog, so Enter on the focused button resets. */
export function GameOverCard({ onReset }: { onReset: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = dialog.current
    if (d && !d.open) d.showModal()
    return () => d?.close()
  }, [])

  return (
    <dialog
      ref={dialog}
      role="alertdialog"
      aria-labelledby="go-title"
      aria-describedby="go-text"
      // Esc would leave the board locked with nothing to press, so it resets instead.
      onCancel={(e) => {
        e.preventDefault()
        onReset()
      }}
      className="game-over-card m-auto w-[min(340px,calc(100%-32px))] overflow-hidden rounded-md border-0 bg-[#F7F7F5] p-0 text-[#17191B] shadow-[0_20px_60px_rgb(0_0_0/0.35)]"
    >
      <div className="bg-[#FF3B30] px-4 py-2 font-mono text-xs tracking-[1px] text-white uppercase">Test failed</div>
      <div className="flex flex-col gap-2.5 px-[18px] pt-4 pb-[18px]">
        <h2 id="go-title" className="m-0 text-[22px] font-bold">
          Figure lost
        </h2>
        <p id="go-text" className="m-0 text-sm leading-normal text-[#565B61]">
          A beam touched a test figure. A passing beam counts too, so shield them before you rotate.
        </p>
        <button
          type="button"
          autoFocus
          onClick={onReset}
          className="pressable mt-1 flex h-11 cursor-pointer items-center gap-2 self-start rounded px-4 text-sm font-semibold text-white outline-none focus-visible:ring-[3px] focus-visible:ring-[#1F8FFF] focus-visible:ring-offset-2"
          style={{ background: '#17191B' }}
        >
          <RotateCcw className="size-4" aria-hidden /> Reset chamber
        </button>
      </div>
    </dialog>
  )
}
