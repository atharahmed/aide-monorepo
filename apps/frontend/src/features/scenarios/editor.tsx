import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  BarChart,
  BellDot,
  Clock,
  Copy,
  Globe,
  Headset,
  Inbox,
  Loader2,
  Package,
  Plus,
  Printer,
  Tag,
  Trash2,
  Truck,
  User,
  Warehouse,
  X,
  type LucideIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { conditionMeta } from '@/lib/conditions'
import { IntegrationGlyph } from '@/components/integration-glyph'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Combobox, type ComboboxGroup } from '@/components/ui/combobox'
import {
  useDeleteWorkflow,
  useDuplicateWorkflow,
  useMe,
  useSaveWorkflow,
  type WorkflowSavePayload,
} from '@/lib/queries'
import { toNumber } from '@/lib/format'
import { ActionIcon, actionLabel } from './actions'
import type {
  AccountField,
  AffectedConversationsResponse,
  ConditionDropdownOption,
  Id,
  Workflow,
  WorkflowAction,
  WorkflowActionType,
  WorkflowCondition,
  WorkflowConditionOperator,
  WorkflowConditionType,
  WorkflowsResponse,
} from '@/types/api'

/**
 * Rows the user has added but not saved have no server id yet. They are marked
 * with this prefix so `toSavePayload` can leave `id` off and let the backend
 * insert them, while React still has a stable key to render with.
 */
const DRAFT_ID_PREFIX = 'draft:'

let draftIdCounter = 0
const nextDraftId = (): Id => `${DRAFT_ID_PREFIX}${(draftIdCounter += 1)}`
const isDraftId = (id: Id) => id.startsWith(DRAFT_ID_PREFIX)

/**
 * Reshapes the editor's working copy into what `/v1/workflows` accepts: numeric
 * ids, conditions regrouped into `conjunctions`, and none of the read-only
 * fields the server computes.
 */
function toSavePayload(draft: Workflow): WorkflowSavePayload {
  const byGroup = new Map<number, WorkflowCondition[]>()
  for (const condition of draft.conditions) {
    const index = toNumber(condition.conjunction_index)
    byGroup.set(index, [...(byGroup.get(index) ?? []), condition])
  }

  return {
    id: Number(draft.id),
    name: draft.name,
    is_active: draft.is_active,
    priority: draft.priority,
    delay: draft.delay,
    apply_always: draft.apply_always,
    conjunctions: [...byGroup.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, conditions]) =>
        conditions.map((condition) => ({
          ...(isDraftId(condition.id) ? {} : { id: Number(condition.id) }),
          condition_type: condition.condition_type,
          operator: condition.operator,
          ...(condition.field_key ? { field_key: condition.field_key } : {}),
          ...(condition.value !== null ? { value: condition.value } : {}),
          ...(condition.attachable_id ? { attachable_id: Number(condition.attachable_id) } : {}),
        }))
      ),
    actions: draft.actions.map((action) => ({
      action_type: action.action_type,
      ...(action.action_value !== null ? { action_value: action.action_value } : {}),
      ...(action.attachable_id ? { attachable_id: Number(action.attachable_id) } : {}),
    })),
  }
}

/**
 * The key dropdown groups conditions the way the previous dashboard did. A key
 * is a (condition_type, field_key) pair, not a condition_type — so "order
 * created" is picked here, under `commerce`, and the value dropdown then offers
 * only that field's values. Picking "Shopify" first and every Shopify value
 * second would drop the field_key the backend matches on.
 */
const CONDITION_GROUPS: Array<{ name: string; conditionTypes: WorkflowConditionType[] }> = [
  {
    name: 'aide',
    conditionTypes: [
      'INTENT',
      'TOP_INTENT',
      'PRIORITY_INTENT',
      'INTENT_CONFIDENCE',
      'INBOX',
      'INTEGRATION',
      'IS_FIRST_MESSAGE',
    ],
  },
  { name: 'ticket', conditionTypes: ['TICKET_TAG', 'TICKET_STATUS', 'TICKET_FIELD'] },
  { name: 'contact', conditionTypes: ['CONTACT_FIELD'] },
  { name: 'user', conditionTypes: ['USER_FIELD'] },
  { name: 'commerce', conditionTypes: ['SHOPIFY'] },
  { name: 'aide custom', conditionTypes: ['CUSTOM'] },
]

/**
 * Switching between these keeps the topic already chosen — they differ in how
 * the topic must rank, not in which topic it is.
 */
const TOPIC_CONDITION_TYPES: WorkflowConditionType[] = ['INTENT', 'TOP_INTENT']

/** Shopify keys are told apart by `meta.name`, so their marks hang off it. */
const SHOPIFY_KEY_ICONS: Record<string, LucideIcon[]> = {
  'order exists': [Package],
  'tracking exists': [Printer],
  'order tag': [Package, Tag],
  'order created': [Package, Clock],
  'tracking begun': [Printer, Clock],
  'tracking last updated': [Truck, Clock],
  'destination country': [Globe],
  'shipment status': [Truck],
  'tracking company': [Warehouse],
}

const CONDITION_KEY_ICONS: Partial<Record<WorkflowConditionType, LucideIcon[]>> = {
  INTENT: [Tag],
  TOP_INTENT: [Tag],
  PRIORITY_INTENT: [Tag],
  INTENT_CONFIDENCE: [BarChart],
  TICKET_STATUS: [Headset, BellDot],
  TICKET_TAG: [Headset, Tag],
  INBOX: [Inbox],
  USER_FIELD: [User],
  CONTACT_FIELD: [User],
}

/**
 * Options carry `field_key` as `null` or leave it off entirely depending on the
 * condition; a saved condition always has `null`. Collapsing both to `''` lets
 * one key identify an option and the condition that was built from it.
 */
const conditionKey = (source: {
  condition_type: WorkflowConditionType
  field_key?: string | null
}) => `${source.condition_type}|${source.field_key ?? ''}`

function conditionKeyLabel(option: ConditionDropdownOption, ticketFields: AccountField[]): string {
  const meta = conditionMeta(option)
  switch (option.condition_type) {
    case 'INTENT':
      return 'topic'
    case 'TOP_INTENT':
      return 'highest topic'
    case 'PRIORITY_INTENT':
      return 'priority topic'
    case 'INTENT_CONFIDENCE':
      return 'topic confidence'
    case 'IS_FIRST_MESSAGE':
      return 'is first message'
    case 'TICKET_STATUS':
      return 'ticket \u203a status'
    case 'TICKET_TAG':
      return 'ticket tag'
    case 'TICKET_FIELD': {
      const field = ticketFields.find((candidate) => candidate.fieldKey === option.field_key)
      return `ticket \u203a ${field?.displayName || option.field_key || ''}`
    }
    case 'INBOX':
      return 'inbox'
    case 'INTEGRATION':
      return 'integration'
    case 'USER_FIELD':
      return `user \u203a ${option.field_key ?? ''}`
    case 'CONTACT_FIELD':
      return meta?.name || option.field_key || ''
    case 'SHOPIFY':
      return meta?.name || option.field_key || ''
    case 'CUSTOM':
      return meta?.name || option.custom_field_name || ''
    default:
      return ''
  }
}

const conditionKeyIcons = (option: ConditionDropdownOption): LucideIcon[] =>
  option.condition_type === 'SHOPIFY'
    ? (SHOPIFY_KEY_ICONS[conditionMeta(option)?.name ?? ''] ?? [])
    : (CONDITION_KEY_ICONS[option.condition_type] ?? [])

interface ConditionKeyOption {
  key: string
  option: ConditionDropdownOption
  label: string
  icons: LucideIcon[]
}

/** First option wins for a key, so the groups keep the backend's ordering. */
function conditionKeyOptions(
  options: ConditionDropdownOption[],
  ticketFields: AccountField[]
): {
  groups: Array<{ name: string; entries: ConditionKeyOption[] }>
  byKey: Map<string, ConditionKeyOption>
} {
  const byKey = new Map<string, ConditionKeyOption>()
  for (const option of options) {
    const key = conditionKey(option)
    if (byKey.has(key)) continue
    const label = conditionKeyLabel(option, ticketFields)
    if (!label) continue
    byKey.set(key, { key, option, label, icons: conditionKeyIcons(option) })
  }

  const entries = [...byKey.values()]
  const groups = CONDITION_GROUPS.map((group) => ({
    name: group.name,
    entries: entries.filter((entry) => group.conditionTypes.includes(entry.option.condition_type)),
  })).filter((group) => group.entries.length > 0)

  return { groups, byKey }
}

/** What a value option reads as in the trigger and in type-ahead. */
const conditionValueText = (option: ConditionDropdownOption): string => {
  const meta = conditionMeta(option)
  if (
    ['INTENT', 'TOP_INTENT', 'PRIORITY_INTENT', 'INBOX', 'INTEGRATION'].includes(
      option.condition_type
    )
  ) {
    return meta?.name ?? option.value ?? ''
  }
  return option.value ?? ''
}

const conditionValueKey = (option: ConditionDropdownOption): string =>
  option.attachable_id ? String(option.attachable_id) : (option.value ?? '')

/** The subset the editor offers when adding an action. */
const SELECTABLE_ACTION_TYPES: WorkflowActionType[] = [
  'PROMPT_INSTRUCTION',
  'PREGENERATE_REPLY',
  'SUGGEST_REPLY',
  'APPLY_MACRO',
  'ADD_TAG',
  'CLOSE_TICKET',
  'ASSIGN',
  'COLLECT_FIELD',
]

const ACTION_HINTS: Partial<Record<WorkflowActionType, string>> = {
  GENERATE_REPLY: 'Tell Aide what the reply should cover. It writes from knowledge and order data.',
  PROMPT_INSTRUCTION:
    'A rule Aide follows while writing — tone, things to avoid, things to always say.',
}

const PRIORITIES = ['LOW', 'NORMAL', 'HIGH'] as const
type WorkflowPriority = (typeof PRIORITIES)[number]

const PRIORITY_LABELS: Record<WorkflowPriority, string> = {
  LOW: 'Low',
  NORMAL: 'Medium (default)',
  HIGH: 'High',
}

const PRIORITY_HINTS: Record<WorkflowPriority, string> = {
  LOW: 'Only runs if no other matching scenario does — even when every condition here is met.',
  NORMAL: 'Runs whenever its conditions match, whether or not other scenarios also match.',
  HIGH: 'Runs when its conditions match, and no other scenario’s actions run.',
}

function isWorkflowPriority(value: string): value is WorkflowPriority {
  return (PRIORITIES as readonly string[]).includes(value)
}

const DELAYS = [
  { value: 'NONE', label: 'Immediately' },
  { value: 'FIVE_MINUTES', label: 'After 5 minutes' },
  { value: 'ONE_HOUR', label: 'After 1 hour' },
  { value: 'ONE_DAY', label: 'After 1 day' },
]

/** Preview the estimate without stuffing every matching id into the URL. */
const ESTIMATE_PREVIEW_SIZE = 30
const ESTIMATE_COUNT_CAP = 1000

/** Helpdesk ids (`externalIds`) are what `/v1/tickets?ticketIds=` looks up. */
function estimatePreviewIds(estimate: AffectedConversationsResponse): string[] {
  const ids =
    estimate.externalIds.length > 0 ? estimate.externalIds : estimate.ticketIds.map(String)
  return ids.slice(0, ESTIMATE_PREVIEW_SIZE)
}

/**
 * Conditions are an OR of ANDs: each conjunction group is a set of conditions
 * that must all hold, and the scenario fires if any group matches. That's the
 * `conjunction_index` on the wire — the editor makes the shape visible rather
 * than hiding it behind a flat list.
 */
export function ScenarioEditor({
  workflow,
  data,
}: {
  workflow: Workflow
  data: WorkflowsResponse
}) {
  const saveWorkflow = useSaveWorkflow()
  const deleteWorkflow = useDeleteWorkflow()
  const duplicateWorkflow = useDuplicateWorkflow()
  const navigate = useNavigate()
  const { data: user } = useMe()
  /* TICKET_FIELD keys are named by the account's field config, not the option. */
  const ticketFields = user?.team?.ticket_fields ?? []

  const [draft, setDraft] = useState<Workflow>(workflow)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [estimate, setEstimate] = useState<AffectedConversationsResponse>()
  const [estimating, setEstimating] = useState(true)

  useEffect(() => setDraft(workflow), [workflow])

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(workflow), [draft, workflow])
  const conversationsSearch = { workflowIds: String(workflow.id) }
  const previewIds = estimate && !estimating ? estimatePreviewIds(estimate) : []

  /* Live estimate of how many past conversations this would have matched. */
  useEffect(() => {
    let cancelled = false
    setEstimating(true)

    const timer = window.setTimeout(async () => {
      try {
        const { conjunctions } = toSavePayload(draft)
        const result = await api.post<AffectedConversationsResponse>(
          '/v1/workflows/affected_conversations',
          { workflow_id: Number(draft.id), conjunctions }
        )
        if (!cancelled) setEstimate(result)
      } catch {
        if (!cancelled) setEstimate(undefined)
      } finally {
        if (!cancelled) setEstimating(false)
      }
    }, 400)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [draft.conditions, draft.apply_always])

  const patch = (changes: Partial<Workflow>) => setDraft((current) => ({ ...current, ...changes }))

  const save = () =>
    saveWorkflow.mutate(toSavePayload(draft), {
      onSuccess: () => toast.success('Scenario saved'),
      onError: () => toast.error('Could not save the scenario.'),
    })

  const duplicate = () =>
    duplicateWorkflow.mutate(
      { ...toSavePayload(draft), name: `${draft.name} (copy)`, is_active: false },
      {
        onSuccess: ({ workflow: copy }) => {
          navigate({ to: '/scenarios', search: { scenario: copy.id } })
          toast.success('Scenario duplicated — the copy is switched off')
        },
        onError: () => toast.error('Could not duplicate the scenario.'),
      }
    )

  const groups = useMemo(() => {
    const map = new Map<number, WorkflowCondition[]>()
    for (const condition of draft.conditions) {
      const index = toNumber(condition.conjunction_index)
      map.set(index, [...(map.get(index) ?? []), condition])
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0])
  }, [draft.conditions])

  const addCondition = (conjunctionIndex: number) =>
    patch({
      conditions: [
        ...draft.conditions,
        {
          id: nextDraftId(),
          account_id: draft.account_id,
          workflow_id: draft.id,
          attachable_id: null,
          custom_field_name: null,
          condition_type: 'TOP_INTENT',
          operator: 'IS',
          value: null,
          field_key: null,
          conjunction_index: String(conjunctionIndex),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
    })

  const updateCondition = (id: Id, changes: Partial<WorkflowCondition>) =>
    patch({
      conditions: draft.conditions.map((condition) =>
        condition.id === id ? { ...condition, ...changes } : condition
      ),
    })

  const removeCondition = (id: Id) =>
    patch({ conditions: draft.conditions.filter((condition) => condition.id !== id) })

  const addAction = () =>
    patch({
      actions: [
        ...draft.actions,
        {
          id: nextDraftId(),
          account_id: draft.account_id,
          workflow_id: draft.id,
          action_type: 'GENERATIVE_REPLY',
          action_value: '',
          attachable_id: null,
          created_at: new Date().toISOString(),
        },
      ],
    })

  const updateAction = (id: Id, changes: Partial<WorkflowAction>) =>
    patch({
      actions: draft.actions.map((action) =>
        action.id === id ? { ...action, ...changes } : action
      ),
    })

  const removeAction = (id: Id) =>
    patch({ actions: draft.actions.filter((action) => action.id !== id) })

  const nextConjunction = groups.length === 0 ? 0 : Math.max(...groups.map(([index]) => index)) + 1

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3 border-b border-black/3 px-5 py-3">
        <div className="min-w-0 flex-1">
          <Input
            value={draft.name}
            onChange={(event) => patch({ name: event.target.value })}
            aria-label="Scenario name"
            className="h-auto min-w-0 border-transparent px-0 text-[19px] font-medium tracking-[0.0em] text-gray-900 shadow-none hover:border-transparent focus-visible:border-black/10"
          />
          <p className="mt-0 text-[12px] font-medium text-gray-400/90">
            {draft.actions.length} action{draft.actions.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {/* <Link
            to="/conversations"
            search={conversationsSearch}
            aria-label={`View conversations for ${draft.name}`}
            className="text-right transition-opacity hover:opacity-70"
          >
            <p className="text-[19px] leading-none font-medium text-gray-950 tabular-nums">
              {draft.times_run ?? 0}
            </p>
            <p className="mt-1 text-[11px] text-gray-400">times run</p>
          </Link> */}
          <Label htmlFor="active" className="text-[12.5px] text-gray-500">
            {draft.is_active ? 'On' : 'Off'}
          </Label>
          <Switch
            id="active"
            checked={draft.is_active}
            onCheckedChange={(checked) => patch({ is_active: checked })}
          />
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-5xl gap-8 px-5 py-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="flex flex-col gap-3">
          <div className="mb-3 flex items-center gap-6 rounded-[14px] bg-gray-50 px-5 py-3.5">
            <Switch
              id="apply-always"
              checked={draft.apply_always}
              onCheckedChange={(checked) => patch({ apply_always: checked })}
            />
            <div className="min-w-0 flex-1">
              <Label htmlFor="apply-always" className="text-[14px] text-gray-700">
                Apply to every conversation
              </Label>
              <p className="mt-0.5 text-[12px] leading-relaxed font-medium text-gray-400">
                Use this for instructions that should always hold, like tone of voice. Conditions
                are ignored.
              </p>
            </div>
          </div>
          <div>
            {!draft.apply_always && (
              <div className="flex flex-col justify-center gap-2">
                <div className="mb-0 flex items-baseline justify-between gap-3">
                  <h3 className="text-[17px] font-medium text-gray-800">If this is true</h3>
                </div>
                {groups.map(([conjunctionIndex, conditions], groupIndex) => (
                  <div key={conjunctionIndex}>
                    {groupIndex > 0 && (
                      <div className="flex items-center gap-2 py-1.5">
                        <span className="h-px flex-1 bg-gray-100" />
                        <Badge variant="neutral">or</Badge>
                        <span className="h-px flex-1 bg-gray-100" />
                      </div>
                    )}

                    <div className="rounded-[14px] border border-black/7 bg-white shadow-light">
                      {conditions.map((condition, index) => (
                        <div
                          key={condition.id}
                          className={cn(
                            'flex flex-wrap items-center gap-2 px-3 py-2.5',
                            index > 0 && 'border-t border-black/5'
                          )}
                        >
                          <span className="w-7 shrink-0 text-[12px] font-medium text-gray-700">
                            {index === 0 ? 'If' : 'and'}
                          </span>

                          <ConditionRow
                            condition={condition}
                            options={data.allConditionDropdownOptions}
                            ticketFields={ticketFields}
                            onChange={(changes) => updateCondition(condition.id, changes)}
                          />

                          <button
                            type="button"
                            aria-label="Remove condition"
                            onClick={() => removeCondition(condition.id)}
                            className="ml-auto rounded-[4px] p-1 text-gray-300 transition-colors hover:bg-gray-100 hover:text-gray-600"
                          >
                            <X className="size-3.5" />
                          </button>
                        </div>
                      ))}

                      <div className="flex justify-center border-t border-black/5 px-2 py-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => addCondition(conjunctionIndex)}
                          className="pr-4 text-gray-500"
                        >
                          <Plus />
                          Add condition
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                <div className="flex w-full justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    className="self-start pr-4"
                    onClick={() => addCondition(nextConjunction)}
                  >
                    <Plus />
                    {groups.length === 0 ? 'Add a condition' : 'Add or set'}
                  </Button>
                </div>
              </div>
            )}
          </div>
          {!draft.apply_always && (estimating || estimate) && (
            <EstimateSummary estimating={estimating} estimate={estimate} previewIds={previewIds} />
          )}
          <Separator />

          <div>
            <h3 className="mb-3 text-[17px] font-medium text-gray-800">Do this</h3>

            <div className="flex flex-col justify-center gap-2">
              {draft.actions.map((action) => (
                <ActionRow
                  key={action.id}
                  action={action}
                  macros={data.macros}
                  onChange={(changes) => updateAction(action.id, changes)}
                  onRemove={() => removeAction(action.id)}
                />
              ))}

              <Button variant="outline" size="sm" className="self-start pr-4" onClick={addAction}>
                <Plus />
                Add an action
              </Button>
            </div>
          </div>

          {dirty && (
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={save} disabled={saveWorkflow.isPending}>
                {saveWorkflow.isPending && <Loader2 className="animate-spin" />}
                Save changes
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setDraft(workflow)}>
                Discard
              </Button>
            </div>
          )}
        </section>

        <aside className="flex flex-col gap-5">
          <div>
            <h3 className="mb-2 text-[17px] font-medium text-gray-800">Activity</h3>
            <dl className="flex flex-col gap-1.5 text-[12.5px] font-medium">
              <div>
                <Link
                  to="/conversations"
                  search={conversationsSearch}
                  aria-label={`View conversations for ${draft.name}`}
                  className="-mx-1 flex justify-between rounded-[6px] px-1 py-0.5 transition-colors hover:bg-gray-50"
                >
                  <dt className="text-[12px] text-gray-400/90">Times run this month</dt>
                  <dd className="text-gray-800 tabular-nums"> {draft.times_run ?? 0} ↗</dd>
                </Link>
              </div>
            </dl>
          </div>
          <Separator />

          <div>
            <h3 className="mb-2 text-[17px] font-medium text-gray-800">Execution</h3>
            <div className="flex flex-col gap-3.5">
              <div>
                <Label>Priority</Label>
                <Select
                  value={draft.priority}
                  onValueChange={(value) => patch({ priority: value })}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((priority) => (
                      <SelectItem key={priority} value={priority}>
                        {PRIORITY_LABELS[priority]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1.5 text-[12px] text-gray-400/90">
                  {isWorkflowPriority(draft.priority) ? PRIORITY_HINTS[draft.priority] : ''}
                </p>
              </div>

              <div>
                <Label>Delay</Label>
                <Select value={draft.delay} onValueChange={(value) => patch({ delay: value })}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DELAYS.map((delay) => (
                      <SelectItem key={delay.value} value={delay.value}>
                        {delay.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1.5 text-[12px] text-gray-400/90">
                  A delay makes it seem more natural vs an immediate AI response.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Duplicate scenario"
                  onClick={duplicate}
                  disabled={duplicateWorkflow.isPending}
                >
                  {duplicateWorkflow.isPending ? (
                    <Loader2 className="animate-spin text-gray-400" />
                  ) : (
                    <Copy className="text-gray-400" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Duplicate this scenario</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Delete scenario"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="text-gray-400" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Delete this scenario</TooltipContent>
            </Tooltip>
          </div>
        </aside>
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete “{workflow.name}”?</DialogTitle>
            <DialogDescription>
              It stops running immediately. Conversations it already touched keep their history.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Keep scenario
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                deleteWorkflow.mutate(workflow.id, {
                  onSuccess: () => {
                    setConfirmDelete(false)
                    toast.success('Scenario deleted')
                    navigate({ to: '/scenarios' })
                  },
                })
              }
            >
              Delete scenario
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/**
 * How many past conversations these conditions would have caught. It re-runs on
 * every edit, so the pill holds a spinner while the next count is in flight —
 * a stale number sitting there reads as the answer to the edit just made.
 */
function EstimateSummary({
  estimating,
  estimate,
  previewIds,
}: {
  estimating: boolean
  estimate?: AffectedConversationsResponse
  previewIds: string[]
}) {
  const body = (
    <div className="flex flex-row justify-between px-3 py-2">
      <div className="flex flex-col items-start gap-1 text-[13px] font-medium tracking-[-0.05px] text-black/40">
        <span className="flex items-center gap-1.5 text-[14px] font-medium text-black/70">
          <span className="my-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-black/65 px-1.5 text-[13px] font-medium text-white tabular-nums">
            {estimating ? (
              <Loader2 className="size-3 animate-spin" />
            ) : estimate && estimate.count > ESTIMATE_COUNT_CAP ? (
              `>${ESTIMATE_COUNT_CAP}`
            ) : (
              (estimate?.count ?? 0)
            )}
          </span>
          conversations match
        </span>
        <span className="text-[12.5px] font-normal tracking-normal">
          Based on recent conversations that match these conditions
        </span>
      </div>
      {previewIds.length > 0 && <span>↗</span>}
    </div>
  )

  /* Nothing sampled yet means nothing to open, so it stays plain text. */
  if (previewIds.length === 0) {
    return <div className="rounded-[14px] bg-gray-50 tracking-normal">{body}</div>
  }

  return (
    <Link
      to="/conversations"
      search={{ ticketIds: previewIds.join('-'), viewIds: 'ELIGIBLE' }}
      target="_blank"
      rel="noreferrer"
      className="rounded-[14px] bg-gray-50 tracking-normal transition-colors hover:bg-gray-100 hover:text-gray-900"
    >
      {body}
    </Link>
  )
}

function ConditionRow({
  condition,
  options,
  ticketFields,
  onChange,
}: {
  condition: WorkflowCondition
  options: ConditionDropdownOption[]
  ticketFields: AccountField[]
  onChange: (changes: Partial<WorkflowCondition>) => void
}) {
  const { groups, byKey } = useMemo(
    () => conditionKeyOptions(options, ticketFields),
    [options, ticketFields]
  )

  const selectedKey = conditionKey(condition)
  const selected = byKey.get(selectedKey)

  /* Values belong to one key, so they narrow by field_key too — that is what
   * keeps "order created" offering times rather than every Shopify value. */
  const valueOptions = useMemo(
    () =>
      selected
        ? options.filter(
            (option) => conditionKey(option) === selectedKey && conditionValueKey(option) !== ''
          )
        : [],
    [options, selected, selectedKey]
  )

  const currentValue = valueOptions.find(
    (option) =>
      (option.value != null && option.value === condition.value) ||
      (option.attachable_id != null &&
        condition.attachable_id != null &&
        String(option.attachable_id) === String(condition.attachable_id))
  )

  const keyGroups = useMemo<ComboboxGroup[]>(
    () =>
      groups.map((group) => ({
        name: group.name,
        options: group.entries.map((entry) => ({
          value: entry.key,
          label: entry.label,
          content: (
            <span className="flex items-center gap-1.5">
              {entry.icons.map((Icon, index) => (
                <Icon key={index} className="size-3.5 shrink-0 text-gray-400" />
              ))}
              <span className="truncate">{entry.label}</span>
            </span>
          ),
        })),
      })),
    [groups]
  )

  const valueGroups = useMemo<ComboboxGroup[]>(
    () =>
      valueOptions.length === 0
        ? []
        : [
            {
              name: selected?.label,
              options: valueOptions.map((option) => {
                const meta = conditionMeta(option)
                const text = conditionValueText(option)
                return {
                  value: conditionValueKey(option),
                  label: text,
                  content: (
                    <span className="flex items-center gap-1.5">
                      {/* Source names a helpdesk, so it carries the same brand
                          mark the integrations catalog uses. */}
                      {option.condition_type === 'INTEGRATION' && option.value && (
                        <IntegrationGlyph slug={option.value} className="size-4" />
                      )}
                      {meta?.emoji && <span>{meta.emoji}</span>}
                      <span className="truncate">{text}</span>
                    </span>
                  ),
                }
              }),
            },
          ],
    [valueOptions, selected]
  )

  return (
    <>
      <Combobox
        aria-label="Condition"
        className="w-[190px]"
        value={selected ? selectedKey : ''}
        groups={keyGroups}
        placeholder="Choose a condition"
        searchPlaceholder="Search conditions…"
        emptyMessage="No conditions match."
        onChange={(key) => {
          const next = byKey.get(key)
          if (!next) return
          const wasTopic = TOPIC_CONDITION_TYPES.includes(condition.condition_type)
          const isTopic = TOPIC_CONDITION_TYPES.includes(next.option.condition_type)
          onChange({
            condition_type: next.option.condition_type,
            field_key: next.option.field_key ?? null,
            custom_field_name: next.option.custom_field_name ?? null,
            operator: 'IS',
            value: null,
            /* Switching between topic and highest topic keeps the chosen topic. */
            attachable_id: wasTopic && isTopic ? condition.attachable_id : null,
          })
        }}
      />

      <Select
        value={condition.operator}
        onValueChange={(value) => onChange({ operator: value as WorkflowConditionOperator })}
      >
        <SelectTrigger className="w-[84px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="IS">is</SelectItem>
          <SelectItem value="IS_NOT">is not</SelectItem>
        </SelectContent>
      </Select>

      <Combobox
        aria-label="Condition value"
        className="w-[220px]"
        value={currentValue ? conditionValueKey(currentValue) : ''}
        groups={valueGroups}
        disabled={valueOptions.length === 0}
        placeholder="Choose a value"
        searchPlaceholder="Search values…"
        emptyMessage="No values match."
        onChange={(selection) => {
          const option = valueOptions.find(
            (candidate) => conditionValueKey(candidate) === selection
          )
          /* Both fields are written from the option, the way the previous
           * dashboard did: topics land in `attachable_id`, the rest in `value`,
           * and `field_key` stays whatever the key set. */
          onChange({ value: option?.value ?? null, attachable_id: option?.attachable_id ?? null })
        }}
      />
    </>
  )
}

function ActionRow({
  action,
  macros,
  onChange,
  onRemove,
}: {
  action: WorkflowAction
  macros: WorkflowsResponse['macros']
  onChange: (changes: Partial<WorkflowAction>) => void
  onRemove: () => void
}) {
  const isFreeText = ['PROMPT_INSTRUCTION', 'GENERATE_REPLY', 'SUGGEST_REPLY', 'REPLY'].includes(
    action.action_type
  )

  return (
    <div className="rounded-[14px] border border-black/7 bg-white shadow-light">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <Select
          value={action.action_type}
          onValueChange={(value) =>
            onChange({ action_type: value as WorkflowActionType, action_value: '' })
          }
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {/* Include the current type even if it is not offered by default,
                so an existing scenario's action is never silently rewritten. */}
            {[...new Set([...SELECTABLE_ACTION_TYPES, action.action_type])].map((type) => (
              <SelectItem key={type} value={type}>
                <span className="flex items-center gap-2">
                  <ActionIcon type={type} />
                  {actionLabel(type)}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {action.action_type === 'MACRO' && (
          <Select
            value={action.attachable_id ? String(action.attachable_id) : ''}
            onValueChange={(value) => {
              const macro = macros.find((candidate) => String(candidate.id) === value)
              onChange({ attachable_id: value, action_value: macro?.name ?? '' })
            }}
          >
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="Choose a macro" />
            </SelectTrigger>
            <SelectContent>
              {macros.map((macro) => (
                <SelectItem key={macro.id} value={String(macro.id)}>
                  {macro.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {!isFreeText && action.action_type !== 'MACRO' && (
          <Input
            value={action.action_value ?? ''}
            onChange={(event) => onChange({ action_value: event.target.value })}
            placeholder={
              action.action_type === 'ADD_TAG'
                ? 'tag-name'
                : action.action_type === 'ASSIGN'
                  ? 'Group name'
                  : 'Value'
            }
            className="h-8 w-[240px]"
          />
        )}

        <button
          type="button"
          aria-label="Remove action"
          onClick={onRemove}
          className="ml-auto rounded-[4px] p-1 text-gray-300 transition-colors hover:bg-gray-100 hover:text-gray-600"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {isFreeText && (
        <div className="border-t border-black/5 px-3 py-2.5">
          <Textarea
            value={action.action_value ?? ''}
            onChange={(event) => onChange({ action_value: event.target.value })}
            placeholder={
              action.action_type === 'PROMPT_INSTRUCTION'
                ? 'Never promise a delivery date the carrier has not confirmed.'
                : 'Answer with the live tracking status and the expected delivery window.'
            }
            className="border-0 px-0 focus-visible:border-0"
          />
          {ACTION_HINTS[action.action_type] && (
            <p className="mt-1 text-[12px] text-gray-400">{ACTION_HINTS[action.action_type]}</p>
          )}
        </div>
      )}
    </div>
  )
}
