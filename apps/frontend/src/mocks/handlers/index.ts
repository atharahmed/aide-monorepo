import { adminHandlers } from './admin'
import { agentHandlers } from './agents'
import { authHandlers } from './auth'
import { cardHandlers } from './cards'
import { integrationHandlers } from './integrations'
import { knowledgeHandlers } from './knowledge'
import { reportHandlers } from './reports'
import { ticketHandlers } from './tickets'
import { userHandlers } from './user'
import { workflowHandlers } from './workflows'

/** Order matters: more specific paths must come before `:param` catch-alls. */
export const handlers = [
  ...authHandlers,
  ...userHandlers,
  ...ticketHandlers,
  ...cardHandlers,
  ...workflowHandlers,
  ...knowledgeHandlers,
  ...reportHandlers,
  ...agentHandlers,
  ...integrationHandlers,
  ...adminHandlers,
]
