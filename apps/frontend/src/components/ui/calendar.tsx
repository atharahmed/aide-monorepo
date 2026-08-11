import { ChevronLeft, ChevronRight } from 'lucide-react'
import { DayPicker, type DayPickerProps } from 'react-day-picker'
import { cn } from '@/lib/utils'

function Calendar({ className, classNames, showOutsideDays = true, ...props }: DayPickerProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-2 text-[13px]', className)}
      classNames={{
        months: 'flex flex-col gap-4 sm:flex-row',
        month: 'flex flex-col gap-3',
        month_caption: 'flex h-7 items-center justify-center',
        caption_label: 'text-[13px] font-medium text-gray-950',
        nav: 'flex items-center gap-1 absolute right-2 top-2 z-10',
        button_previous:
          'inline-flex size-6 items-center justify-center rounded-[6px] text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-950 disabled:opacity-30',
        button_next:
          'inline-flex size-6 items-center justify-center rounded-[6px] text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-950 disabled:opacity-30',
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday: 'w-8 text-[11px] font-normal text-gray-400',
        week: 'mt-0.5 flex w-full',
        day: 'relative size-8 p-0 text-center [&:has([aria-selected])]:bg-gray-100 [&:has(>.range-start)]:rounded-l-[6px] [&:has(>.range-end)]:rounded-r-[6px] first:[&:has([aria-selected])]:rounded-l-[6px] last:[&:has([aria-selected])]:rounded-r-[6px]',
        day_button:
          'inline-flex size-8 items-center justify-center rounded-[6px] font-normal text-gray-800 transition-colors hover:bg-gray-200 aria-selected:opacity-100',
        selected:
          '[&>button]:bg-gray-950 [&>button]:text-white [&>button]:hover:bg-gray-800 [&>button]:hover:text-white',
        range_start: 'range-start',
        range_end: 'range-end',
        range_middle:
          'bg-gray-100 [&>button]:bg-transparent [&>button]:text-gray-800 [&>button]:hover:bg-gray-200',
        today: '[&>button]:font-semibold [&>button]:text-gray-950',
        outside: '[&>button]:text-gray-300',
        disabled: '[&>button]:text-gray-300 [&>button]:pointer-events-none',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, ...rest }) =>
          orientation === 'left' ? (
            <ChevronLeft className="size-3.5" {...rest} />
          ) : (
            <ChevronRight className="size-3.5" {...rest} />
          ),
      }}
      {...props}
    />
  )
}

export { Calendar }
