import { describe, expect, it, vi } from 'vitest'
import { toCSV, downloadFile, buildReportRows, REPORT_HEADER } from './csv'
import type { Account, Category, Transaction } from '../types/database'
import type { Member } from './members'

describe('toCSV', () => {
  it('joins rows with newlines and cells with commas', () => {
    expect(toCSV([['a', 'b'], [1, 2]])).toBe('"a","b"\n"1","2"')
  })

  it('escapes embedded quotes by doubling them', () => {
    expect(toCSV([['a"b']])).toBe('"a""b"')
  })

  it('quotes cells containing commas', () => {
    expect(toCSV([['a,b', 'c']])).toBe('"a,b","c"')
  })

  it('wraps everything in quotes including numbers and empty strings', () => {
    expect(toCSV([['', 0]])).toBe('"","0"')
  })

  it('produces a header then data rows', () => {
    expect(toCSV([['A', 'B'], ['x', 'y']])).toBe('"A","B"\n"x","y"')
  })

  it('handles empty input', () => {
    expect(toCSV([])).toBe('')
  })

  it('coerces numeric cells to strings', () => {
    expect(toCSV([[42, -7.5]])).toBe('"42","-7.5"')
  })
})

describe('downloadFile', () => {
  it('triggers a client-side download with a BOM-prefixed blob', () => {
    const createObjectURL = vi.fn(() => 'blob:url')
    const revokeObjectURL = vi.fn()
    const click = vi.fn()
    const appendChild = vi.fn()
    const remove = vi.fn()
    Object.assign(URL, { createObjectURL, revokeObjectURL })
    document.createElement = vi.fn(() => ({ href: '', download: '', click, remove } as unknown as HTMLAnchorElement)) as typeof document.createElement
    document.body.appendChild = appendChild as typeof document.body.appendChild

    downloadFile('laporan.csv', 'a,b')

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    const args = createObjectURL.mock.calls[0] as [Blob] | undefined
    expect(args?.[0].type).toBe('text/csv;charset=utf-8')
    expect(click).toHaveBeenCalled()
    expect(appendChild).toHaveBeenCalled()
    expect(remove).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:url')
  })
})

describe('buildReportRows', () => {
  const account: Account = {
    id: 'acc-1', user_id: 'u', name: 'Tunai', type: 'cash', opening_balance: 0,
    color: '#10b981', is_archived: false, created_at: '2026-01-01T00:00:00Z',
  }
  const categories: Category[] = [
    { id: 'cat-1', user_id: 'u', name: 'Makanan', type: 'expense', icon: '', color: '#f43f5e', created_at: '2026-01-01T00:00:00Z' },
  ]
  const makeTx = (partial: Partial<Transaction>): Transaction => ({
    id: partial.id ?? 't', user_id: 'u', account_id: partial.account_id ?? 'acc-1',
    type: partial.type ?? 'expense', category_id: partial.category_id ?? null,
    amount: partial.amount ?? 0, to_account_id: null, note: partial.note ?? '',
    date: partial.date ?? '2026-08-01', receipt_url: null,
    created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z',
  })

  it('exports the header plus one row per transaction in the month', () => {
    const rows = buildReportRows(
      [makeTx({ id: '1', type: 'income', amount: 100000, note: 'Gaji', date: '2026-08-01' })],
      [account],
      categories,
      '2026-08',
      [],
    )
    expect(REPORT_HEADER).toEqual(['Tanggal', 'Tipe', 'Akun', 'Kategori', 'Jumlah', 'Catatan', 'Pemilik'])
    const full = [REPORT_HEADER, ...rows]
    expect(toCSV(full)).toBe(
      '"Tanggal","Tipe","Akun","Kategori","Jumlah","Catatan","Pemilik"\n"2026-08-01","Pemasukan","Tunai","","100000","Gaji",""',
    )
  })

  it('resolves account and category names and signs income positive expense negative', () => {
    const members: Member[] = [
      { id: 'u', name: 'Bima', email: 'bima@cashflow.local', color: '#10b981', icon: 'bima' },
    ]
    const rows = buildReportRows(
      [
        makeTx({ id: '1', type: 'income', amount: 50000, category_id: null, date: '2026-08-01' }),
        makeTx({ id: '2', type: 'expense', amount: 15000, category_id: 'cat-1', date: '2026-08-02' }),
        makeTx({ id: '3', type: 'transfer', amount: 7000, date: '2026-08-03' }),
      ],
      [account],
      categories,
      '2026-08',
      members,
    )
    expect(rows).toEqual([
      ['2026-08-01', 'Pemasukan', 'Tunai', '', 50000, '', 'Bima'],
      ['2026-08-02', 'Pengeluaran', 'Tunai', 'Makanan', -15000, '', 'Bima'],
      ['2026-08-03', 'Transfer', 'Tunai', '', -7000, '', 'Bima'],
    ])
  })

  it('escapes commas and quotes in note cells within CSV output', () => {
    const rows = buildReportRows(
      [makeTx({ id: '1', type: 'expense', amount: 1000, note: 'a,"b",c', date: '2026-08-01' })],
      [account],
      categories,
      '2026-08',
      [],
    )
    expect(toCSV([REPORT_HEADER, ...rows])).toContain('"a,""b"",c"')
  })

  it('filters out transactions from other months', () => {
    const rows = buildReportRows(
      [makeTx({ id: '1', type: 'expense', amount: 1000, date: '2026-07-01' })],
      [account],
      categories,
      '2026-08',
      [],
    )
    expect(rows).toEqual([])
  })
})
