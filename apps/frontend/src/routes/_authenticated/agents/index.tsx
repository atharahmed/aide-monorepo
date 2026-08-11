import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { ChevronRight, Loader2, Plus, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { PageBody, PageHeader } from '@/components/page-header'
import { EmptyState, ErrorState } from '@/components/empty-state'
import { Sparkline } from '@/components/data-viz'
import { Badge, StatusDot } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAgents, useCreateAgent } from '@/lib/queries'
import { formatRelative } from '@/lib/format'
import type { Agent } from '@/types/api'

export const Route = createFileRoute('/_authenticated/agents/')({
  component: AgentsPage,
})

export function AgentStatusBadge({ status }: { status: Agent['status'] }) {
  if (status === 'deployed') {
    return (
      <Badge variant="success">
        <StatusDot />
        Deployed
      </Badge>
    )
  }
  if (status === 'paused') {
    return (
      <Badge variant="warning">
        <StatusDot />
        Paused
      </Badge>
    )
  }
  return <Badge variant="neutral">Draft</Badge>
}

const CHANNEL_LABELS: Record<string, string> = {
  website: 'Website',
  helpdesk: 'Helpdesk',
  email: 'Email',
}

function AgentsPage() {
  const navigate = useNavigate()
  const { data: agents, isLoading, isError, refetch } = useAgents()
  const createAgent = useCreateAgent()

  const create = () =>
    createAgent.mutate(
      { name: 'Untitled agent' },
      {
        onSuccess: (agent) => {
          navigate({ to: '/agents/$agentId', params: { agentId: String(agent.id) } })
          toast.success('Agent created')
        },
      }
    )

  return (
    <>
      <PageHeader
        title="Agents"
        description="AI agents that answer customers on their own, on the channels you choose."
        actions={
          <Button size="sm" onClick={create} disabled={createAgent.isPending}>
            {createAgent.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
            New agent
          </Button>
        }
      />

      <PageBody>
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 2 }).map((_, index) => (
              <Skeleton key={index} className="h-[84px]" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState
            title="Could not load your agents"
            action={
              <Button size="sm" onClick={() => refetch()}>
                Try again
              </Button>
            }
          />
        ) : (agents ?? []).length === 0 ? (
          <EmptyState
            icon={<Sparkles className="size-4" />}
            title="No agents yet"
            description="An agent uses your knowledge and scenarios to answer customers directly. Start in draft — nothing goes live until you deploy it."
            action={
              <Button onClick={create} disabled={createAgent.isPending}>
                {createAgent.isPending && <Loader2 className="animate-spin" />}
                Create your first agent
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-3">
            {(agents ?? []).map((agent) => {
              const channels = agent.channels.filter((channel) => channel.enabled)
              const weekTotal = agent.interactions_7d.reduce((sum, value) => sum + value, 0)

              return (
                <Link
                  key={agent.id}
                  to="/agents/$agentId"
                  params={{ agentId: String(agent.id) }}
                  className="group flex items-center gap-4 rounded-[8px] border border-gray-200 bg-white p-4 transition-colors hover:border-gray-300"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-[8px] border border-gray-200 bg-gray-50">
                    <Sparkles className="size-4 text-gray-500" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[13.5px] font-medium text-gray-950">
                        {agent.name}
                      </span>
                      <AgentStatusBadge status={agent.status} />
                    </span>
                    <span className="mt-1 block truncate text-[12.5px] text-gray-500">
                      {agent.description || 'No description yet'}
                    </span>
                  </span>

                  <span className="hidden shrink-0 items-center gap-1.5 md:flex">
                    {channels.length > 0 ? (
                      channels.map((channel) => (
                        <Badge key={channel.slug} variant="neutral">
                          {CHANNEL_LABELS[channel.slug]}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-[12px] text-gray-400">No channels</span>
                    )}
                  </span>

                  <span className="hidden w-[130px] shrink-0 items-center gap-2 lg:flex">
                    <Sparkline points={agent.interactions_7d} />
                    <span className="text-[12px] text-gray-400 tabular-nums">{weekTotal}</span>
                  </span>

                  <span className="hidden w-[110px] shrink-0 text-right text-[12px] text-gray-400 xl:block">
                    {formatRelative(agent.last_active_at)}
                  </span>

                  <ChevronRight className="size-4 shrink-0 text-gray-300 transition-colors group-hover:text-gray-500" />
                </Link>
              )
            })}
          </div>
        )}
      </PageBody>
    </>
  )
}
