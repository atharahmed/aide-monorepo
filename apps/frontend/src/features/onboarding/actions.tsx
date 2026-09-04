/**
 * The onboarding/action engine, ported from the v5 `utils/onboarding.tsx`.
 *
 * This is product logic, not chrome: it decides which reminder chips appear in
 * a page header, which action boxes fill an empty state, and which nav items
 * are visible. The qualification rules and relevance weights are carried over
 * as-is so the behaviour matches production.
 *
 * Two deliberate changes:
 *  - Bots actions no-op (`retired: true`) rather than being deleted — the
 *    backend still reports `has_a_bot`, and dropping them silently would change
 *    which actions surface.
 *  - The per-action colour coding is gone. Chips are monochrome; the only
 *    variant left is `emphasis`, for work that is actively running.
 */

import type { ReactNode } from 'react'
import {
  BarChart3,
  BookOpen,
  Cable,
  CalendarFold,
  ClipboardCheck,
  FileText,
  Loader2,
  MailIcon,
  MessagesSquare,
  PenLine,
  PlugZap,
  Sparkles,
  Users,
} from 'lucide-react'
import type { Me } from '@/types/api'
import { IntegrationGlyph } from '@/components/integration-glyph'
import { helpdeskTicketUrl } from '@/features/conversations/helpdesk-links'

export const OnboardingIntentSlug = {
  GMAIL: 'gmail',
  ZENDESK: 'zendesk',
  FRONT: 'front',
  GORGIAS: 'gorgias',
  SALESFORCE: 'salesforce',
  EXPLORING: 'exploring',
  EMAIL_AGENT: 'email_agent',
  CHAT_AGENT: 'chat_agent',
  HUMAN_COPILOT: 'human_copilot',
  HELP_CENTER: 'help_center',
  /** @deprecated use EMAIL_AGENT / CHAT_AGENT / HUMAN_COPILOT */
  WEBSITE_CHATBOT: 'website_chatbot',
  /** @deprecated use EMAIL_AGENT / CHAT_AGENT / HUMAN_COPILOT */
  AGENT_ASSIST: 'agent_assist',
  /** @deprecated use EMAIL_AGENT / CHAT_AGENT / HUMAN_COPILOT */
  AUTO_REPLY: 'auto_reply',
  SHOPIFY: 'shopify',
  WOOCOMMERCE: 'woocommerce',
  L0_AUTOMATION: 'l0_automation',
  AUTOCLOSE_THANKS: 'autoclose_thanks',
  SPAM: 'spam',
  GOVERN_AGENTS: 'govern_agents',
  VOICE_OF_CUSTOMER: 'voice_of_customer',
  OTHER: 'other',
} as const

export type OnboardingIntentSlugValue =
  (typeof OnboardingIntentSlug)[keyof typeof OnboardingIntentSlug]

export interface OnboardingIntent {
  title: string
  description: string
  slug: OnboardingIntentSlugValue
  icon: ReactNode
  group: string
}

export const onboardingIntents: OnboardingIntent[] = [
  // {
  //   title: 'Gmail',
  //   description: 'Sync threads, labels and contacts',
  //   slug: OnboardingIntentSlug.GMAIL,
  //   icon: <IntegrationGlyph slug="gmail" />,
  //   group: 'Communication',
  // },
  {
    title: 'Zendesk',
    description: 'Sync tickets, macros, knowledge and contacts',
    slug: OnboardingIntentSlug.ZENDESK,
    icon: <IntegrationGlyph slug="zendesk" />,
    group: 'Communication',
  },
  {
    title: 'Front',
    description: 'Sync conversations, tags, templates and contacts',
    slug: OnboardingIntentSlug.FRONT,
    icon: <IntegrationGlyph slug="front" />,
    group: 'Communication',
  },
  {
    title: 'Gorgias',
    description: 'Sync conversations, tags and contacts',
    slug: OnboardingIntentSlug.GORGIAS,
    icon: <IntegrationGlyph slug="gorgias" />,
    group: 'Communication',
  },
  {
    title: 'Shopify',
    description: 'Read orders, products and inventory to answer customers',
    slug: OnboardingIntentSlug.SHOPIFY,
    icon: <IntegrationGlyph slug="shopify" />,
    group: 'E-commerce',
  },
  {
    title: 'WooCommerce',
    description: 'Read orders, products and inventory to answer customers',
    slug: OnboardingIntentSlug.WOOCOMMERCE,
    icon: <IntegrationGlyph slug="woocommerce" />,
    group: 'E-commerce',
  },
  {
    title: 'Salesforce',
    description: 'Sync fields and records',
    slug: OnboardingIntentSlug.SALESFORCE,
    icon: <IntegrationGlyph slug="salesforce" />,
    group: 'CRM',
  },
  {
    title: 'Email Agent',
    description: 'Send answers straight from your inbox',
    slug: OnboardingIntentSlug.EMAIL_AGENT,
    icon: <MailIcon className="size-5 text-gray-500" />,
    group: 'Aide features',
  },
  {
    title: 'Chat Agent',
    description: 'Deploy an agent that answers on your website',
    slug: OnboardingIntentSlug.CHAT_AGENT,
    icon: <MessagesSquare className="size-5 text-gray-500" />,
    group: 'Aide features',
  },
  {
    title: 'Human Copilot',
    description: 'AI drafts, your team edits before sending',
    slug: OnboardingIntentSlug.HUMAN_COPILOT,
    icon: <Sparkles className="size-5 text-gray-500" />,
    group: 'Aide features',
  },
  {
    title: 'Govern my agents',
    description: 'Monitor, evaluate and control your AI agents',
    slug: OnboardingIntentSlug.GOVERN_AGENTS,
    icon: <ClipboardCheck className="size-5 text-gray-500" />,
    group: 'Aide features',
  },
  {
    title: 'Understand my customers',
    description: 'See what customers contact you about, ranked by volume',
    slug: OnboardingIntentSlug.VOICE_OF_CUSTOMER,
    icon: <BarChart3 className="size-5 text-gray-500" />,
    group: 'Aide features',
  },
  {
    title: 'Something else',
    description: 'Tell us what you are looking for',
    slug: OnboardingIntentSlug.OTHER,
    icon: <PenLine className="size-5 text-gray-500" />,
    group: 'Aide features',
  },
]

/* -------------------------------------------------------------------------- */

export type OnboardingPage =
  | 'home'
  | 'conversations'
  | 'topics'
  | 'workflows'
  | 'knowledge'
  | 'business-information'
  | 'agents'
  | 'reports'
  | 'team'
  | 'bots'

interface RawOnboardingAction {
  title: string
  link?: string
  linkCallback?: (user: Me) => string | undefined
  icon: ReactNode
  qualified: (user: Me, page: OnboardingPage) => boolean | undefined
  relevance: (user: Me) => number
  actionBox: {
    description: string
    buttonText?: string
    solutions?: Array<{ title: string; link: string }>
    emphasis?: boolean
  }
  reminder?: { body: string; emphasis?: boolean }
  /** Kept so the action still occupies its slug, but never qualifies. */
  retired?: boolean
}

const hasIntent = (user: Me, ...slugs: string[]) =>
  (user.team?.onboarding_intent_slugs ?? []).some((slug) => slugs.includes(slug))

const hasIntegration = (user: Me, name: string) =>
  Boolean((user.team?.activeIntegrations ?? []).find((integration) => integration.name === name))

const activationTicketUrl = (user: Me) =>
  helpdeskTicketUrl(user, (user.team?.activation_tickets ?? [])[0])

const rawOnboardingActions: RawOnboardingAction[] = [
  {
    title: 'Book a demo',
    link: 'https://calendly.com/ziyad-aide/30-mins',
    icon: <CalendarFold className="size-5 text-gray-500" />,
    qualified: (_user, page) => ['home'].includes(page),
    relevance: () => 0,
    actionBox: { description: 'Get a walkthrough from the Aide team', buttonText: 'Book a time' },
  },
  {
    title: 'Connect Shopify',
    linkCallback: () => 'https://apps.shopify.com/aide',
    icon: <IntegrationGlyph slug="shopify" />,
    qualified: (user, page) =>
      ['conversations', 'workflows', 'home'].includes(page) &&
      !hasIntegration(user, 'shopify') &&
      hasIntent(user, OnboardingIntentSlug.SHOPIFY),
    relevance: () => 0.67,
    actionBox: {
      description: 'Use order, fulfilment and product data to answer customers',
      buttonText: 'Install the Shopify app',
      solutions: [
        {
          title: 'How to automate Shopify order tracking',
          link: 'https://docs.aide.app/hc/en-us/articles/23450284596503-How-to-Automate-Shopify-Order-Tracking',
        },
      ],
    },
    reminder: { body: 'Connect Shopify' },
  },
  {
    title: 'Connect WooCommerce',
    linkCallback: () => '/integrations/woocommerce',
    icon: <IntegrationGlyph slug="woocommerce" />,
    qualified: (user, page) =>
      ['conversations', 'workflows', 'home'].includes(page) &&
      !hasIntegration(user, 'woocommerce') &&
      hasIntent(user, OnboardingIntentSlug.WOOCOMMERCE),
    relevance: () => 0.67,
    actionBox: {
      description: 'Use order, fulfilment and product data to answer customers',
      buttonText: 'Set up the integration',
    },
    reminder: { body: 'Connect WooCommerce' },
  },
  {
    title: 'Connect Gmail',
    linkCallback: () => '/integrations/gmail',
    icon: <IntegrationGlyph slug="gmail" />,
    qualified: (user, page) =>
      ['conversations', 'topics', 'workflows', 'home'].includes(page) &&
      !hasIntegration(user, 'gmail') &&
      hasIntent(user, OnboardingIntentSlug.GMAIL),
    relevance: () => 1,
    actionBox: {
      description: 'Sync your Gmail threads into Aide',
      buttonText: 'Set up sync',
    },
    reminder: { body: 'Sync with Gmail' },
  },
  {
    title: 'Connect Zendesk',
    linkCallback: () => '/integrations/zendesk',
    icon: <IntegrationGlyph slug="zendesk" />,
    qualified: (user, page) =>
      ['conversations', 'topics', 'workflows', 'home'].includes(page) &&
      !hasIntegration(user, 'front') &&
      !hasIntegration(user, 'zendesk') &&
      hasIntent(user, OnboardingIntentSlug.ZENDESK),
    relevance: () => 1,
    actionBox: { description: 'Sync your Zendesk tickets into Aide', buttonText: 'Set up sync' },
    reminder: { body: 'Sync with Zendesk' },
  },
  {
    title: 'Connect Front',
    linkCallback: () => '/integrations/front',
    icon: <IntegrationGlyph slug="front" />,
    qualified: (user, page) =>
      ['conversations', 'topics', 'workflows', 'home'].includes(page) &&
      !hasIntegration(user, 'front') &&
      !hasIntegration(user, 'zendesk') &&
      hasIntent(user, OnboardingIntentSlug.FRONT),
    relevance: () => 1,
    actionBox: {
      description: 'Sync Front conversations into Aide. You choose which inboxes.',
      buttonText: 'Set up sync',
    },
    reminder: { body: 'Sync with Front' },
  },
  {
    title: 'Enable inboxes',
    linkCallback: () => '/integrations/front/inboxes',
    icon: <IntegrationGlyph slug="front" />,
    qualified: (user, page) =>
      ['conversations', 'topics', 'workflows', 'home'].includes(page) &&
      hasIntegration(user, 'front') &&
      !user.team?.has_any_front_inbox_enabled,
    relevance: () => 2,
    actionBox: {
      description: 'Choose which Front inboxes Aide reads',
      buttonText: 'Select inboxes',
    },
    reminder: { body: 'Enable Front inboxes' },
  },
  {
    title: 'Review integrations',
    linkCallback: () => '/integrations',
    icon: <Cable className="size-5 text-gray-500" />,
    qualified: (_user, page) => ['home'].includes(page),
    relevance: () => 0,
    actionBox: {
      description: 'Manage what Aide is connected to',
      buttonText: 'Manage integrations',
    },
  },
  // {
  //   title: 'Filter spam',
  //   icon: <Filter className="size-5 text-gray-500" />,
  //   link: 'https://docs.aide.app/hc/en-us/articles/24376786432919-Filter-Spam-and-Low-Priority-Messages',
  //   qualified: (user, page) =>
  //     ['topics', 'workflows', 'home'].includes(page) &&
  //     Boolean(user.team?.has_helpdesk_non_chat_tickets) &&
  //     !['IMPORTING_DATA', 'CRUNCHING_DATA'].includes(user.team?.explore_status ?? ''),
  //   relevance: (user) => (hasIntent(user, OnboardingIntentSlug.SPAM) ? 1 : 0),
  //   actionBox: {
  //     description: 'Keep low-priority conversations away from your team, by topic',
  //     buttonText: 'Read the guide',
  //   },
  //   reminder: { body: 'Set up a spam filter' },
  // },
  // {
  //   title: 'Offer self-serve answers',
  //   icon: <HandHelping className="size-5 text-gray-500" />,
  //   link: 'https://docs.aide.app/hc/en-us/articles/24294751643799-Guide-Users-to-Self-Serve-Resources-on-Your-Website',
  //   qualified: (user, page) =>
  //     ['topics', 'workflows', 'home'].includes(page) &&
  //     Boolean(user.team?.has_tickets) &&
  //     !['IMPORTING_DATA', 'CRUNCHING_DATA'].includes(user.team?.explore_status ?? ''),
  //   relevance: () => 0,
  //   actionBox: {
  //     description: 'Point customers at self-serve resources automatically',
  //     buttonText: 'Read the guide',
  //   },
  //   reminder: { body: 'Offer self-serve answers' },
  // },
  {
    title: 'Add teammates',
    linkCallback: () => '/team',
    icon: <Users className="size-5 text-gray-500" />,
    qualified: (user) => user.team?.num_users === 1,
    relevance: () => 0.5,
    actionBox: { description: 'Invite the rest of your support team', buttonText: 'Invite' },
    reminder: { body: 'Invite teammates' },
  },
  {
    title: 'Importing conversations',
    link: 'https://docs.aide.app/hc/en-us/articles/24378065693591-Aide-is-importing-my-data-now-what',
    icon: <Loader2 className="size-5 animate-spin text-gray-400" />,
    qualified: (user, page) =>
      ['conversations', 'topics', 'workflows', 'home'].includes(page) &&
      user.team?.explore_status === 'IMPORTING_DATA',
    relevance: () => 2,
    actionBox: {
      description: 'Your conversations are being imported',
      buttonText: 'What happens next',
      emphasis: true,
    },
    reminder: { body: 'Importing your conversations', emphasis: true },
  },
  // {
  //   title: 'Building your taxonomy',
  //   link: 'https://docs.aide.app/hc/en-us/articles/24378065693591-Aide-is-importing-my-data-now-what',
  //   icon: <Loader2 className="size-5 animate-spin text-gray-400" />,
  //   qualified: (user, page) =>
  //     ['conversations', 'topics', 'workflows', 'home'].includes(page) &&
  //     user.team?.explore_status === 'CRUNCHING_DATA',
  //   relevance: () => 2,
  //   actionBox: {
  //     description: 'We are building a topic taxonomy from your conversations',
  //     buttonText: 'What happens next',
  //     emphasis: true,
  //   },
  //   reminder: { body: 'Building your taxonomy', emphasis: true },
  // },
  {
    title: 'Loading website data',
    icon: <Loader2 className="size-5 animate-spin text-gray-400" />,
    qualified: (user, page) =>
      ['conversations', 'topics', 'workflows', 'home'].includes(page) &&
      user.team?.latest_knowledge_website?.import_status === 'importing',
    relevance: () => 2,
    actionBox: {
      description: 'Aide is reading your website to improve answers. This takes about 15 minutes.',
      emphasis: true,
    },
    reminder: { body: 'Loading website data', emphasis: true },
  },
  {
    title: 'Review website data',
    link: '/knowledge',
    icon: <BookOpen className="size-5 text-gray-500" />,
    qualified: (user, page) =>
      ['conversations', 'topics', 'workflows', 'home', 'business-information'].includes(page) &&
      user.team?.latest_knowledge_website?.import_status === 'imported_recently',
    relevance: () => 2,
    actionBox: {
      description: 'Your website content is now part of Aide’s knowledge',
      buttonText: 'Open knowledge',
    },
    reminder: { body: 'Review website data' },
  },
  {
    title: 'Review business information',
    link: '/knowledge/business-information',
    icon: <ClipboardCheck className="size-5 text-gray-500" />,
    qualified: (user, page) =>
      ['conversations', 'topics', 'workflows', 'home', 'knowledge'].includes(page) &&
      Boolean(user.team?.business_information?.recently_imported),
    relevance: () => 2,
    actionBox: {
      description: 'Check the facts we pulled from your website',
      buttonText: 'Open business information',
    },
    reminder: { body: 'Review business information' },
  },
  /* Bots is gone from the UI. These stay so their slugs remain taken and the
   * relevance ordering of everything else is unchanged. */
  {
    title: 'Set up a custom bot',
    retired: true,
    icon: null,
    qualified: () => false,
    relevance: () => 0,
    actionBox: { description: '' },
  },
  {
    title: 'Create a bot',
    retired: true,
    icon: null,
    qualified: () => false,
    relevance: () => 0,
    actionBox: { description: '' },
  },
  {
    title: 'Chat with your bot',
    retired: true,
    icon: null,
    qualified: () => false,
    relevance: () => 0,
    actionBox: { description: '' },
  },
  {
    title: 'Deploy an AI agent',
    linkCallback: () => '/agents',
    icon: <Sparkles className="size-5 text-gray-500" />,
    qualified: (user, page) =>
      ['conversations', 'topics', 'knowledge', 'workflows', 'home', 'agents'].includes(page) &&
      hasIntent(user, OnboardingIntentSlug.CHAT_AGENT, OnboardingIntentSlug.EMAIL_AGENT, OnboardingIntentSlug.WEBSITE_CHATBOT, OnboardingIntentSlug.AUTO_REPLY),
    relevance: () => 0.9,
    actionBox: {
      description: 'Put an agent on your website or in your helpdesk',
      buttonText: 'Open agents',
    },
    reminder: { body: 'Deploy an AI agent' },
  },
  {
    title: 'Test the simulator',
    linkCallback: () => '/conversations?view=simulator',
    icon: <MessagesSquare className="size-5 text-gray-500" />,
    qualified: (user, page) =>
      ['conversations', 'topics', 'knowledge', 'workflows', 'home'].includes(page) &&
      !window.location.search.includes('simulator') &&
      (user.team?.simulator_tickets?.length ?? 5) < 5,
    relevance: () => 0,
    actionBox: {
      description: 'See how Aide would handle a conversation before it goes live',
      buttonText: 'Simulate a conversation',
    },
    reminder: { body: 'Simulate a conversation', emphasis: true },
  },
  {
    title: 'Add knowledge',
    linkCallback: () => '/knowledge',
    icon: <FileText className="size-5 text-gray-500" />,
    qualified: (user, page) =>
      ['home', 'conversations'].includes(page) && !user.team?.has_knowledge,
    relevance: () => 0,
    actionBox: {
      description: 'Write an article for Aide to answer from',
      buttonText: 'Open knowledge',
    },
    reminder: { body: 'Add knowledge' },
  },
  {
    title: 'Import help center',
    linkCallback: () => '/knowledge?import=1',
    icon: <PlugZap className="size-5 text-gray-500" />,
    qualified: (_user, page) => ['knowledge'].includes(page),
    relevance: () => 1,
    actionBox: {
      description: 'From Zendesk, Intercom, Gorgias, Help Scout, Front or HelpDocs',
      buttonText: 'Import a help center',
    },
  },
  {
    title: 'Write article',
    icon: <FileText className="size-5 text-gray-500" />,
    qualified: (user, page) => ['knowledge'].includes(page) && !user.team?.has_knowledge,
    relevance: () => 1,
    actionBox: {
      description: 'Write or paste an article to get started',
      buttonText: 'Add an article',
    },
  },
  {
    title: 'See suggested answer',
    linkCallback: (user) => activationTicketUrl(user),
    icon: <Sparkles className="size-5 text-gray-500" />,
    qualified: (user, page) =>
      ['conversations', 'topics', 'workflows', 'home'].includes(page) &&
      Boolean(activationTicketUrl(user)) &&
      !user.team?.has_acted_upon_activation,
    relevance: () => 2,
    actionBox: {
      description: 'Aide drafted an answer in your helpdesk — take a look',
      buttonText: 'Review conversation',
    },
    reminder: { body: 'See the latest suggestion' },
  },
]

export interface OnboardingAction extends RawOnboardingAction {
  slug: string
  resolveLink: (user: Me) => string | undefined
  relevanceValue: number
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w ]+/g, '')
    .replace(/ +/g, '-')
}

function resolveLinkFor(action: RawOnboardingAction) {
  return (user: Me) => {
    if (action.linkCallback) return action.linkCallback(user)
    if (action.link) return action.link
    return action.actionBox.solutions?.find((solution) => solution.link)?.link
  }
}

const onboardingActions = (() => {
  const counts: Record<string, number> = {}
  return rawOnboardingActions.map((action) => {
    let slug = slugify(action.title)
    if (slug in counts) {
      counts[slug] += 1
      slug = `${slug}-${counts[slug]}`
    } else {
      counts[slug] = 1
    }
    return { ...action, slug, resolveLink: resolveLinkFor(action), relevanceValue: 0 }
  })
})()

export function getOnboardingActions(
  user: Me | undefined,
  page: OnboardingPage
): OnboardingAction[] {
  if (!user?.team) return []
  return onboardingActions
    .filter((action) => !action.retired && action.qualified(user, page))
    .map((action) => ({ ...action, relevanceValue: action.relevance(user) }))
    .sort((a, b) => b.relevanceValue - a.relevanceValue)
}

export function getOnboardingReminders(user: Me | undefined, page: OnboardingPage) {
  if (!user) return []
  const dismissed = user.team?.dismissed_onboarding_action_slugs ?? []
  return getOnboardingActions(user, page).filter(
    (action) => action.reminder && action.resolveLink(user) && !dismissed.includes(action.slug)
  )
}

/* -------------------------------------------------------------------------- */
/* Nav visibility — carried over from `getMainMenu`                            */
/* -------------------------------------------------------------------------- */

export function canSeeConversations(user: Me | undefined) {
  if (!user?.team) return false
  return Boolean(
    user.team.has_tickets ||
    hasIntent(user, OnboardingIntentSlug.ZENDESK, OnboardingIntentSlug.FRONT) ||
    hasIntegration(user, 'front') ||
    hasIntegration(user, 'zendesk')
  )
}

export const canSeeTopics = canSeeConversations

export function canSeeScenarios(user: Me | undefined) {
  return Boolean(user?.team?.has_tickets || user?.team?.has_workflows)
}

export function canSeeReports(user: Me | undefined) {
  return Boolean(user?.team?.has_tickets)
}

/* -------------------------------------------------------------------------- */
/* Billing gates                                                               */
/* -------------------------------------------------------------------------- */

export type BillingStateSlug = 'free_trial' | 'payment_failed' | 'expired'

export interface BillingState {
  slug: BillingStateSlug
  content: string
  /** `payment_failed` and `expired` lock the app behind a modal. */
  blocking: boolean
}

export function getBillingState(user: Me | undefined, pathname: string): BillingState | undefined {
  const billing = user?.team?.billing_status
  if (!billing) return undefined
  if (pathname.startsWith('/settings/billing') || pathname.startsWith('/start')) return undefined
  if (!['trial', ''].includes(billing.provisioned_by)) return undefined

  if (billing.provisioned_by === 'trial') {
    return {
      slug: 'free_trial',
      content: `${billing.free_trial_remaining_days} days left in your trial. Choose a plan to keep using Aide.`,
      blocking: false,
    }
  }

  if (billing.latest_invoice_failed) {
    return {
      slug: 'payment_failed',
      content: 'Your last payment failed. Update your payment method to restore service.',
      blocking: true,
    }
  }

  return {
    slug: 'expired',
    content: 'Your trial has ended and no plan is active. Choose a plan to continue.',
    blocking: true,
  }
}
