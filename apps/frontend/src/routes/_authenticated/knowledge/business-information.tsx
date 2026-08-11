import { useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ClipboardCheck, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageBody, PageHeader } from '@/components/page-header'
import { EmptyState, ErrorState } from '@/components/empty-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { OnboardingReminders } from '@/features/onboarding/components'
import {
  useDeleteKnowledgeEntity,
  useKnowledgeEntities,
  useMe,
  useSaveKnowledgeEntity,
} from '@/lib/queries'
import type { KnowledgeEntity } from '@/types/api'

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
  const [editing, setEditing] = useState<KnowledgeEntity | 'new'>()

  return (
    <>
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
            <Button size="sm" onClick={() => setEditing('new')}>
              <Plus />
              Add a fact
            </Button>
          </>
        }
        tabs={
          <Tabs value="business">
            <TabsList className="mb-0">
              <TabsTrigger value="articles" asChild>
                <Link to="/knowledge">Articles</Link>
              </TabsTrigger>
              <TabsTrigger value="business">Business information</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      <PageBody>
        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-[104px]" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState
            title="Could not load business information"
            action={
              <Button size="sm" onClick={() => refetch()}>
                Try again
              </Button>
            }
          />
        ) : (entities ?? []).length === 0 ? (
          <EmptyState
            icon={<ClipboardCheck className="size-4" />}
            title="No facts recorded yet"
            description="Add the things you would tell a new hire on day one: opening hours, return window, shipping cutoff."
            action={<Button onClick={() => setEditing('new')}>Add the first fact</Button>}
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(entities ?? []).map((entity) => (
              <EntityCard key={entity.id} entity={entity} onEdit={() => setEditing(entity)} />
            ))}
          </div>
        )}
      </PageBody>

      <EntityDialog entity={editing} onClose={() => setEditing(undefined)} />
    </>
  )
}

function EntityCard({ entity, onEdit }: { entity: KnowledgeEntity; onEdit: () => void }) {
  const deleteEntity = useDeleteKnowledgeEntity()

  return (
    <article className="group flex flex-col rounded-[8px] border border-gray-200 bg-white p-4">
      <div className="flex items-start gap-2">
        <h3 className="min-w-0 flex-1 text-[13.5px] font-medium text-gray-950">
          {labelOf(entity)}
        </h3>
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            aria-label={`Edit ${labelOf(entity)}`}
            onClick={onEdit}
            className="rounded-[4px] p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-900"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label={`Delete ${labelOf(entity)}`}
            onClick={() =>
              deleteEntity.mutate(entity.id, { onSuccess: () => toast.success('Fact removed') })
            }
            className="rounded-[4px] p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-destructive-600"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      <p className="mt-1.5 flex-1 text-[13px] leading-relaxed text-gray-600">{valueOf(entity)}</p>

      {entity.extracted_source_url && (
        <Badge variant="neutral" className="mt-3 self-start">
          From your website
        </Badge>
      )}
    </article>
  )
}

function EntityDialog({
  entity,
  onClose,
}: {
  entity: KnowledgeEntity | 'new' | undefined
  onClose: () => void
}) {
  const saveEntity = useSaveKnowledgeEntity()
  const isNew = entity === 'new'
  const existing = entity && entity !== 'new' ? entity : undefined

  const [label, setLabel] = useState('')
  const [value, setValue] = useState('')

  /* Re-seed the form each time a different entity is opened. */
  const key = isNew ? 'new' : (existing?.id ?? 'none')
  const [seededKey, setSeededKey] = useState<string | number>('none')
  if (entity && key !== seededKey) {
    setSeededKey(key)
    setLabel(existing ? labelOf(existing) : '')
    setValue(existing ? valueOf(existing) : '')
  }

  const submit = () =>
    saveEntity.mutate(
      {
        id: existing?.id,
        slug: label
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, ''),
        entity: { label, value },
      },
      {
        onSuccess: () => {
          onClose()
          toast.success(isNew ? 'Fact added' : 'Fact updated')
        },
      }
    )

  return (
    <Dialog open={Boolean(entity)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isNew ? 'Add a fact' : 'Edit fact'}</DialogTitle>
          <DialogDescription>
            Aide treats these as true and will state them directly to customers.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3.5">
          <div>
            <Label htmlFor="entity-label">Name</Label>
            <Input
              id="entity-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              className="mt-1.5"
              placeholder="Return window"
            />
          </div>
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={!label.trim() || !value.trim() || saveEntity.isPending}
          >
            {saveEntity.isPending && <Loader2 className="animate-spin" />}
            {isNew ? 'Add fact' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
