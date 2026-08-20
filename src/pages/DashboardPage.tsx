import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Wallet, TrendingUp, TrendingDown } from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell,
} from 'recharts'
import { useTransactions } from '../hooks/useTransactions'
import { useAccounts } from '../hooks/useAccounts'
import { useCategories } from '../hooks/useCategories'
import { computeAccountBalances, totalBalance } from '../lib/balances'
import { formatRupiah } from '../lib/format'
import { buildMonthlySeries, buildCategoryBreakdown, recentTransactions } from '../lib/dashboard'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import { EmptyState } from '../components/ui/EmptyState'
import { TransactionForm } from '../components/transaction/TransactionForm'

const AXIS_STROKE = '#8ea0c3'
const TOOLTIP_STYLE = { background: '#111a2e', border: '1px solid #233052', borderRadius: 12 }

export default function DashboardPage() {
  const { data: transactions, isLoading } = useTransactions()
  const { data: accounts } = useAccounts()
  const { data: categories } = useCategories()
  const [formOpen, setFormOpen] = useState(false)

  const txs = useMemo(() => transactions ?? [], [transactions])

  const balances = useMemo(
    () => computeAccountBalances(accounts ?? [], txs),
    [accounts, txs],
  )
  const total = useMemo(() => totalBalance(balances), [balances])

  const monthly = useMemo(() => buildMonthlySeries(txs), [txs])
  const categoryBreakdown = useMemo(
    () => buildCategoryBreakdown(txs, categories ?? []),
    [txs, categories],
  )
  const recent = useMemo(() => recentTransactions(txs), [txs])

  const accountsById = useMemo(() => Object.fromEntries((accounts ?? []).map((a) => [a.id, a])), [accounts])
  const categoriesById = useMemo(() => Object.fromEntries((categories ?? []).map((c) => [c.id, c])), [categories])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size={28} />
      </div>
    )
  }

  const last = monthly[monthly.length - 1]
  const monthIncome = last?.income ?? 0
  const monthExpense = last?.expense ?? 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">Dashboard</h1>
          <p className="text-sm text-ink-muted">Ringkasan keuanganmu</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="h-4 w-4" /> Tambah Transaksi
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border-subtle bg-surface-card p-5">
          <p className="flex items-center gap-2 text-sm text-ink-muted"><Wallet className="h-4 w-4" /> Total Saldo</p>
          <p className="mt-2 text-2xl font-bold text-ink tabular">{formatRupiah(total)}</p>
        </div>
        <div className="rounded-2xl border border-border-subtle bg-surface-card p-5">
          <p className="flex items-center gap-2 text-sm text-ink-muted"><TrendingUp className="h-4 w-4 text-good" /> Pemasukan bulan ini</p>
          <p className="mt-2 text-2xl font-bold text-good tabular">{formatRupiah(monthIncome)}</p>
        </div>
        <div className="rounded-2xl border border-border-subtle bg-surface-card p-5">
          <p className="flex items-center gap-2 text-sm text-ink-muted"><TrendingDown className="h-4 w-4 text-bad" /> Pengeluaran bulan ini</p>
          <p className="mt-2 text-2xl font-bold text-bad tabular">{formatRupiah(monthExpense)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-border-subtle bg-surface-card p-5">
          <h2 className="mb-4 text-sm font-semibold text-ink">Pemasukan vs Pengeluaran</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#233052" />
              <XAxis dataKey="label" stroke={AXIS_STROKE} fontSize={11} />
              <YAxis
                stroke={AXIS_STROKE}
                fontSize={11}
                tickFormatter={(v: number) => (v >= 1000000 ? `${Math.round(v / 1000000)}jt` : `${Math.round(v / 1000)}rb`)}
              />
              <Tooltip formatter={(value) => formatRupiah(Number(value) || 0)} contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="income" name="Pemasukan" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" name="Pengeluaran" fill="#f43f5e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-surface-card p-5">
          <h2 className="mb-4 text-sm font-semibold text-ink">Pengeluaran per Kategori (bulan ini)</h2>
          {categoryBreakdown.length === 0 ? (
            <EmptyState title="Belum ada data" message="Pengeluaran bulan ini akan tampil di sini." />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={categoryBreakdown} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                  {categoryBreakdown.map((entry) => (
                    <Cell key={entry.id} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatRupiah(Number(value) || 0)} contentStyle={TOOLTIP_STYLE} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border-subtle bg-surface-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Transaksi Terbaru</h2>
          <Link to="/transactions" className="text-sm text-good hover:underline">Lihat semua</Link>
        </div>
        {recent.length === 0 ? (
          <EmptyState title="Belum ada transaksi" message="Mulai catat pemasukan atau pengeluaran pertamamu." />
        ) : (
          <div className="space-y-2">
            {recent.map((t) => {
              const meta =
                t.type === 'income'
                  ? { sign: '+', cls: 'text-good', label: categoriesById[t.category_id ?? '']?.name ?? 'Pemasukan' }
                  : t.type === 'expense'
                    ? { sign: '-', cls: 'text-bad', label: categoriesById[t.category_id ?? '']?.name ?? 'Pengeluaran' }
                    : { sign: '\u21c4', cls: 'text-move', label: 'Transfer' }
              return (
                <div key={t.id} className="flex items-center justify-between rounded-xl bg-surface-soft/50 px-4 py-2.5">
                  <div>
                    <p className="text-sm font-medium text-ink">{meta.label}</p>
                    <p className="text-xs text-ink-muted">
                      {accountsById[t.account_id]?.name ?? '?'} {'\u00b7'} {t.date.slice(8, 10)}/{t.date.slice(5, 7)}
                    </p>
                  </div>
                  <div className={`tabular text-sm font-semibold ${meta.cls}`}>{meta.sign} {formatRupiah(t.amount)}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <TransactionForm open={formOpen} onClose={() => setFormOpen(false)} />
    </div>
  )
}
