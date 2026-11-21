import { Outlet } from 'react-router'
import { Sidebar } from '#components/layout/Sidebar'
import { Topbar } from '#components/layout/Topbar'
import { UploadsProvider } from '#components/UploadsProvider'

export function AppLayout() {
  return (
    <UploadsProvider>
      <div className="flex min-h-svh flex-col bg-background">
        <Topbar />
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <Sidebar />
          <main className="flex min-w-0 flex-1 flex-col gap-6 p-4 md:p-8">
            <Outlet />
          </main>
        </div>
      </div>
    </UploadsProvider>
  )
}
