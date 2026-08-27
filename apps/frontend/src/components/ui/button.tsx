import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full text-[13px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-gray-950 text-white hover:bg-gray-800',
        outline: 'border border-gray-200 bg-white text-gray-800 hover:bg-gray-50',
        secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200',
        ghost: 'text-gray-600 hover:bg-gray-100 hover:text-gray-950',
        destructive: 'bg-destructive-600 text-white hover:bg-destructive-700',
        link: 'text-gray-950 underline-offset-4 hover:underline',
      },
      size: {
        'default': 'h-8 px-3',
        'sm': 'h-7 px-2.5 text-[12.5px]',
        'lg': 'h-9 px-4 text-sm',
        'icon': 'size-6',
        'icon-sm': 'size-7',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : 'button'
  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />
}

export { Button, buttonVariants }
