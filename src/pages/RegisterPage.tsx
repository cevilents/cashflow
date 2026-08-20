import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Wallet } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { translateAuthError } from '../lib/authErrors'
import { useToast } from '../components/ui/Toast'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

export default function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()
  const { toast } = useToast()
  const { register } = useAuth()

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 6) {
      toast('Password minimal 6 karakter', 'error')
      return
    }
    setSubmitting(true)
    try {
      const hasSession = await register(email, password, fullName)
      if (hasSession) {
        toast('Akun berhasil dibuat!')
        navigate('/')
      } else {
        toast('Akun dibuat! Silakan masuk.')
        navigate('/login')
      }
    } catch (error) {
      toast(translateAuthError(error), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-good">
            <Wallet className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-ink">Cashflow</h1>
            <p className="text-xs text-ink-muted">Kelola keuanganmu</p>
          </div>
        </div>
        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-border-subtle bg-surface-card p-6"
        >
          <h2 className="mb-4 text-base font-semibold text-ink">Buat Akun</h2>
          <div className="space-y-3">
            <Input
              label="Nama"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
            />
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" className="mt-5 w-full" disabled={submitting}>
            {submitting ? 'Membuat…' : 'Daftar'}
          </Button>
          <p className="mt-4 text-center text-sm text-ink-muted">
            Sudah punya akun?{' '}
            <Link to="/login" className="text-good hover:underline">
              Masuk
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}