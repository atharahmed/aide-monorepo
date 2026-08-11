// ============================================================================
// PROVISIONAL API — no backend yet.
//
// Everything else in `handlers/` is deleted in Phase 2 when the real v7 API
// comes online. This file stays: the Agents section has no server behind it,
// and won't until the `generative_configs` work lands. When it does, this
// contract maps close to 1:1 — name/description/instructions/auto-reply become
// the Configure tab, and the embed snippet becomes the website channel.
// ============================================================================

import { http, HttpResponse } from 'msw'
import { db, nextId } from '../db'
import { latency } from '../utils'
import {
  AGENT_FALLBACK_REPLY,
  AGENT_PLAYGROUND_REPLIES,
  KNOWLEDGE_SEED,
  buildAgentActivity,
} from '../seed'
import type { Agent } from '@/types/api'

const V1 = '*/v1'

export const agentHandlers = [
  http.get(`${V1}/agents`, async () => {
    await latency()
    return HttpResponse.json(db.agents)
  }),

  http.get(`${V1}/agents/:id`, async ({ params }) => {
    await latency()
    const agent = db.agents.find((candidate) => candidate.id === Number(params.id))
    if (!agent) return HttpResponse.json({ message: 'Not found' }, { status: 404 })
    return HttpResponse.json(agent)
  }),

  http.post(`${V1}/agents`, async ({ request }) => {
    await latency()
    const body = (await request.json()) as Partial<Agent>
    const id = nextId()
    const agent: Agent = {
      id,
      account_id: db.me.team?.id ?? 0,
      name: body.name || 'Untitled agent',
      description: body.description ?? '',
      instructions: body.instructions ?? '',
      tone: body.tone ?? 'friendly',
      status: 'draft',
      use_knowledge: body.use_knowledge ?? true,
      workflow_ids: body.workflow_ids ?? [],
      channels: [
        { slug: 'website', enabled: false, config: { embed_id: `nw_${id.toString(36)}` } },
        { slug: 'helpdesk', enabled: false, config: { provider: 'zendesk' } },
        { slug: 'email', enabled: false, config: { address: db.me.email } },
      ],
      last_active_at: null,
      interactions_7d: [0, 0, 0, 0, 0, 0, 0],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    db.agents.unshift(agent)
    return HttpResponse.json(agent, { status: 201 })
  }),

  http.post(`${V1}/agents/:id`, async ({ params, request }) => {
    await latency()
    const body = (await request.json()) as Partial<Agent>
    const agent = db.agents.find((candidate) => candidate.id === Number(params.id))
    if (!agent) return HttpResponse.json({ message: 'Not found' }, { status: 404 })

    Object.assign(agent, {
      ...body,
      id: agent.id,
      account_id: agent.account_id,
      updated_at: new Date().toISOString(),
    })
    return HttpResponse.json(agent)
  }),

  http.delete(`${V1}/agents/:id`, async ({ params }) => {
    await latency()
    db.agents = db.agents.filter((agent) => agent.id !== Number(params.id))
    return HttpResponse.json({ success: true })
  }),

  /** Deploy / pause — the header's primary action. */
  http.post(`${V1}/agents/:id/status`, async ({ params, request }) => {
    await latency()
    const body = (await request.json()) as { status: Agent['status'] }
    const agent = db.agents.find((candidate) => candidate.id === Number(params.id))
    if (!agent) return HttpResponse.json({ message: 'Not found' }, { status: 404 })

    agent.status = body.status
    agent.updated_at = new Date().toISOString()
    if (body.status === 'deployed') {
      agent.last_active_at = new Date().toISOString()
      if (agent.interactions_7d.every((value) => value === 0)) {
        agent.interactions_7d = [0, 0, 0, 0, 0, 0, 1]
      }
    }
    return HttpResponse.json(agent)
  }),

  http.get(`${V1}/agents/:id/activity`, async ({ params }) => {
    await latency()
    return HttpResponse.json(buildAgentActivity(Number(params.id)))
  }),

  /** Test playground — the right-hand Sheet on the agent detail page. */
  http.post(`${V1}/agents/:id/test`, async ({ request }) => {
    await latency()
    const body = (await request.json()) as { message: string }
    const matched = AGENT_PLAYGROUND_REPLIES.find((candidate) => candidate.match.test(body.message))

    return HttpResponse.json({
      reply: matched?.reply ?? AGENT_FALLBACK_REPLY,
      knowledge_used: (matched?.knowledge ?? []).map((index) => ({
        id: 2001 + index,
        title: KNOWLEDGE_SEED[index].title,
        blurb: KNOWLEDGE_SEED[index].blurb,
      })),
    })
  }),
]
