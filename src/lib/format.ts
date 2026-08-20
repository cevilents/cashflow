export function formatRupiah(value: number): string {
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(Math.round(value))
  return `${sign}Rp ${new Intl.NumberFormat('id-ID').format(abs)}`
}

export function parseAmountInput(raw: string): number | null {
  const digits = raw.replace(/[^\d]/g, '')
  if (!digits) return null
  const value = parseInt(digits, 10)
  return Number.isFinite(value) && value > 0 ? value : null
}