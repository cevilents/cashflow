import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '../hooks/useAuth'
import { ToastProvider } from '../components/ui/Toast'
import LoginPage from './LoginPage'

const mocks = vi.hoisted(() => ({
  auth: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    signOut: vi.fn(),
    signUp: vi.fn(),
    signInWithPassword: vi.fn(),
  },
  from: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: { auth: mocks.auth, from: mocks.from },
}))

function renderLoginPage() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<p>home-page</p>} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </MemoryRouter>,
  )
}

function submitLogin() {
  const button = screen.getByRole('button', { name: 'Masuk' })
  fireEvent.submit(button.closest('form') as HTMLFormElement)
}

async function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } })
  submitLogin()
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
    mocks.from.mockReturnValue({ upsert: vi.fn().mockResolvedValue({ error: null }) })
    mocks.auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
    mocks.auth.signInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: null,
    })
  })

  afterEach(cleanup)

  it('renders autofill-friendly email and password fields', () => {
    renderLoginPage()
    expect(screen.getByLabelText('Email')).toHaveAttribute('autoComplete', 'email')
    expect(screen.getByLabelText('Password')).toHaveAttribute(
      'autoComplete',
      'current-password',
    )
    expect(screen.getByText('Belum punya akun?')).toBeInTheDocument()
  })

  it('shows a translated error toast when login fails', async () => {
    mocks.auth.signInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: 'Invalid login credentials' },
    })
    renderLoginPage()
    await act(async () => {
      await fillAndSubmit()
    })
    expect(await screen.findByText('Email atau password salah')).toBeInTheDocument()
  })

  it('navigates to the home page after a successful login', async () => {
    renderLoginPage()
    await act(async () => {
      await fillAndSubmit()
    })
    expect(await screen.findByText('home-page')).toBeInTheDocument()
  })

  it('shows a submitting state while login is in flight', async () => {
    let resolveLogin: (value: unknown) => void
    mocks.auth.signInWithPassword.mockReturnValue(
      new Promise((resolve) => {
        resolveLogin = resolve
      }),
    )
    renderLoginPage()
    await fillAndSubmit()
    expect(screen.getByText('Masuk…')).toBeInTheDocument()
    await act(async () => {
      resolveLogin({ data: { session: null, user: null }, error: null })
    })
  })
})