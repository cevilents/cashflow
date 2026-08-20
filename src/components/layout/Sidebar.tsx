import { NavLink, useNavigate } from 'react-router-dom'
import {
  ArrowLeftRight,
  CalendarClock,
  FileChartColumn,
  LayoutDashboard,
  LogOut,
  Plus,
  Settings,
  Tags,
  Wallet,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useCurrentMember } from '../../hooks/useReadOnly'
import { memberInitials } from '../../lib/members'

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transaksi', icon: ArrowLeftRight },
  { to: '/accounts', label: 'Akun', icon: Wallet },
  { to: '/categories', label: 'Kategori', icon: Tags },
  { to: '/recurring', label: 'Berulang', icon: CalendarClock },
  { to: '/reports', label: 'Laporan', icon: FileChartColumn },
  { to: '/settings', label: 'Pengaturan', icon: Settings },
]

const mobileNav = nav.slice(0, 5)

export function Sidebar() {
  const { user, logout } = useAuth()
  const current = useCurrentMember()
  const navigate = useNavigate()
  const displayName = current?.name ?? user?.email ?? ''
  const initials = memberInitials(displayName || '?')

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border-subtle bg-surface-card md:flex">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-good">
          <ArrowLeftRight className="h-5 w-5 text-white" />
        </div>
        <span className="text-lg font-bold text-ink">Cashflow</span>
      </div>

      <nav aria-label="Navigasi" className="flex-1 space-y-1 px-3">
        {nav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive ? 'bg-good/15 text-good' : 'text-ink-muted hover:bg-surface-soft hover:text-ink'
              }`
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border-subtle px-3 py-4">
        <div className="flex items-center gap-2 rounded-xl px-2 py-2">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-ink ${
              current?.color ? '' : 'bg-surface-soft'
            }`}
            style={current?.color ? { backgroundColor: current.color } : undefined}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">{displayName}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="mt-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-soft hover:text-ink"
        >
          <LogOut className="h-5 w-5" />
          Keluar
        </button>
      </div>
    </aside>
  )
}

export function MobileNav() {
  return (
    <nav
      aria-label="Navigasi bawah"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border-subtle bg-surface-card px-2 pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div className="grid grid-cols-5">
        {mobileNav.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                isActive ? 'text-good' : 'text-ink-muted'
              }`
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

export function QuickAddButton() {
  return (
    <NavLink
      to="/transactions?new=1"
      className="fixed right-4 bottom-20 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-good text-white shadow-xl md:hidden"
      aria-label="Tambah transaksi"
    >
      <Plus className="h-6 w-6" />
    </NavLink>
  )
}