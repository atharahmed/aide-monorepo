import { http, HttpResponse } from 'msw'
import { allTopics, db, nextId } from '../db'
import { filterTickets, latency, parseTicketQuery } from '../utils'
import { AGENT_FALLBACK_REPLY, AGENT_PLAYGROUND_REPLIES, KNOWLEDGE_SEED, SOURCE } from '../seed'
import type { TicketCommentPayload, TicketPayload } from '@/types/api'

const V1 = '*/v1'
const PAGE_SIZE = 16

export const ticketHandlers = [
  http.get(`${V1}/tickets`, async ({ request }) => {
    await latency()
    const url = new URL(request.url)
    const query = parseTicketQuery(url)
    const page = Number(url.searchParams.get('currentPage')) || 1
    const pageSize = Number(url.searchParams.get('pageSize')) || PAGE_SIZE

    const matched = filterTickets(db.tickets, query)
    const start = (page - 1) * pageSize

    return HttpResponse.json({
      tickets: matched.slice(start, start + pageSize),
      macros: db.macros,
      collectableFields: db.collectableFields,
      zendeskSubdomain: db.me.team?.zendesk_subdomain ?? null,
      gridTimeInterval: 'day',
      paginationMeta: {
        current_page: page,
        last_page: Math.max(1, Math.ceil(matched.length / pageSize)),
        first_page: 1,
        total: matched.length,
      },
    })
  }),

  http.get(`${V1}/tickets/selectionOptions`, async () => {
    await latency()
    return HttpResponse.json({
      topics: allTopics().map((topic) => ({
        id: topic.id,
        name: topic.name,
        emoji: topic.emoji,
        category: {
          id: topic.subCategoryId,
          name: topic.subCategoryName,
          parent_category: { id: topic.categoryId, name: topic.categoryName },
        },
      })),
      workflows: db.workflows.map((workflow) => ({ id: workflow.id, name: workflow.name })),
    })
  }),

  http.get(`${V1}/tickets/pricingQuote`, async () => {
    await latency()
    const now = new Date()
    const pastMonthCounts = Array.from({ length: 12 }, (_, index) => {
      const month = new Date(now.getFullYear(), now.getMonth() - index, 1)
      return {
        count: 2400 + Math.round(Math.sin(index) * 600) + index * 40,
        month_timestamp: month.getTime(),
      }
    })
    const top3 = [...pastMonthCounts].sort((a, b) => b.count - a.count).slice(0, 3)
    return HttpResponse.json({
      count: Math.round(top3.reduce((total, month) => total + month.count, 0) / 3),
      pastMonthCounts,
    })
  }),

  /** Reply to a conversation — appends an agent comment to the thread. */
  http.post(`${V1}/tickets/:id`, async ({ params, request }) => {
    await latency()
    const body = (await request.json()) as { body: string }
    const ticket = db.tickets.find((candidate) => candidate.id === Number(params.id))
    if (!ticket) return HttpResponse.json({ message: 'Not found' }, { status: 404 })

    const comment: TicketCommentPayload = {
      id: nextId(),
      ticket_id: ticket.id,
      source_id: ticket.source_id,
      body: body.body,
      html_body: `<p>${body.body}</p>`,
      clean_body: body.body,
      is_customer_reply: false,
      is_agent_reply: true,
      public: true,
      from_handle: db.me.email,
      from_name: db.me.name,
      to_handle: ticket.requester?.email ?? '',
      to_name: ticket.requester?.name ?? '',
      external_created_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      ticket_source_slug: ticket.ticket_source_slug,
      bot_response_knowledge_used: [],
    }

    ticket.comments.push(comment)
    ticket.num_comments = ticket.comments.length
    ticket.latest_comment_at = comment.external_created_at
    ticket.latest_comment_is_agent_reply = true
    ticket.updated_at = comment.external_created_at

    return HttpResponse.json({ success: true })
  }),

  /** Simulator — creates a `chat_test` conversation and answers it. */
  http.post(`${V1}/simulator`, async ({ request }) => {
    await latency()
    const body = (await request.json()) as { message: string; ticketId?: number }
    const now = new Date().toISOString()

    let ticket = body.ticketId
      ? db.tickets.find((candidate) => candidate.id === body.ticketId)
      : undefined

    if (!ticket) {
      ticket = {
        id: nextId(),
        account_id: db.me.team?.id ?? 0,
        source_id: SOURCE.simulator,
        inbox_id: null,
        external_id: `sim_${Date.now()}`,
        subject: body.message.slice(0, 60),
        status: 'open',
        channel: 'chat',
        tags: null,
        num_comments: 0,
        latest_comment_at: now,
        latest_comment_is_agent_reply: false,
        not_eligible: true,
        external_created_at: now,
        created_at: now,
        updated_at: now,
        ticket_source_slug: 'chat_test',
        requester: { id: 0, name: 'You (simulator)', email: db.me.email },
        comments: [],
        drafts: [],
        cards: [],
        executedWorkflows: [],
        contextFields: [],
      } satisfies TicketPayload
      db.tickets.unshift(ticket)
    }

    ticket.comments.push({
      id: nextId(),
      ticket_id: ticket.id,
      source_id: ticket.source_id,
      body: body.message,
      html_body: `<p>${body.message}</p>`,
      clean_body: body.message,
      is_customer_reply: true,
      is_agent_reply: false,
      public: true,
      from_handle: db.me.email,
      from_name: 'You (simulator)',
      to_handle: 'support@northwindoutdoors.com',
      to_name: 'Northwind Outdoors Support',
      external_created_at: now,
      created_at: now,
      ticket_source_slug: 'chat_test',
      bot_response_knowledge_used: [],
    })

    const matched = AGENT_PLAYGROUND_REPLIES.find((candidate) => candidate.match.test(body.message))
    const knowledgeUsed = (matched?.knowledge ?? []).map((index) => {
      const article = KNOWLEDGE_SEED[index]
      return {
        id: 2001 + index,
        title: article.title,
        link: article.link,
        knowledge_set_name: article.source,
        blurb: article.blurb,
        relevance_score: 0.9,
        feedback: { saved: false },
      }
    })

    const detectedTopic = allTopics().find((topic) =>
      body.message.toLowerCase().includes(topic.name.split(' ')[0].toLowerCase())
    )

    const replyComment: TicketCommentPayload = {
      id: nextId(),
      ticket_id: ticket.id,
      source_id: ticket.source_id,
      body: matched?.reply ?? AGENT_FALLBACK_REPLY,
      html_body: `<p>${matched?.reply ?? AGENT_FALLBACK_REPLY}</p>`,
      clean_body: matched?.reply ?? AGENT_FALLBACK_REPLY,
      is_customer_reply: false,
      is_agent_reply: true,
      public: true,
      from_handle: 'aide@northwindoutdoors.com',
      from_name: 'Aide',
      to_handle: db.me.email,
      to_name: 'You (simulator)',
      external_created_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      ticket_source_slug: 'chat_test',
      bot_response_knowledge_used: knowledgeUsed,
    }

    ticket.comments.push(replyComment)

    if (detectedTopic && !ticket.cards.some((card) => card.id === detectedTopic.id)) {
      ticket.cards.push({
        id: detectedTopic.id,
        name: detectedTopic.name,
        emoji: detectedTopic.emoji,
        description: detectedTopic.description,
        created_at: now,
        confidence: 0.91,
        comment_id: ticket.comments[0].id,
        feedback: {
          saved: false,
          cardId: detectedTopic.id,
          comment: { id: ticket.comments[0].id, ticketId: ticket.id },
        },
      })
    }

    ticket.num_comments = ticket.comments.length
    ticket.latest_comment_at = replyComment.external_created_at
    ticket.latest_comment_is_agent_reply = true

    return HttpResponse.json({ ticket })
  }),

  /* Feedback ------------------------------------------------------------ */

  http.post(`${V1}/feedback/draft`, async ({ request }) => {
    await latency()
    const body = (await request.json()) as {
      cachedLlmGenerationId: number
      isPositive: boolean
      note?: string
    }
    for (const ticket of db.tickets) {
      const draft = ticket.drafts.find((candidate) => candidate.id === body.cachedLlmGenerationId)
      if (draft) {
        draft.feedback = {
          ...draft.feedback,
          saved: true,
          savedGood: body.isPositive,
          note: body.note ?? null,
        }
        break
      }
    }
    return HttpResponse.json({ success: true })
  }),

  http.post(`${V1}/feedback/workflow`, async ({ request }) => {
    await latency()
    const body = (await request.json()) as {
      executedWorkflowId: number
      isPositive: boolean
      note?: string
    }
    for (const ticket of db.tickets) {
      const executed = ticket.executedWorkflows.find(
        (candidate) => candidate.id === body.executedWorkflowId
      )
      if (executed) {
        executed.feedback = {
          ...executed.feedback,
          saved: true,
          savedPass: body.isPositive,
          note: body.note ?? null,
        }
        break
      }
    }
    return HttpResponse.json({ success: true })
  }),

  http.post(`${V1}/feedback/knowledgeUsed`, async ({ request }) => {
    await latency()
    const body = (await request.json()) as {
      knowledgeDocumentId: number
      commentId: number
      isPositive: boolean
    }
    for (const ticket of db.tickets) {
      const comment = ticket.comments.find((candidate) => candidate.id === body.commentId)
      const knowledge = comment?.bot_response_knowledge_used.find(
        (candidate) => candidate.id === body.knowledgeDocumentId
      )
      if (knowledge) {
        knowledge.feedback = { saved: true, savedPositive: body.isPositive }
        break
      }
    }
    return HttpResponse.json({ success: true })
  }),

  /** v1 cards — the flat topic list grouped by category, used by the widget. */
  http.get(`${V1}/cards`, async () => {
    await latency()
    return HttpResponse.json(db.categories)
  }),
]
