import type { ReactNode } from 'react'

export type BadgeTone = 'good' | 'bad' | 'move' | 'neutral'

const tones: Record<BadgeTone, string> = {
  good: 'bg-good/15 text-good',
  bad: 'bg-bad/15 text-bad',
  move: 'bg-move/15 text-move',
  neutral: 'bg-surface-soft text-ink-muted border border-border-subtle',
}

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  )
}