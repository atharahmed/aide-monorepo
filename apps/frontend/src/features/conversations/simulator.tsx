import { useState } from 'react'
import { Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/empty-state'
import { MessagesSquare } from 'lucide-react'
import { useSimulator } from '@/lib/queries'
import { TicketThread } from './thread'
import type { TicketPayload } from '@/types/api'

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
  ticket?: TicketPayload
  onTicketChange: (ticket: TicketPayload) => void
}) {
  const [message, setMessage] = useState('')
  const simulate = useSimulator()

  const send = (text: string) => {
    const body = text.trim()
    if (!body) return

    simulate.mutate(
      { message: body, ticketId: ticket?.id },
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
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 scrollbar-thin overflow-y-auto">
        {ticket ? (
          <TicketThread ticket={ticket} onInsertDraft={setMessage} />
        ) : (
          <div className="p-5">
            <EmptyState
              icon={<MessagesSquare className="size-4" />}
              title="Try a conversation before your customers do"
              description="Write what a customer might say. Aide answers with the same topics, scenarios and knowledge it uses on real conversations."
            />
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {STARTERS.map((starter) => (
                <button
                  key={starter}
                  type="button"
                  onClick={() => send(starter)}
                  disabled={simulate.isPending}
                  className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[12.5px] text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-950"
                >
                  {starter}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-gray-200 bg-white p-3">
        <div className="rounded-[8px] border border-gray-200 focus-within:border-gray-400">
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
  )
}
