import clsx from 'clsx'
import { CheckCircle2, XCircle } from 'lucide-react'
import { type ReactNode, useCallback, useState } from 'react'

import { ToastContext, type ToastKind } from '../lib/toast'

interface ToastItem {
  id: number
  kind: ToastKind
  text: string
}

/** Short notifications in the corner: "Saved", "This property is already reserved", etc. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const show = useCallback((kind: ToastKind, text: string) => {
    const id = Date.now() + Math.random()
    setItems((current) => [...current, { id, kind, text }])
    setTimeout(() => setItems((current) => current.filter((item) => item.id !== id)), 4000)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2"
        aria-live="polite"
      >
        {items.map((item) => (
          <div
            key={item.id}
            className={clsx(
              'pointer-events-auto flex items-start gap-2 rounded-lg border bg-white px-3 py-2.5 text-sm shadow-lg',
              item.kind === 'success' ? 'border-green-200 text-green-800' : 'border-red-200 text-red-700',
            )}
          >
            {item.kind === 'success' ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            ) : (
              <XCircle className="mt-0.5 size-4 shrink-0" />
            )}
            {item.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
