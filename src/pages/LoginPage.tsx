import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wallet } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useIsSetupComplete, useMembers } from '../hooks/useMembers'
import { MEMBER_SLOTS, memberInitials } from '../lib/members'
import { translateAuthError } from '../lib/authErrors'
import { useToast } from '../components/ui/Toast'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'

export default function LoginPage() {
  const { data: setupComplete, isLoading } = useIsSetupComplete()
  const { data: members } = useMembers()
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()
  const { toast } = useToast()
  const { login } = useAuth()

  useEffect(() => {
    if (!isLoading && !setupComplete) {
      supabase.functions.invoke('bootstrap', { method: 'POST', body: {} }).catch(() => {})
    }
  }, [isLoading, setupComplete])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size={32} />
      </div>
    )
  }

  const selectedSlot = MEMBER_SLOTS.find((m) => m.email === selectedEmail) ?? null
  const selectedMember = selectedEmail
    ? (members ?? []).find((m) => m.email === selectedEmail)
    : undefined
  const isNewPassword = selectedMember != null && !selectedMember.password_set

  const onSignIn = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedSlot || !selectedMember) return
    setSubmitting(true)
    try {
      await login(selectedSlot.email, password)
      navigate('/')
    } catch (error) {
      toast(translateAuthError(error), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const onCreatePassword = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedSlot || !selectedMember) return
    if (password.length < 6) {
      toast('Password minimal 6 karakter', 'error')
      return
    }
    if (password !== confirm) {
      toast('Konfirmasi password tidak cocok', 'error')
      return
    }
    setSubmitting(true)
    try {
      const { error } = await supabase.functions.invoke('set-password', {
        method: 'POST',
        body: { email: selectedSlot.email, password },
      })
      if (error) throw error
      await login(selectedSlot.email, password)
      navigate('/')
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Gagal membuat password', 'error')
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

        {!selectedSlot ? (
          <div className="grid grid-cols-3 gap-3">
            {MEMBER_SLOTS.map((m) => {
              const member = (members ?? []).find((x) => x.email === m.email)
              const pending = member != null && !member.password_set
              return (
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
                  {pending && (
                    <span className="rounded-full bg-good/15 px-2 py-0.5 text-[11px] font-medium text-good">
                      Belum ada password
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ) : (
          <form
            onSubmit={isNewPassword ? onCreatePassword : onSignIn}
            className="rounded-2xl border border-border-subtle bg-surface-card p-6"
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ background: selectedSlot.color }}
                >
                  {memberInitials(selectedSlot.name)}
                </span>
                <div>
                  <h2 className="text-base font-semibold text-ink">{selectedSlot.name}</h2>
                  <p className="text-xs text-ink-muted">
                    {isNewPassword ? 'Buat password baru' : 'Masuk dengan password'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setSelectedEmail(null); setPassword(''); setConfirm('') }}
                className="text-sm text-ink-muted hover:text-ink"
              >
                Ganti
              </button>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isNewPassword ? 'Password baru' : 'Password'}
              required
              minLength={6}
              autoComplete={isNewPassword ? 'new-password' : 'current-password'}
              className="w-full rounded-xl border border-border-subtle bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-good"
            />
            {isNewPassword && (
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Ulangi password"
                required
                minLength={6}
                autoComplete="new-password"
                className="mt-3 w-full rounded-xl border border-border-subtle bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-good"
              />
            )}
            <Button type="submit" className="mt-4 w-full" disabled={submitting}>
              {submitting
                ? 'Memproses…'
                : isNewPassword
                  ? 'Buat Password & Masuk'
                  : 'Masuk'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
