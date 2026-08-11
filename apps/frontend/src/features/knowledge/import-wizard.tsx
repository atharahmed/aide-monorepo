import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Loader2, Search } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { queryKeys } from '@/lib/queries'
import type { HcDetectResponse, HcStatusResponse } from '@/types/api'

type Stage = 'enter' | 'detected' | 'importing' | 'done'

/**
 * Help-center import. Detect → confirm → poll for progress.
 *
 * Note for Phase 2: the v5 dashboard POSTed to `/v1/scrape/hc-scrape-completed`
 * while the backend registers it as GET, so that call 404'd in production. This
 * uses GET.
 */
export function ImportWizard({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()

  const [stage, setStage] = useState<Stage>('enter')
  const [url, setUrl] = useState('')
  const [detected, setDetected] = useState<HcDetectResponse>()
  const [status, setStatus] = useState<HcStatusResponse>()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()

  /* Reset whenever the dialog is reopened. */
  useEffect(() => {
    if (!open) return
    setStage('enter')
    setDetected(undefined)
    setStatus(undefined)
    setError(undefined)
  }, [open])

  /* Poll roughly once a second while a scrape is running. */
  useEffect(() => {
    if (stage !== 'importing') return

    const interval = window.setInterval(async () => {
      try {
        const next = await api.post<HcStatusResponse>('/v1/scrape/hc-status', {})
        setStatus(next)
        if (next.status === 'completed') {
          setStage('done')
          await queryClient.invalidateQueries({ queryKey: queryKeys.knowledge })
          await queryClient.invalidateQueries({ queryKey: queryKeys.me })
        }
        if (next.status === 'failed') {
          setStage('detected')
          setError('The import stopped partway. Try again, or import a different URL.')
        }
      } catch {
        /* A dropped poll is not fatal; the next tick retries. */
      }
    }, 1000)

    return () => window.clearInterval(interval)
  }, [stage, queryClient])

  const detect = async () => {
    setPending(true)
    setError(undefined)
    try {
      const result = await api.post<HcDetectResponse>('/v1/scrape/hc-detect', { url })
      if (!result.detected) {
        setError('No help centre found at that address. Check the URL and try again.')
        return
      }
      setDetected(result)
      setStage('detected')
    } catch {
      setError('Could not reach that address.')
    } finally {
      setPending(false)
    }
  }

  const startImport = async () => {
    setPending(true)
    try {
      await api.post('/v1/scrape/hc-scrape', { url: detected?.help_center_url ?? url })
      setStage('importing')
    } catch {
      setError('Could not start the import.')
    } finally {
      setPending(false)
    }
  }

  const progress = status
    ? Math.round((status.scraped_count / Math.max(1, status.total_count)) * 100)
    : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Import a help center</DialogTitle>
          <DialogDescription>
            Works with Zendesk, Intercom, Gorgias, Help Scout, Front and HelpDocs.
          </DialogDescription>
        </DialogHeader>

        {stage === 'enter' && (
          <div className="flex flex-col gap-3">
            <div>
              <Label htmlFor="hc-url">Your website or help center URL</Label>
              <Input
                id="hc-url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://yourcompany.com"
                className="mt-1.5"
                onKeyDown={(event) => event.key === 'Enter' && url && detect()}
              />
            </div>
            {error && <p className="text-[12.5px] text-destructive-600">{error}</p>}
          </div>
        )}

        {stage === 'detected' && detected && (
          <div className="flex flex-col gap-3">
            <div className="rounded-[8px] border border-gray-200 bg-gray-50 px-3.5 py-3">
              <p className="text-[13px] font-medium text-gray-950">{detected.help_center_url}</p>
              <p className="mt-1 text-[12.5px] text-gray-500">
                {detected.provider} · about {detected.article_count_estimate} articles
              </p>
            </div>
            <p className="text-[12.5px] leading-relaxed text-gray-500">
              Importing copies the article text into Aide's knowledge. Nothing is written back to
              your help centre.
            </p>
            {error && <p className="text-[12.5px] text-destructive-600">{error}</p>}
          </div>
        )}

        {stage === 'importing' && (
          <div className="flex flex-col gap-3">
            <Progress value={progress} />
            <p className="text-[12.5px] text-gray-500 tabular-nums">
              {status?.scraped_count ?? 0} of {status?.total_count ?? 0} articles imported
            </p>
          </div>
        )}

        {stage === 'done' && (
          <div className="flex items-start gap-2.5 rounded-[8px] border border-success-200 bg-success-50 px-3.5 py-3">
            <CheckCircle2 className="mt-px size-4 shrink-0 text-success-600" />
            <p className="text-[13px] leading-relaxed text-success-800">
              Imported {status?.total_count ?? 0} articles. Aide can answer from them right away.
            </p>
          </div>
        )}

        <DialogFooter>
          {stage === 'enter' && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={detect} disabled={!url.trim() || pending}>
                {pending ? <Loader2 className="animate-spin" /> : <Search />}
                Find help center
              </Button>
            </>
          )}

          {stage === 'detected' && (
            <>
              <Button variant="outline" onClick={() => setStage('enter')}>
                Use a different URL
              </Button>
              <Button onClick={startImport} disabled={pending}>
                {pending && <Loader2 className="animate-spin" />}
                Import articles
              </Button>
            </>
          )}

          {stage === 'importing' && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Continue in the background
            </Button>
          )}

          {stage === 'done' && (
            <Button
              onClick={() => {
                onOpenChange(false)
                toast.success('Help center imported')
              }}
            >
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
