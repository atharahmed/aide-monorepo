import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ContextPanel } from './context-panel'
import type { AccountField, Ticket } from '@/types/api'

/**
 * The simulator's right-hand panel, carried over from the v5 dashboard.
 *
 * Before the first message it offers the account's helpdesk fields as inputs,
 * so you can set the context a conversation would arrive with — a plan tier, an
 * order number — and see how scenarios keyed on those fields behave. Once a
 * conversation exists the panel switches to showing what Aide actually resolved
 * for it, the same view the conversations page uses.
 */

/**
 * Fields the helpdesk populates itself. v5 filtered these out of the simulator
 * because setting them by hand means nothing.
 */
const BUILT_IN_FIELD_TYPES = new Set([
  'subject',
  'description',
  'status',
  'tickettype',
  'priority',
  'group',
  'assignee',
])

export function simulatableFields(
  ticketFields: AccountField[] = [],
  userFields: AccountField[] = []
): AccountField[] {
  return [
    ...ticketFields.filter((field) => !BUILT_IN_FIELD_TYPES.has(field.type ?? '')),
    ...userFields,
  ]
}

/** Shapes the entered values into what `POST /v1/simulator` expects. */
export function encodeContextFields(
  fields: AccountField[],
  values: Record<string, string>
): string | undefined {
  const filled = fields
    .filter((field) => values[field.fieldKey])
    .map((field) => ({
      fieldKey: field.fieldKey,
      key: field.key,
      value: values[field.fieldKey],
    }))

  return filled.length > 0 ? JSON.stringify(filled) : undefined
}

export function SimulatorContext({
  ticket,
  fields,
  values,
  onChange,
}: {
  ticket?: Ticket
  fields: AccountField[]
  values: Record<string, string>
  onChange: (fieldKey: string, value: string) => void
}) {
  if (ticket) {
    return ticket.contextFields.length > 0 ? (
      <ContextPanel fields={ticket.contextFields} />
    ) : (
      <p className="text-[12px] leading-relaxed text-gray-400">
        Nothing was resolved for this conversation. Context appears here once a connected
        integration recognises the customer.
      </p>
    )
  }

  if (fields.length === 0) {
    return (
      <>      
      <p className="text-[12px] leading-relaxed text-gray-400">
        No fields to set. Connect Zendesk to simulate conversations that carry custom
        ticket and customer fields.
      </p>
      </>
    )
  }

  return (
    <div className="flex flex-col gap-3.5">
      <p className="text-[12px] leading-relaxed text-gray-500">
        Set context for this conversation to start with (optional):
      </p>

      {fields.map((field) => {
        const id = `simulator-field-${field.fieldKey}`
        const options = field.multiSelectOptions ?? []

        return (
          <div key={field.fieldKey}>
            <Label htmlFor={id} className="text-[12px]">
              {field.displayName}
            </Label>

            {options.length > 0 ? (
              <Select
                value={values[field.fieldKey] ?? ''}
                onValueChange={(value) => onChange(field.fieldKey, value)}
              >
                <SelectTrigger id={id} className="mt-1.5 h-8 w-full">
                  <SelectValue placeholder="Any" />
                </SelectTrigger>
                <SelectContent>
                  {options.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                id={id}
                value={values[field.fieldKey] ?? ''}
                onChange={(event) => onChange(field.fieldKey, event.target.value)}
                placeholder="Any"
                className="mt-1.5 h-8"
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
