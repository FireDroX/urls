import { Skeleton } from '#components/ui/skeleton'

export function AppLayoutSkeleton() {
  return (
    <div className="flex min-h-svh flex-col bg-background" aria-busy="true">
      <div className="flex h-14 items-center border-b border-border px-4">
        <Skeleton className="h-7 w-32" />
      </div>
      <div className="flex flex-1 flex-col md:flex-row">
        <div className="hidden w-64 border-r border-sidebar-border bg-sidebar p-3 md:block">
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="flex-1 p-4 md:p-8">
          <Skeleton className="h-8 w-48" />
        </div>
      </div>
    </div>
  )
}
