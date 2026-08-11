import { http, HttpResponse } from 'msw'
import { db, nextId, refreshMeFlags } from '../db'
import { filterTickets, latency } from '../utils'
import { MACRO_ACTION_OPTIONS, WORKFLOW_TEMPLATES } from '../seed'
import type { Workflow, WorkflowCondition } from '@/types/api'

const V1 = '*/v1'

const NEW_WORKFLOW_NAME = 'New scenario'

function regroup(workflow: Workflow) {
  const conjunctions: WorkflowCondition[][] = []
  for (const condition of workflow.conditions) {
    conjunctions[condition.conjunction_index] ||= []
    conjunctions[condition.conjunction_index].push(condition)
  }
  workflow.conjunctions = conjunctions
  return workflow
}

export const workflowHandlers = [
  http.get(`${V1}/workflows`, async ({ request }) => {
    await latency()
    const url = new URL(request.url)
    const getAllStats = url.searchParams.get('getAllStats') === 'true'

    return HttpResponse.json({
      macros: db.macros,
      workflows: db.workflows.map((workflow) => ({
        ...regroup(workflow),
        times_run: getAllStats ? workflow.times_run : null,
      })),
      collectableFields: db.collectableFields,
      allConditionDropdownOptions: db.conditionOptions,
      workflowTemplates: WORKFLOW_TEMPLATES,
    })
  }),

  http.post(`${V1}/workflows/new`, async () => {
    await latency()
    const workflow: Workflow = {
      id: nextId(),
      account_id: db.me.team?.id ?? 0,
      is_active: false,
      name: NEW_WORKFLOW_NAME,
      generative_config_id: null,
      latest_coverage_estimate: null,
      priority: 'NORMAL',
      delay: 'NONE',
      apply_always: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      conditions: [],
      actions: [],
      macros: [],
      conjunctions: [],
      times_run: 0,
    }
    db.workflows.unshift(workflow)
    refreshMeFlags()
    return HttpResponse.json(workflow, { status: 201 })
  }),

  http.post(`${V1}/workflows`, async ({ request }) => {
    await latency()
    const body = (await request.json()) as Partial<Workflow> & { id: number }
    const workflow = db.workflows.find((candidate) => candidate.id === body.id)
    if (!workflow) return HttpResponse.json({ message: 'Not found' }, { status: 404 })

    if (body.name !== undefined) workflow.name = body.name
    if (body.is_active !== undefined) workflow.is_active = body.is_active
    if (body.priority !== undefined) workflow.priority = body.priority
    if (body.delay !== undefined) workflow.delay = body.delay
    if (body.apply_always !== undefined) workflow.apply_always = body.apply_always

    if (body.conditions) {
      workflow.conditions = body.conditions.map((condition) => ({
        ...condition,
        id: condition.id && condition.id > 0 ? condition.id : nextId(),
        account_id: workflow.account_id,
        workflow_id: workflow.id,
        created_at: condition.created_at ?? new Date().toISOString(),
        conjunction_index: condition.conjunction_index ?? 0,
        custom_field_name: condition.custom_field_name ?? null,
        attachable_id: condition.attachable_id ?? null,
        field_key: condition.field_key ?? null,
        value: condition.value ?? null,
        operator: condition.operator ?? 'IS',
        condition_type: condition.condition_type,
      })) as WorkflowCondition[]
    }

    if (body.actions) {
      workflow.actions = body.actions.map((action) => ({
        ...action,
        id: action.id && action.id > 0 ? action.id : nextId(),
        account_id: workflow.account_id,
        workflow_id: workflow.id,
        attachable_id: action.attachable_id ?? null,
        created_at: action.created_at ?? new Date().toISOString(),
      })) as Workflow['actions']
    }

    workflow.updated_at = new Date().toISOString()
    refreshMeFlags()
    return HttpResponse.json(regroup(workflow))
  }),

  http.post(`${V1}/workflows/import`, async ({ request }) => {
    await latency()
    const body = (await request.json()) as { slug: string }
    const template = WORKFLOW_TEMPLATES.find((candidate) => candidate.slug === body.slug)
    if (!template) return HttpResponse.json({ message: 'Unknown template' }, { status: 422 })

    const id = nextId()
    const workflow: Workflow = {
      id,
      account_id: db.me.team?.id ?? 0,
      is_active: false,
      name: template.name,
      generative_config_id: null,
      latest_coverage_estimate: null,
      priority: 'NORMAL',
      delay: 'NONE',
      apply_always: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      conditions: template.conditions.map((condition, index) => ({
        id: nextId(),
        account_id: db.me.team?.id ?? 0,
        workflow_id: id,
        attachable_id: condition.attachable_id ?? null,
        custom_field_name: null,
        condition_type: condition.condition_type ?? 'INTENT',
        operator: condition.operator ?? 'IS',
        value: condition.value ?? null,
        field_key: condition.field_key ?? null,
        conjunction_index: condition.conjunction_index ?? index,
        created_at: new Date().toISOString(),
      })),
      actions: template.actions.map((action) => ({
        id: nextId(),
        account_id: db.me.team?.id ?? 0,
        workflow_id: id,
        action_type: action.action_type ?? 'GENERATIVE_REPLY',
        action_value: action.action_value ?? '',
        attachable_id: null,
        created_at: new Date().toISOString(),
      })),
      macros: [],
      conjunctions: [],
      times_run: 0,
    }
    db.workflows.unshift(regroup(workflow))
    refreshMeFlags()
    return HttpResponse.json(workflow, { status: 201 })
  }),

  http.delete(`${V1}/workflow/:id`, async ({ params }) => {
    await latency()
    db.workflows = db.workflows.filter((workflow) => workflow.id !== Number(params.id))
    refreshMeFlags()
    return HttpResponse.json({ success: true })
  }),

  /** Live estimate of how many past conversations a scenario would have hit. */
  http.post(`${V1}/workflows/affected_conversations`, async ({ request }) => {
    await latency()
    const body = (await request.json()) as { conditions?: WorkflowCondition[] }
    const conditions = body.conditions ?? []

    const topicIds = conditions
      .filter(
        (condition) =>
          ['INTENT', 'TOP_INTENT'].includes(condition.condition_type) && condition.attachable_id
      )
      .map((condition) => condition.attachable_id!)

    const matched = topicIds.length
      ? filterTickets(db.tickets, { viewIds: ['ELIGIBLE'], topicIds })
      : filterTickets(db.tickets, { viewIds: ['ELIGIBLE'] })

    const statusCondition = conditions.find(
      (condition) => condition.condition_type === 'TICKET_STATUS'
    )
    const narrowed = statusCondition
      ? matched.filter((ticket) =>
          statusCondition.operator === 'IS'
            ? ticket.status === statusCondition.value
            : ticket.status !== statusCondition.value
        )
      : matched

    return HttpResponse.json({
      count: narrowed.length,
      total: filterTickets(db.tickets, { viewIds: ['ELIGIBLE'] }).length,
      sample: narrowed.slice(0, 5).map((ticket) => ({
        id: ticket.id,
        subject: ticket.subject,
        external_created_at: ticket.external_created_at,
      })),
    })
  }),

  http.post(`${V1}/workflows/backlog`, async () => {
    await latency()
    return HttpResponse.json({ success: true, queued: 128 })
  }),

  /* Macros -------------------------------------------------------------- */

  http.get(`${V1}/macros/actions`, async () => {
    await latency()
    return HttpResponse.json(MACRO_ACTION_OPTIONS)
  }),

  http.get(`${V1}/macros`, async () => {
    await latency()
    return HttpResponse.json(db.macros)
  }),

  http.post(`${V1}/macros`, async ({ request }) => {
    await latency()
    const body = (await request.json()) as {
      name: string
      description?: string
      actions?: Array<{ option: string; value: string; integration_id?: number }>
    }
    const id = nextId()
    const macro = {
      id,
      account_id: db.me.team?.id ?? 0,
      user_id: db.me.id,
      zendesk_id: null,
      name: body.name,
      description: body.description ?? null,
      run_count: 0,
      actions_count: body.actions?.length ?? 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      actions: (body.actions ?? []).map((action) => ({
        id: nextId(),
        account_id: db.me.team?.id ?? 0,
        macro_id: id,
        integration_id: action.integration_id ?? 2,
        option: action.option,
        value: action.value,
        created_at: new Date().toISOString(),
      })),
    }
    db.macros.unshift(macro)
    return HttpResponse.json(macro, { status: 201 })
  }),

  http.post(`${V1}/macros/:id`, async ({ params, request }) => {
    await latency()
    const body = (await request.json()) as {
      name?: string
      description?: string
      actions?: Array<{ option: string; value: string; integration_id?: number }>
    }
    const macro = db.macros.find((candidate) => candidate.id === Number(params.id))
    if (!macro) return HttpResponse.json({ message: 'Not found' }, { status: 404 })

    if (body.name !== undefined) macro.name = body.name
    if (body.description !== undefined) macro.description = body.description
    if (body.actions) {
      macro.actions = body.actions.map((action) => ({
        id: nextId(),
        account_id: macro.account_id,
        macro_id: macro.id,
        integration_id: action.integration_id ?? 2,
        option: action.option,
        value: action.value,
        created_at: new Date().toISOString(),
      }))
      macro.actions_count = macro.actions.length
    }
    macro.updated_at = new Date().toISOString()
    return HttpResponse.json(macro)
  }),

  http.delete(`${V1}/macros/:id`, async ({ params }) => {
    await latency()
    db.macros = db.macros.filter((macro) => macro.id !== Number(params.id))
    return HttpResponse.json({ success: true })
  }),
]
