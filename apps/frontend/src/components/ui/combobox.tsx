import { useState, type ReactNode } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { selectTriggerClassName } from '@/components/ui/select'

export interface ComboboxOption {
  value: string
  label: string
  content?: ReactNode
}

export interface ComboboxGroup {
  name?: string
  options: ComboboxOption[]
}

/**
 * A select you can type into. Radix's `Select` is right for a handful of
 * options, but a scenario picks from every topic, tag, inbox and shipping
 * country an account has — hundreds of rows, unreachable without a filter.
 */
export function Combobox({
  value,
  groups,
  onChange,
  placeholder = 'Choose…',
  searchPlaceholder = 'Search…',
  emptyMessage = 'Nothing matches.',
  disabled = false,
  className,
  contentClassName,
  'aria-label': ariaLabel,
}: {
  'value': string
  'groups': ComboboxGroup[]
  'onChange': (value: string) => void
  'placeholder'?: string
  'searchPlaceholder'?: string
  'emptyMessage'?: string
  'disabled'?: boolean
  'className'?: string
  'contentClassName'?: string
  'aria-label'?: string
}) {
  const [open, setOpen] = useState(false)

  const selected = groups.flatMap((group) => group.options).find((option) => option.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          disabled={disabled}
          data-placeholder={selected ? undefined : ''}
          className={cn(selectTriggerClassName, className)}
        >
          <span className="min-w-0 flex-1 truncate text-left">
            {selected ? (selected.content ?? selected.label) : placeholder}
          </span>
          <ChevronDown className="size-3.5 shrink-0 text-gray-400" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        className={cn('w-(--radix-popover-trigger-width) min-w-56 p-0', contentClassName)}
      >
        <Command
          filter={(_value, search, keywords) =>
            (keywords?.[0] ?? '').toLowerCase().includes(search.toLowerCase()) ? 1 : 0
          }
        >
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            {groups.map((group, index) => (
              <CommandGroup key={group.name ?? index} heading={group.name}>
                {group.options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    keywords={[option.label]}
                    onSelect={() => {
                      onChange(option.value)
                      setOpen(false)
                    }}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {option.content ?? option.label}
                    </span>
                    {option.value === value && (
                      <Check className="size-3.5 shrink-0 text-gray-950" strokeWidth={2.5} />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
