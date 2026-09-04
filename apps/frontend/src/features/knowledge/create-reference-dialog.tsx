import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import {
  ENTITY_DEFINITIONS,
  entityDefinition,
  entityValues,
  knownEntityDefinition,
  type EntityValues,
} from '@/features/knowledge/business-entities'
import { useSaveKnowledgeEntity } from '@/lib/queries'
import type { KnowledgeEntity } from '@/types/api'

export function CreateReferenceDialog({
  open,
  entity,
  onOpenChange,
}: {
  open: boolean
  entity?: KnowledgeEntity
  onOpenChange: (open: boolean) => void
}) {
  const saveEntity = useSaveKnowledgeEntity()
  const [slug, setSlug] = useState<string>()
  const [values, setValues] = useState<EntityValues>({})

  useEffect(() => {
    if (!open) return

    if (entity) {
      const known = knownEntityDefinition(entity.slug)
      setSlug(known?.slug)
      setValues(known ? entityValues(known, entity.entity) : {})
    } else {
      setSlug(undefined)
      setValues({})
    }
  }, [open, entity])

  const definition = slug ? entityDefinition(slug) : undefined

  /* An existing reference keeps its type, unless its slug is one this build
   * cannot place — then picking a type is the only way to repair the row. */
  const lockedToType = Boolean(entity && knownEntityDefinition(entity.slug))

  const changeType = (next: string) => {
    setSlug(next)
    const fields = entityDefinition(next).fields.map(({ key }) => key)
    setValues((previous) =>
      Object.fromEntries(fields.filter((key) => previous[key]).map((key) => [key, previous[key]]))
    )
  }

  const submit = () => {
    if (!slug) return

    saveEntity.mutate(
      {
        id: entity?.id,
        slug,
        entity: values,
        ...(entity ? { note: entity.note ?? undefined } : {}),
        ...(entity?.sync_frequency ? { syncFrequency: entity.sync_frequency } : {}),
      },
      {
        onSuccess: () => {
          onOpenChange(false)
          toast.success(entity ? 'Reference updated' : 'Reference created')
        },
        onError: () => toast.error('Failed to save entity. Please try again.'),
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{entity ? 'Update Reference' : 'Create New Reference'}</DialogTitle>
          <DialogDescription>
            Aide uses these references to understand how your business is reachable.
          </DialogDescription>
        </DialogHeader>

        <Select value={slug} onValueChange={changeType} disabled={lockedToType}>
          <SelectTrigger aria-label="Entity type">
            <SelectValue placeholder="Select Entity Type" />
          </SelectTrigger>
          <SelectContent>
            {ENTITY_DEFINITIONS.map((option) => (
              <SelectItem key={option.slug} value={option.slug}>
                {option.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {definition && definition.fields.length > 0 && (
          <div className="flex flex-col gap-3">
            {definition.fields.map((field) => (
              <Input
                key={field.key}
                name={field.key}
                aria-label={field.label}
                placeholder={field.label}
                value={values[field.key] ?? ''}
                onChange={(event) =>
                  setValues((previous) => ({ ...previous, [field.key]: event.target.value }))
                }
              />
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!slug || saveEntity.isPending}>
            {saveEntity.isPending && <Loader2 className="animate-spin" />}
            {entity ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
