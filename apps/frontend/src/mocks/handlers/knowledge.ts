import { http, HttpResponse } from 'msw'
import { db, nextId, refreshMeFlags } from '../db'
import { latency } from '../utils'

const V1 = '*/v1'

const SCRAPE_DURATION_MS = 9_000

export const knowledgeHandlers = [
  http.get(`${V1}/knowledge-documents/get-all`, async () => {
    await latency()
    return HttpResponse.json(db.knowledgeDocuments)
  }),

  http.post(`${V1}/knowledge-documents`, async ({ request }) => {
    await latency()
    const body = (await request.json()) as {
      title: string
      document: string
      link?: string
      knowledge_set_name?: string
    }
    const doc = {
      id: nextId(),
      account_id: db.me.team?.id ?? 0,
      link: body.link ?? null,
      title: body.title,
      knowledge_set_name: body.knowledge_set_name ?? 'Written by the team',
      help_center_id: null,
      knowledge_website_id: null,
      document: body.document,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      external_created_at: null,
    }
    db.knowledgeDocuments.unshift(doc)
    refreshMeFlags()
    return HttpResponse.json(doc, { status: 201 })
  }),

  http.post(`${V1}/knowledge-documents/:id`, async ({ params, request }) => {
    await latency()
    const body = (await request.json()) as {
      title?: string
      document?: string
      link?: string
    }
    const doc = db.knowledgeDocuments.find((candidate) => candidate.id === Number(params.id))
    if (!doc) return HttpResponse.json({ message: 'Not found' }, { status: 404 })
    if (body.title !== undefined) doc.title = body.title
    if (body.document !== undefined) doc.document = body.document
    if (body.link !== undefined) doc.link = body.link
    doc.updated_at = new Date().toISOString()
    return HttpResponse.json(doc)
  }),

  http.delete(`${V1}/knowledge-documents/:id`, async ({ params }) => {
    await latency()
    db.knowledgeDocuments = db.knowledgeDocuments.filter((doc) => doc.id !== Number(params.id))
    refreshMeFlags()
    return HttpResponse.json({ success: true })
  }),

  /* Business information ------------------------------------------------ */

  http.get(`${V1}/knowledge-entities`, async () => {
    await latency()
    return HttpResponse.json(db.knowledgeEntities)
  }),

  http.post(`${V1}/knowledge-entities`, async ({ request }) => {
    await latency()
    const body = (await request.json()) as {
      slug: string
      entity: Record<string, unknown>
      note?: string
    }
    const entity = {
      id: nextId(),
      account_id: db.me.team?.id ?? 0,
      slug: body.slug,
      entity: body.entity,
      extracted_source_url: null,
      note: body.note ?? null,
      sync_frequency: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    db.knowledgeEntities.unshift(entity)
    refreshMeFlags()
    return HttpResponse.json(entity, { status: 201 })
  }),

  http.put(`${V1}/knowledge-entities/:id`, async ({ params, request }) => {
    await latency()
    const body = (await request.json()) as {
      slug?: string
      entity?: Record<string, unknown>
      note?: string
    }
    const entity = db.knowledgeEntities.find((candidate) => candidate.id === Number(params.id))
    if (!entity) return HttpResponse.json({ message: 'Not found' }, { status: 404 })
    if (body.slug !== undefined) entity.slug = body.slug
    if (body.entity !== undefined) entity.entity = body.entity
    if (body.note !== undefined) entity.note = body.note
    entity.updated_at = new Date().toISOString()
    refreshMeFlags()
    return HttpResponse.json(entity)
  }),

  http.delete(`${V1}/knowledge-entities/:id`, async ({ params }) => {
    await latency()
    db.knowledgeEntities = db.knowledgeEntities.filter((entity) => entity.id !== Number(params.id))
    refreshMeFlags()
    return HttpResponse.json({ success: true })
  }),

  /* Help-center import -------------------------------------------------- */

  http.post(`${V1}/scrape/hc-detect`, async ({ request }) => {
    await latency()
    const body = (await request.json()) as { url: string }
    const host = body.url.replace(/^https?:\/\//, '').split('/')[0]
    if (!host || !host.includes('.')) {
      return HttpResponse.json(
        { detected: false, provider: null, help_center_url: null, article_count_estimate: null },
        { status: 200 }
      )
    }
    return HttpResponse.json({
      detected: true,
      provider: 'zendesk',
      help_center_url: `https://help.${host.replace(/^www\./, '')}/hc/en-us`,
      article_count_estimate: 84,
    })
  }),

  http.post(`${V1}/scrape/hc-scrape`, async ({ request }) => {
    await latency()
    const body = (await request.json()) as { url: string }
    db.scrape = {
      status: 'scraping',
      startedAt: Date.now(),
      total: 84,
      url: body.url,
      helpCenterId: 30,
    }
    return HttpResponse.json({ success: true, help_center_id: 30 })
  }),

  http.post(`${V1}/scrape/hc-status`, async () => {
    const job = db.scrape
    if (job.status !== 'scraping') {
      return HttpResponse.json({
        status: job.status,
        scraped_count: job.status === 'completed' ? job.total : 0,
        total_count: job.total,
        help_center_id: job.helpCenterId,
      })
    }

    const elapsed = Date.now() - job.startedAt
    const progress = Math.min(1, elapsed / SCRAPE_DURATION_MS)
    const scraped = Math.floor(job.total * progress)

    if (progress >= 1) {
      job.status = 'completed'
      /* Completed imports add their articles to the knowledge list. */
      for (let index = 0; index < 4; index++) {
        db.knowledgeDocuments.unshift({
          id: nextId(),
          account_id: db.me.team?.id ?? 0,
          link: `${job.url.replace(/\/$/, '')}/articles/imported-${index + 1}`,
          title: [
            'Order tracking and delivery windows',
            'International shipping and duties',
            'Gift cards and store credit',
            'Price matching policy',
          ][index],
          knowledge_set_name: 'Help center',
          help_center_id: 30,
          knowledge_website_id: null,
          document: '<p>Imported from your help centre.</p>',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          external_created_at: new Date().toISOString(),
        })
      }
      refreshMeFlags()
    }

    return HttpResponse.json({
      status: job.status,
      scraped_count: scraped,
      total_count: job.total,
      help_center_id: job.helpCenterId,
    })
  }),

  /* NOTE: the v5 dashboard called this with POST while the route is GET, so
   * that request 404'd in production. Mocked as GET — the correct verb. */
  http.get(`${V1}/scrape/hc-scrape-completed`, async () => {
    await latency()
    return HttpResponse.json({
      completed: db.scrape.status === 'completed',
      imported_count: db.scrape.status === 'completed' ? db.scrape.total : 0,
    })
  }),
]
