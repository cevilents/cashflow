import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AppLayout from './AppLayout'

const mocks = vi.hoisted(() => ({
  user: { id: 'user-1', email: 'user@example.com' },
  logout: vi.fn(),
  currentMember: {
    id: 'user-1',
    name: 'Bima',
    email: 'bima@cashflow.local',
    color: '#10b981',
    icon: 'bima',
  } as {
    id: string
    name: string
    email: string
    color: string
    icon: string
  } | null,
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    user: mocks.user,
    loading: false,
    logout: mocks.logout,
  }),
}))

vi.mock('../../hooks/useReadOnly', () => ({
  useCurrentMember: () => mocks.currentMember,
}))

const navLabels = ['Dashboard', 'Transaksi', 'Akun', 'Kategori', 'Berulang']

function renderLayout(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<p>dashboard-content</p>} />
          <Route path="/transactions" element={<p>transactions-content</p>} />
          <Route path="/accounts" element={<p>accounts-content</p>} />
          <Route path="/categories" element={<p>categories-content</p>} />
          <Route path="/recurring" element={<p>recurring-content</p>} />
          <Route path="/reports" element={<p>reports-content</p>} />
          <Route path="/settings" element={<p>settings-content</p>} />
        </Route>
        <Route path="/login" element={<p>login-page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AppLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.logout.mockResolvedValue(undefined)
    mocks.currentMember = {
      id: 'user-1',
      name: 'Bima',
      email: 'bima@cashflow.local',
      color: '#10b981',
      icon: 'bima',
    }
  })

  afterEach(cleanup)

  it('renders the outlet content wrapped in the layout frame', () => {
    renderLayout('/transactions')
    expect(screen.getByText('transactions-content')).toBeInTheDocument()
  })

  it('lists every navigation item with its destination', () => {
    renderLayout('/')
    const links = screen.getAllByRole('link')
    const byLabel = Object.fromEntries(links.map((l) => [l.textContent, l]))
    expect(byLabel['Dashboard']).toHaveAttribute('href', '/')
    expect(byLabel['Transaksi']).toHaveAttribute('href', '/transactions')
    expect(byLabel['Akun']).toHaveAttribute('href', '/accounts')
    expect(byLabel['Kategori']).toHaveAttribute('href', '/categories')
    expect(byLabel['Berulang']).toHaveAttribute('href', '/recurring')
    expect(byLabel['Laporan']).toHaveAttribute('href', '/reports')
    expect(byLabel['Pengaturan']).toHaveAttribute('href', '/settings')
  })

  it('marks the current route as active in the sidebar', () => {
    renderLayout('/transactions')
    const links = screen.getAllByRole('link')
    const active = links.find((l) => l.textContent === 'Transaksi') as HTMLElement
    const inactive = links.find((l) => l.textContent === 'Berulang') as HTMLElement
    expect(active.className).toContain('bg-good/15')
    expect(active.className).toContain('text-good')
    expect(inactive.className).toContain('text-ink-muted')
    expect(inactive.className).not.toContain('bg-good/15')
  })

  it('keeps the dashboard link active only on the root route', () => {
    renderLayout('/transactions')
    const links = screen.getAllByRole('link')
    const dashboard = links.find((l) => l.textContent === 'Dashboard') as HTMLElement
    expect(dashboard.className).toContain('text-ink-muted')
  })

  it('shows the sidebar only from the md breakpoint', () => {
    renderLayout('/')
    const aside = document.querySelector('aside') as HTMLElement
    expect(aside.className).toContain('hidden')
    expect(aside.className).toContain('md:flex')
  })

  it('shows the mobile bottom nav only below the md breakpoint', () => {
    renderLayout('/')
    const nav = screen.getByLabelText('Navigasi bawah')
    expect(nav.className).toContain('md:hidden')
    expect(nav.className).toContain('fixed')
  })

  it('limits the mobile bottom nav to five items', () => {
    renderLayout('/')
    const nav = screen.getByLabelText('Navigasi bawah')
    const links = Array.from(nav.querySelectorAll('a')).map((a) => a.textContent)
    expect(links).toEqual(navLabels)
    expect(links).not.toContain('Laporan')
    expect(links).not.toContain('Pengaturan')
  })

  it('renders a quick add button linking to a new transaction', () => {
    renderLayout('/')
    const button = screen.getByRole('link', { name: 'Tambah transaksi' })
    expect(button).toHaveAttribute('href', '/transactions?new=1')
    expect(button.className).toContain('md:hidden')
  })

  it('shows the current member name and uses its color for the avatar', () => {
    renderLayout('/')
    expect(screen.getByText('Bima')).toBeInTheDocument()
    const avatar = document.querySelector('aside .rounded-full') as HTMLElement
    expect(avatar.style.backgroundColor).toBe('rgb(16, 185, 129)')
  })

  it('falls back to the email when there is no current member', () => {
    mocks.currentMember = null
    renderLayout('/')
    expect(screen.getByText('user@example.com')).toBeInTheDocument()
  })

  it('calls logout and navigates to the login page', async () => {
    renderLayout('/')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Keluar' }))
    })
    expect(mocks.logout).toHaveBeenCalledTimes(1)
    expect(screen.getByText('login-page')).toBeInTheDocument()
  })
})
