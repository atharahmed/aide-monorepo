import { useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { Logo } from '@/components/logo'
import { searchString } from '@/lib/search'

/**
 * OAuth trampoline. Providers redirect here; we forward `code` and `state`
 * straight to the integration page, which completes the handshake. It exists
 * only because the redirect URI registered with each provider is fixed.
 */
export const Route = createFileRoute('/auth/$slug')({
  validateSearch: (search: Record<string, unknown>) => ({
    code: searchString(search.code),
    state: searchString(search.state),
  }),
  component: OAuthTrampoline,
})

function OAuthTrampoline() {
  const { slug } = Route.useParams()
  const { code, state } = Route.useSearch()
  const navigate = useNavigate()

  useEffect(() => {
    navigate({
      to: '/integrations/$slug',
      params: { slug },
      search: { code, state },
      replace: true,
    })
  }, [slug, code, state, navigate])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3">
      <Logo className="size-6" />
      <p className="flex items-center gap-2 text-[13px] text-gray-500">
        <Loader2 className="size-4 animate-spin text-gray-400" />
        Finishing the {slug} connection…
      </p>
    </div>
  )
}
