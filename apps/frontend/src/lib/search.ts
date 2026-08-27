/**
 * Search-parameter coercion.
 *
 * The router is configured with `stringifySearchWith(JSON.stringify)` and no
 * parser, so string values reach the URL verbatim. That is what keeps an id out
 * of quotes: with the default serializer a string that happens to look like
 * JSON gets re-encoded, turning `?ticket=31648257` into `?ticket=%2231648257%22`.
 *
 * The cost is asymmetry — reading back, `JSON.parse` turns `31648257` into a
 * number. Every parameter therefore declares what it wants rather than trusting
 * the parsed type, which is what these helpers are for.
 */

import type { Id } from '@/types/api'

/** A non-empty string, accepting the number a numeric-looking value parses to. */
export function searchString(value: unknown): string | undefined {
  if (typeof value === 'string') return value.length > 0 ? value : undefined
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return undefined
}

/**
 * A record id. Same coercion as `searchString`, named separately so call sites
 * read as what they are and so ids keep their `Id` type.
 */
export const searchId = (value: unknown): Id | undefined => searchString(value)

export function searchNumber(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}
