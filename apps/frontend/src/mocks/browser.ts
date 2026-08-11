import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

export const worker = setupWorker(...handlers)

/**
 * Starts the mock API. Phase 2 flips `VITE_USE_MOCKS=false` and this is skipped
 * entirely — see `src/lib/api.ts`, which already talks to the real paths.
 */
export async function startMockServer() {
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: true,
    serviceWorker: { url: '/mockServiceWorker.js' },
  })
}
