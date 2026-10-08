import { createContext, useContext } from 'react'

import type { User } from '../api/types'

export interface AuthValue {
  user: User | null
  isLoading: boolean
  login: (username: string, password: string) => Promise<User>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthValue | null>(null)

export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
