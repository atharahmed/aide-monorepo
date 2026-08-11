import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { ApiError, USE_MOCKS } from './lib/api'
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

const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

async function bootstrap() {
  /* Phase 1 runs entirely on the mock API. Setting VITE_USE_MOCKS=false skips
   * this and the same requests go to the real backend. */
  if (USE_MOCKS) {
    try {
      const { startMockServer } = await import('./mocks/browser')
      await startMockServer()
    } catch (error) {
      /* A missing service worker should not blank the page — render anyway and
       * let the failing requests surface in the UI's error states. */
      console.error('[aide] mock API failed to start', error)
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
}

void bootstrap()
