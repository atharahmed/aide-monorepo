import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/** Status badges follow one formula: {scale}-50 bg / {scale}-200 border / {scale}-700 text. */
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] font-medium whitespace-nowrap',
  {
    variants: {
      variant: {
        neutral: 'border-gray-200 bg-gray-50 text-gray-600',
        solid: 'border-gray-950 bg-gray-950 text-white',
        success: 'border-success-200 bg-success-50 text-success-700',
        destructive: 'border-destructive-200 bg-destructive-50 text-destructive-700',
        warning: 'border-warning-200 bg-warning-50 text-warning-700',
        info: 'border-info-200 bg-info-50 text-info-700',
      },
    },
    defaultVariants: { variant: 'neutral' },
  }
)

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

/** A 5px status dot, for badges where the colour itself is the signal. */
function StatusDot({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      className={cn('inline-block size-[5px] shrink-0 rounded-full bg-current', className)}
      {...props}
    />
  )
}

export { Badge, StatusDot, badgeVariants }
