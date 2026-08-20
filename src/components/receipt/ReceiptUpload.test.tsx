import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { useState } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ReceiptUpload } from './ReceiptUpload'

const mocks = vi.hoisted(() => ({ receiptUrl: vi.fn() }))

vi.mock('./receiptStorage', () => ({
  receiptUrl: mocks.receiptUrl,
}))

const fileInput = (container: HTMLElement) => container.querySelector('input[type="file"]') as HTMLInputElement

describe('ReceiptUpload', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(cleanup)

  it('shows the upload prompt when there is no receipt', () => {
    render(<ReceiptUpload current={null} onChange={vi.fn()} />)
    expect(screen.getByText('Klik untuk pilih foto struk')).toBeInTheDocument()
    expect(screen.queryByAltText('Pratinjau bukti')).not.toBeInTheDocument()
  })

  it('reports a newly selected file with a blob path marker', () => {
    const onChange = vi.fn()
    const { container } = render(<ReceiptUpload current={null} onChange={onChange} />)
    const file = new File(['x'], 'struk.jpg', { type: 'image/jpeg' })

    fireEvent.change(fileInput(container), { target: { files: [file] } })

    expect(onChange).toHaveBeenCalledWith('blob:struk.jpg', file)
    expect(fileInput(container).value).toBe('')
  })

  it('rejects files larger than five megabytes with an alert', () => {
    const onChange = vi.fn()
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    const { container } = render(<ReceiptUpload current={null} onChange={onChange} />)
    const big = new File([new ArrayBuffer(6 * 1024 * 1024)], 'big.jpg', { type: 'image/jpeg' })

    fireEvent.change(fileInput(container), { target: { files: [big] } })

    expect(alertSpy).toHaveBeenCalledWith('Ukuran file maksimal 5 MB')
    expect(onChange).not.toHaveBeenCalled()
    alertSpy.mockRestore()
  })

  it('previews a stored receipt via a signed url', async () => {
    mocks.receiptUrl.mockResolvedValue('https://cdn/signed.png')
    render(<ReceiptUpload current="user-1/tx-1/a.png" onChange={vi.fn()} />)

    const img = await screen.findByAltText('Pratinjau bukti')
    expect(img).toHaveAttribute('src', 'https://cdn/signed.png')
  })

  it('clears the receipt when the remove button is clicked', async () => {
    mocks.receiptUrl.mockResolvedValue('https://cdn/signed.png')
    const onChange = vi.fn()
    function Harness() {
      const [current, setCurrent] = useState<string | null>('user-1/tx-1/a.png')
      return (
        <ReceiptUpload
          current={current}
          onChange={(path, file) => {
            setCurrent(path)
            onChange(path, file)
          }}
        />
      )
    }
    render(<Harness />)
    await screen.findByAltText('Pratinjau bukti')

    fireEvent.click(screen.getByLabelText('Hapus bukti'))

    expect(onChange).toHaveBeenCalledWith(null, undefined)
    await waitFor(() => expect(screen.queryByAltText('Pratinjau bukti')).not.toBeInTheDocument())
  })

  it('uses the blob marker directly as preview while uploading a new file', () => {
    const { container } = render(<ReceiptUpload current="blob:struk.jpg" onChange={vi.fn()} />)
    const img = screen.getByAltText('Pratinjau bukti')
    expect(img).toHaveAttribute('src', 'blob:struk.jpg')
    expect(mocks.receiptUrl).not.toHaveBeenCalled()
    expect(container.querySelector('input[type="file"]')).toBeNull()
  })
})
