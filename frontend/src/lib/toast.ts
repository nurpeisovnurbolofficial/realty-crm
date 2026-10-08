import { createContext, useContext } from 'react'

export type ToastKind = 'success' | 'error'

export const ToastContext = createContext<(kind: ToastKind, text: string) => void>(() => {})

/** Show a short notification: toast('success', 'Saved'). */
export const useToast = () => useContext(ToastContext)
