import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { AppLayout } from '#components/layout/AppLayout'
import { AppLayoutSkeleton } from '#components/layout/AppLayoutSkeleton'
import { ProtectedRoute } from '#components/ProtectedRoute'
import { Skeleton } from '#components/ui/skeleton'
import { useAuth } from '#hooks/useAuth'
import { Dashboard } from '#pages/Dashboard'
import { Login } from '#pages/Login'
import { NotFound } from '#pages/NotFound'
import { Redirects } from '#pages/Redirects'
import { RedirectUnavailable } from '#pages/RedirectUnavailable'
import { Settings } from '#pages/Settings'
import { ShareDetail } from '#pages/ShareDetail'
import { ShareDownload } from '#pages/ShareDownload'
import { Files } from '#pages/Files'
import { Shares } from '#pages/Shares'

const RedirectDetail = lazy(() =>
  import('#pages/RedirectDetail').then(({ RedirectDetail }) => ({ default: RedirectDetail })),
)

export function App() {
  const { status } = useAuth()

  if (status === 'loading') {
    return <AppLayoutSkeleton />
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/r/:id" element={<RedirectUnavailable />} />
      <Route path="/d/:id" element={<ShareDownload />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="/redirects" element={<Redirects />} />
          <Route
            path="/redirects/:id"
            element={
              <Suspense fallback={<Skeleton className="h-72 w-full" />}>
                <RedirectDetail />
              </Suspense>
            }
          />
          <Route path="/shares" element={<Shares />} />
          <Route path="/shares/:id" element={<ShareDetail />} />
          <Route path="/files" element={<Files />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/account" element={<Navigate to="/settings" replace />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
