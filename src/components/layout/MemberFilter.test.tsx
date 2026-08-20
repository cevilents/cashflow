import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemberFilter } from './MemberFilter'
import type { Member } from '../../lib/members'

const members: Member[] = [
  { id: 'member-a', name: 'Bima', email: 'bima@example.com', color: '#10b981', icon: 'face' },
  { id: 'member-b', name: 'Aska', email: 'aska@example.com', color: '#6366f1', icon: 'face' },
]

const mocks = vi.hoisted(() => ({ useMembers: vi.fn() }))

vi.mock('../../hooks/useMembers', () => ({
  useMembers: mocks.useMembers,
}))

function renderFilter(value = 'all') {
  const onChange = vi.fn()
  const utils = render(<MemberFilter value={value} onChange={onChange} />)
  return { onChange, ...utils }
}

describe('MemberFilter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.useMembers.mockReturnValue({ data: members })
  })

  afterEach(cleanup)

  it('renders Semua plus one button per member', () => {
    renderFilter()
    expect(screen.getByRole('button', { name: 'Semua' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Bima' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Aska' })).toBeInTheDocument()
  })

  it('calls onChange with the member id when a member button is clicked', () => {
    const { onChange } = renderFilter()
    fireEvent.click(screen.getByRole('button', { name: 'Bima' }))
    expect(onChange).toHaveBeenCalledWith('member-a')
  })

  it('calls onChange with all when Semua is clicked', () => {
    const { onChange } = renderFilter('member-a')
    fireEvent.click(screen.getByRole('button', { name: 'Semua' }))
    expect(onChange).toHaveBeenCalledWith('all')
  })

  it('highlights the currently selected option', () => {
    renderFilter('member-b')
    const selected = screen.getByRole('button', { name: 'Aska' })
    const unselected = screen.getByRole('button', { name: 'Semua' })
    expect(selected.className).toContain('bg-good')
    expect(unselected.className).toContain('bg-surface-soft')
  })
})
