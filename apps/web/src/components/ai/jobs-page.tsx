'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Download, LoaderCircle, Play } from 'lucide-react'
import { toast } from 'sonner'
import { apiFetch } from '@markless/shared/src/lib/http/client'
import { useLocale } from '@/hooks/use-locale'
import { Button } from '@/components/ui/button'

type Job = { id: string; featureKey: string; status: string; credits: number; createdAt: string;
  output: { kind?: string; value?: unknown } | null }
type Feature = { key: string; credits: number }

export function AiJobsPage() {
  const { dictionary } = useLocale()
  const copy = dictionary.app.ai.jobs
  const [jobs, setJobs] = useState<Job[]>([])
  const [features, setFeatures] = useState<Feature[]>([])
  const [selected, setSelected] = useState('')
  const [prompt, setPrompt] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const requestKeyRef = useRef<string | null>(null)
  const refresh = useCallback(async () => {
    try {
      const response = await apiFetch('/api/ai/jobs')
      if (!response.ok) throw new Error('Job list unavailable')
      const data = await response.json()
      setJobs(data.jobs)
      setFeatures(data.features)
      setSelected(current => current || data.features[0]?.key || '')
      setLoadError(false)
    } catch { setLoadError(true) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    void refresh()
    const timer = window.setInterval(() => void refresh(), 10000)
    return () => window.clearInterval(timer)
  }, [refresh])

  async function submit() {
    if (!selected || !prompt.trim() || busy) return
    setBusy(true)
    try {
      const response = await apiFetch('/api/ai/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestKey: requestKeyRef.current ||= crypto.randomUUID(), featureKey: selected, prompt }) })
      const result = await response.json()
      if (!response.ok || !result.ok) {
        const key = String(result.error || '').split('.').at(-1) as keyof typeof copy.error
        throw new Error(copy.error[key] || copy.error.pending)
      }
      requestKeyRef.current = null
      setPrompt('')
      await refresh()
    } catch (error) { toast.error(error instanceof Error ? error.message : copy.error.pending) }
    finally { setBusy(false) }
  }

  const statusLabel = (status: string) => {
    if (status === 'succeeded') return copy.status.succeeded
    if (status === 'failed' || status === 'canceled') return copy.status.failed
    if (status === 'unknown') return copy.status.unknown
    if (status === 'reserved') return copy.status.reserved
    return copy.status.processing
  }

  return <div className="space-y-8">
    <header>
      <h1 className="text-2xl font-semibold text-slate-900">{copy.page.title}</h1>
      <p className="mt-2 text-sm text-slate-600">{copy.page.description}</p>
    </header>
    {loading ? <p className="text-sm text-slate-600">{copy.page.loading}</p> :
    loadError ? <button type="button" className="text-sm font-medium text-emerald-700 hover:underline"
      onClick={() => void refresh()}>{copy.page.loadError} {copy.action.retry}</button> :
    features.length === 0 ? <p className="text-sm text-slate-600">{copy.page.disabled}</p> :
      <div className="max-w-2xl space-y-4">
        <select aria-label={copy.page.title} value={selected} onChange={event => { setSelected(event.target.value); requestKeyRef.current = null }}
          className="w-full rounded border border-slate-300 bg-white px-3 py-2">
          {features.map(feature => <option key={feature.key} value={feature.key}>{feature.key} · {feature.credits} {copy.page.credits}</option>)}
        </select>
        <label className="block text-sm font-medium text-slate-800" htmlFor="ai-prompt">{copy.page.prompt}</label>
        <textarea id="ai-prompt" className="min-h-32 w-full rounded border border-slate-300 p-3" maxLength={2000}
          value={prompt} onChange={event => { setPrompt(event.target.value); requestKeyRef.current = null }} />
        <Button disabled={!selected || !prompt.trim() || busy} onClick={() => void submit()}>
          {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Play className="size-4" />}{copy.action.submit}
        </Button>
      </div>}
    <section>
      {jobs.length === 0 ? <p className="text-sm text-slate-500">{copy.page.empty}</p> :
        <div className="divide-y border-y border-slate-200">
          {jobs.map(job => <div key={job.id} className="flex items-center justify-between gap-4 py-3 text-sm">
            <div className="min-w-0"><p className="font-medium text-slate-900">{job.featureKey}</p>
              <p className="text-slate-500">{new Date(job.createdAt).toLocaleString()} · {statusLabel(job.status)}</p></div>
            {job.status === 'succeeded' && job.output?.kind === 'asset' ?
              <a href={`/api/ai/jobs/${job.id}/asset`} className="inline-flex items-center gap-2 text-brand-700">
                <Download className="size-4" />{copy.action.download}</a> : null}
            {job.status === 'succeeded' && (job.output?.kind === 'text' || job.output?.kind === 'json') ?
              <pre className="max-h-32 max-w-md overflow-auto whitespace-pre-wrap break-all text-xs text-slate-700">
                {job.output.kind === 'text' ? String(job.output.value) : JSON.stringify(job.output.value, null, 2)}
              </pre> : null}
          </div>)}
        </div>}
    </section>
  </div>
}
