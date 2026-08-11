import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { CalendarDays, ThumbsDown, ThumbsUp } from 'lucide-react'
import type { DateRange } from 'react-day-picker'
import { PageBody, PageHeader } from '@/components/page-header'
import { EmptyState, ErrorState } from '@/components/empty-state'
import { InlineBar, StatTile } from '@/components/data-viz'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useReportSummary } from '@/lib/queries'
import { formatDay } from '@/lib/format'
import type { ReportSummary } from '@/types/api'

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
  const counts = data?.countsWithUrlSearchParams

  return (
    <>
      <PageHeader
        title="Reports"
        description="What Aide did, and how often your team agreed with it."
        actions={<DateRangePicker range={range} onChange={setRange} />}
      />

      <PageBody className="flex flex-col gap-9">
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
              <Section title="Conversations">
                <StatTile
                  label="Total"
                  value={counts.conversations.count}
                  to={`/conversations?${counts.conversations.urlSearchParams}`}
                />
                <StatTile
                  label="Eligible for Aide"
                  value={counts.eligibleConversations.count}
                  hint="Excludes spam and internal notes"
                  to={`/conversations?${counts.eligibleConversations.urlSearchParams}`}
                />
                <StatTile
                  label="With a topic"
                  value={counts.conversationsWithTopic.count}
                  to={`/conversations?${counts.conversationsWithTopic.urlSearchParams}`}
                />
                <StatTile
                  label="No topic matched"
                  value={counts.conversationsWithNoTopic.count}
                  hint="Candidates for a new topic"
                  to={`/conversations?${counts.conversationsWithNoTopic.urlSearchParams}`}
                />
              </Section>

              <Section title="Topics">
                <StatTile label="Topics detected" value={data.topicsDetected} />
                <StatTile
                  label="Marked right"
                  value={counts.topicsPositiveFeedback.count}
                  to={`/conversations?${counts.topicsPositiveFeedback.urlSearchParams}`}
                />
                <StatTile
                  label="Marked wrong"
                  value={counts.topicsNegativeFeedback.count}
                  to={`/conversations?${counts.topicsNegativeFeedback.urlSearchParams}`}
                />
                <StatTile
                  label="Agreement"
                  value={ratio(
                    counts.topicsPositiveFeedback.count,
                    counts.topicsPositiveFeedback.count + counts.topicsNegativeFeedback.count
                  )}
                  hint="Of the ones your team rated"
                />
              </Section>

              <Section title="Scenarios">
                <StatTile label="Times triggered" value={data.workflowsTriggered} />
                <StatTile
                  label="Wrote a reply"
                  value={counts.conversationsWithWorkflowTextMacroExecuted.count}
                  to={`/conversations?${counts.conversationsWithWorkflowTextMacroExecuted.urlSearchParams}`}
                />
                <StatTile
                  label="Ran another action"
                  value={counts.conversationsWithWorkflowNonTextMacroExecuted.count}
                  to={`/conversations?${counts.conversationsWithWorkflowNonTextMacroExecuted.urlSearchParams}`}
                />
                <StatTile
                  label="Agreement"
                  value={ratio(
                    counts.workflowsPositiveFeedback.count,
                    counts.workflowsPositiveFeedback.count + counts.workflowsNegativeFeedback.count
                  )}
                  hint="Of the ones your team rated"
                />
              </Section>

              <Section title="Drafts">
                <StatTile label="Written" value={data.draftsGenerated} />
                <StatTile
                  label="Sent as written"
                  value={counts.conversationsWithDraftInserted.count}
                  to={`/conversations?${counts.conversationsWithDraftInserted.urlSearchParams}`}
                />
                <StatTile
                  label="Not used"
                  value={counts.conversationsWithDraftNotInserted.count}
                  to={`/conversations?${counts.conversationsWithDraftNotInserted.urlSearchParams}`}
                />
                <StatTile
                  label="Agreement"
                  value={ratio(
                    counts.draftsPositiveFeedback.count,
                    counts.draftsPositiveFeedback.count + counts.draftsNegativeFeedback.count
                  )}
                  hint="Of the ones your team rated"
                />
              </Section>

              <TopicTable summary={data} />
            </>
          )
        )}
      </PageBody>
    </>
  )
}

function ratio(part: number, total: number) {
  if (total === 0) return '—'
  return `${Math.round((part / total) * 100)}%`
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-[13px] font-medium text-gray-950">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </section>
  )
}

function TopicTable({ summary }: { summary: ReportSummary }) {
  const rows = summary.topics.filter((topic) => topic.ticketsCount > 0)
  const max = Math.max(1, ...rows.map((topic) => topic.ticketsCount))

  return (
    <section>
      <h2 className="mb-3 text-[13px] font-medium text-gray-950">Topics by volume</h2>

      {rows.length === 0 ? (
        <EmptyState
          title="No topics detected in this range"
          description="Widen the date range, or check that your helpdesk is still syncing."
        />
      ) : (
        <div className="overflow-hidden rounded-[8px] border border-gray-200 bg-white">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[300px]">Topic</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="w-[180px]">Share</TableHead>
                <TableHead className="w-[90px] text-right">Conversations</TableHead>
                <TableHead className="w-[110px] text-right">Feedback</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((topic) => (
                <TableRow key={topic.id}>
                  <TableCell>
                    <span className="flex items-center gap-2">
                      <span className="w-4 text-center">{topic.emoji}</span>
                      <span className="font-medium text-gray-950">{topic.name}</span>
                    </span>
                  </TableCell>
                  <TableCell className="text-gray-500">
                    {topic.parent.parent.name} · {topic.parent.name}
                  </TableCell>
                  <TableCell>
                    <InlineBar value={topic.ticketsCount} max={max} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{topic.ticketsCount}</TableCell>
                  <TableCell className="text-right">
                    <span className="inline-flex items-center gap-2.5 text-[12px] tabular-nums">
                      <span className="inline-flex items-center gap-1 text-gray-500">
                        <ThumbsUp className="size-3 text-gray-400" />
                        {topic.positiveFeedbackCount}
                      </span>
                      <span className="inline-flex items-center gap-1 text-gray-500">
                        <ThumbsDown className="size-3 text-gray-400" />
                        {topic.negativeFeedbackCount}
                      </span>
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
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
        <div className="flex flex-col gap-1 border-b border-gray-200 p-2 sm:flex-row">
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
