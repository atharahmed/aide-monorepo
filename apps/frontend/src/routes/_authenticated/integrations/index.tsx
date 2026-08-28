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

      <PageBody className="flex flex-col gap-12 max-w-6xl mx-auto bg-white">
        {integrationGroups.map((group) => (
          <section key={group}>
            <h2 className="mb-3 text-[19px] font-medium text-gray-950">{group}</h2>

            <div className="grid gap-7 sm:grid-cols-2 xl:grid-cols-4">
              {integrationCatalog
                .filter((integration) => integration.group === group)
                .map((integration) => {
                  const connected = active.some((entry) => entry.name === integration.slug)

                  return (
                    <Link
                      key={integration.slug}
                      to="/integrations/$slug"
                      params={{ slug: integration.slug }}
                      className="group flex flex-col rounded-[24px] bg-black/2 p-4 py-6 transition-colors hover:bg-black/3 w-fit"
                    >
                      <div className="flex flex-row items-center">
                      <div className="flex flex-col items-center gap-3 ">
                        <span className="flex size-12 shrink-0 items-center justify-center rounded-[14px] border border-black/5 bg-white">
                          <IntegrationGlyph slug={integration.slug} />
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="flex justify-center gap-2">
                            <span className="truncate text-[16px] font-medium text-gray-950">
                              {integration.name}
                            </span>
                        
                          </span>
                 
                          <span className="mt-1 block text-[12.5px] leading-relaxed tracking-[0.01em] text-gray-400 text-center">
                            {integration.summary}
                          </span>
                        </span>
                        <span className="flex justify-center">
                          {connected && (
                              <Badge variant="success">
                                <Check className="size-3" />
                                Connected
                              </Badge>
                            )}
                            </span>

                      </div>
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
