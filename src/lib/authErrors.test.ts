import { describe, expect, it } from 'vitest'
import { translateAuthError } from './authErrors'

describe('translateAuthError', () => {
  it('maps invalid login credentials to Indonesian', () => {
    expect(translateAuthError({ message: 'Invalid login credentials' })).toBe(
      'Email atau password salah',
    )
  })

  it('maps already registered to Indonesian', () => {
    expect(translateAuthError({ message: 'User already registered' })).toBe(
      'Email sudah terdaftar',
    )
  })

  it('maps short password to Indonesian', () => {
    expect(
      translateAuthError({ message: 'Password should be at least 6 characters' }),
    ).toBe('Password minimal 6 karakter')
  })

  it('maps invalid email to Indonesian', () => {
    expect(
      translateAuthError({ message: 'Unable to validate email address: invalid format' }),
    ).toBe('Format email tidak valid')
  })

  it('maps unconfirmed email to Indonesian', () => {
    expect(translateAuthError({ message: 'Email not confirmed' })).toBe(
      'Email belum dikonfirmasi. Cek kotak masuk email kamu.',
    )
  })

  it('maps email send rate limit by its error code', () => {
    expect(
      translateAuthError({ code: 'over_email_send_rate_limit', message: 'Email rate limit exceeded' }),
    ).toBe('Terlalu banyak percobaan. Coba lagi nanti.')
  })

  it('maps the email rate limit message without a code', () => {
    expect(translateAuthError({ message: 'Email rate limit exceeded' })).toBe(
      'Terlalu banyak percobaan. Coba lagi nanti.',
    )
  })

  it('maps the invalid credentials code when no message is present', () => {
    expect(translateAuthError({ code: 'invalid_credentials' })).toBe('Email atau password salah')
  })

  it('falls back to a generic message for unknown errors', () => {
    expect(translateAuthError({ message: 'something unexpected' })).toBe(
      'Terjadi kesalahan. Coba lagi.',
    )
  })

  it('falls back for non-object input', () => {
    expect(translateAuthError('nope')).toBe('Terjadi kesalahan. Coba lagi.')
  })
})