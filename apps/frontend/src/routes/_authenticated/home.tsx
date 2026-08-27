import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowUpRight, Inbox, Sparkles, Tag, Zap } from 'lucide-react'
import { PageBody, PageHeader } from '@/components/page-header'
import { StatTile } from '@/components/data-viz'
import { Badge, StatusDot } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { OnboardingActionBoxes, OnboardingReminders } from '@/features/onboarding/components'
import { getOnboardingActions } from '@/features/onboarding/actions'
import { useAgents, useMe, useReportSummary } from '@/lib/queries'
import { formatRelative } from '@/lib/format'

export const Route = createFileRoute('/_authenticated/home')({
  component: HomePage,
})

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function HomePage() {
  const { data: user } = useMe()
  const firstName = user?.name?.split(' ')[0] ?? ''

  const until = Math.floor(Date.now() / 1000)
  const since = until - 7 * 86_400
  const { data: summary, isLoading } = useReportSummary(since, until)
  const { data: agents } = useAgents()

  const counts = summary?.countsWithUrlSearchParams
  const actions = getOnboardingActions(user, 'home')
  const deployedAgents = (agents ?? []).filter((agent) => agent.status === 'deployed')

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        description="Here is what Aide handled over the last 7 days."
      />

      <PageBody className="flex flex-col gap-8 bg-white">
        <OnboardingReminders user={user} page="home" />

        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-[15px] font-medium text-gray-950">Last 7 days</h2>
            <Link
              to="/reports"
              className="inline-flex items-center gap-1 text-[12.5px] text-gray-500 transition-colors hover:text-gray-950"
            >
              Full report
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>

          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-[86px]" />
              ))}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile
                label="Conversations"
                value={counts?.eligibleConversations.count ?? 0}
                to={`/conversations?${counts?.eligibleConversations.urlSearchParams ?? ''}`}
              />
              <StatTile
                label="Topics detected"
                value={counts?.conversationsWithTopic.count ?? 0}
                to={`/conversations?${counts?.conversationsWithTopic.urlSearchParams ?? ''}`}
              />
              <StatTile
                label="Scenarios triggered"
                value={counts?.conversationsWithWorkflowExecuted.count ?? 0}
                to={`/conversations?${counts?.conversationsWithWorkflowExecuted.urlSearchParams ?? ''}`}
              />
              <StatTile
                label="Drafts used"
                value={counts?.conversationsWithDraftInserted.count ?? 0}
                to={`/conversations?${counts?.conversationsWithDraftInserted.urlSearchParams ?? ''}`}
              />
            </div>
          )}
        </section>

        {deployedAgents.length > 0 && (
          <section>
            <h2 className="mb-3 text-[17px] font-medium text-gray-950">Live agents</h2>
            <div className="divide-y divide-gray-200 overflow-hidden rounded-[8px] border border-black/5 bg-white">
              {deployedAgents.map((agent) => (
                <Link
                  key={agent.id}
                  to="/agents/$agentId"
                  params={{ agentId: String(agent.id) }}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-100/60"
                >
                  <Sparkles className="size-4 shrink-0 text-gray-400" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-medium text-gray-950">
                      {agent.name}
                    </span>
                    <span className="block truncate text-[12.5px] text-gray-500">
                      {agent.description}
                    </span>
                  </span>
                  <Badge variant="success">
                    <StatusDot />
                    Deployed
                  </Badge>
                  <span className="hidden w-28 shrink-0 text-right text-[12px] text-gray-400 sm:block">
                    {formatRelative(agent.last_active_at)}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {actions.length > 0 && (
          <section>
            <h2 className="mb-3 text-[17px] font-medium text-gray-950">Next steps</h2>
            <OnboardingActionBoxes user={user} page="home" limit={6} />
          </section>
        )}

        <section>
          <h2 className="mb-3 text-[17px] font-medium text-gray-950">Jump to</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <QuickLink
              to="/conversations"
              icon={Inbox}
              label="Conversations"
              hint="Read and reply"
            />
            <QuickLink to="/topics" icon={Tag} label="Topics" hint="What customers ask about" />
            <QuickLink to="/scenarios" icon={Zap} label="Scenarios" hint="Automate the repeats" />
            <QuickLink to="/agents" icon={Sparkles} label="Agents" hint="Deploy and manage" />
          </div>
        </section>
      </PageBody>
    </>
  )
}

function QuickLink({
  to,
  icon: Icon,
  label,
  hint,
}: {
  to: string
  icon: typeof Inbox
  label: string
  hint: string
}) {
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-[8px] bg-black/3 px-4 py-3 transition-colors hover:border-gray-300"
    >
      <Icon className="size-4 text-gray-400 transition-colors group-hover:text-gray-700" />
      <span className="min-w-0">
        <span className="block text-[13.5px] font-medium text-gray-950">{label}</span>
        <span className="block truncate text-[12.5px] text-gray-500">{hint}</span>
      </span>
    </Link>
  )
}
