import { useEffect, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Command, Loader2, Plus, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { PageBody, PageHeader } from '@/components/page-header'
import { EmptyState, ErrorState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import type { Macro, MacroActionOption } from '@/types/api'

export const Route = createFileRoute('/_authenticated/scenarios/macros')({
  validateSearch: (search: Record<string, unknown>): { macro?: number } => ({
    macro: Number(search.macro) > 0 ? Number(search.macro) : undefined,
  }),
  component: MacrosPage,
})

function MacrosPage() {
  const { macro: selectedId } = Route.useSearch()
  const { data: macros, isLoading, isError, refetch } = useMacros()
  const { data: actionOptions } = useMacroActionOptions()
  const saveMacro = useSaveMacro()

  const [selected, setSelected] = useState<number | undefined>(selectedId)
  const current =
    (macros ?? []).find((macro) => macro.id === (selected ?? selectedId)) ?? macros?.[0]

  const create = () =>
    saveMacro.mutate(
      { name: 'New macro', description: '', actions: [] },
      {
        onSuccess: (macro) => {
          setSelected(macro.id)
          toast.success('Macro created')
        },
      }
    )

  return (
    <>
      <PageHeader
        title="Macros"
        description="Bundles of helpdesk actions that scenarios and agents can run."
        actions={
          <Button size="sm" onClick={create} disabled={saveMacro.isPending}>
            {saveMacro.isPending ? <Loader2 className="animate-spin" /> : <Plus />}
            New macro
          </Button>
        }
        tabs={
          <Tabs value="macros">
            <TabsList className="mb-0">
              <TabsTrigger value="scenarios" asChild>
                <Link to="/scenarios">Scenarios</Link>
              </TabsTrigger>
              <TabsTrigger value="macros">Macros</TabsTrigger>
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
            title="Could not load macros"
            action={
              <Button size="sm" onClick={() => refetch()}>
                Try again
              </Button>
            }
          />
        </PageBody>
      ) : (macros ?? []).length === 0 ? (
        <PageBody>
          <EmptyState
            icon={<Command className="size-4" />}
            title="No macros yet"
            description="A macro groups the actions you repeat by hand — set a status, add a tag, assign a queue."
            action={<Button onClick={create}>Create a macro</Button>}
          />
        </PageBody>
      ) : (
        <div className="flex min-h-0 flex-1">
          <div className="w-full shrink-0 scrollbar-thin overflow-y-auto border-r border-black/5 bg-white py-2 lg:w-[300px]">
            {(macros ?? []).map((macro) => (
              <button
                key={macro.id}
                type="button"
                onClick={() => setSelected(macro.id)}
                className={cn(
                  'w-full px-4 py-2.5 text-left transition-colors',
                  current?.id === macro.id ? 'bg-gray-100' : 'hover:bg-gray-100'
                )}
              >
                <p className="truncate text-[15px] font-medium text-gray-950">{macro.name}</p>
                <p className="mt-0.5 truncate text-[12px] text-gray-400">
                  {macro.actions_count} action{macro.actions_count === 1 ? '' : 's'} · ran{' '}
                  {macro.run_count} times
                </p>
              </button>
            ))}
          </div>

          <div className="hidden min-w-0 flex-1 scrollbar-thin overflow-y-auto bg-white lg:block">
            {current ? (
              <MacroEditor key={current.id} macro={current} actionOptions={actionOptions ?? []} />
            ) : (
              <div className="p-6">
                <EmptyState title="Select a macro" description="Pick one to edit its actions." />
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

interface DraftAction {
  key: string
  option: string
  value: string
  integration_id: number
}

function MacroEditor({
  macro,
  actionOptions,
}: {
  macro: Macro
  actionOptions: MacroActionOption[]
}) {
  const saveMacro = useSaveMacro()
  const deleteMacro = useDeleteMacro()

  const [name, setName] = useState(macro.name)
  const [description, setDescription] = useState(macro.description ?? '')
  const [actions, setActions] = useState<DraftAction[]>(
    (macro.actions ?? []).map((action) => ({
      key: String(action.id),
      option: action.option,
      value: action.value,
      integration_id: action.integration_id,
    }))
  )
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    setName(macro.name)
    setDescription(macro.description ?? '')
    setActions(
      (macro.actions ?? []).map((action) => ({
        key: String(action.id),
        option: action.option,
        value: action.value,
        integration_id: action.integration_id,
      }))
    )
  }, [macro])

  const save = () =>
    saveMacro.mutate(
      {
        id: macro.id,
        name,
        description,
        actions: actions.map(({ option, value, integration_id }) => ({
          option,
          value,
          integration_id,
        })),
      },
      { onSuccess: () => toast.success('Macro saved') }
    )

  const addAction = () => {
    const first = actionOptions[0]
    if (!first) return
    setActions([
      ...actions,
      {
        key: `new-${Date.now()}`,
        option: first.option,
        value: first.choices?.[0] ?? '',
        integration_id: first.integration_id,
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
          <h3 className="mb-3 text-[17px] font-medium text-gray-950">Actions</h3>

          <div className="flex flex-col gap-2">
            {actions.map((action, index) => {
              const option = actionOptions.find((candidate) => candidate.option === action.option)
              return (
                <div
                  key={action.key}
                  className="flex flex-wrap items-center gap-2 rounded-[8px] border border-black/5 px-3 py-2.5"
                >
                  <Select
                    value={action.option}
                    onValueChange={(value) => {
                      const next = actionOptions.find((candidate) => candidate.option === value)
                      setActions(
                        actions.map((entry, entryIndex) =>
                          entryIndex === index
                            ? {
                                ...entry,
                                option: value,
                                value: next?.choices?.[0] ?? '',
                                integration_id: next?.integration_id ?? entry.integration_id,
                              }
                            : entry
                        )
                      )
                    }}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {actionOptions.map((candidate) => (
                        <SelectItem key={candidate.option} value={candidate.option}>
                          {candidate.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {option?.value_type === 'select' ? (
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
                        {(option.choices ?? []).map((choice) => (
                          <SelectItem key={choice} value={choice}>
                            {choice}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : option?.value_type === 'boolean' ? (
                    <span className="text-[12.5px] text-gray-500">No value needed</span>
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

            <Button variant="outline" size="sm" className="self-start" onClick={addAction}>
              <Plus />
              Add an action
            </Button>
          </div>
        </div>

        <Separator />

        <dl className="flex gap-8 text-[12.5px]">
          <div>
            <dt className="text-gray-500">Times run</dt>
            <dd className="mt-0.5 text-gray-900 tabular-nums">{macro.run_count}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Last updated</dt>
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
