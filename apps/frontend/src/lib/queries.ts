/**
 * Every server-state read/write in one place.
 *
 * Request shapes here are dictated by the v5 Adonis validators, which are not
 * uniform: some endpoints want snake_case, some camelCase, some want numbers
 * where the response gave strings. Where a payload looks inconsistent it is
 * matching the backend, not inventing a convention.
 */

import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query'
import { api } from './api'
import type {
  Agent,
  AgentActivityRow,
  AgentTestReply,
  CardsV2Response,
  FrontInbox,
  HcStatusResponse,
  Id,
  InviteDetails,
  InviteResult,
  KnowledgeDocument,
  KnowledgeEntity,
  Macro,
  MacroActionOptions,
  Me,
  PricingQuote,
  ReportSummary,
  SelectionOptionsResponse,
  SimulatorResponse,
  TeamMember,
  TicketsResponse,
  Workflow,
  WorkflowAction,
  WorkflowCondition,
  WorkflowTemplate,
  WorkflowsResponse,
} from '@/types/api'

export const queryKeys = {
  me: ['me'] as const,
  team: ['team'] as const,
  tickets: (params: Record<string, unknown>) => ['tickets', params] as const,
  selectionOptions: ['tickets', 'selectionOptions'] as const,
  pricingQuote: ['tickets', 'pricingQuote'] as const,
  cards: (getAllStats: boolean) => ['cards', { getAllStats }] as const,
  workflows: ['workflows'] as const,
  macros: ['macros'] as const,
  macroActions: ['macros', 'actions'] as const,
  knowledge: ['knowledge'] as const,
  knowledgeEntities: ['knowledge', 'entities'] as const,
  helpCenterStatus: ['knowledge', 'hc-status'] as const,
  reports: (since: number, until: number) => ['reports', { since, until }] as const,
  frontInboxes: ['front-inboxes'] as const,
  agents: ['agents'] as const,
  agent: (id: Id) => ['agents', id] as const,
  agentActivity: (id: Id) => ['agents', id, 'activity'] as const,
  invite: (code: string) => ['invite', code] as const,
  adminAccounts: ['admin', 'accounts'] as const,
  adminCustomers: ['admin', 'customers'] as const,
}

/** Feedback endpoints record where the signal came from. */
const FEEDBACK_SOURCE = 'dashboard'

/* -------------------------------------------------------------------------- */
/* User + team                                                                 */
/* -------------------------------------------------------------------------- */

export const meQueryOptions = {
  queryKey: queryKeys.me,
  queryFn: () => api.get<Me>('/v1/me'),
  staleTime: 5 * 60_000,
  retry: false,
}

export function useMe(options?: Partial<UseQueryOptions<Me>>) {
  return useQuery({ ...meQueryOptions, ...options })
}

export function useTeam() {
  return useQuery({ queryKey: queryKeys.team, queryFn: () => api.get<TeamMember[]>('/v1/team') })
}

export function useInviteTeammates() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (emails: string[]) => api.post<InviteResult>('/v1/team/invite', { users: emails }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.team })
      queryClient.invalidateQueries({ queryKey: queryKeys.me })
    },
  })
}

export function useResendInvite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: Id) => api.post('/v1/team/invite/resend', { id: Number(id) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.team }),
  })
}

export function useDeleteInvite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: Id) => api.delete('/v1/team/invite', { id: Number(id) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.team }),
  })
}

export function useUpdateAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: {
      name: string
      old_password?: string
      password?: string
      password_confirmation?: string
    }) => api.post('/v1/user', payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.me }),
  })
}

export function useUpdateEmailPreferences() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (preferences: Array<{ name: string; active: boolean }>) =>
      api.post('/v2/email-preferences', { preferences }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.me }),
  })
}

export function useUpdateWidgetSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (settings: Array<{ name: string; active: boolean }>) =>
      api.post('/v2/ai-assist', { settings }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.me }),
  })
}

export function useDismissOnboardingAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (slug: string) => api.post('/v1/onboard/dismiss', { slug }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.me }),
  })
}

export function useInviteDetails(code: string) {
  return useQuery({
    queryKey: queryKeys.invite(code),
    queryFn: () => api.get<InviteDetails>(`/v1/team/invite/${code}`),
    enabled: Boolean(code),
    retry: false,
  })
}

/* -------------------------------------------------------------------------- */
/* Conversations                                                               */
/* -------------------------------------------------------------------------- */

/**
 * `/v1/tickets` splits its list parameters on `-`, so ids arrive joined that
 * way rather than comma-separated, and dates are `MM-dd-yyyy`.
 */
export interface TicketListParams {
  [key: string]: string | number | undefined
  viewIds?: string
  topicIds?: string
  workflowIds?: string
  ticketIds?: string
  from?: string
  until?: string
  currentPage?: number
}

export const TICKET_PAGE_SIZE = 16

export function useTickets(params: TicketListParams) {
  return useQuery({
    queryKey: queryKeys.tickets(params),
    queryFn: () =>
      api.get<TicketsResponse>('/v1/tickets', { ...params, pageSize: TICKET_PAGE_SIZE }),
    placeholderData: (previous) => previous,
  })
}

export function useSelectionOptions() {
  return useQuery({
    queryKey: queryKeys.selectionOptions,
    queryFn: () => api.get<SelectionOptionsResponse>('/v1/tickets/selectionOptions'),
    staleTime: 5 * 60_000,
  })
}

export function useReplyToTicket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ ticketId, body }: { ticketId: Id; body: string }) =>
      api.post(`/v1/tickets/${ticketId}`, { body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tickets'] }),
  })
}

export function useSimulator() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: {
      body: string
      ticketId?: Id
      subject?: string
      /** JSON-encoded `[{fieldKey, key, value}]` — the endpoint parses it. */
      contextFields?: string
    }) =>
      api.post<SimulatorResponse>('/v1/simulator', {
        ...payload,
        ...(payload.ticketId ? { ticketId: Number(payload.ticketId) } : {}),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tickets'] }),
  })
}

export function useDraftFeedback() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: {
      cachedLlmGenerationId: Id
      ticketId: Id
      saved: boolean
      savedGood: boolean
      note?: string
    }) =>
      api.post('/v1/feedback/draft', {
        ...payload,
        cachedLlmGenerationId: Number(payload.cachedLlmGenerationId),
        ticketId: Number(payload.ticketId),
        source: FEEDBACK_SOURCE,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tickets'] }),
  })
}

export function useWorkflowFeedback() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: {
      executedWorkflowId: Id
      ticketId: Id
      saved: boolean
      savedPass: boolean
      note?: string
    }) =>
      api.post('/v1/feedback/workflow', {
        ...payload,
        executedWorkflowId: Number(payload.executedWorkflowId),
        ticketId: Number(payload.ticketId),
        source: FEEDBACK_SOURCE,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tickets'] }),
  })
}

export function useKnowledgeFeedback() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: {
      knowledgeDocumentId: Id
      agentComment: { id: Id; ticketId: Id; body?: string }
      endUserComment: { id: Id; ticketId: Id; body: string }
      answer: string
      knowledgeSetName?: string
      saved: boolean
      savedPositive: boolean
    }) =>
      api.post('/v1/feedback/knowledgeUsed', {
        ...payload,
        knowledgeDocumentId: Number(payload.knowledgeDocumentId),
        agentComment: {
          ...payload.agentComment,
          id: Number(payload.agentComment.id),
          ticketId: Number(payload.agentComment.ticketId),
        },
        endUserComment: {
          ...payload.endUserComment,
          id: Number(payload.endUserComment.id),
          ticketId: Number(payload.endUserComment.ticketId),
        },
        source: FEEDBACK_SOURCE,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tickets'] }),
  })
}

/* -------------------------------------------------------------------------- */
/* Topics (v2 cards)                                                           */
/* -------------------------------------------------------------------------- */

export function useCards(getAllStats = true) {
  return useQuery({
    queryKey: queryKeys.cards(getAllStats),
    queryFn: () => api.get<CardsV2Response>('/v2/cards', { getAllStats }),
  })
}

/**
 * Topic feedback on a conversation is stored as a card *example*: a thumbs-up
 * adds a positive example, undoing it deletes that example again.
 */
export function useAddCardExample() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      cardId,
      commentId,
      ticketId,
      body,
      isPositive,
      checkCompatibility = false,
    }: {
      cardId: Id
      commentId?: Id
      ticketId?: Id
      body: string
      isPositive: boolean
      checkCompatibility?: boolean
    }) =>
      api.post(`/v2/cards/${cardId}/examples`, {
        body,
        ...(commentId ? { comment_id: Number(commentId) } : {}),
        ...(ticketId ? { ticket_id: Number(ticketId) } : {}),
        is_positive: isPositive,
        check_compatibility: checkCompatibility,
        source: FEEDBACK_SOURCE,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      queryClient.invalidateQueries({ queryKey: ['cards'] })
    },
  })
}

export function useDeleteCardExample() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      cardId,
      exampleId,
      commentId,
      alsoDeleteAttachable,
    }: {
      cardId: Id
      exampleId?: Id
      commentId?: Id
      alsoDeleteAttachable?: boolean
    }) =>
      api.post(`/v2/cards/${cardId}/deleteExamples`, {
        ...(exampleId ? { example_id: Number(exampleId) } : {}),
        ...(commentId ? { comment_id: Number(commentId) } : {}),
        ...(alsoDeleteAttachable ? { also_delete_attachable: true } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tickets'] })
      queryClient.invalidateQueries({ queryKey: ['cards'] })
    },
  })
}

/**
 * Reclassifies a stored example. Every field is required by the validator, so
 * the caller passes the example's current flags alongside the one it changes.
 */
export function useUpdateCardExample() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      cardId,
      exampleId,
      isPositive,
      needsReview = false,
      couldBeDropped = false,
    }: {
      cardId: Id
      exampleId: Id
      isPositive: boolean
      needsReview?: boolean
      couldBeDropped?: boolean
    }) =>
      api.post(`/v2/cards/${cardId}/updateExamples`, {
        example_id: Number(exampleId),
        classification_card_id: Number(cardId),
        is_positive: isPositive,
        needs_review: needsReview,
        could_be_dropped: couldBeDropped,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cards'] }),
  })
}

export function useMoveCardExample() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      cardId,
      exampleId,
      targetCardId,
      isPositive,
    }: {
      cardId: Id
      exampleId: Id
      targetCardId: Id
      isPositive: boolean
    }) =>
      api.post(`/v2/cards/${cardId}/updateExamples`, {
        example_id: Number(exampleId),
        classification_card_id: Number(targetCardId),
        is_positive: isPositive,
        needs_review: false,
        could_be_dropped: false,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cards'] }),
  })
}

export function useCreateTopic() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { name: string; categoryId: Id; relatedCategoryId: Id }) =>
      api.post('/v2/cards', {
        name: payload.name,
        categoryId: Number(payload.categoryId),
        relatedCategoryId: Number(payload.relatedCategoryId),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cards'] }),
  })
}

export function useUpdateTopic() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      name,
      description,
      emoji,
    }: {
      id: Id
      name: string
      description: string
      emoji?: string
    }) => api.post(`/v2/cards/${id}`, { name, description, emoji }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cards'] }),
  })
}

export function useDeleteTopic() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: Id) => api.delete(`/v2/cards/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cards'] }),
  })
}

/** Renames an L2 sub-category. `/v2/topics/:id` addresses a label, not a card. */
export function useRenameSubCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: Id; name: string }) => api.post(`/v2/topics/${id}`, { name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cards'] }),
  })
}

export function useDeleteSubCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: Id) => api.delete(`/v2/topics/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cards'] }),
  })
}

export function useCreateCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { name: string }) => api.post('/v2/categories', payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cards'] }),
  })
}

export function useCreateSubCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ categoryId, name }: { categoryId: Id; name: string }) =>
      api.post(`/v2/categories/${categoryId}`, { name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cards'] }),
  })
}

/* -------------------------------------------------------------------------- */
/* Scenarios + macros                                                          */
/* -------------------------------------------------------------------------- */

/**
 * What `/v1/workflows` accepts on save. It is not `Partial<Workflow>`: the
 * validator wants numeric ids, takes conditions only as `conjunctions`, and
 * rejects the server-computed fields a `Workflow` carries.
 */
export interface WorkflowSavePayload {
  id: number
  name: string
  is_active: boolean
  priority?: string
  delay?: string
  apply_always?: boolean
  conjunctions: Array<
    Array<{
      id?: number
      condition_type: WorkflowCondition['condition_type']
      operator: WorkflowCondition['operator']
      field_key?: string
      value?: string
      attachable_id?: number
    }>
  >
  actions: Array<{
    action_type: WorkflowAction['action_type']
    action_value?: string
    attachable_id?: number
  }>
}

export function useWorkflows() {
  return useQuery({
    queryKey: queryKeys.workflows,
    queryFn: () =>
      api.get<WorkflowsResponse>('/v1/workflows', {
        getAllStats: true,
        computeStatisticalConditions: false,
      }),
  })
}

export function useSaveWorkflow() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (workflow: WorkflowSavePayload) =>
      api.post<{ workflow: Workflow }>('/v1/workflows', workflow),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows })
      queryClient.invalidateQueries({ queryKey: queryKeys.me })
    },
  })
}

export function useCreateWorkflow() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<{ workflow: Workflow }>('/v1/workflows/new'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.workflows }),
  })
}

/**
 * Importing a starter pack posts the whole template back: the endpoint creates
 * its topics first, then the scenarios that reference them by `relative_id`.
 */
export function useImportWorkflow() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (template: WorkflowTemplate) => api.post('/v1/workflows/import', template),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows })
      queryClient.invalidateQueries({ queryKey: ['cards'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.me })
    },
  })
}

export function useDeleteWorkflow() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: Id) => api.delete(`/v1/workflow/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.workflows }),
  })
}

export function useMacros() {
  return useQuery({ queryKey: queryKeys.macros, queryFn: () => api.get<Macro[]>('/v1/macros') })
}

export function useMacroActionOptions() {
  return useQuery({
    queryKey: queryKeys.macroActions,
    queryFn: () => api.get<MacroActionOptions>('/v1/macros/actions'),
    staleTime: 5 * 60_000,
  })
}

export function useSaveMacro() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: { id?: Id } & Record<string, unknown>) =>
      id ? api.post<Macro>(`/v1/macros/${id}`, payload) : api.post<Macro>('/v1/macros', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.macros })
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows })
    },
  })
}

export function useDeleteMacro() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: Id) => api.delete(`/v1/macros/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.macros }),
  })
}

/* -------------------------------------------------------------------------- */
/* Knowledge                                                                   */
/* -------------------------------------------------------------------------- */

export function useKnowledgeDocuments() {
  return useQuery({
    queryKey: queryKeys.knowledge,
    queryFn: () => api.get<KnowledgeDocument[]>('/v1/knowledge-documents/get-all'),
  })
}

export function useSaveKnowledgeDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: { id?: Id } & Record<string, unknown>) =>
      id
        ? api.post<KnowledgeDocument>(`/v1/knowledge-documents/${id}`, payload)
        : api.post<KnowledgeDocument>('/v1/knowledge-documents', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge })
      queryClient.invalidateQueries({ queryKey: queryKeys.me })
    },
  })
}

export function useDeleteKnowledgeDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: Id) => api.delete(`/v1/knowledge-documents/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledge })
      queryClient.invalidateQueries({ queryKey: queryKeys.me })
    },
  })
}

export function useKnowledgeEntities() {
  return useQuery({
    queryKey: queryKeys.knowledgeEntities,
    queryFn: () => api.get<KnowledgeEntity[]>('/v1/knowledge-entities'),
  })
}

export function useSaveKnowledgeEntity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: { id?: Id } & Record<string, unknown>) =>
      id
        ? api.put<KnowledgeEntity>(`/v1/knowledge-entities/${id}`, payload)
        : api.post<KnowledgeEntity>('/v1/knowledge-entities', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledgeEntities })
      queryClient.invalidateQueries({ queryKey: queryKeys.me })
    },
  })
}

export function useDeleteKnowledgeEntity() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: Id) => api.delete(`/v1/knowledge-entities/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledgeEntities })
      queryClient.invalidateQueries({ queryKey: queryKeys.me })
    },
  })
}

/**
 * Help-center import progress. The endpoint replies with an empty body once
 * nothing is importing, which is the only signal that a scrape finished.
 */
export function useHelpCenterStatus(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.helpCenterStatus,
    queryFn: () => api.post<HcStatusResponse | null>('/v1/scrape/hc-status', {}),
    enabled,
    refetchInterval: enabled ? 2000 : false,
    staleTime: 0,
  })
}

/* -------------------------------------------------------------------------- */
/* Reports                                                                     */
/* -------------------------------------------------------------------------- */

/** `since`/`until` are Unix **seconds** — the controller uses `fromSeconds`. */
export function useReportSummary(since: number, until: number) {
  return useQuery({
    queryKey: queryKeys.reports(since, until),
    queryFn: () => api.get<ReportSummary>('/v1/reports/summary', { since, until }),
    placeholderData: (previous) => previous,
  })
}

/* -------------------------------------------------------------------------- */
/* Integrations + billing                                                      */
/* -------------------------------------------------------------------------- */

export function useFrontInboxes() {
  return useQuery({
    queryKey: queryKeys.frontInboxes,
    queryFn: () => api.get<FrontInbox[]>('/v1/front-inboxes'),
  })
}

export function useSaveFrontInboxes() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (inboxes: Array<{ id: Id; is_enabled: boolean }>) =>
      api.post('/v1/front-inboxes', {
        inboxes: inboxes.map((inbox) => ({ id: Number(inbox.id), is_enabled: inbox.is_enabled })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.frontInboxes })
      queryClient.invalidateQueries({ queryKey: queryKeys.me })
    },
  })
}

export function usePricingQuote() {
  return useQuery({
    queryKey: queryKeys.pricingQuote,
    queryFn: () => api.get<PricingQuote>('/v1/tickets/pricingQuote'),
  })
}

/* -------------------------------------------------------------------------- */
/* Agents — NOT ON THE BACKEND YET                                             */
/* -------------------------------------------------------------------------- */

/**
 * node-api has no `/v1/agents` routes. The Agents screens are parked behind a
 * redirect, so none of these run today; they are kept next to the rest of the
 * data layer so switching the section back on is a one-file change.
 */

export function useAgents() {
  return useQuery({ queryKey: queryKeys.agents, queryFn: () => api.get<Agent[]>('/v1/agents') })
}

export function useAgent(id: Id) {
  return useQuery({
    queryKey: queryKeys.agent(id),
    queryFn: () => api.get<Agent>(`/v1/agents/${id}`),
    enabled: Boolean(id),
  })
}

export function useAgentActivity(id: Id) {
  return useQuery({
    queryKey: queryKeys.agentActivity(id),
    queryFn: () => api.get<AgentActivityRow[]>(`/v1/agents/${id}/activity`),
    enabled: Boolean(id),
  })
}

export function useCreateAgent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: Partial<Agent>) => api.post<Agent>('/v1/agents', payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.agents }),
  })
}

export function useSaveAgent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: Id } & Partial<Agent>) =>
      api.post<Agent>(`/v1/agents/${id}`, payload),
    onSuccess: (agent) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agents })
      queryClient.invalidateQueries({ queryKey: queryKeys.agent(agent.id) })
    },
  })
}

export function useSetAgentStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: Id; status: Agent['status'] }) =>
      api.post<Agent>(`/v1/agents/${id}/status`, { status }),
    onSuccess: (agent) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agents })
      queryClient.invalidateQueries({ queryKey: queryKeys.agent(agent.id) })
    },
  })
}

export function useDeleteAgent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: Id) => api.delete(`/v1/agents/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.agents }),
  })
}

export function useTestAgent(id: Id) {
  return useMutation({
    mutationFn: (message: string) => api.post<AgentTestReply>(`/v1/agents/${id}/test`, { message }),
  })
}
