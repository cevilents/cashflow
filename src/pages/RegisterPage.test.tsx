import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { Session, User } from '@supabase/supabase-js'
import { AuthProvider } from '../hooks/useAuth'
import { ToastProvider } from '../components/ui/Toast'
import RegisterPage from './RegisterPage'

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

const user: User = {
  id: 'user-1',
  aud: 'authenticated',
  email: 'a@b.com',
  created_at: '2026-01-01T00:00:00Z',
  user_metadata: { full_name: 'Budi' },
  app_metadata: {},
}

function makeSession(): Session {
  return {
    access_token: 'token',
    refresh_token: 'refresh',
    expires_in: 3600,
    expires_at: 1_700_000_000,
    token_type: 'bearer',
    user,
  }
}

function renderRegisterPage() {
  return render(
    <MemoryRouter initialEntries={['/register']}>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/login" element={<p>login-page</p>} />
            <Route path="/" element={<p>home-page</p>} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </MemoryRouter>,
  )
}

function submitRegister() {
  const button = screen.getByRole('button', { name: 'Daftar' })
  fireEvent.submit(button.closest('form') as HTMLFormElement)
}

function fillValidAndSubmit() {
  fireEvent.change(screen.getByLabelText('Nama'), { target: { value: 'Budi' } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret6' } })
  submitRegister()
}

describe('RegisterPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
    mocks.from.mockReturnValue({ upsert: vi.fn().mockResolvedValue({ error: null }) })
    mocks.auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
    mocks.auth.signUp.mockResolvedValue({
      data: { session: null, user: null },
      error: null,
    })
  })

  afterEach(cleanup)

  it('renders autofill-friendly fields', () => {
    renderRegisterPage()
    expect(screen.getByLabelText('Nama')).toHaveAttribute('autoComplete', 'name')
    expect(screen.getByLabelText('Email')).toHaveAttribute('autoComplete', 'email')
    expect(screen.getByLabelText('Password')).toHaveAttribute(
      'autoComplete',
      'new-password',
    )
    expect(screen.getByText('Sudah punya akun?')).toBeInTheDocument()
  })

  it('blocks a password shorter than 6 characters without calling supabase', async () => {
    renderRegisterPage()
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'abc' } })
    await act(async () => {
      submitRegister()
    })
    expect(screen.getByText('Password minimal 6 karakter')).toBeInTheDocument()
    expect(mocks.auth.signUp).not.toHaveBeenCalled()
  })

  it('registers with name metadata and redirects to login on success', async () => {
    renderRegisterPage()
    await act(async () => {
      fillValidAndSubmit()
    })
    expect(mocks.auth.signUp).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'secret6',
      options: { data: { full_name: 'Budi' } },
    })
    expect(await screen.findByText('Akun dibuat! Silakan masuk.')).toBeInTheDocument()
    expect(await screen.findByText('login-page')).toBeInTheDocument()
  })

  it('goes straight to the home page when registration establishes a session', async () => {
    mocks.auth.signUp.mockResolvedValue({
      data: { session: makeSession(), user },
      error: null,
    })
    renderRegisterPage()
    await act(async () => {
      fillValidAndSubmit()
    })
    expect(await screen.findByText('Akun berhasil dibuat!')).toBeInTheDocument()
    expect(await screen.findByText('home-page')).toBeInTheDocument()
  })

  it('shows a translated error toast when registration fails', async () => {
    mocks.auth.signUp.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: 'User already registered' },
    })
    renderRegisterPage()
    await act(async () => {
      fillValidAndSubmit()
    })
    expect(await screen.findByText('Email sudah terdaftar')).toBeInTheDocument()
  })

  it('shows a submitting state while registration is in flight', async () => {
    let resolveSignUp: (value: unknown) => void
    mocks.auth.signUp.mockReturnValue(
      new Promise((resolve) => {
        resolveSignUp = resolve
      }),
    )
    renderRegisterPage()
    await fillValidAndSubmit()
    expect(screen.getByText('Membuat…')).toBeInTheDocument()
    await act(async () => {
      resolveSignUp({ data: { session: null, user: null }, error: null })
    })
  })
})