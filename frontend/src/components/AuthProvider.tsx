import { useEffect, useState, type ReactNode } from 'react'
import * as authApi from '#api/auth'
import type { AuthUser, LoginPayload } from '#api/auth'
import { AuthContext, type AuthStatus } from '#hooks/useAuth'
import { AUTH_LOGOUT_EVENT } from '#lib/api-client'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [status, setStatus] = useState<AuthStatus>('loading')

  useEffect(() => {
    authApi
      .getMe()
      .then((currentUser) => {
        setUser(currentUser)
        setStatus('authenticated')
      })
      .catch(() => setStatus('unauthenticated'))
  }, [])

  useEffect(() => {
    function handleLogout() {
      setUser(null)
      setStatus('unauthenticated')
    }
    window.addEventListener(AUTH_LOGOUT_EVENT, handleLogout)
    return () => window.removeEventListener(AUTH_LOGOUT_EVENT, handleLogout)
  }, [])

  async function login(payload: LoginPayload) {
    await authApi.login(payload)
    setUser(await authApi.getMe())
    setStatus('authenticated')
  }

  async function logout() {
    setUser(null)
    setStatus('unauthenticated')
    await authApi.logout().catch(() => {})
  }

  return <AuthContext.Provider value={{ user, status, login, logout }}>{children}</AuthContext.Provider>
}
