import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { uploadReceipt, removeReceipt, receiptUrl } from './receiptStorage'

const mocks = vi.hoisted(() => ({ storage: { from: vi.fn() } }))

vi.mock('../../lib/supabase', () => ({
  supabase: { storage: mocks.storage },
}))

function mockBucket() {
  const bucket = {
    upload: vi.fn(),
    remove: vi.fn(),
    createSignedUrl: vi.fn(),
  }
  mocks.storage.from.mockReturnValue(bucket)
  return bucket
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('uploadReceipt', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000)
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
  })

  it('builds a scoped path and uploads to the receipts bucket', async () => {
    const bucket = mockBucket()
    bucket.upload.mockResolvedValue({ data: { path: 'x' }, error: null })
    const file = new File(['x'], 'struk.png', { type: 'image/png' })

    const path = await uploadReceipt(file, 'user-1', 'tx-1')

    expect(mocks.storage.from).toHaveBeenCalledWith('receipts')
    expect(path).toBe(`user-1/tx-1/${1700000000000}-${(0.5).toString(36).slice(2)}.png`)
    expect(bucket.upload).toHaveBeenCalledWith(path, file, { cacheControl: '3600', upsert: false })
  })

  it('defaults to jpg when the file has no extension', async () => {
    const bucket = mockBucket()
    bucket.upload.mockResolvedValue({ data: { path: 'x' }, error: null })
    const file = new File(['x'], 'struk.', { type: 'image/jpeg' })

    const path = await uploadReceipt(file, 'user-1', 'tx-1')

    expect(path.endsWith('.jpg')).toBe(true)
  })

  it('throws when the upload fails', async () => {
    const bucket = mockBucket()
    bucket.upload.mockResolvedValue({ data: null, error: { message: 'storage down' } })

    await expect(uploadReceipt(new File(['x'], 'a.png'), 'u', 't')).rejects.toMatchObject({
      message: 'storage down',
    })
  })
})

describe('removeReceipt', () => {
  it('removes the given path from the receipts bucket', async () => {
    const bucket = mockBucket()
    bucket.remove.mockResolvedValue({ data: [], error: null })

    await removeReceipt('user-1/tx-1/a.png')

    expect(mocks.storage.from).toHaveBeenCalledWith('receipts')
    expect(bucket.remove).toHaveBeenCalledWith(['user-1/tx-1/a.png'])
  })

  it('throws when removal fails', async () => {
    const bucket = mockBucket()
    bucket.remove.mockResolvedValue({ data: null, error: { message: 'gone' } })

    await expect(removeReceipt('p')).rejects.toMatchObject({ message: 'gone' })
  })
})

describe('receiptUrl', () => {
  it('returns null for a null path', async () => {
    mockBucket()
    await expect(receiptUrl(null)).resolves.toBeNull()
    expect(mocks.storage.from).not.toHaveBeenCalled()
  })

  it('creates a signed url with a one hour expiry', async () => {
    const bucket = mockBucket()
    bucket.createSignedUrl.mockResolvedValue({ data: { signedUrl: 'https://cdn/signed' }, error: null })

    await expect(receiptUrl('user-1/tx-1/a.png')).resolves.toBe('https://cdn/signed')

    expect(mocks.storage.from).toHaveBeenCalledWith('receipts')
    expect(bucket.createSignedUrl).toHaveBeenCalledWith('user-1/tx-1/a.png', 3600)
  })

  it('returns null when signing fails', async () => {
    const bucket = mockBucket()
    bucket.createSignedUrl.mockResolvedValue({ data: null, error: { message: 'denied' } })

    await expect(receiptUrl('user-1/tx-1/a.png')).resolves.toBeNull()
  })
})
