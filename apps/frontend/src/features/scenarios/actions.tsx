import {
  CircleCheck,
  FileCog,
  Send,
  SendHorizontal,
  Tag,
  TextCursorInput,
  UserRound,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { KnownWorkflowActionType, WorkflowAction, WorkflowActionType } from '@/types/api'

interface ActionMeta {
  label: string
  Icon: LucideIcon
  className: string
}

export const ACTION_META: Record<KnownWorkflowActionType, ActionMeta> = {
  GENERATE_REPLY: { label: 'Write a reply', Icon: Send, className: 'text-info-600' },
  REPLY: { label: 'Send a reply', Icon: Send, className: 'text-warning-600' },
  PREGENERATE_REPLY: {
    label: 'Pre-write a reply',
    Icon: SendHorizontal,
    className: 'text-info-600',
  },
  SUGGEST_REPLY: { label: 'Suggest a reply', Icon: SendHorizontal, className: 'text-success-600' },
  APPLY_MACRO: { label: 'Run a macro', Icon: Zap, className: 'text-warning-600' },
  MACRO: { label: 'Run a macro', Icon: Zap, className: 'text-warning-600' },
  SUGGEST_MACRO: { label: 'Suggest a macro', Icon: Zap, className: 'text-success-600' },
  PROMPT_INSTRUCTION: { label: 'Add an instruction', Icon: FileCog, className: 'text-gray-400' },
  COLLECT_FIELD: { label: 'Collect a field', Icon: TextCursorInput, className: 'text-gray-400' },
  ADD_TAG: { label: 'Add a tag', Icon: Tag, className: 'text-gray-400' },
  ASSIGN: { label: 'Assign to a group', Icon: UserRound, className: 'text-gray-400' },
  CLOSE_TICKET: { label: 'Close the conversation', Icon: CircleCheck, className: 'text-gray-400' },
}

const ACTION_ORDER = Object.keys(ACTION_META) as KnownWorkflowActionType[]

function isKnownActionType(type: WorkflowActionType): type is KnownWorkflowActionType {
  return type in ACTION_META
}

export function actionMeta(type: WorkflowActionType): ActionMeta | undefined {
  return isKnownActionType(type) ? ACTION_META[type] : undefined
}

export function actionLabel(type: WorkflowActionType): string {
  return actionMeta(type)?.label ?? type
}

export function actionTypesOf(actions: WorkflowAction[]): KnownWorkflowActionType[] {
  const present = new Set(actions.map((action) => action.action_type))
  return ACTION_ORDER.filter((type) => present.has(type))
}

export function ActionIcon({
  type,
  muted = false,
  className,
}: {
  type: WorkflowActionType
  muted?: boolean
  className?: string
}) {
  const meta = actionMeta(type)
  if (!meta) return null
  const Icon = meta.Icon
  return (
    <Icon
      className={cn('size-3.5 shrink-0', muted ? 'text-gray-300' : meta.className, className)}
      fill="currentColor"
      fillOpacity={0.12}
    />
  )
}
