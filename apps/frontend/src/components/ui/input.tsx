import * as React from 'react'
import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      className={cn(
        'flex h-9 w-full rounded-[8px] border border-black/10 bg-white px-3 py-1 text-[13.5px] text-gray-950 transition-colors shadow-inner',
        'focus-visible:border-gray-400 focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400',
        'file:border-0 file:bg-transparent file:text-[13px] file:font-medium',
        'aria-invalid:border-destructive-400',
        className
      )}
      {...props}
    />
  )
}

export { Input }
