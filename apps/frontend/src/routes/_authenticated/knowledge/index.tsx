import { useEffect, useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { BookOpen, ChevronRight, Download, ExternalLink, Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/page-header'
import { EmptyState, ErrorState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { OnboardingReminders } from '@/features/onboarding/components'
import { RichTextEditor } from '@/features/knowledge/rich-text'
import { ImportWizard } from '@/features/knowledge/import-wizard'
import { KnowledgeTabs } from '@/features/knowledge/tabs'
import {
  useDeleteKnowledgeDocument,
  useKnowledgeDocuments,
  useMe,
  useSaveKnowledgeDocument,
} from '@/lib/queries'
import {
  formatCount,
  formatPercent,
  formatRelative,
  stripHtml,
  toNumber,
  truncate,
} from '@/lib/format'
import { searchId } from '@/lib/search'
import type { Id, KnowledgeDocument } from '@/types/api'

export const Route = createFileRoute('/_authenticated/knowledge/')({
  validateSearch: (search: Record<string, unknown>): { article?: Id; import?: boolean } => ({
    article: searchId(search.article),
    import: search.import === '1' || search.import === 1 ? true : undefined,
  }),
  component: KnowledgePage,
})

function KnowledgePage() {
  const search = Route.useSearch()
  const { data: user } = useMe()
  const { data: documents, isLoading, isError, refetch } = useKnowledgeDocuments()

  const [selectedId, setSelectedId] = useState<Id | undefined>(search.article)
  const [importOpen, setImportOpen] = useState(Boolean(search.import))
  const [createOpen, setCreateOpen] = useState(false)

  const grouped = useMemo(() => {
    const map = new Map<string, KnowledgeDocument[]>()
    for (const document of documents ?? []) {
      const key = document.group_identifier ?? document.knowledge_set_name ?? 'Other'
      const list = map.get(key) ?? []
      list.push(document)
      map.set(key, list)
    }
    return [...map.entries()]
  }, [documents])

  const totalTimesUsed = (documents ?? []).reduce(
    (sum, document) => sum + toNumber(document.times_used),
    0
  )

  const selected =
    (documents ?? []).find((document) => document.id === selectedId) ?? documents?.[0]

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Knowledge"
        description="What Aide answers from. Articles, policies and anything else you would tell a new hire"
        meta={
          documents && (
            <span className="text-[12.5px] text-gray-400 tabular-nums">{documents.length}</span>
          )
        }
        actions={
          <>
            <OnboardingReminders user={user} page="knowledge" className="mr-1 hidden lg:flex" />
            <Button variant="ghost" size="sm" className="pr-4" onClick={() => setImportOpen(true)}>
              <Download />
              Import help center
            </Button>
            <Button size="sm" className="pr-4" onClick={() => setCreateOpen(true)}>
              <Plus />
              New article
            </Button>
          </>
        }
      />

      <div className="flex min-h-0 flex-1">
        <div className="flex w-full shrink-0 flex-col border-r border-gray-100 bg-white lg:w-[320px]">
          <div className="shrink-0 px-4 py-2 pb-1">
            <KnowledgeTabs value="articles" />
          </div>

          <div className="min-h-0 flex-1 scrollbar-thin overflow-y-auto p-2">
            {isLoading ? (
              <ul>
                {Array.from({ length: 8 }).map((_, index) => (
                  <li key={index} className="px-2 py-2">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="mt-2 h-3 w-1/2" />
                  </li>
                ))}
              </ul>
            ) : isError ? (
              <div className="p-2">
                <ErrorState
                  title="Could not load knowledge"
                  action={
                    <Button size="sm" onClick={() => refetch()}>
                      Try again
                    </Button>
                  }
                />
              </div>
            ) : (documents ?? []).length === 0 ? (
              <div className="p-2">
                <EmptyState
                  icon={<BookOpen className="size-4" />}
                  title="No knowledge yet"
                  description="Import your help centre, or write the first article by hand. Aide answers from whatever is here."
                  action={
                    <div className="flex flex-col gap-2">
                      <Button onClick={() => setImportOpen(true)}>Import a help center</Button>
                      <Button variant="outline" onClick={() => setCreateOpen(true)}>
                        Write an article
                      </Button>
                    </div>
                  }
                />
              </div>
            ) : (
              grouped.map(([source, entries]) => {
                return (
                  <Collapsible key={source} defaultOpen>
                    <CollapsibleTrigger className="group flex w-full cursor-pointer items-center gap-1.5 rounded-[6px] px-2 py-1.5 text-left transition-colors hover:bg-gray-100">
                      <ChevronRight className="size-3.5 shrink-0 text-gray-400 transition-transform group-data-[state=open]:rotate-90" />
                      <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-gray-400">
                        {source}
                      </span>
                      <span className="text-[11px] text-gray-400 tabular-nums">
                        {formatCount(entries.length)}
                      </span>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      {entries.map((document) => (
                        <div key={document.id} className="my-0.5">
                          <button
                            type="button"
                            onClick={() => setSelectedId(document.id)}
                            className={cn(
                              'flex w-full cursor-pointer items-center gap-2 rounded-[10px] px-3 py-2 text-left transition-colors hover:bg-black/3',
                              selected?.id === document.id && 'bg-black/3'
                            )}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13px] font-medium text-gray-900">
                                {document.title}
                              </p>
                              <p className="mt-0 truncate text-[11px] text-gray-400">
                                {truncate(stripHtml(document.document), 70)}
                              </p>
                            </div>
                            <span className="shrink-0 text-right text-[11px] text-gray-400 tabular-nums">
                              {formatPercent(toNumber(document.times_used), totalTimesUsed)}
                            </span>
                          </button>
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                )
              })
            )}
          </div>
        </div>

        <div className="hidden min-w-0 flex-1 scrollbar-thin overflow-y-auto bg-white lg:block">
          {selected ? (
            <ArticleEditor key={selected.id} document={selected} />
          ) : (
            <div className="p-6">
              <EmptyState
                title="Select an article"
                description="Pick one from the list to edit it."
              />
            </div>
          )}
        </div>
      </div>

      <ImportWizard open={importOpen} onOpenChange={setImportOpen} />
      <CreateArticleDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={setSelectedId}
      />
    </div>
  )
}

function ArticleEditor({ document }: { document: KnowledgeDocument }) {
  const saveDocument = useSaveKnowledgeDocument()
  const deleteDocument = useDeleteKnowledgeDocument()

  const [title, setTitle] = useState(document.title ?? '')
  const [body, setBody] = useState(document.document ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    setTitle(document.title ?? '')
    setBody(document.document ?? '')
  }, [document])

  const dirty = title !== (document.title ?? '') || body !== (document.document ?? '')

  return (
    <div className="flex flex-col">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-black/5 bg-white px-5 py-3">
        <div id="input-container" className="mx-auto w-2xl">
          {' '}
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            aria-label="Article title"
            className="h-8 min-w-0 flex-1 border-transparent px-2 text-[19px] font-medium tracking-[-0.02em] hover:border-black/5"
          />
        </div>

        {document.link && (
          <Button variant="ghost" size="icon-sm" asChild aria-label="Open the source article">
            <a href={document.link} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="text-gray-400" />
            </a>
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Delete article"
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 className="text-gray-400" />
        </Button>

        <Button
          size="sm"
          variant="outline"
          disabled={!dirty || saveDocument.isPending}
          onClick={() =>
            saveDocument.mutate(
              { id: document.id, title, document: body },
              { onSuccess: () => toast.success('Article saved') }
            )
          }
        >
          {saveDocument.isPending && <Loader2 className="animate-spin" />}
          {dirty ? 'Save changes' : 'Saved'}
        </Button>
      </div>

      <div className="mx-auto w-3xl px-5 py-5">
        <RichTextEditor value={body} onChange={setBody} />

        <p className="mt-3 text-[12px] text-gray-400">
          Updated {formatRelative(document.updated_at)}
          {document.knowledge_set_name && ` · from ${document.knowledge_set_name}`}
        </p>
      </div>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete “{document.title}”?</DialogTitle>
            <DialogDescription>
              Aide stops answering from this article. Replies that already cited it keep their
              history.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Keep article
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                deleteDocument.mutate(document.id, {
                  onSuccess: () => {
                    setConfirmDelete(false)
                    toast.success('Article deleted')
                  },
                })
              }
            >
              Delete article
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CreateArticleDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (id: Id) => void
}) {
  const saveDocument = useSaveKnowledgeDocument()
  const [title, setTitle] = useState('')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New article</DialogTitle>
          <DialogDescription>Give it a title now — you can write the body next.</DialogDescription>
        </DialogHeader>

        <div>
          <Label htmlFor="article-title">Title</Label>
          <Input
            id="article-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-1.5"
            placeholder="Return and exchange policy"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!title.trim() || saveDocument.isPending}
            onClick={() =>
              saveDocument.mutate(
                { title, document: '<p></p>' },
                {
                  onSuccess: (created) => {
                    onOpenChange(false)
                    setTitle('')
                    onCreated(created.id)
                    toast.success('Article created')
                  },
                }
              )
            }
          >
            {saveDocument.isPending && <Loader2 className="animate-spin" />}
            Create article
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
