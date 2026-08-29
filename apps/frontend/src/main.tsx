import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  RouterProvider,
  createRouter,
  parseSearchWith,
  stringifySearchWith,
} from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { ApiError } from './lib/api'
import { AnimatedLogo } from './components/logo'
import './styles.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        /* Never retry a client error — it will fail the same way again. */
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false
        return failureCount < 2
      },
    },
  },
})

/**
 * Shown while a route loader waits on the API. The v5 API is slow enough that
 * several pages block for seconds — `/me` alone is megabytes — and a router
 * with no pending component renders nothing at all, which reads as a broken
 * page rather than a loading one.
 */
function PageLoader() {
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-gray-50">
      <AnimatedLogo size={34} />
    </div>
  )
}

const router = createRouter({
  routeTree,
  context: { queryClient },
  /* Drop the default serializer's parser argument. With it, any string that
   * looks like JSON is re-encoded on the way out, so a record id lands in the
   * URL as `?ticket=%2231648257%22` instead of `?ticket=31648257`. Values are
   * coerced back to the type each route wants — see `lib/search.ts`. */
  parseSearch: parseSearchWith(JSON.parse),
  stringifySearch: stringifySearchWith(JSON.stringify),
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
  /* Route loaders wait on a slow API — `/me` can take seconds. Without a
   * pending component the router renders nothing at all while they run, which
   * looks like a broken page rather than a loading one. */
  defaultPendingComponent: PageLoader,
  /* Show it almost immediately (the default is a full second), but once shown
   * hold it long enough not to strobe on a fast response. */
  defaultPendingMs: 150,
  defaultPendingMinMs: 400,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootElement = document.getElementById('app')!

ReactDOM.createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>
)
