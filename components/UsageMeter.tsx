'use client'

import { useEffect, useState } from 'react'
import { loadUsage } from '@/lib/api'

type Usage = {
  limit: number
  used: number
  remaining: number
  resetAt: string
}

function formatResetDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value))
}

export function UsageMeter({ compact = false }: { compact?: boolean }) {
  const [usage, setUsage] = useState<Usage | null>(null)

  useEffect(() => {
    loadUsage().then((loaded) => {
      if (loaded) setUsage(loaded)
    })
  }, [])

  if (!usage) return null

  const percent = usage.limit > 0 ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 0

  return (
    <section className={compact ? 'px-3 py-2' : 'rounded-card border border-border bg-surface p-5 shadow-card'}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-label text-muted">AI actions</p>
        <p className="font-mono text-xs font-semibold text-foreground">
          {usage.remaining}/{usage.limit} left
        </p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full border border-border bg-background">
        <div
          className="h-full w-full origin-left bg-accent transition-transform"
          style={{ transform: `scaleX(${percent / 100})` }}
        />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted">
        Resets {formatResetDate(usage.resetAt)}
      </p>
    </section>
  )
}
