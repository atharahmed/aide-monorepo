import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils'

const Tabs = TabsPrimitive.Root

function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn('flex flex-wrap items-center gap-1.5', className)}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'inline-flex cursor-pointer items-center rounded-full px-3 py-[4px] text-[12.5px] font-[500] tracking-[0px] transition-colors duration-200',
        'border-black/[0.0] bg-black/[0.03] text-black/60',
        'hover:bg-black/[0.07] hover:text-black/80',
        'data-[state=active]:border-black/80 data-[state=active]:bg-black/75 data-[state=active]:text-white/90',
        'disabled:pointer-events-none disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn('outline-none', className)} {...props} />
}

/** Segmented control — used where tabs filter a list rather than switch a page. */
function SegmentedList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        'inline-flex items-center gap-0.5 rounded-[8px] border border-black/0 bg-gray-100 p-0.5',
        className
      )}
      {...props}
    />
  )
}

function SegmentedTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'inline-flex items-center gap-1.5 rounded-[6px] px-2.5 py-1 text-[12px] font-medium text-gray-500 transition-colors',
        'hover:text-gray-900',
        'data-[state=active]:bg-white data-[state=active]:text-gray-950',
        className
      )}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, SegmentedList, SegmentedTrigger }
