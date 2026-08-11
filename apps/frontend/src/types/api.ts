/**
 * Wire types for the Aide API.
 *
 * These mirror the JSON the AdonisJS backend actually serialises (Lucid's
 * default camelCase -> snake_case), so components written against them keep
 * working when `VITE_USE_MOCKS=false` points the client at the real API.
 * Field names come from the v5 controllers/services — do not "tidy" them.
 */

/* -------------------------------------------------------------------------- */
/* Auth + user                                                                 */
/* -------------------------------------------------------------------------- */

export interface LoginResponse {
  type: 'bearer'
  token: string
  expires_at?: string
}

export interface StripeInvoice {
  amount_due: number
  amount_paid: number
  created_at: number
  succeeded: boolean
}

export interface BillingStatus {
  provisioned: boolean
  is_enterprise: boolean
  /** '' | 'trial' | 'stripe' | 'shopify' — '' means nothing is paying. */
  provisioned_by: string
  free_trial_remaining_days: number
  invoices: StripeInvoice[]
  latest_invoice_failed: boolean
  latest_invoice_price_id: string
  stripe_customer_id: string
}

export interface ActiveIntegration {
  id: number
  name: string
  uuid?: string
  /** front */
  webhookUrl?: string
  /** zendesk */
  subdomain?: string
  /** shopify */
  shops?: string[]
  created_at?: string
  meta_data?: Record<string, unknown> | null
  [key: string]: unknown
}

export interface KnowledgeEntitySummary {
  id: number
  slug: string
  entity: Record<string, unknown>
  created_at: string
  updated_at: string
  extracted_source_url: string | null
  note: string | null
  sync_frequency: string | null
}

export interface BusinessInformation {
  recently_imported: boolean
  entities: KnowledgeEntitySummary[]
}

export interface LatestKnowledgeWebsite {
  import_status: 'not_importing' | 'importing' | 'import_expired' | 'imported_recently' | 'imported'
  url: string
}

export interface FlatTopic {
  id: number
  name: string
  emoji: string | null
}

export type ExploreStatus = 'READY' | 'NOT_ENOUGH_DATA' | 'IMPORTING_DATA' | 'CRUNCHING_DATA'

export interface Team {
  id: number
  name: string
  website: string
  is_active: boolean
  is_approved: boolean
  is_quick_search_enabled: boolean
  show_onboarding: boolean
  onboarding_stage: number
  use_website_data: boolean
  zendesk_subdomain: string | null
  onboarding_intent_slugs: string[]
  has_any_front_inbox_enabled: boolean
  has_a_bot: boolean
  has_tickets: boolean
  latest_ticket: Record<string, unknown>
  has_helpdesk_non_chat_tickets: boolean
  chat_tickets: unknown[]
  simulator_tickets: unknown[]
  widget_views: unknown[]
  widget_drafts: unknown[]
  has_widget_usage: boolean
  activation_tickets: Array<{ id: number; source_id: number; external_id: string; subject: string }>
  has_acted_upon_activation: boolean
  has_knowledge: boolean
  knowledge_documents: unknown[]
  has_topics: boolean
  flat_topics: FlatTopic[]
  has_workflows: boolean
  workflows: unknown[]
  has_global_instruction_workflow: boolean
  dismissed_onboarding_action_slugs: string[]
  explore_status: ExploreStatus
  num_users: number
  ticket_fields: Record<string, unknown>
  user_fields: Record<string, unknown>
  business_information: BusinessInformation
  latest_knowledge_website?: LatestKnowledgeWebsite
  team_size: string
  tickets_per_month: string
  suggested_questions: string[]
  billing_status: BillingStatus
  activeIntegrations: ActiveIntegration[]
}

export type WidgetSettingName = 'intent_feedback' | 'ai_response' | 'draft_feedback' | 'macros'

export type EmailPreferenceName =
  'weekly_summary' | 'onboarding_sequences' | 'event_based' | 'marketing' | 'event_invitations'

export interface Me {
  id: number
  name: string
  initials: string
  job_title: string | null
  email: string
  phone_number: string | null
  responses_per_page: number
  signature: string
  shortcut_trigger: string
  show_snippet_preview: boolean
  widget_settings: { settings: Array<{ name: WidgetSettingName; active: boolean }> } | null
  email_preferences: Partial<Record<EmailPreferenceName, boolean>> | null
  created_at: string
  updated_at: string
  widget_token: string
  fp_referred: boolean
  team?: Team
}

export interface TeamMember {
  id: number
  name: string
  initials: string
  email: string
  created_at: string
  updated_at: string
  active: boolean
  invited: boolean
  /** '' for real users, 'pending' | 'expired' for invitations */
  status: '' | 'pending' | 'expired'
  invite_url: string
  last_seen_at: string | null
}

export interface InviteDetails {
  email: string
  invited_by: string
  invite_code: string
  team_name: string
}

/* -------------------------------------------------------------------------- */
/* Conversations                                                               */
/* -------------------------------------------------------------------------- */

export type TicketFilterType =
  | 'ELIGIBLE'
  | 'ANY_TOPIC'
  | 'NO_TOPIC'
  | 'ANY_WORKFLOW_ACTION_EXECUTED'
  | 'ANY_WORKFLOW_TEXT_ACTION_EXECUTED'
  | 'ANY_WORKFLOW_NON_TEXT_ACTION_EXECUTED'
  | 'ANY_WORKFLOW_ACTION_CLOSED'
  | 'ANY_WORKFLOW_ACTION_NOT_CLOSED'
  | 'ANY_WORKFLOW_ACTION_SUGGESTED'
  | 'ANY_WORKFLOW_ACTION_SUGGESTION_USED'
  | 'DRAFT_EXISTS'
  | 'DRAFT_INSERTED'
  | 'DRAFT_NOT_INSERTED'
  | 'DRAFT_MANUALLY_GENERATED'
  | 'DRAFT_AUTOMATICALLY_GENERATED'
  | 'TOPIC_POSITIVE_FEEDBACK'
  | 'TOPIC_NEGATIVE_FEEDBACK'
  | 'WORKFLOW_POSITIVE_FEEDBACK'
  | 'WORKFLOW_NEGATIVE_FEEDBACK'
  | 'DRAFT_POSITIVE_FEEDBACK'
  | 'DRAFT_NEGATIVE_FEEDBACK'
  | 'OPEN'
  | 'SENT'
  | 'SIMULATOR'

export interface KnowledgeUsed {
  id: number
  title: string | null
  link: string | null
  knowledge_set_name: string | null
  blurb: string
  relevance_score: number
  feedback: { saved: boolean; savedPositive?: boolean }
}

export interface TicketCommentPayload {
  id: number
  ticket_id: number
  source_id: number
  body: string | null
  html_body: string | null
  clean_body: string | null
  is_customer_reply: boolean
  is_agent_reply: boolean
  public: boolean
  from_handle: string
  from_name: string
  to_handle: string
  to_name: string
  external_created_at: string
  created_at: string
  ticket_source_slug: string
  bot_response_knowledge_used: KnowledgeUsed[]
}

export interface DraftFeedback {
  cachedLlmGenerationId: number
  ticketId: number
  saved: boolean
  savedGood?: boolean
  note?: string | null
}

export interface TicketDraft {
  id: number
  ticket_id: number
  comment_id: number
  card_id: number | null
  task_name: string
  llm_generation: string
  metadata: Record<string, unknown>
  created_at: string
  knowledge_used?: KnowledgeUsed[]
  inserted: boolean
  feedback: DraftFeedback
}

export interface TicketCardFeedback {
  saved: boolean
  savedPositive?: boolean
  exampleId?: number
  cardId: number
  comment: { id: number; ticketId: number }
}

export interface TicketCard {
  id: number
  name: string
  emoji: string | null
  description: string | null
  created_at: string
  confidence: number
  comment_id: number
  feedback: TicketCardFeedback
}

export interface ExecutedWorkflowAction {
  id: number
  workflow_id: number
  action_type: WorkflowActionType
  action_value: string
  attachable_id: number | null
  comment_id: number
}

export interface TicketExecutedWorkflow {
  id: number
  name: string
  is_active: boolean
  priority: string
  delay: string
  apply_always: boolean
  applied_at: string
  comment_id: number
  actions: ExecutedWorkflowAction[]
  feedback: {
    saved: boolean
    savedPass: boolean
    note?: string | null
    executedWorkflowId: number
    ticketId: number
  }
}

export interface ContextField {
  key: string
  label: string
  value: string
  group: string
  url?: string
}

export interface TicketPayload {
  id: number
  account_id: number
  source_id: number
  inbox_id: number | null
  external_id: string
  subject: string
  status: string
  channel: string
  tags: string | null
  num_comments: number
  latest_comment_at: string | null
  latest_comment_is_agent_reply: boolean
  not_eligible: boolean
  external_created_at: string
  created_at: string
  updated_at: string
  ticket_source_slug: string
  requester: { id: number; name: string; email: string } | null
  comments: TicketCommentPayload[]
  drafts: TicketDraft[]
  cards: TicketCard[]
  executedWorkflows: TicketExecutedWorkflow[]
  contextFields: ContextField[]
}

export interface PaginationMeta {
  current_page: number
  last_page: number
  first_page: number
}

export interface CollectableField {
  id: number
  account_id: number
  name: string
  field_key: string
  description: string | null
  created_at: string
}

export interface TicketsResponse {
  tickets: TicketPayload[]
  macros: Macro[]
  collectableFields: CollectableField[]
  zendeskSubdomain: string | null
  gridTimeInterval: 'day' | 'hour'
  paginationMeta: PaginationMeta
}

export interface SelectionOptionTopic {
  id: number
  name: string
  emoji: string | null
  category?: { id: number; name: string; parent_category?: { id: number; name: string } }
}

export interface SelectionOptionsResponse {
  topics: SelectionOptionTopic[]
  workflows: Array<{ id: number; name: string }>
}

export interface SimulatorResponse {
  ticket: TicketPayload
}

/* -------------------------------------------------------------------------- */
/* Topics (v2 cards)                                                           */
/* -------------------------------------------------------------------------- */

export interface CardExample {
  id: number
  classification_card_id: number
  ticket_id: number | null
  comment_id: number | null
  text: string
  is_positive: boolean
  created_at: string
}

export interface TopicCard {
  id: number
  name: string
  description: string | null
  emoji: string | null
  automatable: string | null
  /** present only with ?getAllStats=true */
  examples?: CardExample[]
  conversation_count?: number
  last_used_at?: string | null
  example_count?: number
}

export interface SubCategory {
  id: number
  name: string
  cards: TopicCard[]
}

export interface Category {
  id: number
  name: string
  color: string
  related_categories: SubCategory[]
}

export interface CardsV2Response {
  meta: { total: number; per_page: number; current_page: number; last_page: number }
  data: Category[]
}

export interface CardDetail extends TopicCard {
  category_id: number
  settings: Array<{ id: number; integration_id: number; key: string; value: string }>
  macros: Array<{ id: number; name: string; auto_run: boolean }>
  processes: Array<{ id: number; name: string }>
}

/* -------------------------------------------------------------------------- */
/* Scenarios (workflows) + macros                                              */
/* -------------------------------------------------------------------------- */

export type WorkflowConditionType =
  | 'INTENT'
  | 'TOP_INTENT'
  | 'PRIORITY_INTENT'
  | 'INTENT_CONFIDENCE'
  | 'IS_FIRST_MESSAGE'
  | 'USER_FIELD'
  | 'TICKET_FIELD'
  | 'CONTACT_FIELD'
  | 'TICKET_STATUS'
  | 'TICKET_TAG'
  | 'INBOX'
  | 'INTEGRATION'
  | 'SHOPIFY'
  | 'CUSTOM'

export type WorkflowConditionOperator = 'IS' | 'IS_NOT'

export type WorkflowActionType =
  | 'GENERATIVE_REPLY'
  | 'PROMPT_INSTRUCTION'
  | 'MACRO'
  | 'TEXT_REPLY'
  | 'ADD_TAG'
  | 'CLOSE_TICKET'
  | 'ASSIGN'
  | 'COLLECT_FIELD'

export interface WorkflowCondition {
  id: number
  account_id: number
  workflow_id: number
  attachable_id: number | null
  custom_field_name: string | null
  condition_type: WorkflowConditionType
  operator: WorkflowConditionOperator
  value: string | null
  field_key: string | null
  conjunction_index: number
  created_at: string
}

export interface WorkflowAction {
  id: number
  account_id: number
  workflow_id: number
  action_type: WorkflowActionType
  action_value: string
  attachable_id: number | null
  created_at: string
}

export interface Workflow {
  id: number
  account_id: number
  is_active: boolean
  name: string
  generative_config_id: number | null
  latest_coverage_estimate: number | null
  priority: string
  delay: string
  apply_always: boolean
  created_at: string
  updated_at: string
  conditions: WorkflowCondition[]
  actions: WorkflowAction[]
  macros: Array<{ id: number; macro_id: number; macro: Macro }>
  /** conditions grouped by conjunction_index — the OR-of-ANDs structure */
  conjunctions: WorkflowCondition[][]
  times_run: number | null
}

export interface ConditionDropdownOption {
  condition_type: WorkflowConditionType
  field_key: string | null
  value: string | null
  meta?: { id: number; name: string; emoji: string | null }
  attachable_id?: number
  count?: number
}

export interface WorkflowTemplate {
  slug: string
  name: string
  description: string
  conditions: Array<Partial<WorkflowCondition>>
  actions: Array<Partial<WorkflowAction>>
}

export interface WorkflowsResponse {
  macros: Macro[]
  workflows: Workflow[]
  collectableFields: CollectableField[]
  allConditionDropdownOptions: ConditionDropdownOption[]
  workflowTemplates: WorkflowTemplate[]
}

export interface AffectedConversationsResponse {
  count: number
  total: number
  sample: Array<{ id: number; subject: string; external_created_at: string }>
}

export interface MacroAction {
  id: number
  account_id: number
  macro_id: number
  integration_id: number
  option: string
  value: string
  created_at: string
}

export interface Macro {
  id: number
  account_id: number
  user_id: number | null
  zendesk_id: number | null
  name: string
  description: string | null
  run_count: number
  actions_count: number
  created_at: string
  updated_at: string
  actions?: MacroAction[]
}

export interface MacroActionOption {
  integration_id: number
  integration_name: string
  option: string
  label: string
  value_type: 'text' | 'select' | 'boolean'
  choices?: string[]
}

/* -------------------------------------------------------------------------- */
/* Knowledge                                                                   */
/* -------------------------------------------------------------------------- */

export interface KnowledgeDocument {
  id: number
  account_id: number
  link: string | null
  title: string | null
  knowledge_set_name: string | null
  help_center_id: number | null
  knowledge_website_id: number | null
  document: string | null
  created_at: string
  updated_at: string
  external_created_at: string | null
}

export interface KnowledgeEntity {
  id: number
  account_id: number
  slug: string
  entity: Record<string, unknown>
  extracted_source_url: string | null
  note: string | null
  sync_frequency: string | null
  created_at: string
  updated_at: string
}

export interface HcDetectResponse {
  detected: boolean
  provider: string | null
  help_center_url: string | null
  article_count_estimate: number | null
}

export interface HcStatusResponse {
  status: 'idle' | 'scraping' | 'completed' | 'failed'
  scraped_count: number
  total_count: number
  help_center_id: number | null
}

/* -------------------------------------------------------------------------- */
/* Reports                                                                     */
/* -------------------------------------------------------------------------- */

export interface CountWithUrlSearchParams {
  count: number
  urlSearchParams: string
}

export interface ReportTopic {
  id: number
  name: string
  emoji: string | null
  ticketsCount: number
  positiveFeedbackCount: number
  negativeFeedbackCount: number
  parent: {
    id: number
    name: string
    parent: { id: number; name: string; color: string }
  }
}

export interface ReportSummary {
  countsWithUrlSearchParams: Record<string, CountWithUrlSearchParams>
  topics: ReportTopic[]
  topicsDetected: number
  workflowsTriggered: number
  draftsGenerated: number
}

/* -------------------------------------------------------------------------- */
/* Integrations + billing                                                      */
/* -------------------------------------------------------------------------- */

export interface FrontInbox {
  id: number
  account_id: number
  external_id: string
  name: string
  is_enabled: boolean
  is_pulled: boolean
  created_at: string
}

export interface OAuthRedirectResponse {
  url: string
}

export interface PricingQuote {
  count: number
  pastMonthCounts: Array<{ count: number; month_timestamp: number }>
}

export interface BillingRedirectResponse {
  url: string
}

/* -------------------------------------------------------------------------- */
/* Admin                                                                       */
/* -------------------------------------------------------------------------- */

export interface AdminAccountRow {
  id: number
  name: string
  website: string | null
  created_at: string
  num_users: number
  ticket_count: number
  explore_status: ExploreStatus
  provisioned_by: string
}

/* -------------------------------------------------------------------------- */
/* Agents — PROVISIONAL, no backend exists yet                                 */
/* -------------------------------------------------------------------------- */

export type AgentStatus = 'draft' | 'deployed' | 'paused'

export type AgentChannelSlug = 'website' | 'helpdesk' | 'email'

export interface AgentChannel {
  slug: AgentChannelSlug
  enabled: boolean
  /** website: embed snippet id; helpdesk: 'zendesk' | 'front'; email: address */
  config: Record<string, string>
}

export interface Agent {
  id: number
  account_id: number
  name: string
  description: string
  instructions: string
  tone: 'concise' | 'friendly' | 'formal' | 'playful'
  status: AgentStatus
  use_knowledge: boolean
  workflow_ids: number[]
  channels: AgentChannel[]
  last_active_at: string | null
  /** 7 daily interaction counts, oldest first */
  interactions_7d: number[]
  created_at: string
  updated_at: string
}

export interface AgentActivityRow {
  id: number
  ticket_id: number | null
  channel: AgentChannelSlug
  subject: string
  outcome: 'resolved' | 'handed_off' | 'no_answer'
  messages: number
  created_at: string
}

export interface AgentTestReply {
  reply: string
  knowledge_used: Array<{ id: number; title: string; blurb: string }>
}
