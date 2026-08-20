import { describe, expect, it, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Input, Textarea } from './Input'
import { Select } from './Select'

describe('Input', () => {
  afterEach(cleanup)

  it('renders a label associated with the input', () => {
    render(<Input label="Email" placeholder="nama@email.com" />)
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
  })

  it('renders an error message and error border', () => {
    render(<Input label="Email" error="Email wajib diisi" />)
    expect(screen.getByText('Email wajib diisi')).toBeInTheDocument()
    expect(screen.getByLabelText(/^Email/)).toHaveClass('border-bad')
  })
})

describe('Textarea', () => {
  afterEach(cleanup)

  it('renders a label associated with the textarea', () => {
    render(<Textarea label="Catatan" />)
    expect(screen.getByLabelText('Catatan')).toBeInTheDocument()
  })
})

describe('Select', () => {
  afterEach(cleanup)

  it('renders a label associated with the select', () => {
    render(
      <Select label="Akun">
        <option>Kas</option>
      </Select>,
    )
    expect(screen.getByLabelText('Akun')).toBeInTheDocument()
  })
})