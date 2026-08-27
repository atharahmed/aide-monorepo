import { useEffect, useState } from 'react'
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
        <rect
          x="8.06055"
          y="8.04199"
          width="7.9537"
          height="7.9537"
          rx="1.98843"
          fill="#569AD8"
          fillOpacity="0.5"
        />
        <rect
          x="23.998"
          y="23.9758"
          width="7.9537"
          height="7.9537"
          rx="1.98843"
          fill="#EA9F00"
          fillOpacity="0.5"
        />
        <rect
          x="8.06055"
          y="23.9768"
          width="7.9537"
          height="7.9537"
          rx="1.98843"
          fill="#53A692"
          fillOpacity="0.5"
        />
        <rect
          x="23.998"
          y="8.05615"
          width="7.9537"
          height="7.9537"
          rx="1.98843"
          fill="#7E69BE"
          fillOpacity="0.5"
        />
        <rect
          x="0.0878906"
          y="0.0812988"
          width="7.9537"
          height="7.9537"
          rx="1.98843"
          fill="#569AD8"
        />
        <rect x="31.9609" y="31.9646" width="7.9537" height="7.9537" rx="1.98843" fill="#F97316" />
        <rect
          x="0.0878906"
          y="16.0161"
          width="7.9537"
          height="7.9537"
          rx="1.98843"
          fill="#10B981"
        />
        <rect x="16.0254" y="31.9504" width="7.9537" height="7.9537" rx="1.98843" fill="#EA9F00" />
        <rect
          x="16.0234"
          y="0.0812988"
          width="7.9537"
          height="7.9537"
          rx="1.98843"
          fill="#0284C7"
        />
        <rect
          x="0.0878906"
          y="31.9517"
          width="7.9537"
          height="7.9537"
          rx="1.98843"
          fill="#53A692"
        />
        <rect x="31.9609" y="0.081543" width="7.9537" height="7.9537" rx="1.98843" fill="#9333EA" />
        <rect x="31.9551" y="16.0156" width="7.9537" height="7.9537" rx="1.98843" fill="#E11D48" />
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

export function AnimatedLogo({ size = 32, className = '', dotSize = 2.5 }) {
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    const intervalId = setInterval(() => {
      setIsAnimating((prev) => !prev)
    }, 4000)

    return () => clearInterval(intervalId)
  }, [])

  const getTransform = (x: number, y: number, mirrored: boolean) => {
    const centerX = size / 2
    const centerY = size / 2
    const dx = centerX - x
    const dy = centerY - y

    if (mirrored) {
      return `translate(${2 * dx}px, ${2 * dy}px) rotate(45deg)`
    }
    return 'rotate(45deg)'
  }

  const rectangles = [
    { x: 12, y: 16, fill: '#569AD8', fillOpacity: 0.5 },
    { x: 20, y: 16, fill: '#EA9F00', fillOpacity: 0.5 },
    { x: 16, y: 20, fill: '#53A692', fillOpacity: 0.5 },
    { x: 16, y: 12, fill: '#7E69BE', fillOpacity: 0.5 },
    { x: 8, y: 16, fill: '#569AD8' },
    { x: 24, y: 16, fill: '#F97316' },
    { x: 12, y: 20, fill: '#10B981' },
    { x: 20, y: 20, fill: '#EA9F00' },
    { x: 12, y: 12, fill: '#0284C7' },
    { x: 16, y: 24, fill: '#53A692' },
    { x: 16, y: 8, fill: '#9333EA' },
    { x: 20, y: 12, fill: '#E11D48' },
  ].map((rect) => ({
    ...rect,
    x: (rect.x * size) / 32 - dotSize / 2,
    y: (rect.y * size) / 32 - dotSize / 2,
    fillOpacity: rect.fillOpacity || 1,
  }))

  return (
    <div className={className}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <style>
          {`
            @keyframes fadeAnimation {
              0%, 100% { opacity: 1; }
              25% { opacity: 0.25; }
              50% { opacity: 1; }
            }
          `}
        </style>
        {rectangles.map((rect, index) => (
          <g
            key={index}
            opacity={rect.fillOpacity}
            style={{
              transition: 'transform 2000ms ease-in-out',
              transform: getTransform(rect.x + dotSize / 2, rect.y + dotSize / 2, isAnimating),
              transformOrigin: `${rect.x + dotSize / 2}px ${rect.y + dotSize / 2}px`,
            }}
          >
            <rect
              x={rect.x}
              y={rect.y}
              rx={dotSize / 4}
              ry={dotSize / 4}
              width={dotSize}
              height={dotSize}
              fill={rect.fill}
              style={{
                animation: 'fadeAnimation 4s ease-in-out infinite',
                animationDelay: '4s',
              }}
            />
          </g>
        ))}
      </svg>
    </div>
  )
}
