import { useEffect, useRef, useState } from 'react'
import { Bold, Code2, Heading2, Italic, Link2, List, ListOrdered, Undo2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Knowledge articles are stored as HTML strings, so the editor has to round-trip
 * HTML without reinterpreting it. This is a contentEditable surface with a small
 * toolbar, plus a source view for when someone pastes markup from elsewhere.
 *
 * It replaces CKEditor, which was the largest single dependency in the v5 app.
 * If richer editing is needed later, TipTap slots in behind the same
 * `value`/`onChange` HTML-string contract.
 */
export function RichTextEditor({
  value,
  onChange,
  className,
}: {
  value: string
  onChange: (html: string) => void
  className?: string
}) {
  const editorRef = useRef<HTMLDivElement>(null)
  const [mode, setMode] = useState<'rich' | 'source'>('rich')

  /* Only write into the DOM when the incoming value diverges, otherwise every
   * keystroke would reset the caret to the start. */
  useEffect(() => {
    const element = editorRef.current
    if (mode === 'rich' && element && element.innerHTML !== value) {
      element.innerHTML = value
    }
  }, [value, mode])

  const exec = (command: string, argument?: string) => {
    editorRef.current?.focus()
    document.execCommand(command, false, argument)
    onChange(editorRef.current?.innerHTML ?? '')
  }

  const tools = [
    { label: 'Bold', icon: Bold, run: () => exec('bold') },
    { label: 'Italic', icon: Italic, run: () => exec('italic') },
    { label: 'Heading', icon: Heading2, run: () => exec('formatBlock', '<h2>') },
    { label: 'Bulleted list', icon: List, run: () => exec('insertUnorderedList') },
    { label: 'Numbered list', icon: ListOrdered, run: () => exec('insertOrderedList') },
    {
      label: 'Link',
      icon: Link2,
      run: () => {
        const url = window.prompt('Link to')
        if (url) exec('createLink', url)
      },
    },
    { label: 'Undo', icon: Undo2, run: () => exec('undo') },
  ]

  return (
    <div
      className={cn('rounded-[8px] border border-black/5 focus-within:border-gray-400', className)}
    >
      <div className="flex items-center gap-0.5 border-b border-black/5 px-1.5 py-1">
        {mode === 'rich' &&
          tools.map((tool) => (
            <button
              key={tool.label}
              type="button"
              title={tool.label}
              aria-label={tool.label}
              onMouseDown={(event) => event.preventDefault()}
              onClick={tool.run}
              className="rounded-[4px] p-1.5 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-950"
            >
              <tool.icon className="size-3.5" />
            </button>
          ))}

        <button
          type="button"
          onClick={() => setMode(mode === 'rich' ? 'source' : 'rich')}
          className={cn(
            'ml-auto inline-flex items-center gap-1.5 rounded-[4px] px-1.5 py-1 text-[12px] font-medium transition-colors',
            mode === 'source'
              ? 'bg-gray-100 text-gray-950'
              : 'text-gray-500 hover:bg-gray-100 hover:text-gray-950'
          )}
        >
          <Code2 className="size-3.5" />
          HTML
        </button>
      </div>

      {mode === 'rich' ? (
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label="Article content"
          onInput={(event) => onChange(event.currentTarget.innerHTML)}
          className="prose-article min-h-[280px] px-4 py-3 text-[15px] leading-relaxed text-gray-800 outline-none"
        />
      ) : (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          spellCheck={false}
          aria-label="Article HTML"
          className="min-h-[280px] w-full resize-y bg-white px-4 py-3 font-mono text-[12.5px] leading-relaxed text-gray-800 outline-none"
        />
      )}
    </div>
  )
}
