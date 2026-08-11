/**
 * Every server-state read/write in one place, so Phase 2's Tuyau adoption is a
 * per-hook change rather than a component rewrite.
 */

import { useMutation, useQuery, useQueryClient, type UseQueryOptions } from '@tanstack/react-query'
import { api } from './api'
import type {
  Agent,
  AgentActivityRow,
  AgentTestReply,
  CardsV2Response,
  FrontInbox,
  InviteDetails,
  KnowledgeDocument,
  KnowledgeEntity,
  Macro,
  MacroActionOption,
  Me,
  PricingQuote,
  ReportSummary,
  SelectionOptionsResponse,
  TeamMember,
  TicketsResponse,
  Workflow,
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
  reports: (since: number, until: number) => ['reports', { since, until }] as const,
  frontInboxes: ['front-inboxes'] as const,
  agents: ['agents'] as const,
  agent: (id: number) => ['agents', id] as const,
  agentActivity: (id: number) => ['agents', id, 'activity'] as const,
  invite: (code: string) => ['invite', code] as const,
  adminAccounts: ['admin', 'accounts'] as const,
  adminCustomers: ['admin', 'customers'] as const,
}

/* -------------------------------------------------------------------------- */
/* User + team                                                                 */
/* -------------------------------------------------------------------------- */

export const meQueryOptions = {
  queryKey: queryKeys.me,
  queryFn: () => api.get<Me>('/v1/me'),
  staleTime: 60_000,
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
    mutationFn: (emails: string[]) =>
      api.post<{ total_invites: number; invites_sent: number; emails_taken: string[] }>(
        '/v1/team/invite',
        { users: emails }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.team })
      queryClient.invalidateQueries({ queryKey: queryKeys.me })
    },
  })
}

export function useResendInvite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.post('/v1/team/invite/resend', { id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.team }),
  })
}

export function useDeleteInvite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete('/v1/team/invite', { id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.team }),
  })
}

export function useUpdateAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: {
      name: string
      password?: string
      password_confirmation?: string
      old_password?: string
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

export function useTickets(params: TicketListParams) {
  return useQuery({
    queryKey: queryKeys.tickets(params),
    queryFn: () => api.get<TicketsResponse>('/v1/tickets', { ...params, pageSize: 16 }),
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
    mutationFn: ({ ticketId, body }: { ticketId: number; body: string }) =>
      api.post(`/v1/tickets/${ticketId}`, { body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tickets'] }),
  })
}

export function useSimulator() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { message: string; ticketId?: number }) =>
      api.post<{ ticket: TicketsResponse['tickets'][number] }>('/v1/simulator', payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tickets'] }),
  })
}

export function useDraftFeedback() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: {
      cachedLlmGenerationId: number
      ticketId: number
      isPositive: boolean
      note?: string
    }) => api.post('/v1/feedback/draft', payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tickets'] }),
  })
}

export function useWorkflowFeedback() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: {
      executedWorkflowId: number
      ticketId: number
      isPositive: boolean
      note?: string
    }) => api.post('/v1/feedback/workflow', payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tickets'] }),
  })
}

export function useKnowledgeFeedback() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: {
      knowledgeDocumentId: number
      commentId: number
      isPositive: boolean
    }) => api.post('/v1/feedback/knowledgeUsed', payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tickets'] }),
  })
}

export function useTopicFeedback() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: { cardId: number; commentId: number; isPositive: boolean }) =>
      api.post(`/v2/cards/${payload.cardId}/examples`, {
        comment_id: payload.commentId,
        is_positive: payload.isPositive,
        text: '',
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tickets'] }),
  })
}

/* -------------------------------------------------------------------------- */
/* Topics                                                                      */
/* -------------------------------------------------------------------------- */

export function useCards(getAllStats = true) {
  return useQuery({
    queryKey: queryKeys.cards(getAllStats),
    queryFn: () => api.get<CardsV2Response>('/v2/cards', { getAllStats }),
  })
}

export function useUpdateTopic() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: { id: number } & Record<string, unknown>) =>
      api.post(`/v2/topics/${id}`, payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cards'] }),
  })
}

export function useCreateTopic() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: {
      name: string
      description?: string
      emoji?: string
      category_id: number
    }) => api.post('/v2/cards', payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cards'] }),
  })
}

export function useDeleteTopic() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/v2/cards/${id}`),
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
    mutationFn: ({ categoryId, name }: { categoryId: number; name: string }) =>
      api.post(`/v2/categories/${categoryId}`, { name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cards'] }),
  })
}

export function useDeleteCardExamples() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ cardId, exampleIds }: { cardId: number; exampleIds: number[] }) =>
      api.post(`/v2/cards/${cardId}/deleteExamples`, { exampleIds }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cards'] }),
  })
}

export function useUpdateCardExamples() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      cardId,
      examples,
    }: {
      cardId: number
      examples: Array<{ id: number; is_positive?: boolean; text?: string }>
    }) => api.post(`/v2/cards/${cardId}/updateExamples`, { examples }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['cards'] }),
  })
}

/* -------------------------------------------------------------------------- */
/* Scenarios + macros                                                          */
/* -------------------------------------------------------------------------- */

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
    mutationFn: (workflow: Partial<Workflow> & { id: number }) =>
      api.post<Workflow>('/v1/workflows', workflow),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows })
      queryClient.invalidateQueries({ queryKey: queryKeys.me })
    },
  })
}

export function useCreateWorkflow() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<Workflow>('/v1/workflows/new'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.workflows }),
  })
}

export function useImportWorkflow() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (slug: string) => api.post<Workflow>('/v1/workflows/import', { slug }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.workflows }),
  })
}

export function useDeleteWorkflow() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.delete(`/v1/workflow/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.workflows }),
  })
}

export function useMacros() {
  return useQuery({ queryKey: queryKeys.macros, queryFn: () => api.get<Macro[]>('/v1/macros') })
}

export function useMacroActionOptions() {
  return useQuery({
    queryKey: queryKeys.macroActions,
    queryFn: () => api.get<MacroActionOption[]>('/v1/macros/actions'),
    staleTime: 5 * 60_000,
  })
}

export function useSaveMacro() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...payload }: { id?: number } & Record<string, unknown>) =>
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
    mutationFn: (id: number) => api.delete(`/v1/macros/${id}`),
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
    mutationFn: ({ id, ...payload }: { id?: number } & Record<string, unknown>) =>
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
    mutationFn: (id: number) => api.delete(`/v1/knowledge-documents/${id}`),
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
    mutationFn: ({ id, ...payload }: { id?: number } & Record<string, unknown>) =>
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
    mutationFn: (id: number) => api.delete(`/v1/knowledge-entities/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.knowledgeEntities })
      queryClient.invalidateQueries({ queryKey: queryKeys.me })
    },
  })
}

/* -------------------------------------------------------------------------- */
/* Reports                                                                     */
/* -------------------------------------------------------------------------- */

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
    mutationFn: (inboxes: Array<{ id: number; is_enabled: boolean }>) =>
      api.post('/v1/front-inboxes', { inboxes }),
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
/* Agents — PROVISIONAL API                                                    */
/* -------------------------------------------------------------------------- */

export function useAgents() {
  return useQuery({ queryKey: queryKeys.agents, queryFn: () => api.get<Agent[]>('/v1/agents') })
}

export function useAgent(id: number) {
  return useQuery({
    queryKey: queryKeys.agent(id),
    queryFn: () => api.get<Agent>(`/v1/agents/${id}`),
    enabled: Number.isFinite(id) && id > 0,
  })
}

export function useAgentActivity(id: number) {
  return useQuery({
    queryKey: queryKeys.agentActivity(id),
    queryFn: () => api.get<AgentActivityRow[]>(`/v1/agents/${id}/activity`),
    enabled: Number.isFinite(id) && id > 0,
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
    mutationFn: ({ id, ...payload }: { id: number } & Partial<Agent>) =>
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
    mutationFn: ({ id, status }: { id: number; status: Agent['status'] }) =>
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
    mutationFn: (id: number) => api.delete(`/v1/agents/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.agents }),
  })
}

export function useTestAgent(id: number) {
  return useMutation({
    mutationFn: (message: string) => api.post<AgentTestReply>(`/v1/agents/${id}/test`, { message }),
  })
}
