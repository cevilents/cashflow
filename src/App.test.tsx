import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import App from './App'

const mocks = vi.hoisted(() => ({
  auth: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    signOut: vi.fn(),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
  },
  from: vi.fn(),
  functions: { invoke: vi.fn() },
}))

vi.mock('./lib/supabase', () => ({
  supabase: { auth: mocks.auth, from: mocks.from, functions: mocks.functions },
}))

vi.mock('./hooks/useMembers', () => ({
  useMembers: () => ({ data: [], isLoading: false }),
  useIsSetupComplete: () => ({ data: false, isLoading: false }),
}))

function renderAt(path: string) {
  window.history.pushState({}, '', path)
  return render(<App />)
}

async function waitForAuthToSettle() {
  await waitFor(() => {
    expect(screen.queryByLabelText('Memuat')).not.toBeInTheDocument()
  })
}

describe('App routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.onAuthStateChange.mockImplementation(() => ({
      data: { subscription: { unsubscribe: vi.fn() } },
    }))
    mocks.auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
  })

  afterEach(cleanup)

  it('renders the SetupPage when navigating to /setup', async () => {
    renderAt('/setup')
    expect(await screen.findByText('Buat password untuk masing-masing')).toBeInTheDocument()
  })

  it('no longer matches /register', async () => {
    renderAt('/register')
    await waitForAuthToSettle()
    expect(screen.queryByText('Buat Akun')).not.toBeInTheDocument()
  })
})
