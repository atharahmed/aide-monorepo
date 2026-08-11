/**
 * Small markdown renderer for the reply preview and knowledge previews.
 * Deliberately not a full parser: the composer's wire format is markdown, and
 * the preview only needs to show what an agent typed. Input is escaped first,
 * so no untrusted HTML can reach the DOM.
 */

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function renderMarkdown(source: string): string {
  if (!source.trim()) {
    return '<p class="text-gray-400">Nothing to preview yet.</p>'
  }

  const escaped = escapeHtml(source)

  const inline = (text: string) =>
    text
      .replace(
        /`([^`]+)`/g,
        '<code class="rounded bg-gray-100 px-1 py-0.5 font-mono text-[12px]">$1</code>'
      )
      .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold">$1</strong>')
      .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>')
      .replace(
        /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-gray-950 underline underline-offset-2">$1</a>'
      )

  const blocks = escaped.split(/\n{2,}/)

  return blocks
    .map((block) => {
      const lines = block.split('\n')

      if (lines.every((line) => /^\s*[-*]\s+/.test(line))) {
        const items = lines
          .map((line) => `<li>${inline(line.replace(/^\s*[-*]\s+/, ''))}</li>`)
          .join('')
        return `<ul class="ml-4 list-disc space-y-1">${items}</ul>`
      }

      if (lines.every((line) => /^\s*\d+[.)]\s+/.test(line))) {
        const items = lines
          .map((line) => `<li>${inline(line.replace(/^\s*\d+[.)]\s+/, ''))}</li>`)
          .join('')
        return `<ol class="ml-4 list-decimal space-y-1">${items}</ol>`
      }

      const heading = /^(#{1,3})\s+(.*)$/.exec(block)
      if (heading) {
        const level = heading[1].length + 2
        return `<h${level} class="font-semibold text-gray-950">${inline(heading[2])}</h${level}>`
      }

      return `<p>${inline(block.replace(/\n/g, '<br />'))}</p>`
    })
    .join('')
}
