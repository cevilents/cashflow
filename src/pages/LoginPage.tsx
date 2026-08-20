import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wallet } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useIsSetupComplete } from '../hooks/useMembers'
import { MEMBER_SLOTS, memberInitials } from '../lib/members'
import { translateAuthError } from '../lib/authErrors'
import { useToast } from '../components/ui/Toast'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'

export default function LoginPage() {
  const { data: setupComplete, isLoading } = useIsSetupComplete()
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()
  const { toast } = useToast()
  const { login } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size={32} />
      </div>
    )
  }

  if (!setupComplete) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-4">
        <div className="w-full max-w-md text-center">
          <h1 className="text-lg font-bold text-ink">Cashflow</h1>
          <p className="mt-1 text-sm text-ink-muted">Pengaturan awal belum selesai.</p>
          <Button className="mt-4" onClick={() => navigate('/setup')}>Pengaturan awal</Button>
        </div>
      </div>
    )
  }

  const selected = MEMBER_SLOTS.find((m) => m.email === selectedEmail) ?? null

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!selected) return
    setSubmitting(true)
    try {
      await login(selected.email, password)
      navigate('/')
    } catch (error) {
      toast(translateAuthError(error), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-good">
            <Wallet className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-ink">Cashflow</h1>
            <p className="text-xs text-ink-muted">Pilih pengguna untuk masuk</p>
          </div>
        </div>
        {!selected ? (
          <div className="grid grid-cols-3 gap-3">
            {MEMBER_SLOTS.map((m) => (
              <button
                key={m.email}
                type="button"
                onClick={() => setSelectedEmail(m.email)}
                className="flex flex-col items-center gap-2 rounded-2xl border border-border-subtle bg-surface-card p-5 transition-colors hover:border-good"
              >
                <span
                  className="flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold text-white"
                  style={{ background: m.color }}
                >
                  {memberInitials(m.name)}
                </span>
                <span className="text-sm font-semibold text-ink">{m.name}</span>
              </button>
            ))}
          </div>
        ) : (
          <form onSubmit={onSubmit} className="rounded-2xl border border-border-subtle bg-surface-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ background: selected.color }}
                >
                  {memberInitials(selected.name)}
                </span>
                <h2 className="text-base font-semibold text-ink">{selected.name}</h2>
              </div>
              <button type="button" onClick={() => { setSelectedEmail(null); setPassword('') }} className="text-sm text-ink-muted hover:text-ink">
                Ganti
              </button>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              autoComplete="current-password"
              className="w-full rounded-xl border border-border-subtle bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-good"
            />
            <Button type="submit" className="mt-4 w-full" disabled={submitting}>
              {submitting ? 'Masuk…' : 'Masuk'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
