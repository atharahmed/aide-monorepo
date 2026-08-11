/**
 * ============================================================================
 * THE demo dataset. Every piece of fake data in the app is built here.
 * ============================================================================
 *
 * Phase 2 deletes this file and `handlers/` (except `handlers/agents.ts`) and
 * nothing else changes: components read the shapes in `src/types/api.ts`, which
 * are the real API's shapes.
 *
 * Deterministic: a fixed PRNG seed means the same demo every reload, so
 * screenshots and walkthroughs stay reproducible. Dates are relative to "now"
 * so the data always looks fresh.
 */

import type {
  Agent,
  AgentActivityRow,
  Category,
  CollectableField,
  ConditionDropdownOption,
  ContextField,
  FrontInbox,
  KnowledgeDocument,
  KnowledgeEntity,
  Macro,
  MacroActionOption,
  Me,
  TeamMember,
  TicketCommentPayload,
  TicketPayload,
  Workflow,
  WorkflowTemplate,
} from '@/types/api'

/* -------------------------------------------------------------------------- */
/* Deterministic randomness                                                    */
/* -------------------------------------------------------------------------- */

function mulberry32(a: number) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(20260809)
const pick = <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)]
const between = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min
const chance = (probability: number) => rand() < probability

const NOW = Date.now()
const DAY = 86_400_000
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString()
const daysAgo = (days: number, jitterHours = 0) =>
  iso(days * DAY - between(0, jitterHours) * 3_600_000)

/* -------------------------------------------------------------------------- */
/* The demo tenant                                                             */
/* -------------------------------------------------------------------------- */

export const ACCOUNT_ID = 4821
export const ACCOUNT_NAME = 'Northwind Outdoors'
export const ACCOUNT_WEBSITE = 'https://northwindoutdoors.com'

/** Source ids match the backend's ticket_sources table. */
export const SOURCE = { front: 1, zendesk: 2, chat: 3, gmail: 4, gorgias: 5, simulator: 6 } as const

const SOURCE_SLUG: Record<number, string> = {
  1: 'front',
  2: 'zendesk',
  3: 'chat',
  4: 'gmail',
  5: 'gorgias',
  6: 'chat_test',
}

/* -------------------------------------------------------------------------- */
/* Team                                                                        */
/* -------------------------------------------------------------------------- */

const TEAM_PEOPLE = [
  { name: 'Athar Ahmed', email: 'athar@northwindoutdoors.com' },
  { name: 'Priya Raman', email: 'priya@northwindoutdoors.com' },
  { name: 'Marcus Webb', email: 'marcus@northwindoutdoors.com' },
  { name: 'Sofia Almeida', email: 'sofia@northwindoutdoors.com' },
  { name: 'Jonas Lindqvist', email: 'jonas@northwindoutdoors.com' },
  { name: 'Nadia Osei', email: 'nadia@northwindoutdoors.com' },
] as const

const PENDING_INVITES = ['kai@northwindoutdoors.com', 'rowan@northwindoutdoors.com'] as const

const initialsOf = (name: string) =>
  name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

export function buildTeamMembers(): TeamMember[] {
  const members: TeamMember[] = TEAM_PEOPLE.map((person, index) => ({
    id: 900 + index,
    name: person.name,
    initials: initialsOf(person.name),
    email: person.email,
    created_at: daysAgo(180 - index * 12),
    updated_at: daysAgo(between(0, 20)),
    active: true,
    invited: true,
    status: '' as const,
    invite_url: '',
    last_seen_at: index === 0 ? iso(120_000) : daysAgo(between(0, 6), 12),
  }))

  const invites: TeamMember[] = PENDING_INVITES.map((email, index) => ({
    id: 950 + index,
    name: '',
    initials: '',
    email,
    created_at: daysAgo(index === 0 ? 2 : 11),
    updated_at: daysAgo(index === 0 ? 2 : 11),
    active: false,
    invited: true,
    status: index === 0 ? ('pending' as const) : ('expired' as const),
    invite_url: `https://app.aide.app/join?code=${index === 0 ? 'c1f9a2be4d7c' : 'a83be0f19d24'}`,
    invite_url_placeholder: undefined,
    last_seen_at: null,
  })) as TeamMember[]

  return [...members, ...invites]
}

/* -------------------------------------------------------------------------- */
/* Topics — 12 topics across 4 categories                                      */
/* -------------------------------------------------------------------------- */

interface TopicSeed {
  id: number
  name: string
  emoji: string
  description: string
  /** drives the generated conversations */
  scripts: Array<{ subject: string; customer: string; agent: string }>
}

interface SubCategorySeed {
  id: number
  name: string
  topics: TopicSeed[]
}

interface CategorySeed {
  id: number
  name: string
  color: string
  subcategories: SubCategorySeed[]
}

export const CATEGORY_SEED: CategorySeed[] = [
  {
    id: 10,
    name: 'Orders',
    color: '#82bbcf',
    subcategories: [
      {
        id: 110,
        name: 'Fulfilment',
        topics: [
          {
            id: 1001,
            name: 'Order status',
            emoji: '📦',
            description: 'Customer asks where their order is or when it will arrive.',
            scripts: [
              {
                subject: 'Where is my order?',
                customer:
                  "Hi, I placed order #{order} five days ago and the tracking hasn't moved since it left the warehouse. Can you tell me where it is?",
                agent:
                  "Thanks for getting in touch. I've checked order #{order} — it's currently with the carrier in Reno and is scheduled to arrive Thursday. Here's the live tracking link.",
              },
              {
                subject: 'Order #{order} delivery date',
                customer:
                  'Could you confirm the delivery date for order #{order}? I need to be home to sign for it.',
                agent:
                  'Order #{order} is out for delivery Wednesday between 9am and 1pm, and it does need a signature. You can reschedule from the carrier link below if that window does not work.',
              },
            ],
          },
          {
            id: 1002,
            name: 'Shipping delay',
            emoji: '🚚',
            description: 'Order is late relative to the promised delivery window.',
            scripts: [
              {
                subject: 'Order is late',
                customer:
                  'My order was supposed to arrive on Monday and it still has not shown up. This was a gift and I am running out of time.',
                agent:
                  "I'm sorry about the delay — the carrier hit a weather hold in Denver. Your parcel is moving again and is now due Friday. I've upgraded the remaining leg to express at no charge.",
              },
              {
                subject: 'Still waiting on #{order}',
                customer: 'Two weeks and no package. What is going on with order #{order}?',
                agent:
                  "That's well past our window and I'm sorry. I've opened a carrier trace on #{order} and queued a replacement so you're not waiting on the outcome.",
              },
            ],
          },
          {
            id: 1003,
            name: 'Change address',
            emoji: '📍',
            description: 'Customer wants to change the shipping address after ordering.',
            scripts: [
              {
                subject: 'Need to change my delivery address',
                customer:
                  'I just realised I used my old address on order #{order}. Can you change it before it ships?',
                agent:
                  "I've updated order #{order} to your new address — it hadn't been picked yet, so nothing is lost. You'll get a fresh confirmation email shortly.",
              },
            ],
          },
        ],
      },
      {
        id: 111,
        name: 'Payments',
        topics: [
          {
            id: 1004,
            name: 'Discount code',
            emoji: '🏷️',
            description:
              'Promo code failed to apply or the customer wants it applied after the fact.',
            scripts: [
              {
                subject: "Discount code didn't work",
                customer:
                  'I tried using WINTER20 at checkout and it said the code was invalid. I ordered anyway — can you apply it to order #{order}?',
                agent:
                  "WINTER20 expired at the end of last month, but I've applied an equivalent 20% credit to order #{order}. You'll see it back on your card in 3–5 days.",
              },
            ],
          },
          {
            id: 1005,
            name: 'Refund request',
            emoji: '💳',
            description: 'Customer asks for money back, with or without a return.',
            scripts: [
              {
                subject: 'Refund for order #{order}',
                customer:
                  "I'd like a refund for order #{order}. The jacket doesn't fit and I don't want an exchange.",
                agent:
                  "No problem at all. I've started the refund for order #{order} and emailed you a prepaid return label — the refund lands once the parcel is scanned.",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 11,
    name: 'Returns',
    color: '#6ab8a5',
    subcategories: [
      {
        id: 112,
        name: 'Returns & exchanges',
        topics: [
          {
            id: 1006,
            name: 'Return request',
            emoji: '↩️',
            description: 'Customer wants to start a return.',
            scripts: [
              {
                subject: 'How do I return this?',
                customer:
                  "The base layer I ordered isn't right for me. What do I need to do to send it back?",
                agent:
                  "Returns are free within 60 days. I've emailed you a prepaid label — drop the parcel at any post office and we'll refund you as soon as it's scanned.",
              },
            ],
          },
          {
            id: 1007,
            name: 'Exchange size',
            emoji: '🔁',
            description: 'Customer wants a different size of the same item.',
            scripts: [
              {
                subject: 'Wrong size — can I swap?',
                customer:
                  'The Ridgeline shell I got is a medium but I need a large. Can I swap rather than return?',
                agent:
                  "I've reserved a large Ridgeline shell for you and sent an exchange label. Your replacement ships as soon as the medium is scanned in.",
              },
            ],
          },
          {
            id: 1008,
            name: 'Damaged on arrival',
            emoji: '💥',
            description: 'Item arrived broken, torn or otherwise damaged.',
            scripts: [
              {
                subject: 'Item arrived damaged',
                customer:
                  'The tent poles in order #{order} were snapped in two when the box arrived. The box itself was crushed on one side.',
                agent:
                  "That should never have reached you — I'm sorry. A replacement set is going out today on express, and you don't need to return the damaged poles.",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 12,
    name: 'Product',
    color: '#b6c883',
    subcategories: [
      {
        id: 113,
        name: 'Pre-sales',
        topics: [
          {
            id: 1009,
            name: 'Sizing help',
            emoji: '📏',
            description: 'Customer asks which size to buy before ordering.',
            scripts: [
              {
                subject: 'Which size should I get?',
                customer:
                  "I'm 5'11 and about 175lb. Should I order a medium or a large in the Ridgeline shell?",
                agent:
                  "At that height and weight a medium fits close over a base layer; go large if you want room for a mid-layer. Our size chart is linked below if you'd like to measure first.",
              },
            ],
          },
          {
            id: 1010,
            name: 'Product care',
            emoji: '🧼',
            description: 'How to wash, repair or store a product.',
            scripts: [
              {
                subject: 'How do I wash the shell?',
                customer:
                  'Can I put the Ridgeline shell in the washing machine, or will that ruin the coating?',
                agent:
                  'Machine wash it warm on a gentle cycle with a technical wash — no fabric softener — then tumble dry low to reactivate the DWR coating.',
              },
            ],
          },
        ],
      },
      {
        id: 114,
        name: 'Warranty',
        topics: [
          {
            id: 1011,
            name: 'Warranty claim',
            emoji: '🛡️',
            description: 'Customer claims a defect covered by the warranty.',
            scripts: [
              {
                subject: 'Zip failed after 3 months',
                customer:
                  'The main zip on my shell has separated after about three months of light use. Is that covered?',
                agent:
                  "Zip failure inside a year is a warranty repair. Send us a photo of the zip and I'll raise the claim — repair or replacement, whichever is faster.",
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 13,
    name: 'Account',
    color: '#9885d0',
    subcategories: [
      {
        id: 115,
        name: 'Account & billing',
        topics: [
          {
            id: 1012,
            name: 'Subscription change',
            emoji: '⚙️',
            description: 'Customer wants to pause, change or cancel a recurring order.',
            scripts: [
              {
                subject: 'Pause my subscription',
                customer:
                  "I'm travelling for two months — can I pause my gear-care subscription rather than cancel it?",
                agent:
                  "I've paused your subscription for two months. Nothing will be charged until it resumes, and you can restart it any time from your account.",
              },
            ],
          },
        ],
      },
    ],
  },
]

export const ALL_TOPICS = CATEGORY_SEED.flatMap((category) =>
  category.subcategories.flatMap((sub) =>
    sub.topics.map((topic) => ({ ...topic, subCategoryId: sub.id, categoryId: category.id }))
  )
)

export function buildCategories(): Category[] {
  return CATEGORY_SEED.map((category) => ({
    id: category.id,
    name: category.name,
    color: category.color,
    related_categories: category.subcategories.map((sub) => ({
      id: sub.id,
      name: sub.name,
      cards: sub.topics.map((topic) => ({
        id: topic.id,
        name: topic.name,
        description: topic.description,
        emoji: topic.emoji,
        automatable: chance(0.4) ? 'AUTOMATABLE' : null,
      })),
    })),
  }))
}

/* -------------------------------------------------------------------------- */
/* Conversations                                                               */
/* -------------------------------------------------------------------------- */

const CUSTOMER_NAMES = [
  'Elena Fischer',
  'Tom Whitfield',
  'Aisha Karim',
  'Diego Moreno',
  'Hannah Brooks',
  'Yuki Tanaka',
  'Samuel Okonkwo',
  'Clara Bergström',
  'Ravi Shankar',
  'Megan Doyle',
  'Luca Rossi',
  'Fatima Zahra',
  'Owen Mitchell',
  'Ingrid Solberg',
  'Peter Novak',
  'Amara Nwosu',
  'Chloe Dubois',
  'Ben Hartley',
  'Sana Iqbal',
  'Niels Jansen',
] as const

const AGENT_SIGNOFFS = TEAM_PEOPLE.map((person) => person.name.split(' ')[0])

const emailFor = (name: string) =>
  `${name
    .toLowerCase()
    .replace(/[^a-z ]/g, '')
    .split(' ')
    .join('.')}@example.com`

const TICKET_COUNT = 204

let commentIdCounter = 50_000
let draftIdCounter = 70_000
let executedWorkflowIdCounter = 80_000
let exampleIdCounter = 90_000

export function buildTickets(workflows: Workflow[]): TicketPayload[] {
  const tickets: TicketPayload[] = []

  for (let index = 0; index < TICKET_COUNT; index++) {
    const topic = pick(ALL_TOPICS)
    const script = pick(topic.scripts)
    const customerName = pick(CUSTOMER_NAMES)
    const orderNumber = String(between(10_000, 99_999))
    const fill = (text: string) => text.replace(/#\{order\}/g, `#${orderNumber}`)

    const isSimulator = index < 4
    const isChat = !isSimulator && index < 16
    const sourceId = isSimulator ? SOURCE.simulator : isChat ? SOURCE.chat : SOURCE.zendesk
    const sourceSlug = SOURCE_SLUG[sourceId]

    const ageDays = isSimulator ? between(0, 3) : Number((rand() * 30).toFixed(2))
    const createdAt = daysAgo(ageDays, 20)

    /* The customer always opens. An agent replies on ~62% of conversations,
     * which is what makes the Open / Sent view split meaningful. */
    const hasAgentReply = !isSimulator && chance(0.62)
    const followUp = hasAgentReply && chance(0.3)

    const ticketId = 30_000 + index
    const comments: TicketCommentPayload[] = []

    const baseComment = (
      body: string,
      isAgent: boolean,
      offsetHours: number
    ): TicketCommentPayload => ({
      id: ++commentIdCounter,
      ticket_id: ticketId,
      source_id: sourceId,
      body,
      html_body: `<p>${body}</p>`,
      clean_body: body,
      is_customer_reply: !isAgent,
      is_agent_reply: isAgent,
      public: true,
      from_handle: isAgent ? 'support@northwindoutdoors.com' : emailFor(customerName),
      from_name: isAgent ? pick(TEAM_PEOPLE).name : customerName,
      to_handle: isAgent ? emailFor(customerName) : 'support@northwindoutdoors.com',
      to_name: isAgent ? customerName : 'Northwind Outdoors Support',
      external_created_at: iso(ageDays * DAY - offsetHours * 3_600_000),
      created_at: iso(ageDays * DAY - offsetHours * 3_600_000),
      ticket_source_slug: sourceSlug,
      bot_response_knowledge_used: [],
    })

    comments.push(baseComment(fill(script.customer), false, 0))

    if (hasAgentReply) {
      const reply = baseComment(
        `${fill(script.agent)}\n\n— ${pick(AGENT_SIGNOFFS)}`,
        true,
        between(1, 9)
      )
      reply.bot_response_knowledge_used = []
      comments.push(reply)
    }

    if (followUp) {
      comments.push(
        baseComment(
          pick([
            'Perfect, that sorts it. Thanks for the quick reply!',
            'Got it — appreciate you looking into this.',
            'That works for me. Thanks!',
          ]),
          false,
          between(10, 30)
        )
      )
    }

    const latestComment = comments[comments.length - 1]

    /* Topic detection — ~84% of eligible conversations get a topic. */
    const detected = !isSimulator && chance(0.84)
    const cards = detected
      ? [
          {
            id: topic.id,
            name: topic.name,
            emoji: topic.emoji,
            description: topic.description,
            created_at: comments[0].external_created_at,
            confidence: Number((0.62 + rand() * 0.37).toFixed(3)),
            comment_id: comments[0].id,
            feedback: chance(0.16)
              ? {
                  saved: true,
                  savedPositive: chance(0.78),
                  exampleId: ++exampleIdCounter,
                  cardId: topic.id,
                  comment: { id: comments[0].id, ticketId },
                }
              : {
                  saved: false,
                  cardId: topic.id,
                  comment: { id: comments[0].id, ticketId },
                },
          },
        ]
      : []

    /* AI drafts hang off customer comments. */
    const hasDraft = !isSimulator && detected && chance(0.55)
    const drafts = hasDraft
      ? [
          {
            id: ++draftIdCounter,
            ticket_id: ticketId,
            comment_id: comments[0].id,
            card_id: topic.id,
            task_name: 'RESPONSE',
            /* Worded differently from the sent reply on purpose — a draft is a
             * suggestion, not a copy of what the agent ended up writing. */
            llm_generation: `Hi ${customerName.split(' ')[0]},\n\n${fill(
              script.agent
            )}\n\nLet me know if anything else comes up.`,
            metadata: { model: 'aide-draft-v3', latency_ms: between(700, 2600) },
            created_at: iso(ageDays * DAY - 1_800_000),
            knowledge_used: chance(0.6)
              ? [
                  {
                    id: 2001 + (topic.id % 10),
                    title: KNOWLEDGE_SEED[topic.id % KNOWLEDGE_SEED.length].title,
                    link: KNOWLEDGE_SEED[topic.id % KNOWLEDGE_SEED.length].link,
                    knowledge_set_name: 'Help center',
                    blurb: KNOWLEDGE_SEED[topic.id % KNOWLEDGE_SEED.length].blurb,
                    relevance_score: Number((0.7 + rand() * 0.29).toFixed(3)),
                    feedback: { saved: false },
                  },
                ]
              : [],
            inserted: chance(0.42),
            feedback: chance(0.22)
              ? {
                  cachedLlmGenerationId: draftIdCounter,
                  ticketId,
                  saved: true,
                  savedGood: chance(0.8),
                  note: null,
                }
              : { cachedLlmGenerationId: draftIdCounter, ticketId, saved: false },
          },
        ]
      : []

    /* Scenario executions. */
    const runsWorkflow = !isSimulator && detected && chance(0.38)
    const workflow = runsWorkflow
      ? (workflows.find((candidate) =>
          candidate.conditions.some((condition) => condition.attachable_id === topic.id)
        ) ?? workflows[0])
      : undefined

    const executedWorkflows = workflow
      ? [
          {
            id: ++executedWorkflowIdCounter,
            name: workflow.name,
            is_active: workflow.is_active,
            priority: workflow.priority,
            delay: workflow.delay,
            apply_always: workflow.apply_always,
            applied_at: iso(ageDays * DAY - 900_000),
            comment_id: comments[0].id,
            actions: workflow.actions.map((action) => ({
              id: action.id,
              workflow_id: workflow.id,
              action_type: action.action_type,
              action_value: action.action_value,
              attachable_id: action.attachable_id,
              comment_id: comments[0].id,
            })),
            feedback: chance(0.2)
              ? {
                  saved: true,
                  savedPass: chance(0.75),
                  note: null,
                  executedWorkflowId: executedWorkflowIdCounter,
                  ticketId,
                }
              : {
                  saved: false,
                  savedPass: false,
                  executedWorkflowId: executedWorkflowIdCounter,
                  ticketId,
                },
          },
        ]
      : []

    const contextFields: ContextField[] = [
      { key: 'email', label: 'Email', value: emailFor(customerName), group: 'Customer' },
      { key: 'orders_count', label: 'Orders', value: String(between(1, 14)), group: 'Customer' },
      {
        key: 'lifetime_value',
        label: 'Lifetime value',
        value: `$${between(80, 3200).toLocaleString()}`,
        group: 'Customer',
      },
      {
        key: 'order_number',
        label: 'Latest order',
        value: `#${orderNumber}`,
        group: 'Shopify',
        url: `${ACCOUNT_WEBSITE}/admin/orders/${orderNumber}`,
      },
      {
        key: 'fulfillment_status',
        label: 'Fulfilment',
        value: pick(['Fulfilled', 'Partially fulfilled', 'Unfulfilled']),
        group: 'Shopify',
      },
      {
        key: 'account_owner',
        label: 'Account owner',
        value: pick(TEAM_PEOPLE).name,
        group: 'Salesforce',
      },
    ]

    tickets.push({
      id: ticketId,
      account_id: ACCOUNT_ID,
      source_id: sourceId,
      inbox_id: isChat || isSimulator ? null : 501,
      external_id: String(between(400_000, 999_999)),
      subject: fill(script.subject),
      status: latestComment.is_agent_reply ? pick(['open', 'pending', 'solved']) : 'open',
      channel: isChat ? 'chat' : 'email',
      tags: detected ? topic.name.toLowerCase().replace(/ /g, '_') : null,
      num_comments: comments.length,
      latest_comment_at: latestComment.external_created_at,
      latest_comment_is_agent_reply: latestComment.is_agent_reply,
      not_eligible: isSimulator,
      external_created_at: createdAt,
      created_at: createdAt,
      updated_at: latestComment.external_created_at,
      ticket_source_slug: sourceSlug,
      requester: { id: 60_000 + index, name: customerName, email: emailFor(customerName) },
      comments,
      drafts,
      cards,
      executedWorkflows,
      contextFields,
    })
  }

  return tickets.sort(
    (a, b) => new Date(b.latest_comment_at!).getTime() - new Date(a.latest_comment_at!).getTime()
  )
}

/* -------------------------------------------------------------------------- */
/* Macros                                                                      */
/* -------------------------------------------------------------------------- */

const MACRO_SEED = [
  {
    name: 'Send return label',
    description: 'Emails a prepaid return label and closes the ticket.',
  },
  {
    name: 'Escalate to warehouse',
    description: 'Tags the ticket and assigns it to the warehouse queue.',
  },
  { name: 'Apply goodwill credit', description: 'Issues a 20% store credit on the latest order.' },
  { name: 'Share size chart', description: 'Replies with the current size chart and fit notes.' },
  {
    name: 'Close thank-you',
    description: 'Marks a thank-you-only reply as solved without replying.',
  },
  {
    name: 'Request damage photo',
    description: 'Asks the customer for a photo before raising a claim.',
  },
] as const

export function buildMacros(): Macro[] {
  return MACRO_SEED.map((macro, index) => ({
    id: 400 + index,
    account_id: ACCOUNT_ID,
    user_id: 900,
    zendesk_id: 88_000 + index,
    name: macro.name,
    description: macro.description,
    run_count: between(12, 940),
    actions_count: between(1, 4),
    created_at: daysAgo(between(40, 210)),
    updated_at: daysAgo(between(0, 30)),
    actions: [
      {
        id: 4400 + index,
        account_id: ACCOUNT_ID,
        macro_id: 400 + index,
        integration_id: 2,
        option: pick(['set_status', 'add_tag', 'assign_group', 'reply']),
        value: pick(['solved', 'escalated', 'Warehouse', 'Thanks for reaching out!']),
        created_at: daysAgo(between(40, 210)),
      },
    ],
  }))
}

export const MACRO_ACTION_OPTIONS: MacroActionOption[] = [
  {
    integration_id: 2,
    integration_name: 'zendesk',
    option: 'set_status',
    label: 'Set status',
    value_type: 'select',
    choices: ['open', 'pending', 'solved', 'closed'],
  },
  {
    integration_id: 2,
    integration_name: 'zendesk',
    option: 'add_tag',
    label: 'Add tag',
    value_type: 'text',
  },
  {
    integration_id: 2,
    integration_name: 'zendesk',
    option: 'assign_group',
    label: 'Assign to group',
    value_type: 'select',
    choices: ['Tier 1', 'Warehouse', 'Returns', 'Escalations'],
  },
  {
    integration_id: 2,
    integration_name: 'zendesk',
    option: 'set_priority',
    label: 'Set priority',
    value_type: 'select',
    choices: ['low', 'normal', 'high', 'urgent'],
  },
  {
    integration_id: 1,
    integration_name: 'front',
    option: 'archive',
    label: 'Archive conversation',
    value_type: 'boolean',
  },
]

/* -------------------------------------------------------------------------- */
/* Scenarios (workflows)                                                       */
/* -------------------------------------------------------------------------- */

interface WorkflowSeed {
  id: number
  name: string
  is_active: boolean
  apply_always: boolean
  priority: string
  delay: string
  conditions: Array<{
    condition_type: Workflow['conditions'][number]['condition_type']
    operator: 'IS' | 'IS_NOT'
    value: string | null
    field_key: string | null
    attachable_id: number | null
    conjunction_index: number
    custom_field_name?: string | null
  }>
  actions: Array<{
    action_type: Workflow['actions'][number]['action_type']
    action_value: string
    attachable_id?: number | null
  }>
}

const WORKFLOW_SEED: WorkflowSeed[] = [
  {
    id: 200,
    name: 'Answer order status automatically',
    is_active: true,
    apply_always: false,
    priority: 'HIGH',
    delay: 'NONE',
    conditions: [
      {
        condition_type: 'TOP_INTENT',
        operator: 'IS',
        value: null,
        field_key: null,
        attachable_id: 1001,
        conjunction_index: 0,
      },
      {
        condition_type: 'INTENT_CONFIDENCE',
        operator: 'IS',
        value: 'HIGH',
        field_key: null,
        attachable_id: null,
        conjunction_index: 0,
      },
    ],
    actions: [
      {
        action_type: 'GENERATIVE_REPLY',
        action_value:
          'Answer with the live tracking status and the expected delivery window. Include the tracking link.',
      },
    ],
  },
  {
    id: 201,
    name: 'Escalate damaged items to the warehouse',
    is_active: true,
    apply_always: false,
    priority: 'HIGH',
    delay: 'NONE',
    conditions: [
      {
        condition_type: 'INTENT',
        operator: 'IS',
        value: null,
        field_key: null,
        attachable_id: 1008,
        conjunction_index: 0,
      },
    ],
    actions: [
      { action_type: 'ADD_TAG', action_value: 'damaged_escalation' },
      { action_type: 'MACRO', action_value: 'Escalate to warehouse', attachable_id: 401 },
    ],
  },
  {
    id: 202,
    name: 'Apologise for shipping delays',
    is_active: true,
    apply_always: false,
    priority: 'NORMAL',
    delay: 'FIVE_MINUTES',
    conditions: [
      {
        condition_type: 'TOP_INTENT',
        operator: 'IS',
        value: null,
        field_key: null,
        attachable_id: 1002,
        conjunction_index: 0,
      },
      {
        condition_type: 'TICKET_STATUS',
        operator: 'IS_NOT',
        value: 'solved',
        field_key: null,
        attachable_id: null,
        conjunction_index: 0,
      },
      {
        condition_type: 'SHOPIFY',
        operator: 'IS',
        value: 'Unfulfilled',
        field_key: 'fulfillment_status',
        attachable_id: null,
        conjunction_index: 1,
      },
    ],
    actions: [
      {
        action_type: 'GENERATIVE_REPLY',
        action_value:
          'Acknowledge the delay, give the current carrier status, and offer expedited shipping on the remaining leg.',
      },
      {
        action_type: 'PROMPT_INSTRUCTION',
        action_value: 'Never promise a delivery date the carrier has not confirmed.',
      },
    ],
  },
  {
    id: 203,
    name: 'Close thank-you messages',
    is_active: true,
    apply_always: false,
    priority: 'LOW',
    delay: 'NONE',
    conditions: [
      {
        condition_type: 'CUSTOM',
        operator: 'IS',
        value: '^(thanks|thank you|cheers)',
        field_key: 'subject_regex',
        attachable_id: null,
        conjunction_index: 0,
        custom_field_name: 'subject_regex',
      },
    ],
    actions: [{ action_type: 'CLOSE_TICKET', action_value: 'solved' }],
  },
  {
    id: 204,
    name: 'Help with failed discount codes',
    is_active: false,
    apply_always: false,
    priority: 'NORMAL',
    delay: 'NONE',
    conditions: [
      {
        condition_type: 'INTENT',
        operator: 'IS',
        value: null,
        field_key: null,
        attachable_id: 1004,
        conjunction_index: 0,
      },
    ],
    actions: [{ action_type: 'MACRO', action_value: 'Apply goodwill credit', attachable_id: 402 }],
  },
  {
    id: 205,
    name: 'Brand voice (applies to every reply)',
    is_active: true,
    apply_always: true,
    priority: 'NORMAL',
    delay: 'NONE',
    conditions: [],
    actions: [
      {
        action_type: 'PROMPT_INSTRUCTION',
        action_value:
          'Write plainly and warmly. Short sentences. No exclamation marks. Sign off with the agent first name only.',
      },
    ],
  },
]

export function buildWorkflows(): Workflow[] {
  return WORKFLOW_SEED.map((seed) => {
    const conditions = seed.conditions.map((condition, index) => ({
      id: seed.id * 10 + index,
      account_id: ACCOUNT_ID,
      workflow_id: seed.id,
      attachable_id: condition.attachable_id,
      custom_field_name: condition.custom_field_name ?? null,
      condition_type: condition.condition_type,
      operator: condition.operator,
      value: condition.value,
      field_key: condition.field_key,
      conjunction_index: condition.conjunction_index,
      created_at: daysAgo(between(20, 120)),
    }))

    const actions = seed.actions.map((action, index) => ({
      id: seed.id * 100 + index,
      account_id: ACCOUNT_ID,
      workflow_id: seed.id,
      action_type: action.action_type,
      action_value: action.action_value,
      attachable_id: action.attachable_id ?? null,
      created_at: daysAgo(between(20, 120)),
    }))

    const conjunctions: Workflow['conjunctions'] = []
    for (const condition of conditions) {
      conjunctions[condition.conjunction_index] ||= []
      conjunctions[condition.conjunction_index].push(condition)
    }

    return {
      id: seed.id,
      account_id: ACCOUNT_ID,
      is_active: seed.is_active,
      name: seed.name,
      generative_config_id: null,
      latest_coverage_estimate: between(30, 480),
      priority: seed.priority,
      delay: seed.delay,
      apply_always: seed.apply_always,
      created_at: daysAgo(between(20, 120)),
      updated_at: daysAgo(between(0, 19)),
      conditions,
      actions,
      macros: [],
      conjunctions,
      times_run: between(0, 620),
    }
  })
}

export function buildConditionOptions(): ConditionDropdownOption[] {
  const topicOptions: ConditionDropdownOption[] = ALL_TOPICS.flatMap((topic) => [
    {
      condition_type: 'INTENT' as const,
      field_key: null,
      value: null,
      meta: { id: topic.id, name: topic.name, emoji: topic.emoji },
      attachable_id: topic.id,
    },
    {
      condition_type: 'TOP_INTENT' as const,
      field_key: null,
      value: null,
      meta: { id: topic.id, name: topic.name, emoji: topic.emoji },
      attachable_id: topic.id,
    },
  ])

  const confidenceOptions: ConditionDropdownOption[] = ['LOW', 'MEDIUM', 'HIGH'].map((value) => ({
    condition_type: 'INTENT_CONFIDENCE' as const,
    field_key: null,
    value,
  }))

  const statusOptions: ConditionDropdownOption[] = ['open', 'pending', 'solved', 'closed'].map(
    (value) => ({ condition_type: 'TICKET_STATUS' as const, field_key: 'status', value })
  )

  const tagOptions: ConditionDropdownOption[] = [
    'vip',
    'wholesale',
    'damaged_escalation',
    'repeat_contact',
  ].map((value) => ({
    condition_type: 'TICKET_TAG' as const,
    field_key: 'tags',
    value,
    count: between(10, 300),
  }))

  const shopifyOptions: ConditionDropdownOption[] = [
    'Fulfilled',
    'Partially fulfilled',
    'Unfulfilled',
  ].map((value) => ({
    condition_type: 'SHOPIFY' as const,
    field_key: 'fulfillment_status',
    value,
    count: between(20, 400),
  }))

  const inboxOptions: ConditionDropdownOption[] = ['Support', 'Orders', 'Wholesale'].map(
    (value) => ({
      condition_type: 'INBOX' as const,
      field_key: 'inbox',
      value,
    })
  )

  const firstMessage: ConditionDropdownOption[] = [
    { condition_type: 'IS_FIRST_MESSAGE', field_key: null, value: 'true' },
  ]

  return [
    ...topicOptions,
    ...confidenceOptions,
    ...statusOptions,
    ...tagOptions,
    ...shopifyOptions,
    ...inboxOptions,
    ...firstMessage,
  ]
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    slug: 'order-status-autoreply',
    name: 'Answer "where is my order"',
    description: 'Replies with live tracking whenever order status is the top topic.',
    conditions: [{ condition_type: 'TOP_INTENT', operator: 'IS', conjunction_index: 0 }],
    actions: [
      { action_type: 'GENERATIVE_REPLY', action_value: 'Answer with live tracking status.' },
    ],
  },
  {
    slug: 'close-thank-you',
    name: 'Close thank-you replies',
    description: 'Marks thank-you-only messages as solved so they never reach an agent.',
    conditions: [{ condition_type: 'CUSTOM', operator: 'IS', field_key: 'subject_regex' }],
    actions: [{ action_type: 'CLOSE_TICKET', action_value: 'solved' }],
  },
  {
    slug: 'vip-priority',
    name: 'Prioritise VIP customers',
    description: 'Raises priority and routes VIP-tagged conversations to a senior queue.',
    conditions: [{ condition_type: 'TICKET_TAG', operator: 'IS', value: 'vip' }],
    actions: [{ action_type: 'ASSIGN', action_value: 'Escalations' }],
  },
]

export const COLLECTABLE_FIELDS: CollectableField[] = [
  {
    id: 700,
    account_id: ACCOUNT_ID,
    name: 'Order number',
    field_key: 'order_number',
    description: 'The order the customer is asking about.',
    created_at: daysAgo(90),
  },
  {
    id: 701,
    account_id: ACCOUNT_ID,
    name: 'Preferred size',
    field_key: 'preferred_size',
    description: 'Size the customer wants in an exchange.',
    created_at: daysAgo(70),
  },
]

/* -------------------------------------------------------------------------- */
/* Knowledge                                                                   */
/* -------------------------------------------------------------------------- */

interface KnowledgeSeed {
  title: string
  link: string
  source: string
  blurb: string
  body: string
}

export const KNOWLEDGE_SEED: KnowledgeSeed[] = [
  {
    title: 'Shipping times and carriers',
    link: 'https://help.northwindoutdoors.com/articles/shipping-times',
    source: 'Help center',
    blurb: 'Standard delivery is 3–5 business days; express is next business day before 10am.',
    body: '<h2>Shipping times</h2><p>Standard delivery takes 3–5 business days within the continental US. Express delivery arrives the next business day when ordered before 2pm local time.</p><p>We ship with UPS and USPS. Tracking is emailed as soon as the parcel is picked, which can be a few hours after the order confirmation.</p><h3>International</h3><p>International orders take 7–14 business days and may be held by customs. Duties are calculated at checkout and paid up front.</p>',
  },
  {
    title: 'Return and exchange policy',
    link: 'https://help.northwindoutdoors.com/articles/returns',
    source: 'Help center',
    blurb: 'Free returns within 60 days on unworn items with tags attached.',
    body: '<h2>Returns</h2><p>Return anything unworn within 60 days for a full refund. Returns are free in the US — we email a prepaid label as soon as you start the return.</p><p>Refunds are issued once the parcel is scanned by the carrier, and take 3–5 business days to appear on the original payment method.</p><h3>Exchanges</h3><p>Exchanges reserve your replacement immediately, so the new size ships before we receive the original.</p>',
  },
  {
    title: 'Warranty coverage',
    link: 'https://help.northwindoutdoors.com/articles/warranty',
    source: 'Help center',
    blurb: 'Manufacturing defects are covered for the lifetime of the product.',
    body: '<h2>Warranty</h2><p>Every Northwind product is covered against manufacturing defects for its usable lifetime. That includes seam failure, zip separation, and delamination.</p><p>Wear and tear, accidental damage, and improper care are not covered — but we repair those at cost.</p><p>Send a photo of the issue with your order number and we will raise the claim within one business day.</p>',
  },
  {
    title: 'How to wash technical outerwear',
    link: 'https://help.northwindoutdoors.com/articles/washing-outerwear',
    source: 'Help center',
    blurb: 'Machine wash warm on gentle with a technical wash, then tumble dry low.',
    body: '<h2>Washing your shell</h2><p>Use a technical wash such as Nikwax Tech Wash. Never use fabric softener — it clogs the membrane and kills breathability.</p><ol><li>Zip all zips and close the storm flap.</li><li>Wash warm on a gentle cycle.</li><li>Tumble dry on low for 20 minutes to reactivate the DWR.</li></ol>',
  },
  {
    title: 'Sizing and fit guide',
    link: 'https://help.northwindoutdoors.com/articles/sizing',
    source: 'Help center',
    blurb: 'Shells are cut close; size up if you layer a mid-weight fleece underneath.',
    body: '<h2>Fit</h2><p>Our shells are cut close to the body so they layer under a pack without bunching. If you regularly wear a mid-weight fleece underneath, size up.</p><table><tr><th>Size</th><th>Chest</th><th>Height</th></tr><tr><td>S</td><td>36–38"</td><td>5\'6"–5\'9"</td></tr><tr><td>M</td><td>39–41"</td><td>5\'9"–6\'0"</td></tr><tr><td>L</td><td>42–44"</td><td>6\'0"–6\'3"</td></tr></table>',
  },
  {
    title: 'Changing a shipping address after ordering',
    link: 'https://help.northwindoutdoors.com/articles/change-address',
    source: 'Help center',
    blurb: 'Addresses can be changed until the order is picked, usually within 2 hours.',
    body: '<h2>Changing your address</h2><p>We can change the delivery address until the order is picked in the warehouse — normally about two hours after you order.</p><p>After that the parcel has to be intercepted with the carrier, which adds a day and sometimes a fee.</p>',
  },
  {
    title: 'Discount codes and promotions',
    link: 'https://northwindoutdoors.com/pages/promotions',
    source: 'Website',
    blurb: 'One code per order; codes cannot be stacked or applied retroactively by customers.',
    body: '<h2>Discount codes</h2><p>Only one code applies per order and codes cannot be stacked with sale pricing.</p><p>Support can apply an equivalent credit after the fact when a valid code failed at checkout.</p>',
  },
  {
    title: 'Gear-care subscription',
    link: 'https://northwindoutdoors.com/pages/gear-care',
    source: 'Website',
    blurb: 'Quarterly re-proofing kit; pause or cancel any time from the account page.',
    body: '<h2>Gear care subscription</h2><p>A re-proofing kit ships every quarter for $24. Pause it for up to six months or cancel outright from your account page — no phone call needed.</p>',
  },
  {
    title: 'Damaged on arrival — what we do',
    link: '',
    source: 'Written by the team',
    blurb: 'Replacement ships same day; the damaged item never needs to come back.',
    body: '<h2>Damaged deliveries</h2><p>If an item arrives damaged we ship a replacement the same day on express. The customer never has to return the damaged item — we file the carrier claim ourselves.</p><p>Ask for one photo of the item and one of the outer box before raising the claim.</p>',
  },
  {
    title: 'Escalation ladder',
    link: '',
    source: 'Written by the team',
    blurb: 'Tier 1 → Warehouse → Escalations. Anything over $500 goes straight to Escalations.',
    body: '<h2>Escalation ladder</h2><p>Start at Tier 1. Fulfilment problems go to the Warehouse queue. Anything involving more than $500, a safety issue, or a second complaint from the same customer goes straight to Escalations.</p>',
  },
]

export function buildKnowledgeDocuments(): KnowledgeDocument[] {
  return KNOWLEDGE_SEED.map((doc, index) => ({
    id: 2001 + index,
    account_id: ACCOUNT_ID,
    link: doc.link || null,
    title: doc.title,
    knowledge_set_name: doc.source,
    help_center_id: doc.source === 'Help center' ? 30 : null,
    knowledge_website_id: doc.source === 'Website' ? 12 : null,
    document: doc.body,
    created_at: daysAgo(between(5, 120)),
    updated_at: daysAgo(between(0, 20)),
    external_created_at: doc.source === 'Help center' ? daysAgo(between(120, 400)) : null,
  }))
}

const ENTITY_SEED = [
  {
    slug: 'business-hours',
    entity: {
      label: 'Business hours',
      value: 'Mon–Fri 8am–6pm PT, Sat 9am–2pm PT. Closed Sundays and US public holidays.',
    },
  },
  {
    slug: 'return-window',
    entity: { label: 'Return window', value: '60 days from delivery, unworn with tags attached.' },
  },
  {
    slug: 'shipping-cutoff',
    entity: { label: 'Same-day shipping cutoff', value: '2pm PT on business days.' },
  },
  {
    slug: 'support-email',
    entity: { label: 'Support email', value: 'support@northwindoutdoors.com' },
  },
  {
    slug: 'warehouse-location',
    entity: { label: 'Warehouse', value: 'Reno, Nevada — all US orders ship from here.' },
  },
  {
    slug: 'price-match',
    entity: {
      label: 'Price match',
      value:
        'We match authorised retailers within 14 days of purchase. Marketplace sellers are excluded.',
    },
  },
]

export function buildKnowledgeEntities(): KnowledgeEntity[] {
  return ENTITY_SEED.map((entity, index) => ({
    id: 3001 + index,
    account_id: ACCOUNT_ID,
    slug: entity.slug,
    entity: entity.entity,
    extracted_source_url: index < 3 ? `${ACCOUNT_WEBSITE}/pages/faq` : null,
    note: null,
    sync_frequency: index < 3 ? 'weekly' : null,
    created_at: daysAgo(index < 3 ? 2 : between(30, 90)),
    updated_at: daysAgo(between(0, 10)),
  }))
}

/* -------------------------------------------------------------------------- */
/* Integrations                                                                */
/* -------------------------------------------------------------------------- */

export function buildActiveIntegrations() {
  return [
    {
      id: 501,
      name: 'zendesk',
      uuid: 'b7f3c1a9-4e2d-4f8a-9c11-1d2e3f4a5b6c',
      subdomain: 'northwindoutdoors',
      created_at: daysAgo(174),
      meta_data: { subdomain: 'northwindoutdoors' },
    },
    {
      id: 502,
      name: 'shopify',
      uuid: 'c2e4d6f8-1a3b-4c5d-8e9f-0a1b2c3d4e5f',
      shops: ['northwind-outdoors.myshopify.com'],
      created_at: daysAgo(168),
      meta_data: { shop: 'northwind-outdoors.myshopify.com' },
    },
    {
      id: 503,
      name: 'salesforce',
      uuid: 'd9a8b7c6-5d4e-4f3a-2b1c-0d9e8f7a6b5c',
      created_at: daysAgo(41),
      meta_data: { domain: 'northwind' },
    },
  ]
}

export function buildFrontInboxes(): FrontInbox[] {
  return ['Support', 'Orders', 'Wholesale', 'Press'].map((name, index) => ({
    id: 601 + index,
    account_id: ACCOUNT_ID,
    external_id: `inb_${1000 + index}`,
    name,
    is_enabled: index < 2,
    is_pulled: index < 2,
    created_at: daysAgo(174),
  }))
}

/* -------------------------------------------------------------------------- */
/* The signed-in user                                                          */
/* -------------------------------------------------------------------------- */

export function buildMe(overrides: Partial<Me['team']> = {}): Me {
  const knowledgeDocuments = buildKnowledgeDocuments()
  const entities = buildKnowledgeEntities()

  return {
    id: 900,
    name: TEAM_PEOPLE[0].name,
    initials: initialsOf(TEAM_PEOPLE[0].name),
    job_title: 'Head of Support',
    email: TEAM_PEOPLE[0].email,
    phone_number: null,
    responses_per_page: 3,
    signature: '— Athar, Northwind Outdoors',
    shortcut_trigger: '/',
    show_snippet_preview: true,
    widget_settings: {
      settings: [
        { name: 'intent_feedback', active: true },
        { name: 'ai_response', active: true },
        { name: 'draft_feedback', active: true },
        { name: 'macros', active: false },
      ],
    },
    email_preferences: {
      weekly_summary: true,
      onboarding_sequences: true,
      event_based: true,
      marketing: false,
      event_invitations: true,
    },
    created_at: daysAgo(180),
    updated_at: daysAgo(1),
    widget_token: btoa(JSON.stringify({ message: 'demo-widget-token' })),
    fp_referred: false,
    team: {
      id: ACCOUNT_ID,
      name: ACCOUNT_NAME,
      website: ACCOUNT_WEBSITE,
      is_active: true,
      is_approved: true,
      is_quick_search_enabled: true,
      show_onboarding: false,
      onboarding_stage: 3,
      use_website_data: true,
      zendesk_subdomain: 'northwindoutdoors',
      onboarding_intent_slugs: ['zendesk', 'shopify', 'agent_assist', 'auto_reply'],
      has_any_front_inbox_enabled: false,
      has_a_bot: false,
      has_tickets: true,
      latest_ticket: { id: 30_000, subject: 'Where is my order?' },
      has_helpdesk_non_chat_tickets: true,
      chat_tickets: [{ id: 30_004 }, { id: 30_005 }],
      simulator_tickets: [{ id: 30_000 }, { id: 30_001 }],
      widget_views: [],
      widget_drafts: [],
      has_widget_usage: true,
      activation_tickets: [
        { id: 30_002, source_id: SOURCE.zendesk, external_id: '482913', subject: 'Order is late' },
      ],
      has_acted_upon_activation: true,
      has_knowledge: true,
      knowledge_documents: knowledgeDocuments,
      has_topics: true,
      flat_topics: ALL_TOPICS.map((topic) => ({
        id: topic.id,
        name: topic.name,
        emoji: topic.emoji,
      })),
      has_workflows: true,
      workflows: [],
      has_global_instruction_workflow: true,
      dismissed_onboarding_action_slugs: [],
      explore_status: 'READY',
      num_users: TEAM_PEOPLE.length,
      ticket_fields: { status: ['open', 'pending', 'solved', 'closed'] },
      user_fields: { plan: ['standard', 'pro', 'wholesale'] },
      business_information: {
        recently_imported: true,
        entities: entities.map((entity) => ({
          id: entity.id,
          slug: entity.slug,
          entity: entity.entity,
          created_at: entity.created_at,
          updated_at: entity.updated_at,
          extracted_source_url: entity.extracted_source_url,
          note: entity.note,
          sync_frequency: entity.sync_frequency,
        })),
      },
      latest_knowledge_website: {
        import_status: 'imported_recently',
        url: ACCOUNT_WEBSITE,
      },
      team_size: '11-50',
      tickets_per_month: '1000-5000',
      suggested_questions: [
        'Where is my order?',
        'How do I return something?',
        'What size should I buy?',
      ],
      billing_status: {
        provisioned: true,
        is_enterprise: false,
        provisioned_by: 'trial',
        free_trial_remaining_days: 9,
        invoices: [
          { amount_due: 24_900, amount_paid: 24_900, created_at: NOW - 30 * DAY, succeeded: true },
          { amount_due: 24_900, amount_paid: 24_900, created_at: NOW - 60 * DAY, succeeded: true },
        ],
        latest_invoice_failed: false,
        latest_invoice_price_id: 'price_pro_monthly',
        stripe_customer_id: 'cus_QdemoNorthwind',
      },
      activeIntegrations: buildActiveIntegrations(),
      ...overrides,
    } as Me['team'],
  }
}

/* -------------------------------------------------------------------------- */
/* Agents — PROVISIONAL, no backend exists yet                                 */
/* -------------------------------------------------------------------------- */

export function buildAgents(): Agent[] {
  return [
    {
      id: 1,
      account_id: ACCOUNT_ID,
      name: 'Northwind Concierge',
      description: 'Front-line agent for order, shipping and returns questions on the website.',
      instructions:
        "You are Northwind Outdoors' support agent. Answer from the help centre and order data only. If the customer asks about a warranty claim or a damaged item, hand off to a human immediately. Never invent a delivery date.",
      tone: 'friendly',
      status: 'deployed',
      use_knowledge: true,
      workflow_ids: [200, 202, 205],
      channels: [
        { slug: 'website', enabled: true, config: { embed_id: 'nw_a1b2c3d4' } },
        { slug: 'helpdesk', enabled: true, config: { provider: 'zendesk' } },
        { slug: 'email', enabled: false, config: { address: 'hello@northwindoutdoors.com' } },
      ],
      last_active_at: iso(9 * 60_000),
      interactions_7d: [128, 164, 149, 203, 188, 96, 74],
      created_at: daysAgo(48),
      updated_at: daysAgo(2),
    },
    {
      id: 2,
      account_id: ACCOUNT_ID,
      name: 'Wholesale desk',
      description: 'Handles bulk pricing and stock questions from retail partners.',
      instructions:
        'Answer wholesale partner questions about MOQs, lead times and tier pricing. Escalate anything about contracts or payment terms to the Escalations queue.',
      tone: 'formal',
      status: 'draft',
      use_knowledge: true,
      workflow_ids: [],
      channels: [
        { slug: 'website', enabled: false, config: { embed_id: 'nw_e5f6g7h8' } },
        { slug: 'helpdesk', enabled: false, config: { provider: 'zendesk' } },
        { slug: 'email', enabled: false, config: { address: 'wholesale@northwindoutdoors.com' } },
      ],
      last_active_at: null,
      interactions_7d: [0, 0, 0, 0, 0, 0, 0],
      created_at: daysAgo(6),
      updated_at: daysAgo(1),
    },
  ]
}

export function buildAgentActivity(agentId: number): AgentActivityRow[] {
  if (agentId !== 1) return []
  const subjects = [
    'Where is my order?',
    'Return label please',
    'Do you ship to Canada?',
    'Sizing for the Ridgeline shell',
    'Change my delivery address',
    'Discount code was rejected',
    'When will the Alpine pack restock?',
    'Cancel my order',
  ]
  return subjects.map((subject, index) => ({
    id: 5001 + index,
    ticket_id: 30_000 + index,
    channel: index % 3 === 0 ? 'helpdesk' : 'website',
    subject,
    outcome: index % 4 === 0 ? 'handed_off' : index % 7 === 0 ? 'no_answer' : 'resolved',
    messages: between(2, 9),
    created_at: iso(index * 3_600_000 + between(0, 40) * 60_000),
  }))
}

/** Canned playground replies, keyed loosely by what the tester types. */
export const AGENT_PLAYGROUND_REPLIES: Array<{
  match: RegExp
  reply: string
  knowledge: number[]
}> = [
  {
    match: /order|track|ship|deliver|where/i,
    reply:
      "I can help with that. Standard delivery runs 3–5 business days and tracking is emailed as soon as the parcel is picked. If you share your order number I'll pull up the live status.",
    knowledge: [0],
  },
  {
    match: /return|refund|exchange|send back/i,
    reply:
      "Returns are free within 60 days on unworn items with tags attached. I'll email you a prepaid label — the refund goes through as soon as the carrier scans the parcel.",
    knowledge: [1],
  },
  {
    match: /size|fit|large|medium|small/i,
    reply:
      'Our shells are cut close so they layer under a pack. If you wear a mid-weight fleece underneath, size up one. Happy to check a specific measurement against the chart.',
    knowledge: [4],
  },
  {
    match: /wash|clean|care|dry/i,
    reply:
      'Machine wash warm on a gentle cycle with a technical wash — no fabric softener — then tumble dry low for 20 minutes to reactivate the water repellency.',
    knowledge: [3],
  },
  {
    match: /broken|damaged|torn|snapped|defect/i,
    reply:
      "I'm sorry that arrived damaged. I'm handing this to a teammate now so they can get a replacement out today — you won't need to return the damaged item.",
    knowledge: [8],
  },
]

export const AGENT_FALLBACK_REPLY =
  "I don't have anything in the help centre that covers that yet, so I'll pass it to a teammate rather than guess. They'll pick it up shortly."
