import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ToastProvider } from '../components/ui/Toast'
import LoginPage from './LoginPage'

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  setupComplete: true as boolean,
}))

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => ({ login: mocks.login, user: null, loading: false, logout: vi.fn() }),
}))

vi.mock('../hooks/useMembers', () => ({
  useIsSetupComplete: () => ({ data: mocks.setupComplete, isLoading: false }),
}))

function renderLoginPage() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <ToastProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<p>home-page</p>} />
          <Route path="/setup" element={<p>setup-page</p>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )
}

function memberCard(name: string) {
  return screen.getByRole('button', { name: new RegExp(name) })
}

async function selectAndSubmit(password = 'secret') {
  fireEvent.click(memberCard('Bima'))
  fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: password } })
  fireEvent.submit(screen.getByRole('button', { name: 'Masuk' }).closest('form') as HTMLFormElement)
  await act(async () => {})
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.setupComplete = true
    mocks.login.mockResolvedValue(undefined)
  })

  afterEach(cleanup)

  it('shows an incomplete-setup notice and navigates to setup', async () => {
    mocks.setupComplete = false
    renderLoginPage()
    expect(screen.getByText('Pengaturan awal belum selesai.')).toBeInTheDocument()
    const button = screen.getByRole('button', { name: 'Pengaturan awal' })
    fireEvent.click(button)
    expect(await screen.findByText('setup-page')).toBeInTheDocument()
  })

  it('shows the three member cards when setup is complete', () => {
    renderLoginPage()
    expect(memberCard('Bima')).toBeInTheDocument()
    expect(memberCard('Aska')).toBeInTheDocument()
    expect(memberCard('Nanda')).toBeInTheDocument()
  })

  it('submits login with the selected member email and navigates home', async () => {
    renderLoginPage()
    fireEvent.click(memberCard('Aska'))
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'secret' } })
    fireEvent.submit(screen.getByRole('button', { name: 'Masuk' }).closest('form') as HTMLFormElement)
    await act(async () => {})
    expect(mocks.login).toHaveBeenCalledWith('aska@cashflow.local', 'secret')
    expect(await screen.findByText('home-page')).toBeInTheDocument()
  })

  it('shows a translated error toast when login fails', async () => {
    mocks.login.mockRejectedValue(new Error('Invalid login credentials'))
    renderLoginPage()
    await selectAndSubmit()
    expect(await screen.findByText('Email atau password salah')).toBeInTheDocument()
  })

  it('allows changing the selected member', () => {
    renderLoginPage()
    fireEvent.click(memberCard('Bima'))
    expect(screen.getByText('Bima')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Ganti' }))
    expect(memberCard('Aska')).toBeInTheDocument()
    expect(memberCard('Nanda')).toBeInTheDocument()
  })
})
