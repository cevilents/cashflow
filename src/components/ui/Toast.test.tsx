import { describe, expect, it, vi, afterEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ToastProvider, useToast } from './Toast'

function Trigger() {
  const { toast } = useToast()
  return (
    <div>
      <button onClick={() => toast('Berhasil disimpan')}>sukses</button>
      <button onClick={() => toast('Gagal menyimpan', 'error')}>gagal</button>
      <button onClick={() => toast('Info saja', 'info')}>info</button>
      <button onClick={() => toast('Memproses', 'loading')}>proses</button>
    </div>
  )
}

function renderWithToast() {
  return render(
    <ToastProvider>
      <Trigger />
    </ToastProvider>,
  )
}

describe('Toast', () => {
  afterEach(cleanup)

  it('shows a success toast with the message by default', () => {
    renderWithToast()
    fireEvent.click(screen.getByText('sukses'))
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Berhasil disimpan')
    expect(status.querySelector('svg')).toHaveClass('text-good')
  })

  it('shows an error toast with a bad tone icon', () => {
    renderWithToast()
    fireEvent.click(screen.getByText('gagal'))
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Gagal menyimpan')
    expect(status.querySelector('svg')).toHaveClass('text-bad')
  })

  it('supports info and loading variants', () => {
    renderWithToast()
    fireEvent.click(screen.getByText('info'))
    fireEvent.click(screen.getByText('proses'))
    expect(screen.getByText('Info saja')).toBeInTheDocument()
    expect(screen.getByText('Memproses')).toBeInTheDocument()
    expect(screen.getByLabelText('Memuat')).toBeInTheDocument()
  })

  it('auto-dismisses a toast after 3500ms', () => {
    vi.useFakeTimers()
    try {
      renderWithToast()
      fireEvent.click(screen.getByText('sukses'))
      expect(screen.getByText('Berhasil disimpan')).toBeInTheDocument()
      act(() => {
        vi.advanceTimersByTime(3500)
      })
      expect(screen.queryByText('Berhasil disimpan')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('removes only the toast whose timeout elapsed', () => {
    vi.useFakeTimers()
    try {
      renderWithToast()
      fireEvent.click(screen.getByText('sukses'))
      act(() => {
        vi.advanceTimersByTime(2000)
      })
      fireEvent.click(screen.getByText('gagal'))
      act(() => {
        vi.advanceTimersByTime(1500)
      })
      expect(screen.queryByText('Berhasil disimpan')).not.toBeInTheDocument()
      expect(screen.getByText('Gagal menyimpan')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})