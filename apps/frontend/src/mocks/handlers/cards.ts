import { http, HttpResponse } from 'msw'
import { allTopics, db, nextId, refreshMeFlags } from '../db'
import { latency } from '../utils'
import type { CardExample } from '@/types/api'

const V2 = '*/v2'

/** Examples live per-card and are only returned with ?getAllStats=true. */
const examples = new Map<number, CardExample[]>()

function examplesFor(cardId: number): CardExample[] {
  if (!examples.has(cardId)) {
    const relevant = db.tickets
      .filter((ticket) => ticket.cards.some((card) => card.id === cardId))
      .slice(0, 6)
    examples.set(
      cardId,
      relevant.map((ticket, index) => ({
        id: 90_000 + cardId * 10 + index,
        classification_card_id: cardId,
        ticket_id: ticket.id,
        comment_id: ticket.comments[0]?.id ?? null,
        text: ticket.comments[0]?.body ?? ticket.subject,
        is_positive: index % 5 !== 0,
        created_at: ticket.external_created_at,
      }))
    )
  }
  return examples.get(cardId)!
}

function conversationCount(cardId: number) {
  return db.tickets.filter((ticket) => ticket.cards.some((card) => card.id === cardId)).length
}

function lastUsedAt(cardId: number) {
  const matches = db.tickets
    .filter((ticket) => ticket.cards.some((card) => card.id === cardId))
    .map((ticket) => ticket.latest_comment_at)
    .filter(Boolean) as string[]
  return matches.sort().at(-1) ?? null
}

export const cardHandlers = [
  http.get(`${V2}/cards`, async ({ request }) => {
    await latency()
    const url = new URL(request.url)
    const getAllStats = url.searchParams.get('getAllStats') === 'true'

    const data = db.categories.map((category) => ({
      ...category,
      related_categories: category.related_categories.map((sub) => ({
        ...sub,
        cards: sub.cards.map((card) =>
          getAllStats
            ? {
                ...card,
                examples: examplesFor(card.id),
                conversation_count: conversationCount(card.id),
                last_used_at: lastUsedAt(card.id),
                example_count: examplesFor(card.id).length,
              }
            : card
        ),
      })),
    }))

    return HttpResponse.json({
      meta: { total: data.length, per_page: 10_000, current_page: 1, last_page: 1 },
      data,
    })
  }),

  http.get(`${V2}/cards/:id`, async ({ params }) => {
    await latency()
    const topic = allTopics().find((candidate) => candidate.id === Number(params.id))
    if (!topic) return HttpResponse.json({ message: 'Not found' }, { status: 404 })
    return HttpResponse.json({
      ...topic,
      category_id: topic.subCategoryId,
      examples: examplesFor(topic.id),
      conversation_count: conversationCount(topic.id),
      settings: [],
      macros: db.macros.slice(0, 2).map((macro) => ({
        id: macro.id,
        name: macro.name,
        auto_run: false,
      })),
      processes: [],
    })
  }),

  http.post(`${V2}/cards`, async ({ request }) => {
    await latency()
    const body = (await request.json()) as {
      name: string
      description?: string
      emoji?: string
      category_id: number
    }
    const card = {
      id: nextId(),
      name: body.name,
      description: body.description ?? null,
      emoji: body.emoji ?? '🏷️',
      automatable: null,
    }
    for (const category of db.categories) {
      const sub = category.related_categories.find((candidate) => candidate.id === body.category_id)
      if (sub) {
        sub.cards.push(card)
        break
      }
    }
    refreshMeFlags()
    return HttpResponse.json(card, { status: 201 })
  }),

  http.post(`${V2}/topics/:id`, async ({ params, request }) => {
    await latency()
    const body = (await request.json()) as {
      name?: string
      description?: string
      emoji?: string
      automatable?: string | null
      category_id?: number
    }
    const id = Number(params.id)

    for (const category of db.categories) {
      for (const sub of category.related_categories) {
        const card = sub.cards.find((candidate) => candidate.id === id)
        if (!card) continue

        if (body.name !== undefined) card.name = body.name
        if (body.description !== undefined) card.description = body.description
        if (body.emoji !== undefined) card.emoji = body.emoji
        if (body.automatable !== undefined) card.automatable = body.automatable

        /* Moving a topic to another subcategory. */
        if (body.category_id && body.category_id !== sub.id) {
          sub.cards = sub.cards.filter((candidate) => candidate.id !== id)
          for (const target of db.categories) {
            const destination = target.related_categories.find(
              (candidate) => candidate.id === body.category_id
            )
            if (destination) destination.cards.push(card)
          }
        }

        refreshMeFlags()
        return HttpResponse.json(card)
      }
    }
    return HttpResponse.json({ message: 'Not found' }, { status: 404 })
  }),

  http.delete(`${V2}/topics/:id`, async ({ params }) => {
    await latency()
    const id = Number(params.id)
    for (const category of db.categories) {
      for (const sub of category.related_categories) {
        sub.cards = sub.cards.filter((card) => card.id !== id)
      }
    }
    refreshMeFlags()
    return HttpResponse.json({ success: true })
  }),

  http.delete(`${V2}/cards/:id`, async ({ params }) => {
    await latency()
    const id = Number(params.id)
    for (const category of db.categories) {
      for (const sub of category.related_categories) {
        sub.cards = sub.cards.filter((card) => card.id !== id)
      }
    }
    refreshMeFlags()
    return HttpResponse.json({ success: true })
  }),

  http.post(`${V2}/cards/:id/examples`, async ({ params, request }) => {
    await latency()
    const cardId = Number(params.id)
    const body = (await request.json()) as { text: string; is_positive?: boolean }
    const example: CardExample = {
      id: nextId(),
      classification_card_id: cardId,
      ticket_id: null,
      comment_id: null,
      text: body.text,
      is_positive: body.is_positive ?? true,
      created_at: new Date().toISOString(),
    }
    examplesFor(cardId).unshift(example)
    return HttpResponse.json(example, { status: 201 })
  }),

  http.post(`${V2}/cards/:id/updateExamples`, async ({ params, request }) => {
    await latency()
    const cardId = Number(params.id)
    const body = (await request.json()) as {
      examples: Array<{ id: number; is_positive?: boolean; text?: string }>
    }
    const list = examplesFor(cardId)
    for (const update of body.examples) {
      const example = list.find((candidate) => candidate.id === update.id)
      if (!example) continue
      if (update.is_positive !== undefined) example.is_positive = update.is_positive
      if (update.text !== undefined) example.text = update.text
    }
    return HttpResponse.json({ success: true })
  }),

  http.post(`${V2}/cards/:id/deleteExamples`, async ({ params, request }) => {
    await latency()
    const cardId = Number(params.id)
    const body = (await request.json()) as { exampleIds: number[] }
    examples.set(
      cardId,
      examplesFor(cardId).filter((example) => !body.exampleIds.includes(example.id))
    )
    return HttpResponse.json({ success: true })
  }),

  http.post(`${V2}/cards/:id/macros`, async () => {
    await latency()
    return HttpResponse.json({ success: true })
  }),

  http.delete(`${V2}/cards/:id/macros/:macroId`, async () => {
    await latency()
    return HttpResponse.json({ success: true })
  }),

  http.put(`${V2}/cards/:id/macros/:macroId`, async () => {
    await latency()
    return HttpResponse.json({ success: true })
  }),

  http.post(`${V2}/cards/:id/processes`, async () => {
    await latency()
    return HttpResponse.json({ success: true })
  }),

  http.delete(`${V2}/cards/:id/processes/:processId`, async () => {
    await latency()
    return HttpResponse.json({ success: true })
  }),

  http.post(`${V2}/cards/:id/settings`, async () => {
    await latency()
    return HttpResponse.json({ success: true })
  }),

  /* Categories ---------------------------------------------------------- */

  http.post(`${V2}/categories`, async ({ request }) => {
    await latency()
    const body = (await request.json()) as { name: string; color?: string }
    const category = {
      id: nextId(),
      name: body.name,
      color: body.color ?? '#a3a3a3',
      related_categories: [],
    }
    db.categories.push(category)
    return HttpResponse.json(category, { status: 201 })
  }),

  http.post(`${V2}/categories/:id`, async ({ params, request }) => {
    await latency()
    const body = (await request.json()) as { name: string }
    const category = db.categories.find((candidate) => candidate.id === Number(params.id))
    if (!category) return HttpResponse.json({ message: 'Not found' }, { status: 404 })
    const sub = { id: nextId(), name: body.name, cards: [] }
    category.related_categories.push(sub)
    return HttpResponse.json(sub, { status: 201 })
  }),

  http.put(`${V2}/categories/:id/sub-category/:subCategoryId`, async ({ params, request }) => {
    await latency()
    const body = (await request.json()) as { name: string }
    const category = db.categories.find((candidate) => candidate.id === Number(params.id))
    const sub = category?.related_categories.find(
      (candidate) => candidate.id === Number(params.subCategoryId)
    )
    if (sub) sub.name = body.name
    return HttpResponse.json({ success: true })
  }),

  http.delete(`${V2}/categories/:id/sub-category/:subCategoryId`, async ({ params }) => {
    await latency()
    const category = db.categories.find((candidate) => candidate.id === Number(params.id))
    if (category) {
      category.related_categories = category.related_categories.filter(
        (sub) => sub.id !== Number(params.subCategoryId)
      )
    }
    refreshMeFlags()
    return HttpResponse.json({ success: true })
  }),
]
