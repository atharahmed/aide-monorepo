import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/** Status badges follow one formula: {scale}-50 bg / {scale}-200 border / {scale}-700 text. */
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium whitespace-nowrap',
  {
    variants: {
      variant: {
        neutral: 'bg-gray-100 text-gray-600',
        solid: 'bg-gray-950 text-white',
        success: 'bg-success-50 text-success-700',
        destructive: 'bg-destructive-50 text-destructive-700',
        warning: 'bg-warning-50 text-warning-700',
        info: 'bg-info-50 text-info-700',
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
