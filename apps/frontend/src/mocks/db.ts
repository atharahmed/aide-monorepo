/**
 * In-memory store backing the mock API. Mutations land here, so the demo is
 * genuinely interactive: create a scenario, reply to a conversation, invite a
 * teammate — they all persist for the session.
 *
 * Phase 2 deletes this alongside the handlers.
 */

import type {
  Agent,
  Category,
  CollectableField,
  ConditionDropdownOption,
  FrontInbox,
  KnowledgeDocument,
  KnowledgeEntity,
  Macro,
  Me,
  TeamMember,
  TicketPayload,
  Workflow,
} from '@/types/api'

import {
  ACCOUNT_ID,
  COLLECTABLE_FIELDS,
  buildAgents,
  buildCategories,
  buildFrontInboxes,
  buildKnowledgeDocuments,
  buildKnowledgeEntities,
  buildMacros,
  buildMe,
  buildConditionOptions,
  buildTeamMembers,
  buildTickets,
  buildWorkflows,
} from './seed'

export interface ScrapeJob {
  status: 'idle' | 'scraping' | 'completed' | 'failed'
  startedAt: number
  total: number
  url: string
  helpCenterId: number | null
}

export interface Database {
  me: Me
  team: TeamMember[]
  tickets: TicketPayload[]
  categories: Category[]
  workflows: Workflow[]
  conditionOptions: ConditionDropdownOption[]
  macros: Macro[]
  collectableFields: CollectableField[]
  knowledgeDocuments: KnowledgeDocument[]
  knowledgeEntities: KnowledgeEntity[]
  frontInboxes: FrontInbox[]
  agents: Agent[]
  scrape: ScrapeJob
  nextId: number
}

function create(): Database {
  const workflows = buildWorkflows()
  return {
    me: buildMe(),
    team: buildTeamMembers(),
    tickets: buildTickets(workflows),
    categories: buildCategories(),
    workflows,
    conditionOptions: buildConditionOptions(),
    macros: buildMacros(),
    collectableFields: COLLECTABLE_FIELDS,
    knowledgeDocuments: buildKnowledgeDocuments(),
    knowledgeEntities: buildKnowledgeEntities(),
    frontInboxes: buildFrontInboxes(),
    agents: buildAgents(),
    scrape: { status: 'idle', startedAt: 0, total: 0, url: '', helpCenterId: null },
    nextId: 100_000,
  }
}

export const db: Database = create()

export const nextId = () => ++db.nextId

export const ACCOUNT = ACCOUNT_ID

/** Flattened topic list — used by several handlers and the command palette. */
export function allTopics() {
  return db.categories.flatMap((category) =>
    category.related_categories.flatMap((sub) =>
      sub.cards.map((card) => ({
        ...card,
        subCategoryId: sub.id,
        subCategoryName: sub.name,
        categoryId: category.id,
        categoryName: category.name,
        categoryColor: category.color,
      }))
    )
  )
}

export function findTopic(id: number) {
  return allTopics().find((topic) => topic.id === id)
}

/** Recompute the `/me` flags that depend on mutable collections. */
export function refreshMeFlags() {
  const team = db.me.team
  if (!team) return
  team.has_knowledge = db.knowledgeDocuments.length > 0
  team.knowledge_documents = db.knowledgeDocuments
  team.has_workflows = db.workflows.length > 0
  team.has_topics = allTopics().length > 0
  team.flat_topics = allTopics().map((topic) => ({
    id: topic.id,
    name: topic.name,
    emoji: topic.emoji,
  }))
  team.num_users = db.team.filter((member) => member.active).length
  team.has_global_instruction_workflow = db.workflows.some(
    (workflow) =>
      workflow.apply_always &&
      workflow.actions.some((action) => action.action_type === 'PROMPT_INSTRUCTION')
  )
  team.business_information = {
    recently_imported: team.business_information.recently_imported,
    entities: db.knowledgeEntities.map((entity) => ({
      id: entity.id,
      slug: entity.slug,
      entity: entity.entity,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
      extracted_source_url: entity.extracted_source_url,
      note: entity.note,
      sync_frequency: entity.sync_frequency,
    })),
  }
}
