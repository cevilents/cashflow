const patterns: Array<[RegExp, string]> = [
  [/payload too large|too large|exceeds|5 mb/i, 'Ukuran file maksimal 5 MB'],
  [/not found|bucket/i, 'Penyimpanan tidak tersedia. Coba lagi.'],
  [/already exists|duplicate/i, 'File sudah ada. Coba beberapa saat lagi.'],
  [/row-level security|permission|forbidden|denied|access/i, 'Tidak memiliki izin untuk menyimpan bukti'],
  [/file type|invalid file/i, 'Tipe file tidak didukung. Gunakan gambar.'],
  [/network|failed to fetch|fetch failed|timed? ?out|offline/i, 'Koneksi bermasalah. Coba lagi.'],
]

const fallbackMessage = 'Gagal menyimpan transaksi'

export function transactionErrorMessage(err: unknown): string {
  if (!err || typeof err !== 'object') return fallbackMessage
  const e = err as { message?: unknown; code?: unknown }
  const code = e.code != null ? String(e.code) : ''
  const message = e.message != null ? String(e.message) : ''
  const source = `${code} ${message}`.trim()
  if (!source) return fallbackMessage
  for (const [pattern, text] of patterns) {
    if (pattern.test(source)) {
      return text
    }
  }
  return fallbackMessage
}