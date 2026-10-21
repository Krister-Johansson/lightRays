import { ArrowRight, Lock } from 'lucide-react'
import { useEffect, useEffectEvent } from 'react'

type Props = {
  unlocked: boolean
  label: string
  beam: string
  onFinish: () => void
}

/**
 * Locked until the beam's unlock pulse reaches the receiver, then lights up in the
 * beam colour with a one-off sweep of light. Enter finishes the round too.
 */
export function FinishButton({ unlocked, label, beam, onFinish }: Props) {
  const finishFromKeyboard = useEffectEvent(() => onFinish())
  useEffect(() => {
    if (!unlocked) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) finishFromKeyboard()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [unlocked])

  return (
    <button
      type="button"
      onClick={onFinish}
      disabled={!unlocked}
      data-unlocked={unlocked}
      style={{ '--beam': beam } as React.CSSProperties}
      className="finish-button pressable pointer-events-auto relative flex h-14 cursor-pointer items-center gap-3 overflow-hidden rounded-xl px-6 text-lg font-semibold outline-none focus-visible:ring-2 focus-visible:ring-fg disabled:cursor-default"
    >
      {unlocked ? (
        <>
          <span>{label}</span>
          <ArrowRight className="size-5" aria-hidden />
        </>
      ) : (
        <>
          <Lock className="size-4" aria-hidden />
          <span className="text-base font-medium">Light the receiver</span>
        </>
      )}
    </button>
  )
}
