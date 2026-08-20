import { describe, expect, it, vi, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Modal } from './Modal'

describe('Modal', () => {
  afterEach(cleanup)

  it('renders nothing when closed', () => {
    render(
      <Modal open={false} onClose={() => {}} title="Hapus">
        konten
      </Modal>,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders title, content, and footer when open', () => {
    render(
      <Modal open onClose={() => {}} title="Hapus" footer={<button>Simpan</button>}>
        konten
      </Modal>,
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Hapus')).toBeInTheDocument()
    expect(screen.getByText('konten')).toBeInTheDocument()
    expect(screen.getByText('Simpan')).toBeInTheDocument()
  })

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="Hapus">
        konten
      </Modal>,
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when the backdrop is clicked', () => {
    const onClose = vi.fn()
    const { container } = render(
      <Modal open onClose={onClose} title="Hapus">
        konten
      </Modal>,
    )
    const backdrop = container.querySelector('[aria-hidden="true"]') as HTMLElement
    fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn()
    render(
      <Modal open onClose={onClose} title="Hapus">
        konten
      </Modal>,
    )
    fireEvent.click(screen.getByLabelText('Tutup'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})