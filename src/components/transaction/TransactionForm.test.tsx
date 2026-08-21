import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '../ui/Toast'
import { TransactionForm } from './TransactionForm'
import { createQueryClient } from '../../test/queryTestUtils'
import { todayISO } from '../../lib/dates'
import type { Account, Category, Transaction } from '../../types/database'

const mocks = vi.hoisted(() => ({
  user: { id: 'user-1' },
  accounts: [] as Account[],
  categories: [] as Category[],
  create: vi.fn(),
  update: vi.fn(),
  from: vi.fn(),
  uploadReceipt: vi.fn(),
  removeReceipt: vi.fn(),
  receiptUrl: vi.fn(),
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: mocks.user }),
}))

vi.mock('../../hooks/useAccounts', () => ({
  useAccounts: () => ({ data: mocks.accounts }),
}))

vi.mock('../../hooks/useCategories', () => ({
  useCategories: () => ({ data: mocks.categories }),
}))

vi.mock('../../hooks/useTransactions', () => ({
  useCreateTransaction: () => ({ mutateAsync: mocks.create }),
  useUpdateTransaction: () => ({ mutateAsync: mocks.update }),
}))

vi.mock('../receipt/receiptStorage', () => ({
  uploadReceipt: mocks.uploadReceipt,
  removeReceipt: mocks.removeReceipt,
  receiptUrl: mocks.receiptUrl,
}))

vi.mock('../../lib/supabase', () => ({
  supabase: { from: mocks.from },
}))

const accounts: Account[] = [
  { id: 'acc-1', user_id: 'user-1', name: 'Tunai', type: 'cash', opening_balance: 0, color: '#10b981', is_archived: false, created_at: '2026-01-01T00:00:00Z' },
  { id: 'acc-2', user_id: 'user-1', name: 'BCA', type: 'bank', opening_balance: 0, color: '#3b82f6', is_archived: false, created_at: '2026-01-01T00:00:00Z' },
  { id: 'acc-fund', user_id: 'user-1', name: 'IB HFM', type: 'funding', opening_balance: 0, color: '#aaa', is_archived: false, created_at: '2026-01-01T00:00:00Z' },
]

const categories: Category[] = [
  { id: 'cat-in-1', user_id: 'user-1', name: 'Gaji', type: 'income', icon: 'bag', color: '#10b981', created_at: '2026-01-01T00:00:00Z' },
  { id: 'cat-ex-1', user_id: 'user-1', name: 'Makanan', type: 'expense', icon: 'rice', color: '#ef4444', created_at: '2026-01-01T00:00:00Z' },
]

function makeCreateChain() {
  const chain = {
    insert: vi.fn(() => chain),
    select: vi.fn(() => chain),
    single: vi.fn(),
    update: vi.fn(() => chain),
    eq: vi.fn(),
  }
  chain.single.mockResolvedValue({ data: { id: 'tx-new' }, error: null })
  chain.eq.mockResolvedValue({ error: null })
  return chain
}

function renderForm(editing?: Transaction | null) {
  const onClose = vi.fn()
  const client = createQueryClient()
  const view = render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <TransactionForm open onClose={onClose} editing={editing} />
      </ToastProvider>
    </QueryClientProvider>,
  )
  return { onClose, client, ...view }
}

function form() {
  return document.querySelector('#tx-form') as HTMLFormElement
}

const editingTx: Transaction = {
  id: 'tx-1',
  user_id: 'user-1',
  account_id: 'acc-1',
  type: 'expense',
  category_id: 'cat-ex-1',
  amount: 25000,
  to_account_id: null,
  note: 'Kopi',
  date: '2026-08-01',
  receipt_url: 'user-1/tx-1/old.jpg',
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
}

describe('TransactionForm', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.accounts = accounts
    mocks.categories = categories
    mocks.receiptUrl.mockResolvedValue('https://cdn/old.jpg')
  })

  afterEach(cleanup)

  it('shows Indonesian validation errors when required fields are empty', () => {
    mocks.accounts = []
    mocks.categories = []
    const { onClose } = renderForm()

    fireEvent.submit(form())

    expect(screen.getByText('Masukkan jumlah yang valid')).toBeInTheDocument()
    expect(screen.getByText('Pilih akun')).toBeInTheDocument()
    expect(screen.getByText('Pilih kategori')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('requires a date when the field is cleared', () => {
    renderForm()
    fireEvent.change(screen.getByLabelText('Jumlah (Rp)'), { target: { value: '10000' } })
    fireEvent.change(screen.getByLabelText('Kategori'), { target: { value: 'cat-ex-1' } })
    fireEvent.change(screen.getByLabelText('Tanggal'), { target: { value: '' } })

    fireEvent.submit(form())

    expect(screen.getByText('Pilih tanggal')).toBeInTheDocument()
  })

  it('shows a live rupiah preview that handles thousand separators and decimals', () => {
    renderForm()
    const amount = screen.getByLabelText('Jumlah (Rp)')

    fireEvent.change(amount, { target: { value: '1.500.000' } })
    expect(screen.getByText('= Rp 1.500.000')).toBeInTheDocument()

    fireEvent.change(amount, { target: { value: '1500,50' } })
    expect(screen.getByText('= Rp 150.050')).toBeInTheDocument()
  })

  it('hides category and receipt fields for transfers and requires a destination account', () => {
    const { onClose } = renderForm()
    fireEvent.click(screen.getByRole('button', { name: 'Transfer' }))

    expect(screen.queryByLabelText('Kategori')).not.toBeInTheDocument()
    expect(screen.queryByText('Bukti transaksi (opsional)')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Transfer ke')).toBeInTheDocument()

    fireEvent.submit(form())
    expect(screen.getByText('Pilih akun tujuan')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('submits a transfer with null category and receipt', async () => {
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: 'Transfer' }))
    fireEvent.change(screen.getByLabelText('Jumlah (Rp)'), { target: { value: '500000' } })
    fireEvent.change(screen.getByLabelText('Transfer ke'), { target: { value: 'acc-2' } })
    const chain = makeCreateChain()
    mocks.from.mockReturnValue(chain)

    await act(async () => {
      fireEvent.submit(form())
    })

    expect(mocks.from).toHaveBeenCalledWith('transactions')
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        account_id: 'acc-1',
        type: 'transfer',
        to_account_id: 'acc-2',
        category_id: null,
        receipt_url: null,
        amount: 500000,
        user_id: 'user-1',
      }),
    )
    expect(await screen.findByText('Transaksi ditambahkan')).toBeInTheDocument()
  })

  it('creates an expense and closes the modal on success', async () => {
    const { onClose } = renderForm()
    fireEvent.change(screen.getByLabelText('Jumlah (Rp)'), { target: { value: '1.500.000' } })
    fireEvent.change(screen.getByLabelText('Akun'), { target: { value: 'acc-2' } })
    fireEvent.change(screen.getByLabelText('Kategori'), { target: { value: 'cat-ex-1' } })
    const chain = makeCreateChain()
    mocks.from.mockReturnValue(chain)

    await act(async () => {
      fireEvent.submit(form())
    })

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        account_id: 'acc-2',
        type: 'expense',
        category_id: 'cat-ex-1',
        amount: 1500000,
        to_account_id: null,
        date: todayISO(),
        user_id: 'user-1',
      }),
    )
    expect(await screen.findByText('Transaksi ditambahkan')).toBeInTheDocument()
    expect(onClose).toHaveBeenCalled()
  })

  it('uploads a receipt after creating a transaction and persists the final path', async () => {
    mocks.uploadReceipt.mockResolvedValue('user-1/tx-new/1699999-struk.jpg')
    renderForm()
    fireEvent.change(screen.getByLabelText('Jumlah (Rp)'), { target: { value: '50000' } })
    fireEvent.change(screen.getByLabelText('Kategori'), { target: { value: 'cat-ex-1' } })
    const chain = makeCreateChain()
    mocks.from.mockReturnValue(chain)
    const file = new File(['x'], 'struk.jpg', { type: 'image/jpeg' })
    fireEvent.change(document.querySelector('#tx-form input[type="file"]') as HTMLInputElement, {
      target: { files: [file] },
    })

    await act(async () => {
      fireEvent.submit(form())
    })

    expect(mocks.uploadReceipt).toHaveBeenCalledWith(file, 'user-1', 'tx-new')
    expect(chain.update).toHaveBeenCalledWith({ receipt_url: 'user-1/tx-new/1699999-struk.jpg' })
    expect(chain.eq).toHaveBeenCalledWith('id', 'tx-new')
    expect(await screen.findByText('Transaksi ditambahkan')).toBeInTheDocument()
  })

  it('prefills the form when editing and updates the transaction', async () => {
    mocks.receiptUrl.mockResolvedValue('https://cdn/old.jpg')
    const { onClose } = renderForm(editingTx)

    expect(screen.getByText('Edit Transaksi')).toBeInTheDocument()
    expect((screen.getByLabelText('Jumlah (Rp)') as HTMLInputElement).value).toBe('25000')
    expect((screen.getByLabelText('Akun') as HTMLSelectElement).value).toBe('acc-1')
    expect((screen.getByLabelText('Kategori') as HTMLSelectElement).value).toBe('cat-ex-1')
    expect((screen.getByLabelText('Tanggal') as HTMLInputElement).value).toBe('2026-08-01')
    expect((screen.getByLabelText('Catatan (opsional)') as HTMLTextAreaElement).value).toBe('Kopi')
    expect(await screen.findByAltText('Pratinjau bukti')).toHaveAttribute('src', 'https://cdn/old.jpg')

    fireEvent.change(screen.getByLabelText('Jumlah (Rp)'), { target: { value: '30000' } })
    await act(async () => {
      fireEvent.submit(form())
    })

    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'tx-1',
        amount: 30000,
        type: 'expense',
        category_id: 'cat-ex-1',
        receipt_url: 'user-1/tx-1/old.jpg',
      }),
    )
    expect(await screen.findByText('Transaksi diperbarui')).toBeInTheDocument()
    expect(onClose).toHaveBeenCalled()
  })

  it('removes the old receipt and uploads the replacement when editing', async () => {
    mocks.receiptUrl.mockResolvedValue('https://cdn/old.jpg')
    mocks.uploadReceipt.mockResolvedValue('user-1/tx-1/new.jpg')
    renderForm(editingTx)
    await screen.findByAltText('Pratinjau bukti')

    fireEvent.click(screen.getByLabelText('Hapus bukti'))
    const input = (await waitFor(() => document.querySelector('#tx-form input[type="file"]'))) as HTMLInputElement
    const file = new File(['x'], 'new.jpg', { type: 'image/jpeg' })
    fireEvent.change(input, {
      target: { files: [file] },
    })
    const chain = makeCreateChain()
    mocks.from.mockReturnValue(chain)

    await act(async () => {
      fireEvent.submit(form())
    })

    expect(mocks.removeReceipt).toHaveBeenCalledWith('user-1/tx-1/old.jpg')
    expect(mocks.uploadReceipt).toHaveBeenCalledWith(file, 'user-1', 'tx-1')
    expect(chain.update).toHaveBeenCalledWith({ receipt_url: 'user-1/tx-1/new.jpg' })
  })

  it('removes the stored receipt when the attachment is cleared', async () => {
    mocks.receiptUrl.mockResolvedValue('https://cdn/old.jpg')
    renderForm(editingTx)
    await screen.findByAltText('Pratinjau bukti')

    fireEvent.click(screen.getByLabelText('Hapus bukti'))
    await act(async () => {
      fireEvent.submit(form())
    })

    expect(mocks.removeReceipt).toHaveBeenCalledWith('user-1/tx-1/old.jpg')
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ receipt_url: null }))
  })

  it('surfaces save failures as an Indonesian error toast', async () => {
    mocks.update.mockRejectedValue(new Error('network down'))
    renderForm(editingTx)

    await act(async () => {
      fireEvent.submit(form())
    })

    expect(await screen.findByText('Koneksi bermasalah. Coba lagi.')).toBeInTheDocument()
  })

  it('drops a pending receipt when switching to transfer and never uploads it', async () => {
    const { onClose } = renderForm()
    fireEvent.change(screen.getByLabelText('Jumlah (Rp)'), { target: { value: '50000' } })
    fireEvent.change(screen.getByLabelText('Kategori'), { target: { value: 'cat-ex-1' } })
    fireEvent.change(document.querySelector('#tx-form input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(['x'], 'struk.jpg', { type: 'image/jpeg' })] },
    })
    expect(screen.getByAltText('Pratinjau bukti')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Transfer' }))
    expect(screen.queryByText('Bukti transaksi (opsional)')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Transfer ke'), { target: { value: 'acc-2' } })
    const chain = makeCreateChain()
    mocks.from.mockReturnValue(chain)

    await act(async () => {
      fireEvent.submit(form())
    })

    expect(mocks.uploadReceipt).not.toHaveBeenCalled()
    expect(mocks.removeReceipt).not.toHaveBeenCalled()
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'transfer', category_id: null, receipt_url: null }),
    )
    expect(await screen.findByText('Transaksi ditambahkan')).toBeInTheDocument()
    expect(onClose).toHaveBeenCalled()
  })

  it('removes the stored receipt and clears the field when converting to transfer', async () => {
    mocks.receiptUrl.mockResolvedValue('https://cdn/old.jpg')
    renderForm(editingTx)
    await screen.findByAltText('Pratinjau bukti')

    fireEvent.click(screen.getByRole('button', { name: 'Transfer' }))
    fireEvent.change(screen.getByLabelText('Jumlah (Rp)'), { target: { value: '25000' } })
    fireEvent.change(screen.getByLabelText('Transfer ke'), { target: { value: 'acc-2' } })

    await act(async () => {
      fireEvent.submit(form())
    })

    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'transfer', category_id: null, to_account_id: 'acc-2', receipt_url: null }),
    )
    expect(mocks.removeReceipt).toHaveBeenCalledWith('user-1/tx-1/old.jpg')
    expect(await screen.findByText('Transaksi diperbarui')).toBeInTheDocument()
  })

  it('clears a wrong-type category when switching between income and expense', () => {
    renderForm()
    fireEvent.change(screen.getByLabelText('Kategori'), { target: { value: 'cat-ex-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Pemasukan' }))

    expect((screen.getByLabelText('Kategori') as HTMLSelectElement).value).toBe('')
    fireEvent.submit(form())
    expect(screen.getByText('Pilih kategori')).toBeInTheDocument()
  })

  it('revalidates the category against the new type when editing', async () => {
    const incomeTx: Transaction = {
      ...editingTx,
      type: 'income',
      category_id: 'cat-in-1',
      receipt_url: null,
    }
    renderForm(incomeTx)
    expect((screen.getByLabelText('Kategori') as HTMLSelectElement).value).toBe('cat-in-1')

    fireEvent.click(screen.getByRole('button', { name: 'Pengeluaran' }))
    expect((screen.getByLabelText('Kategori') as HTMLSelectElement).value).toBe('')

    fireEvent.change(screen.getByLabelText('Kategori'), { target: { value: 'cat-ex-1' } })
    await act(async () => {
      fireEvent.submit(form())
    })

    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'expense', category_id: 'cat-ex-1' }),
    )
  })

  it('keeps the old receipt when a replacement upload fails', async () => {
    mocks.receiptUrl.mockResolvedValue('https://cdn/old.jpg')
    mocks.uploadReceipt.mockRejectedValue(new Error('Payload too large'))
    renderForm(editingTx)
    await screen.findByAltText('Pratinjau bukti')

    fireEvent.click(screen.getByLabelText('Hapus bukti'))
    const input = (await waitFor(() => document.querySelector('#tx-form input[type="file"]'))) as HTMLInputElement
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'new.jpg', { type: 'image/jpeg' })] },
    })

    await act(async () => {
      fireEvent.submit(form())
    })

    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ receipt_url: 'user-1/tx-1/old.jpg' }),
    )
    expect(mocks.removeReceipt).not.toHaveBeenCalled()
    expect(await screen.findByText('Ukuran file maksimal 5 MB')).toBeInTheDocument()
  })

  it('maps a create upload failure to an Indonesian toast and keeps the modal open', async () => {
    mocks.uploadReceipt.mockRejectedValue(new Error('The resource already exists'))
    const { onClose } = renderForm()
    fireEvent.change(screen.getByLabelText('Jumlah (Rp)'), { target: { value: '50000' } })
    fireEvent.change(screen.getByLabelText('Kategori'), { target: { value: 'cat-ex-1' } })
    const chain = makeCreateChain()
    mocks.from.mockReturnValue(chain)
    fireEvent.change(document.querySelector('#tx-form input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(['x'], 'struk.jpg', { type: 'image/jpeg' })] },
    })

    await act(async () => {
      fireEvent.submit(form())
    })

    expect(await screen.findByText('File sudah ada. Coba beberapa saat lagi.')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('does not invalidate queries when a create fails during upload', async () => {
    mocks.uploadReceipt.mockRejectedValue(new Error('network down'))
    const { client } = renderForm()
    client.setQueryData(['accounts', 'user-1'], accounts)
    fireEvent.change(screen.getByLabelText('Jumlah (Rp)'), { target: { value: '50000' } })
    fireEvent.change(screen.getByLabelText('Kategori'), { target: { value: 'cat-ex-1' } })
    const chain = makeCreateChain()
    mocks.from.mockReturnValue(chain)
    fireEvent.change(document.querySelector('#tx-form input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(['x'], 'struk.jpg', { type: 'image/jpeg' })] },
    })

    await act(async () => {
      fireEvent.submit(form())
    })

    expect(client.getQueryState(['accounts', 'user-1'])?.isInvalidated).not.toBe(true)
  })

  it('does not list funding accounts in account dropdowns', async () => {
    renderForm()
    const akunSelect = screen.getByLabelText('Akun') as HTMLSelectElement
    const akunOptions = Array.from(akunSelect.options).map((o) => o.value)
    expect(akunOptions).not.toContain('acc-fund')

    fireEvent.click(screen.getByRole('button', { name: 'Transfer' }))
    const transferToSelect = screen.getByLabelText('Transfer ke') as HTMLSelectElement
    const transferOptions = Array.from(transferToSelect.options).map((o) => o.value)
    expect(transferOptions).not.toContain('acc-fund')
  })
})
