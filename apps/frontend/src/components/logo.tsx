import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * The Aide mark and its loading animation, carried over from the v5 dashboard's
 * `images/logo.tsx`. The geometry is copied verbatim — the coordinates come out
 * of the original artwork and are not worth re-deriving.
 *
 * The only change from v5 is that `Logo` takes its size from `className` on the
 * `<svg>` rather than a hard-coded 40×40 inside a wrapper `<div>`, because call
 * sites here size it with utility classes (`size-5`, `size-6`).
 */

const LOGO_TILE = { width: 7.9537, height: 7.9537, rx: 1.98843 }

const LOGO_DOTS = [
  { x: 8.06055, y: 8.04199, fill: '#569AD8', fillOpacity: 0.5, clock: 11 },
  { x: 23.998, y: 23.9758, fill: '#EA9F00', fillOpacity: 0.5, clock: 5 },
  { x: 8.06055, y: 23.9768, fill: '#53A692', fillOpacity: 0.5, clock: 8 },
  { x: 23.998, y: 8.05615, fill: '#7E69BE', fillOpacity: 0.5, clock: 2 },
  { x: 0.0878906, y: 0.0812988, fill: '#569AD8', fillOpacity: 1, clock: 10 },
  { x: 31.9609, y: 31.9646, fill: '#F97316', fillOpacity: 1, clock: 4 },
  { x: 0.0878906, y: 16.0161, fill: '#10B981', fillOpacity: 1, clock: 9 },
  { x: 16.0254, y: 31.9504, fill: '#EA9F00', fillOpacity: 1, clock: 6 },
  { x: 16.0234, y: 0.0812988, fill: '#0284C7', fillOpacity: 1, clock: 0 },
  { x: 0.0878906, y: 31.9517, fill: '#53A692', fillOpacity: 1, clock: 7 },
  { x: 31.9609, y: 0.081543, fill: '#9333EA', fillOpacity: 1, clock: 1 },
  { x: 31.9551, y: 16.0156, fill: '#E11D48', fillOpacity: 1, clock: 3 },
] as const

const LOGO_CYCLE_S = 5.2
const LOGO_FILL_END = 54
const LOGO_FADE_IN = 16
const LOGO_HOLD_END = 74
const LOGO_FADE_OUT_END = 92

function shuffledSlots(count: number): number[] {
  const slots = Array.from({ length: count }, (_, i) => i)
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const swap = slots[i]
    slots[i] = slots[j]!
    slots[j] = swap!
  }
  return slots
}

function fillCss(slots: number[]): string {
  return LOGO_DOTS.map((dot, i) => {
    const start = (slots[i]! / LOGO_DOTS.length) * LOGO_FILL_END
    const on = start + LOGO_FADE_IN
    return `@keyframes logo-dot-fill-${dot.clock} {
      0%, ${start.toFixed(3)}% { filter: grayscale(1); opacity: 0.1; }
      ${on.toFixed(3)}%, ${LOGO_HOLD_END}% { filter: grayscale(0); opacity: 1; }
      ${LOGO_FADE_OUT_END}%, 100% { filter: grayscale(1); opacity: 0.1; }
    }`
  }).join('\n')
}

export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Aide"
      className={cn('size-5 shrink-0', className)}
    >
      <g clipPath="url(#clip0_3361_1754)">
        {LOGO_DOTS.map((dot) => (
          <rect
            key={dot.clock}
            x={dot.x}
            y={dot.y}
            width={LOGO_TILE.width}
            height={LOGO_TILE.height}
            rx={LOGO_TILE.rx}
            fill={dot.fill}
            fillOpacity={dot.fillOpacity}
          />
        ))}
      </g>
      <defs>
        <clipPath id="clip0_3361_1754">
          <rect width="40" height="40" fill="white" />
        </clipPath>
      </defs>
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

/** Same mark as `Logo`. Random squares fade into color until the mark is full, then it fades to gray and reshuffles. */
export function AnimatedLogo({
  size = 32,
  className,
}: {
  size?: number
  className?: string
}) {
  const [cycle, setCycle] = useState(0)
  const slots = useMemo(() => shuffledSlots(LOGO_DOTS.length), [cycle])

  return (
    <svg
      key={cycle}
      viewBox="-2 -2 44 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Aide"
      overflow="visible"
      width={size}
      height={size}
      className={cn('shrink-0 overflow-visible', className)}
    >
      <style>{fillCss(slots)}</style>
      {LOGO_DOTS.map((dot, i) => (
        <rect
          key={dot.clock}
          x={dot.x}
          y={dot.y}
          width={LOGO_TILE.width}
          height={LOGO_TILE.height}
          rx={LOGO_TILE.rx}
          fill={dot.fill}
          fillOpacity={dot.fillOpacity}
          onAnimationEnd={i === 0 ? () => setCycle((n) => n + 1) : undefined}
            style={{
              filter: 'grayscale(1)',
              opacity: 0.1,
              animation: `logo-dot-fill-${dot.clock} ${LOGO_CYCLE_S}s cubic-bezier(0.4, 0, 0.2, 1) forwards`,
            }}
        />
      ))}
    </svg>
  )
}
