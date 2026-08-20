import { describe, it, expect } from 'vitest'
import { transactionErrorMessage } from './transactionErrors'

describe('transactionErrorMessage', () => {
  it('maps storage size errors to Indonesian', () => {
    expect(transactionErrorMessage({ message: 'Payload too large' })).toBe('Ukuran file maksimal 5 MB')
    expect(transactionErrorMessage(new Error('object size exceeds maximum'))).toBe('Ukuran file maksimal 5 MB')
  })

  it('maps duplicate errors to Indonesian', () => {
    expect(transactionErrorMessage(new Error('The resource already exists'))).toBe(
      'File sudah ada. Coba beberapa saat lagi.',
    )
  })

  it('maps permission errors to Indonesian', () => {
    expect(transactionErrorMessage({ message: 'new row violates row-level security policy' })).toBe(
      'Tidak memiliki izin untuk menyimpan bukti',
    )
  })

  it('maps network errors to Indonesian', () => {
    expect(transactionErrorMessage(new Error('Failed to fetch'))).toBe('Koneksi bermasalah. Coba lagi.')
  })

  it('uses the fallback for unknown errors', () => {
    expect(transactionErrorMessage(new Error('something else'))).toBe('Gagal menyimpan transaksi')
    expect(transactionErrorMessage(null)).toBe('Gagal menyimpan transaksi')
    expect(transactionErrorMessage('plain string')).toBe('Gagal menyimpan transaksi')
  })
})