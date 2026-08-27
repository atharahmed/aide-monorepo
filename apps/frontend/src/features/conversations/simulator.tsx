import { useState } from 'react'
import { Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/empty-state'
import { MessagesSquare } from 'lucide-react'
import { useMe, useSimulator } from '@/lib/queries'
import { truncate } from '@/lib/format'
import { TicketThread } from './thread'
import { SimulatorContext, encodeContextFields, simulatableFields } from './simulator-context'
import type { Ticket } from '@/types/api'

const STARTERS = [
  'Where is my order #48213?',
  'The jacket I got is too small — can I swap it for a large?',
  'My tent poles arrived snapped in half.',
  'How do I wash the Ridgeline shell?',
]

/**
 * The simulator is a conversation you write both halves of: type what a
 * customer would say and watch what Aide would have replied, including which
 * topics fired and which articles it answered from.
 */
export function Simulator({
  ticket,
  onTicketChange,
}: {
  ticket?: Ticket
  onTicketChange: (ticket: Ticket) => void
}) {
  const [message, setMessage] = useState('')
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({})
  const simulate = useSimulator()

  const { data: user } = useMe()
  const fields = simulatableFields(user?.team?.ticket_fields, user?.team?.user_fields)

  const send = (text: string) => {
    const body = text.trim()
    if (!body) return

    simulate.mutate(
      {
        body,
        ticketId: ticket?.id,
        /* A subject is required in practice: the backend runs its field
         * extraction regexes over it and throws on a ticket without one. */
        subject: ticket?.subject ?? truncate(body, 80),
        /* Only meaningful on the first message — after that the conversation
         * carries whatever context the backend resolved for it. */
        contextFields: ticket ? undefined : encodeContextFields(fields, fieldValues),
      },
      {
        onSuccess: (result) => {
          setMessage('')
          onTicketChange(result.ticket)
        },
        onError: () => toast.error('The simulator could not answer. Try again.'),
      }
    )
  }

  return (
    <div className="flex min-h-0 flex-1 bg-white">
      {/* Thread and composer share a column, with context beside them — the
          same three-pane shape as the conversations page. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 scrollbar-thin overflow-y-auto">
          {ticket ? (
            <TicketThread ticket={ticket} onInsertDraft={setMessage} />
          ) : (
            <div className="p-5 pt-40">
              <EmptyState
                icon={<MessagesSquare className="size-4" />}
                title="Try a conversation before your customers do"
                description="Role-play as a customer and ask questions. Aide will answer with the same topics, scenarios and knowledge it uses on real conversations."
              />
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {STARTERS.map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    onClick={() => send(starter)}
                    disabled={simulate.isPending}
                    className="rounded-[10px] bg-black/3 px-3 py-1.5 text-[14px] text-gray-700 transition-colors hover:bg-black/5 hover:text-gray-950 cursor-pointer font-medium"
                  >
                    {starter}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white p-3 mb-14">
          <div className="rounded-[14px] border border-gray-200 focus-within:border-gray-400">
            <Textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Write what a customer would say…  ⌘↵ to send"
              className="min-h-[72px] resize-y border-0 focus-visible:border-0"
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault()
                  send(message)
                }
              }}
            />
            <div className="flex items-center gap-2 border-t border-gray-200 px-2 py-1.5">
              <span className="text-[11.5px] text-gray-400">Nothing here reaches a customer</span>
              <Button
                size="sm"
                className="ml-auto"
                onClick={() => send(message)}
                disabled={simulate.isPending || message.trim().length === 0}
              >
                {simulate.isPending ? <Loader2 className="animate-spin" /> : <Send />}
                Send
              </Button>
            </div>
          </div>
        </div>
      </div>

      <aside className="hidden w-[260px] shrink-0 scrollbar-thin overflow-y-auto border-none border-gray-200 bg-gray-50 px-4 py-5 xl:block">
        <SimulatorContext
          ticket={ticket}
          fields={fields}
          values={fieldValues}
          onChange={(fieldKey, value) =>
            setFieldValues((current) => ({ ...current, [fieldKey]: value }))
          }
        />
      </aside>
    </div>
  )
}
