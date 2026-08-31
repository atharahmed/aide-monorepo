import { cn } from '@/lib/utils'

/**
 * The square in front of an L1 category. The hue is assigned and persisted by
 * the API (`/v2/cards` backfills a null one on read), so a category keeps the
 * same colour everywhere it is listed. Renders nothing when the API has none.
 */
export function CategorySwatch({
  color,
  className,
}: {
  color: string | null | undefined
  className?: string
}) {
  if (!color) return null

  return (
    <span
      aria-hidden
      style={{ background: color }}
      className={cn('size-2.5 shrink-0 rounded-[3px]', className)}
    />
  )
}
