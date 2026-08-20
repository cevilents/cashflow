import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ToastProvider } from '../components/ui/Toast'
import LoginPage from './LoginPage'
import type { Member } from '../lib/members'

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  invoke: vi.fn(),
  setupComplete: true as boolean,
  members: [] as Member[],
}))

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ login: mocks.login, user: null, loading: false, logout: vi.fn() }),
}))

vi.mock('../hooks/useMembers', () => ({
  useIsSetupComplete: () => ({ data: mocks.setupComplete, isLoading: false }),
  useMembers: () => ({ data: mocks.members }),
}))

vi.mock('../lib/supabase', () => ({
  supabase: { functions: { invoke: mocks.invoke } },
}))

function bima(pw = true): Member {
  return { id: 'user-1', name: 'Bima', email: 'bima@cashflow.local', color: '#10b981', icon: 'bima', password_set: pw }
}

function renderLoginPage() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <ToastProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<p>home-page</p>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.setupComplete = true
    mocks.members = [bima()]
    mocks.invoke.mockResolvedValue({ data: null, error: null })
    mocks.login.mockResolvedValue(undefined)
  })

  afterEach(cleanup)

  it('invokes bootstrap when setup is not complete', async () => {
    mocks.setupComplete = false
    renderLoginPage()
    await waitFor(() => expect(mocks.invoke).toHaveBeenCalledWith('bootstrap', { method: 'POST', body: {} }))
  })

  it('shows the three member cards', () => {
    mocks.members = [bima(), { ...bima(), id: 'user-2', name: 'Aska', email: 'aska@cashflow.local', icon: 'aska' }]
    renderLoginPage()
    expect(screen.getByRole('button', { name: /Bima/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Aska/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Nanda/ })).toBeInTheDocument()
  })

  it('marks members without a password with a pending badge', () => {
    mocks.members = [bima(false)]
    renderLoginPage()
    expect(screen.getByText('Belum ada password')).toBeInTheDocument()
  })

  it('shows the create-password form and signs in for a member without a password', async () => {
    mocks.members = [bima(false)]
    renderLoginPage()
    fireEvent.click(screen.getByRole('button', { name: /Bima/ }))
    expect(screen.getByText('Buat password baru')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Password baru'), { target: { value: 'secret1' } })
    fireEvent.change(screen.getByPlaceholderText('Ulangi password'), { target: { value: 'secret1' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Buat Password & Masuk' }).closest('form') as HTMLFormElement)
    await act(async () => {})

    expect(mocks.invoke).toHaveBeenCalledWith('set-password', {
      method: 'POST',
      body: { email: 'bima@cashflow.local', password: 'secret1' },
    })
    expect(mocks.login).toHaveBeenCalledWith('bima@cashflow.local', 'secret1')
    expect(await screen.findByText('home-page')).toBeInTheDocument()
  })

  it('shows an error when password confirmation does not match', async () => {
    mocks.members = [bima(false)]
    renderLoginPage()
    fireEvent.click(screen.getByRole('button', { name: /Bima/ }))
    fireEvent.change(screen.getByPlaceholderText('Password baru'), { target: { value: 'secret1' } })
    fireEvent.change(screen.getByPlaceholderText('Ulangi password'), { target: { value: 'secret2' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Buat Password & Masuk' }).closest('form') as HTMLFormElement)
    await act(async () => {})

    expect(await screen.findByText('Konfirmasi password tidak cocok')).toBeInTheDocument()
    expect(mocks.invoke).not.toHaveBeenCalledWith('set-password', expect.anything())
    expect(mocks.login).not.toHaveBeenCalled()
  })

  it('shows the sign-in form and logs in for a member that already has a password', async () => {
    mocks.members = [bima(true)]
    renderLoginPage()
    fireEvent.click(screen.getByRole('button', { name: /Bima/ }))
    expect(screen.getByText('Masuk dengan password')).toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'secret1' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Masuk' }).closest('form') as HTMLFormElement)
    await act(async () => {})

    expect(mocks.login).toHaveBeenCalledWith('bima@cashflow.local', 'secret1')
    expect(await screen.findByText('home-page')).toBeInTheDocument()
  })

  it('shows a translated error toast when login fails', async () => {
    mocks.login.mockRejectedValue(new Error('Invalid login credentials'))
    mocks.members = [bima(true)]
    renderLoginPage()
    fireEvent.click(screen.getByRole('button', { name: /Bima/ }))
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'wrong' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Masuk' }).closest('form') as HTMLFormElement)
    await act(async () => {})

    expect(await screen.findByText('Email atau password salah')).toBeInTheDocument()
  })
})
