import { useEffect, useMemo, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { BookOpen, Download, ExternalLink, Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { PageBody, PageHeader } from '@/components/page-header'
import { EmptyState, ErrorState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import {
  useDeleteKnowledgeDocument,
  useKnowledgeDocuments,
  useMe,
  useSaveKnowledgeDocument,
} from '@/lib/queries'
import { formatRelative, stripHtml, truncate } from '@/lib/format'
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
      const key = document.knowledge_set_name ?? 'Other'
      const list = map.get(key) ?? []
      list.push(document)
      map.set(key, list)
    }
    return [...map.entries()]
  }, [documents])

  const selected =
    (documents ?? []).find((document) => document.id === selectedId) ?? documents?.[0]

  return (
    <>
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
            <Button variant="ghost" size="sm" onClick={() => setImportOpen(true)}>
              <Download />
              Import help center
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus />
              New article
            </Button>
          </>
        }
        tabs={
          <Tabs value="articles">
            <TabsList className="mb-0">
              <TabsTrigger value="articles">Articles</TabsTrigger>
              <TabsTrigger value="business" asChild>
                <Link to="/knowledge/business-information">Business information</Link>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />

      {isLoading ? (
        <PageBody>
          <Skeleton className="h-64" />
        </PageBody>
      ) : isError ? (
        <PageBody>
          <ErrorState
            title="Could not load knowledge"
            action={
              <Button size="sm" onClick={() => refetch()}>
                Try again
              </Button>
            }
          />
        </PageBody>
      ) : (documents ?? []).length === 0 ? (
        <PageBody>
          <EmptyState
            icon={<BookOpen className="size-4" />}
            title="No knowledge yet"
            description="Import your help centre, or write the first article by hand. Aide answers from whatever is here."
            action={
              <div className="flex gap-2">
                <Button onClick={() => setImportOpen(true)}>Import a help center</Button>
                <Button variant="outline" onClick={() => setCreateOpen(true)}>
                  Write an article
                </Button>
              </div>
            }
          />
        </PageBody>
      ) : (
        <div className="flex min-h-0 flex-1">
          <div className="w-full shrink-0 scrollbar-thin overflow-y-auto border-r border-black/5 bg-white py-2 lg:w-[320px]">
            {grouped.map(([source, entries]) => (
              <div key={source} className="mb-2">
                <p className="px-4 py-1.5 text-[11px] font-medium tracking-wide text-gray-400 uppercase">
                  {source}
                </p>
                {entries.map((document) => (
                  <button
                    key={document.id}
                    type="button"
                    onClick={() => setSelectedId(document.id)}
                    className={cn(
                      'w-full px-4 py-2.5 text-left transition-colors',
                      selected?.id === document.id ? 'bg-gray-100' : 'hover:bg-gray-100'
                    )}
                  >
                    <p className="truncate text-[14px] font-medium text-gray-950">
                      {document.title}
                    </p>
                    <p className="mt-0.5 truncate text-[12px] text-gray-400">
                      {truncate(stripHtml(document.document), 70)}
                    </p>
                  </button>
                ))}
              </div>
            ))}
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
      )}

      <ImportWizard open={importOpen} onOpenChange={setImportOpen} />
      <CreateArticleDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={setSelectedId}
      />
    </>
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
       <div id="input-container" className="mx-auto w-2xl"> <Input
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
          variant="ghost"
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

      <div className="px-5 py-5 w-3xl mx-auto">
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
