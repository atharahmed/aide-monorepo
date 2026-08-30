import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { formatCount } from '@/lib/format'

/**
 * The three data-display primitives Reports and Agents share. All monochrome:
 * the numbers carry the meaning, colour is reserved for status.
 */

export function StatTile({
  label,
  value,
  hint,
  to,
  className,
}: {
  label: string
  value: number | string
  hint?: string
  /** Every count deep-links into the filtered conversation list. */
  to?: string
  className?: string
}) {
  const body = (
    <>
      <p className=" text-[24px] leading-none font-medium tracking-[0.0em] text-gray-950 tabular-nums">
        {typeof value === 'number' ? formatCount(value) : value}
      </p>
      <p className="text-[12.5px] text-gray-400 mt-2">{label}</p>
      {hint && <p className="mt-1.5 text-[12px] text-gray-400">{hint}</p>}
    </>
  )

  const classes = cn(
    'block rounded-[14px] bg-black/3 px-4 py-3.5 transition-colors',
    to && 'hover:border-gray-300 hover:bg-black/5',
    className
  )

  if (!to) return <div className={classes}>{body}</div>

  return (
    <Link to={to} className={classes}>
      {body}
    </Link>
  )
}

/** Inline proportional bar for table rows — width is share of `max`. */
export function InlineBar({
  value,
  max,
  className,
}: {
  value: number
  max: number
  className?: string
}) {
  const width = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-[2px] bg-gray-100', className)}>
      <div className="h-full rounded-[2px] bg-black/50" style={{ width: `${width}%` }} />
    </div>
  )
}

/** 7-point sparkline. Pure SVG — no chart library for one polyline. */
export function Sparkline({
  points,
  className,
  width = 68,
  height = 20,
}: {
  points: number[]
  className?: string
  width?: number
  height?: number
}) {
  if (points.length === 0) return null

  const max = Math.max(...points, 1)
  const step = points.length > 1 ? width / (points.length - 1) : width
  const coords = points.map((point, index) => {
    const x = index * step
    const y = height - (point / max) * (height - 2) - 1
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  const isFlat = points.every((point) => point === 0)

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      aria-hidden
      className={cn('overflow-visible', className)}
    >
      <polyline
        points={coords.join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={isFlat ? 'text-gray-300' : 'text-gray-800'}
      />
    </svg>
  )
}
