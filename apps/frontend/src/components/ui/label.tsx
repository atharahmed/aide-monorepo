import * as React from 'react'
import * as LabelPrimitive from '@radix-ui/react-label'
import { cn } from '@/lib/utils'

function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn(
        'text-[12px] font-medium text-gray-400 peer-disabled:cursor-not-allowed peer-disabled:opacity-60',
        className
      )}
      {...props}
    />
  )
}

export { Label }
