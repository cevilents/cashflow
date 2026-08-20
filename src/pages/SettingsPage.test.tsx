import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '../components/ui/Toast'
import SettingsPage from './SettingsPage'
import { createQueryClient, makeQueryChain } from '../test/queryTestUtils'
import type { Account, Category, Profile, RecurringTransaction, Transaction } from '../types/database'

const mocks = vi.hoisted(() => ({
  user: { id: 'user-1', email: 'budi@mail.com' },
  logout: vi.fn(),
  from: vi.fn(),
  downloadFile: vi.fn(),
  chains: {} as Record<string, ReturnType<typeof makeQueryChain>>,
}))

vi.mock('../lib/supabase', () => ({
  supabase: { from: mocks.from },
}))

vi.mock('../lib/csv', () => ({
  downloadFile: mocks.downloadFile,
}))

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: mocks.user, logout: mocks.logout }),
}))

const profile: Profile = {
  id: 'user-1',
  full_name: 'Budi',
  currency: 'IDR',
  created_at: '2026-01-01T00:00:00Z',
}

const account: Account = {
  id: 'acc-1', user_id: 'user-1', name: 'Dompet', type: 'cash', opening_balance: 0,
  color: '#10b981', is_archived: false, created_at: '2026-01-01T00:00:00Z',
}
const category: Category = {
  id: 'cat-1', user_id: 'user-1', name: 'Makanan', type: 'expense', icon: 'tag',
  color: '#f43f5e', created_at: '2026-01-01T00:00:00Z',
}
const transaction: Transaction = {
  id: 'tx-1', user_id: 'user-1', account_id: 'acc-1', type: 'expense', category_id: 'cat-1',
  amount: 1000, to_account_id: null, note: '', date: '2026-08-01', receipt_url: null,
  created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z',
}
const recurring: RecurringTransaction = {
  id: 'rec-1', user_id: 'user-1', name: 'Sewa', account_id: 'acc-1', category_id: 'cat-1',
  type: 'expense', amount: 100000, frequency: 'monthly', next_due_date: '2026-09-01',
  is_active: true, created_at: '2026-01-01T00:00:00Z',
}

function installMock() {
  mocks.from.mockImplementation((table: string) => {
    if (!mocks.chains[table]) {
      const chain = makeQueryChain()
      mocks.chains[table] = chain
      chain.upsert.mockResolvedValue({ error: null })
      if (table === 'profiles') {
        chain.maybeSingle.mockResolvedValue({ data: profile, error: null })
      } else {
        const data =
          table === 'accounts' ? [account]
          : table === 'categories' ? [category]
          : table === 'transactions' ? [transaction]
          : [recurring]
        if (table === 'transactions') {
          chain.order.mockImplementation((col: unknown) =>
            col === 'date' ? chain : Promise.resolve({ data, error: null }),
          )
        } else {
          chain.order.mockResolvedValue({ data, error: null })
        }
        chain.eq.mockResolvedValue({ error: null })
      }
    }
    return mocks.chains[table]
  })
}

function renderPage() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={['/settings']}>
        <ToastProvider>
          <SettingsPage />
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function awaitData() {
  await screen.findByDisplayValue('Budi')
}

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.chains = {}
    installMock()
  })

  afterEach(cleanup)

  it('shows the profile form with the name prefilled and the email read-only', async () => {
    renderPage()
    await awaitData()
    expect(screen.getByLabelText('Nama')).toHaveValue('Budi')
    expect(screen.getByLabelText('Email')).toHaveValue('budi@mail.com')
    expect(screen.getByLabelText('Email')).toBeDisabled()
  })

  it('saves the profile name and shows a success toast', async () => {
    renderPage()
    await awaitData()
    fireEvent.change(screen.getByLabelText('Nama'), { target: { value: 'Budi Santoso' } })
    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: 'Simpan' }).closest('form') as HTMLFormElement)
    })
    const profiles = mocks.chains['profiles']
    expect(profiles?.update).toHaveBeenCalledWith({ full_name: 'Budi Santoso', currency: 'IDR' })
    expect(await screen.findByText('Nama diperbarui')).toBeInTheDocument()
  })

  it('rejects saving an empty profile name', async () => {
    renderPage()
    await awaitData()
    fireEvent.change(screen.getByLabelText('Nama'), { target: { value: '   ' } })
    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: 'Simpan' }).closest('form') as HTMLFormElement)
    })
    expect(await screen.findByText('Nama tidak boleh kosong')).toBeInTheDocument()
    expect(mocks.chains['profiles']?.update).not.toHaveBeenCalled()
  })

  it('exports a backup JSON carrying version, user id, and all data', async () => {
    renderPage()
    await awaitData()
    fireEvent.click(screen.getByRole('button', { name: /Export Backup/ }))
    expect(mocks.downloadFile).toHaveBeenCalledTimes(1)
    const [filename, content, type] = mocks.downloadFile.mock.calls[0] as [string, string, string]
    expect(filename).toMatch(/^cashflow-backup-\d{4}-\d{2}-\d{2}\.json$/)
    expect(type).toBe('application/json;charset=utf-8')
    const parsed = JSON.parse(content)
    expect(parsed.format_version).toBe(1)
    expect(parsed.user_id).toBe('user-1')
    expect(parsed.accounts).toEqual([account])
    expect(parsed.categories).toEqual([category])
    expect(parsed.transactions).toEqual([transaction])
    expect(parsed.recurring).toEqual([recurring])
  })

  it('imports a valid same-account backup and shows a success toast', async () => {
    renderPage()
    await awaitData()
    const json = JSON.stringify({
      format_version: 1,
      user_id: 'user-1',
      exported_at: '2026-08-20T00:00:00Z',
      accounts: [account],
      categories: [category],
      transactions: [transaction],
      recurring: [recurring],
    })
    const file = new File([json], 'backup.json', { type: 'application/json' })
    await act(async () => {
      fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
        target: { files: [file] },
      })
    })
    expect(await screen.findByText('Data berhasil diimpor')).toBeInTheDocument()
    expect(mocks.chains['accounts']?.upsert).toHaveBeenCalled()
  })

  it('rejects an invalid JSON backup', async () => {
    renderPage()
    await awaitData()
    const file = new File(['{ not json'], 'backup.json', { type: 'application/json' })
    await act(async () => {
      fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
        target: { files: [file] },
      })
    })
    expect(await screen.findByText('File JSON tidak valid')).toBeInTheDocument()
    expect(mocks.chains['accounts']?.upsert).not.toHaveBeenCalled()
  })

  it('rejects an unsupported backup version', async () => {
    renderPage()
    await awaitData()
    const file = new File([JSON.stringify({ format_version: 99, user_id: 'user-1' })], 'b.json')
    await act(async () => {
      fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
        target: { files: [file] },
      })
    })
    expect(await screen.findByText('Versi backup tidak didukung')).toBeInTheDocument()
    expect(mocks.chains['accounts']?.upsert).not.toHaveBeenCalled()
  })

  it('rejects a backup that belongs to another account', async () => {
    renderPage()
    await awaitData()
    const json = JSON.stringify({
      format_version: 1,
      user_id: 'user-2',
      accounts: [],
      categories: [],
      transactions: [],
      recurring: [],
    })
    const file = new File([json], 'backup.json', { type: 'application/json' })
    await act(async () => {
      fireEvent.change(document.querySelector('input[type="file"]') as HTMLInputElement, {
        target: { files: [file] },
      })
    })
    expect(
      await screen.findByText('Backup ini milik akun lain — hanya bisa dipulihkan ke akun yang sama'),
    ).toBeInTheDocument()
    expect(mocks.chains['accounts']?.upsert).not.toHaveBeenCalled()
  })

  it('logs out through the auth context when Keluar is clicked', async () => {
    renderPage()
    await awaitData()
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Keluar/ }))
    })
    await waitFor(() => expect(mocks.logout).toHaveBeenCalledTimes(1))
  })
})
