import { forwardRef } from 'react'
import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'

const base =
  'w-full rounded-xl border border-border-subtle bg-surface-soft px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted/60 outline-none transition focus:border-good focus:ring-2 focus:ring-good/20'

export interface FieldProps {
  label?: string
  error?: string
}

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & FieldProps
>(function Input({ label, error, className = '', id, ...props }, ref) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-xs font-medium text-ink-muted">{label}</span>}
      <input
        id={id}
        ref={ref}
        className={`${base} ${error ? 'border-bad' : ''} ${className}`}
        aria-invalid={error ? true : undefined}
        {...props}
      />
      {error && <span className="mt-1 block text-xs text-bad">{error}</span>}
    </label>
  )
})

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps
>(function Textarea({ label, error, className = '', id, ...props }, ref) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-xs font-medium text-ink-muted">{label}</span>}
      <textarea
        id={id}
        ref={ref}
        rows={3}
        className={`${base} ${error ? 'border-bad' : ''} ${className}`}
        aria-invalid={error ? true : undefined}
        {...props}
      />
      {error && <span className="mt-1 block text-xs text-bad">{error}</span>}
    </label>
  )
})