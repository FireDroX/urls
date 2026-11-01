import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { describe, expect, it } from 'vitest'
import { AuthContext, type AuthContextValue, type AuthStatus } from '#hooks/useAuth'
import { ProtectedRoute } from './ProtectedRoute'

function LoginProbe() {
  const location = useLocation()
  return <p>login{location.search}</p>
}

function renderAt(path: string, status: AuthStatus) {
  const auth: AuthContextValue = {
    user: status === 'authenticated' ? { email: 'me@example.org' } : null,
    status,
    login: async () => {},
    logout: async () => {},
  }
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/login" element={<LoginProbe />} />
          <Route element={<ProtectedRoute />}>
            <Route path="*" element={<p>dashboard</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('ProtectedRoute', () => {
  it('renders the page for an authenticated user', () => {
    renderAt('/account', 'authenticated')

    expect(screen.getByText('dashboard')).toBeInTheDocument()
  })

  it('sends an anonymous visitor to the login page, remembering where they were going', () => {
    renderAt('/account?tab=security', 'unauthenticated')

    expect(screen.getByText('login?redirect=%2Faccount%3Ftab%3Dsecurity')).toBeInTheDocument()
  })

  it('adds no redirect for the home page', () => {
    renderAt('/', 'unauthenticated')

    expect(screen.getByText('login')).toBeInTheDocument()
  })
})
