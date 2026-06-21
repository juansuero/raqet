'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'

type GenerationProgressPanelProps = {
  title: string
  steps: string[]
  messages: string[]
}

export function GenerationProgressPanel({ title, steps, messages }: GenerationProgressPanelProps) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const interval = window.setInterval(() => setElapsed((value) => value + 1), 1000)
    return () => window.clearInterval(interval)
  }, [])

  const progress = Math.min(92, 12 + elapsed * 3)
  const activeStep = Math.min(steps.length - 1, Math.floor((progress / 100) * steps.length))
  const message = useMemo(() => messages[Math.floor(elapsed / 5) % messages.length], [elapsed, messages])

  return (
    <div className="mb-6 rounded-card border border-accent/20 bg-accent-light p-5 shadow-card">
      <div className="flex items-start gap-3">
        <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-accent" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-sm font-bold uppercase tracking-label text-foreground">{title}</h2>
            <span className="text-xs font-medium text-muted">{elapsed}s</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/70">
            <div className="h-full rounded-full bg-accent transition-all duration-700" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {steps.map((step, index) => (
              <p key={step} className={`text-xs ${index <= activeStep ? 'font-medium text-foreground' : 'text-muted'}`}>
                {step}
              </p>
            ))}
          </div>
          <p className="mt-4 max-w-[60ch] text-sm leading-6 text-muted">{message}</p>
        </div>
      </div>
    </div>
  )
}
