import { useMemo, useState } from 'react'
import { Download, Printer } from 'lucide-react'
import { format } from 'date-fns'
import { useTransactions } from '../hooks/useTransactions'
import { useAccounts } from '../hooks/useAccounts'
import { useCategories } from '../hooks/useCategories'
import { formatRupiah } from '../lib/format'
import { toCSV, downloadFile, buildReportRows, REPORT_HEADER } from '../lib/csv'
import { buildReportSummary } from '../lib/reports'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Select'
import { Spinner } from '../components/ui/Spinner'
import { EmptyState } from '../components/ui/EmptyState'

interface MonthOption { value: string; label: string }

export default function ReportsPage() {
  const { data: transactions, isLoading } = useTransactions()
  const { data: accounts } = useAccounts()
  const { data: categories } = useCategories()
  const currentMonth = useMemo(() => format(new Date(), 'yyyy-MM'), [])
  const [month, setMonth] = useState(currentMonth)

  const months: MonthOption[] = useMemo(() => {
    const set = new Set<string>()
    for (const t of transactions ?? []) set.add(t.date.slice(0, 7))
    set.add(currentMonth)
    return [...set].sort().reverse().map((m) => ({ value: m, label: m }))
  }, [transactions, currentMonth])

  const report = useMemo(
    () => buildReportSummary(transactions ?? [], categories ?? [], month),
    [transactions, categories, month],
  )

  const exportCsv = () => {
    const rows = buildReportRows(transactions ?? [], accounts ?? [], categories ?? [], month)
    downloadFile(`cashflow-${month}.csv`, toCSV([REPORT_HEADER, ...rows]))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size={28} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-ink">Laporan</h1>
          <p className="text-sm text-ink-muted">Rekap bulanan dan export</p>
        </div>
        <div className="flex gap-2">
          <Select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Pilih bulan">
            {months.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </Select>
          <Button variant="secondary" onClick={exportCsv}>
            <Download className="h-4 w-4" /> CSV
          </Button>
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Cetak
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border-subtle bg-surface-card p-5">
          <p className="text-sm text-ink-muted">Pemasukan</p>
          <p className="mt-2 text-2xl font-bold text-good tabular">{formatRupiah(report.income)}</p>
        </div>
        <div className="rounded-2xl border border-border-subtle bg-surface-card p-5">
          <p className="text-sm text-ink-muted">Pengeluaran</p>
          <p className="mt-2 text-2xl font-bold text-bad tabular">{formatRupiah(report.expense)}</p>
        </div>
        <div className="rounded-2xl border border-border-subtle bg-surface-card p-5">
          <p className="text-sm text-ink-muted">Selisih</p>
          <p className={`mt-2 text-2xl font-bold tabular ${report.net >= 0 ? 'text-good' : 'text-bad'}`}>
            {formatRupiah(report.net)}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-border-subtle bg-surface-card p-5">
        <h2 className="mb-3 text-sm font-semibold text-ink">Rincian Pengeluaran per Kategori</h2>
        {report.rows.length === 0 ? (
          <EmptyState title="Tidak ada pengeluaran bulan ini" />
        ) : (
          <div className="space-y-2">
            {report.rows.map((row) => (
              <div key={row.name} className="flex items-center justify-between">
                <span className="text-sm text-ink">{row.name}</span>
                <span className="text-sm font-medium text-ink tabular">{formatRupiah(row.total)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
