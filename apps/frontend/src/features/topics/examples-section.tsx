import { useMemo, useState } from 'react'
import {
  CornerUpRight,
  Loader2,
  MoreHorizontal,
  Plus,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ApiError } from '@/lib/api'
import { EmptyState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoveExampleDialog } from '@/features/topics/move-example-dialog'
import {
  useAddCardExample,
  useDeleteCardExample,
  useMoveCardExample,
  useUpdateCardExample,
} from '@/lib/queries'
import { cleanExampleBody, parseExampleEnvelope } from '@/lib/format'
import type { CardExample, Category, Id, TopicCard } from '@/types/api'

type Suggestion = 'review' | 'outlier' | 'move' | null

function suggestionOf(example: CardExample): Suggestion {
  if (example.is_positive === false) return null
  if (example.needs_review) return 'review'
  if (example.could_be_dropped) return 'outlier'
  if (example.move_to_card_id) return 'move'
  return null
}

function compareExamples(a: CardExample, b: CardExample): number {
  const pending = Number(suggestionOf(b) !== null) - Number(suggestionOf(a) !== null)
  return pending !== 0 ? pending : (b.updated_at ?? '').localeCompare(a.updated_at ?? '')
}

export function ExamplesSection({
  topic,
  categories,
}: {
  topic: TopicCard
  categories: Category[]
}) {
  const deleteExample = useDeleteCardExample()
  const [adding, setAdding] = useState(false)
  const [moving, setMoving] = useState<CardExample | null>(null)
  const [deleting, setDeleting] = useState<CardExample | null>(null)

  const examples = useMemo(
    () => [...(topic.examples ?? [])].sort(compareExamples),
    [topic.examples]
  )

  const topicNames = useMemo(() => {
    const names = new Map<string, string>()
    for (const category of categories)
      for (const sub of category.related_categories)
        for (const card of sub.cards) names.set(String(card.id), card.name)
    return names
  }, [categories])

  const confirmDelete = () => {
    if (!deleting) return
    deleteExample.mutate(
      { cardId: topic.id, exampleId: deleting.id },
      {
        onSuccess: () => {
          setDeleting(null)
          toast.success('Example deleted')
        },
        onError: () => toast.error('Could not delete the example.'),
      }
    )
  }

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="text-[17px] font-medium text-gray-800">Examples</h3>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-gray-400">{examples.length} reviewed</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Add an example"
                onClick={() => setAdding(true)}
              >
                <Plus />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">Add an example of {topic.name}</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {adding && <AddExampleForm cardId={topic.id} onDone={() => setAdding(false)} />}

      {examples.length > 0 ? (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-[14px] border border-black/5 bg-white">
          {examples.map((example) => (
            <ExampleRow
              key={example.id}
              topic={topic}
              example={example}
              moveTargetName={
                example.move_to_card_id
                  ? (topicNames.get(String(example.move_to_card_id)) ?? null)
                  : null
              }
              onMove={() => setMoving(example)}
              onDelete={() => setDeleting(example)}
            />
          ))}
        </ul>
      ) : (
        !adding && (
          <EmptyState
            title="No examples yet"
            description="Examples come from conversations you mark as right or wrong for this topic — or add one by hand to improve detection."
            action={
              <Button size="sm" onClick={() => setAdding(true)}>
                <Plus />
                Add example
              </Button>
            }
          />
        )
      )}

      <MoveExampleDialog
        example={moving}
        cardId={topic.id}
        categories={categories}
        onOpenChange={(open) => !open && setMoving(null)}
      />

      <Dialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete this example?</DialogTitle>
            <DialogDescription>Aide stops training on it. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Keep example
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteExample.isPending}
            >
              {deleteExample.isPending && <Loader2 className="animate-spin" />}
              Delete example
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ExampleRow({
  topic,
  example,
  moveTargetName,
  onMove,
  onDelete,
}: {
  topic: TopicCard
  example: CardExample
  moveTargetName: string | null
  onMove: () => void
  onDelete: () => void
}) {
  const updateExample = useUpdateCardExample()
  const moveExample = useMoveCardExample()

  const negative = example.is_positive === false
  const suggestion = suggestionOf(example)
  const { subject, from, to } = parseExampleEnvelope(example.body)
  const body = cleanExampleBody(example.body)
  const pending = updateExample.isPending || moveExample.isPending

  const settle = (message: string) =>
    updateExample.mutate(
      {
        cardId: topic.id,
        exampleId: example.id,
        isPositive: !negative,
        needsReview: false,
        couldBeDropped: false,
      },
      {
        onSuccess: () => toast.success(message),
        onError: () => toast.error('Could not update the example.'),
      }
    )

  const setSign = (isPositive: boolean) => {
    if (isPositive === !negative) return
    updateExample.mutate(
      {
        cardId: topic.id,
        exampleId: example.id,
        isPositive,
        needsReview: example.needs_review,
        couldBeDropped: example.could_be_dropped,
      },
      {
        onSuccess: () => toast.success(isPositive ? 'Marked as positive' : 'Marked as negative'),
        onError: () => toast.error('Could not update the example.'),
      }
    )
  }

  const acceptMove = () => {
    if (!example.move_to_card_id) return
    moveExample.mutate(
      {
        cardId: topic.id,
        exampleId: example.id,
        targetCardId: example.move_to_card_id,
        isPositive: !negative,
      },
      {
        onSuccess: () => toast.success(`Example moved to ${moveTargetName ?? 'the other topic'}`),
        onError: () => toast.error('Could not move the example.'),
      }
    )
  }

  return (
    <li
      className={cn(
        'flex flex-col gap-2 px-3 py-3',
        negative && 'bg-destructive-50/60',
        suggestion && 'bg-info-50/60'
      )}
    >
      {negative && (
        <p className="flex flex-wrap items-center gap-1.5 text-[12.5px] font-medium text-destructive-600">
          This is a negative example that will not be detected as
          <span className="max-w-full truncate rounded-[7px] bg-black/5 px-1.5 py-0.5 font-medium text-gray-700">
            {topic.name}
          </span>
        </p>
      )}

      {suggestion && (
        <p className="rounded-[10px] bg-info-100/60 px-3 py-2 text-[12.5px] font-medium text-info-700">
          {suggestion === 'review' &&
            'The following message may belong to this topic, but it has to be accepted:'}
          {suggestion === 'outlier' &&
            'Aide flagged this example as an outlier — it sits apart from the others.'}
          {suggestion === 'move' && (
            <>
              Aide thinks this example belongs to{' '}
              <span className="font-semibold">{moveTargetName ?? 'another topic'}</span> instead.
            </>
          )}
        </p>
      )}

      <div className="flex items-center gap-3">
        {subject && (
          <span className="min-w-0 shrink truncate text-[12.5px] font-medium text-gray-700">
            {subject}
          </span>
        )}
        <div className="ml-auto flex min-w-0 shrink items-center gap-1.5">
          {from && <span className="min-w-0 truncate text-[11.5px] text-gray-400">{from}</span>}
          {from && to && <span className="shrink-0 text-[10.5px] text-gray-300">→</span>}
          {to && <span className="min-w-0 truncate text-[11.5px] text-gray-400">{to}</span>}
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            aria-label="Belongs to this topic"
            onClick={() => setSign(true)}
            className={cn(
              'rounded-[4px] p-1 transition-colors',
              !negative
                ? 'bg-success-50 text-success-600'
                : 'text-gray-300 hover:bg-gray-100 hover:text-gray-600'
            )}
          >
            <ThumbsUp className="size-3" />
          </button>
          <button
            type="button"
            aria-label="Does not belong here"
            onClick={() => setSign(false)}
            className={cn(
              'rounded-[4px] p-1 transition-colors',
              negative
                ? 'bg-destructive-100 text-destructive-600'
                : 'text-gray-300 hover:bg-gray-100 hover:text-gray-600'
            )}
          >
            <ThumbsDown className="size-3" />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="More actions for this example"
                className="rounded-[4px] p-1 text-gray-300 transition-colors hover:bg-gray-100 hover:text-gray-600"
              >
                <MoreHorizontal className="size-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onMove}>
                <CornerUpRight />
                Move to…
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                <Trash2 />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <p className="rounded-[12px] border border-black/10 bg-white px-3.5 py-2 text-[13.5px] leading-relaxed whitespace-pre-line text-gray-800">
        {body || (
          <span className="rounded-[6px] bg-gray-100 px-1.5 py-0.5 font-mono text-[12px] text-gray-500">
            message is empty
          </span>
        )}
      </p>

      {suggestion && (
        <div className="flex gap-2">
          {suggestion === 'review' && (
            <>
              <Button size="sm" disabled={pending} onClick={() => settle('Example approved')}>
                {pending && <Loader2 className="animate-spin" />}
                Approve
              </Button>
              <Button variant="outline" size="sm" onClick={onDelete}>
                Reject
              </Button>
            </>
          )}

          {suggestion === 'outlier' && (
            <>
              <Button size="sm" disabled={pending} onClick={() => settle('Example kept')}>
                {pending && <Loader2 className="animate-spin" />}
                Keep
              </Button>
              <Button variant="outline" size="sm" onClick={onDelete}>
                Delete
              </Button>
            </>
          )}

          {suggestion === 'move' && (
            <>
              <Button size="sm" disabled={pending} onClick={acceptMove}>
                {pending && <Loader2 className="animate-spin" />}
                Move to {moveTargetName ?? 'the other topic'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => settle('Example kept')}
              >
                Keep
              </Button>
            </>
          )}
        </div>
      )}
    </li>
  )
}

function AddExampleForm({ cardId, onDone }: { cardId: Id; onDone: () => void }) {
  const addExample = useAddCardExample()
  const [body, setBody] = useState('')
  const [clash, setClash] = useState<string | null>(null)

  const save = () => {
    const trimmed = body.trim()
    if (!trimmed) return

    addExample.mutate(
      { cardId, body: trimmed, isPositive: true, checkCompatibility: !clash },
      {
        onSuccess: () => {
          toast.success('Example added')
          onDone()
        },
        onError: (error) => {
          const reasoning =
            error instanceof ApiError && error.status === 422
              ? (error.body as { reasoning?: string } | null)?.reasoning
              : undefined

          if (reasoning) setClash(reasoning)
          else toast.error('Could not add the example.')
        },
      }
    )
  }

  return (
    <div className="mb-3 flex flex-col gap-2 rounded-[14px] border border-black/5 bg-white p-3">
      <Textarea
        autoFocus
        value={body}
        placeholder="Type or paste an example message…"
        aria-label="New example"
        onChange={(event) => {
          setBody(event.target.value)
          setClash(null)
        }}
      />

      {clash && (
        <div className="rounded-[10px] border border-warning-200 bg-warning-50 px-3 py-2">
          <p className="text-[12px] font-medium text-warning-700">
            This does not look like the other examples
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-warning-700/90">{clash}</p>
        </div>
      )}

      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={!body.trim() || addExample.isPending}>
          {addExample.isPending && <Loader2 className="animate-spin" />}
          {clash ? 'Save anyway' : 'Save example'}
        </Button>
        <Button variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
