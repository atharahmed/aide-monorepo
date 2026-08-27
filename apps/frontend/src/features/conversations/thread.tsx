import { useMemo } from 'react'
import { BookOpen, CornerUpLeft, Sparkles, Tag, ThumbsDown, ThumbsUp, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatFullDate, initialsOf } from '@/lib/format'
import {
  useAddCardExample,
  useDeleteCardExample,
  useDraftFeedback,
  useKnowledgeFeedback,
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
 * The AI activity spine.
 *
 * A support thread in Aide is two stories at once: what the customer and agent
 * said, and what the AI did about it. Rendering them as separate panels (the v5
 * layout) meant you could never tell which message triggered which draft. Here
 * both dock onto one hairline rail in timestamp order — messages to the right
 * of it, AI events as small labelled markers on it. The rail is the only place
 * in the app allowed to be visually loud.
 */

/** A message reduced to what the feedback endpoints need to identify it. */
interface CommentRef {
  id: Id
  ticketId: Id
  body: string
}

type TimelineEntry =
  | { kind: 'comment'; at: string; comment: TicketComment; lastFromCustomer?: CommentRef }
  | { kind: 'topic'; at: string; card: TicketCard; comment: TicketComment; ticketId: Id }
  | { kind: 'scenario'; at: string; executed: TicketExecutedWorkflow; ticketId: Id }
  | { kind: 'draft'; at: string; draft: TicketDraft }

const commentTime = (comment: TicketComment) => comment.external_created_at ?? comment.created_at

/**
 * Feedback on an AI answer is filed against the customer question that prompted
 * it, so the walk keeps a running reference to the last customer message.
 */
function buildTimeline(ticket: Ticket): TimelineEntry[] {
  const entries: TimelineEntry[] = []
  let lastFromCustomer: CommentRef | undefined

  for (const comment of ticket.comments) {
    entries.push({ kind: 'comment', at: commentTime(comment), comment, lastFromCustomer })

    if (comment.is_customer_reply) {
      lastFromCustomer = {
        id: comment.id,
        ticketId: ticket.id,
        body: comment.clean_body ?? comment.body ?? '',
      }
    }

    for (const card of ticket.cards.filter((entry) => entry.comment_id === comment.id)) {
      entries.push({
        kind: 'topic',
        at: card.created_at ?? commentTime(comment),
        card,
        comment,
        ticketId: ticket.id,
      })
    }
    for (const executed of ticket.executedWorkflows.filter(
      (entry) => entry.comment_id === comment.id
    )) {
      entries.push({ kind: 'scenario', at: executed.applied_at, executed, ticketId: ticket.id })
    }
    for (const draft of ticket.drafts.filter((entry) => entry.comment_id === comment.id)) {
      entries.push({ kind: 'draft', at: draft.created_at, draft })
    }
  }

  return entries
}

export function TicketThread({
  ticket,
  onInsertDraft,
}: {
  ticket: Ticket
  onInsertDraft: (text: string) => void
}) {
  const timeline = useMemo(() => buildTimeline(ticket), [ticket])

  return (
    <div className="thread-spine relative flex flex-col gap-4 py-5 pr-5 pl-5">
      {timeline.map((entry, index) => {
        switch (entry.kind) {
          case 'comment':
            return (
              <CommentBubble
                key={`c-${entry.comment.id}`}
                comment={entry.comment}
                ticketId={ticket.id}
                lastFromCustomer={entry.lastFromCustomer}
              />
            )
          case 'topic':
            return (
              <TopicMarker
                key={`t-${entry.card.id}-${index}`}
                card={entry.card}
                comment={entry.comment}
                ticketId={entry.ticketId}
              />
            )
          case 'scenario':
            return (
              <ScenarioMarker
                key={`w-${entry.executed.id}`}
                executed={entry.executed}
                ticketId={entry.ticketId}
              />
            )
          case 'draft':
            return (
              <DraftMarker
                key={`d-${entry.draft.id}`}
                draft={entry.draft}
                onInsert={onInsertDraft}
              />
            )
        }
      })}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* Messages                                                                    */
/* -------------------------------------------------------------------------- */

function CommentBubble({
  comment,
  ticketId,
  lastFromCustomer,
}: {
  comment: TicketComment
  ticketId: Id
  lastFromCustomer?: CommentRef
}) {
  const isAgent = comment.is_agent_reply
  const author = comment.from_name || comment.from_handle || (isAgent ? 'Agent' : 'Customer')
  const at = commentTime(comment)
  const knowledgeCited = comment.bot_response_knowledge_used ?? []

  return (
    <article className="relative flex gap-3">
      <span
        className={cn(
          'z-10 mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border text-[10.5px] font-medium',
          isAgent
            ? 'border-gray-950 bg-gray-950 text-gray-50'
            : 'border-gray-200 bg-white text-gray-600'
        )}
        title={author}
      >
        {initialsOf(author)}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[13px] font-medium text-gray-950">{author}</span>
          <time className="text-[11.5px] text-gray-400" dateTime={at} title={formatFullDate(at)}>
            {formatFullDate(at)}
          </time>
        </div>

        <div
          className={cn(
            'mt-1.5 rounded-[8px] border px-3.5 py-2.5 text-[13.5px] leading-relaxed whitespace-pre-wrap',
            isAgent
              ? 'border-gray-200 bg-gray-50 text-gray-800'
              : 'border-gray-200 bg-white text-gray-800'
          )}
        >
          {comment.clean_body || comment.body}
        </div>

        {knowledgeCited.length > 0 && (
          <KnowledgeCited
            knowledge={knowledgeCited}
            agentComment={{
              id: comment.id,
              ticketId,
              body: comment.clean_body ?? comment.body ?? '',
            }}
            endUserComment={lastFromCustomer}
          />
        )}
      </div>
    </article>
  )
}

/* -------------------------------------------------------------------------- */
/* AI markers                                                                  */
/* -------------------------------------------------------------------------- */

function MarkerShell({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="relative flex gap-3">
      <span className="z-10 mt-1 flex size-8 shrink-0 items-center justify-center">
        <span className="flex size-5 items-center justify-center rounded-[4px] border border-gray-200 bg-white text-gray-400">
          {icon}
        </span>
      </span>

      <div className="min-w-0 flex-1">
        <p className="font-mono text-[10.5px] tracking-wide text-gray-400 uppercase">{label}</p>
        <div className="mt-1.5">{children}</div>
      </div>
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

/**
 * Topic feedback is stored as a card example rather than a feedback row: a vote
 * adds one, voting the same way again removes it, and flipping the vote
 * replaces it. That asymmetry is the API's, not this component's.
 */
function TopicMarker({
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

  const vote = async (isPositive: boolean) => {
    if (saved) {
      await deleteExample.mutateAsync({ cardId: card.id, exampleId, commentId: card.comment_id })
      if (savedPositive === isPositive) return
    }

    addExample.mutate({
      cardId: card.id,
      commentId: card.comment_id,
      ticketId,
      body: comment.clean_body ?? comment.body ?? '',
      isPositive,
    })
  }

  return (
    <MarkerShell icon={<Tag className="size-3" />} label="Topic detected">
      <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white py-1 pr-1 pl-2.5">
        <span className="text-[13px]">{card.emoji}</span>
        <span className="text-[12.5px] font-medium text-gray-950">{card.name}</span>
        <span className="font-mono text-[11px] text-gray-400 tabular-nums">
          {Math.round(card.confidence * 100)}%
        </span>
        <FeedbackButtons
          saved={saved}
          positive={savedPositive}
          disabled={pending}
          onVote={(isPositive) => void vote(isPositive)}
          labels={{ up: 'Right topic', down: 'Wrong topic' }}
        />
        <span className="sr-only">on conversation {ticketId}</span>
      </span>
    </MarkerShell>
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

function ScenarioMarker({
  executed,
  ticketId,
}: {
  executed: TicketExecutedWorkflow
  ticketId: Id
}) {
  const feedback = useWorkflowFeedback()

  return (
    <MarkerShell icon={<Zap className="size-3" />} label="Scenario ran">
      <div className="rounded-[8px] border border-gray-200 bg-white">
        <div className="flex items-center gap-2 border-b border-gray-200 px-3 py-2">
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-gray-950">
            {executed.name}
          </span>
          <FeedbackButtons
            saved={executed.feedback.saved}
            positive={executed.feedback.savedPass}
            disabled={feedback.isPending}
            onVote={(isPositive) =>
              feedback.mutate({
                executedWorkflowId: executed.id,
                ticketId,
                saved: true,
                savedPass: isPositive,
              })
            }
            labels={{ up: 'Should have run', down: 'Should not have run' }}
          />
        </div>
        <ul className="divide-y divide-gray-200">
          {executed.actions.map((action) => (
            <li key={action.id} className="flex gap-2 px-3 py-2 text-[12.5px]">
              <span className="w-[122px] shrink-0 text-gray-500">
                {ACTION_LABELS[action.action_type] ?? action.action_type}
              </span>
              <span className="min-w-0 flex-1 text-gray-800">{action.action_value}</span>
            </li>
          ))}
        </ul>
      </div>
    </MarkerShell>
  )
}

function DraftMarker({
  draft,
  onInsert,
}: {
  draft: TicketDraft
  onInsert: (text: string) => void
}) {
  const feedback = useDraftFeedback()
  const knowledgeUsed = draft.knowledge_used ?? []

  return (
    <MarkerShell icon={<Sparkles className="size-3" />} label="Draft written">
      <div className="rounded-[8px] border border-gray-200 bg-white">
        <p className="px-3.5 py-3 text-[13.5px] leading-relaxed whitespace-pre-wrap text-gray-800">
          {draft.llm_generation}
        </p>

        {knowledgeUsed.length > 0 && (
          <div className="border-t border-gray-200 px-3.5 py-2">
            <p className="mb-1.5 font-mono text-[10.5px] tracking-wide text-gray-400 uppercase">
              Answered from
            </p>
            <ul className="flex flex-col gap-1">
              {knowledgeUsed.map((article) => (
                <li key={article.id} className="flex items-start gap-1.5 text-[12.5px]">
                  <BookOpen className="mt-0.5 size-3 shrink-0 text-gray-400" />
                  <span className="min-w-0 flex-1 text-gray-600">{article.title}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center gap-2 border-t border-gray-200 bg-gray-50 px-3 py-2">
          <button
            type="button"
            onClick={() => onInsert(draft.llm_generation)}
            className="inline-flex h-6 items-center gap-1.5 rounded-[6px] bg-gray-950 px-2 text-[12px] font-medium text-white transition-colors hover:bg-gray-800"
          >
            <CornerUpLeft className="size-3" />
            Use this draft
          </button>
          {draft.inserted && (
            <span className="text-[11.5px] text-gray-500">Already used in a reply</span>
          )}
          <span className="ml-auto">
            <FeedbackButtons
              saved={draft.feedback.saved}
              positive={draft.feedback.savedGood}
              disabled={feedback.isPending}
              onVote={(isPositive) =>
                feedback.mutate({
                  cachedLlmGenerationId: draft.id,
                  ticketId: draft.ticket_id,
                  saved: true,
                  savedGood: isPositive,
                })
              }
              labels={{ up: 'Good draft', down: 'Poor draft' }}
            />
          </span>
        </div>
      </div>
    </MarkerShell>
  )
}

function KnowledgeCited({
  knowledge,
  agentComment,
  endUserComment,
}: {
  knowledge: KnowledgeUsed[]
  agentComment: CommentRef
  endUserComment?: CommentRef
}) {
  const feedback = useKnowledgeFeedback()

  return (
    <div className="mt-2 rounded-[8px] border border-gray-200 bg-gray-50 px-3 py-2">
      <p className="mb-1.5 font-mono text-[10.5px] tracking-wide text-gray-400 uppercase">
        Knowledge used
      </p>
      <ul className="flex flex-col gap-1.5">
        {knowledge.map((article) => (
          <li key={article.id} className="flex items-start gap-2">
            <BookOpen className="mt-1 size-3 shrink-0 text-gray-400" />
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] font-medium text-gray-800">{article.title}</span>
              <span className="mt-0.5 block text-[12px] leading-relaxed text-gray-500">
                {article.blurb}
              </span>
            </span>
            <FeedbackButtons
              saved={article.feedback.saved}
              positive={article.feedback.savedPositive}
              /* The endpoint files this against the question that prompted the
               * answer, so with no customer message there is nothing to file. */
              disabled={!endUserComment || feedback.isPending}
              onVote={(isPositive) => {
                if (!endUserComment) return
                feedback.mutate({
                  knowledgeDocumentId: article.id,
                  agentComment,
                  endUserComment,
                  answer: `# ${article.title ?? ''}\n${article.blurb}`,
                  knowledgeSetName: article.knowledge_set_name ?? undefined,
                  saved: true,
                  savedPositive: isPositive,
                })
              }}
              labels={{ up: 'Relevant article', down: 'Irrelevant article' }}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
