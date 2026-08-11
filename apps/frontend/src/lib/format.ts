import { format, formatDistanceToNowStrict, isThisYear, isToday, isYesterday } from 'date-fns'

/** List timestamps: "14:32" today, "Yesterday", "12 Mar", "12 Mar 2024". */
export function formatListDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  if (isToday(date)) return format(date, 'HH:mm')
  if (isYesterday(date)) return 'Yesterday'
  return isThisYear(date) ? format(date, 'd MMM') : format(date, 'd MMM yyyy')
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

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })
const standard = new Intl.NumberFormat('en')

export const formatCount = (value: number) =>
  value >= 10_000 ? compact.format(value) : standard.format(value)

export const formatPercent = (value: number, total: number) =>
  total === 0 ? '0%' : `${Math.round((value / total) * 100)}%`

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
