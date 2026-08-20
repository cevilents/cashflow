import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ToastProvider } from '../components/ui/Toast'
import SetupPage from './SetupPage'

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
}))

vi.mock('../lib/supabase', () => ({
  supabase: { functions: { invoke: mocks.invoke } },
}))

vi.mock('../hooks/useMembers', () => ({
  useIsSetupComplete: vi.fn(),
}))

import { useIsSetupComplete } from '../hooks/useMembers'

function mockSetupComplete(complete: boolean, loading = false) {
  ;(useIsSetupComplete as ReturnType<typeof vi.fn>).mockReturnValue({
    data: complete,
    isLoading: loading,
  })
}

function renderSetupPage() {
  return render(
    <MemoryRouter initialEntries={['/setup']}>
      <ToastProvider>
        <Routes>
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/login" element={<p>login-page</p>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  )
}

function passwordInputs() {
  return screen.getAllByPlaceholderText('Password')
}

function fillAllPasswords() {
  const [bima, aska, nanda] = passwordInputs()
  fireEvent.change(bima, { target: { value: 'abc123' } })
  fireEvent.change(aska, { target: { value: 'abc123' } })
  fireEvent.change(nanda, { target: { value: 'abc123' } })
}

function submitForm() {
  const button = screen.getByRole('button', { name: 'Simpan & Lanjut' })
  fireEvent.submit(button.closest('form') as HTMLFormElement)
}

describe('SetupPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSetupComplete(false)
    mocks.invoke.mockResolvedValue({ data: null, error: null })
  })

  afterEach(cleanup)

  it('renders a system message when setup is already complete', () => {
    mockSetupComplete(true)
    renderSetupPage()
    expect(screen.getByText('Sistem sudah disetel.')).toBeInTheDocument()
  })

  it('submits all three passwords and navigates to login', async () => {
    renderSetupPage()
    fillAllPasswords()
    await act(async () => {
      submitForm()
    })
    expect(mocks.invoke).toHaveBeenCalledWith('bootstrap', {
      body: {
        passwords: {
          'bima@cashflow.local': 'abc123',
          'aska@cashflow.local': 'abc123',
          'nanda@cashflow.local': 'abc123',
        },
      },
    })
    expect(await screen.findByText('login-page')).toBeInTheDocument()
  })

  it('shows an error toast for short passwords and does not call invoke', async () => {
    renderSetupPage()
    const [bima, aska, nanda] = passwordInputs()
    fireEvent.change(bima, { target: { value: '123' } })
    fireEvent.change(aska, { target: { value: '123' } })
    fireEvent.change(nanda, { target: { value: '123' } })
    await act(async () => {
      submitForm()
    })
    expect(screen.getByText('Setiap password minimal 6 karakter')).toBeInTheDocument()
    expect(mocks.invoke).not.toHaveBeenCalled()
  })
})
