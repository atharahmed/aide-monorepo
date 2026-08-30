import { useMemo, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { PageBody, PageHeader } from '@/components/page-header'
import { EmptyState } from '@/components/empty-state'
import { Badge, StatusDot } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { IntegrationGlyph } from '@/components/integration-glyph'
import { useMe } from '@/lib/queries'
import { integrationCatalog, integrationGroups } from '@/features/integrations/catalog'

const CATEGORY_TABS = [
  { label: 'All', value: 'all' },
  { label: 'Helpdesk', value: 'Helpdesk' },
  { label: 'Ecommerce', value: 'E-commerce' },
  { label: 'CRM', value: 'Contacts' },
] as const

type CategoryFilter = (typeof CATEGORY_TABS)[number]['value']

export const Route = createFileRoute('/_authenticated/integrations/')({
  component: IntegrationsPage,
})

function IntegrationsPage() {
  const { data: user } = useMe()
  const active = user?.team?.activeIntegrations ?? []
  const connectedCount = active.length
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const name = query.trim().toLowerCase()

    return integrationCatalog.filter((integration) => {
      if (category !== 'all' && integration.group !== category) return false
      if (name && !integration.name.toLowerCase().includes(name)) return false
      return true
    })
  }, [category, query])

  const visibleGroups = integrationGroups.filter((group) =>
    filtered.some((integration) => integration.group === group)
  )

  return (
    <>
      <PageHeader
        title="Integrations"
        description="Where Aide reads conversations and customer data from"
        meta={
          connectedCount > 0 && (
            <Badge variant="success">
              <StatusDot />
              {connectedCount} connected
            </Badge>
          )
        }
      />

      <PageBody className="mx-auto flex w-5xl flex-col bg-white">
        <div className="mb-8 flex flex-wrap items-center justify-start gap-3">
        <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-gray-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name"
              aria-label="Search integrations by name"
              className="h-7 w-52 pl-8 text-[12.5px]"
            />
          </div>
          <Tabs
            value={category}
            onValueChange={(value) => {
              const next = CATEGORY_TABS.find((tab) => tab.value === value)
              if (next) setCategory(next.value)
            }}
          >
            <TabsList className="mb-0">
              {CATEGORY_TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

      
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            title="No integrations match"
            description="Try a different name or category."
          />
        ) : (
          <div className="flex flex-col gap-12">
            {visibleGroups.map((group) => (
              <section key={group}>
                {category === 'all' && (
                  <h2 className="mb-3 text-[19px] font-medium text-gray-950">
                    {CATEGORY_TABS.find((tab) => tab.value === group)?.label ?? group}
                  </h2>
                )}

                <div className="grid gap-7 sm:grid-cols-2 xl:grid-cols-4">
                  {filtered
                    .filter((integration) => integration.group === group)
                    .map((integration) => {
                      const connected = active.some((entry) => entry.name === integration.slug)

                      return (
                        <Link
                          key={integration.slug}
                          to="/integrations/$slug"
                          params={{ slug: integration.slug }}
                          className="flex w-fit flex-col rounded-[20px] border border-black/8 bg-white p-4 py-4 transition-colors hover:border-black/12 shadow-light"
                        >
                          <div className="flex flex-col items-center gap-3">
                            <span className="flex size-12 shrink-0 items-center justify-center rounded-[14px] border border-black/3 bg-white">
                              <IntegrationGlyph slug={integration.slug} />
                            </span>

                            <span className="min-w-0 flex-1">
                              <span className="flex justify-center gap-2">
                                <span className="truncate text-[15px] font-medium text-gray-950">
                                  {integration.name}
                                </span>
                              </span>

                              <span className="mt-1 block text-center text-[12px] tracking-[0.01em] text-gray-400">
                                {integration.summary}
                              </span>
                            </span>

                            <Button
                              variant={connected ? 'outline' : 'outline'}
                              size="sm"
                              className={
                                connected
                                  ? 'border-transparent bg-success-50 text-success-700 hover:bg-success-100'
                                  : undefined
                              }
                              asChild
                            >
                              <span>
                                {connected && <StatusDot />}
                                {connected ? 'Connected' : 'Connect'}
                              </span>
                            </Button>
                          </div>
                        </Link>
                      )
                    })}
                </div>
              </section>
            ))}
          </div>
        )}
      </PageBody>
    </>
  )
}
