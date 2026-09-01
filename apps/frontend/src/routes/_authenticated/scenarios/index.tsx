import { Fragment, useMemo, useState, type ReactNode } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ChevronRight, Loader2, Plus, Sparkles, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/page-header'
import { EmptyState, ErrorState } from '@/components/empty-state'
import { Badge, StatusDot } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { OnboardingReminders } from '@/features/onboarding/components'
import { ScenarioEditor } from '@/features/scenarios/editor'
import { ScenariosTabs } from '@/features/scenarios/tabs'
import { useCards, useCreateWorkflow, useImportWorkflow, useMe, useWorkflows } from '@/lib/queries'
import { searchId } from '@/lib/search'
import { conditionMeta } from '@/lib/conditions'
import type {
  Category,
  ConditionDropdownOption,
  Id,
  Workflow,
  WorkflowConditionType,
  WorkflowTemplate,
} from '@/types/api'

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
  const { data: cards } = useCards(false)
  const createWorkflow = useCreateWorkflow()
  const [templatesOpen, setTemplatesOpen] = useState(false)

  const workflows = data?.workflows ?? []
  const categories = cards?.data ?? []
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
    <div className="flex min-h-0 flex-1 flex-col">
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
      />

      <div className="flex min-h-0 flex-1">
        <div className="flex w-full shrink-0 flex-col border-r border-gray-100 bg-white lg:w-[320px]">
          <div className="shrink-0 px-4 py-2 pb-1">
            <ScenariosTabs value="scenarios" />
          </div>

          <div className="min-h-0 flex-1 scrollbar-thin overflow-y-auto p-2">
            {isLoading ? (
              <ul>
                {Array.from({ length: 8 }).map((_, index) => (
                  <li key={index} className="px-2 py-2">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="mt-2 h-3 w-1/3" />
                  </li>
                ))}
              </ul>
            ) : isError ? (
              <div className="p-4">
                <ErrorState
                  title="Could not load scenarios"
                  action={
                    <Button size="sm" onClick={() => refetch()}>
                      Try again
                    </Button>
                  }
                />
              </div>
            ) : workflows.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={<Zap className="size-4" />}
                  title="No scenarios yet"
                  description="A scenario watches for a condition — a topic, a tag, an order status — and runs actions when it matches."
                  action={<Button onClick={create}>Create your first scenario</Button>}
                />
              </div>
            ) : (
              <ScenarioList
                workflows={workflows}
                categories={categories}
                options={data?.allConditionDropdownOptions ?? []}
                selectedId={selected?.id}
                onSelect={select}
              />
            )}
          </div>
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

      <TemplatesDialog
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        templates={data?.workflowTemplates ?? []}
      />
    </div>
  )
}

const TOPIC_CONDITION_TYPES = new Set<WorkflowConditionType>([
  'INTENT',
  'TOP_INTENT',
  'PRIORITY_INTENT',
])

/** Topics named in a scenario's conditions, in the order they appear. */
function topicIdsFrom(workflow: Workflow): Id[] {
  const ids: Id[] = []
  const seen = new Set<string>()
  for (const condition of workflow.conditions) {
    if (!TOPIC_CONDITION_TYPES.has(condition.condition_type)) continue
    if (!condition.attachable_id) continue
    const key = String(condition.attachable_id)
    if (seen.has(key)) continue
    seen.add(key)
    ids.push(condition.attachable_id)
  }
  return ids
}

interface TopicBucket {
  id: Id
  name: string
  emoji: string | null
  workflows: Workflow[]
}

interface CategoryBucket {
  id: Id
  name: string
  topics: TopicBucket[]
}

function topicNameFromOptions(topicId: Id, options: ConditionDropdownOption[]) {
  const match = options.find(
    (option) => String(option.attachable_id ?? conditionMeta(option)?.id ?? '') === String(topicId)
  )
  const meta = conditionMeta(match)
  return {
    name: meta?.name ?? 'Topic',
    emoji: meta?.emoji ?? null,
  }
}

function countScenarios(topics: TopicBucket[]) {
  return topics.reduce((sum, topic) => sum + topic.workflows.length, 0)
}

/**
 * Apply-always first, then the topic taxonomy (category → topic) for scenarios
 * that condition on a topic, then leftover condition-only / empty scenarios.
 */
function groupScenarios(
  workflows: Workflow[],
  categories: Category[],
  options: ConditionDropdownOption[]
): {
  always: Workflow[]
  categoryBuckets: CategoryBucket[]
  other: Workflow[]
  unconfigured: Workflow[]
} {
  const always: Workflow[] = []
  const other: Workflow[] = []
  const unconfigured: Workflow[] = []
  const byTopic = new Map<string, Workflow[]>()

  for (const workflow of workflows) {
    if (workflow.apply_always) {
      always.push(workflow)
      continue
    }

    const topicIds = topicIdsFrom(workflow)
    if (topicIds.length === 0) {
      if (workflow.conditions.length === 0) unconfigured.push(workflow)
      else other.push(workflow)
      continue
    }

    for (const topicId of topicIds) {
      const key = String(topicId)
      const list = byTopic.get(key) ?? []
      list.push(workflow)
      byTopic.set(key, list)
    }
  }

  const categoryBuckets: CategoryBucket[] = []
  const placed = new Set<string>()

  for (const category of categories) {
    const topics: TopicBucket[] = []
    for (const sub of category.related_categories) {
      for (const card of sub.cards) {
        const entries = byTopic.get(String(card.id))
        if (!entries) continue
        placed.add(String(card.id))
        topics.push({
          id: card.id,
          name: card.name,
          emoji: card.emoji,
          workflows: entries,
        })
      }
    }
    if (topics.length > 0) {
      categoryBuckets.push({ id: category.id, name: category.name, topics })
    }
  }

  const leftover: TopicBucket[] = []
  for (const [topicId, entries] of byTopic) {
    if (placed.has(topicId)) continue
    const meta = topicNameFromOptions(topicId, options)
    leftover.push({ id: topicId, name: meta.name, emoji: meta.emoji, workflows: entries })
  }
  if (leftover.length > 0) {
    categoryBuckets.push({
      id: 'ungrouped-topics',
      name: categories.length > 0 ? 'Other topics' : 'Topics',
      topics: leftover,
    })
  }

  return { always, categoryBuckets, other, unconfigured }
}

function ScenarioList({
  workflows,
  categories,
  options,
  selectedId,
  onSelect,
}: {
  workflows: Workflow[]
  categories: Category[]
  options: ConditionDropdownOption[]
  selectedId?: Id
  onSelect: (id: Id) => void
}) {
  const { always, categoryBuckets, other, unconfigured } = useMemo(
    () => groupScenarios(workflows, categories, options),
    [workflows, categories, options]
  )

  const nestTopics = categories.length > 0

  return (
    <div className="flex flex-col gap-0.5">
      {always.length > 0 && (
        <ScenarioAccordion label="Applies to everything" count={always.length}>
          {always.map((workflow) => (
            <ScenarioRow
              key={workflow.id}
              workflow={workflow}
              selected={selectedId === workflow.id}
              onSelect={onSelect}
            />
          ))}
        </ScenarioAccordion>
      )}

      {categoryBuckets.map((category) => {
        const topicList = category.topics.map((topic) => (
          <ScenarioAccordion
            key={topic.id}
            label={topic.name}
            emoji={topic.emoji}
            count={topic.workflows.length}
            nested={nestTopics}
          >
            {topic.workflows.map((workflow) => (
              <ScenarioRow
                key={workflow.id}
                workflow={workflow}
                selected={selectedId === workflow.id}
                onSelect={onSelect}
              />
            ))}
          </ScenarioAccordion>
        ))

        if (!nestTopics) {
          return <Fragment key={category.id}>{topicList}</Fragment>
        }

        return (
          <ScenarioAccordion
            key={category.id}
            label={category.name}
            count={countScenarios(category.topics)}
          >
            {topicList}
          </ScenarioAccordion>
        )
      })}

      {other.length > 0 && (
        <ScenarioAccordion label="Other conditions" count={other.length}>
          {other.map((workflow) => (
            <ScenarioRow
              key={workflow.id}
              workflow={workflow}
              selected={selectedId === workflow.id}
              onSelect={onSelect}
            />
          ))}
        </ScenarioAccordion>
      )}

      {unconfigured.length > 0 && (
        <ScenarioAccordion label="Not configured" count={unconfigured.length}>
          {unconfigured.map((workflow) => (
            <ScenarioRow
              key={workflow.id}
              workflow={workflow}
              selected={selectedId === workflow.id}
              onSelect={onSelect}
            />
          ))}
        </ScenarioAccordion>
      )}
    </div>
  )
}

function ScenarioAccordion({
  label,
  emoji,
  count,
  nested = false,
  children,
}: {
  label: string
  emoji?: string | null
  count: number
  nested?: boolean
  children: ReactNode
}) {
  return (
    <Collapsible defaultOpen>
      <CollapsibleTrigger
        className={cn(
          'group flex w-full cursor-pointer items-center gap-1.5 rounded-[6px] px-2 text-left transition-colors hover:bg-gray-100',
          nested ? 'py-1' : 'py-1.5'
        )}
      >
        <ChevronRight
          className={cn(
            'shrink-0 transition-transform group-data-[state=open]:rotate-90',
            nested ? 'size-3 text-gray-300' : 'size-3.5 text-gray-400'
          )}
        />
        {emoji && <span className="w-4 shrink-0 text-center text-[12px]">{emoji}</span>}
        <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-gray-400">
          {label}
        </span>
        <span className="text-[11px] text-gray-400 tabular-nums">{count}</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-3">{children}</CollapsibleContent>
    </Collapsible>
  )
}

function ScenarioRow({
  workflow,
  selected,
  onSelect,
}: {
  workflow: Workflow
  selected: boolean
  onSelect: (id: Id) => void
}) {
  return (
    <div className="my-0.5">
      <button
        type="button"
        onClick={() => onSelect(workflow.id)}
        className={cn(
          'w-full cursor-pointer rounded-[10px] px-3 py-2 text-left transition-colors hover:bg-black/3',
          selected && 'bg-black/3'
        )}
      >
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-gray-900">
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
        <p className="mt-0.5 truncate text-[11px] text-gray-400">
          {workflow.actions.length} action{workflow.actions.length === 1 ? '' : 's'}
          {workflow.times_run !== null && ` · ran ${workflow.times_run} times`}
        </p>
      </button>
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
              className="rounded-[8px] border border-black/5 p-3 text-left transition-colors hover:border-gray-300"
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
