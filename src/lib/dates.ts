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

export function formatDay(dateISO: string): string {
  return format(parseISO(dateISO), 'dd MMM yyyy')
}