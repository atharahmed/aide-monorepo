import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  BarChart2,
  BookOpen,
  Cable,
  CreditCard,
  Hash,
  Home,
  Inbox,
  MessagesSquare,
  Settings,
  Tag,
  Users,
  Zap,
} from 'lucide-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command'
import { useCards } from '@/lib/queries'

const pages = [
  { label: 'Home', to: '/home', icon: Home },
  { label: 'Conversations', to: '/conversations', icon: Inbox },
  { label: 'Simulator', to: '/conversations', search: { view: 'simulator' }, icon: MessagesSquare },
  { label: 'Topics', to: '/topics', icon: Tag },
  { label: 'Scenarios', to: '/scenarios', icon: Zap },
  { label: 'Knowledge', to: '/knowledge', icon: BookOpen },
  { label: 'Reports', to: '/reports', icon: BarChart2 },
  { label: 'Team', to: '/team', icon: Users },
  { label: 'Integrations', to: '/integrations', icon: Cable },
  { label: 'Billing', to: '/settings/billing', icon: CreditCard },
  { label: 'Settings', to: '/settings/account', icon: Settings },
]

export function useCommandPalette() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((previous) => !previous)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return { open, setOpen }
}

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const { data: cards } = useCards(false)

  const topics = (cards?.data ?? []).flatMap((category) =>
    category.related_categories.flatMap((sub) =>
      sub.cards.map((card) => ({ ...card, path: `${category.name} · ${sub.name}` }))
    )
  )

  /* A bare number is almost always someone pasting a conversation id. */
  const ticketId = /^\d{3,}$/.test(query.trim()) ? query.trim() : null

  const go = (action: () => void) => {
    onOpenChange(false)
    setQuery('')
    action()
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search pages, topics, or paste a conversation id…"
      />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>

        {ticketId && (
          <>
            <CommandGroup heading="Conversation">
              <CommandItem
                value={`open conversation ${ticketId}`}
                onSelect={() =>
                  go(() =>
                    navigate({ to: '/conversations', search: { ticketIds: ticketId } as never })
                  )
                }
              >
                <Hash />
                Open conversation {ticketId}
                <CommandShortcut>↵</CommandShortcut>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading="Go to">
          {pages.map((page) => (
            <CommandItem
              key={page.label}
              value={page.label}
              onSelect={() =>
                go(() => navigate({ to: page.to, search: (page.search ?? {}) as never }))
              }
            >
              <page.icon />
              {page.label}
            </CommandItem>
          ))}
        </CommandGroup>

        {topics.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Topics">
              {topics.map((topic) => (
                <CommandItem
                  key={topic.id}
                  value={`${topic.name} ${topic.path}`}
                  onSelect={() =>
                    go(() => navigate({ to: '/topics', search: { topic: topic.id } as never }))
                  }
                >
                  <span className="w-4 text-center text-[13px]">{topic.emoji ?? '·'}</span>
                  {topic.name}
                  <span className="ml-auto truncate text-[11.5px] text-gray-400">{topic.path}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}
