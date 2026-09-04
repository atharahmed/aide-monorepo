import { useState, type ReactNode } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { CalendarDays, ChevronRight } from 'lucide-react'
import type { DateRange } from 'react-day-picker'
import { PageBody, PageHeader } from '@/components/page-header'
import { ThumbsUp, ThumbsDown } from 'lucide-react'
import { EmptyState, ErrorState } from '@/components/empty-state'
import { CategorySwatch } from '@/components/category-swatch'
import { InlineBar } from '@/components/data-viz'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { useKnowledgeDocuments, useReportSummary, useWorkflows } from '@/lib/queries'
import { conditionMeta } from '@/lib/conditions'
import { formatCount, formatDay, formatPercent, toNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import type {
  ConditionDropdownOption,
  Id,
  KnowledgeDocument,
  ReportSummary,
  ReportTopic,
  Workflow,
  WorkflowConditionType,
} from '@/types/api'

export const Route = createFileRoute('/_authenticated/reports')({
  component: ReportsPage,
})

const DAY = 86_400_000

function ReportsPage() {
  const [range, setRange] = useState<DateRange | undefined>({
    from: new Date(Date.now() - 6 * DAY),
    to: new Date(),
  })

  const since = Math.floor((range?.from?.getTime() ?? Date.now() - 6 * DAY) / 1000)
  const until = Math.floor((range?.to?.getTime() ?? Date.now()) / 1000)

  const { data, isLoading, isError, refetch } = useReportSummary(since, until)
  const { data: workflowData, isLoading: workflowsLoading, isError: workflowsError } =
    useWorkflows()
  const { data: documents, isLoading: knowledgeLoading, isError: knowledgeError } =
    useKnowledgeDocuments()
  const counts = data?.countsWithUrlSearchParams

  return (
    <>
      <PageHeader
        title="Reports"
        description="Aide performance and feedback insights"
        actions={<DateRangePicker range={range} onChange={setRange} />}
      />
      <div id='page-container' className="w-full overflow-scroll">
        <PageBody className="flex flex-col gap-9 bg-white mx-auto pb-20">
          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="h-[86px]" />
              ))}
            </div>
          ) : isError ? (
            <ErrorState
              title="Could not load the report"
              action={
                <Button size="sm" onClick={() => refetch()}>
                  Try again
                </Button>
              }
            />
          ) : (
            counts && (
              <>
              <div className="overflow-hidden rounded-[14px] border border-black/5 bg-white shadow-light">
                {/* Column headers */}
                <div className="grid grid-cols-4">
                  <div className="flex items-center border-b border-black/[0.035] px-5 py-2.5">
                    <span className="text-[13px] font-medium text-gray-500">Conversations</span>
                  </div>
                  <div className="flex items-center gap-1.5 border-b border-l border-black/[0.035] px-4 py-2.5">
                    <div className="h-3.5 w-3.5 rounded-[5px] border border-[#569AD8] bg-[#569AD8]/80" />
                    <span className="text-[13px] font-medium text-gray-500">Topics</span>
                  </div>
                  <div className="flex items-center gap-1.5 border-b border-l border-black/[0.035] px-4 py-2.5">
                    <div className="h-3.5 w-3.5 rounded-[5px] border border-[#DEA732] bg-[#DEA732]/80" />
                    <span className="text-[13px] font-medium text-gray-500">Scenarios</span>
                  </div>
                  <div className="flex items-center gap-1.5 border-b border-l border-black/[0.035] px-4 py-2.5">
                    <div className="h-3.5 w-3.5 rounded-[5px] border border-[#5DB49F] bg-[#5DB49F]/80" />
                    <span className="text-[13px] font-medium text-gray-500">Drafts</span>
                  </div>
                </div>

                {/* Rate badges row */}
                <div className="grid grid-cols-4 border-b border-black/[0.035]">
                  <div className="flex items-center gap-1.5 px-5 py-1.5">
                    <span className="text-[13px] text-gray-400">total</span>
                    <ReportBadge
                      value={formatCount(counts.conversations.count)}
                      to={`/conversations?${counts.conversations.urlSearchParams}`}
                    />
                    <span className="text-[13px] text-gray-400">eligible</span>
                    <ReportBadge
                      value={formatCount(counts.eligibleConversations.count)}
                      to={`/conversations?${counts.eligibleConversations.urlSearchParams}`}
                    />
                  </div>
                  <div className="flex items-center justify-between border-l border-black/[0.035] px-4 py-1.5">
                    <span className="text-[13px] text-gray-400">detection rate</span>
                    <span className="inline-flex items-center rounded-lg bg-[#569AD8]/10 px-2 py-0.5 text-[13px] font-semibold text-[#569AD8]">
                      {ratio(counts.conversationsWithTopic.count, counts.eligibleConversations.count || 1)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-l border-black/[0.035] px-4 py-1.5">
                    <span className="text-[13px] text-gray-400">automation rate</span>
                    <span className="inline-flex items-center rounded-lg bg-[#DEA732]/10 px-2 py-0.5 text-[13px] font-semibold text-[#DEA732]">
                      {ratio(
                        counts.conversationsWithWorkflowTextMacroExecuted.count +
                          counts.conversationsWithWorkflowNonTextMacroExecuted.count,
                        counts.eligibleConversations.count || 1
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-l border-black/[0.035] px-4 py-1.5">
                    <span className="text-[13px] text-gray-400">insertion rate</span>
                    <span className="inline-flex items-center rounded-lg bg-[#5DB49F]/10 px-2 py-0.5 text-[13px] font-semibold text-[#5DB49F]">
                      {ratio(
                        counts.conversationsWithDraftInserted.count,
                        (counts.conversationsWithDraftInserted.count || 0) +
                          (counts.conversationsWithDraftNotInserted.count || 0) || 1
                      )}
                    </span>
                  </div>
                </div>

                {/* Stat rows */}
                <div className="grid grid-cols-4 bg-black/[0.0]">
                  {/* Conversations column */}
                  <div className="flex flex-col gap-2 px-5 py-3">
                    <StatRow
                      label="With a topic"
                      description="conversations with at least one topic"
                      value={counts.conversationsWithTopic.count}
                      to={`/conversations?${counts.conversationsWithTopic.urlSearchParams}`}
                    />
                    <StatRow
                      label="No topic matched"
                      description="candidates for a new topic"
                      value={counts.conversationsWithNoTopic.count}
                      to={`/conversations?${counts.conversationsWithNoTopic.urlSearchParams}`}
                      muted
                    />
                  </div>

                  {/* Topics column */}
                  <div className="flex flex-col gap-2 border-l border-black/5 px-4 py-3">
                    <StatRow
                      label="Detections"
                      description="conversations with at least one topic"
                      value={counts.conversationsWithTopic.count}
                      to={`/conversations?${counts.conversationsWithTopic.urlSearchParams}`}
                      color="#569AD8"
                    />
                    <StatRow
                      label="No topics"
                      description="conversations with no topics detected"
                      value={counts.conversationsWithNoTopic.count}
                      to={`/conversations?${counts.conversationsWithNoTopic.urlSearchParams}`}
                      muted
                    />
                  </div>

                  {/* Scenarios column */}
                  <div className="flex flex-col gap-2 border-l border-black/5 px-4 py-3">
                    <StatRow
                      label="Wrote a reply"
                      description="auto-applied actions including a reply"
                      value={counts.conversationsWithWorkflowTextMacroExecuted.count}
                      to={`/conversations?${counts.conversationsWithWorkflowTextMacroExecuted.urlSearchParams}`}
                      color="#DEA732"
                    />
                    <StatRow
                      label="Ran another action"
                      description="auto-applied actions without a reply"
                      value={counts.conversationsWithWorkflowNonTextMacroExecuted.count}
                      to={`/conversations?${counts.conversationsWithWorkflowNonTextMacroExecuted.urlSearchParams}`}
                      muted
                    />
                  </div>

                  {/* Drafts column */}
                  <div className="flex flex-col gap-2 border-l border-black/5 px-4 py-3">
                    <StatRow
                      label="Sent as written"
                      description="conversations with drafts inserted"
                      value={counts.conversationsWithDraftInserted.count}
                      to={`/conversations?${counts.conversationsWithDraftInserted.urlSearchParams}`}
                      color="#5DB49F"
                    />
                    <StatRow
                      label="Not used"
                      description="conversations with drafts not inserted"
                      value={counts.conversationsWithDraftNotInserted.count}
                      to={`/conversations?${counts.conversationsWithDraftNotInserted.urlSearchParams}`}
                      muted
                    />
                  </div>
                </div>

                {/* Feedback row */}
                <div className="grid grid-cols-4 border-t border-black/[0.035]">
                  <div className="flex items-center px-5 py-2.5">
                    <span className="text-[13px] font-medium text-gray-500">Feedback</span>
                  </div>
                  <div className="flex items-center justify-between border-l border-black/[0.035] px-4 py-2.5">
                    <span className="text-[13px] text-gray-400">accuracy</span>
                    <span className="inline-flex items-center rounded-lg bg-[#569AD8]/10 px-2 py-0.5 text-[13px] font-semibold text-[#569AD8]">
                      {ratio(
                        counts.topicsPositiveFeedback.count,
                        counts.topicsPositiveFeedback.count + counts.topicsNegativeFeedback.count
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-l border-black/[0.035] px-4 py-2.5">
                    <span className="text-[13px] text-gray-400">accuracy</span>
                    <span className="inline-flex items-center rounded-lg bg-[#DEA732]/10 px-2 py-0.5 text-[13px] font-semibold text-[#DEA732]">
                      {ratio(
                        counts.workflowsPositiveFeedback.count,
                        counts.workflowsPositiveFeedback.count + counts.workflowsNegativeFeedback.count
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-l border-black/[0.035] px-4 py-2.5">
                    <span className="text-[13px] text-gray-400">accuracy</span>
                    <span className="inline-flex items-center rounded-lg bg-[#5DB49F]/10 px-2 py-0.5 text-[13px] font-semibold text-[#5DB49F]">
                      {ratio(
                        counts.draftsPositiveFeedback.count,
                        counts.draftsPositiveFeedback.count + counts.draftsNegativeFeedback.count
                      )}
                    </span>
                  </div>
                </div>

                {/* Feedback detail rows */}
                <div className="grid grid-cols-4 bg-black/[0.0]">
                  <div className="px-5 py-3" />

                  <div className="flex flex-col gap-2 border-l border-black/5 px-4 py-3">
                    <div className="grid grid-cols-2 gap-2">
                      <FeedbackBadge
                        type="positive"
                        label="Correct"
                        value={counts.topicsPositiveFeedback.count}
                        to={`/conversations?${counts.topicsPositiveFeedback.urlSearchParams}`}
                      />
                      <FeedbackBadge
                        type="negative"
                        label="Corrected"
                        value={counts.topicsNegativeFeedback.count}
                        to={`/conversations?${counts.topicsNegativeFeedback.urlSearchParams}`}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 border-l border-black/5 px-4 py-3">
                    <div className="grid grid-cols-2 gap-2">
                      <FeedbackBadge
                        type="positive"
                        label="Passed"
                        value={counts.workflowsPositiveFeedback.count}
                        to={`/conversations?${counts.workflowsPositiveFeedback.urlSearchParams}`}
                      />
                      <FeedbackBadge
                        type="negative"
                        label="Failed"
                        value={counts.workflowsNegativeFeedback.count}
                        to={`/conversations?${counts.workflowsNegativeFeedback.urlSearchParams}`}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 border-l border-black/5 px-4 py-3">
                    <div className="grid grid-cols-2 gap-2">
                      <FeedbackBadge
                        type="positive"
                        label="Good"
                        value={counts.draftsPositiveFeedback.count}
                        to={`/conversations?${counts.draftsPositiveFeedback.urlSearchParams}`}
                      />
                      <FeedbackBadge
                        type="negative"
                        label="Poor"
                        value={counts.draftsNegativeFeedback.count}
                        to={`/conversations?${counts.draftsNegativeFeedback.urlSearchParams}`}
                      />
                    </div>
                  </div>
                </div>
              </div>
                <TopicTable summary={data} />
                <ScenarioTable
                  workflows={workflowData?.workflows}
                  options={workflowData?.allConditionDropdownOptions}
                  listParams={counts.conversations.urlSearchParams}
                  isLoading={workflowsLoading}
                  isError={workflowsError}
                />
                <KnowledgeTable
                  documents={documents}
                  isLoading={knowledgeLoading}
                  isError={knowledgeError}
                />
              </>
            )
          )}
        </PageBody>
      </div>
    </>
  )
}

function ratio(part: number, total: number) {
  if (total === 0) return '—'
  return `${Math.round((part / total) * 100)}%`
}

function ReportBadge({ value, to }: { value: string; to: string }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center rounded-lg bg-black/[0.035] px-2 py-0.5 text-[13px] font-medium text-gray-500 transition-colors hover:bg-black/[0.06]"
    >
      {value}
    </Link>
  )
}

function StatRow({
  label,
  description,
  value,
  to,
  color,
  muted,
}: {
  label: string
  description: string
  value: number
  to: string
  color?: string
  muted?: boolean
}) {
  const bg = color ? `${color}05` : 'transparent'
  const hoverBg = color ? `${color}10` : 'rgba(0,0,0,0.03)'

  return (
    <Link
      to={to}
      className="group flex items-center justify-between gap-3 rounded-[10px] p-2 px-2.5 transition-all duration-200"
      style={{
        backgroundColor: muted ? 'transparent' : bg,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = muted ? 'rgba(0,0,0,0.03)' : hoverBg }}
      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = muted ? 'transparent' : bg }}
    >
      <div className="flex min-w-0 items-center gap-1.5">
        {color && !muted && (
          <div
            className="h-4 w-4 shrink-0 rounded-[5px] border"
            style={{ backgroundColor: `${color}CC`, borderColor: color }}
          />
        )}
        {muted && (
          <div
            className="h-4 w-4 shrink-0 rounded-[5px] border"
            style={{
              backgroundColor: color ? `${color}66` : 'white',
              borderColor: color ? `${color}99` : 'rgba(0,0,0,0.2)',
            }}
          />
        )}
        <div className="grid min-w-0">
          <span className="truncate text-[13px] font-medium text-gray-600">
            {label}{' '}
            <span className="relative top-[-2px] text-[11px] font-extrabold opacity-0 transition-all duration-500 group-hover:pl-0.5 group-hover:opacity-100">
              ↗
            </span>
          </span>
          <span className="truncate text-[11px] text-gray-400">{description}</span>
        </div>
      </div>
      <span
        className="shrink-0 text-[13px] font-semibold tabular-nums"
        style={{ color: color && !muted ? color : 'rgba(0,0,0,0.5)' }}
      >
        {formatCount(value)}
      </span>
    </Link>
  )
}

function FeedbackBadge({
  type,
  label,
  value,
  to,
}: {
  type: 'positive' | 'negative'
  label: string
  value: number
  to: string
}) {
  return (
    <Link
      to={to}
      className="group flex items-center justify-between gap-2 rounded-[10px] bg-black/[0.025] p-2 px-3 transition-colors hover:bg-black/[0.05]"
    >
      <div className="flex items-center gap-1.5">
        <div
          className={cn(
            'flex items-center rounded-[7px] border border-black/[0.175] bg-white px-1 py-1',
          )}
        >
          {type === 'positive' ? (
            <svg className="h-3 w-3 fill-green-100 stroke-green-500" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 10v12" /><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z" />
            </svg>
          ) : (
            <svg className="h-3 w-3 fill-red-100 stroke-red-500" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 14V2" /><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z" />
            </svg>
          )}
        </div>
        <span className="text-[12px] text-gray-400">
          {label}
          <span className="relative top-[-2px] text-[11px] font-extrabold opacity-0 transition-all duration-500 group-hover:pl-0.5 group-hover:opacity-80">
            ↗
          </span>
        </span>
      </div>
      <span className="text-[13px] font-semibold tabular-nums text-gray-500">
        {formatCount(value)}
      </span>
    </Link>
  )
}

const TOPIC_COLS =
  'grid w-full grid-cols-[minmax(0,1fr)_220px_90px_110px] items-center'
const RANK_COLS = 'grid w-full grid-cols-[minmax(0,1fr)_220px_90px] items-center'

function VolumeFrame({
  title,
  cols,
  headers,
  children,
}: {
  title: string
  cols: string
  headers: Array<{ label: string; align?: 'right' }>
  children: ReactNode
}) {
  return (
    <section>
      <h2 className="mb-3 text-[17px] font-medium text-gray-800">{title}</h2>
      <div className="overflow-hidden rounded-[14px] border border-black/5 bg-white shadow-light">
        <div className="overflow-x-auto">
          <div>
            <div
              className={cn(cols, 'border-b border-black/5 text-[12px] font-medium text-gray-500')}
            >
              {headers.map((header) => (
                <div
                  key={header.label}
                  className={cn('h-8 px-3 leading-9', header.align === 'right' && 'text-right')}
                >
                  {header.label}
                </div>
              ))}
            </div>
            {children}
          </div>
        </div>
      </div>
    </section>
  )
}

function TopicTable({ summary }: { summary: ReportSummary }) {
  const rows = summary.topics.filter((topic) => topic.ticketsCount > 0)
  const total = rows.reduce((sum, topic) => sum + topic.ticketsCount, 0)
  const groups = groupTopics(rows)
  const listParams = summary.countsWithUrlSearchParams.conversations.urlSearchParams

  if (rows.length === 0) {
    return (
      <section>
        <h2 className="mb-3 text-[17px] font-medium text-gray-800">Topics</h2>
        <EmptyState
          title="No topics detected in this range"
          description="Widen the date range, or check that your helpdesk is still syncing."
        />
      </section>
    )
  }

  return (
    <VolumeFrame
      title="Topics"
      cols={TOPIC_COLS}
      headers={[
        { label: 'Topic' },
        { label: 'Share' },
        { label: 'Conversations', align: 'right' },
        { label: 'Feedback', align: 'right' },
      ]}
    >
      {groups.map((category) => (
        <Collapsible key={category.id} defaultOpen>
          <GroupTrigger
            name={category.name}
            level="category"
            cols={TOPIC_COLS}
            color={category.color}
          />
          <CollapsibleContent>
            {category.subcategories.map((sub) => (
              <Collapsible key={sub.id} defaultOpen>
                <GroupTrigger name={sub.name} level="subcategory" cols={TOPIC_COLS} />
                <CollapsibleContent>
                  {sub.topics.map((topic) => (
                    <TopicRow
                      key={topic.id}
                      topic={topic}
                      total={total}
                      search={listSearch(listParams, 'topicIds', [topic.id])}
                    />
                  ))}
                </CollapsibleContent>
              </Collapsible>
            ))}
          </CollapsibleContent>
        </Collapsible>
      ))}
    </VolumeFrame>
  )
}

function ScenarioTable({
  workflows,
  options,
  listParams,
  isLoading,
  isError,
}: {
  workflows?: Workflow[]
  options?: ConditionDropdownOption[]
  listParams: string
  isLoading: boolean
  isError: boolean
}) {
  if (isLoading) {
    return (
      <section>
        <h2 className="mb-3 text-[17px] font-medium text-gray-800">Scenarios</h2>
        <Skeleton className="h-48 rounded-[14px]" />
      </section>
    )
  }

  if (isError) {
    return (
      <section>
        <h2 className="mb-3 text-[17px] font-medium text-gray-800">Scenarios</h2>
        <EmptyState title="Could not load scenarios" />
      </section>
    )
  }

  const groups = groupScenarios(workflows ?? [], options ?? [])
  const total = groups.reduce(
    (sum, group) => sum + group.workflows.reduce((count, workflow) => count + toNumber(workflow.times_run), 0),
    0
  )

  if (groups.length === 0) {
    return (
      <section>
        <h2 className="mb-3 text-[17px] font-medium text-gray-800">Scenarios</h2>
        <EmptyState
          title="No scenarios have run yet"
          description="Once a scenario matches a conversation, it will show up here."
        />
      </section>
    )
  }

  return (
    <VolumeFrame
      title="Scenarios"
      cols={RANK_COLS}
      headers={[
        { label: 'Scenario' },
        { label: 'Share' },
        { label: 'Times run', align: 'right' },
      ]}
    >
      {groups.map((group) => (
        <Collapsible key={group.id} defaultOpen>
          <GroupTrigger name={group.name} level="category" cols={RANK_COLS} />
          <CollapsibleContent>
            {group.workflows.map((workflow) => (
              <RankedRow
                key={workflow.id}
                name={workflow.name}
                to="/conversations"
                search={listSearch(listParams, 'workflowIds', [workflow.id])}
                value={toNumber(workflow.times_run)}
                total={total}
              />
            ))}
          </CollapsibleContent>
        </Collapsible>
      ))}
    </VolumeFrame>
  )
}

function KnowledgeTable({
  documents,
  isLoading,
  isError,
}: {
  documents?: KnowledgeDocument[]
  isLoading: boolean
  isError: boolean
}) {
  if (isLoading) {
    return (
      <section>
        <h2 className="mb-3 text-[17px] font-medium text-gray-800">Knowledge</h2>
        <Skeleton className="h-48 rounded-[14px]" />
      </section>
    )
  }

  if (isError) {
    return (
      <section>
        <h2 className="mb-3 text-[17px] font-medium text-gray-800">Knowledge</h2>
        <EmptyState title="Could not load knowledge" />
      </section>
    )
  }

  const groups = groupKnowledge(documents ?? [])
  const total = groups.reduce(
    (sum, group) =>
      sum + group.articles.reduce((count, article) => count + toNumber(article.times_used), 0),
    0
  )

  if (groups.length === 0) {
    return (
      <section>
        <h2 className="mb-3 text-[17px] font-medium text-gray-800">Knowledge</h2>
        <EmptyState
          title="No articles used yet"
          description="Articles show up here once Aide cites them in a reply."
        />
      </section>
    )
  }

  return (
    <VolumeFrame
      title="Knowledge"
      cols={RANK_COLS}
      headers={[
        { label: 'Article' },
        { label: 'Share' },
        { label: 'Times used', align: 'right' },
      ]}
    >
      {groups.map((group) => (
        <Collapsible key={group.name} defaultOpen>
          <GroupTrigger name={group.name} level="category" cols={RANK_COLS} />
          <CollapsibleContent>
            {group.articles.map((article) => (
              <RankedRow
                key={article.id}
                name={article.title || 'Untitled'}
                to="/knowledge"
                search={{ article: article.id }}
                value={toNumber(article.times_used)}
                total={total}
              />
            ))}
          </CollapsibleContent>
        </Collapsible>
      ))}
    </VolumeFrame>
  )
}

interface TopicSubgroup {
  id: Id
  name: string
  topics: ReportTopic[]
  ticketsCount: number
  positiveFeedbackCount: number
  negativeFeedbackCount: number
}

interface TopicCategoryGroup {
  id: Id
  name: string
  color: string | null
  subcategories: TopicSubgroup[]
  ticketsCount: number
  positiveFeedbackCount: number
  negativeFeedbackCount: number
}

function groupTopics(topics: ReportTopic[]): TopicCategoryGroup[] {
  const categories = new Map<
    string,
    {
      id: Id
      name: string
      color: string | null
      subs: Map<string, { id: Id; name: string; topics: ReportTopic[] }>
    }
  >()

  for (const topic of topics) {
    const category = topic.parent.parent
    const sub = topic.parent
    const categoryKey = String(category.id)
    let group = categories.get(categoryKey)
    if (!group) {
      group = { id: category.id, name: category.name, color: category.color, subs: new Map() }
      categories.set(categoryKey, group)
    }

    const subKey = String(sub.id)
    let subgroup = group.subs.get(subKey)
    if (!subgroup) {
      subgroup = { id: sub.id, name: sub.name, topics: [] }
      group.subs.set(subKey, subgroup)
    }
    subgroup.topics.push(topic)
  }

  return [...categories.values()]
    .map((category) => {
      const subcategories = [...category.subs.values()]
        .map((sub) => {
          const topicsInSub = [...sub.topics].sort((a, b) => b.ticketsCount - a.ticketsCount)
          return {
            id: sub.id,
            name: sub.name,
            topics: topicsInSub,
            ticketsCount: topicsInSub.reduce((sum, topic) => sum + topic.ticketsCount, 0),
            positiveFeedbackCount: topicsInSub.reduce(
              (sum, topic) => sum + topic.positiveFeedbackCount,
              0
            ),
            negativeFeedbackCount: topicsInSub.reduce(
              (sum, topic) => sum + topic.negativeFeedbackCount,
              0
            ),
          }
        })
        .sort((a, b) => b.ticketsCount - a.ticketsCount)

      return {
        id: category.id,
        name: category.name,
        color: category.color,
        subcategories,
        ticketsCount: subcategories.reduce((sum, sub) => sum + sub.ticketsCount, 0),
        positiveFeedbackCount: subcategories.reduce(
          (sum, sub) => sum + sub.positiveFeedbackCount,
          0
        ),
        negativeFeedbackCount: subcategories.reduce(
          (sum, sub) => sum + sub.negativeFeedbackCount,
          0
        ),
      }
    })
    .sort((a, b) => b.ticketsCount - a.ticketsCount)
}

function listSearch(listParams: string, key: 'topicIds' | 'workflowIds', ids: Id[]) {
  const params = new URLSearchParams(listParams)
  params.set(key, ids.join('-'))
  return Object.fromEntries(params.entries())
}

interface ScenarioGroup {
  id: string
  name: string
  workflows: Workflow[]
}

function firstTopicId(workflow: Workflow): Id | undefined {
  for (const condition of workflow.conditions) {
    if (isTopicCondition(condition.condition_type) && condition.attachable_id) {
      return condition.attachable_id
    }
  }
  return undefined
}

function isTopicCondition(type: WorkflowConditionType) {
  switch (type) {
    case 'INTENT':
    case 'TOP_INTENT':
    case 'PRIORITY_INTENT':
      return true
    case 'INTENT_CONFIDENCE':
    case 'IS_FIRST_MESSAGE':
    case 'USER_FIELD':
    case 'TICKET_FIELD':
    case 'CONTACT_FIELD':
    case 'TICKET_STATUS':
    case 'TICKET_TAG':
    case 'INBOX':
    case 'INTEGRATION':
    case 'SHOPIFY':
    case 'CUSTOM':
      return false
    default: {
      const _exhaustive: never = type
      return _exhaustive
    }
  }
}

function groupScenarios(
  workflows: Workflow[],
  options: ConditionDropdownOption[]
): ScenarioGroup[] {
  const ranked = [...workflows]
    .filter((workflow) => !workflow.apply_always && toNumber(workflow.times_run) > 0)
    .sort((a, b) => toNumber(b.times_run) - toNumber(a.times_run))

  const other: Workflow[] = []
  const byTopic = new Map<string, { name: string; workflows: Workflow[] }>()

  for (const workflow of ranked) {
    const topicId = firstTopicId(workflow)
    if (!topicId) {
      other.push(workflow)
      continue
    }

    const key = String(topicId)
    let bucket = byTopic.get(key)
    if (!bucket) {
      const match = options.find(
        (option) => String(option.attachable_id ?? conditionMeta(option)?.id ?? '') === key
      )
      bucket = { name: conditionMeta(match)?.name ?? 'Topic', workflows: [] }
      byTopic.set(key, bucket)
    }
    bucket.workflows.push(workflow)
  }

  const groups: ScenarioGroup[] = []

  const topicGroups = [...byTopic.entries()]
    .map(([id, bucket]) => ({
      id,
      name: bucket.name,
      workflows: bucket.workflows,
      volume: bucket.workflows.reduce((sum, workflow) => sum + toNumber(workflow.times_run), 0),
    }))
    .sort((a, b) => b.volume - a.volume)

  for (const group of topicGroups) {
    groups.push({ id: group.id, name: group.name, workflows: group.workflows })
  }

  if (other.length > 0) {
    groups.push({ id: 'other', name: 'Other conditions', workflows: other })
  }

  return groups
}

interface KnowledgeGroup {
  name: string
  articles: KnowledgeDocument[]
}

function groupKnowledge(documents: KnowledgeDocument[]): KnowledgeGroup[] {
  const used = documents.filter((document) => toNumber(document.times_used) > 0)
  const bySource = new Map<string, KnowledgeDocument[]>()

  for (const document of used) {
    const key = document.knowledge_set_name ?? 'Other'
    const list = bySource.get(key) ?? []
    list.push(document)
    bySource.set(key, list)
  }

  return [...bySource.entries()]
    .map(([name, articles]) => ({
      name,
      articles: [...articles].sort((a, b) => toNumber(b.times_used) - toNumber(a.times_used)),
      volume: articles.reduce((sum, article) => sum + toNumber(article.times_used), 0),
    }))
    .sort((a, b) => b.volume - a.volume)
    .map(({ name, articles }) => ({ name, articles }))
}

type GroupLevel = 'category' | 'subcategory'

function groupChevronClass(level: GroupLevel) {
  switch (level) {
    case 'category':
      return 'size-3.5 text-gray-400'
    case 'subcategory':
      return 'size-3 text-gray-300'
    default: {
      const _exhaustive: never = level
      return _exhaustive
    }
  }
}

function GroupTrigger({
  name,
  level,
  cols,
  color,
}: {
  name: string
  level: GroupLevel
  cols: string
  color?: string | null
}) {
  const nested = level === 'subcategory'

  return (
    <CollapsibleTrigger
      className={cn(
        cols,
        'group cursor-pointer border-b border-black/3 bg-gray-50/80 py-1 text-left transition-colors hover:bg-gray-100'
      )}
    >
      <span className={cn('flex min-w-0 items-center gap-1.5 px-3', nested && 'pl-8')}>
        <ChevronRight
          className={cn(
            'shrink-0 transition-transform group-data-[state=open]:rotate-90',
            groupChevronClass(level)
          )}
        />
        <CategorySwatch color={color} />
        <span className="min-w-0 truncate text-[12px] font-medium text-gray-400">{name}</span>
      </span>
    </CollapsibleTrigger>
  )
}

function TopicRow({
  topic,
  total,
  search,
}: {
  topic: ReportTopic
  total: number
  search: Record<string, string>
}) {
  return (
    <Link
      to="/conversations"
      search={search as never}
      aria-label={`View conversations for ${topic.name}`}
      className={cn(
        TOPIC_COLS,
        'border-b border-black/3 py-2.5 transition-colors hover:bg-gray-100/60'
      )}
    >
      <span className="flex min-w-0 items-center gap-2 pr-3 pl-12">
        {topic.emoji ? <span className="w-4 shrink-0 text-center">{topic.emoji}</span> : null}
        <span className="truncate text-[13.5px] font-medium text-gray-950">{topic.name}</span>
      </span>
      <VolumeMetrics
        ticketsCount={topic.ticketsCount}
        total={total}
        positive={topic.positiveFeedbackCount}
        negative={topic.negativeFeedbackCount}
      />
    </Link>
  )
}

function RankedRow({
  name,
  to,
  search,
  value,
  total,
}: {
  name: string
  to: '/conversations' | '/knowledge'
  search: Record<string, string>
  value: number
  total: number
}) {
  return (
    <Link
      to={to}
      search={search as never}
      aria-label={name}
      className={cn(
        RANK_COLS,
        'border-b border-black/3 py-2.5 transition-colors hover:bg-gray-100/60'
      )}
    >
      <span className="flex min-w-0 items-center pr-3 pl-12">
        <span className="truncate text-[13.5px] font-medium text-gray-950">{name}</span>
      </span>
      <ShareBar value={value} total={total} />
      <div className="px-3 text-right text-[13px] font-medium text-gray-400 tabular-nums">
        {value}
      </div>
    </Link>
  )
}

function ShareBar({ value, total }: { value: number; total: number }) {
  return (
    <div className="flex items-center gap-2.5 px-3">
      <InlineBar value={value} max={total} className="min-w-0 flex-1" />
      <span className="w-10 shrink-0 text-right text-[12.5px] font-medium text-gray-800 tabular-nums">
        {formatPercent(value, total)}
      </span>
    </div>
  )
}

function VolumeMetrics({
  ticketsCount,
  total,
  positive,
  negative,
}: {
  ticketsCount: number
  total: number
  positive: number
  negative: number
}) {
  return (
    <>
      <ShareBar value={ticketsCount} total={total} />
      <div className="px-3 text-right text-[13px] font-medium text-gray-400 tabular-nums">
        {ticketsCount}
      </div>
      <div className="px-3 text-right">
        <span className="inline-flex items-center gap-2.5 text-[12px] tabular-nums">
          <span className="inline-flex items-center gap-1 text-gray-500">
            <ThumbsUp className="size-3 text-gray-400" />
            {positive}
          </span>
          <span className="inline-flex items-center gap-1 text-gray-500">
            <ThumbsDown className="size-3 text-gray-400" />
            {negative}
          </span>
        </span>
      </div>
    </>
  )
}

const PRESETS = [
  { label: 'Last 7 days', days: 6 },
  { label: 'Last 30 days', days: 29 },
  { label: 'Last 90 days', days: 89 },
]

function DateRangePicker({
  range,
  onChange,
}: {
  range: DateRange | undefined
  onChange: (range: DateRange | undefined) => void
}) {
  const [open, setOpen] = useState(false)

  const label =
    range?.from && range?.to
      ? `${formatDay(range.from)} – ${formatDay(range.to)}`
      : 'Choose a date range'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <CalendarDays />
          {label}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-auto p-0">
        <div className="flex flex-col gap-1 border-b border-black/5 p-2 sm:flex-row">
          {PRESETS.map((preset) => (
            <Button
              key={preset.label}
              variant="ghost"
              size="sm"
              onClick={() => {
                onChange({ from: new Date(Date.now() - preset.days * DAY), to: new Date() })
                setOpen(false)
              }}
            >
              {preset.label}
            </Button>
          ))}
        </div>

        <Calendar
          mode="range"
          numberOfMonths={2}
          defaultMonth={range?.from}
          selected={range}
          onSelect={onChange}
          disabled={{ after: new Date() }}
        />
      </PopoverContent>
    </Popover>
  )
}
