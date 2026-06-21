'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, Sparkles, Trash2 } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { GenerationProgressPanel } from '@/components/GenerationProgressPanel'
import { PageHeader } from '@/components/PageHeader'
import { generatePatternDrafts, loadPatterns, updatePattern } from '@/lib/api'
import type { Pattern } from '@/lib/data'

const categories: Pattern['category'][] = ['tactical', 'technical', 'mental', 'physical', 'serve', 'return', 'movement', 'decision_making']
const generationSteps = ['Reading completed sessions', 'Checking confirmed memory', 'Comparing approved patterns', 'Drafting evidence-backed patterns']
const generationMessages = [
  'Raqet only uses completed sessions, tournament matches, confirmed memories, and approved patterns here.',
  'Good pattern detection is conservative: fewer drafts are better than confident noise.',
  'A useful pattern should connect to evidence you can inspect later.',
  'Uncertainty is part of the output. Weak evidence should stay low confidence.',
]

export default function PatternsPage() {
  const [patterns, setPatterns] = useState<Pattern[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [view, setView] = useState<'approved' | 'drafts'>('approved')

  const draftPatterns = useMemo(() => patterns.filter((pattern) => pattern.status === 'draft'), [patterns])
  const approvedPatterns = useMemo(() => patterns.filter((pattern) => pattern.status === 'approved'), [patterns])

  useEffect(() => {
    loadPatterns()
      .then((loaded) => {
        setPatterns(loaded ?? [])
        setError('')
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Patterns could not load.'))
      .finally(() => setLoading(false))
  }, [])

  const patchLocal = (id: string, patch: Partial<Pattern>) => {
    setPatterns((prev) => prev.map((pattern) => pattern.id === id ? { ...pattern, ...patch } : pattern))
  }

  const save = async (pattern: Pattern, patch: Partial<Pattern>) => {
    const next = { ...pattern, ...patch }
    const previous = patterns.find((item) => item.id === pattern.id)
    patchLocal(pattern.id, patch)
    try {
      const saved = await updatePattern(next)
      if (saved) patchLocal(pattern.id, saved)
      else throw new Error('Pattern save failed.')
      setError('')
    } catch (saveError) {
      if (previous) patchLocal(pattern.id, previous)
      setError(saveError instanceof Error ? saveError.message : 'Pattern save failed.')
    }
  }

  const saveText = async (pattern: Pattern, patch: Partial<Pattern>) => {
    await save({ ...pattern, ...patch }, {})
  }

  const generate = async () => {
    setGenerating(true)
    setError('')
    try {
      const drafts = await generatePatternDrafts()
      setPatterns((prev) => [...drafts, ...prev])
      setView('drafts')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pattern generation failed.')
    } finally {
      setGenerating(false)
    }
  }

  const patternEditor = (pattern: Pattern) => (
    <div key={pattern.id} className="rounded-card border border-border bg-surface p-5 shadow-card">
      <input value={pattern.title} onChange={(event) => patchLocal(pattern.id, { title: event.target.value })} onBlur={(event) => saveText(pattern, { title: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base font-semibold text-foreground outline-none focus:border-accent" />
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <select value={pattern.category} onChange={(event) => save(pattern, { category: event.target.value as Pattern['category'] })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent">
          {categories.map((category) => <option key={category} value={category}>{category}</option>)}
        </select>
        <select value={pattern.confidence} onChange={(event) => save(pattern, { confidence: event.target.value as Pattern['confidence'] })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent">
          {['low', 'medium', 'high'].map((value) => <option key={value} value={value}>{value} confidence</option>)}
        </select>
        <select value={pattern.trend} onChange={(event) => save(pattern, { trend: event.target.value as Pattern['trend'] })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent">
          {['new', 'stable', 'improving', 'worsening'].map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
      </div>
      <textarea value={pattern.description} onChange={(event) => patchLocal(pattern.id, { description: event.target.value })} onBlur={(event) => saveText(pattern, { description: event.target.value })} rows={3} className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
      <textarea value={pattern.recommendation} onChange={(event) => patchLocal(pattern.id, { recommendation: event.target.value })} onBlur={(event) => saveText(pattern, { recommendation: event.target.value })} rows={2} className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
      <p className="mt-3 text-xs leading-5 text-muted">Evidence: {pattern.evidenceCount} item(s). {pattern.evidenceSummary || 'No evidence summary.'}</p>
      {pattern.uncertainty && <p className="mt-1 text-xs leading-5 text-muted">Uncertainty: {pattern.uncertainty}</p>}
      {pattern.status === 'draft' && (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button type="button" onClick={() => save(pattern, { status: 'approved' })} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white"><Check className="h-4 w-4" />Approve pattern</button>
          <button type="button" onClick={() => save(pattern, { status: 'discarded' })} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-background"><Trash2 className="h-4 w-4" />Discard draft</button>
        </div>
      )}
    </div>
  )

  return (
    <AppShell title="Patterns" subtitle="Recurring signals from your sessions">
      <PageHeader
        title="Detected Patterns"
        subtitle="Approved patterns become durable context. Drafts stay separate until you review them."
        action={
          <button type="button" onClick={generate} disabled={generating} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50">
            <Sparkles className="h-4 w-4" />
            {generating ? 'Generating...' : 'Generate patterns'}
          </button>
        }
      />

      {error && <p className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}
      {generating && <GenerationProgressPanel title="Generating pattern drafts" steps={generationSteps} messages={generationMessages} />}
      {loading ? <p className="text-sm text-muted">Loading patterns...</p> : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
            {[
              { id: 'approved', label: `Approved Patterns (${approvedPatterns.length})` },
              { id: 'drafts', label: `Draft Review (${draftPatterns.length})` },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id as typeof view)}
                className={`min-h-11 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  view === item.id
                    ? 'bg-accent text-white'
                    : 'border border-border bg-surface text-muted hover:text-foreground'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {view === 'approved' && (
            <section className="space-y-4">
              <div>
                <h2 className="font-display text-xl font-bold text-foreground">Approved Patterns</h2>
                <p className="mt-1 max-w-[60ch] text-sm text-muted">These are durable player memories used as context in future AI work.</p>
              </div>
              {approvedPatterns.length === 0 ? (
                <div className="rounded-card border border-border bg-surface p-6 shadow-card">
                  <p className="text-sm text-muted">No approved patterns yet. Generate drafts and approve only the patterns you trust.</p>
                </div>
              ) : (
                <div className="grid gap-4 xl:grid-cols-2">
                  {approvedPatterns.map(patternEditor)}
                </div>
              )}
            </section>
          )}

          {view === 'drafts' && (
            <section className="space-y-4">
              <div>
                <h2 className="font-display text-xl font-bold text-foreground">Draft Review</h2>
                <p className="mt-1 max-w-[60ch] text-sm text-muted">Draft patterns stay out of memory until you edit and approve them.</p>
              </div>
              {draftPatterns.length === 0 ? (
                <div className="rounded-card border border-border bg-surface p-6 shadow-card">
                  <p className="text-sm text-muted">No draft patterns. Generate when you have enough real sessions, match logs, tournament matches, or confirmed memories.</p>
                </div>
              ) : (
                <div className="grid gap-4 xl:grid-cols-2">
                  {draftPatterns.map(patternEditor)}
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </AppShell>
  )
}
