import { createContext, useContext } from 'react'

export interface ConfirmOptions {
  title: string
  text?: string
  confirmLabel?: string
}

export const ConfirmContext = createContext<(options: ConfirmOptions) => Promise<boolean>>(() => Promise.resolve(false))

/** `if (await confirm({ title: 'Delete?' })) …` — a styled, translated replacement for window.confirm. */
export const useConfirm = () => useContext(ConfirmContext)
