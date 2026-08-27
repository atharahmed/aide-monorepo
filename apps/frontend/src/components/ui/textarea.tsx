import * as React from 'react'
import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'flex min-h-[72px] w-full rounded-[8px] border border-black/5 bg-white px-3 py-2 text-[13.5px] leading-relaxed text-gray-950 transition-colors',
        'focus-visible:border-gray-400 focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400',
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
