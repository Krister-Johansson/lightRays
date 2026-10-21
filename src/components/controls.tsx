import type { ReactNode } from 'react'

// Plain Tailwind controls shared by the screens. Meant to be swapped for shadcn components
// once the shadcn CLI can reach its registry.

export function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="pressable flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-[10px] border border-line-strong bg-panel text-fg outline-none focus-visible:ring-2 focus-visible:ring-dial disabled:cursor-default disabled:opacity-40"
    >
      {children}
    </button>
  )
}

export function Button({
  children,
  onClick,
  variant = 'secondary',
  className = '',
  disabled,
}: {
  children: ReactNode
  onClick: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  className?: string
  disabled?: boolean
}) {
  const styles = {
    primary: 'pressable-primary bg-amber text-amber-ink font-semibold',
    secondary: 'border border-line-strong bg-panel text-fg',
    ghost: 'text-muted',
    danger: 'border border-[#5a2a27] bg-[#1d1211] text-[#ff8a80]',
  }[variant]
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`pressable inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-[10px] px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-dial disabled:cursor-default disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </button>
  )
}

export function Pill({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-11 items-center gap-2.5 rounded-full border border-line bg-panel px-3.5 text-sm whitespace-nowrap">
      {children}
    </div>
  )
}

export function StatusDot({ on, color }: { on: boolean; color: string }) {
  return (
    <span
      className="size-2.5 rounded-full transition-[background-color,box-shadow] duration-200 ease-out"
      style={{ backgroundColor: on ? color : '#3A3F46', boxShadow: on ? `0 0 10px ${color}` : 'none' }}
      aria-hidden
    />
  )
}
