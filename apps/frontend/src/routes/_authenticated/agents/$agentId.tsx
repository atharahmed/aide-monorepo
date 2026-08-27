import { useEffect, useState } from 'react'
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  Check,
  Copy,
  Globe,
  Headphones,
  Loader2,
  Mail,
  MessageSquare,
  Pause,
  Play,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { PageBody, PageHeader } from '@/components/page-header'
import { EmptyState, ErrorState } from '@/components/empty-state'
import { Sparkline } from '@/components/data-viz'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AgentPlayground } from '@/features/agents/playground'
import { AgentStatusBadge } from './index'
import {
  useAgent,
  useAgentActivity,
  useDeleteAgent,
  useKnowledgeDocuments,
  useSaveAgent,
  useSetAgentStatus,
  useWorkflows,
} from '@/lib/queries'
import { formatRelative } from '@/lib/format'
import type { Agent, AgentChannelSlug, Id } from '@/types/api'

type AgentTab = 'configure' | 'deploy' | 'activity'

export const Route = createFileRoute('/_authenticated/agents/$agentId')({
  /* The Agents section has no backend yet: node-api exposes no /v1/agents
   * routes. Park the screens behind a redirect rather than shipping a page
   * that can only error. Delete this block to switch the section back on. */
  beforeLoad: () => {
    throw redirect({ to: '/home' })
  },
  validateSearch: (search: Record<string, unknown>): { tab?: AgentTab } => ({
    tab: search.tab === 'deploy' || search.tab === 'activity' ? search.tab : 'configure',
  }),
  component: AgentDetailPage,
})

const TONES = [
  { value: 'concise', label: 'Concise' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'formal', label: 'Formal' },
  { value: 'playful', label: 'Playful' },
] as const

function AgentDetailPage() {
  const { agentId } = Route.useParams()
  const { tab = 'configure' } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  const { data: agent, isLoading, isError, refetch } = useAgent(agentId)
  const setStatus = useSetAgentStatus()
  const deleteAgent = useDeleteAgent()

  const [playgroundOpen, setPlaygroundOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (isLoading) {
    return (
      <>
        <PageHeader title="Agent" />
        <PageBody>
          <Skeleton className="h-64" />
        </PageBody>
      </>
    )
  }

  if (isError || !agent) {
    return (
      <>
        <PageHeader title="Agent" />
        <PageBody>
          <ErrorState
            title="Could not load this agent"
            description="It may have been deleted."
            action={
              <div className="flex gap-2">
                <Button size="sm" onClick={() => refetch()}>
                  Try again
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/agents">All agents</Link>
                </Button>
              </div>
            }
          />
        </PageBody>
      </>
    )
  }

  const deployed = agent.status === 'deployed'
  const hasChannel = agent.channels.some((channel) => channel.enabled)

  return (
    <>
      <PageHeader
        title={agent.name}
        description={agent.description || 'No description yet'}
        meta={<AgentStatusBadge status={agent.status} />}
        actions={
          <>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/agents">
                <ArrowLeft />
                All agents
              </Link>
            </Button>

            <Button variant="outline" size="sm" onClick={() => setPlaygroundOpen(true)}>
              <MessageSquare />
              Test
            </Button>

            <Button
              size="sm"
              disabled={setStatus.isPending || (!deployed && !hasChannel)}
              title={!deployed && !hasChannel ? 'Switch on a channel first' : undefined}
              onClick={() =>
                setStatus.mutate(
                  { id: agent.id, status: deployed ? 'paused' : 'deployed' },
                  {
                    onSuccess: () => toast.success(deployed ? 'Agent paused' : 'Agent deployed'),
                  }
                )
              }
            >
              {setStatus.isPending ? (
                <Loader2 className="animate-spin" />
              ) : deployed ? (
                <Pause />
              ) : (
                <Play />
              )}
              {deployed ? 'Pause' : 'Deploy'}
            </Button>
          </>
        }
        tabs={
          <Tabs
            value={tab}
            onValueChange={(value) => navigate({ search: { tab: value as AgentTab } })}
          >
            <TabsList className="mb-0">
              <TabsTrigger value="configure">Configure</TabsTrigger>
              <TabsTrigger value="deploy">Deploy</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      <PageBody>
        <Tabs value={tab}>
          <TabsContent value="configure">
            <ConfigureTab agent={agent} onDelete={() => setConfirmDelete(true)} />
          </TabsContent>
          <TabsContent value="deploy">
            <DeployTab agent={agent} />
          </TabsContent>
          <TabsContent value="activity">
            <ActivityTab agent={agent} />
          </TabsContent>
        </Tabs>
      </PageBody>

      <AgentPlayground agent={agent} open={playgroundOpen} onOpenChange={setPlaygroundOpen} />

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete “{agent.name}”?</DialogTitle>
            <DialogDescription>
              The agent stops answering everywhere immediately. Past conversations are kept.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Keep agent
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                deleteAgent.mutate(agent.id, {
                  onSuccess: () => {
                    toast.success('Agent deleted')
                    navigate({ to: '/agents' })
                  },
                })
              }
            >
              Delete agent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Configure                                                                   */
/* -------------------------------------------------------------------------- */

function ConfigureTab({ agent, onDelete }: { agent: Agent; onDelete: () => void }) {
  const saveAgent = useSaveAgent()
  const { data: workflowData } = useWorkflows()
  const { data: knowledge } = useKnowledgeDocuments()

  const [draft, setDraft] = useState(agent)
  useEffect(() => setDraft(agent), [agent])

  const dirty = JSON.stringify(draft) !== JSON.stringify(agent)
  const patch = (changes: Partial<Agent>) => setDraft((current) => ({ ...current, ...changes }))

  const toggleWorkflow = (id: Id) =>
    patch({
      workflow_ids: draft.workflow_ids.includes(id)
        ? draft.workflow_ids.filter((entry) => entry !== id)
        : [...draft.workflow_ids, id],
    })

  return (
    <div className="grid max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section className="flex flex-col gap-5">
        <div className="flex flex-col gap-3.5">
          <div>
            <Label htmlFor="agent-name">Name</Label>
            <Input
              id="agent-name"
              value={draft.name}
              onChange={(event) => patch({ name: event.target.value })}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="agent-description">Description</Label>
            <Input
              id="agent-description"
              value={draft.description}
              onChange={(event) => patch({ description: event.target.value })}
              className="mt-1.5"
              placeholder="What this agent handles, in one line."
            />
          </div>

          <div>
            <Label htmlFor="agent-instructions">Instructions</Label>
            <Textarea
              id="agent-instructions"
              value={draft.instructions}
              onChange={(event) => patch({ instructions: event.target.value })}
              className="mt-1.5 min-h-[160px]"
              placeholder="Tell the agent what it handles, what it must never do, and when to hand off to a human."
            />
            <p className="mt-1.5 text-[12px] text-gray-400">
              Be specific about hand-off. An agent that knows when to stop is more useful than one
              that always answers.
            </p>
          </div>

          <div className="max-w-[220px]">
            <Label>Tone</Label>
            <Select
              value={draft.tone}
              onValueChange={(value) => patch({ tone: value as Agent['tone'] })}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TONES.map((tone) => (
                  <SelectItem key={tone.value} value={tone.value}>
                    {tone.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        <div>
          <div className="flex items-start gap-4 rounded-[8px] border border-gray-200 bg-white px-4 py-3.5">
            <div className="min-w-0 flex-1">
              <Label htmlFor="use-knowledge">Answer from knowledge</Label>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-gray-500">
                Use the {(knowledge ?? []).length} articles in Knowledge. With this off the agent
                can only use its instructions.
              </p>
            </div>
            <Switch
              id="use-knowledge"
              className="mt-1"
              checked={draft.use_knowledge}
              onCheckedChange={(checked) => patch({ use_knowledge: checked })}
            />
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-[15px] font-medium text-gray-950">Scenarios</h3>
          <p className="mb-3 text-[12.5px] text-gray-500">
            Attached scenarios run before the agent answers, so their instructions and actions
            apply.
          </p>

          <div className="divide-y divide-gray-200 overflow-hidden rounded-[8px] border border-gray-200 bg-white">
            {(workflowData?.workflows ?? []).map((workflow) => (
              <label
                key={workflow.id}
                className="flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors hover:bg-gray-50"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] text-gray-950">{workflow.name}</span>
                  <span className="mt-0.5 block text-[12px] text-gray-400">
                    {workflow.actions.length} action{workflow.actions.length === 1 ? '' : 's'}
                  </span>
                </span>
                {!workflow.is_active && <Badge variant="neutral">Off</Badge>}
                <Switch
                  checked={draft.workflow_ids.includes(workflow.id)}
                  onCheckedChange={() => toggleWorkflow(workflow.id)}
                  aria-label={`Attach ${workflow.name}`}
                />
              </label>
            ))}

            {(workflowData?.workflows ?? []).length === 0 && (
              <p className="px-4 py-3 text-[12.5px] text-gray-400">
                No scenarios yet. Create one in Scenarios to attach it here.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            disabled={!dirty || saveAgent.isPending}
            onClick={() =>
              saveAgent.mutate(draft, { onSuccess: () => toast.success('Agent saved') })
            }
          >
            {saveAgent.isPending && <Loader2 className="animate-spin" />}
            {dirty ? 'Save changes' : 'Saved'}
          </Button>
          {dirty && (
            <Button variant="ghost" size="sm" onClick={() => setDraft(agent)}>
              Discard
            </Button>
          )}
        </div>
      </section>

      <aside className="flex flex-col gap-5">
        <div>
          <h3 className="mb-2 text-[15px] font-medium text-gray-950">Last 7 days</h3>
          <div className="rounded-[8px] border border-gray-200 bg-white p-4">
            <p className="text-[22px] leading-none font-semibold tracking-[-0.03em] text-gray-950 tabular-nums">
              {agent.interactions_7d.reduce((sum, value) => sum + value, 0)}
            </p>
            <p className="mt-1.5 text-[12px] text-gray-400">conversations answered</p>
            <Sparkline
              points={agent.interactions_7d}
              width={220}
              height={36}
              className="mt-3 w-full"
            />
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-[15px] font-medium text-gray-950">Details</h3>
          <dl className="flex flex-col gap-1.5 text-[12.5px]">
            <div className="flex justify-between">
              <dt className="text-gray-500">Created</dt>
              <dd className="text-gray-900">{formatRelative(agent.created_at)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Last active</dt>
              <dd className="text-gray-900">{formatRelative(agent.last_active_at)}</dd>
            </div>
          </dl>
        </div>

        <Separator />

        <Button
          variant="ghost"
          size="sm"
          className="self-start text-destructive-600"
          onClick={onDelete}
        >
          <Trash2 />
          Delete agent
        </Button>
      </aside>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Deploy                                                                      */
/* -------------------------------------------------------------------------- */

const CHANNELS: Array<{
  slug: AgentChannelSlug
  name: string
  icon: typeof Globe
  description: string
}> = [
  {
    slug: 'website',
    name: 'Website',
    icon: Globe,
    description: 'A chat bubble on your site. Paste one script tag before </body>.',
  },
  {
    slug: 'helpdesk',
    name: 'Helpdesk',
    icon: Headphones,
    description: 'Replies inside Zendesk or Front, as a normal agent would.',
  },
  {
    slug: 'email',
    name: 'Email',
    icon: Mail,
    description: 'Answers messages sent to a dedicated address.',
  },
]

function DeployTab({ agent }: { agent: Agent }) {
  const saveAgent = useSaveAgent()
  const [copied, setCopied] = useState(false)

  const website = agent.channels.find((channel) => channel.slug === 'website')
  const snippet = `<script
  src="https://cdn.aide.app/agent.js"
  data-agent="${website?.config.embed_id ?? ''}"
  defer
></script>`

  const toggleChannel = (slug: AgentChannelSlug, enabled: boolean) =>
    saveAgent.mutate(
      {
        id: agent.id,
        channels: agent.channels.map((channel) =>
          channel.slug === slug ? { ...channel, enabled } : channel
        ),
      },
      {
        onSuccess: () =>
          toast.success(enabled ? `${slug} channel switched on` : `${slug} channel switched off`),
      }
    )

  const copySnippet = async () => {
    await navigator.clipboard.writeText(snippet)
    setCopied(true)
    toast.success('Snippet copied')
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="flex max-w-3xl flex-col gap-3">
      {agent.status === 'draft' && (
        <div className="rounded-[8px] border border-warning-200 bg-warning-50 px-4 py-3 text-[12.5px] leading-relaxed text-warning-800">
          This agent is a draft. Switch on a channel here, then press Deploy in the header to make
          it live.
        </div>
      )}

      {CHANNELS.map((channel) => {
        const state = agent.channels.find((entry) => entry.slug === channel.slug)
        const enabled = state?.enabled ?? false

        return (
          <div
            key={channel.slug}
            className={cn(
              'rounded-[8px] border bg-white',
              enabled ? 'border-gray-300' : 'border-gray-200'
            )}
          >
            <div className="flex items-start gap-3 p-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-[8px] border border-gray-200 bg-gray-50">
                <channel.icon className="size-4 text-gray-500" />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-[13.5px] font-medium text-gray-950">{channel.name}</h3>
                  {enabled && <Badge variant="success">On</Badge>}
                </div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-gray-500">
                  {channel.description}
                </p>
              </div>

              <Switch
                className="mt-1"
                checked={enabled}
                onCheckedChange={(checked) => toggleChannel(channel.slug, checked)}
                aria-label={`Switch ${channel.name} ${enabled ? 'off' : 'on'}`}
              />
            </div>

            {channel.slug === 'website' && enabled && (
              <div className="border-t border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-[10.5px] tracking-wide text-gray-400 uppercase">
                    Embed snippet
                  </p>
                  <Button variant="ghost" size="sm" onClick={copySnippet}>
                    {copied ? <Check /> : <Copy />}
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
                <pre className="mt-2 overflow-x-auto rounded-[6px] bg-gray-950 px-3 py-2.5 font-mono text-[11.5px] leading-relaxed text-gray-100">
                  {snippet}
                </pre>
              </div>
            )}

            {channel.slug === 'helpdesk' && enabled && (
              <div className="border-t border-gray-200 px-4 py-3">
                <p className="text-[12.5px] text-gray-500">
                  Replying through{' '}
                  <span className="font-medium text-gray-950">{state?.config.provider}</span>.
                  Change this in Integrations.
                </p>
              </div>
            )}

            {channel.slug === 'email' && enabled && (
              <div className="border-t border-gray-200 px-4 py-3">
                <p className="text-[12.5px] text-gray-500">
                  Answering messages sent to{' '}
                  <span className="font-medium text-gray-950">{state?.config.address}</span>.
                </p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Activity                                                                    */
/* -------------------------------------------------------------------------- */

const OUTCOME_LABEL = {
  resolved: 'Resolved',
  handed_off: 'Handed off',
  no_answer: 'No answer',
} as const

function ActivityTab({ agent }: { agent: Agent }) {
  const { data: rows, isLoading } = useAgentActivity(agent.id)

  if (isLoading) return <Skeleton className="h-64" />

  if ((rows ?? []).length === 0) {
    return (
      <EmptyState
        icon={<MessageSquare className="size-4" />}
        title="No conversations yet"
        description={
          agent.status === 'deployed'
            ? 'This agent is live but has not been asked anything yet.'
            : 'Deploy the agent to start seeing the conversations it handles.'
        }
      />
    )
  }

  return (
    <div className="max-w-4xl overflow-hidden rounded-[8px] border border-gray-200 bg-white">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead>Conversation</TableHead>
            <TableHead className="w-[110px]">Channel</TableHead>
            <TableHead className="w-[120px]">Outcome</TableHead>
            <TableHead className="w-[90px] text-right">Messages</TableHead>
            <TableHead className="w-[120px] text-right">When</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(rows ?? []).map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium text-gray-950">{row.subject}</TableCell>
              <TableCell className="text-gray-500 capitalize">{row.channel}</TableCell>
              <TableCell>
                {row.outcome === 'resolved' ? (
                  <Badge variant="success">{OUTCOME_LABEL.resolved}</Badge>
                ) : row.outcome === 'handed_off' ? (
                  <Badge variant="info">{OUTCOME_LABEL.handed_off}</Badge>
                ) : (
                  <Badge variant="warning">{OUTCOME_LABEL.no_answer}</Badge>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">{row.messages}</TableCell>
              <TableCell className="text-right text-gray-500">
                {formatRelative(row.created_at)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
