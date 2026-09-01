/**
 * Wire types for the Aide API.
 *
 * These describe what the AdonisJS v5 backend actually puts on the wire, which
 * is not always what its models look like. Two conventions drive most of the
 * surprises here and are worth stating once:
 *
 * 1. Primary and foreign keys are Postgres `bigint`, and the pg driver hands
 *    those to JSON as **strings**. Every id is therefore `Id`, never `number`.
 * 2. Aggregates produced by SQL (`COUNT`, `SUM`) arrive as strings too. Those
 *    are typed `NumericString` and must go through `toNumber()` before any
 *    arithmetic or `toLocaleString()`.
 *
 * Request payloads still take numbers where the backend validator says
 * `schema.number()` — Adonis coerces numeric strings, but sending the right
 * type keeps the contract honest.
 */

/** A Postgres bigint id, serialised as a string. */
export type Id = string

/** A SQL aggregate serialised as a string, e.g. `"98"`. */
export type NumericString = string

/** An ISO 8601 string with offset, e.g. `2026-08-12T17:42:19.546+05:00`. */
export type Timestamp = string

/* -------------------------------------------------------------------------- */
/* Auth + user                                                                 */
/* -------------------------------------------------------------------------- */

export interface LoginResponse {
  type: 'bearer'
  token: string
  expires_at?: Timestamp
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
  /** '' | 'trial' | 'stripe' | 'shopify' | 'enterprise' — '' means nothing is paying. */
  provisioned_by: string
  free_trial_remaining_days: number
  invoices: StripeInvoice[]
  latest_invoice_failed: boolean
  latest_invoice_price_id: string
  stripe_customer_id: string
}

/**
 * An `active_integrations` row with the parent integration preloaded, plus the
 * per-provider fields `UserService.formatResponse` grafts on top.
 */
export interface ActiveIntegration {
  id: Id
  account_id: Id
  integration_id: Id
  user_id: Id | null
  name: string
  uuid: string
  meta_data: Record<string, unknown> | null
  is_enabled: boolean | null
  last_used_at: Timestamp | null
  created_at: Timestamp
  updated_at: Timestamp
  external_org_id: string | null
  integration: {
    id: Id
    name: string
    title: string | null
    description: string | null
    image_url: string | null
  }
  /** front only */
  webhookUrl?: string
  /** zendesk only */
  subdomain?: string
  /** shopify only — one entry per connected store */
  shops?: string[]
}

export interface KnowledgeEntitySummary {
  id: Id
  slug: string
  entity: Record<string, unknown>
  created_at: Timestamp
  updated_at: Timestamp
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

/** A taxonomy node: L1 category, L2 sub-category, or a card's parent label. */
export interface TaxonomyLabel {
  id: Id
  account_id: Id
  name: string
  parent_id: Id | null
  color: string | null
  is_unassigned: boolean
  external_id: string | null
  relative_id: string | null
  created_at: Timestamp | null
  updated_at: Timestamp | null
}

/**
 * `team.flat_topics` — one row per card, carrying its two ancestor labels. Not
 * flat in the sense of `{id, name}`; flat in the sense of "already joined".
 */
export interface FlatTopic {
  l1: TaxonomyLabel
  l2: TaxonomyLabel
  card: TopicCard
}

export type ExploreStatus = 'READY' | 'NOT_ENOUGH_DATA' | 'IMPORTING_DATA' | 'CRUNCHING_DATA'

export interface Team {
  id: Id
  name: string
  website: string
  is_active: boolean
  is_approved: boolean
  is_quick_search_enabled: boolean
  show_onboarding: boolean
  onboarding_stage: number
  use_website_data: boolean
  zendesk_subdomain: string | null
  onboarding_intent_slugs: string[] | null
  has_any_front_inbox_enabled: boolean
  has_a_bot: boolean
  has_tickets: boolean
  latest_ticket:
    { id: Id; external_id: string; source_id: Id; account_id: Id } | Record<string, never>
  /** Only present when `/me` is asked for full stats; undefined otherwise. */
  has_helpdesk_non_chat_tickets?: boolean
  chat_tickets: Array<{ id: Id; created_at: Timestamp; account_id: Id }>
  simulator_tickets: Array<{ id: Id; created_at: Timestamp; account_id: Id }>
  widget_views: unknown[]
  widget_drafts: unknown[]
  has_widget_usage: boolean
  activation_tickets: Array<{ id: Id; source_id: Id; external_id: string; subject: string }>
  has_acted_upon_activation: boolean
  has_knowledge: boolean
  knowledge_documents: KnowledgeDocument[]
  has_topics: boolean
  flat_topics: FlatTopic[]
  has_workflows: boolean
  workflows: Workflow[]
  has_global_instruction_workflow: boolean
  dismissed_onboarding_action_slugs: string[]
  explore_status: ExploreStatus
  num_users: number
  ticket_fields: AccountField[]
  user_fields: AccountField[]
  business_information: BusinessInformation
  latest_knowledge_website?: LatestKnowledgeWebsite
  team_size: string | null
  tickets_per_month: string | null
  suggested_questions: string[] | null
  billing_status: BillingStatus
  activeIntegrations: ActiveIntegration[]
  /** Precomputed scenario condition options; the scenarios page refetches them. */
  all_condition_dropdown_options_cache: ConditionDropdownOption[] | null
}

export type WidgetSettingName = 'intent_feedback' | 'ai_response' | 'draft_feedback' | 'macros'

export type EmailPreferenceName =
  'weekly_summary' | 'onboarding_sequences' | 'event_based' | 'marketing' | 'event_invitations'

export interface Me {
  id: Id
  name: string | null
  initials: string
  job_title: string | null
  email: string
  phone_number: string | null
  responses_per_page: NumericString | null
  signature: string | null
  shortcut_trigger: string | null
  show_snippet_preview: boolean
  widget_settings: { settings: Array<{ name: WidgetSettingName; active: boolean }> } | null
  email_preferences: Partial<Record<EmailPreferenceName, boolean>> | null
  created_at: Timestamp
  updated_at: Timestamp
  /** Base64 `{"message": "<encrypted token>"}`. Handed to the helpdesk panels verbatim. */
  widget_token: string
  fp_referred: boolean
  team?: Team
}

export interface TeamMember {
  id: Id
  name: string | null
  initials: string
  email: string
  created_at: Timestamp
  updated_at: Timestamp
  active: boolean
  invited: boolean
  /** '' for real users, 'pending' | 'expired' for outstanding invitations. */
  status: '' | 'pending' | 'expired'
  invite_url: string
  last_seen_at: Timestamp | null
}

export interface InviteDetails {
  email: string
  invited_by: string
  invite_code: string
  team_name: string
}

export interface InviteResult {
  total_invites: number
  invites_sent: number
  emails_taken: string[]
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
  id: Id
  title: string | null
  link: string | null
  knowledge_set_name: string | null
  blurb: string
  relevance_score: number
  feedback: { saved: boolean; savedPositive?: boolean }
}

export interface TicketComment {
  id: Id
  ticket_id: Id
  account_id: Id
  source_id: Id
  external_id: string | null
  author_id: Id | null
  author_external_id: string | null
  type: string | null
  body: string | null
  html_body: string | null
  clean_body: string | null
  is_customer_reply: boolean
  is_agent_reply: boolean
  public: boolean | null
  via: string | null
  metadata: Record<string, unknown> | null
  from_handle: string | null
  from_name: string | null
  to_handle: string | null
  to_name: string | null
  external_created_at: Timestamp | null
  created_at: Timestamp
  updated_at: Timestamp | null
  /** Grafted on by `TicketService`, not a column. */
  ticket_source_slug: string
  /**
   * Articles cited by an AI-written reply. Absent — not empty — when an agent
   * reply has no matching bot response: the serializer builds it with an
   * optional chain that yields `undefined`, and JSON drops the key.
   */
  bot_response_knowledge_used?: KnowledgeUsed[]
}

export interface DraftFeedback {
  cachedLlmGenerationId: Id
  ticketId: Id
  saved: boolean
  savedGood?: boolean
  note?: string | null
}

export interface TicketDraft {
  id: Id
  ticket_id: Id
  comment_id: Id
  card_id: Id | null
  task_name: string | null
  llm_generation: string
  metadata: Record<string, unknown> | null
  created_at: Timestamp
  /** The articles the generator drew on. Plain documents, without the pivot
   * extras (`blurb`, `relevance_score`) that comment-level citations carry. */
  knowledge_used?: KnowledgeDocument[]
  inserted: boolean
  feedback: DraftFeedback
}

export interface TicketCardFeedback {
  saved: boolean
  savedPositive?: boolean
  exampleId?: Id
  cardId: Id
  comment: { id: Id; ticketId: Id }
}

/** A topic detected on a conversation: the card row plus its pivot columns. */
export interface TicketCard {
  id: Id
  account_id: Id
  classification_label_id: Id
  name: string
  emoji: string | null
  description: string | null
  automatable: string | null
  is_unassigned: boolean
  created_at: Timestamp | null
  /** From the pivot: how sure the classifier was, 0–1. */
  confidence: number
  comment_id: Id
  feedback: TicketCardFeedback
}

export interface ExecutedWorkflowAction {
  id: Id
  account_id: Id
  workflow_id: Id
  action_type: WorkflowActionType
  action_value: string | null
  attachable_id: Id | null
  comment_id: Id
}

export interface TicketExecutedWorkflow {
  /** The executed_workflows row id, not the workflow id. */
  id: Id
  account_id: Id
  name: string
  is_active: boolean
  priority: string
  delay: string
  apply_always: boolean
  applied_at: Timestamp
  comment_id: Id
  actions: ExecutedWorkflowAction[]
  feedback: {
    saved: boolean
    savedPass: boolean
    note?: string | null
    executedWorkflowId: Id
    ticketId: Id
  }
}

/**
 * A row in the conversation context panel, built by `FieldsService`.
 *
 * `value` is a union, not a string: the same list mixes plain text, links,
 * dates and nested row groups (order line items, tags). Every consumer has to
 * narrow before rendering — putting one straight into JSX throws.
 */
export interface ContextFieldRow {
  title?: string
  subtitle?: string
  link?: string
  occurs_at?: Timestamp | null
  left_descriptor?: string
  right_descriptor?: string
}

export type ContextFieldValue =
  | string
  | { title: string; url?: string }
  | { tracking_company: string; url: string }
  | { date: Timestamp }
  | { rows: ContextFieldRow[] }

/**
 * A helpdesk field the account knows about, from a connected Zendesk's
 * configuration. The simulator offers these as inputs so you can set the
 * context a conversation would arrive with.
 */
export interface AccountField {
  fieldKey: string
  displayName: string
  type?: string
  key?: string
  /** Present for `multiselect` fields; the allowed values. */
  multiSelectOptions?: string[] | null
}

export interface ContextField {
  fieldKey: string
  /** Overrides `fieldKey` as the label when the backend supplies one. */
  displayName?: string
  /** Which integration contributed the field — absent for ticket/user fields. */
  scope?: string
  value: ContextFieldValue
}

export interface TicketSource {
  id: Id
  slug: string
  name: string
}

export interface Ticket {
  id: Id
  account_id: Id
  source_id: Id
  inbox_id: Id | null
  external_id: string
  requester_id: Id | null
  requester_external_id: string | null
  submitter_id: Id | null
  submitter_external_id: string | null
  subject: string | null
  status: string | null
  channel: string | null
  tags: string | null
  custom_fields: Record<string, unknown> | null
  num_comments: number | null
  num_comments_read: number | null
  latest_comment_at: Timestamp | null
  latest_comment_is_agent_reply: boolean | null
  has_agent_and_customer: boolean | null
  aide_read: boolean | null
  not_eligible: boolean | null
  being_processed: boolean
  zendesk_brand_id: Id | null
  external_created_at: Timestamp
  external_updated_at: Timestamp | null
  created_at: Timestamp
  updated_at: Timestamp
  ticketSource: TicketSource
  /** Grafted on by `TicketService`, mirrors `ticketSource.slug`. */
  ticket_source_slug: string
  comments: TicketComment[]
  drafts: TicketDraft[]
  cards: TicketCard[]
  executedWorkflows: TicketExecutedWorkflow[]
  contextFields: ContextField[]
  /** Matched CRM contacts. Empty unless a contact integration is connected. */
  contact: IntegratedContact[]
  ecommCustomers: Array<Record<string, unknown>>
  ecommOrders: Array<Record<string, unknown>>
  ecommFulfillments: Array<Record<string, unknown>>
}

/** A customer record matched from a connected CRM. */
export interface IntegratedContact {
  id: Id
  account_id: Id
  external_id: string
  name: string | null
  email: string | null
  phone_e164: string | null
  data: Record<string, unknown>
  created_at: Timestamp
  updated_at: Timestamp
}

export interface PaginationMeta {
  current_page: number
  last_page: number
  first_page: number
}

export interface CollectableField {
  id: Id
  account_id: Id
  name: string
  field_key: string
  description: string | null
  created_at: Timestamp
}

export interface TicketsResponse {
  tickets: Ticket[]
  macros: Macro[]
  collectableFields: CollectableField[]
  /** Only sent when a Zendesk integration is connected. */
  zendeskSubdomain?: string | null
  gridTimeInterval: 'day' | 'hour'
  paginationMeta: PaginationMeta
}

/** The full card row plus its parent label, as used by the filter dropdowns. */
export interface SelectionOptionTopic extends TopicCard {
  account_id: Id
  classification_label_id: Id
  is_unassigned: boolean
  category: TaxonomyLabel & { parent_category?: TaxonomyLabel }
}

export interface SelectionOptionsResponse {
  topics: SelectionOptionTopic[]
  workflows: WorkflowSummary[]
}

export interface SimulatorResponse {
  ticket: Ticket
}

/* -------------------------------------------------------------------------- */
/* Topics (v2 cards)                                                           */
/* -------------------------------------------------------------------------- */

export interface CardExample {
  id: Id
  classification_card_id: Id
  account_id: Id
  user_id: Id | null
  ticket_id: Id | null
  comment_id: Id | null
  /** The example text. Named `body`, not `text`. */
  body: string
  is_positive: boolean | null
  is_compatible: boolean | null
  compatibility_reasoning: string | null
  manually_added: boolean
  needs_review: boolean
  could_be_dropped: boolean
  move_to_card_id: Id | null
  feedback_last_received: Timestamp | null
  created_at: Timestamp
  updated_at: Timestamp
}

export interface TopicCard {
  id: Id
  name: string
  description: string | null
  emoji: string | null
  automatable: string | null
  /** Present only on `/v2/cards?getAllStats=true`. */
  examples?: CardExample[]
  conversation_count?: NumericString
  example_count?: NumericString
  last_used_at?: Timestamp | null
}

export interface SubCategory {
  id: Id
  name: string
  cards: TopicCard[]
}

export interface Category {
  id: Id
  name: string
  color: string | null
  related_categories: SubCategory[]
}

export interface CardsV2Response {
  meta: {
    total: number
    per_page: number
    current_page: number
    last_page: number
    first_page: number
  }
  data: Category[]
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

/**
 * Action types seen in the wild. Unlike conditions, the backend does not
 * constrain this to an enum — the validator takes `schema.string()` — so the
 * union stays open and unknown types fall through to their raw name rather than
 * being mistyped away.
 */
export type KnownWorkflowActionType =
  | 'PROMPT_INSTRUCTION'
  | 'PREGENERATE_REPLY'
  | 'GENERATE_REPLY'
  | 'SUGGEST_REPLY'
  | 'REPLY'
  | 'SUGGEST_MACRO'
  | 'APPLY_MACRO'
  | 'MACRO'
  | 'ADD_TAG'
  | 'CLOSE_TICKET'
  | 'ASSIGN'
  | 'COLLECT_FIELD'

export type WorkflowActionType = KnownWorkflowActionType | (string & {})

export interface WorkflowCondition {
  id: Id
  account_id: Id
  workflow_id: Id
  attachable_id: Id | null
  custom_field_name: string | null
  condition_type: WorkflowConditionType
  operator: WorkflowConditionOperator
  value: string | null
  field_key: string | null
  /** Which OR-group this AND-condition belongs to. Serialised as a string. */
  conjunction_index: NumericString
  created_at: Timestamp
  updated_at: Timestamp
}

export interface WorkflowAction {
  id: Id
  account_id: Id
  workflow_id: Id
  action_type: WorkflowActionType
  /** Null for actions that carry no payload, e.g. `PREGENERATE_REPLY`. */
  action_value: string | null
  attachable_id: Id | null
  created_at: Timestamp
}

/** A workflow without its conditions/actions, as embedded in dropdown payloads. */
export interface WorkflowSummary {
  id: Id
  account_id: Id
  name: string
  is_active: boolean
  generative_config_id: Id | null
  latest_coverage_estimate: number | null
  priority: string
  delay: string
  apply_always: boolean
  created_at: Timestamp
  updated_at: Timestamp
}

export interface Workflow extends WorkflowSummary {
  conditions: WorkflowCondition[]
  actions: WorkflowAction[]
  macros: Array<{ id: Id; workflow_id: Id; macro_id: Id; macro?: Macro }>
  /** `conditions` regrouped by `conjunction_index` — the OR-of-ANDs structure. */
  conjunctions: WorkflowCondition[][]
  times_run: number | null
}

/**
 * Topic, inbox and custom-field options send an object; the INTEGRATION
 * (Source) options send a bare display string — `meta: 'Front'`. Normalise
 * with `conditionMeta()` rather than reaching for `.name` directly.
 */
export type ConditionOptionMeta = string | { id?: Id; name: string; emoji?: string | null }

export interface ConditionDropdownOption {
  condition_type: WorkflowConditionType
  field_key?: string | null
  value?: string | null
  meta?: ConditionOptionMeta
  attachable_id?: Id
  count?: number
}

/** A condition as it appears inside a template — no ids, not yet persisted. */
export interface TemplateCondition {
  condition_type: WorkflowConditionType
  operator: WorkflowConditionOperator
  value?: string
  /** Templates reference topics by `relative_id`, which is a plain number. */
  attachable_id?: number
  field_key?: string
}

export interface TemplateAction {
  action_type: WorkflowActionType
  action_value?: string
  attachable_id?: number
}

export interface TemplateTopic {
  name: string
  synonyms: string[]
  description: string
  group_name: string
  group_synonyms: string[]
  category_name: string
  category_synonyms: string[]
  relative_id: number
}

/**
 * A starter pack from `/workflow-templates`: the topics it creates plus the
 * scenarios that reference them. Imported by name, not by slug.
 */
export interface WorkflowTemplate {
  name: string
  description: string
  icon: string
  additional_notes: string
  topics: TemplateTopic[]
  workflows: Array<{
    name: string
    conjunctions: TemplateCondition[][]
    actions?: TemplateAction[]
    priority?: string
    delay?: string
    apply_always?: boolean
  }>
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
  externalIds: string[]
  ticketIds: Id[]
}

/** One configured helpdesk field change inside a macro. */
export interface MacroAction {
  field: string
  value?: string
}

/**
 * `/v1/macros` groups a macro's actions by integration slug (`zendesk`,
 * `front`, `aide_chat`) rather than returning a flat array, so the editor can
 * render one column per helpdesk. Saving takes the same shape back.
 */
export type MacroActionsByIntegration = Record<string, MacroAction[]>

export interface Macro {
  id: Id
  account_id: Id
  user_id: Id | null
  zendesk_id: Id | null
  name: string
  description: string | null
  run_count: number
  actions_count: number
  created_at: Timestamp
  updated_at: Timestamp
  /** Only on `/v1/macros`; copies embedded in other payloads omit it. */
  actions?: MacroActionsByIntegration
  cards?: Array<{ id: Id; name: string; emoji: string | null }>
}

/** A field a macro can set, as offered by `/v1/macros/actions`. */
export interface MacroActionOption {
  value: string
  label: string
  isDisabled: boolean
  valueFieldType: 'text' | 'dropdown'
  defaultOptions?: Array<{ value: string; label: string }>
}

/**
 * `/v1/macros/actions` — available fields keyed by integration slug. Only
 * connected helpdesks come back populated; the rest are empty arrays.
 */
export type MacroActionOptions = Record<string, MacroActionOption[]>

/* -------------------------------------------------------------------------- */
/* Knowledge                                                                   */
/* -------------------------------------------------------------------------- */

export interface KnowledgeDocument {
  id: Id
  account_id: Id
  link: string | null
  title: string | null
  knowledge_set_name: string | null
  help_center_id: Id | null
  knowledge_website_id: Id | null
  document: string | null
  created_at: Timestamp
  updated_at: Timestamp
  external_created_at: Timestamp | null
  /** Grafted on by `/v1/knowledge-documents/get-all` via `withCount('generativeContext')`. */
  times_used?: NumericString
}

export interface KnowledgeEntity {
  id: Id
  account_id: Id
  slug: string
  entity: Record<string, unknown>
  extracted_source_url: string | null
  note: string | null
  sync_frequency: string | null
  created_at: Timestamp
  updated_at: Timestamp
}

/** `/v1/scrape/hc-detect` — `hc_type` is absent when nothing was recognised. */
export interface HcDetectResponse {
  url?: string
  hc_type?: HelpCenterType
  [key: string]: unknown
}

export type HelpCenterType =
  'ZENDESK_HC' | 'FRONT_HC' | 'INTERCOM_HC' | 'GORGIAS_HC' | 'HELPSCOUT_HC' | 'HELPDOCS_IO_HC'

/**
 * `/v1/scrape/hc-status` — a `help_centers` row while one is importing. The
 * endpoint returns an empty body once nothing is in flight, which is how the
 * caller learns the import finished.
 */
export interface HcStatusResponse {
  id: Id
  account_id: Id
  importing: boolean
  importing_out_of: NumericString | number
  imported_so_far: NumericString | number
  hc_type: HelpCenterType
  base_url: string
}

/* -------------------------------------------------------------------------- */
/* Reports                                                                     */
/* -------------------------------------------------------------------------- */

export interface CountWithUrlSearchParams {
  count: number
  /** A ready-made conversations query string, e.g. `from=…&until=…&viewIds=…`. */
  urlSearchParams: string
}

export type ReportCountKey =
  | 'conversations'
  | 'eligibleConversations'
  | 'conversationsWithTopic'
  | 'conversationsWithNoTopic'
  | 'conversationsWithWorkflowExecuted'
  | 'conversationsWithWorkflowTextMacroExecuted'
  | 'conversationsWithWorkflowNonTextMacroExecuted'
  | 'conversationsWithWorkflowMacroSuggestionUsed'
  | 'conversationsWithWorkflowMacroSuggested'
  | 'conversationsWithDraftInserted'
  | 'conversationsWithDraftNotInserted'
  | 'conversationsWithDraftAutoGenerated'
  | 'conversationsWithDraftManuallyGenerated'
  | 'topicsPositiveFeedback'
  | 'topicsNegativeFeedback'
  | 'workflowsPositiveFeedback'
  | 'workflowsNegativeFeedback'
  | 'draftsPositiveFeedback'
  | 'draftsNegativeFeedback'

export interface ReportTopic {
  id: Id
  name: string
  emoji: string | null
  ticketsCount: number
  positiveFeedbackCount: number
  negativeFeedbackCount: number
  parent: {
    id: Id
    name: string
    parent: { id: Id; name: string; color: string | null }
  }
}

export interface ReportSummary {
  /** Every key is always present; the controller computes the full set. */
  countsWithUrlSearchParams: Record<ReportCountKey, CountWithUrlSearchParams>
  topics: ReportTopic[]
  topicsDetected: number
  workflowsTriggered: number
  draftsGenerated: number
}

/* -------------------------------------------------------------------------- */
/* Integrations + billing                                                      */
/* -------------------------------------------------------------------------- */

export interface FrontInbox {
  id: Id
  account_id: Id
  external_id: string
  name: string
  is_enabled: boolean
  is_pulled: boolean
  created_at: Timestamp
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
  id: Id
  name: string
  website: string | null
  created_at: Timestamp
  num_users: NumericString | number
  ticket_count: NumericString | number
  explore_status: ExploreStatus
  provisioned_by: string
}

/* -------------------------------------------------------------------------- */
/* Agents — NOT ON THE BACKEND YET                                             */
/* -------------------------------------------------------------------------- */

/**
 * The Agents section is designed but unimplemented server-side: node-api has no
 * `/v1/agents` routes. Its screens are parked — `/agents*` redirects to Home and
 * the sidebar entry is gone — so nothing here is fetched today. The types stay
 * so the screens keep compiling and can be switched back on in one commit.
 */
export type AgentStatus = 'draft' | 'deployed' | 'paused'

export type AgentChannelSlug = 'website' | 'helpdesk' | 'email'

export interface AgentChannel {
  slug: AgentChannelSlug
  enabled: boolean
  /** website: embed snippet id; helpdesk: 'zendesk' | 'front'; email: address */
  config: Record<string, string>
}

export interface Agent {
  id: Id
  account_id: Id
  name: string
  description: string
  instructions: string
  tone: 'concise' | 'friendly' | 'formal' | 'playful'
  status: AgentStatus
  use_knowledge: boolean
  workflow_ids: Id[]
  channels: AgentChannel[]
  last_active_at: Timestamp | null
  /** 7 daily interaction counts, oldest first */
  interactions_7d: number[]
  created_at: Timestamp
  updated_at: Timestamp
}

export interface AgentActivityRow {
  id: Id
  ticket_id: Id | null
  channel: AgentChannelSlug
  subject: string
  outcome: 'resolved' | 'handed_off' | 'no_answer'
  messages: number
  created_at: Timestamp
}

export interface AgentTestReply {
  reply: string
  knowledge_used: Array<{ id: Id; title: string; blurb: string }>
}
