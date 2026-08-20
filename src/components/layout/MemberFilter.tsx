import { useMembers } from '../../hooks/useMembers'

export type OwnerFilter = 'all' | string

export function MemberFilter({ value, onChange }: { value: OwnerFilter; onChange: (v: OwnerFilter) => void }) {
  const { data: members } = useMembers()
  const list = members ?? []
  const options: OwnerFilter[] = ['all', ...list.map((m) => m.id)]
  const labels: Record<string, string> = { all: 'Semua' }
  for (const m of list) labels[m.id] = m.name

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((id) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            value === id ? 'bg-good text-white' : 'bg-surface-soft text-ink-muted hover:text-ink'
          }`}
        >
          {labels[id]}
        </button>
      ))}
    </div>
  )
}
