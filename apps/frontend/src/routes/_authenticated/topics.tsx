import { useEffect, useMemo, useRef, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  ChevronRight,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Tag,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { PageBody, PageHeader } from '@/components/page-header'
import { EmptyState, ErrorState } from '@/components/empty-state'
import { CategorySwatch } from '@/components/category-swatch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { OnboardingReminders } from '@/features/onboarding/components'
import {
  useCards,
  useCreateCategory,
  useCreateSubCategory,
  useCreateTopic,
  useDeleteCardExample,
  useDeleteSubCategory,
  useDeleteTopic,
  useMacros,
  useMe,
  useRenameSubCategory,
  useUpdateCardExample,
  useUpdateTopic,
} from '@/lib/queries'
import { formatPercent, formatRelative, toNumber, truncate } from '@/lib/format'
import { searchId } from '@/lib/search'
import type { Category, Id, TopicCard } from '@/types/api'

export const Route = createFileRoute('/_authenticated/topics')({
  validateSearch: (search: Record<string, unknown>): { topic?: Id } => ({
    topic: searchId(search.topic),
  }),
  component: TopicsPage,
})

/** A card lifted out of the taxonomy with its two ancestors attached. */
interface PlacedTopic extends TopicCard {
  categoryId: Id
  categoryName: string
  subCategoryId: Id
  subCategoryName: string
}

/** A category or group row the row menu is acting on. */
interface LabelTarget {
  id: Id
  name: string
  kind: 'category' | 'group'
}

function flatten(categories: Category[]): PlacedTopic[] {
  return categories.flatMap((category) =>
    category.related_categories.flatMap((sub) =>
      sub.cards.map((card) => ({
        ...card,
        categoryId: category.id,
        categoryName: category.name,
        subCategoryId: sub.id,
        subCategoryName: sub.name,
      }))
    )
  )
}

function TopicsPage() {
  const { topic: selectedId } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const { data: user } = useMe()

  const { data, isLoading, isError, refetch } = useCards(true)
  const [createOpen, setCreateOpen] = useState(false)

  const categories = data?.data ?? []
  const topics = useMemo(() => flatten(categories), [categories])
  const selected = topics.find((entry) => entry.id === selectedId) ?? topics[0]

  const totalConversations = topics.reduce(
    (sum, entry) => sum + toNumber(entry.conversation_count),
    0
  )

  const select = (id: Id) =>
    navigate({ search: (current) => ({ ...current, topic: id }), replace: true })

  return (
    <>
      <PageHeader
        title="Topics"
        description="What your customers write in about, grouped into a taxonomy"
        meta={
          topics.length > 0 && (
            <span className="text-[12.5px] text-gray-400 tabular-nums">{topics.length}</span>
          )
        }
        actions={
          <>
            <OnboardingReminders user={user} page="topics" className="mr-1 hidden lg:flex" />
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus />
              New topic
            </Button>
          </>
        }
      />

      {isLoading ? (
        <PageBody>
          <div className="flex gap-6">
            <div className="w-[320px] shrink-0 space-y-2">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="h-8" />
              ))}
            </div>
            <Skeleton className="h-64 flex-1" />
          </div>
        </PageBody>
      ) : isError ? (
        <PageBody>
          <ErrorState
            title="Could not load topics"
            action={
              <Button size="sm" onClick={() => refetch()}>
                Try again
              </Button>
            }
          />
        </PageBody>
      ) : topics.length === 0 ? (
        <PageBody>
          <EmptyState
            icon={<Tag className="size-4" />}
            title="No topics yet"
            description="Aide builds a taxonomy from your conversations. You can also add topics by hand."
            action={<Button onClick={() => setCreateOpen(true)}>Create a topic</Button>}
          />
        </PageBody>
      ) : (
        <div className="flex min-h-0 flex-1">
          <div className="w-full shrink-0 scrollbar-thin overflow-y-auto border-r border-black/5 bg-white p-2 lg:w-[320px]">
            <TopicTree
              categories={categories}
              selectedId={selected?.id}
              totalConversations={totalConversations}
              onSelect={select}
            />
          </div>

          <div className="hidden min-w-0 flex-1 scrollbar-thin overflow-y-auto bg-white lg:block">
            {selected ? (
              <TopicDetail key={selected.id} topic={selected} categories={categories} />
            ) : (
              <div className="p-6">
                <EmptyState
                  icon={<Tag className="size-4" />}
                  title="Select a topic"
                  description="Pick a topic to review its examples and what it triggers."
                />
              </div>
            )}
          </div>
        </div>
      )}

      <CreateTopicDialog open={createOpen} onOpenChange={setCreateOpen} categories={categories} />
    </>
  )
}

/* -------------------------------------------------------------------------- */
/* Tree                                                                        */
/* -------------------------------------------------------------------------- */

function TopicTree({
  categories,
  selectedId,
  totalConversations,
  onSelect,
}: {
  categories: Category[]
  selectedId?: Id
  totalConversations: number
  onSelect: (id: Id) => void
}) {
  const createCategory = useCreateCategory()
  const createSubCategory = useCreateSubCategory()
  const renameLabel = useRenameSubCategory()
  const deleteLabel = useDeleteSubCategory()

  /* The dialogs stay mounted so Radix can play its close animation, which means
   * the target outlives the closing — it is only read while one is open. */
  const [addCategoryOpen, setAddCategoryOpen] = useState(false)
  const [addGroupOpen, setAddGroupOpen] = useState(false)
  const [addGroupIn, setAddGroupIn] = useState<Category | null>(null)
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameTarget, setRenameTarget] = useState<LabelTarget | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<LabelTarget | null>(null)

  const openAddGroup = (category: Category) => {
    setAddGroupIn(category)
    setAddGroupOpen(true)
  }

  const openRename = (target: LabelTarget) => {
    setRenameTarget(target)
    setRenameOpen(true)
  }

  const openDelete = (target: LabelTarget) => {
    setDeleteTarget(target)
    setDeleteOpen(true)
  }

  return (
    <div className="flex flex-col gap-0.5">
      {categories.map((category) => {
        const total = category.related_categories.reduce(
          (sum, sub) =>
            sum + sub.cards.reduce((count, card) => count + toNumber(card.conversation_count), 0),
          0
        )

        return (
          <Collapsible key={category.id} defaultOpen>
            <div className="group/row flex w-full items-center rounded-[6px] pr-1 transition-colors hover:bg-gray-100">
              <CollapsibleTrigger className="group flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 px-2 py-1.5 text-left">
                <ChevronRight className="size-3.5 shrink-0 text-gray-400 transition-transform group-data-[state=open]:rotate-90" />
                <CategorySwatch color={category.color} />
                <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-gray-400">
                  {category.name}
                </span>
                <span className="text-[11px] text-gray-400 tabular-nums">
                  {formatPercent(total, totalConversations)}
                </span>
              </CollapsibleTrigger>

              <RowActions
                name={category.name}
                addLabel={`Add a group in ${category.name}`}
                onAdd={() => openAddGroup(category)}
                onRename={() =>
                  openRename({ id: category.id, name: category.name, kind: 'category' })
                }
                onDelete={() =>
                  openDelete({ id: category.id, name: category.name, kind: 'category' })
                }
              />
            </div>

            <CollapsibleContent className="pl-3">
              {category.related_categories.map((sub) => (
                <Collapsible key={sub.id} defaultOpen>
                  <div className="group/row flex w-full items-center rounded-[6px] pr-1 transition-colors hover:bg-gray-100">
                    <CollapsibleTrigger className="group flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 px-2 py-1 text-left">
                      <ChevronRight className="size-3 shrink-0 text-gray-300 transition-transform group-data-[state=open]:rotate-90" />
                      <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-gray-400">
                        {sub.name}
                      </span>
                    </CollapsibleTrigger>

                    <RowActions
                      name={sub.name}
                      onRename={() => openRename({ id: sub.id, name: sub.name, kind: 'group' })}
                      onDelete={() => openDelete({ id: sub.id, name: sub.name, kind: 'group' })}
                    />
                  </div>

                  <CollapsibleContent className="pl-3">
                    {sub.cards.map((card) => (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => onSelect(card.id)}
                        className={cn(
                          'flex w-full cursor-pointer items-center gap-2 rounded-[6px] px-2 py-1.5 text-left transition-colors',
                          selectedId === card.id ? 'bg-gray-100' : 'hover:bg-gray-100'
                        )}
                      >
                        {card.emoji && (
                          <span className="w-4 shrink-0 text-center text-[12px]">{card.emoji}</span>
                        )}
                        <span
                          className={cn(
                            'min-w-0 flex-1 truncate text-[12.5px] font-medium',
                            selectedId === card.id ? 'text-gray-900' : 'text-gray-700'
                          )}
                        >
                          {card.name}
                        </span>
                        <span className="shrink-0 text-right text-[11px] text-gray-400 tabular-nums">
                          {formatPercent(card.conversation_count, totalConversations)}
                        </span>
                      </button>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )
      })}

      <Separator className="my-2" />

      <Button
        variant="secondary"
        disabled={createCategory.isPending}
        onClick={() => setAddCategoryOpen(true)}
        className="flex w-full items-center gap-2 rounded-[6px] px-2 py-1.5 text-left text-[12.5px] text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-950"
      >
        <Plus className="size-3.5" />
        Add category
      </Button>

      <NameDialog
        open={addCategoryOpen}
        onOpenChange={setAddCategoryOpen}
        title="New category"
        description="A category is the top level of the taxonomy — it holds groups of topics."
        placeholder="Orders & shipping"
        submitLabel="Create category"
        pending={createCategory.isPending}
        onSubmit={(name) =>
          createCategory.mutate(
            { name },
            {
              onSuccess: () => {
                setAddCategoryOpen(false)
                toast.success(`Added ${name}`)
              },
              onError: () => toast.error('Could not create the category.'),
            }
          )
        }
      />

      <NameDialog
        open={addGroupOpen}
        onOpenChange={setAddGroupOpen}
        title="New group"
        description={`Groups topics inside ${addGroupIn?.name ?? 'the category'}.`}
        placeholder="Order status & tracking"
        submitLabel="Create group"
        pending={createSubCategory.isPending}
        onSubmit={(name) => {
          if (!addGroupIn) return
          createSubCategory.mutate(
            { categoryId: addGroupIn.id, name },
            {
              onSuccess: () => {
                setAddGroupOpen(false)
                toast.success(`Added ${name}`)
              },
              onError: () => toast.error('Could not create the group.'),
            }
          )
        }}
      />

      <NameDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        title={renameTarget?.kind === 'category' ? 'Rename category' : 'Rename group'}
        description={`Renaming “${renameTarget?.name ?? ''}”.`}
        initialName={renameTarget?.name ?? ''}
        submitLabel="Save"
        pending={renameLabel.isPending}
        onSubmit={(name) => {
          if (!renameTarget) return
          renameLabel.mutate(
            { id: renameTarget.id, name },
            {
              onSuccess: () => {
                setRenameOpen(false)
                toast.success(`Renamed to ${name}`)
              },
              onError: () => toast.error('Could not rename it.'),
            }
          )
        }}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete “{deleteTarget?.name}”?</DialogTitle>
            <DialogDescription>
              {deleteTarget?.kind === 'category'
                ? 'The groups and topics inside it go with it, and scenarios using those topics will no longer match.'
                : 'The topics inside it go with it, and scenarios using those topics will no longer match.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteLabel.isPending}
              onClick={() => {
                if (!deleteTarget) return
                deleteLabel.mutate(deleteTarget.id, {
                  onSuccess: () => {
                    setDeleteOpen(false)
                    toast.success(`Deleted ${deleteTarget.name}`)
                  },
                  onError: () => toast.error('Could not delete it.'),
                })
              }}
            >
              {deleteLabel.isPending && <Loader2 className="animate-spin" />}
              Delete {deleteTarget?.kind === 'category' ? 'category' : 'group'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** The controls that sit at the end of a category or group row. */
function RowActions({
  name,
  addLabel,
  onAdd,
  onRename,
  onDelete,
}: {
  name: string
  addLabel?: string
  onAdd?: () => void
  onRename: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="bg-transparent outline-none hover:bg-transparent hover:[&>svg]:text-gray-950"
            size="icon-sm"
            aria-label={`Manage ${name}`}
          >
            <MoreHorizontal className="text-gray-400" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onRename}>
            <Pencil />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={onDelete}>
            <Trash2 />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {onAdd && (
        <Button
          variant="outline"
          className="hover:bg-gray-900 [&>svg]:text-gray-400 hover:[&>svg]:text-white"
          size="icon-sm"
          aria-label={addLabel}
          onClick={onAdd}
        >
          <Plus />
        </Button>
      )}
    </div>
  )
}

/** Single-field dialog behind add category, add group and rename. */
function NameDialog({
  open,
  onOpenChange,
  title,
  description,
  placeholder,
  submitLabel,
  initialName = '',
  pending,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  placeholder?: string
  submitLabel: string
  initialName?: string
  pending: boolean
  onSubmit: (name: string) => void
}) {
  const [name, setName] = useState(initialName)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) setName(initialName)
  }, [open, initialName])

  const submit = () => {
    const trimmed = name.trim()
    if (trimmed) onSubmit(trimmed)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div>
          <Label htmlFor="taxonomy-name">Name</Label>
          <Input
            id="taxonomy-name"
            ref={inputRef}
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && submit()}
            className="mt-1.5"
            placeholder={placeholder}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name.trim() || pending}>
            {pending && <Loader2 className="animate-spin" />}
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* -------------------------------------------------------------------------- */
/* Detail                                                                      */
/* -------------------------------------------------------------------------- */

function TopicDetail({ topic, categories }: { topic: PlacedTopic; categories: Category[] }) {
  const updateTopic = useUpdateTopic()
  const deleteTopic = useDeleteTopic()
  const updateExample = useUpdateCardExample()
  const deleteExample = useDeleteCardExample()
  const { data: macros } = useMacros()

  const [name, setName] = useState(topic.name)
  const [description, setDescription] = useState(topic.description ?? '')
  const subCategoryId = String(topic.subCategoryId)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const dirty = name !== topic.name || description !== (topic.description ?? '')

  const save = () =>
    updateTopic.mutate(
      {
        id: topic.id,
        name,
        description,
        /* The field is gone from the form, but the endpoint does
         * `emoji = payload.emoji || ''` — so anything already set has to be
         * sent back or saving would silently clear it. */
        emoji: topic.emoji ?? undefined,
      },
      {
        onSuccess: () => toast.success('Topic saved'),
        onError: () => toast.error('Could not save the topic.'),
      }
    )

  const allSubCategories = categories.flatMap((category) =>
    category.related_categories.map((sub) => ({
      id: sub.id,
      label: `${category.name} · ${sub.name}`,
    }))
  )

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3 border-b border-black/3 px-5 py-3">
        {topic.emoji && <span className="text-[22px] leading-none">{topic.emoji}</span>}
        <div className="min-w-0 flex-1">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-label="Topic name"
            className="h-auto min-w-0 border-transparent px-0 text-[19px] font-medium tracking-[0.0em] text-gray-900 shadow-none hover:border-transparent focus-visible:border-black/10"
          />
          <p className="mt-0 text-[12px] font-medium text-gray-400/90">
            {topic.categoryName} · {topic.subCategoryName}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right">
            <p className="text-[19px] leading-none font-medium text-gray-950 tabular-nums">
              {topic.conversation_count ?? 0}
            </p>
            <p className="mt-1 text-[11px] text-gray-400">last 30 days</p>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-5xl gap-8 px-5 py-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="flex flex-col gap-5">
          <div>
            <h3 className="mb-3 text-[19px] font-medium text-gray-950">Settings</h3>
            <div className="flex flex-col gap-3.5">
              <div>
                <Label htmlFor="description">When to use this topic</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="mt-1.5"
                  placeholder="Describe the kind of message that belongs here. Aide uses this to classify."
                />
              </div>

              <div>
                <Label>Category</Label>
                {/* Read-only: the API can rename a topic but has no endpoint to
                    move one between categories. */}
                <Select value={subCategoryId} disabled>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allSubCategories.map((sub) => (
                      <SelectItem key={sub.id} value={String(sub.id)}>
                        {sub.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1.5 text-[12px] text-gray-400">Set when the topic is created.</p>
              </div>

              {dirty && (
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={save} disabled={updateTopic.isPending}>
                    {updateTopic.isPending && <Loader2 className="animate-spin" />}
                    Save changes
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setName(topic.name)
                      setDescription(topic.description ?? '')
                    }}
                  >
                    Discard
                  </Button>
                </div>
              )}
            </div>
          </div>

          <Separator />

          <div>
            <div className="mb-3 flex items-baseline justify-between">
              <h3 className="text-[19px] font-medium text-gray-950">Examples</h3>
              <span className="text-[12px] text-gray-400">
                {topic.examples?.length ?? 0} reviewed
              </span>
            </div>

            {topic.examples && topic.examples.length > 0 ? (
              <ul className="divide-y divide-gray-100 overflow-hidden rounded-[14px] border border-black/5 bg-white">
                {topic.examples.map((example) => (
                  <li key={example.id} className="flex items-start gap-2 px-3 py-2.5">
                    <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-gray-700">
                      {truncate(example.body, 180)}
                    </p>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <button
                        type="button"
                        aria-label="Belongs to this topic"
                        onClick={() =>
                          updateExample.mutate({
                            cardId: topic.id,
                            exampleId: example.id,
                            isPositive: true,
                            needsReview: example.needs_review,
                            couldBeDropped: example.could_be_dropped,
                          })
                        }
                        className={cn(
                          'rounded-[4px] p-1 transition-colors',
                          example.is_positive
                            ? 'bg-success-50 text-success-600'
                            : 'text-gray-300 hover:bg-gray-100 hover:text-gray-600'
                        )}
                      >
                        <ThumbsUp className="size-3" />
                      </button>
                      <button
                        type="button"
                        aria-label="Does not belong here"
                        onClick={() =>
                          updateExample.mutate({
                            cardId: topic.id,
                            exampleId: example.id,
                            isPositive: false,
                            needsReview: example.needs_review,
                            couldBeDropped: example.could_be_dropped,
                          })
                        }
                        className={cn(
                          'rounded-[4px] p-1 transition-colors',
                          !example.is_positive
                            ? 'bg-destructive-50 text-destructive-600'
                            : 'text-gray-300 hover:bg-gray-100 hover:text-gray-600'
                        )}
                      >
                        <ThumbsDown className="size-3" />
                      </button>
                      <button
                        type="button"
                        aria-label="Remove example"
                        onClick={() =>
                          deleteExample.mutate({ cardId: topic.id, exampleId: example.id })
                        }
                        className="rounded-[4px] p-1 text-gray-300 transition-colors hover:bg-gray-100 hover:text-gray-600"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="No examples yet"
                description="Examples come from conversations you mark as right or wrong for this topic."
              />
            )}
          </div>
        </section>

        <aside className="flex flex-col gap-5">
          <div>
            <h3 className="mb-2 text-[19px] font-medium text-gray-950">Activity</h3>
            <dl className="flex flex-col gap-1.5 text-[12.5px] font-medium">
              <div className="flex justify-between">
                <dt className="text-[12px] text-gray-400/90">Conversations</dt>
                <dd className="text-gray-800 tabular-nums">{toNumber(topic.conversation_count)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[12px] text-gray-400/90">Last seen</dt>
                <dd className="text-gray-900">{formatRelative(topic.last_used_at)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[12px] text-gray-400/90">Automatable</dt>
                <dd>
                  {topic.automatable ? (
                    <Badge variant="success">Yes</Badge>
                  ) : (
                    <Badge variant="neutral">Not assessed</Badge>
                  )}
                </dd>
              </div>
            </dl>
          </div>

          <Separator />

          <div>
            <h3 className="mb-2 text-[19px] font-medium text-gray-950">Attached macros</h3>
            {(macros ?? []).slice(0, 3).length > 0 ? (
              <ul className="flex flex-col gap-1">
                {(macros ?? []).slice(0, 3).map((macro) => (
                  <li
                    key={macro.id}
                    className="flex items-center gap-2 rounded-[6px] border border-black/5 px-2.5 py-1.5"
                  >
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-gray-800">
                      {macro.name}
                    </span>
                    <span className="shrink-0 text-[11px] text-gray-400 tabular-nums">
                      {macro.run_count}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12.5px] text-gray-400">No macros attached.</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Delete topic"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="text-gray-400" />
          </Button>
        </aside>
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete “{topic.name}”?</DialogTitle>
            <DialogDescription>
              Conversations keep their history, but this topic stops being detected and any scenario
              using it will no longer match.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Keep topic
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                deleteTopic.mutate(topic.id, {
                  onSuccess: () => {
                    setConfirmDelete(false)
                    toast.success('Topic deleted')
                  },
                })
              }
            >
              Delete topic
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CreateTopicDialog({
  open,
  onOpenChange,
  categories,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: Category[]
}) {
  const createTopic = useCreateTopic()
  const updateTopic = useUpdateTopic()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [subCategoryId, setSubCategoryId] = useState<string>(
    String(categories[0]?.related_categories[0]?.id ?? '')
  )

  /* Creation needs the parent category as well as the sub-category, so each
   * option carries both ids. */
  const subCategories = categories.flatMap((category) =>
    category.related_categories.map((sub) => ({
      id: sub.id,
      categoryId: category.id,
      label: `${category.name} · ${sub.name}`,
    }))
  )

  /**
   * Two calls, because `/v2/cards` only accepts a name and a placement — the
   * description has to be written by a follow-up update.
   */
  const submit = () => {
    const placement = subCategories.find((sub) => String(sub.id) === subCategoryId)
    if (!placement) return

    createTopic.mutate(
      { name, categoryId: placement.categoryId, relatedCategoryId: placement.id },
      {
        onSuccess: (created) => {
          const card = created as { id?: Id } | null
          if (card?.id && description) {
            updateTopic.mutate({ id: card.id, name, description })
          }
          onOpenChange(false)
          setName('')
          setDescription('')
          toast.success(`Created ${name}`)
        },
        onError: () => toast.error('Could not create the topic.'),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New topic</DialogTitle>
          <DialogDescription>
            Describe the kind of message that belongs here — Aide uses the name, description (when
            to use it), and examples to classify.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3.5">
          <div>
            <div>
              <Label htmlFor="new-name">Name</Label>
              <Input
                id="new-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-1.5"
                placeholder="Late delivery"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="new-description">When to use it</Label>
            <Textarea
              id="new-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-1.5"
              placeholder="The customer's order has passed its promised delivery date."
            />
          </div>

          <div>
            <Label>Category</Label>
            <Select value={subCategoryId} onValueChange={setSubCategoryId}>
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                {subCategories.map((sub) => (
                  <SelectItem key={sub.id} value={String(sub.id)}>
                    {sub.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name.trim() || createTopic.isPending}>
            {createTopic.isPending && <Loader2 className="animate-spin" />}
            Create topic
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
