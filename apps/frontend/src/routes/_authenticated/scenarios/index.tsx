import { useMemo, useState } from 'react'
import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { Loader2, Plus, Sparkles, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { PageBody, PageHeader } from '@/components/page-header'
import { EmptyState, ErrorState } from '@/components/empty-state'
import { Badge, StatusDot } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { OnboardingReminders } from '@/features/onboarding/components'
import { ScenarioEditor } from '@/features/scenarios/editor'
import { useCreateWorkflow, useImportWorkflow, useMe, useWorkflows } from '@/lib/queries'
import { searchId } from '@/lib/search'
import type { Id, Workflow, WorkflowTemplate } from '@/types/api'

export const Route = createFileRoute('/_authenticated/scenarios/')({
  validateSearch: (search: Record<string, unknown>): { scenario?: Id } => ({
    scenario: searchId(search.scenario),
  }),
  component: ScenariosPage,
})

function ScenariosPage() {
  const { scenario: selectedId } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const { data: user } = useMe()

  const { data, isLoading, isError, refetch } = useWorkflows()
  const createWorkflow = useCreateWorkflow()
  const [templatesOpen, setTemplatesOpen] = useState(false)

  const workflows = data?.workflows ?? []
  const selected = workflows.find((workflow) => workflow.id === selectedId) ?? workflows[0]

  const select = (id: Id) =>
    navigate({ search: (current) => ({ ...current, scenario: id }), replace: true })

  const create = () =>
    createWorkflow.mutate(undefined, {
      onSuccess: (result) => {
        select(result.workflow.id)
        toast.success('Scenario created — add a condition to switch it on')
      },
    })

  return (
    <>
      <PageHeader
        title="Scenarios"
        description="Rules that decide what Aide does when a conversation matches."
        actions={
          <>
            <OnboardingReminders user={user} page="workflows" className="mr-1 hidden lg:flex" />
            <Button variant="outline" size="sm" onClick={() => setTemplatesOpen(true)}>
              <Sparkles />
              Start from a template
            </Button>
            <Button size="sm" onClick={create} disabled={createWorkflow.isPending}>
              {createWorkflow.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
              New scenario
            </Button>
          </>
        }
        tabs={
          <Tabs value="scenarios">
            <TabsList className="mb-0">
              <TabsTrigger value="scenarios">Scenarios</TabsTrigger>
              <TabsTrigger value="macros" asChild>
                <Link to="/scenarios/macros">Macros</Link>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      {isLoading ? (
        <PageBody>
          <Skeleton className="h-64" />
        </PageBody>
      ) : isError ? (
        <PageBody>
          <ErrorState
            title="Could not load scenarios"
            action={
              <Button size="sm" onClick={() => refetch()}>
                Try again
              </Button>
            }
          />
        </PageBody>
      ) : workflows.length === 0 ? (
        <PageBody>
          <EmptyState
            icon={<Zap className="size-4" />}
            title="No scenarios yet"
            description="A scenario watches for a condition — a topic, a tag, an order status — and runs actions when it matches."
            action={<Button onClick={create}>Create your first scenario</Button>}
          />
        </PageBody>
      ) : (
        <div className="flex min-h-0 flex-1">
          <div className="w-full shrink-0 scrollbar-thin overflow-y-auto border-r border-gray-200 bg-white lg:w-[320px]">
            <ScenarioList workflows={workflows} selectedId={selected?.id} onSelect={select} />
          </div>

          <div className="hidden min-w-0 flex-1 scrollbar-thin overflow-y-auto bg-white lg:block">
            {selected && data ? (
              <ScenarioEditor key={selected.id} workflow={selected} data={data} />
            ) : (
              <div className="p-6">
                <EmptyState
                  icon={<Zap className="size-4" />}
                  title="Select a scenario"
                  description="Pick one to edit its conditions and actions."
                />
              </div>
            )}
          </div>
        </div>
      )}

      <TemplatesDialog
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        templates={data?.workflowTemplates ?? []}
      />
    </>
  )
}

/** Grouped by the topic each scenario watches, so related rules sit together. */
function ScenarioList({
  workflows,
  selectedId,
  onSelect,
}: {
  workflows: Workflow[]
  selectedId?: Id
  onSelect: (id: Id) => void
}) {
  const groups = useMemo(() => {
    const map = new Map<string, Workflow[]>()
    for (const workflow of workflows) {
      const key = workflow.apply_always
        ? 'Applies to everything'
        : workflow.conditions.length === 0
          ? 'Not configured'
          : 'By condition'
      const list = map.get(key) ?? []
      list.push(workflow)
      map.set(key, list)
    }
    return [...map.entries()]
  }, [workflows])

  return (
    <div className="py-2">
      {groups.map(([group, entries]) => (
        <div key={group} className="mb-2">
          <p className="px-4 py-1.5 text-[11px] font-medium tracking-wide text-gray-400 uppercase">
            {group}
          </p>
          {entries.map((workflow) => (
            <button
              key={workflow.id}
              type="button"
              onClick={() => onSelect(workflow.id)}
              className={cn(
                'w-full px-4 py-2.5 text-left transition-colors',
                selectedId === workflow.id ? 'bg-gray-100' : 'hover:bg-gray-100'
              )}
            >
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-gray-950">
                  {workflow.name}
                </span>
                {workflow.is_active ? (
                  <Badge variant="success">
                    <StatusDot />
                    On
                  </Badge>
                ) : (
                  <Badge variant="neutral">Off</Badge>
                )}
              </div>
              <p className="mt-0.5 text-[12px] text-gray-400">
                {workflow.actions.length} action{workflow.actions.length === 1 ? '' : 's'}
                {workflow.times_run !== null && ` · ran ${workflow.times_run} times`}
              </p>
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

function TemplatesDialog({
  open,
  onOpenChange,
  templates,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  templates: WorkflowTemplate[]
}) {
  const importWorkflow = useImportWorkflow()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Start from a template</DialogTitle>
          <DialogDescription>
            Templates arrive switched off, so you can adjust the conditions before anything runs.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          {templates.map((template) => (
            <button
              key={template.name}
              type="button"
              disabled={importWorkflow.isPending}
              onClick={() =>
                importWorkflow.mutate(template, {
                  onSuccess: () => {
                    onOpenChange(false)
                    toast.success(`Added “${template.name}”`)
                  },
                })
              }
              className="rounded-[8px] border border-gray-200 p-3 text-left transition-colors hover:border-gray-300"
            >
              <p className="text-[13.5px] font-medium text-gray-950">{template.name}</p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-gray-500">
                {template.description}
              </p>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
