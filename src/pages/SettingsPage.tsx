import { useState } from 'react'
import type { ChangeEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Download, LogOut, Upload } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { buildBackup, executeImport, parseBackup, validateBackupOwner, PARSE_ERROR_MESSAGES } from '../lib/backup'
import { downloadFile } from '../lib/csv'
import { useAuth } from '../hooks/useAuth'
import { useCurrentMember } from '../hooks/useReadOnly'
import { memberInitials } from '../lib/members'
import { useAccounts } from '../hooks/useAccounts'
import { useCategories } from '../hooks/useCategories'
import { useTransactions } from '../hooks/useTransactions'
import { useRecurring } from '../hooks/useRecurring'
import { Button } from '../components/ui/Button'
import { useToast } from '../components/ui/Toast'

export default function SettingsPage() {
  const { user, logout } = useAuth()
  const currentMember = useCurrentMember()
  const { data: accounts } = useAccounts()
  const { data: categories } = useCategories()
  const { data: transactions } = useTransactions()
  const { data: recurring } = useRecurring()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [importing, setImporting] = useState(false)

  const exportBackup = () => {
    if (!user) return
    const backup = buildBackup({
      userId: user.id,
      accounts: accounts ?? [],
      categories: categories ?? [],
      transactions: transactions ?? [],
      recurring: recurring ?? [],
    })
    const filename = `cashflow-backup-${new Date().toISOString().slice(0, 10)}.json`
    downloadFile(filename, JSON.stringify(backup, null, 2), 'application/json;charset=utf-8')
  }

  const importBackup = async (file: File) => {
    if (!user) return
    setImporting(true)
    try {
      const text = await file.text()
      const result = parseBackup(text)
      if (!result.ok) {
        toast(PARSE_ERROR_MESSAGES[result.error], 'error')
        return
      }
      if (!validateBackupOwner(result.data, user.id)) {
        toast('Backup ini milik akun lain — hanya bisa dipulihkan ke akun yang sama', 'error')
        return
      }
      await executeImport(supabase, result.data)
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['accounts'] }),
        qc.invalidateQueries({ queryKey: ['categories'] }),
        qc.invalidateQueries({ queryKey: ['transactions'] }),
        qc.invalidateQueries({ queryKey: ['recurring'] }),
      ])
      toast('Data berhasil diimpor')
    } catch (err) {
      toast(err instanceof Error ? `Gagal impor: ${err.message}` : 'Gagal impor', 'error')
    } finally {
      setImporting(false)
    }
  }

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) importBackup(file)
    e.target.value = ''
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-ink">Pengaturan</h1>
        <p className="text-sm text-ink-muted">Profil dan manajemen data</p>
      </div>

      <div className="rounded-2xl border border-border-subtle bg-surface-card p-5">
        <h2 className="mb-3 text-sm font-semibold text-ink">Profil</h2>
        <div className="flex items-center gap-3">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-full text-base font-bold text-white"
            style={{ background: currentMember?.color ?? '#10b981' }}
          >
            {memberInitials(currentMember?.name ?? '?')}
          </span>
          <div>
            <p className="text-base font-semibold text-ink">{currentMember?.name ?? ''}</p>
            <p className="text-sm text-ink-muted">{user?.email ?? ''}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-border-subtle bg-surface-card p-5">
        <h2 className="mb-1 text-sm font-semibold text-ink">Data</h2>
        <p className="mb-4 text-sm text-ink-muted">
          Backup semua data ke file JSON, atau pulihkan dari backup akun yang sama.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={exportBackup}>
            <Download className="h-4 w-4" /> Ekspor Backup
          </Button>
          <label className="cursor-pointer">
            <span className="inline-flex items-center gap-2 rounded-xl border border-border-subtle bg-surface-soft px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-surface-card">
              <Upload className="h-4 w-4" /> {importing ? 'Mengimpor…' : 'Impor Backup'}
            </span>
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={onFileChange}
            />
          </label>
        </div>
        <p className="mt-4 text-xs text-ink-muted">
          Backup hanya bisa dipulihkan ke akun yang sama (migrasi perangkat).
        </p>
      </div>

      <div className="rounded-2xl border border-border-subtle bg-surface-card p-5">
        <h2 className="mb-1 text-sm font-semibold text-ink">Sesi</h2>
        <p className="mb-4 text-sm text-ink-muted">Keluar dari aplikasi ini di perangkat.</p>
        <Button variant="secondary" onClick={handleLogout}>
          <LogOut className="h-4 w-4" /> Keluar
        </Button>
      </div>
    </div>
  )
}
