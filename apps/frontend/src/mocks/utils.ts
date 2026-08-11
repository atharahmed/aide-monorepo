import { delay } from 'msw'
import type { TicketFilterType, TicketPayload } from '@/types/api'

/** Artificial latency so loading skeletons are actually visible in the demo. */
export const latency = () => delay(150 + Math.floor(Math.random() * 250))

/** `MM-dd-yyyy`, the format the tickets endpoint expects for `from`/`until`. */
export function parseApiDate(value: string | null): Date | undefined {
  if (!value) return undefined
  const [month, day, year] = value.split('-').map(Number)
  if (!month || !day || !year) return undefined
  return new Date(year, month - 1, day)
}

export function formatApiDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${date.getFullYear()}`
}

const SIMULATOR_SLUGS = ['chat_test']

/**
 * Mirrors `TicketService.search` on the backend: view ids are ANDed together,
 * and each maps to a predicate over the ticket's AI artefacts.
 */
export function matchesView(ticket: TicketPayload, view: TicketFilterType): boolean {
  const isSimulator = SIMULATOR_SLUGS.includes(ticket.ticket_source_slug)

  switch (view) {
    case 'ELIGIBLE':
      return !ticket.not_eligible && !isSimulator
    case 'SIMULATOR':
      return isSimulator
    case 'OPEN':
      return !ticket.latest_comment_is_agent_reply
    case 'SENT':
      return ticket.latest_comment_is_agent_reply
    case 'ANY_TOPIC':
      return ticket.cards.length > 0
    case 'NO_TOPIC':
      return ticket.cards.length === 0
    case 'ANY_WORKFLOW_ACTION_EXECUTED':
      return ticket.executedWorkflows.length > 0
    case 'ANY_WORKFLOW_TEXT_ACTION_EXECUTED':
      return ticket.executedWorkflows.some((executed) =>
        executed.actions.some((action) =>
          ['GENERATIVE_REPLY', 'TEXT_REPLY'].includes(action.action_type)
        )
      )
    case 'ANY_WORKFLOW_NON_TEXT_ACTION_EXECUTED':
      return ticket.executedWorkflows.some((executed) =>
        executed.actions.some(
          (action) => !['GENERATIVE_REPLY', 'TEXT_REPLY'].includes(action.action_type)
        )
      )
    case 'ANY_WORKFLOW_ACTION_CLOSED':
      return ticket.executedWorkflows.some((executed) =>
        executed.actions.some((action) => action.action_type === 'CLOSE_TICKET')
      )
    case 'ANY_WORKFLOW_ACTION_NOT_CLOSED':
      return ticket.executedWorkflows.some((executed) =>
        executed.actions.every((action) => action.action_type !== 'CLOSE_TICKET')
      )
    case 'ANY_WORKFLOW_ACTION_SUGGESTED':
      return ticket.executedWorkflows.some((executed) =>
        executed.actions.some((action) => action.action_type === 'MACRO')
      )
    case 'ANY_WORKFLOW_ACTION_SUGGESTION_USED':
      return ticket.executedWorkflows.some(
        (executed) =>
          executed.feedback.saved &&
          executed.actions.some((action) => action.action_type === 'MACRO')
      )
    case 'DRAFT_EXISTS':
      return ticket.drafts.length > 0
    case 'DRAFT_INSERTED':
      return ticket.drafts.some((draft) => draft.inserted)
    case 'DRAFT_NOT_INSERTED':
      return ticket.drafts.length > 0 && ticket.drafts.every((draft) => !draft.inserted)
    case 'DRAFT_AUTOMATICALLY_GENERATED':
      return ticket.drafts.some((draft) => draft.task_name === 'RESPONSE')
    case 'DRAFT_MANUALLY_GENERATED':
      return ticket.drafts.some((draft) => draft.task_name === 'MANUAL_RESPONSE')
    case 'TOPIC_POSITIVE_FEEDBACK':
      return ticket.cards.some((card) => card.feedback.saved && card.feedback.savedPositive)
    case 'TOPIC_NEGATIVE_FEEDBACK':
      return ticket.cards.some((card) => card.feedback.saved && !card.feedback.savedPositive)
    case 'WORKFLOW_POSITIVE_FEEDBACK':
      return ticket.executedWorkflows.some(
        (executed) => executed.feedback.saved && executed.feedback.savedPass
      )
    case 'WORKFLOW_NEGATIVE_FEEDBACK':
      return ticket.executedWorkflows.some(
        (executed) => executed.feedback.saved && !executed.feedback.savedPass
      )
    case 'DRAFT_POSITIVE_FEEDBACK':
      return ticket.drafts.some((draft) => draft.feedback.saved && draft.feedback.savedGood)
    case 'DRAFT_NEGATIVE_FEEDBACK':
      return ticket.drafts.some((draft) => draft.feedback.saved && !draft.feedback.savedGood)
    default:
      return true
  }
}

export interface TicketQuery {
  viewIds?: TicketFilterType[]
  topicIds?: number[]
  workflowIds?: number[]
  ticketIds?: number[]
  from?: Date
  until?: Date
}

export function filterTickets(tickets: TicketPayload[], query: TicketQuery): TicketPayload[] {
  return tickets.filter((ticket) => {
    if (query.viewIds?.length && !query.viewIds.every((view) => matchesView(ticket, view))) {
      return false
    }
    /* No explicit simulator view means simulator conversations stay hidden,
     * which is how the v5 list behaves. */
    if (
      !query.viewIds?.includes('SIMULATOR') &&
      !query.ticketIds?.length &&
      ticket.ticket_source_slug === 'chat_test'
    ) {
      return false
    }
    if (query.topicIds?.length) {
      if (!ticket.cards.some((card) => query.topicIds!.includes(card.id))) return false
    }
    if (query.workflowIds?.length) {
      const ran = ticket.executedWorkflows.some((executed) =>
        query.workflowIds!.some((id) =>
          executed.actions.some((action) => action.workflow_id === id)
        )
      )
      if (!ran) return false
    }
    if (query.ticketIds?.length && !query.ticketIds.includes(ticket.id)) return false

    const createdAt = new Date(ticket.external_created_at).getTime()
    if (query.from && createdAt < query.from.getTime()) return false
    if (query.until && createdAt > query.until.getTime()) return false

    return true
  })
}

export function parseTicketQuery(url: URL): TicketQuery {
  const list = (key: string) => url.searchParams.get(key)?.split('-').filter(Boolean)
  const from = parseApiDate(url.searchParams.get('from'))
  const until = parseApiDate(url.searchParams.get('until'))
  if (until) until.setHours(23, 59, 59, 999)

  return {
    viewIds: list('viewIds')?.map((value) => value.toUpperCase() as TicketFilterType),
    topicIds: list('topicIds')?.map(Number),
    workflowIds: list('workflowIds')?.map(Number),
    ticketIds: list('ticketIds')?.map(Number),
    from,
    until,
  }
}

/** Builds the `?viewIds=…&from=…` strings the reports endpoint hands back. */
export function serializeSearchParams(options: {
  viewIds?: TicketFilterType[]
  from?: Date
  until?: Date
}): string {
  const params = new URLSearchParams()
  if (options.viewIds?.length) params.set('viewIds', options.viewIds.join('-'))
  if (options.from) params.set('from', formatApiDate(options.from))
  if (options.until) params.set('until', formatApiDate(options.until))
  return params.toString()
}
