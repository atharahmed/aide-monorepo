import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Inbox,
  Plus,
  PanelRightClose,
  PanelRightOpen,
  Search,
  Sparkles,
  Tag,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/page-header'
import { EmptyState, ErrorState } from '@/components/empty-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { OnboardingReminders } from '@/features/onboarding/components'
import { FilterSelect } from '@/features/conversations/filters'
import { TicketThread } from '@/features/conversations/thread'
import { Composer } from '@/features/conversations/composer'
import { ContextPanel } from '@/features/conversations/context-panel'
import { helpdeskTicketUrl, ticketRequester } from '@/features/conversations/helpdesk-links'
import { Simulator } from '@/features/conversations/simulator'
import { useMe, useSelectionOptions, useTickets } from '@/lib/queries'
import { formatCompactAgo, truncate } from '@/lib/format'
import { searchId, searchNumber, searchString } from '@/lib/search'
import type { Id, Ticket } from '@/types/api'

interface ConversationsSearch {
  viewIds?: string
  topicIds?: string
  workflowIds?: string
  ticketIds?: string
  from?: string
  until?: string
  currentPage?: number
  /** The selected conversation's id — a string, like every id on the wire. */
  ticket?: Id
  view?: 'simulator'
}

export const Route = createFileRoute('/_authenticated/conversations')({
  validateSearch: (search: Record<string, unknown>): ConversationsSearch => ({
    viewIds: searchString(search.viewIds),
    topicIds: searchString(search.topicIds),
    workflowIds: searchString(search.workflowIds),
    ticketIds: searchString(search.ticketIds),
    from: searchString(search.from),
    until: searchString(search.until),
    currentPage: searchNumber(search.currentPage),
    ticket: searchId(search.ticket),
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
  const [simulatorTicket, setSimulatorTicket] = useState<Ticket>()
  const [draftReply, setDraftReply] = useState('')
  const [contextOpen, setContextOpen] = useState(true)
  const [idLookup, setIdLookup] = useState(search.ticketIds ?? '')

  const viewIds = search.viewIds ?? (search.ticketIds ? 'ELIGIBLE' : 'ELIGIBLE-OPEN')
  const page = search.currentPage ?? 1

  const { data, isLoading, isPlaceholderData, isError, refetch } = useTickets({
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

  /**
   * The simulator has a genuine "no conversation yet" state — the new-chat row
   * at the top of its list — so it never falls back to the first ticket. The
   * locally held copy wins while it is fresher than the list, which it is
   * between sending a message and the list refetching.
   */
  const selectedTicket = useMemo(() => {
    if (isSimulator) {
      if (!search.ticket) return undefined
      if (simulatorTicket?.id === search.ticket) return simulatorTicket
      return tickets.find((ticket) => ticket.id === search.ticket)
    }
    return tickets.find((ticket) => ticket.id === search.ticket) ?? tickets[0]
  }, [isSimulator, tickets, search.ticket, simulatorTicket])

  /* Selecting a different conversation clears whatever was half-typed. */
  useEffect(() => {
    setDraftReply('')
  }, [selectedTicket?.id])

  useEffect(() => setIdLookup(search.ticketIds ?? ''), [search.ticketIds])

  const setSearch = (next: Partial<ConversationsSearch>) =>
    navigate({ search: (current) => ({ ...current, ...next }), replace: true })

  const asList = (value?: string) => (value ? value.split('-').filter(Boolean) : [])

  const activeFilterCount = asList(search.topicIds).length + asList(search.workflowIds).length

  if (isSimulator) {
    return (
      <>
        <PageHeader
          title="Simulator"
          description="Role-play as a customer to see how Aide would answer"
      
        />
        <div className="flex min-h-0 flex-1 bg-white">
          <div className="mx-auto flex w-full flex-col border-x border-black/0 bg-white">
            <Simulator ticket={simulatorTicket} onTicketChange={setSimulatorTicket} />
          </div>
        </div>
      </>
    )
  }

  return (
    <div id="page-container" className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title={isSimulator ? 'Simulator' : 'Conversations'}
        description={
          isSimulator ? 'Role-play as a customer to see how Aide would answer' : undefined
        }
        meta={
          !isSimulator &&
          data?.paginationMeta && (
            <span className="text-[12.5px] text-gray-400 tabular-nums">
              {(data.paginationMeta as { total?: number }).total ?? tickets.length}
            </span>
          )
        }
      />

      {!isSimulator && (
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
              className="text-gray-500 text-[11px] h-6"
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

          <form
            className="relative ml-auto"
            onSubmit={(event) => {
              event.preventDefault()
              const id = idLookup.trim().split('/').pop()
              setSearch({
                ticketIds: id || undefined,
                viewIds: id ? 'ELIGIBLE' : undefined,
                currentPage: 1,
                ticket: undefined,
              })
            }}
          >
            <Search className="pointer-events-none absolute top-1/2 left-2 size-3 -translate-y-1/2 text-gray-400" />
            <Input
              value={idLookup}
              onChange={(event) => setIdLookup(event.target.value)}
              placeholder="Conversation ID"
              aria-label="Look up a conversation by ID"
              className="h-7 w-[150px] rounded-[6px] pl-[26px] text-[12.5px]"
            />
          </form>

          <OnboardingReminders user={user} page="conversations" />
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* List pane */}
        <div className="flex w-full shrink-0 flex-col border-r border-gray-100 bg-white lg:w-[320px] xl:w-[360px]">
          <div className="shrink-0 px-4 py-2 pb-1">
            <Tabs
              value={viewIds}
              onValueChange={(value) =>
                setSearch({ viewIds: value, currentPage: 1, ticket: undefined })
              }
            >
              <TabsList className="flex-nowrap">
                {VIEW_TABS.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value} className='text-[11px]'>
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {isSimulator && (
            <button
              type="button"
              onClick={() => setSearch({ ticket: undefined })}
              className={cn(
                'flex items-center gap-2 border-b border-gray-200 px-4 py-3 text-left transition-colors hover:bg-gray-100',
                !selectedTicket && 'bg-gray-100'
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium text-gray-950">
                  Start new simulated conversation
                </span>
                <span className="block text-[12.5px] text-gray-500">
                  Ask something as if you were a customer
                </span>
              </span>
              <Plus className="size-4 shrink-0 text-gray-400" />
            </button>
          )}

          <div className="min-h-0 flex-1 scrollbar-thin overflow-y-auto">
            {isLoading || isPlaceholderData ? (
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
                  title={
                    isSimulator
                      ? 'No simulated conversations yet'
                      : 'No conversations match these filters'
                  }
                  description={
                    isSimulator
                      ? 'Start one above to see how Aide would answer.'
                      : 'Widen the date range or clear a filter to see more.'
                  }
                />
              </div>
            ) : (
              <ul className="gap-y-0">
                {tickets.map((ticket) => (
                  <li key={ticket.id} className="mx-2 my-0 mb-0">
                    <button
                      type="button"
                      onClick={() => setSearch({ ticket: ticket.id })}
                      className={cn(
                        'w-full cursor-pointer rounded-[12px] px-3 py-2 text-left transition-colors hover:bg-black/3',
                        selectedTicket?.id === ticket.id && 'bg-black/3'
                      )}
                    >
                      <div className="flex items-baseline gap-2">
                        {/* A simulated conversation has no real customer, so its
                            subject carries the identity instead. */}
                        <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-gray-900">
                          {isSimulator
                            ? (ticket.subject ?? '(no subject)')
                            : ticketRequester(ticket).name}
                        </span>
                        <span className="shrink-0 text-[11px] text-gray-400 tabular-nums">
                          {formatCompactAgo(ticket.latest_comment_at)}
                        </span>
                      </div>

                      {!isSimulator && (
                        <p className="mt-0 truncate text-[12px] font-medium text-gray-700">
                          {ticket.subject}
                        </p>
                      )}
                      <p className="mt-0.5 truncate text-[11px] text-gray-400">
                        {truncate(ticket.comments.at(-1)?.body ?? '', 90)}
                      </p>

                      {/* <div className="mt-1.5 flex items-center gap-1.5">
                        {!isSimulator && !ticket.latest_comment_is_agent_reply && (
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
                      </div> */}
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
          {isSimulator ? (
            <Simulator
              ticket={selectedTicket}
              onTicketChange={(ticket) => {
                /* Hold the fresh copy locally and select it, so the reply shows
                 * immediately rather than waiting for the list to refetch. */
                setSimulatorTicket(ticket)
                setSearch({ ticket: ticket.id })
              }}
            />
          ) : selectedTicket ? (
            <>
              <div className="flex items-start gap-3 border-b border-black/5 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate text-[17px] font-medium tracking-[0.0em] text-gray-950">
                    {selectedTicket.subject}
                  </h2>
                  <p className="mt-0.5 truncate text-[12.5px] text-gray-500">
                    {ticketRequester(selectedTicket).name}
                    {ticketRequester(selectedTicket).email &&
                      ` · ${ticketRequester(selectedTicket).email}`}{' '}
                    ·{' '}
                    <button
                      type="button"
                      title="Copy conversation ID"
                      onClick={() => {
                        void navigator.clipboard.writeText(selectedTicket.external_id)
                        toast.success(`Copied ${selectedTicket.external_id}`)
                      }}
                      className="cursor-pointer font-mono underline-offset-2 hover:text-gray-900 hover:underline"
                    >
                      #{selectedTicket.external_id}
                    </button>
                  </p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {helpdeskTicketUrl(user, selectedTicket) && (
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href={helpdeskTicketUrl(user, selectedTicket)}
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
                {/* Thread and composer share a column so the reply box lines up
                    with the messages rather than running under the context
                    panel, which scrolls independently beside them. */}
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="min-h-0 flex-1 scrollbar-thin overflow-y-auto">
                    <TicketThread ticket={selectedTicket} onInsertDraft={setDraftReply} />
                  </div>

                  <Composer
                    ticketId={selectedTicket.id}
                    value={draftReply}
                    onChange={setDraftReply}
                  />
                </div>

                {contextOpen && (
                  <aside className="hidden w-[320px] shrink-0 scrollbar-thin overflow-y-auto border-l border-black/4 bg-black/0 px-0 py-5 pt-1 xl:block">
                    <ContextPanel fields={selectedTicket.contextFields} />
                  </aside>
                )}
              </div>
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
    </div>
  )
}
