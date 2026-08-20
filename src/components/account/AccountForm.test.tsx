import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from '../ui/Toast'
import { AccountForm } from './AccountForm'
import { createQueryClient } from '../../test/queryTestUtils'
import type { Account } from '../../types/database'

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
}))

vi.mock('../../hooks/useAccounts', () => ({
  useCreateAccount: () => ({ mutateAsync: mocks.create }),
  useUpdateAccount: () => ({ mutateAsync: mocks.update }),
}))

const account: Account = {
  id: 'acc-1',
  user_id: 'user-1',
  name: 'BCA',
  type: 'bank',
  opening_balance: 100000,
  color: '#3b82f6',
  is_archived: false,
  created_at: '2026-01-01T00:00:00Z',
}

function renderForm(editing?: Account | null) {
  const onClose = vi.fn()
  const client = createQueryClient()
  const view = render(
    <QueryClientProvider client={client}>
      <ToastProvider>
        <AccountForm open onClose={onClose} editing={editing ?? null} />
      </ToastProvider>
    </QueryClientProvider>,
  )
  return { onClose, ...view }
}

function form() {
  return document.querySelector('form') as HTMLFormElement
}

describe('AccountForm', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  afterEach(cleanup)

  it('shows an Indonesian error when the name is empty', () => {
    const { onClose } = renderForm()
    fireEvent.submit(form())
    expect(screen.getByText('Nama akun wajib diisi')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('rejects an invalid opening balance', () => {
    renderForm()
    fireEvent.change(screen.getByLabelText('Nama akun'), { target: { value: 'GoPay' } })
    fireEvent.change(screen.getByLabelText('Saldo awal (Rp)'), { target: { value: 'abc' } })
    fireEvent.submit(form())
    expect(screen.getByText('Saldo tidak valid')).toBeInTheDocument()
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('creates a new account with the parsed opening balance and defaults', async () => {
    const { onClose } = renderForm()
    fireEvent.change(screen.getByLabelText('Nama akun'), { target: { value: 'GoPay' } })
    fireEvent.change(screen.getByLabelText('Tipe'), { target: { value: 'ewallet' } })
    fireEvent.change(screen.getByLabelText('Saldo awal (Rp)'), { target: { value: '150.000' } })

    await act(async () => {
      fireEvent.submit(form())
    })

    expect(mocks.create).toHaveBeenCalledWith({
      name: 'GoPay',
      type: 'ewallet',
      opening_balance: 150000,
      color: '#10b981',
    })
    expect(await screen.findByText('Akun ditambahkan')).toBeInTheDocument()
    expect(onClose).toHaveBeenCalled()
  })

  it('prefills fields when editing and updates the account', async () => {
    const { onClose } = renderForm(account)
    expect(screen.getByText('Edit Akun')).toBeInTheDocument()
    expect((screen.getByLabelText('Nama akun') as HTMLInputElement).value).toBe('BCA')
    expect((screen.getByLabelText('Tipe') as HTMLSelectElement).value).toBe('bank')
    expect((screen.getByLabelText('Saldo awal (Rp)') as HTMLInputElement).value).toBe('100000')

    fireEvent.change(screen.getByLabelText('Nama akun'), { target: { value: 'BCA Unggul' } })
    await act(async () => {
      fireEvent.submit(form())
    })

    expect(mocks.update).toHaveBeenCalledWith({
      id: 'acc-1',
      name: 'BCA Unggul',
      type: 'bank',
      opening_balance: 100000,
      color: '#3b82f6',
    })
    expect(await screen.findByText('Akun diperbarui')).toBeInTheDocument()
    expect(onClose).toHaveBeenCalled()
  })

  it('surfaces a create failure as an Indonesian error toast', async () => {
    mocks.create.mockRejectedValue(new Error('network down'))
    const { onClose } = renderForm()
    fireEvent.change(screen.getByLabelText('Nama akun'), { target: { value: 'Koperasi' } })

    await act(async () => {
      fireEvent.submit(form())
    })

    expect(await screen.findByText('network down')).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()
  })
})
