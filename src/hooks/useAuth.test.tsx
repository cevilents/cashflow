import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { AuthProvider, useAuth } from './useAuth'

const mocks = vi.hoisted(() => ({
  auth: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  },
  from: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: { auth: mocks.auth, from: mocks.from },
}))

let changeListener: ((event: string, session: Session | null) => void) | null = null
let upsert: ReturnType<typeof vi.fn>

const user: User = {
  id: 'user-1',
  aud: 'authenticated',
  email: 'a@b.com',
  created_at: '2026-01-01T00:00:00Z',
  user_metadata: { full_name: 'Budi' },
  app_metadata: {},
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    access_token: 'token',
    refresh_token: 'refresh',
    expires_in: 3600,
    expires_at: 1_700_000_000,
    token_type: 'bearer',
    user,
    ...overrides,
  }
}

function Probe() {
  const { user: currentUser, loading, login, register, logout } = useAuth()
  const [error, setError] = useState('')
  const run = (fn: () => Promise<void>) => {
    fn().catch((e: unknown) => {
      setError((e as { message?: string }).message ?? 'error')
    })
  }
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user">{currentUser ? currentUser.email : 'none'}</span>
      <span data-testid="error">{error}</span>
      <button onClick={() => run(() => login('a@b.com', 'secret123'))}>login</button>
      <button onClick={() => run(() => register('a@b.com', 'secret123', 'Budi'))}>
        register
      </button>
      <button onClick={() => run(logout)}>logout</button>
    </div>
  )
}

function renderProvider() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  )
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    changeListener = null
    upsert = vi.fn().mockResolvedValue({ error: null })
    mocks.auth.onAuthStateChange.mockImplementation((cb) => {
      changeListener = cb
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })
    mocks.from.mockReturnValue({ upsert })
    mocks.auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
  })

  afterEach(cleanup)

  it('starts loading and settles to no user without a session', async () => {
    renderProvider()
    expect(screen.getByTestId('loading')).toHaveTextContent('true')
    expect(await screen.findByTestId('loading')).toHaveTextContent('false')
    expect(screen.getByTestId('user')).toHaveTextContent('none')
  })

  it('restores the user from an existing session', async () => {
    mocks.auth.getSession.mockResolvedValue({ data: { session: makeSession() }, error: null })
    renderProvider()
    expect(await screen.findByTestId('user')).toHaveTextContent('a@b.com')
  })

  it('signs in, upserts the profile, and exposes the signed-in user', async () => {
    mocks.auth.signInWithPassword.mockResolvedValue({
      data: { session: makeSession(), user },
      error: null,
    })
    renderProvider()
    await act(async () => {
      fireEvent.click(screen.getByText('login'))
    })
    expect(mocks.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'secret123',
    })
    expect(mocks.from).toHaveBeenCalledWith('profiles')
    expect(upsert).toHaveBeenCalledWith({ id: 'user-1', full_name: 'Budi' }, { onConflict: 'id' })
    act(() => {
      changeListener?.('SIGNED_IN', makeSession())
    })
    expect(screen.getByTestId('user')).toHaveTextContent('a@b.com')
  })

  it('keeps the session on a failed login and surfaces the raw error', async () => {
    mocks.auth.signInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: 'Invalid login credentials' },
    })
    renderProvider()
    await act(async () => {
      fireEvent.click(screen.getByText('login'))
    })
    expect(await screen.findByTestId('error')).toHaveTextContent('Invalid login credentials')
    expect(screen.getByTestId('user')).toHaveTextContent('none')
  })

  it('registers with full name metadata and upserts the profile', async () => {
    mocks.auth.signUp.mockResolvedValue({ data: { session: null, user }, error: null })
    renderProvider()
    await act(async () => {
      fireEvent.click(screen.getByText('register'))
    })
    expect(mocks.auth.signUp).toHaveBeenCalledWith({
      email: 'a@b.com',
      password: 'secret123',
      options: { data: { full_name: 'Budi' } },
    })
    expect(upsert).toHaveBeenCalledWith({ id: 'user-1', full_name: 'Budi' }, { onConflict: 'id' })
  })

  it('surfaces a register failure', async () => {
    mocks.auth.signUp.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: 'User already registered' },
    })
    renderProvider()
    await act(async () => {
      fireEvent.click(screen.getByText('register'))
    })
    expect(await screen.findByTestId('error')).toHaveTextContent('User already registered')
  })

  it('clears the user on sign out and signs out of supabase', async () => {
    mocks.auth.getSession.mockResolvedValue({ data: { session: makeSession() }, error: null })
    mocks.auth.signOut.mockResolvedValue({ error: null })
    renderProvider()
    await screen.findByTestId('user')
    act(() => {
      changeListener?.('SIGNED_OUT', null)
    })
    expect(screen.getByTestId('user')).toHaveTextContent('none')
    await act(async () => {
      fireEvent.click(screen.getByText('logout'))
    })
    expect(mocks.auth.signOut).toHaveBeenCalled()
  })

  it('subscribes and unsubscribes from auth state changes on unmount', () => {
    const { unmount } = renderProvider()
    const subscription = mocks.auth.onAuthStateChange.mock.results[0]?.value.data.subscription
    unmount()
    expect(subscription.unsubscribe).toHaveBeenCalled()
  })
})