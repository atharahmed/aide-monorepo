import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Command, Loader2, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/page-header'
import { EmptyState, ErrorState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { ScenariosTabs } from '@/features/scenarios/tabs'
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
import { useDeleteMacro, useMacroActionOptions, useMacros, useSaveMacro } from '@/lib/queries'
import { formatRelative } from '@/lib/format'
import { searchId } from '@/lib/search'
import type { Id, Macro, MacroActionOption, MacroActionOptions } from '@/types/api'

export const Route = createFileRoute('/_authenticated/scenarios/macros')({
  validateSearch: (search: Record<string, unknown>): { macro?: Id } => ({
    macro: searchId(search.macro),
  }),
  component: MacrosPage,
})

function MacrosPage() {
  const { macro: selectedId } = Route.useSearch()
  const { data: macros, isLoading, isError, refetch } = useMacros()
  const { data: actionOptions } = useMacroActionOptions()
  const saveMacro = useSaveMacro()

  const [selected, setSelected] = useState<Id | undefined>(selectedId)
  const current =
    (macros ?? []).find((macro) => macro.id === (selected ?? selectedId)) ?? macros?.[0]
  const isEmpty = !isLoading && !isError && (macros ?? []).length === 0

  const create = () =>
    saveMacro.mutate(
      { name: 'New macro', description: '', actions: {} },
      {
        onSuccess: (macro) => {
          setSelected(macro.id)
          toast.success('Macro created')
        },
      }
    )

  const emptyState = (
    <EmptyState
      icon={<Command className="size-4" />}
      title="No macros yet"
      description="A macro groups the actions you repeat by hand — set a status, add a tag, assign a queue."
      action={
        <Button onClick={create} disabled={saveMacro.isPending}>
          {saveMacro.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
          Create a macro
        </Button>
      }
    />
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Macros"
        description="Bundles of helpdesk actions that scenarios and agents can run."
        actions={
          <Button size="sm" onClick={create} disabled={saveMacro.isPending}>
            {saveMacro.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
            New macro
          </Button>
        }
      />

      <div className="flex min-h-0 flex-1">
        <div className="flex w-full shrink-0 flex-col border-r border-gray-100 bg-white lg:w-[320px]">
          <div className="shrink-0 px-4 py-2 pb-1">
            <ScenariosTabs value="macros" />
          </div>

          <div className="min-h-0 flex-1 scrollbar-thin overflow-y-auto">
            {isLoading ? (
              <ul>
                {Array.from({ length: 8 }).map((_, index) => (
                  <li key={index} className="px-4 py-3">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="mt-2 h-3 w-1/3" />
                  </li>
                ))}
              </ul>
            ) : isError ? (
              <div className="p-4">
                <ErrorState
                  title="Could not load macros"
                  action={
                    <Button size="sm" onClick={() => refetch()}>
                      Try again
                    </Button>
                  }
                />
              </div>
            ) : isEmpty ? (
              <>
                <p className="hidden px-5 py-2 text-[12.5px] text-gray-400 lg:block">
                  No macros yet
                </p>
                <div className="p-4 lg:hidden">{emptyState}</div>
              </>
            ) : (
              <div className="py-1">
                {(macros ?? []).map((macro) => (
                  <div key={macro.id} className="mx-2 my-1.5">
                    <button
                      type="button"
                      onClick={() => setSelected(macro.id)}
                      className={cn(
                        'w-full cursor-pointer rounded-[12px] px-3 py-2 text-left transition-colors hover:bg-black/3',
                        current?.id === macro.id && 'bg-black/3'
                      )}
                    >
                      <p className="truncate text-[13px] font-medium text-gray-900">{macro.name}</p>
                      <p className="mt-0.5 truncate text-[11px] text-gray-400">
                        {macro.actions_count} action{macro.actions_count === 1 ? '' : 's'} · ran{' '}
                        {macro.run_count} times
                      </p>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="hidden min-w-0 flex-1 scrollbar-thin overflow-y-auto bg-white lg:block">
          {current ? (
            <MacroEditor key={current.id} macro={current} actionOptions={actionOptions ?? {}} />
          ) : isEmpty ? (
            <div className="flex h-full items-center justify-center p-6 pb-[12vh]">{emptyState}</div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/**
 * A macro's actions are stored per helpdesk (`{zendesk: [...], front: [...]}`)
 * because the same intent — "set the status" — is a different field in each.
 * The editor works on one flat list and regroups on save; each row remembers
 * which helpdesk it belongs to.
 */
interface DraftAction {
  key: string
  integration: string
  field: string
  value: string
}

/** An available field, flattened out of the per-helpdesk options payload. */
interface FlatOption extends MacroActionOption {
  integration: string
}

const flattenOptions = (options: MacroActionOptions): FlatOption[] =>
  Object.entries(options).flatMap(([integration, entries]) =>
    (entries ?? []).map((entry) => ({ ...entry, integration }))
  )

const toDraftActions = (macro: Macro): DraftAction[] =>
  Object.entries(macro.actions ?? {}).flatMap(([integration, entries]) =>
    (entries ?? []).map((entry, index) => ({
      key: `${integration}-${entry.field}-${index}`,
      integration,
      field: entry.field,
      value: entry.value ?? '',
    }))
  )

/** Regroups the flat list back into the per-helpdesk shape the API expects. */
function toActionsPayload(actions: DraftAction[]) {
  return actions.reduce<Record<string, Array<{ field: string; value: string }>>>(
    (grouped, action) => {
      ;(grouped[action.integration] ||= []).push({ field: action.field, value: action.value })
      return grouped
    },
    {}
  )
}

function MacroEditor({
  macro,
  actionOptions,
}: {
  macro: Macro
  actionOptions: MacroActionOptions
}) {
  const saveMacro = useSaveMacro()
  const deleteMacro = useDeleteMacro()

  const options = flattenOptions(actionOptions)

  const [name, setName] = useState(macro.name)
  const [description, setDescription] = useState(macro.description ?? '')
  const [actions, setActions] = useState<DraftAction[]>(() => toDraftActions(macro))
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    setName(macro.name)
    setDescription(macro.description ?? '')
    setActions(toDraftActions(macro))
  }, [macro])

  const save = () =>
    saveMacro.mutate(
      { id: macro.id, name, description, actions: toActionsPayload(actions) },
      {
        onSuccess: () => toast.success('Macro saved'),
        onError: () => toast.error('Could not save the macro.'),
      }
    )

  const addAction = () => {
    const first = options[0]
    if (!first) return
    setActions([
      ...actions,
      {
        key: `new-${actions.length}-${first.value}`,
        integration: first.integration,
        field: first.value,
        value: first.defaultOptions?.[0]?.value ?? '',
      },
    ])
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3 border-b border-black/5 px-5 py-3">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-label="Macro name"
          className="h-8 min-w-0 flex-1 border-transparent px-2 text-[15px] font-semibold tracking-[-0.02em] hover:border-black/5"
        />
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Delete macro"
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 className="text-gray-400" />
        </Button>
        <Button size="sm" onClick={save} disabled={saveMacro.isPending}>
          {saveMacro.isPending && <Loader2 className="animate-spin" />}
          Save macro
        </Button>
      </div>

      <div className="flex max-w-2xl flex-col gap-6 px-5 py-5">
        <div>
          <Label htmlFor="macro-description">Description</Label>
          <Textarea
            id="macro-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="mt-1.5"
            placeholder="What this macro does, in one line."
          />
        </div>

        <Separator />

        <div>
          <h3 className="mb-3 text-[17px] font-medium text-gray-800">Actions</h3>

          <div className="flex flex-col gap-2">
            {actions.map((action, index) => {
              const option = options.find(
                (candidate) =>
                  candidate.integration === action.integration && candidate.value === action.field
              )
              return (
                <div
                  key={action.key}
                  className="flex flex-wrap items-center gap-2 rounded-[8px] border border-black/5 px-3 py-2.5"
                >
                  <Select
                    value={`${action.integration}:${action.field}`}
                    onValueChange={(selection) => {
                      const [integration, field] = selection.split(':')
                      const next = options.find(
                        (candidate) =>
                          candidate.integration === integration && candidate.value === field
                      )
                      setActions(
                        actions.map((entry, entryIndex) =>
                          entryIndex === index
                            ? {
                                ...entry,
                                integration,
                                field,
                                value: next?.defaultOptions?.[0]?.value ?? '',
                              }
                            : entry
                        )
                      )
                    }}
                  >
                    <SelectTrigger className="w-[240px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((candidate) => (
                        <SelectItem
                          key={`${candidate.integration}:${candidate.value}`}
                          value={`${candidate.integration}:${candidate.value}`}
                          disabled={candidate.isDisabled}
                        >
                          {candidate.label}
                          <span className="ml-1.5 text-gray-400 capitalize">
                            {candidate.integration}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {option?.valueFieldType === 'dropdown' ? (
                    <Select
                      value={action.value}
                      onValueChange={(value) =>
                        setActions(
                          actions.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, value } : entry
                          )
                        )
                      }
                    >
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Choose" />
                      </SelectTrigger>
                      <SelectContent>
                        {(option.defaultOptions ?? []).map((choice) => (
                          <SelectItem key={choice.value} value={choice.value}>
                            {choice.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={action.value}
                      onChange={(event) =>
                        setActions(
                          actions.map((entry, entryIndex) =>
                            entryIndex === index ? { ...entry, value: event.target.value } : entry
                          )
                        )
                      }
                      placeholder="Value"
                      className="h-8 w-[200px]"
                    />
                  )}

                  <button
                    type="button"
                    aria-label="Remove action"
                    onClick={() =>
                      setActions(actions.filter((_, entryIndex) => entryIndex !== index))
                    }
                    className="ml-auto rounded-[4px] p-1 text-gray-300 transition-colors hover:bg-gray-100 hover:text-gray-600"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              )
            })}

            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onClick={addAction}
              disabled={options.length === 0}
            >
              <Plus />
              Add an action
            </Button>

            {/* The options payload only lists fields for helpdesks that are
                actually connected, so with none there is nothing to add. */}
            {options.length === 0 && (
              <p className="text-[12.5px] text-gray-400">
                Connect Zendesk or Front to add actions to this macro.
              </p>
            )}
          </div>
        </div>

        <Separator />

        <dl className="flex gap-8 text-[12.5px]">
          <div>
            <dt className="text-[12px] text-gray-400/90">Times run</dt>
            <dd className="mt-0.5 text-gray-900 tabular-nums">{macro.run_count}</dd>
          </div>
          <div>
            <dt className="text-[12px] text-gray-400/90">Last updated</dt>
            <dd className="mt-0.5 text-gray-900">{formatRelative(macro.updated_at)}</dd>
          </div>
        </dl>
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete “{macro.name}”?</DialogTitle>
            <DialogDescription>
              Scenarios that run this macro will stop performing its actions.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Keep macro
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                deleteMacro.mutate(macro.id, {
                  onSuccess: () => {
                    setConfirmDelete(false)
                    toast.success('Macro deleted')
                  },
                })
              }
            >
              Delete macro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
