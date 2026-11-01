import { Navigate, Route, Routes } from 'react-router'
import { AppLayout } from '#components/layout/AppLayout'
import { AppLayoutSkeleton } from '#components/layout/AppLayoutSkeleton'
import { ProtectedRoute } from '#components/ProtectedRoute'
import { useAuth } from '#hooks/useAuth'
import { Dashboard } from '#pages/Dashboard'
import { Login } from '#pages/Login'
import { NotFound } from '#pages/NotFound'
import { Settings } from '#pages/Settings'

export function App() {
  const { status } = useAuth()

  if (status === 'loading') {
    return <AppLayoutSkeleton />
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/account" element={<Navigate to="/settings" replace />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
