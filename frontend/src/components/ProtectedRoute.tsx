import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '#hooks/useAuth'

export function ProtectedRoute() {
  const { status } = useAuth()
  const location = useLocation()

  if (status !== 'authenticated') {
    const target = `${location.pathname}${location.search}${location.hash}`
    const redirect = target === '/' ? '' : `?redirect=${encodeURIComponent(target)}`
    return <Navigate to={`/login${redirect}`} replace />
  }

  return <Outlet />
}
