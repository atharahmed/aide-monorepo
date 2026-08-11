import { ExternalLink } from 'lucide-react'
import type { ContextField, TicketPayload } from '@/types/api'
import type { Me } from '@/types/api'

/** Deep link back into the helpdesk the conversation came from. */
export function helpdeskUrl(user: Me | undefined, ticket: TicketPayload) {
  if (ticket.source_id === 1) return `https://app.frontapp.com/open/${ticket.external_id}`
  if (ticket.source_id === 2 && user?.team?.zendesk_subdomain) {
    return `https://${user.team.zendesk_subdomain}.zendesk.com/agent/tickets/${ticket.external_id}`
  }
  return undefined
}

/** Customer, order and CRM fields pulled from the connected integrations. */
export function ContextPanel({ fields }: { fields: ContextField[] }) {
  if (fields.length === 0) return null

  const groups = fields.reduce<Record<string, ContextField[]>>((accumulator, field) => {
    ;(accumulator[field.group] ||= []).push(field)
    return accumulator
  }, {})

  return (
    <div className="flex flex-col gap-5">
      {Object.entries(groups).map(([group, groupFields]) => (
        <section key={group}>
          <p className="mb-2 text-[11px] font-medium tracking-wide text-gray-400 uppercase">
            {group}
          </p>
          <dl className="flex flex-col gap-1.5">
            {groupFields.map((field) => (
              <div key={field.key} className="flex items-baseline gap-3">
                <dt className="w-[104px] shrink-0 text-[12.5px] text-gray-500">{field.label}</dt>
                <dd className="min-w-0 flex-1 text-[12.5px] break-words text-gray-900">
                  {field.url ? (
                    <a
                      href={field.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 hover:underline"
                    >
                      {field.value}
                      <ExternalLink className="size-3 text-gray-400" />
                    </a>
                  ) : (
                    field.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  )
}
