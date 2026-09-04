import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { ClipboardCheck, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { PageHeader, PageBody } from '@/components/page-header'
import { EmptyState, ErrorState } from '@/components/empty-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
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
import { OnboardingReminders } from '@/features/onboarding/components'
import { KnowledgeTabs } from '@/features/knowledge/tabs'
import { CreateReferenceDialog } from '@/features/knowledge/create-reference-dialog'
import {
  DEFAULT_SYNC_FREQUENCY,
  SYNC_FREQUENCIES,
  entityDefinition,
  entityDisplayName,
  entityHref,
} from '@/features/knowledge/business-entities'
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

function BusinessInformationPage() {
  const { data: user } = useMe()
  const { data: entities, isLoading, isError, refetch } = useKnowledgeEntities()
  const deleteEntity = useDeleteKnowledgeEntity()

  const [editing, setEditing] = useState<KnowledgeEntity>()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<KnowledgeEntity>()

  const openCreate = () => {
    setEditing(undefined)
    setDialogOpen(true)
  }

  const openEdit = (entity: KnowledgeEntity) => {
    setEditing(entity)
    setDialogOpen(true)
  }

  const confirmDelete = () => {
    if (!pendingDelete) return
    deleteEntity.mutate(pendingDelete.id, {
      onSuccess: () => {
        setPendingDelete(undefined)
        toast.success('Reference deleted')
      },
      onError: () => toast.error('Failed to delete the reference.'),
    })
  }

  return (
    <>
      <PageHeader
        title="Business information"
        description="How your business is reachable — the references Aide states as fact."
        tabs={<KnowledgeTabs value="business" />}
        meta={
          entities && (
            <span className="text-[12.5px] text-gray-400 tabular-nums">{entities.length}</span>
          )
        }
        actions={
          <>
            <OnboardingReminders
              user={user}
              page="business-information"
              className="mr-1 hidden lg:flex"
            />
            <Button size="sm" className="pr-4" onClick={openCreate}>
              <Plus />
              Create reference
            </Button>
          </>
        }
      />

      <PageBody className="mx-auto w-full max-w-[680px]">
        {isLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="rounded-[14px] border border-black/5 bg-white p-3">
                <Skeleton className="h-3.5 w-1/3" />
                <Skeleton className="mt-2.5 h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <ErrorState
            title="Failed to fetch business information"
            description="The request failed. Try again, and if it keeps happening let us know."
            action={
              <Button size="sm" onClick={() => refetch()}>
                Try again
              </Button>
            }
          />
        ) : (entities ?? []).length === 0 ? (
          <EmptyState
            icon={<ClipboardCheck className="size-4" />}
            title="No references yet"
            description="Add the ways people reach you — phone, email, social profiles, app listings. Aide states them as fact when a customer asks."
            action={<Button onClick={openCreate}>Create the first reference</Button>}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {(entities ?? []).map((entity) => (
              <EntityCard
                key={entity.id}
                entity={entity}
                onEdit={() => openEdit(entity)}
                onDelete={() => setPendingDelete(entity)}
              />
            ))}
          </div>
        )}
      </PageBody>

      <CreateReferenceDialog
        open={dialogOpen}
        entity={editing}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) setEditing(undefined)
        }}
      />

      <Dialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Delete reference to {pendingDelete && entityDefinition(pendingDelete.slug).title}
            </DialogTitle>
            <DialogDescription>
              Aide uses this information to better understand your business. This action cannot be
              undone, but you can always add more references later.
            </DialogDescription>
          </DialogHeader>

          {pendingDelete && (
            <div className="flex items-center gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                <EntityIcon slug={pendingDelete.slug} className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-gray-900">
                  {entityDefinition(pendingDelete.slug).title}
                </p>
                <p className="truncate text-[12.5px] text-gray-400">
                  {entityDisplayName(pendingDelete.slug, pendingDelete.entity)}
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(undefined)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteEntity.isPending}>
              {deleteEntity.isPending && <Loader2 className="animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function EntityIcon({ slug, className }: { slug: string; className?: string }) {
  const Icon = entityDefinition(slug).icon
  return <Icon className={cn('size-4', className)} />
}

function EntityCard({
  entity,
  onEdit,
  onDelete,
}: {
  entity: KnowledgeEntity
  onEdit: () => void
  onDelete: () => void
}) {
  const saveEntity = useSaveKnowledgeEntity()
  const definition = entityDefinition(entity.slug)
  const displayName = entityDisplayName(entity.slug, entity.entity)
  const href = entityHref(entity.slug, entity.entity)

  const [note, setNote] = useState(entity.note ?? '')

  const save = (payload: { note?: string; syncFrequency?: string }) =>
    saveEntity.mutate(
      {
        id: entity.id,
        slug: entity.slug,
        entity: entity.entity,
        note: entity.note ?? undefined,
        ...(entity.sync_frequency ? { syncFrequency: entity.sync_frequency } : {}),
        ...payload,
      },
      {
        onSuccess: () => toast.success('Information updated successfully'),
        onError: () => {
          setNote(entity.note ?? '')
          toast.error('Failed to update item')
        },
      }
    )

  return (
    <div className="flex gap-2">
      <div className="min-w-0 flex-1 overflow-hidden rounded-[14px] border border-black/5 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-black/5 px-3 py-2">
          <div className="flex min-w-0 items-center gap-1.5 text-gray-400">
            <EntityIcon slug={entity.slug} />
            <span className="truncate text-[13px] font-medium text-gray-500">
              {definition.title}
            </span>
            {entity.extracted_source_url && (
              <Badge variant="neutral" className="ml-1 shrink-0">
                From your website
              </Badge>
            )}
          </div>

          {href ? (
            <a
              href={href}
              target={href.startsWith('http') ? '_blank' : undefined}
              rel="noopener noreferrer"
              className="truncate text-right text-[13px] font-medium text-gray-900 underline underline-offset-2 hover:text-gray-950"
            >
              {displayName}
            </a>
          ) : (
            <span className="truncate text-right text-[13px] font-medium text-gray-900">
              {displayName}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 bg-black/2 px-2 py-1.5">
          <Input
            value={note}
            aria-label="Note"
            placeholder="Add note (optional)"
            onChange={(event) => setNote(event.target.value)}
            onBlur={() => {
              if (note !== (entity.note ?? '')) save({ note })
            }}
            className="h-7 min-w-0 flex-1 border-transparent bg-transparent px-1.5 text-[12.5px] hover:border-black/5"
          />

          {entity.slug === 'youtube_channel' && (
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-[12px] font-medium text-gray-400">Sync frequency:</span>
              <Select
                value={entity.sync_frequency ?? DEFAULT_SYNC_FREQUENCY}
                onValueChange={(value) => save({ syncFrequency: value })}
              >
                <SelectTrigger aria-label="Sync frequency" className="h-7 w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SYNC_FREQUENCIES.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Delete reference" onClick={onDelete}>
              <Trash2 className="text-gray-400" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Delete reference</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Edit reference" onClick={onEdit}>
              <Pencil className="text-gray-400" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Edit reference</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}
