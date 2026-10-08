import { useQueryClient } from '@tanstack/react-query'
import { type ReactNode, useCallback, useEffect } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'

import { api, setSessionExpiredHandler } from '../api/client'
import { keys, useMe } from '../api/hooks'
import type { User } from '../api/types'
import { Spinner } from '../components/ui'
import { AuthContext, useAuth } from './context'

/**
 * Who is logged in. The source of truth is GET /api/auth/me/:
 * if the httpOnly cookie is valid, the server returns the user; otherwise 401.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const me = useMe()

  useEffect(() => {
    setSessionExpiredHandler(() => {
      queryClient.setQueryData(keys.me, null)
      navigate('/login')
    })
  }, [queryClient, navigate])

  const login = useCallback(
    async (username: string, password: string) => {
      const user = await api<User>('/api/auth/login/', { method: 'POST', body: { username, password } })
      queryClient.clear() // data of the previous user must not leak into the new session
      queryClient.setQueryData(keys.me, user)
      return user
    },
    [queryClient],
  )

  const logout = useCallback(async () => {
    await api<void>('/api/auth/logout/', { method: 'POST' })
    queryClient.clear()
    queryClient.setQueryData(keys.me, null)
    navigate('/login')
  }, [queryClient, navigate])

  return (
    <AuthContext.Provider value={{ user: me.data ?? null, isLoading: me.isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

/** Wraps private pages: sends guests to /login and remembers where they wanted to go. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth()
  const location = useLocation()
  if (isLoading) return <Spinner className="min-h-screen" />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return children
}
