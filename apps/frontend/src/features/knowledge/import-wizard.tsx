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
import { toNumber } from '@/lib/format'
import type { HcDetectResponse, HcStatusResponse } from '@/types/api'

type Stage = 'enter' | 'detected' | 'importing' | 'done'

const HELP_CENTER_LABELS: Record<string, string> = {
  ZENDESK_HC: 'Zendesk help center',
  FRONT_HC: 'Front knowledge base',
  INTERCOM_HC: 'Intercom help center',
  GORGIAS_HC: 'Gorgias help center',
  HELPSCOUT_HC: 'Help Scout docs',
  HELPDOCS_IO_HC: 'HelpDocs site',
}

/**
 * Help-center import. Detect → confirm → poll for progress.
 *
 * The status endpoint has no "finished" flag: it describes the help centre
 * currently importing, and answers with an empty body once none is. An empty
 * reply after work has started is therefore the completion signal.
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

  /* Poll while a scrape is running. */
  useEffect(() => {
    if (stage !== 'importing') return

    const interval = window.setInterval(async () => {
      try {
        const next = await api.post<HcStatusResponse | null>('/v1/scrape/hc-status', {})

        /* Empty body: nothing is importing any more, so this one finished. */
        if (!next) {
          setStage('done')
          void api.get('/v1/scrape/hc-scrape-completed').catch(() => {})
          await queryClient.invalidateQueries({ queryKey: queryKeys.knowledge })
          await queryClient.invalidateQueries({ queryKey: queryKeys.me })
          return
        }

        setStatus(next)
      } catch {
        /* A dropped poll is not fatal; the next tick retries. */
      }
    }, 1500)

    return () => window.clearInterval(interval)
  }, [stage, queryClient])

  const detect = async () => {
    setPending(true)
    setError(undefined)
    try {
      const result = await api.post<HcDetectResponse>('/v1/scrape/hc-detect', { url })
      /* No `hc_type` means nothing recognisable was found at that address. */
      if (!result?.hc_type) {
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
    if (!detected?.hc_type) return

    setPending(true)
    try {
      await api.post('/v1/scrape/hc-scrape', {
        url: detected.url ?? url,
        hc_type: detected.hc_type,
      })
      setStatus(undefined)
      setStage('importing')
    } catch {
      setError('Could not start the import.')
    } finally {
      setPending(false)
    }
  }

  const imported = toNumber(status?.imported_so_far)
  const total = toNumber(status?.importing_out_of)
  const progress = total > 0 ? Math.round((imported / total) * 100) : 0

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
              <p className="text-[19px] font-medium text-gray-950">{detected.url ?? url}</p>
              <p className="mt-1 text-[12.5px] text-gray-500">
                {HELP_CENTER_LABELS[detected.hc_type!] ?? 'Help center'} detected
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
              {total > 0 ? `${imported} of ${total} articles imported` : 'Starting the import…'}
            </p>
          </div>
        )}

        {stage === 'done' && (
          <div className="flex items-start gap-2.5 rounded-[8px] border border-success-200 bg-success-50 px-3.5 py-3">
            <CheckCircle2 className="mt-px size-4 shrink-0 text-success-600" />
            <p className="text-[13px] leading-relaxed text-success-800">
              {total > 0 ? `Imported ${total} articles. ` : 'Import finished. '}
              Aide can answer from them right away.
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
