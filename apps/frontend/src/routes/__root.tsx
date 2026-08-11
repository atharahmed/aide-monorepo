import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { EmptyState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'
import { Link } from '@tanstack/react-router'
import { FileQuestion } from 'lucide-react'

export interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFound,
})

function RootLayout() {
  return (
    <TooltipProvider delayDuration={200}>
      <Outlet />
      <Toaster />
    </TooltipProvider>
  )
}

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <EmptyState
        className="max-w-md"
        icon={<FileQuestion className="size-4" />}
        title="Page not found"
        description="That link does not point anywhere in Aide. It may have moved."
        action={
          <Button asChild>
            <Link to="/home">Go to Home</Link>
          </Button>
        }
      />
    </div>
  )
}
