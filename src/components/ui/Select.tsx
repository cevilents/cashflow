import { forwardRef } from 'react'
import type { SelectHTMLAttributes } from 'react'
import type { FieldProps } from './Input'

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & FieldProps
>(function Select({ label, error, className = '', id, children, ...props }, ref) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-xs font-medium text-ink-muted">{label}</span>}
      <select
        id={id}
        ref={ref}
        className={`w-full rounded-xl border border-border-subtle bg-surface-soft px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-good focus:ring-2 focus:ring-good/20 ${error ? 'border-bad' : ''} ${className}`}
        aria-invalid={error ? true : undefined}
        {...props}
      >
        {children}
      </select>
      {error && <span className="mt-1 block text-xs text-bad">{error}</span>}
    </label>
  )
})