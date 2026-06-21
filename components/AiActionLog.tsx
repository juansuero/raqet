'use client'

import { useEffect, useState } from 'react'
import { Activity, CheckCircle, XCircle } from 'lucide-react'
import { type AiActionLog, loadAiActionLogs } from '@/lib/api'

const actionLabels: Record<string, string> = {
  onboarding_transcription: 'Onboarding transcription',
  profile_compile: 'Profile draft',
  session_transcription: 'Session transcription',
  session_debrief: 'Session debrief',
  clip_analysis: 'Clip analysis',
  coach_chat: 'Coach chat',
}

function formatDuration(durationMs: number) {
  if (durationMs < 1000) return `${durationMs} ms`
  return `${(durationMs / 1000).toFixed(1)} s`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function AiActionLogCard() {
  const [logs, setLogs] = useState<AiActionLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadAiActionLogs().then((loaded) => {
      setLogs(loaded ?? [])
      setError('')
      setLoading(false)
    }).catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : 'AI action log could not load.')
      setLoading(false)
    })
  }, [])

  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2 px-1">
        <Activity className="h-4 w-4 text-muted" />
        <h2 className="font-display text-sm font-bold tracking-label uppercase text-muted">
          AI action log
        </h2>
      </div>

      <div className="overflow-hidden rounded-card border border-border bg-surface shadow-card divide-y divide-border">
        {loading && <p className="px-5 py-4 text-sm text-muted">Loading recent AI actions...</p>}
        {!loading && error && <p className="px-5 py-4 text-sm text-danger">{error}</p>}
        {!loading && !error && logs.length === 0 && (
          <p className="px-5 py-4 text-sm text-muted">No AI actions logged yet.</p>
        )}
        {!loading && logs.map((log) => {
          const failed = log.status === 'failed'
          const Icon = failed ? XCircle : CheckCircle

          return (
            <div key={log.id} className="px-5 py-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <Icon className={`mt-0.5 h-4 w-4 flex-shrink-0 ${failed ? 'text-danger' : 'text-success'}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {actionLabels[log.action_type] ?? log.action_type}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {log.status} · {formatDuration(log.duration_ms)}
                      {log.error_code ? ` · ${log.error_code}` : ''}
                    </p>
                  </div>
                </div>
                <time className="flex-shrink-0 text-xs text-muted" dateTime={log.created_at}>
                  {formatDate(log.created_at)}
                </time>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
