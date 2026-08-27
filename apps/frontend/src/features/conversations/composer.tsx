import { useState } from 'react'
import { Eye, Loader2, Pencil, Send } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { useReplyToTicket } from '@/lib/queries'
import { renderMarkdown } from '@/lib/markdown'

/**
 * Plain textarea plus a markdown preview, replacing the v5 ProseMirror editor.
 * The wire format was always a markdown string, so nothing downstream changes —
 * and the editor was the single heaviest dependency in the old bundle.
 */
export function Composer({
  ticketId,
  value,
  onChange,
  disabled,
}: {
  ticketId: number
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const [mode, setMode] = useState<'write' | 'preview'>('write')
  const reply = useReplyToTicket()

  const send = () => {
    const body = value.trim()
    if (!body) return

    reply.mutate(
      { ticketId, body },
      {
        onSuccess: () => {
          onChange('')
          setMode('write')
          toast.success('Reply sent')
        },
        onError: () => toast.error('Could not send the reply. Try again.'),
      }
    )
  }

  return (
    <div className="border-t border-black/5 bg-white p-3">
      <div className="rounded-[8px] border border-black/5 focus-within:border-gray-400">
        {mode === 'write' ? (
          <Textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            disabled={disabled}
            placeholder="Write a reply…  ⌘↵ to send"
            className="min-h-[92px] resize-y border-0 focus-visible:border-0"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault()
                send()
              }
            }}
          />
        ) : (
          <div
            className="prose-thread min-h-[92px] px-3 py-2 text-[13.5px] leading-relaxed text-gray-800"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(value) }}
          />
        )}

        <div className="flex items-center gap-2 border-t border-black/5 px-2 py-1.5">
          <button
            type="button"
            onClick={() => setMode(mode === 'write' ? 'preview' : 'write')}
            className={cn(
              'inline-flex h-6 items-center gap-1.5 rounded-[6px] px-1.5 text-[12px] font-medium transition-colors',
              'text-gray-500 hover:bg-gray-100 hover:text-gray-950'
            )}
          >
            {mode === 'write' ? <Eye className="size-3" /> : <Pencil className="size-3" />}
            {mode === 'write' ? 'Preview' : 'Write'}
          </button>

          <span className="text-[11.5px] text-gray-400">Markdown supported</span>

          <Button
            size="sm"
            className="ml-auto"
            onClick={send}
            disabled={disabled || reply.isPending || value.trim().length === 0}
          >
            {reply.isPending ? <Loader2 className="animate-spin" /> : <Send />}
            Send reply
          </Button>
        </div>
      </div>
    </div>
  )
}
