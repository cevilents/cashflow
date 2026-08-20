import { addDays, addWeeks, addYears, format, getDaysInMonth, parseISO } from 'date-fns'
import type { Frequency } from '../types/database'

export function todayISO(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function advanceDate(dateISO: string, frequency: Frequency): string {
  const base = parseISO(dateISO)
  const next =
    frequency === 'weekly'
      ? addWeeks(base, 1)
      : frequency === 'monthly'
        ? addDays(base, getDaysInMonth(base))
        : addYears(base, 1)
  return format(next, 'yyyy-MM-dd')
}

const ID_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

export function monthLabel(d: Date): string {
  return ID_MONTHS[d.getMonth()] ?? ''
}

export function formatDay(dateISO: string): string {
  const d = parseISO(dateISO)
  const day = String(d.getDate()).padStart(2, '0')
  return `${day} ${monthLabel(d)} ${d.getFullYear()}`
}