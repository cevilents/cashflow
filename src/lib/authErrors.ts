const patterns: Array<[RegExp, string]> = [
  [/invalid login credentials|invalid_grant|invalid_credentials/i, 'Email atau password salah'],
  [/user already registered|already registered|user_already_exists/i, 'Email sudah terdaftar'],
  [/password should be at least 6 characters/i, 'Password minimal 6 karakter'],
  [/invalid email|unable to validate email address/i, 'Format email tidak valid'],
  [/email not confirmed/i, 'Email belum dikonfirmasi. Cek kotak masuk email kamu.'],
  [/user not found/i, 'Akun tidak ditemukan'],
  [/email rate limit|over_email_send_rate_limit/i, 'Terlalu banyak percobaan. Coba lagi nanti.'],
  [/rate limit|too many requests|retry after/i, 'Terlalu banyak percobaan. Coba lagi nanti.'],
]

const fallbackMessage = 'Terjadi kesalahan. Coba lagi.'

export function translateAuthError(error: unknown): string {
  if (error && typeof error === 'object') {
    const err = error as { message?: unknown; code?: unknown }
    const code = err.code != null ? String(err.code) : ''
    const message = err.message != null ? String(err.message) : ''
    const source = `${code} ${message}`.trim()
    for (const [pattern, text] of patterns) {
      if (pattern.test(source)) {
        return text
      }
    }
  }
  return fallbackMessage
}