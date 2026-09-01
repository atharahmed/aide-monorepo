import {
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
  differenceInMonths,
  differenceInWeeks,
  differenceInYears,
  format,
  formatDistanceToNowStrict,
} from 'date-fns'

/** Compact age for dense lists: "now", "12m", "4h", "1d", "2w", "2mo", "1y". */
export function formatCompactAgo(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'

  const now = new Date()
  if (date > now) return 'now'

  const years = differenceInYears(now, date)
  if (years >= 1) return `${years}y`
  const months = differenceInMonths(now, date)
  if (months >= 1) return `${months}mo`
  const weeks = differenceInWeeks(now, date)
  if (weeks >= 1) return `${weeks}w`
  const days = differenceInDays(now, date)
  if (days >= 1) return `${days}d`
  const hours = differenceInHours(now, date)
  if (hours >= 1) return `${hours}h`
  const minutes = differenceInMinutes(now, date)
  if (minutes >= 1) return `${minutes}m`
  return 'now'
}

export function formatRelative(value: string | null | undefined): string {
  if (!value) return 'never'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'never'
  return `${formatDistanceToNowStrict(date)} ago`
}

export function formatFullDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return format(date, "d MMM yyyy 'at' HH:mm")
}

export function formatDay(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '—'
  return format(date, 'd MMM yyyy')
}

/**
 * Coerces an API number to a real number. Postgres hands `bigint` columns and
 * `COUNT`/`SUM` aggregates to JSON as strings, so almost every count arriving
 * from the API is `"98"` rather than `98`.
 */
export function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
const standard = new Intl.NumberFormat('en')

export function formatCount(value: string | number | null | undefined) {
  const count = toNumber(value)
  return count >= 10_000 ? compact.format(count) : standard.format(count)
}

export function formatPercent(
  value: string | number | null | undefined,
  total: string | number | null | undefined
) {
  const divisor = toNumber(total)
  return divisor === 0 ? '0%' : `${Math.round((toNumber(value) / divisor) * 100)}%`
}

export function formatCurrency(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
}

export function initialsOf(name: string): string {
  /* Only letters and digits count — names like "You (simulator)" would
   * otherwise render as "Y(". */
  const parts = name.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)
  if (!parts?.length) return '?'
  return parts
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

/** Strips HTML so a knowledge article can be previewed as one line of text. */
export function stripHtml(html: string | null | undefined): string {
  if (!html) return ''
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

export function truncate(text: string, length: number): string {
  return text.length <= length ? text : `${text.slice(0, length - 1).trimEnd()}…`
}
