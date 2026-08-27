import type { Id, Me, Ticket } from '@/types/api'

/**
 * Deep links back into the helpdesk a conversation came from.
 *
 * Tickets are matched on `source_id`, a fixed lookup table in the backend
 * (`FrontService.sourceId` and friends) rather than anything the API sends by
 * name. Ids arrive as strings, so comparisons are made against strings.
 */
export const TICKET_SOURCE = {
  front: '1',
  zendesk: '2',
  gmail: '6',
  gorgias: '8',
} as const

/** The little a ticket needs to be linked — activation tickets carry only this. */
interface LinkableTicket {
  source_id: Id
  external_id: string
}

export function helpdeskTicketUrl(
  user: Me | undefined,
  ticket: LinkableTicket | undefined
): string | undefined {
  if (!ticket) return undefined

  if (ticket.source_id === TICKET_SOURCE.front) {
    return `https://app.frontapp.com/open/${ticket.external_id}`
  }

  if (ticket.source_id === TICKET_SOURCE.zendesk && user?.team?.zendesk_subdomain) {
    return `https://${user.team.zendesk_subdomain}.zendesk.com/agent/tickets/${ticket.external_id}`
  }

  return undefined
}

/**
 * Who a conversation is with.
 *
 * There is no `requester` on the wire. The helpdesks put the customer's details
 * on their messages, so the first inbound comment is the reliable source; a
 * matched CRM contact is preferred when one exists, since it carries the name
 * the business uses rather than whatever the mail header said.
 */
export function ticketRequester(ticket: Ticket): { name: string; email: string } {
  const contact = ticket.contact?.[0]
  const firstInbound = ticket.comments.find((comment) => comment.is_customer_reply)

  return {
    name:
      contact?.name || firstInbound?.from_name || firstInbound?.from_handle || 'Unknown customer',
    email: contact?.email || firstInbound?.from_handle || '',
  }
}
