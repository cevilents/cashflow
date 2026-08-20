import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '../components/ui/Toast'
import CategoriesPage from './CategoriesPage'
import { createQueryClient, makeQueryChain } from '../test/queryTestUtils'
import type { Category, Transaction } from '../types/database'
import type { Member } from '../lib/members'

const mocks = vi.hoisted(() => ({
  user: { id: 'user-1' },
  from: vi.fn(),
  categories: [] as Category[],
  transactions: [] as Transaction[],
  members: [] as Member[],
  chains: {} as Record<string, ReturnType<typeof makeQueryChain>>,
}))

vi.mock('../lib/supabase', () => ({
  supabase: { from: mocks.from },
}))

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ user: mocks.user }),
}))

vi.mock('../hooks/useMembers', () => ({
  useMembers: () => ({ data: mocks.members }),
}))

const categories: Category[] = [
  { id: 'cat-1', user_id: 'user-1', name: 'Makanan', type: 'expense', icon: 'food', color: '#f59e0b', created_at: '2026-01-01T00:00:00Z' },
  { id: 'cat-2', user_id: 'user-1', name: 'Gaji', type: 'income', icon: 'salary', color: '#10b981', created_at: '2026-01-01T00:00:00Z' },
]

function makeTransactions(): Transaction[] {
  return [
    { id: 'tx-1', user_id: 'user-1', account_id: 'acc-1', type: 'expense', category_id: 'cat-1', amount: 25000, to_account_id: null, note: '', date: '2026-08-10', receipt_url: null, created_at: '2026-08-10T00:00:00Z', updated_at: '2026-08-10T00:00:00Z' },
    { id: 'tx-2', user_id: 'user-1', account_id: 'acc-2', type: 'income', category_id: 'cat-2', amount: 100000, to_account_id: null, note: '', date: '2026-08-11', receipt_url: null, created_at: '2026-08-11T00:00:00Z', updated_at: '2026-08-11T00:00:00Z' },
  ]
}

function installMock() {
  mocks.from.mockImplementation((table: string) => {
    if (!mocks.chains[table]) {
      const chain = makeQueryChain()
      mocks.chains[table] = chain
      if (table === 'categories') {
        chain.order.mockResolvedValue({ data: mocks.categories, error: null })
        chain.update.mockReturnValue(chain)
        chain.delete.mockReturnValue(chain)
        chain.eq.mockResolvedValue({ data: null, error: null })
        chain.insert.mockResolvedValue({ error: null })
      } else {
        chain.order.mockImplementation((col: unknown) =>
          col === 'created_at'
            ? Promise.resolve({ data: mocks.transactions, error: null })
            : chain,
        )
        chain.eq.mockResolvedValue({ data: null, error: null })
      }
    }
    return mocks.chains[table]
  })
}

function renderPage() {
  const client = createQueryClient()
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <ToastProvider>
          <CategoriesPage />
        </ToastProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return { client, ...view }
}

describe('CategoriesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.categories = categories
    mocks.transactions = []
    mocks.members = [
      { id: 'user-1', name: 'Bima', email: 'bima@cashflow.local', color: '#10b981', icon: 'bima' },
    ]
    mocks.chains = {}
    installMock()
  })

  afterEach(cleanup)

  it('shows a loading spinner while categories are pending', () => {
    mocks.from.mockImplementation(() => {
      const chain = makeQueryChain()
      chain.order.mockReturnValue(new Promise(() => {}))
      return chain
    })
    renderPage()
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('groups categories by type and shows usage counts', async () => {
    mocks.transactions = makeTransactions()
    renderPage()

    expect(await screen.findByText('Makanan')).toBeInTheDocument()
    expect(screen.getByText('Gaji')).toBeInTheDocument()
    expect(screen.getByText('Pengeluaran')).toBeInTheDocument()
    expect(screen.getByText('Pemasukan')).toBeInTheDocument()
    expect(screen.getAllByText('1 transaksi')).toHaveLength(2)
  })

  it('shows empty states when there are no categories', async () => {
    mocks.categories = []
    renderPage()
    expect(await screen.findByText('Belum ada kategori pengeluaran')).toBeInTheDocument()
    expect(screen.getByText('Belum ada kategori pemasukan')).toBeInTheDocument()
    expect(screen.getByText('Tambah Kategori')).toBeInTheDocument()
  })

  it('opens the create form and creates a category', async () => {
    renderPage()
    await screen.findByText('Makanan')
    fireEvent.click(screen.getAllByRole('button', { name: 'Tambah Kategori' })[0] as HTMLButtonElement)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Tambah Kategori')).toBeInTheDocument()
    fireEvent.change(within(dialog).getByLabelText('Nama kategori'), { target: { value: 'Transport' } })

    await act(async () => {
      fireEvent.submit(dialog.querySelector('form') as HTMLFormElement)
    })

    const cat = mocks.chains['categories']
    expect(cat?.insert).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Transport', type: 'expense', icon: 'tag', user_id: 'user-1' }),
    )
    expect(await screen.findByText('Kategori ditambahkan')).toBeInTheDocument()
  })

  it('rejects an empty name with an error toast', async () => {
    renderPage()
    await screen.findByText('Makanan')
    fireEvent.click(screen.getAllByRole('button', { name: 'Tambah Kategori' })[0] as HTMLButtonElement)
    const dialog = await screen.findByRole('dialog')

    await act(async () => {
      fireEvent.submit(dialog.querySelector('form') as HTMLFormElement)
    })

    expect(await screen.findByText('Nama kategori wajib diisi')).toBeInTheDocument()
    expect(mocks.chains['categories']?.insert).not.toHaveBeenCalled()
  })

  it('opens a pre-filled form when editing a category', async () => {
    renderPage()
    await screen.findByText('Makanan')
    fireEvent.click(screen.getAllByRole('button', { name: 'Ubah' })[0] as HTMLButtonElement)
    const dialog = await screen.findByRole('dialog')
    expect(screen.getByText('Edit Kategori')).toBeInTheDocument()
    expect((within(dialog).getByLabelText('Nama kategori') as HTMLInputElement).value).toBe('Makanan')
  })

  it('updates a category through the form', async () => {
    renderPage()
    await screen.findByText('Makanan')
    fireEvent.click(screen.getAllByRole('button', { name: 'Ubah' })[0] as HTMLButtonElement)
    const dialog = await screen.findByRole('dialog')
    const cat = mocks.chains['categories']
    fireEvent.change(within(dialog).getByLabelText('Nama kategori'), { target: { value: 'Makan Siang' } })

    await act(async () => {
      fireEvent.submit(dialog.querySelector('form') as HTMLFormElement)
    })

    expect(await screen.findByText('Kategori diperbarui')).toBeInTheDocument()
    expect(cat?.update).toHaveBeenCalledWith(expect.objectContaining({ name: 'Makan Siang' }))
    expect(cat?.eq).toHaveBeenCalledWith('id', 'cat-1')
  })

  it('allows deleting a category that is in use (transactions keep their data)', async () => {
    mocks.transactions = makeTransactions()
    renderPage()
    await screen.findByText('Makanan')
    const cat = mocks.chains['categories']
    cat?.delete.mockReturnValue(cat)
    cat?.eq.mockResolvedValue({ data: null, error: null })

    fireEvent.click(screen.getAllByRole('button', { name: 'Hapus' })[0] as HTMLButtonElement)
    expect(await screen.findByText('Hapus kategori?')).toBeInTheDocument()

    const dialog = screen.getByRole('dialog')
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Hapus' }))
    })

    expect(await screen.findByText('Kategori dihapus')).toBeInTheDocument()
    expect(cat?.delete).toHaveBeenCalled()
    expect(cat?.eq).toHaveBeenCalledWith('id', 'cat-1')
  })

  it('disables the confirm button and ignores extra clicks while a delete is pending', async () => {
    renderPage()
    await screen.findByText('Makanan')
    const cat = mocks.chains['categories']
    cat?.delete.mockReturnValue(cat)
    cat?.eq.mockReturnValue(new Promise(() => {}))

    fireEvent.click(screen.getAllByRole('button', { name: 'Hapus' })[0] as HTMLButtonElement)
    expect(await screen.findByText('Hapus kategori?')).toBeInTheDocument()

    const dialog = screen.getByRole('dialog')
    const confirmBtn = within(dialog).getByRole('button', { name: 'Hapus' })
    expect(confirmBtn).not.toBeDisabled()

    await act(async () => {
      fireEvent.click(confirmBtn)
    })

    const loadingBtn = await within(dialog).findByRole('button', { name: 'Menghapus…' })
    expect(loadingBtn).toBeDisabled()

    await act(async () => {
      fireEvent.click(loadingBtn)
    })

    expect(cat?.delete).toHaveBeenCalledTimes(1)
  })

  it('narrows the categories to the selected owner via the filter', async () => {
    mocks.members = [
      { id: 'user-1', name: 'Bima', email: 'bima@cashflow.local', color: '#10b981', icon: 'bima' },
      { id: 'user-2', name: 'Aska', email: 'aska@cashflow.local', color: '#6366f1', icon: 'aska' },
    ]
    mocks.categories = [
      { id: 'cat-own', user_id: 'user-1', name: 'Makanan', type: 'expense', icon: 'food', color: '#f59e0b', created_at: '2026-01-01T00:00:00Z' },
      { id: 'cat-frn', user_id: 'user-2', name: 'Kos Aska', type: 'expense', icon: 'home', color: '#6366f1', created_at: '2026-01-01T00:00:00Z' },
    ]
    renderPage()
    expect(await screen.findByText('Makanan')).toBeInTheDocument()
    expect(screen.getByText('Kos Aska')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Aska' }))

    expect(screen.queryByText('Makanan')).not.toBeInTheDocument()
    expect(screen.getByText('Kos Aska')).toBeInTheDocument()
  })

  it('hides edit and delete buttons for foreign categories', async () => {
    mocks.members = [
      { id: 'user-1', name: 'Bima', email: 'bima@cashflow.local', color: '#10b981', icon: 'bima' },
      { id: 'user-2', name: 'Aska', email: 'aska@cashflow.local', color: '#6366f1', icon: 'aska' },
    ]
    mocks.categories = [
      { id: 'cat-own', user_id: 'user-1', name: 'Makanan', type: 'expense', icon: 'food', color: '#f59e0b', created_at: '2026-01-01T00:00:00Z' },
      { id: 'cat-frn', user_id: 'user-2', name: 'Kos Aska', type: 'expense', icon: 'home', color: '#6366f1', created_at: '2026-01-01T00:00:00Z' },
    ]
    renderPage()
    await screen.findByText('Makanan')

    const ownCard = screen.getByText('Makanan').closest('.rounded-xl') as HTMLElement
    expect(within(ownCard).getByRole('button', { name: 'Ubah' })).toBeInTheDocument()
    expect(within(ownCard).getByRole('button', { name: 'Hapus' })).toBeInTheDocument()

    const foreignCard = screen.getByText('Kos Aska').closest('.rounded-xl') as HTMLElement
    expect(within(foreignCard).queryByRole('button', { name: 'Ubah' })).not.toBeInTheDocument()
    expect(within(foreignCard).queryByRole('button', { name: 'Hapus' })).not.toBeInTheDocument()
  })

  it('shows an owner chip with the member name on each category card', async () => {
    mocks.members = [
      { id: 'user-1', name: 'Bima', email: 'bima@cashflow.local', color: '#10b981', icon: 'bima' },
      { id: 'user-2', name: 'Aska', email: 'aska@cashflow.local', color: '#6366f1', icon: 'aska' },
    ]
    mocks.categories = [
      { id: 'cat-own', user_id: 'user-1', name: 'Makanan', type: 'expense', icon: 'food', color: '#f59e0b', created_at: '2026-01-01T00:00:00Z' },
      { id: 'cat-frn', user_id: 'user-2', name: 'Kos Aska', type: 'expense', icon: 'home', color: '#6366f1', created_at: '2026-01-01T00:00:00Z' },
    ]
    renderPage()
    await screen.findByText('Makanan')

    const ownCard = screen.getByText('Makanan').closest('.rounded-xl') as HTMLElement
    expect(within(ownCard).getByText('Bima')).toBeInTheDocument()

    const foreignCard = screen.getByText('Kos Aska').closest('.rounded-xl') as HTMLElement
    expect(within(foreignCard).getByText('Aska')).toBeInTheDocument()
  })

  it('hides the Tambah Kategori button when filtering a foreign member', async () => {
    mocks.members = [
      { id: 'user-1', name: 'Bima', email: 'bima@cashflow.local', color: '#10b981', icon: 'bima' },
      { id: 'user-2', name: 'Aska', email: 'aska@cashflow.local', color: '#6366f1', icon: 'aska' },
    ]
    renderPage()
    await screen.findByText('Makanan')
    expect(screen.getByText('Tambah Kategori')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Aska' }))
    expect(screen.queryByText('Tambah Kategori')).not.toBeInTheDocument()
  })
})
