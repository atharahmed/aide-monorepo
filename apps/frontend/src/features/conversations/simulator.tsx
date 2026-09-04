import { useEffect, useRef, useState } from 'react'
import { ArrowBigUp, ArrowBigUpIcon, Loader2, LucideArrowBigUp, Send, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
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

/** Controls that should keep focus instead of the composer. */
function holdsOwnFocus(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(
    target.closest(
      'input, textarea, select, [contenteditable="true"], [role="listbox"], [role="menu"], [role="dialog"], [role="combobox"], [data-radix-popper-content-wrapper]'
    )
  )
}

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
  const composerRef = useRef<HTMLTextAreaElement>(null)
  const simulate = useSimulator()

  useEffect(() => {
    const composer = composerRef.current
    composer?.focus()

    const restore = () => {
      requestAnimationFrame(() => {
        if (!composerRef.current) return
        if (holdsOwnFocus(document.activeElement)) return
        const selection = window.getSelection()
        if (selection && !selection.isCollapsed && selection.toString().length > 0) return
        composerRef.current.focus()
      })
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (holdsOwnFocus(document.activeElement) || document.activeElement === composerRef.current) {
        return
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key.length !== 1) return
      composerRef.current?.focus()
    }

    document.addEventListener('pointerup', restore)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerup', restore)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

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
          composerRef.current?.focus()
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
        {ticket && (
          <div className="flex items-start gap-3 border-b border-black/5 px-5 py-3">
            <h2 className="min-w-0 flex-1 truncate text-[17px] font-medium text-gray-950">
              {ticket.subject ?? '(no subject)'}
            </h2>
          </div>
        )}
        <div
          id="chat-inner"
          className={cn('flex min-w-0 flex-1 flex-col', !ticket && 'mx-auto max-w-2xl')}
        >
          <div className="min-h-0 flex-1 scrollbar-thin overflow-y-auto">
            {ticket ? (
              <TicketThread
                ticket={ticket}
                onInsertDraft={(text) => {
                  setMessage(text)
                  composerRef.current?.focus()
                }}
              />
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
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => send(starter)}
                      disabled={simulate.isPending}
                      className="cursor-pointer rounded-[10px] bg-black/3 px-3 py-1.5 text-[12.5px] font-medium text-gray-700 transition-colors hover:bg-black/5 hover:text-gray-950"
                    >
                      {starter}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className={cn('p-3', ticket && 'border-t border-black/5')}>
            <div className="mb-1.5 flex flex-row rounded-[24px] border border-gray-100 bg-white pr-3 focus-within:border-gray-300 focus-within:shadow-light">
              <Textarea
                ref={composerRef}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Write what a customer would say…  ⌘↵ to send"
                autoFocus
                className="min-h-[24px] resize-none rounded-l-[24px] border-0 pt-5 pl-4 focus-visible:border-0"
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                    event.preventDefault()
                    send(message)
                  }
                }}
              />
              <div className="flex items-center gap-2 px-2 py-1.5">
                <Button
                  size="lg"
                  className="ml-auto"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => send(message)}
                  disabled={simulate.isPending || message.trim().length === 0}
                >
                  {simulate.isPending ? <Loader2 className="animate-spin" /> : <ArrowBigUpIcon />}
                </Button>
              </div>
            </div>
            <span className="flex justify-center self-center text-center text-[12px] font-normal text-gray-400">
              This is an isolated testing environment. Nothing you send here reaches a customer
            </span>
          </div>
        </div>
      </div>

      <aside className="hidden w-[320px] shrink-0 scrollbar-thin overflow-y-auto border-l border-black/3 py-3 xl:block">
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
