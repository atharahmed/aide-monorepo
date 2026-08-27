import { useState } from 'react'
import { BookOpen, Loader2, Send, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useTestAgent } from '@/lib/queries'
import type { Agent, Id } from '@/types/api'

interface Turn {
  role: 'you' | 'agent'
  text: string
  knowledge?: Array<{ id: Id; title: string; blurb: string }>
}

const STARTERS = [
  'Where is my order?',
  'Can I return this?',
  'Which size should I get?',
  'My package arrived damaged.',
]

/** Right-side chat playground. Nothing here reaches a customer. */
export function AgentPlayground({
  agent,
  open,
  onOpenChange,
}: {
  agent: Agent
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [turns, setTurns] = useState<Turn[]>([])
  const [message, setMessage] = useState('')
  const testAgent = useTestAgent(agent.id)

  const send = (text: string) => {
    const body = text.trim()
    if (!body) return

    setTurns((current) => [...current, { role: 'you', text: body }])
    setMessage('')

    testAgent.mutate(body, {
      onSuccess: (result) =>
        setTurns((current) => [
          ...current,
          { role: 'agent', text: result.reply, knowledge: result.knowledge_used },
        ]),
      onError: () =>
        setTurns((current) => [
          ...current,
          { role: 'agent', text: 'The agent could not answer just now. Try again.' },
        ]),
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Test {agent.name}</SheetTitle>
          <SheetDescription>
            Talk to the agent as a customer would. Nothing here is sent to anyone.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 scrollbar-thin overflow-y-auto px-5 py-4">
          {turns.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <span className="flex size-9 items-center justify-center rounded-[8px] border border-gray-200 bg-gray-50">
                <Sparkles className="size-4 text-gray-400" />
              </span>
              <p className="mt-3 text-[13.5px] font-medium text-gray-950">Start a conversation</p>
              <p className="mt-1 max-w-xs text-[12.5px] leading-relaxed text-gray-500">
                The agent answers from your knowledge and the instructions on the Configure tab.
              </p>

              <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                {STARTERS.map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    onClick={() => send(starter)}
                    className="rounded-full border border-gray-200 px-2.5 py-1 text-[12px] text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-950"
                  >
                    {starter}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {turns.map((turn, index) => (
                <div
                  key={index}
                  className={turn.role === 'you' ? 'flex justify-end' : 'flex justify-start'}
                >
                  <div className="max-w-[85%]">
                    <div
                      className={
                        turn.role === 'you'
                          ? 'rounded-[8px] bg-gray-950 px-3 py-2 text-[13px] leading-relaxed text-gray-50'
                          : 'rounded-[8px] border border-gray-200 bg-white px-3 py-2 text-[13px] leading-relaxed text-gray-800'
                      }
                    >
                      {turn.text}
                    </div>

                    {turn.knowledge && turn.knowledge.length > 0 && (
                      <div className="mt-1.5">
                        <p className="mb-1 font-mono text-[10.5px] tracking-wide text-gray-400 uppercase">
                          Answered from
                        </p>
                        <ul className="flex flex-col gap-1">
                          {turn.knowledge.map((article) => (
                            <li
                              key={article.id}
                              className="flex items-start gap-1.5 text-[12px] text-gray-500"
                            >
                              <BookOpen className="mt-0.5 size-3 shrink-0 text-gray-400" />
                              {article.title}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {testAgent.isPending && (
                <div className="flex justify-start">
                  <div className="rounded-[8px] border border-gray-200 bg-white px-3 py-2">
                    <Loader2 className="size-3.5 animate-spin text-gray-400" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 p-3">
          <div className="rounded-[8px] border border-gray-200 focus-within:border-gray-400">
            <Textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Ask something a customer would ask…"
              className="min-h-[60px] resize-none border-0 focus-visible:border-0"
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  send(message)
                }
              }}
            />
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className="text-[11.5px] text-gray-400">Enter to send</span>
              <Button
                size="sm"
                onClick={() => send(message)}
                disabled={testAgent.isPending || message.trim().length === 0}
              >
                <Send />
                Send
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
