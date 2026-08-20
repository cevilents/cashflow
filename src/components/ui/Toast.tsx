import { createContext, useCallback, useContext, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { CheckCircle2, Info, XCircle } from 'lucide-react'
import { Spinner } from './Spinner'

export type ToastType = 'success' | 'error' | 'info' | 'loading'

interface ToastItem {
  id: number
  message: string
  type: ToastType
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const counter = useRef(0)

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++counter.current
    setItems((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id))
    }, 3500)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        className="fixed top-4 right-4 z-[100] flex max-w-sm flex-col gap-2"
        aria-live="polite"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className="flex items-center gap-2 rounded-xl border border-border-subtle bg-surface-card px-4 py-3 text-sm shadow-lg"
          >
            {t.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-good" />
            ) : t.type === 'error' ? (
              <XCircle className="h-5 w-5 shrink-0 text-bad" />
            ) : t.type === 'info' ? (
              <Info className="h-5 w-5 shrink-0 text-move" />
            ) : (
              <Spinner size={18} />
            )}
            <span className="text-ink">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}