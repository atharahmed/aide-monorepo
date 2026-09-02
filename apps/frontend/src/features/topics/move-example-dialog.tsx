import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Combobox, type ComboboxGroup } from '@/components/ui/combobox'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useMoveCardExample } from '@/lib/queries'
import { cleanExampleBody, truncate } from '@/lib/format'
import type { CardExample, Category, Id } from '@/types/api'

export function MoveExampleDialog({
  example,
  cardId,
  categories,
  onOpenChange,
}: {
  example: CardExample | null
  cardId: Id
  categories: Category[]
  onOpenChange: (open: boolean) => void
}) {
  const moveExample = useMoveCardExample()
  const [target, setTarget] = useState('')

  useEffect(() => {
    if (example) setTarget('')
  }, [example?.id])

  const groups = useMemo<ComboboxGroup[]>(
    () =>
      categories
        .flatMap((category) =>
          category.related_categories.map((sub) => ({
            name: `${category.name} · ${sub.name}`,
            options: sub.cards
              .filter((card) => card.id !== cardId)
              .map((card) => ({ value: String(card.id), label: card.name })),
          }))
        )
        .filter((group) => group.options.length > 0),
    [categories, cardId]
  )

  const move = () => {
    if (!example || !target) return
    moveExample.mutate(
      {
        cardId,
        exampleId: example.id,
        targetCardId: target,
        isPositive: example.is_positive !== false,
      },
      {
        onSuccess: () => {
          onOpenChange(false)
          toast.success('Example moved')
        },
        onError: () => toast.error('Could not move the example.'),
      }
    )
  }

  return (
    <Dialog open={Boolean(example)} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move example</DialogTitle>
          <DialogDescription>
            Pick the topic this example belongs to. Aide stops using it to detect the current topic.
          </DialogDescription>
        </DialogHeader>

        {example && (
          <p className="max-h-32 overflow-y-auto rounded-[10px] border border-black/5 bg-gray-50 px-3 py-2 text-[13px] leading-relaxed whitespace-pre-line text-gray-700">
            {truncate(cleanExampleBody(example.body), 400)}
          </p>
        )}

        <div>
          <Label>Move to</Label>
          <Combobox
            value={target}
            groups={groups}
            onChange={setTarget}
            className="mt-1.5"
            placeholder="Choose a topic…"
            searchPlaceholder="Search topics…"
            emptyMessage="No other topics."
            aria-label="Topic to move this example to"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={move} disabled={!target || moveExample.isPending}>
            {moveExample.isPending && <Loader2 className="animate-spin" />}
            Move example
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
