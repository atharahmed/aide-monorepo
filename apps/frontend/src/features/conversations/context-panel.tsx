import { useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { helpdeskTicketUrl } from '@/features/conversations/helpdesk-links'
import { formatDay, formatRelative } from '@/lib/format'
import type { ContextField, ContextFieldRow, ContextFieldValue } from '@/types/api'

export { helpdeskTicketUrl as helpdeskUrl }

/**
 * Customer, order and CRM fields pulled from the connected integrations.
 *
 * `FieldsService` returns a heterogeneous list: a field's value may be plain
 * text, a link, a date, or a group of rows (order line items, tag lists). Each
 * shape gets its own renderer below — this is the whole reason the panel is not
 * a two-column `<dl>` of strings.
 */

/** Rows beyond this collapse behind a "Show all" toggle, as in the v5 panel. */
const ROWS_BEFORE_COLLAPSE = 5

/**
 * The `contact` field carries a raw CRM payload that the v5 dashboard rendered
 * with per-account special cases. Without those it is an unreadable blob, so it
 * is skipped rather than dumped.
 */
const HIDDEN_FIELD_KEYS = new Set(['contact'])

export function ContextPanel({ fields }: { fields: ContextField[] }) {
  const visible = (fields ?? []).filter((field) => !HIDDEN_FIELD_KEYS.has(field.fieldKey))

  if (visible.length === 0) return null

  return (
    <dl className="flex flex-col">
      {visible.map((field, index) => (
        <div
          key={`${field.fieldKey}-${index}`}
          className="flex flex-col gap-1 border-b border-gray-200 py-2 last:border-b-0"
        >
          <dt className="text-[11.5px] text-gray-500">{field.displayName ?? field.fieldKey}</dt>
          <dd className="min-w-0 text-[12.5px] break-words text-gray-900">
            <FieldValue value={field.value} />
          </dd>
        </div>
      ))}
    </dl>
  )
}

function FieldValue({ value }: { value: ContextFieldValue }) {
  if (typeof value === 'string') return <>{value || '—'}</>

  if ('rows' in value) return <RowGroup rows={value.rows} />

  if ('date' in value) {
    return (
      <span className="flex flex-wrap items-baseline gap-1.5">
        {formatDay(value.date)}
        <span className="text-[11.5px] text-gray-400">{formatRelative(value.date)}</span>
      </span>
    )
  }

  if ('tracking_company' in value) {
    return <ValueLink url={value.url} label={value.tracking_company} />
  }

  return value.url ? <ValueLink url={value.url} label={value.title} /> : <>{value.title || '—'}</>
}

function RowGroup({ rows }: { rows: ContextFieldRow[] }) {
  const [expanded, setExpanded] = useState(false)

  if (rows.length === 0) return <>—</>

  const shown = expanded ? rows : rows.slice(0, ROWS_BEFORE_COLLAPSE)
  const hidden = rows.length - shown.length

  return (
    <div className="flex flex-col gap-1.5">
      {shown.map((row, index) => (
        <div key={index} className="flex flex-col gap-0.5">
          <span className="flex flex-wrap items-baseline gap-1.5">
            {row.link ? (
              <ValueLink url={row.link} label={row.title ?? ''} />
            ) : (
              <span>{row.title}</span>
            )}
            {row.subtitle && <span className="text-[11.5px] text-gray-400">{row.subtitle}</span>}
          </span>

          {(row.left_descriptor || row.right_descriptor || row.occurs_at) && (
            <span className="flex flex-wrap items-baseline gap-x-2 text-[11.5px] text-gray-400">
              {row.left_descriptor && <span>{row.left_descriptor}</span>}
              {row.right_descriptor && <span>{row.right_descriptor}</span>}
              {row.occurs_at && <span>{formatRelative(row.occurs_at)}</span>}
            </span>
          )}
        </div>
      ))}

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="self-start text-[11.5px] text-gray-500 transition-colors hover:text-gray-950"
        >
          Show {hidden} more
        </button>
      )}
    </div>
  )
}

function ValueLink({ url, label }: { url: string; label: string }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-baseline gap-1 hover:underline"
    >
      {label || url}
      <ExternalLink className="size-3 shrink-0 self-center text-gray-400" />
    </a>
  )
}
