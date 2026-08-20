import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Wallet } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useIsSetupComplete } from '../hooks/useMembers'
import { MEMBER_SLOTS } from '../lib/members'
import { useToast } from '../components/ui/Toast'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'

type Passwords = Record<string, string>

export default function SetupPage() {
  const { data: setupComplete, isLoading: checking } = useIsSetupComplete()
  const [passwords, setPasswords] = useState<Passwords>({})
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()
  const { toast } = useToast()

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size={32} />
      </div>
    )
  }

  if (setupComplete) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-4">
        <p className="text-sm text-ink-muted">Sistem sudah disetel.</p>
      </div>
    )
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const values = MEMBER_SLOTS.map((m) => passwords[m.email] ?? '')
    if (values.some((v) => v.length < 6)) {
      toast('Setiap password minimal 6 karakter', 'error')
      return
    }
    setSubmitting(true)
    try {
      const { error } = await supabase.functions.invoke('bootstrap', {
        body: { passwords },
      })
      if (error) throw error
      toast('Pengaturan awal selesai! Silakan masuk.')
      navigate('/login')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal menyetel pengaturan', 'error')
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
            <p className="text-xs text-ink-muted">Pengaturan awal</p>
          </div>
        </div>
        <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-border-subtle bg-surface-card p-6">
          <h2 className="text-base font-semibold text-ink">Buat password untuk masing-masing</h2>
          {MEMBER_SLOTS.map((m) => (
            <div key={m.email}>
              <label className="mb-1 block text-sm text-ink">{m.name}</label>
              <input
                type="password"
                value={passwords[m.email] ?? ''}
                onChange={(e) => setPasswords((p) => ({ ...p, [m.email]: e.target.value }))}
                placeholder="Password"
                minLength={6}
                autoComplete="new-password"
                className="w-full rounded-xl border border-border-subtle bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-good"
              />
            </div>
          ))}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Menyetel…' : 'Simpan & Lanjut'}
          </Button>
        </form>
      </div>
    </div>
  )
}
