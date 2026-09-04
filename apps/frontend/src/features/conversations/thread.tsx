import { useMemo, useState } from 'react'
import { BookOpen, CornerUpLeft, SendHorizonal, Tag, ThumbsDown, ThumbsUp, Zap } from 'lucide-react'
import { format, isToday, isYesterday } from 'date-fns'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { renderMarkdown } from '@/lib/markdown'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  useAddCardExample,
  useDeleteCardExample,
  useDraftFeedback,
  useKnowledgeFeedback,
  useSelectionOptions,
  useWorkflowFeedback,
} from '@/lib/queries'
import type {
  Id,
  KnowledgeUsed,
  Ticket,
  TicketCard,
  TicketComment,
  TicketDraft,
  TicketExecutedWorkflow,
} from '@/types/api'

/**
 * The conversation thread, in the shape of the original dashboard.
 *
 * Messages read like a chat: customer on the left in a soft gray bubble, agent
 * on the right in white, timestamp inside the bubble. Everything the AI did is
 * deliberately quiet — a 12px row with a small icon and the item's name, ending
 * in a colored pip. Clicking a pip expands that item into a white detail card
 * with its description, score and feedback thumbs, so the transcript stays
 * legible until you ask a question of it.
 */

/** Signature colors for each event kind, carried over from the old dashboard. */
const PIP = {
  topic: '#569AD8',
  scenario: '#DEA732',
  draft: '#5DB49F',
  knowledge: '#9885D0',
} as const

/** A message reduced to what the feedback endpoints need to identify it. */
interface CommentRef {
  id: Id
  ticketId: Id
  body: string
}

/** One message plus every AI event the backend attached to it. */
interface CommentGroup {
  comment: TicketComment
  topics: TicketCard[]
  scenarios: TicketExecutedWorkflow[]
  drafts: TicketDraft[]
  knowledge: KnowledgeUsed[]
  /** The customer message this comment answers — feedback is filed against it. */
  lastFromCustomer?: CommentRef
}

const commentTime = (comment: TicketComment) => comment.external_created_at ?? comment.created_at

function formatThreadTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const time = format(date, 'h:mm a')
  if (isToday(date)) return `today at ${time}`
  if (isYesterday(date)) return `yesterday at ${time}`
  return `${format(date, 'd MMM yyyy')} at ${time}`
}

/**
 * Feedback on an AI answer is filed against the customer question that prompted
 * it, so the walk keeps a running reference to the last customer message.
 */
function buildGroups(ticket: Ticket): CommentGroup[] {
  const groups: CommentGroup[] = []
  let lastFromCustomer: CommentRef | undefined

  for (const comment of ticket.comments) {
    groups.push({
      comment,
      topics: ticket.cards
        .filter((card) => card.comment_id === comment.id)
        .sort((a, b) => b.confidence - a.confidence),
      scenarios: ticket.executedWorkflows.filter((entry) => entry.comment_id === comment.id),
      drafts: ticket.drafts.filter((entry) => entry.comment_id === comment.id),
      knowledge: comment.bot_response_knowledge_used ?? [],
      lastFromCustomer,
    })

    if (comment.is_customer_reply) {
      lastFromCustomer = {
        id: comment.id,
        ticketId: ticket.id,
        body: comment.clean_body ?? comment.body ?? '',
      }
    }
  }

  return groups
}

export function TicketThread({
  ticket,
  onInsertDraft,
}: {
  ticket: Ticket
  onInsertDraft: (text: string) => void
}) {
  const groups = useMemo(() => buildGroups(ticket), [ticket])
  /* One selection per comment: `topic-1`, `scenario-4`, `draft-9`, `knowledge-2`.
   * Clicking the same pip again collapses the card. */
  const [selected, setSelected] = useState<Record<Id, string | undefined>>({})

  const toggle = (commentId: Id, value: string) =>
    setSelected((current) => ({
      ...current,
      [commentId]: current[commentId] === value ? undefined : value,
    }))

  return (
    <div className="flex flex-col gap-y-3 px-5 pt-4 pb-6">
      {groups.map((group) => {
        const comment = group.comment
        const selection = selected[comment.id]
        const selectedTopic = group.topics.find((card) => `topic-${card.id}` === selection)
        const selectedScenario = group.scenarios.find(
          (entry) => `scenario-${entry.id}` === selection
        )
        const selectedDraft = group.drafts.find((draft) => `draft-${draft.id}` === selection)
        const selectedKnowledge = group.knowledge.find(
          (article) => `knowledge-${article.id}` === selection
        )

        return (
          <div key={comment.id} className="flex flex-col gap-y-2">
            <CommentBubble comment={comment} ticketId={ticket.id} />

            {group.topics.length > 0 && (
              <EventRow icon={<Tag size={12} />} label={group.topics.length === 1 ? 'Topic' : 'Topics'}>
                {group.topics.map((card) => (
                  <PipButton
                    key={card.id}
                    selected={selection === `topic-${card.id}`}
                    color={PIP.topic}
                    onClick={() => toggle(comment.id, `topic-${card.id}`)}
                  >
                    {card.name}
                  </PipButton>
                ))}
              </EventRow>
            )}
            {selectedTopic && (
              <TopicDetail card={selectedTopic} comment={comment} ticketId={ticket.id} />
            )}

            {group.scenarios.length > 0 && (
              <EventRow
                icon={<Zap size={12} />}
                label={group.scenarios.length === 1 ? 'Scenario' : 'Scenarios'}
              >
                {group.scenarios.map((entry) => (
                  <PipButton
                    key={entry.id}
                    selected={selection === `scenario-${entry.id}`}
                    color={PIP.scenario}
                    onClick={() => toggle(comment.id, `scenario-${entry.id}`)}
                  >
                    {entry.name}
                  </PipButton>
                ))}
              </EventRow>
            )}
            {selectedScenario && <ScenarioDetail executed={selectedScenario} ticketId={ticket.id} />}

            {group.drafts.length > 0 && (
              <EventRow
                icon={<SendHorizonal size={12} />}
                label={group.drafts.length === 1 ? 'Draft' : 'Drafts'}
              >
                {group.drafts.map((draft) => (
                  <PipButton
                    key={draft.id}
                    selected={selection === `draft-${draft.id}`}
                    color={PIP.draft}
                    onClick={() => toggle(comment.id, `draft-${draft.id}`)}
                  >
                    Generated reply
                  </PipButton>
                ))}
              </EventRow>
            )}
            {selectedDraft && <DraftDetail draft={selectedDraft} onInsert={onInsertDraft} />}

            {group.knowledge.length > 0 && (
              <EventRow icon={<BookOpen size={12} />} label="Knowledge" align="right">
                {[...group.knowledge]
                  .sort((a, b) => b.relevance_score - a.relevance_score)
                  .map((article) => (
                    <PipButton
                      key={article.id}
                      selected={selection === `knowledge-${article.id}`}
                      color={PIP.knowledge}
                      onClick={() => toggle(comment.id, `knowledge-${article.id}`)}
                    >
                      {article.title}
                    </PipButton>
                  ))}
              </EventRow>
            )}
            {selectedKnowledge && (
              <KnowledgeDetail
                article={selectedKnowledge}
                agentComment={{
                  id: comment.id,
                  ticketId: ticket.id,
                  body: comment.clean_body ?? comment.body ?? '',
                }}
                endUserComment={group.lastFromCustomer}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Messages                                                                    */
/* -------------------------------------------------------------------------- */

function CommentBubble({ comment, ticketId }: { comment: TicketComment; ticketId: Id }) {
  const isAgent = comment.is_agent_reply
  const author = comment.from_name || comment.from_handle || (isAgent ? 'Agent' : 'Customer')
  const at = commentTime(comment)
  const body = comment.clean_body || comment.body || ''

  return (
    <div
      className={cn('group flex flex-col items-start gap-y-1', isAgent ? 'ml-[5vw]' : 'mr-[5vw]')}
    >
      <div className="flex items-baseline gap-x-1.5 px-1">
        <span className="text-[12px] font-[550] text-black/70">{author}</span>
        {comment.from_handle && comment.from_handle !== author && (
          <span className="truncate text-[11.5px] font-[500] text-black/20">
            {comment.from_handle}
          </span>
        )}
      </div>

      <div className="flex items-end gap-x-2">
        <div
          className={cn(
            'w-fit max-w-[520px] rounded-[17px] px-[12px] pt-[10px] pb-[7px] text-[14px] leading-[1.45] font-[460]',
            isAgent
              ? 'border border-black/5 bg-white text-black/75'
              : 'border border-black/0 bg-black/[0.03] text-black/70'
          )}
        >
          {body.trim() ? (
            <div
              className="prose-thread break-words"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }}
            />
          ) : (
            <span className="text-black/30">(empty message)</span>
          )}
          <div className="mt-1 flex justify-end">
            <time className="text-[10px] text-black/25 lowercase" dateTime={at}>
              {formatThreadTime(at)}
            </time>
          </div>
        </div>

        {!isAgent && body.trim() && <AddTopicExample comment={comment} ticketId={ticketId} />}
      </div>
    </div>
  )
}

function AddTopicExample({ comment, ticketId }: { comment: TicketComment; ticketId: Id }) {
  const { data: options } = useSelectionOptions()
  const addExample = useAddCardExample()
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={addExample.isPending}
          className="mb-1 shrink-0 cursor-pointer rounded-[7px] border border-black/5 bg-white px-2 py-[3px] text-[11px] font-[550] text-black/40 opacity-0 transition-all group-hover:opacity-100 hover:border-black/15 hover:text-black/70 focus-visible:opacity-100 data-[state=open]:opacity-100"
        >
          Add topic
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-64 p-0">
        <Command>
          <div className="px-3 pt-2.5 pb-1 text-[12px] font-[500] text-black/40">
            Select topic to assign
          </div>
          <CommandInput placeholder="Search topics…" />
          <CommandList>
            <CommandEmpty>No topics match.</CommandEmpty>
            <CommandGroup>
              {(options?.topics ?? []).map((topic) => (
                <CommandItem
                  key={topic.id}
                  value={`${topic.name} ${topic.category?.name ?? ''}`}
                  onSelect={() => {
                    setOpen(false)
                    addExample.mutate(
                      {
                        cardId: topic.id,
                        commentId: comment.id,
                        ticketId,
                        body: comment.clean_body ?? comment.body ?? '',
                        isPositive: true,
                      },
                      {
                        onSuccess: () => toast.success(`Added as an example of ${topic.name}`),
                        onError: () => toast.error('Could not add the example.'),
                      }
                    )
                  }}
                >
                  {topic.emoji && <span className="w-4 text-center">{topic.emoji}</span>}
                  <span className="min-w-0 flex-1 truncate">{topic.name}</span>
                  {topic.category?.name && (
                    <span className="shrink-0 text-[11.5px] text-gray-400">
                      {topic.category.name}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/* -------------------------------------------------------------------------- */
/* AI event rows                                                               */
/* -------------------------------------------------------------------------- */

function EventRow({
  icon,
  label,
  align = 'left',
  children,
}: {
  icon: React.ReactNode
  label: string
  align?: 'left' | 'right'
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'flex flex-row items-start gap-x-8 text-[12px] font-[500] text-black/35',
        align === 'right' ? 'ml-auto' : 'mr-auto'
      )}
    >
      <div className="flex h-[18px] flex-row items-center gap-x-1">
        {icon}
        {label}
      </div>
      <div className="flex flex-col items-start gap-y-0.5">{children}</div>
    </div>
  )
}

function PipButton({
  selected,
  color,
  onClick,
  children,
}: {
  selected: boolean
  color: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={selected}
      className="inline-flex cursor-pointer items-baseline transition-colors hover:text-black"
    >
      <span>{children}</span>
      <span className="relative ml-1 inline-block size-[10px] self-center">
        <span
          className="absolute inset-0 rounded-full border-[1.5px]"
          style={{ borderColor: color }}
        />
        {selected && (
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="size-[4px] rounded-full" style={{ background: color }} />
          </span>
        )}
      </span>
    </button>
  )
}

/* -------------------------------------------------------------------------- */
/* Detail cards                                                                */
/* -------------------------------------------------------------------------- */

function DetailCard({
  title,
  align = 'left',
  children,
}: {
  title: string
  align?: 'left' | 'right'
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'flex w-fit max-w-[520px] flex-col rounded-[16px] border border-black/5 bg-white p-4 shadow-sm',
        align === 'right' && 'ml-auto'
      )}
    >
      <span className="text-[12px] font-[600] text-black/65">{title}</span>
      {children}
    </div>
  )
}

function FeedbackButtons({
  saved,
  positive,
  onVote,
  disabled,
  labels = { up: 'Correct', down: 'Wrong' },
}: {
  saved: boolean
  positive?: boolean
  onVote: (isPositive: boolean) => void
  disabled?: boolean
  labels?: { up: string; down: string }
}) {
  return (
    <span className="inline-flex items-center gap-0.5">
      <button
        type="button"
        aria-label={labels.up}
        aria-pressed={saved && positive === true}
        title={labels.up}
        disabled={disabled}
        onClick={() => onVote(true)}
        className={cn(
          'rounded-[4px] p-1 transition-colors disabled:opacity-40',
          saved && positive
            ? 'bg-success-50 text-success-600'
            : 'text-gray-300 hover:bg-gray-100 hover:text-gray-600'
        )}
      >
        <ThumbsUp className="size-3" />
      </button>
      <button
        type="button"
        aria-label={labels.down}
        aria-pressed={saved && positive === false}
        title={labels.down}
        disabled={disabled}
        onClick={() => onVote(false)}
        className={cn(
          'rounded-[4px] p-1 transition-colors disabled:opacity-40',
          saved && positive === false
            ? 'bg-destructive-50 text-destructive-600'
            : 'text-gray-300 hover:bg-gray-100 hover:text-gray-600'
        )}
      >
        <ThumbsDown className="size-3" />
      </button>
    </span>
  )
}

/** The old dashboard's confidence scale: red under 40%, amber under 75%. */
function confidenceBadge(confidence: number | null | undefined) {
  if (!confidence) return { text: 'Manually added', className: 'bg-gray-100 text-gray-500' }
  return {
    text: `${Math.floor(confidence * 1000) / 10}%`,
    className:
      confidence < 0.4
        ? 'bg-destructive-50 text-destructive-500'
        : confidence < 0.75
          ? 'bg-[#DEA732]/10 text-[#DEA732]'
          : 'bg-[#5DB49F]/10 text-[#5DB49F]',
  }
}

/**
 * Topic feedback is stored as a card example rather than a feedback row: a vote
 * adds one, voting the same way again removes it, and flipping the vote
 * replaces it. That asymmetry is the API's, not this component's.
 */
function TopicDetail({
  card,
  comment,
  ticketId,
}: {
  card: TicketCard
  comment: TicketComment
  ticketId: Id
}) {
  const addExample = useAddCardExample()
  const deleteExample = useDeleteCardExample()

  const { saved, savedPositive, exampleId } = card.feedback
  const pending = addExample.isPending || deleteExample.isPending
  const badge = confidenceBadge(card.confidence)

  const vote = async (isPositive: boolean) => {
    try {
      if (saved) {
        await deleteExample.mutateAsync({ cardId: card.id, exampleId, commentId: card.comment_id })
        if (savedPositive === isPositive) {
          toast.success('Removed as training example')
          return
        }
      }

      await addExample.mutateAsync({
        cardId: card.id,
        commentId: card.comment_id,
        ticketId,
        body: comment.clean_body ?? comment.body ?? '',
        isPositive,
      })
      toast.success(isPositive ? 'Added as training example' : 'Added as negative example')
    } catch {
      toast.error('Could not save the feedback. Try again.')
    }
  }

  return (
    <DetailCard title={`${card.emoji ? `${card.emoji} ` : ''}${card.name}`}>
      {card.description && (
        <p className="py-2 text-[13px] leading-relaxed text-black/75">{card.description}</p>
      )}
      <p className="text-[12px] leading-relaxed text-black/40">
        Aide&apos;s confidence in this prediction was{' '}
        <span className={cn('rounded px-1 py-0.5 font-[550]', badge.className)}>
          {badge.text.toLowerCase()}
        </span>
        . Feedback improves accuracy on future conversations.
      </p>
      <div className="mt-2">
        <FeedbackButtons
          saved={saved}
          positive={savedPositive}
          disabled={pending}
          onVote={(isPositive) => void vote(isPositive)}
          labels={{ up: 'Right topic', down: 'Wrong topic' }}
        />
      </div>
    </DetailCard>
  )
}

/** Past-tense labels for what a scenario actually did. Unknown types show raw. */
const ACTION_LABELS: Record<string, string> = {
  PROMPT_INSTRUCTION: 'Applied instruction',
  PREGENERATE_REPLY: 'Pre-wrote a reply',
  GENERATE_REPLY: 'Wrote a reply',
  SUGGEST_REPLY: 'Suggested a reply',
  REPLY: 'Sent a reply',
  SUGGEST_MACRO: 'Suggested macro',
  APPLY_MACRO: 'Ran macro',
  MACRO: 'Ran macro',
  ADD_TAG: 'Added tag',
  CLOSE_TICKET: 'Closed conversation',
  ASSIGN: 'Assigned',
  COLLECT_FIELD: 'Collected field',
}

function ScenarioDetail({
  executed,
  ticketId,
}: {
  executed: TicketExecutedWorkflow
  ticketId: Id
}) {
  const feedback = useWorkflowFeedback()

  return (
    <DetailCard title={executed.name}>
      <div className="flex flex-col gap-y-1 pt-2">
        <span className="text-[12px] font-[500] text-black/30">Actions</span>
        {executed.actions.map((action) => (
          <div key={action.id} className="flex gap-x-2 text-[12.5px] leading-relaxed">
            <span className="w-[122px] shrink-0 text-gray-500">
              {ACTION_LABELS[action.action_type] ?? action.action_type}
            </span>
            <span className="min-w-0 flex-1 text-gray-800">{action.action_value}</span>
          </div>
        ))}
      </div>
      <div className="mt-2">
        <FeedbackButtons
          saved={executed.feedback.saved}
          positive={executed.feedback.savedPass}
          disabled={feedback.isPending}
          onVote={(isPositive) => {
            /* Pressing the active thumb again withdraws the feedback. */
            const removing = executed.feedback.saved && executed.feedback.savedPass === isPositive
            feedback.mutate(
              {
                executedWorkflowId: executed.id,
                ticketId,
                saved: !removing,
                savedPass: isPositive,
              },
              {
                onSuccess: () =>
                  toast.success(
                    removing
                      ? 'Removed feedback from scenario'
                      : isPositive
                        ? 'Added positive feedback to scenario'
                        : 'Added negative feedback to scenario'
                  ),
                onError: () => toast.error('Could not save the feedback. Try again.'),
              }
            )
          }}
          labels={{ up: 'Should have run', down: 'Should not have run' }}
        />
      </div>
      {executed.feedback.saved && !executed.feedback.savedPass && executed.feedback.note && (
        <div className="mt-2 w-fit rounded-[8px] border border-dashed border-destructive-300 bg-destructive-50 px-2 py-1 text-[12px] text-black/40">
          Feedback note: {executed.feedback.note}
        </div>
      )}
    </DetailCard>
  )
}

function DraftDetail({
  draft,
  onInsert,
}: {
  draft: TicketDraft
  onInsert: (text: string) => void
}) {
  const feedback = useDraftFeedback()
  const knowledgeUsed = draft.knowledge_used ?? []

  return (
    <DetailCard title="Generated draft">
      <div
        className="prose-thread py-2 text-[13.5px] leading-relaxed text-black/75"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(draft.llm_generation) }}
      />
      <p className="text-[12px] text-black/30">
        This draft was {draft.inserted ? 'inserted' : 'not inserted'}.
      </p>

      {knowledgeUsed.length > 0 && (
        <div className="pt-2">
          <span className="text-[12px] font-[500] text-black/30">Answered from</span>
          <ul className="mt-1 flex flex-col gap-y-1">
            {knowledgeUsed.map((article) => (
              <li key={article.id} className="flex items-start gap-x-1.5 text-[12.5px]">
                <BookOpen className="mt-0.5 size-3 shrink-0 text-gray-400" />
                <span className="min-w-0 flex-1 text-gray-600">{article.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 flex items-center gap-x-2">
        <button
          type="button"
          onClick={() => onInsert(draft.llm_generation)}
          className="inline-flex h-6 items-center gap-1.5 rounded-[6px] bg-gray-950 px-2 text-[12px] font-medium text-white transition-colors hover:bg-gray-800"
        >
          <CornerUpLeft className="size-3" />
          Use this draft
        </button>
        <FeedbackButtons
          saved={draft.feedback.saved}
          positive={draft.feedback.savedGood}
          disabled={feedback.isPending}
          onVote={(isPositive) => {
            /* Pressing the active thumb again withdraws the feedback. */
            const removing = draft.feedback.saved && draft.feedback.savedGood === isPositive
            feedback.mutate(
              {
                cachedLlmGenerationId: draft.id,
                ticketId: draft.ticket_id,
                saved: !removing,
                savedGood: isPositive,
              },
              {
                onSuccess: () =>
                  toast.success(
                    removing
                      ? 'Removed feedback from draft'
                      : isPositive
                        ? 'Added positive feedback to draft'
                        : 'Added negative feedback to draft'
                  ),
                onError: () => toast.error('Could not save the feedback. Try again.'),
              }
            )
          }}
          labels={{ up: 'Good draft', down: 'Poor draft' }}
        />
      </div>
    </DetailCard>
  )
}

function KnowledgeDetail({
  article,
  agentComment,
  endUserComment,
}: {
  article: KnowledgeUsed
  agentComment: CommentRef
  endUserComment?: CommentRef
}) {
  const feedback = useKnowledgeFeedback()
  const relevance = `${Math.floor(article.relevance_score * 1000) / 10}%`

  return (
    <DetailCard title={article.title ?? 'Knowledge used'} align="right">
      {article.blurb && (
        <p className="py-2 text-[12.5px] leading-relaxed text-black/60">{article.blurb}</p>
      )}
      <p className="text-[12px] leading-relaxed text-black/40">
        Aide&apos;s relevance score for this knowledge was{' '}
        <span className="rounded bg-[#9885D0]/10 px-1 py-0.5 font-[550] text-[#9885D0]">
          {relevance}
        </span>
        . Feedback improves accuracy on future conversations.
      </p>
      <div className="mt-2 flex items-center gap-x-2">
        <FeedbackButtons
          saved={article.feedback.saved}
          positive={article.feedback.savedPositive}
          /* The endpoint files this against the question that prompted the
           * answer, so with no customer message there is nothing to file. */
          disabled={!endUserComment || feedback.isPending}
          onVote={(isPositive) => {
            if (!endUserComment) return
            /* Pressing the active thumb again withdraws the feedback. */
            const removing =
              article.feedback.saved && article.feedback.savedPositive === isPositive
            feedback.mutate(
              {
                knowledgeDocumentId: article.id,
                agentComment,
                endUserComment,
                answer: `# ${article.title ?? ''}\n${article.blurb}`,
                knowledgeSetName: article.knowledge_set_name ?? undefined,
                saved: !removing,
                savedPositive: isPositive,
              },
              {
                onSuccess: () =>
                  toast.success(
                    removing
                      ? 'Removed feedback from knowledge'
                      : isPositive
                        ? 'Added positive feedback to knowledge'
                        : 'Added negative feedback to knowledge'
                  ),
                onError: () => toast.error('Could not save the feedback. Try again.'),
              }
            )
          }}
          labels={{ up: 'Relevant article', down: 'Irrelevant article' }}
        />
        {article.link && (
          <a
            href={article.link}
            target="_blank"
            rel="noreferrer"
            className="text-[12px] text-black/40 underline underline-offset-2 hover:text-black/70"
          >
            Open article ↗
          </a>
        )}
      </div>
    </DetailCard>
  )
}
