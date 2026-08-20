import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const variants: Record<Variant, string> = {
  primary: 'bg-good text-white hover:bg-emerald-500',
  secondary: 'bg-surface-soft text-ink border border-border-subtle hover:bg-surface-card',
  ghost: 'text-ink-muted hover:text-ink hover:bg-surface-soft',
  danger: 'bg-bad text-white hover:bg-rose-500',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' }) {
  const sizes = size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-4 py-2.5 text-sm'
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes} ${className}`}
      {...props}
    />
  )
}