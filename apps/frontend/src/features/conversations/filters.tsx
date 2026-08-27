import { Check, ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'

export interface FilterOption {
  value: string
  label: string
  hint?: string
  emoji?: string | null
}

/**
 * Multi-select filter chip. Selection lives in the URL, so a filtered list is
 * always shareable — the old app kept it in component state and lost it on
 * refresh.
 */
export function FilterSelect({
  label,
  options,
  selected,
  onChange,
  searchPlaceholder = 'Search…',
  emptyMessage = 'Nothing matches.',
}: {
  label: string
  options: FilterOption[]
  selected: string[]
  onChange: (values: string[]) => void
  searchPlaceholder?: string
  emptyMessage?: string
}) {
  const toggle = (value: string) =>
    onChange(
      selected.includes(value) ? selected.filter((entry) => entry !== value) : [...selected, value]
    )

  const summary =
    selected.length === 0
      ? label
      : selected.length === 1
        ? (options.find((option) => option.value === selected[0])?.label ?? `1 ${label}`)
        : `${selected.length} ${label.toLowerCase()}`

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex h-7 max-w-[220px] items-center gap-1.5 rounded-[6px] border px-2 text-[12.5px] font-medium transition-colors',
            selected.length > 0
              ? 'border-gray-950 bg-gray-950 text-white hover:bg-gray-800'
              : 'border-black/5 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-950'
          )}
        >
          <span className="truncate">{summary}</span>
          {selected.length > 0 ? (
            <span
              role="button"
              tabIndex={0}
              aria-label={`Clear ${label} filter`}
              onClick={(event) => {
                event.preventDefault()
                event.stopPropagation()
                onChange([])
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  event.stopPropagation()
                  onChange([])
                }
              }}
              className="-mr-0.5 rounded-full p-0.5 text-gray-400 transition-colors hover:text-white"
            >
              <X className="size-3" />
            </span>
          ) : (
            <ChevronDown className="size-3 shrink-0 text-gray-400" />
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-64 p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={`${option.label} ${option.hint ?? ''}`}
                  onSelect={() => toggle(option.value)}
                >
                  <span
                    className={cn(
                      'flex size-4 items-center justify-center rounded-[4px] border transition-colors',
                      selected.includes(option.value)
                        ? 'border-gray-950 bg-gray-950 text-white'
                        : 'border-gray-300'
                    )}
                  >
                    {selected.includes(option.value) && (
                      <Check className="size-3" strokeWidth={3} />
                    )}
                  </span>
                  {option.emoji && <span className="w-4 text-center">{option.emoji}</span>}
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  {option.hint && (
                    <span className="shrink-0 text-[11.5px] text-gray-400">{option.hint}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export function ClearFiltersButton({ onClear }: { onClear: () => void }) {
  return (
    <Button variant="ghost" size="sm" onClick={onClear} className="text-gray-500">
      Clear filters
    </Button>
  )
}
