import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Inbox,
  PanelRightClose,
  PanelRightOpen,
  Sparkles,
  Tag,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/page-header'
import { EmptyState, ErrorState } from '@/components/empty-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { SegmentedList, SegmentedTrigger, Tabs } from '@/components/ui/tabs'
import { OnboardingReminders } from '@/features/onboarding/components'
import { FilterSelect } from '@/features/conversations/filters'
import { TicketThread } from '@/features/conversations/thread'
import { Composer } from '@/features/conversations/composer'
import { ContextPanel, helpdeskUrl } from '@/features/conversations/context-panel'
import { Simulator } from '@/features/conversations/simulator'
import { useMe, useSelectionOptions, useTickets } from '@/lib/queries'
import { formatListDate, truncate } from '@/lib/format'
import type { TicketPayload } from '@/types/api'

interface ConversationsSearch {
  viewIds?: string
  topicIds?: string
  workflowIds?: string
  ticketIds?: string
  from?: string
  until?: string
  currentPage?: number
  ticket?: number
  view?: 'simulator'
}

const optionalString = (value: unknown) =>
  typeof value === 'string' && value.length > 0 ? value : undefined

export const Route = createFileRoute('/_authenticated/conversations')({
  validateSearch: (search: Record<string, unknown>): ConversationsSearch => ({
    viewIds: optionalString(search.viewIds),
    topicIds: optionalString(search.topicIds),
    workflowIds: optionalString(search.workflowIds),
    ticketIds: optionalString(search.ticketIds),
    from: optionalString(search.from),
    until: optionalString(search.until),
    currentPage: Number(search.currentPage) > 0 ? Number(search.currentPage) : undefined,
    ticket: Number(search.ticket) > 0 ? Number(search.ticket) : undefined,
    /* `viewIds=simulator` is the v5 spelling; both still work. */
    view:
      search.view === 'simulator' || String(search.viewIds).toLowerCase() === 'simulator'
        ? 'simulator'
        : undefined,
  }),
  component: ConversationsPage,
})

/** Source slugs are lowercase on the wire; these are the display names. */
const HELPDESK_NAMES: Record<string, string> = {
  front: 'Front',
  zendesk: 'Zendesk',
  gmail: 'Gmail',
  gorgias: 'Gorgias',
}

const VIEW_TABS = [
  { label: 'Open', value: 'ELIGIBLE-OPEN' },
  { label: 'Sent', value: 'ELIGIBLE-SENT' },
  { label: 'Detected', value: 'ELIGIBLE-ANY_TOPIC' },
  { label: 'Not detected', value: 'ELIGIBLE-NO_TOPIC' },
  { label: 'All', value: 'ELIGIBLE' },
]

function ConversationsPage() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const { data: user } = useMe()

  const isSimulator = search.view === 'simulator'
  const [simulatorTicket, setSimulatorTicket] = useState<TicketPayload>()
  const [draftReply, setDraftReply] = useState('')
  const [contextOpen, setContextOpen] = useState(true)

  const viewIds = search.viewIds ?? 'ELIGIBLE-OPEN'
  const page = search.currentPage ?? 1

  const { data, isLoading, isError, refetch } = useTickets({
    viewIds: isSimulator ? 'SIMULATOR' : viewIds,
    topicIds: search.topicIds,
    workflowIds: search.workflowIds,
    ticketIds: search.ticketIds,
    from: search.from,
    until: search.until,
    currentPage: page,
  })

  const { data: options } = useSelectionOptions()

  const tickets = data?.tickets ?? []
  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === search.ticket) ?? tickets[0],
    [tickets, search.ticket]
  )

  /* Selecting a different conversation clears whatever was half-typed. */
  useEffect(() => {
    setDraftReply('')
  }, [selectedTicket?.id])

  const setSearch = (next: Partial<ConversationsSearch>) =>
    navigate({ search: (current) => ({ ...current, ...next }), replace: true })

  const asList = (value?: string) => (value ? value.split('-').filter(Boolean) : [])

  const activeFilterCount = asList(search.topicIds).length + asList(search.workflowIds).length

  if (isSimulator) {
    return (
      <>
        <PageHeader
          title="Simulator"
          description="See how Aide would answer, without sending anything."
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSearch({ view: undefined, viewIds: undefined })}
            >
              Back to conversations
            </Button>
          }
        />
        <div id="simulator-container" className="flex min-h-0 flex-1 bg-white">
          <div className="mx-auto flex w-full max-w-3xl flex-col bg-white">
            <Simulator ticket={simulatorTicket} onTicketChange={setSimulatorTicket} />
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Conversations"
        meta={
          data?.paginationMeta && (
            <span className="text-[12.5px] text-gray-400 tabular-nums">
              {(data.paginationMeta as { total?: number }).total ?? tickets.length}
            </span>
          )
        }
        actions={
          <Button variant="outline" size="sm" onClick={() => setSearch({ view: 'simulator' })}>
            <Sparkles />
            Open simulator
          </Button>
        }
        tabs={
          <Tabs
            value={viewIds}
            onValueChange={(value) =>
              setSearch({ viewIds: value, currentPage: 1, ticket: undefined })
            }
          >
            <SegmentedList className="mb-3">
              {VIEW_TABS.map((tab) => (
                <SegmentedTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                </SegmentedTrigger>
              ))}
            </SegmentedList>
          </Tabs>
        }
      />

      <div className="flex flex-wrap items-center gap-2 border-b border-black/5 bg-white px-4 py-2 md:px-6">
        <FilterSelect
          label="Topics"
          searchPlaceholder="Search topics…"
          options={(options?.topics ?? []).map((topic) => ({
            value: String(topic.id),
            label: topic.name,
            emoji: topic.emoji,
            hint: topic.category?.name,
          }))}
          selected={asList(search.topicIds)}
          onChange={(values) =>
            setSearch({ topicIds: values.join('-') || undefined, currentPage: 1 })
          }
        />
        <FilterSelect
          label="Scenarios"
          searchPlaceholder="Search scenarios…"
          options={(options?.workflows ?? []).map((workflow) => ({
            value: String(workflow.id),
            label: workflow.name,
          }))}
          selected={asList(search.workflowIds)}
          onChange={(values) =>
            setSearch({ workflowIds: values.join('-') || undefined, currentPage: 1 })
          }
        />

        {(activeFilterCount > 0 || search.ticketIds || search.from) && (
          <Button
            variant="ghost"
            size="sm"
            className="text-gray-500"
            onClick={() =>
              setSearch({
                topicIds: undefined,
                workflowIds: undefined,
                ticketIds: undefined,
                from: undefined,
                until: undefined,
                currentPage: 1,
              })
            }
          >
            Clear filters
          </Button>
        )}

        {search.from && (
          <Badge variant="neutral">
            {search.from} → {search.until ?? 'now'}
          </Badge>
        )}

        <OnboardingReminders user={user} page="conversations" className="ml-auto" />
      </div>

      <div className="flex min-h-0 flex-1">
        {/* List pane */}
        <div className="flex w-full shrink-0 flex-col border-r border-black/5 bg-white lg:w-[360px] xl:w-[400px]">
          <div className="min-h-0 flex-1 scrollbar-thin overflow-y-auto">
            {isLoading ? (
              <ul className="divide-y divide-gray-200">
                {Array.from({ length: 8 }).map((_, index) => (
                  <li key={index} className="px-4 py-3">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="mt-2 h-3 w-full" />
                    <Skeleton className="mt-2 h-3 w-1/3" />
                  </li>
                ))}
              </ul>
            ) : isError ? (
              <div className="p-4">
                <ErrorState
                  title="Could not load conversations"
                  action={
                    <Button size="sm" onClick={() => refetch()}>
                      Try again
                    </Button>
                  }
                />
              </div>
            ) : tickets.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={<Inbox className="size-4" />}
                  title="No conversations match these filters"
                  description="Widen the date range or clear a filter to see more."
                />
              </div>
            ) : (
              <ul className="divide-y divide-black/5">
                {tickets.map((ticket) => (
                  <li key={ticket.id}>
                    <button
                      type="button"
                      onClick={() => setSearch({ ticket: ticket.id })}
                      className={cn(
                        'w-full px-4 py-3 text-left transition-colors hover:bg-black/3',
                        selectedTicket?.id === ticket.id && 'bg-black/3'
                      )}
                    >
                      <div className="flex items-baseline gap-2">
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-gray-950">
                          {ticket.requester?.name ?? 'Unknown customer'}
                        </span>
                        <span className="shrink-0 text-[11.5px] text-gray-400">
                          {formatListDate(ticket.latest_comment_at)}
                        </span>
                      </div>

                      <p className="mt-0.5 truncate text-[13px] text-gray-700">{ticket.subject}</p>
                      <p className="mt-0.5 truncate text-[12.5px] text-gray-400">
                        {truncate(ticket.comments.at(-1)?.body ?? '', 90)}
                      </p>

                      <div className="mt-1.5 flex items-center gap-1.5">
                        {!ticket.latest_comment_is_agent_reply && (
                          <Badge variant="warning">Awaiting reply</Badge>
                        )}
                        {ticket.cards[0] && (
                          <Badge variant="neutral">
                            <span>{ticket.cards[0].emoji}</span>
                            {ticket.cards[0].name}
                          </Badge>
                        )}
                        {ticket.drafts.length > 0 && (
                          <span title="Draft ready">
                            <Sparkles className="size-3 text-gray-400" />
                          </span>
                        )}
                        {ticket.executedWorkflows.length > 0 && (
                          <span title="Scenario ran">
                            <Zap className="size-3 text-gray-400" />
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {data?.paginationMeta && data.paginationMeta.last_page > 1 && (
            <div className="flex items-center justify-between border-t border-black/5 px-3 py-2">
              <Button
                variant="ghost"
                size="sm"
                disabled={page <= 1}
                onClick={() => setSearch({ currentPage: page - 1, ticket: undefined })}
              >
                <ChevronLeft />
                Previous
              </Button>
              <span className="text-[12px] text-gray-400 tabular-nums">
                {page} / {data.paginationMeta.last_page}
              </span>
              <Button
                variant="ghost"
                size="sm"
                disabled={page >= data.paginationMeta.last_page}
                onClick={() => setSearch({ currentPage: page + 1, ticket: undefined })}
              >
                Next
                <ChevronRight />
              </Button>
            </div>
          )}
        </div>

        {/* Thread pane */}
        <div className="hidden min-w-0 flex-1 flex-col bg-white lg:flex">
          {selectedTicket ? (
            <>
              <div className="flex items-start gap-3 border-b border-black/5 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-[17px] font-medium tracking-[0.0em] text-gray-950">
                    {selectedTicket.subject}
                  </h2>
                  <p className="mt-0.5 truncate text-[12.5px] text-gray-500">
                    {selectedTicket.requester?.name} · {selectedTicket.requester?.email} ·{' '}
                    <span className="font-mono">#{selectedTicket.id}</span>
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {helpdeskUrl(user, selectedTicket) && (
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href={helpdeskUrl(user, selectedTicket)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open in{' '}
                        {HELPDESK_NAMES[selectedTicket.ticket_source_slug] ??
                          selectedTicket.ticket_source_slug}
                        <ExternalLink />
                      </a>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={contextOpen ? 'Hide customer details' : 'Show customer details'}
                    onClick={() => setContextOpen(!contextOpen)}
                  >
                    {contextOpen ? <PanelRightClose /> : <PanelRightOpen />}
                  </Button>
                </div>
              </div>

              <div className="flex min-h-0 flex-1">
                <div className="min-w-0 flex-1 scrollbar-thin overflow-y-auto">
                  <TicketThread ticket={selectedTicket} onInsertDraft={setDraftReply} />
                </div>

                {contextOpen && (
                  <aside className="hidden w-[260px] shrink-0 scrollbar-thin overflow-y-auto border-l border-black/5 bg-black/1 px-4 py-5 xl:block">
                    <ContextPanel fields={selectedTicket.contextFields} />
                  </aside>
                )}
              </div>

              <Composer ticketId={selectedTicket.id} value={draftReply} onChange={setDraftReply} />
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center p-6">
              <EmptyState
                icon={<Tag className="size-4" />}
                title="Select a conversation"
                description="Pick one from the list to read the thread and everything Aide did with it."
              />
            </div>
          )}
        </div>
      </div>
    </>
  )
}
