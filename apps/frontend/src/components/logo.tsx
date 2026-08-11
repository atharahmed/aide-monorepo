import { cn } from '@/lib/utils'

/**
 * The Aide mark, carried over unchanged from the v5 dashboard
 * (`images/brand-logos/aide.svg`): twelve rounded squares on a 40×40 grid —
 * eight solid on the outer ring, four at 50% opacity in the middle.
 *
 * These hexes are the one deliberate exception to the "scale tokens only" rule.
 * They are brand identity, not theme, and must not be remapped onto the gray
 * ramp or re-tinted for dark mode.
 */

const SQUARE = 7.9537
const RADIUS = 1.98843

const OUTER = [
  { x: 0.0878906, y: 0.0812988, fill: '#569AD8' },
  { x: 16.0234, y: 0.0812988, fill: '#0284C7' },
  { x: 31.9609, y: 0.081543, fill: '#9333EA' },
  { x: 0.0878906, y: 16.0161, fill: '#10B981' },
  { x: 31.9551, y: 16.0156, fill: '#E11D48' },
  { x: 0.0878906, y: 31.9517, fill: '#53A692' },
  { x: 16.0254, y: 31.9504, fill: '#EA9F00' },
  { x: 31.9609, y: 31.9646, fill: '#F97316' },
]

const INNER = [
  { x: 8.06055, y: 8.04199, fill: '#569AD8' },
  { x: 23.998, y: 8.05615, fill: '#7E69BE' },
  { x: 8.06055, y: 23.9768, fill: '#53A692' },
  { x: 23.998, y: 23.9758, fill: '#EA9F00' },
]

export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      role="img"
      aria-label="Aide"
      className={cn('size-5 shrink-0', className)}
    >
      {INNER.map((square) => (
        <rect
          key={`${square.x}-${square.y}`}
          x={square.x}
          y={square.y}
          width={SQUARE}
          height={SQUARE}
          rx={RADIUS}
          fill={square.fill}
          fillOpacity="0.5"
        />
      ))}
      {OUTER.map((square) => (
        <rect
          key={`${square.x}-${square.y}`}
          x={square.x}
          y={square.y}
          width={SQUARE}
          height={SQUARE}
          rx={RADIUS}
          fill={square.fill}
        />
      ))}
    </svg>
  )
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('text-[14px] font-semibold tracking-[-0.02em] text-gray-950', className)}>
      Aide
    </span>
  )
}
