import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi } from 'vitest'

export interface QueryChain {
  select: ReturnType<typeof vi.fn>
  order: ReturnType<typeof vi.fn>
  eq: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  maybeSingle: ReturnType<typeof vi.fn>
  upsert: ReturnType<typeof vi.fn>
}

export function makeQueryChain(): QueryChain {
  const chain = {} as QueryChain
  const self = () => chain
  chain.select = vi.fn(self)
  chain.order = vi.fn(self)
  chain.eq = vi.fn(self)
  chain.insert = vi.fn()
  chain.update = vi.fn(self)
  chain.delete = vi.fn(self)
  chain.maybeSingle = vi.fn()
  chain.upsert = vi.fn()
  return chain
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
}

export function renderQueryHook<T>(hook: () => T, client = createQueryClient()) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return { ...renderHook(hook, { wrapper }), client }
}