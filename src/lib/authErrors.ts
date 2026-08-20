const patterns: Array<[RegExp, string]> = [
  [/invalid login credentials/i, 'Email atau password salah'],
  [/user already registered|already registered/i, 'Email sudah terdaftar'],
  [/password should be at least 6 characters/i, 'Password minimal 6 karakter'],
  [/invalid email|unable to validate email address/i, 'Format email tidak valid'],
  [/email not confirmed/i, 'Email belum dikonfirmasi. Cek kotak masuk email kamu.'],
  [/user not found/i, 'Akun tidak ditemukan'],
  [/rate limit|too many requests|retry after/i, 'Terlalu banyak percobaan. Coba lagi nanti.'],
]

const fallbackMessage = 'Terjadi kesalahan. Coba lagi.'

export function translateAuthError(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message?: unknown }).message ?? '')
    for (const [pattern, text] of patterns) {
      if (pattern.test(message)) {
        return text
      }
    }
  }
  return fallbackMessage
}