import type { ConditionDropdownOption, ConditionOptionMeta } from '@/types/api'

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
