import { useEffect, useRef } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useCreateAgent } from '@/lib/queries'

/**
 * `/agents/new` creates a draft and hands off to the detail page, so there is
 * only ever one editor to maintain.
 */
export const Route = createFileRoute('/_authenticated/agents/new')({
  component: NewAgentPage,
})

function NewAgentPage() {
  const navigate = useNavigate()
  const createAgent = useCreateAgent()
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    createAgent.mutate(
      { name: 'Untitled agent' },
      {
        onSuccess: (agent) =>
          navigate({
            to: '/agents/$agentId',
            params: { agentId: String(agent.id) },
            replace: true,
          }),
        onError: () => {
          toast.error('Could not create the agent.')
          navigate({ to: '/agents', replace: true })
        },
      }
    )
  }, [createAgent, navigate])

  return (
    <div className="flex flex-1 items-center justify-center">
      <p className="flex items-center gap-2 text-[13px] text-gray-500">
        <Loader2 className="size-4 animate-spin text-gray-400" />
        Creating your agent…
      </p>
    </div>
  )
}
