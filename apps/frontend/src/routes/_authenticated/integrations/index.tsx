import { Link, createFileRoute } from '@tanstack/react-router'
import { Check, ChevronRight } from 'lucide-react'
import { PageBody, PageHeader } from '@/components/page-header'
import { Badge, StatusDot } from '@/components/ui/badge'
import { IntegrationGlyph } from '@/components/integration-glyph'
import { useMe } from '@/lib/queries'
import { integrationCatalog, integrationGroups } from '@/features/integrations/catalog'

export const Route = createFileRoute('/_authenticated/integrations/')({
  component: IntegrationsPage,
})

function IntegrationsPage() {
  const { data: user } = useMe()
  const active = user?.team?.activeIntegrations ?? []
  const connectedCount = active.length

  return (
    <>
      <PageHeader
        title="Integrations"
        description="Where Aide reads conversations and customer data from."
        meta={
          connectedCount > 0 && (
            <Badge variant="success">
              <StatusDot />
              {connectedCount} connected
            </Badge>
          )
        }
      />

      <PageBody className="flex flex-col gap-8">
        {integrationGroups.map((group) => (
          <section key={group}>
            <h2 className="mb-3 text-[17px] font-medium text-gray-950">{group}</h2>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {integrationCatalog
                .filter((integration) => integration.group === group)
                .map((integration) => {
                  const connected = active.some((entry) => entry.name === integration.slug)

                  return (
                    <Link
                      key={integration.slug}
                      to="/integrations/$slug"
                      params={{ slug: integration.slug }}
                      className="group flex flex-col rounded-[8px] border border-gray-200 bg-white p-4 transition-colors hover:border-gray-300"
                    >
                      <div className="flex items-start gap-3">
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-[8px] border border-gray-200 bg-gray-50">
                          <IntegrationGlyph slug={integration.slug} />
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-[13.5px] font-medium text-gray-950">
                              {integration.name}
                            </span>
                            {connected && (
                              <Badge variant="success">
                                <Check className="size-3" />
                                Connected
                              </Badge>
                            )}
                          </span>
                          <span className="mt-1 block text-[12.5px] leading-relaxed text-gray-500">
                            {integration.summary}
                          </span>
                        </span>

                        <ChevronRight className="mt-1 size-4 shrink-0 text-gray-300 transition-colors group-hover:text-gray-500" />
                      </div>
                    </Link>
                  )
                })}
            </div>
          </section>
        ))}
      </PageBody>
    </>
  )
}
