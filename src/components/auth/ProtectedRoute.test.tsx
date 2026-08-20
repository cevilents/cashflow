import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import type { Session, User } from '@supabase/supabase-js'
import { AuthProvider } from '../../hooks/useAuth'
import { ProtectedRoute, PublicOnlyRoute } from './ProtectedRoute'

const mocks = vi.hoisted(() => ({
  auth: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    signOut: vi.fn(),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
  },
  from: vi.fn(),
}))

vi.mock('../../lib/supabase', () => ({
  supabase: { auth: mocks.auth, from: mocks.from },
}))

const user: User = {
  id: 'user-1',
  aud: 'authenticated',
  email: 'a@b.com',
  created_at: '2026-01-01T00:00:00Z',
  user_metadata: {},
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

function renderRoutes(initialPath: string) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/login" element={<p>login-page</p>} />
          <Route path="/register" element={<p>register-page</p>} />
          <Route
            path="/secured"
            element={
              <ProtectedRoute>
                <p>protected-content</p>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

function renderPublicRoute(initialPath: string) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/" element={<p>home-page</p>} />
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <p>login-page</p>
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicOnlyRoute>
                <p>register-page</p>
              </PublicOnlyRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
    mocks.from.mockReturnValue({ upsert: vi.fn().mockResolvedValue({ error: null }) })
    mocks.auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
  })

  afterEach(cleanup)

  it('shows a spinner while the session is loading', async () => {
    let resolveSession: (value: unknown) => void
    mocks.auth.getSession.mockReturnValue(
      new Promise((resolve) => {
        resolveSession = resolve
      }),
    )
    renderRoutes('/secured')
    expect(screen.getByLabelText('Memuat')).toBeInTheDocument()
    await act(async () => {
      resolveSession({ data: { session: null }, error: null })
    })
  })

  it('redirects an unauthenticated user to /login', async () => {
    renderRoutes('/secured')
    expect(await screen.findByText('login-page')).toBeInTheDocument()
    expect(screen.queryByText('protected-content')).not.toBeInTheDocument()
  })

  it('renders children for an authenticated user', async () => {
    mocks.auth.getSession.mockResolvedValue({ data: { session: makeSession() }, error: null })
    renderRoutes('/secured')
    expect(await screen.findByText('protected-content')).toBeInTheDocument()
    expect(screen.queryByText('login-page')).not.toBeInTheDocument()
  })
})

describe('PublicOnlyRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    })
    mocks.from.mockReturnValue({ upsert: vi.fn().mockResolvedValue({ error: null }) })
    mocks.auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
  })

  afterEach(cleanup)

  it('lets a guest visit /login', async () => {
    renderPublicRoute('/login')
    expect(await screen.findByText('login-page')).toBeInTheDocument()
  })

  it('redirects an authenticated user away from /login', async () => {
    mocks.auth.getSession.mockResolvedValue({ data: { session: makeSession() }, error: null })
    renderPublicRoute('/login')
    expect(await screen.findByText('home-page')).toBeInTheDocument()
    expect(screen.queryByText('login-page')).not.toBeInTheDocument()
  })

  it('redirects an authenticated user away from /register', async () => {
    mocks.auth.getSession.mockResolvedValue({ data: { session: makeSession() }, error: null })
    renderPublicRoute('/register')
    expect(await screen.findByText('home-page')).toBeInTheDocument()
    expect(screen.queryByText('register-page')).not.toBeInTheDocument()
  })
})