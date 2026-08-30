import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ClipboardCheck, Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/page-header'
import { EmptyState, ErrorState } from '@/components/empty-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { OnboardingReminders } from '@/features/onboarding/components'
import { KnowledgeTabs } from '@/features/knowledge/tabs'
import {
  useDeleteKnowledgeEntity,
  useKnowledgeEntities,
  useMe,
  useSaveKnowledgeEntity,
} from '@/lib/queries'
import { truncate } from '@/lib/format'
import type { Id, KnowledgeEntity } from '@/types/api'

export const Route = createFileRoute('/_authenticated/knowledge/business-information')({
  component: BusinessInformationPage,
})

const labelOf = (entity: KnowledgeEntity) =>
  String((entity.entity as { label?: string }).label ?? entity.slug)

const valueOf = (entity: KnowledgeEntity) =>
  String((entity.entity as { value?: string }).value ?? '')

function BusinessInformationPage() {
  const { data: user } = useMe()
  const { data: entities, isLoading, isError, refetch } = useKnowledgeEntities()
  const [selectedId, setSelectedId] = useState<Id | 'new'>()

  const creating = selectedId === 'new'
  const current =
    selectedId === 'new'
      ? undefined
      : (entities ?? []).find((entity) => entity.id === selectedId) ?? entities?.[0]

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Business information"
        description="The facts Aide states as truth — hours, policies, thresholds."
        actions={
          <>
            <OnboardingReminders
              user={user}
              page="business-information"
              className="mr-1 hidden lg:flex"
            />
            <Button size="sm" onClick={() => setSelectedId('new')}>
              <Plus />
              Add a fact
            </Button>
          </>
        }
      />

      <div className="flex min-h-0 flex-1">
        <div className="flex w-full shrink-0 flex-col border-r border-gray-100 bg-white lg:w-[320px]">
          <div className="shrink-0 px-4 py-2 pb-1">
            <KnowledgeTabs value="business" />
          </div>

          <div className="min-h-0 flex-1 scrollbar-thin overflow-y-auto">
            {isLoading ? (
              <ul>
                {Array.from({ length: 8 }).map((_, index) => (
                  <li key={index} className="px-4 py-3">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="mt-2 h-3 w-1/2" />
                  </li>
                ))}
              </ul>
            ) : isError ? (
              <div className="p-4">
                <ErrorState
                  title="Could not load business information"
                  action={
                    <Button size="sm" onClick={() => refetch()}>
                      Try again
                    </Button>
                  }
                />
              </div>
            ) : (entities ?? []).length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={<ClipboardCheck className="size-4" />}
                  title="No facts recorded yet"
                  description="Add the things you would tell a new hire on day one: opening hours, return window, shipping cutoff."
                  action={<Button onClick={() => setSelectedId('new')}>Add the first fact</Button>}
                />
              </div>
            ) : (
              <div className="py-1">
                {(entities ?? []).map((entity) => (
                  <div key={entity.id} className="mx-2 my-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedId(entity.id)}
                      className={cn(
                        'w-full cursor-pointer rounded-[12px] px-3 py-2 text-left transition-colors hover:bg-black/3',
                        !creating && current?.id === entity.id && 'bg-black/3'
                      )}
                    >
                      <p className="truncate text-[12.5px] font-medium text-gray-900">
                        {labelOf(entity)}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-gray-400">
                        {truncate(valueOf(entity), 70)}
                      </p>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="hidden min-w-0 flex-1 scrollbar-thin overflow-y-auto bg-white lg:block">
          {creating ? (
            <EntityEditor
              key="new"
              onCreated={(id) => setSelectedId(id)}
              onCancel={() => setSelectedId(undefined)}
            />
          ) : current ? (
            <EntityEditor key={current.id} entity={current} />
          ) : (
            <div className="p-6">
              <EmptyState
                title="Select a fact"
                description="Pick one from the list to edit it."
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function EntityEditor({
  entity,
  onCreated,
  onCancel,
}: {
  entity?: KnowledgeEntity
  onCreated?: (id: Id) => void
  onCancel?: () => void
}) {
  const saveEntity = useSaveKnowledgeEntity()
  const deleteEntity = useDeleteKnowledgeEntity()
  const isNew = !entity

  const [label, setLabel] = useState(entity ? labelOf(entity) : '')
  const [value, setValue] = useState(entity ? valueOf(entity) : '')

  useEffect(() => {
    setLabel(entity ? labelOf(entity) : '')
    setValue(entity ? valueOf(entity) : '')
  }, [entity])

  const dirty =
    isNew || !entity || label !== labelOf(entity) || value !== valueOf(entity)

  const submit = () =>
    saveEntity.mutate(
      {
        id: entity?.id,
        slug: label
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, ''),
        entity: { label, value },
      },
      {
        onSuccess: (saved) => {
          toast.success(isNew ? 'Fact added' : 'Fact updated')
          if (isNew) onCreated?.(saved.id)
        },
      }
    )

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-3 border-b border-black/5 px-5 py-3">
        <Input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          aria-label="Fact name"
          placeholder="Return window"
          className="h-8 min-w-0 flex-1 border-transparent px-2 text-[15px] font-semibold tracking-[-0.02em] hover:border-black/5"
        />
        {entity && (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Delete fact"
            onClick={() =>
              deleteEntity.mutate(entity.id, { onSuccess: () => toast.success('Fact removed') })
            }
          >
            <Trash2 className="text-gray-400" />
          </Button>
        )}
        {isNew && onCancel && (
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          size="sm"
          onClick={submit}
          disabled={!label.trim() || !value.trim() || !dirty || saveEntity.isPending}
        >
          {saveEntity.isPending && <Loader2 className="animate-spin" />}
          {isNew ? 'Add fact' : dirty ? 'Save changes' : 'Saved'}
        </Button>
      </div>

      <div className="flex max-w-2xl flex-col gap-6 px-5 py-5">
        <div>
          <Label htmlFor="entity-value">Fact</Label>
          <Textarea
            id="entity-value"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="mt-1.5"
            placeholder="60 days from delivery, unworn with tags attached."
          />
        </div>

        {entity?.extracted_source_url && (
          <Badge variant="neutral" className="self-start">
            From your website
          </Badge>
        )}
      </div>
    </div>
  )
}
