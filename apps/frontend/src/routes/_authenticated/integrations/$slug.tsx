import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, CheckCircle2, ExternalLink, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { api, ApiError } from '@/lib/api'
import { PageBody, PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { Badge, StatusDot } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { IntegrationGlyph } from '@/components/integration-glyph'
import { findIntegration } from '@/features/integrations/catalog'
import { queryKeys, useMe } from '@/lib/queries'
import { searchString } from '@/lib/search'

interface IntegrationSearch {
  code?: string
  state?: string
  /** Providers that identify the account on the return URL, e.g. Shopify's `shop`. */
  shop?: string
}

export const Route = createFileRoute('/_authenticated/integrations/$slug')({
  validateSearch: (search: Record<string, unknown>): IntegrationSearch => ({
    code: searchString(search.code),
    state: searchString(search.state),
    shop: searchString(search.shop),
  }),
  component: IntegrationDetailPage,
})

function IntegrationDetailPage() {
  const { slug } = Route.useParams()
  const search = Route.useSearch()
  const { code, state } = search
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: user } = useMe()

  const integration = findIntegration(slug)
  const connected = (user?.team?.activeIntegrations ?? []).some((entry) => entry.name === slug)

  const [fieldValue, setFieldValue] = useState('')
  const autoStarted = useRef(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()
  const [completing, setCompleting] = useState(Boolean(code))

  /**
   * Kicks off the OAuth round-trip. The endpoint answers with the provider URL
   * as a bare text body rather than JSON, so the response is used as-is.
   */
  const startConnect = useCallback(
    async (extra: Record<string, string> = {}) => {
      if (!integration) return
      setPending(true)
      setError(undefined)
      try {
        const url = await api.post<string>(`/v1/integrations/${slug}`, {
          ...(integration.field ? { [integration.field.key]: fieldValue } : {}),
          ...extra,
        })
        window.location.href = url
      } catch (caught) {
        setError(
          caught instanceof ApiError ? caught.displayMessage : 'Could not start the connection.'
        )
        setPending(false)
      }
    },
    [integration, slug, fieldValue]
  )

  /* Shopify-style returns carry the store identity instead of an OAuth code, so
   * the redirect has to be requested with those params rather than from a form. */
  useEffect(() => {
    if (code || connected || autoStarted.current) return

    const keys = integration?.queryKeys
    if (!keys?.length) return

    const values = keys.map((key) => search[key as keyof IntegrationSearch])
    if (values.some((value) => !value)) return

    autoStarted.current = true
    void startConnect(Object.fromEntries(keys.map((key, index) => [key, values[index] as string])))
  }, [code, connected, integration, search, startConnect])

  /* Coming back from the provider: finish the handshake, then clean the URL. */
  useEffect(() => {
    if (!code || !integration) return
    let cancelled = false

    const complete = async () => {
      try {
        await api.post(integration.connectPath ?? `/v1/integrations/${slug}/connect`, {
          code,
          state,
        })
        if (cancelled) return

        await queryClient.invalidateQueries({ queryKey: queryKeys.me })
        toast.success(`${integration.name} connected`)

        if (integration.successRedirect === '/integrations/front/inboxes') {
          navigate({ to: '/integrations/front/inboxes', replace: true })
          return
        }
        navigate({ to: '/integrations/$slug', params: { slug }, search: {}, replace: true })
      } catch (caught) {
        if (cancelled) return
        setError(
          caught instanceof ApiError
            ? caught.displayMessage
            : 'The connection could not be completed. Try again.'
        )
      } finally {
        if (!cancelled) setCompleting(false)
      }
    }

    void complete()
    return () => {
      cancelled = true
    }
  }, [code, state, slug, integration, navigate, queryClient])

  if (!integration) {
    return (
      <>
        <PageHeader title="Integration not found" />
        <PageBody>
          <EmptyState
            title={`Aide has no integration called “${slug}”`}
            description="Check the link, or pick one from the catalog."
            action={
              <Button asChild>
                <Link to="/integrations">Back to integrations</Link>
              </Button>
            }
          />
        </PageBody>
      </>
    )
  }

  const fieldPreview = integration.field
    ? integration.field.template.replace('{}', fieldValue || '…')
    : undefined

  return (
    <>
      <PageHeader
        title={integration.name}
        description={integration.summary}
        meta={
          connected && (
            <Badge variant="success">
              <StatusDot />
              Connected
            </Badge>
          )
        }
        actions={
          <Button variant="ghost" size="sm" asChild>
            <Link to="/integrations">
              <ArrowLeft />
              All integrations
            </Link>
          </Button>
        }
      />

      <PageBody className="max-w-2xl">
        <div className="flex items-start gap-4 rounded-[8px] border border-gray-200 bg-white p-5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-[8px] border border-gray-200 bg-gray-50">
            <IntegrationGlyph slug={integration.slug} className="size-6" />
          </span>

          <div className="min-w-0 flex-1">
            {completing ? (
              <p className="flex items-center gap-2 text-[13px] text-gray-600">
                <Loader2 className="size-4 animate-spin text-gray-400" />
                Finishing the connection…
              </p>
            ) : connected ? (
              <>
                <p className="flex items-center gap-2 text-[13.5px] font-medium text-gray-950">
                  <CheckCircle2 className="size-4 text-success-600" />
                  {integration.name} is connected
                </p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-gray-500">
                  Aide is reading from it now. New conversations appear within a few minutes.
                </p>
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/conversations">See conversations</Link>
                  </Button>
                  {integration.successRedirect === '/integrations/front/inboxes' && (
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/integrations/front/inboxes">Choose inboxes</Link>
                    </Button>
                  )}
                </div>
              </>
            ) : integration.externalInstallUrl ? (
              <>
                <p className="text-[13.5px] font-medium text-gray-950">
                  Install from the {integration.name} app store
                </p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-gray-500">
                  {integration.name} connections start on their side. You will be sent back here
                  once it is installed.
                </p>
                <Button size="sm" className="mt-4" asChild>
                  <a
                    href={integration.externalInstallUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open the {integration.name} app store
                    <ExternalLink />
                  </a>
                </Button>
              </>
            ) : (
              <>
                {integration.field && (
                  <div className="mb-4">
                    <Label htmlFor="integration-field">{integration.field.label}</Label>
                    <Input
                      id="integration-field"
                      value={fieldValue}
                      onChange={(event) => setFieldValue(event.target.value)}
                      placeholder={integration.field.placeholder}
                      className="mt-1.5"
                    />
                    <p className="mt-1.5 text-[12px] text-gray-400">{fieldPreview}</p>
                  </div>
                )}

                {error && <p className="mb-3 text-[12.5px] text-destructive-600">{error}</p>}

                <Button
                  size="sm"
                  onClick={() => startConnect()}
                  disabled={pending || (Boolean(integration.field) && !fieldValue.trim())}
                >
                  {pending && <Loader2 className="animate-spin" />}
                  Connect {integration.name}
                </Button>
              </>
            )}
          </div>
        </div>

        <Separator className="my-6" />

        <section>
          <h2 className="mb-3 text-[17px] font-medium text-gray-950">What Aide reads</h2>
          <ul className="flex flex-col gap-1.5">
            {integration.reads.map((item) => (
              <li key={item} className="flex items-start gap-2 text-[13px] text-gray-700">
                <Check className="mt-0.5 size-3.5 shrink-0 text-gray-400" />
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[12.5px] leading-relaxed text-gray-400">
            Aide never writes to {integration.name} unless a scenario or agent you switched on tells
            it to.
          </p>
        </section>
      </PageBody>
    </>
  )
}
