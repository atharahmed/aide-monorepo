import {
  BarChart,
  BellDot,
  Clock,
  Globe,
  Headset,
  Inbox,
  Package,
  Printer,
  Tag,
  Truck,
  User,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'
import type {
  AccountField,
  ConditionDropdownOption,
  ConditionOptionMeta,
  WorkflowCondition,
  WorkflowConditionOperator,
  WorkflowConditionType,
} from '@/types/api'

/**
 * `meta` arrives in two shapes. Topic, inbox and custom-field options send an
 * object; the INTEGRATION (Source) options send a bare display string —
 * `meta: 'Front'` — so reading `.name` off them yields `undefined`. This
 * normalises both into the object form.
 */
export function conditionMeta(
  option: ConditionDropdownOption | undefined
): Exclude<ConditionOptionMeta, string> | null {
  const meta = option?.meta
  if (!meta) return null
  return typeof meta === 'string' ? { name: meta } : meta
}

/**
 * Options carry `field_key` as `null` or leave it off entirely depending on the
 * condition; a saved condition always has `null`. Collapsing both to `''` lets
 * one key identify an option and the condition that was built from it.
 */
export const conditionKey = (source: {
  condition_type: WorkflowConditionType
  field_key?: string | null
}) => `${source.condition_type}|${source.field_key ?? ''}`

/** What a condition's key reads as: "highest topic", "ticket › status". */
export function conditionKeyLabel(
  option: ConditionDropdownOption,
  ticketFields: AccountField[]
): string {
  const meta = conditionMeta(option)
  switch (option.condition_type) {
    case 'INTENT':
      return 'topic'
    case 'TOP_INTENT':
      return 'highest topic'
    case 'PRIORITY_INTENT':
      return 'priority topic'
    case 'INTENT_CONFIDENCE':
      return 'topic confidence'
    case 'IS_FIRST_MESSAGE':
      return 'is first message'
    case 'TICKET_STATUS':
      return 'ticket › status'
    case 'TICKET_TAG':
      return 'ticket tag'
    case 'TICKET_FIELD': {
      const field = ticketFields.find((candidate) => candidate.fieldKey === option.field_key)
      return `ticket › ${field?.displayName || option.field_key || ''}`
    }
    case 'INBOX':
      return 'inbox'
    case 'INTEGRATION':
      return 'integration'
    case 'USER_FIELD':
      return `user › ${option.field_key ?? ''}`
    case 'CONTACT_FIELD':
      return meta?.name || option.field_key || ''
    case 'SHOPIFY':
      return meta?.name || option.field_key || ''
    case 'CUSTOM':
      return meta?.name || option.custom_field_name || ''
    default:
      return ''
  }
}

/** Shopify keys are told apart by `meta.name`, so their marks hang off it. */
const SHOPIFY_KEY_ICONS: Record<string, LucideIcon[]> = {
  'order exists': [Package],
  'tracking exists': [Printer],
  'order tag': [Package, Tag],
  'order created': [Package, Clock],
  'tracking begun': [Printer, Clock],
  'tracking last updated': [Truck, Clock],
  'destination country': [Globe],
  'shipment status': [Truck],
  'tracking company': [Warehouse],
}

const CONDITION_KEY_ICONS: Partial<Record<WorkflowConditionType, LucideIcon[]>> = {
  INTENT: [Tag],
  TOP_INTENT: [Tag],
  PRIORITY_INTENT: [Tag],
  INTENT_CONFIDENCE: [BarChart],
  TICKET_STATUS: [Headset, BellDot],
  TICKET_TAG: [Headset, Tag],
  INBOX: [Inbox],
  USER_FIELD: [User],
  CONTACT_FIELD: [User],
}

export const conditionKeyIcons = (option: ConditionDropdownOption): LucideIcon[] =>
  option.condition_type === 'SHOPIFY'
    ? (SHOPIFY_KEY_ICONS[conditionMeta(option)?.name ?? ''] ?? [])
    : (CONDITION_KEY_ICONS[option.condition_type] ?? [])

/** What a value option reads as in the trigger and in type-ahead. */
export const conditionValueText = (option: ConditionDropdownOption): string => {
  const meta = conditionMeta(option)
  if (
    ['INTENT', 'TOP_INTENT', 'PRIORITY_INTENT', 'INBOX', 'INTEGRATION'].includes(
      option.condition_type
    )
  ) {
    return meta?.name ?? option.value ?? ''
  }
  return option.value ?? ''
}

export const conditionValueKey = (option: ConditionDropdownOption): string =>
  option.attachable_id ? String(option.attachable_id) : (option.value ?? '')

const OPERATOR_LABELS: Record<WorkflowConditionOperator, string> = {
  IS: 'is',
  IS_NOT: 'is not',
}

/**
 * Splits a saved condition into key, operator and value. Topic conditions store
 * the topic in `attachable_id`, so the value is resolved through the options.
 */
export function describeCondition(
  condition: WorkflowCondition,
  options: ConditionDropdownOption[],
  ticketFields: AccountField[] = []
): {
  label: string
  operator: string
  value: string
  icons: LucideIcon[]
  emoji?: string | null
} {
  const key = conditionKey(condition)
  const forKey = options.filter((option) => conditionKey(option) === key)

  const match = forKey.find(
    (option) =>
      (option.value != null && option.value === condition.value) ||
      (option.attachable_id != null &&
        condition.attachable_id != null &&
        String(option.attachable_id) === String(condition.attachable_id))
  )

  const label =
    (forKey[0] && conditionKeyLabel(forKey[0], ticketFields)) ||
    conditionKeyLabel(
      {
        condition_type: condition.condition_type,
        field_key: condition.field_key,
        custom_field_name: condition.custom_field_name,
      } as ConditionDropdownOption,
      ticketFields
    ) ||
    condition.condition_type

  return {
    label,
    icons: forKey[0] ? conditionKeyIcons(forKey[0]) : [],
    operator: OPERATOR_LABELS[condition.operator] ?? condition.operator,
    value: (match && conditionValueText(match)) || condition.value || '',
    emoji: match ? conditionMeta(match)?.emoji : undefined,
  }
}
