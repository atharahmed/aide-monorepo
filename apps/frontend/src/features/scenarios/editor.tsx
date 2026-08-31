import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { Loader2, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useDeleteWorkflow, useSaveWorkflow, type WorkflowSavePayload } from '@/lib/queries'
import { toNumber } from '@/lib/format'
import type {
  AffectedConversationsResponse,
  ConditionDropdownOption,
  Id,
  Workflow,
  WorkflowAction,
  WorkflowActionType,
  WorkflowCondition,
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

const CONDITION_LABELS: Record<WorkflowConditionType, string> = {
  INTENT: 'Topic is present',
  TOP_INTENT: 'Main topic is',
  PRIORITY_INTENT: 'Priority topic is',
  INTENT_CONFIDENCE: 'Topic confidence',
  IS_FIRST_MESSAGE: 'Is the first message',
  USER_FIELD: 'Customer field',
  TICKET_FIELD: 'Conversation field',
  CONTACT_FIELD: 'Contact field',
  TICKET_STATUS: 'Status',
  TICKET_TAG: 'Tag',
  INBOX: 'Inbox',
  INTEGRATION: 'Source',
  SHOPIFY: 'Shopify',
  CUSTOM: 'Custom',
}

/**
 * Labels for the action types the editor offers. `action_type` is a free string
 * on the wire, so a scenario may carry one that is not listed here — those keep
 * working and show their raw name rather than disappearing from the editor.
 */
const ACTION_LABELS: Partial<Record<WorkflowActionType, string>> = {
  PROMPT_INSTRUCTION: 'Add an instruction',
  PREGENERATE_REPLY: 'Pre-write a reply',
  GENERATE_REPLY: 'Write a reply',
  SUGGEST_REPLY: 'Suggest a reply',
  REPLY: 'Send a reply',
  SUGGEST_MACRO: 'Suggest a macro',
  APPLY_MACRO: 'Run a macro',
  MACRO: 'Run a macro',
  ADD_TAG: 'Add a tag',
  CLOSE_TICKET: 'Close the conversation',
  ASSIGN: 'Assign to a group',
  COLLECT_FIELD: 'Collect a field',
}

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

const actionLabel = (type: WorkflowActionType) => ACTION_LABELS[type] ?? type

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
  const navigate = useNavigate()

  const [draft, setDraft] = useState<Workflow>(workflow)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [estimate, setEstimate] = useState<AffectedConversationsResponse>()

  useEffect(() => setDraft(workflow), [workflow])

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(workflow), [draft, workflow])
  const conversationsSearch = { workflowIds: String(workflow.id) }

  /* Live estimate of how many past conversations this would have matched. */
  useEffect(() => {
    let cancelled = false
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
          <p className="mt-0 text-[12px] text-gray-400/90 font-medium">
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
                <Label htmlFor="apply-always">Apply to every conversation</Label>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-gray-500">
                  Use this for instructions that should always hold, like tone of voice. Conditions
                  are ignored.
                </p>
              </div>
            </div>
          <div>
         

  

            {!draft.apply_always && (
              <div className="flex flex-col gap-2">
                   <div className="mb-0 flex items-baseline justify-between gap-3">
              <h3 className="text-[19px] font-medium text-gray-950">If this is true</h3>
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
                          <span className="w-7 shrink-0 text-[11.5px] text-gray-400">
                            {index === 0 ? 'If' : 'and'}
                          </span>

                          <ConditionRow
                            condition={condition}
                            options={data.allConditionDropdownOptions}
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

                      <div className="border-t border-black/5 px-2 py-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => addCondition(conjunctionIndex)}
                          className="text-gray-500 pr-4"
                        >
                          <Plus />
                          Add condition
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

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
            )}
          </div>
          {estimate && !draft.apply_always && (
                <span className="rounded-[14px] bg-gray-50 p-3 font-medium text-[13px] text-gray-500 tabular-nums">
                  This would have matched {estimate.count} conversations in the last 28 days
                </span>
              )}
          <Separator />

          <div>
            <h3 className="mb-3 text-[19px] font-medium text-gray-950">Do this</h3>

            <div className="flex flex-col gap-2">
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
            <h3 className="mb-2 text-[19px] font-medium text-gray-950">Activity</h3>
            <dl className="flex flex-col gap-1.5 text-[12.5px] font-medium">
              <div>
                <Link
                  to="/conversations"
                  search={conversationsSearch}
                  aria-label={`View conversations for ${draft.name}`}
                  className="-mx-1 flex justify-between rounded-[6px] px-1 py-0.5 transition-colors hover:bg-gray-50"
                >
                  <dt className="text-[12px] text-gray-400/90">Times run</dt>
                  <dd className="text-gray-800 tabular-nums">{draft.times_run ?? 0}</dd>
                </Link>
              </div>
            </dl>
          </div>
          <Separator />

          <div>
            <h3 className="mb-2 text-[19px] font-medium text-gray-950">Execution</h3>
            <div className="flex flex-col gap-3.5">
              <div>
                <Label>Priority</Label>
                <Select value={draft.priority} onValueChange={(value) => patch({ priority: value })}>
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
                <p className="mt-1.5 text-[12px] text-gray-400">
                  {isWorkflowPriority(draft.priority)
                    ? PRIORITY_HINTS[draft.priority]
                    : ''}
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
                <p className="mt-1.5 text-[12px] text-gray-400">
                  A delay makes it seem more natural vs an immediate AI response.
                </p>
              </div>
            </div>
          </div>


          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Delete scenario"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="text-gray-400" />
          </Button>
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

function ConditionRow({
  condition,
  options,
  onChange,
}: {
  condition: WorkflowCondition
  options: ConditionDropdownOption[]
  onChange: (changes: Partial<WorkflowCondition>) => void
}) {
  const types = [...new Set(options.map((option) => option.condition_type))]
  const valueOptions = options.filter(
    (option) => option.condition_type === condition.condition_type
  )

  /* Topic conditions carry the id in `attachable_id`; everything else uses `value`. */
  const isTopic = ['INTENT', 'TOP_INTENT', 'PRIORITY_INTENT'].includes(condition.condition_type)

  /**
   * `value` alone does not identify an option. Shopify sends several with
   * `value: "true"` separated only by `field_key` ("order exists" vs "tracking
   * exists"), so a select keyed on value renders every match at once. The key
   * pairs the two.
   */
  const optionKey = (option: ConditionDropdownOption) =>
    option.attachable_id
      ? String(option.attachable_id)
      : `${option.field_key ?? ''}|${option.value ?? ''}`

  const currentValue = isTopic
    ? condition.attachable_id
      ? String(condition.attachable_id)
      : ''
    : condition.value !== null
      ? `${condition.field_key ?? ''}|${condition.value}`
      : ''

  return (
    <>
      <Select
        value={condition.condition_type}
        onValueChange={(value) =>
          onChange({
            condition_type: value as WorkflowConditionType,
            value: null,
            attachable_id: null,
            field_key: null,
          })
        }
      >
        <SelectTrigger className="w-[170px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {types.map((type) => (
            <SelectItem key={type} value={type}>
              {CONDITION_LABELS[type] ?? type}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={condition.operator}
        onValueChange={(value) => onChange({ operator: value as 'IS' | 'IS_NOT' })}
      >
        <SelectTrigger className="w-[84px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="IS">is</SelectItem>
          <SelectItem value="IS_NOT">is not</SelectItem>
        </SelectContent>
      </Select>

      {condition.condition_type === 'CUSTOM' ? (
        <Input
          value={condition.value ?? ''}
          onChange={(event) =>
            onChange({
              value: event.target.value,
              field_key: 'subject_regex',
              custom_field_name: 'subject_regex',
            })
          }
          placeholder="Subject matches this pattern"
          className="h-8 w-[240px]"
        />
      ) : (
        <Select
          value={currentValue}
          onValueChange={(selection) => {
            const option = valueOptions.find((candidate) => optionKey(candidate) === selection)
            onChange(
              isTopic
                ? { attachable_id: selection, value: null }
                : { value: option?.value ?? null, field_key: option?.field_key ?? null }
            )
          }}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Choose a value" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>{CONDITION_LABELS[condition.condition_type]}</SelectLabel>
              {valueOptions.map((option) => {
                const key = optionKey(option)
                const label = option.meta
                  ? `${option.meta.emoji ?? ''} ${option.meta.name}`.trim()
                  : (option.value ?? '')
                /* Tag-style options repeat one label across many values, so the
                 * value is shown alongside it to keep them distinguishable. */
                const showValue = Boolean(option.meta && option.value && option.value !== 'true')

                return (
                  <SelectItem key={key} value={key}>
                    {label}
                    {showValue && <span className="ml-1.5 text-gray-400">{option.value}</span>}
                  </SelectItem>
                )
              })}
            </SelectGroup>
          </SelectContent>
        </Select>
      )}
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
                {actionLabel(type)}
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
