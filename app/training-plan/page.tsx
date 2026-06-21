'use client'

import { useEffect, useMemo, useState } from 'react'
import { Check, Plus, Sparkles, Trash2 } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { GenerationProgressPanel } from '@/components/GenerationProgressPanel'
import { PageHeader } from '@/components/PageHeader'
import { createTrainingBlock, generateTrainingBlockDrafts, loadTrainingBlocks, updateTrainingBlock } from '@/lib/api'
import type { TrainingBlock } from '@/lib/data'

const emptyManual = {
  title: '',
  objective: '',
  category: 'tactical' as TrainingBlock['category'],
  priority: 'medium' as TrainingBlock['priority'],
  durationMinutes: 30,
  instructions: [''],
  successCriteria: [''],
}
const generationSteps = ['Reading recent evidence', 'Reviewing approved patterns', 'Building next-block focus', 'Writing success criteria']
const generationMessages = [
  'This creates a next training block, not a calendar week.',
  'Approved blocks should be small enough to attach to a real session.',
  'Strong success criteria should be observable after practice, not vague motivation.',
  'A good block usually targets one constraint: footwork, decision, tolerance, serve, return, or mindset.',
]

export default function TrainingPlanPage() {
  const [blocks, setBlocks] = useState<TrainingBlock[]>([])
  const [manual, setManual] = useState(emptyManual)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [view, setView] = useState<'active' | 'drafts' | 'manual'>('active')

  const drafts = useMemo(() => blocks.filter((block) => block.status === 'draft'), [blocks])
  const active = useMemo(() => blocks.filter((block) => block.status === 'approved'), [blocks])

  useEffect(() => {
    loadTrainingBlocks()
      .then((loaded) => {
        setBlocks(loaded ?? [])
        setError('')
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Training plan could not load.'))
      .finally(() => setLoading(false))
  }, [])

  const patchLocal = (id: string, patch: Partial<TrainingBlock>) => {
    setBlocks((prev) => prev.map((block) => block.id === id ? { ...block, ...patch } : block))
  }

  const save = async (block: TrainingBlock, patch: Partial<TrainingBlock>) => {
    const previous = blocks.find((item) => item.id === block.id)
    const next = { ...block, ...patch }
    patchLocal(block.id, patch)
    try {
      const saved = await updateTrainingBlock(next)
      if (saved) patchLocal(block.id, saved)
      else throw new Error('Training block save failed.')
      setError('')
    } catch (saveError) {
      if (previous) patchLocal(block.id, previous)
      setError(saveError instanceof Error ? saveError.message : 'Training block save failed.')
    }
  }

  const saveText = async (block: TrainingBlock, patch: Partial<TrainingBlock>) => {
    await save({ ...block, ...patch }, {})
  }

  const generate = async () => {
    setGenerating(true)
    setError('')
    try {
      const generated = await generateTrainingBlockDrafts()
      setBlocks((prev) => [...generated, ...prev])
      setView('drafts')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Training block generation failed.')
    } finally {
      setGenerating(false)
    }
  }

  const addManual = async () => {
    if (!manual.title.trim()) return
    setError('')
    try {
      const saved = await createTrainingBlock({
        ...manual,
        instructions: manual.instructions.map((item) => item.trim()).filter(Boolean),
        successCriteria: manual.successCriteria.map((item) => item.trim()).filter(Boolean),
      })
      if (!saved) throw new Error('Manual training block save failed.')
      setBlocks((prev) => [saved, ...prev])
      setManual(emptyManual)
      setView('active')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Manual training block save failed.')
    }
  }

  const editor = (block: TrainingBlock) => (
    <div key={block.id} className="rounded-card border border-border bg-surface p-5 shadow-card">
      <input value={block.title} onChange={(event) => patchLocal(block.id, { title: event.target.value })} onBlur={(event) => saveText(block, { title: event.target.value })} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base font-semibold text-foreground outline-none focus:border-accent" />
      <textarea value={block.objective} onChange={(event) => patchLocal(block.id, { objective: event.target.value })} onBlur={(event) => saveText(block, { objective: event.target.value })} rows={2} className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <select value={block.category} onChange={(event) => save(block, { category: event.target.value as TrainingBlock['category'] })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent">
          {['tactical', 'technical', 'mental', 'physical', 'serve', 'return', 'movement', 'matchplay'].map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <select value={block.priority} onChange={(event) => save(block, { priority: event.target.value as TrainingBlock['priority'] })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent">
          {['low', 'medium', 'high'].map((value) => <option key={value} value={value}>{value} priority</option>)}
        </select>
        <input type="number" min="0" value={block.durationMinutes} onChange={(event) => patchLocal(block.id, { durationMinutes: Number(event.target.value) })} onBlur={(event) => saveText(block, { durationMinutes: Number(event.target.value) })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
      </div>
      <textarea value={block.instructions.join('\n')} onChange={(event) => patchLocal(block.id, { instructions: event.target.value.split('\n') })} onBlur={(event) => saveText(block, { instructions: event.target.value.split('\n') })} rows={3} className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
      <textarea value={block.successCriteria.join('\n')} onChange={(event) => patchLocal(block.id, { successCriteria: event.target.value.split('\n') })} onBlur={(event) => saveText(block, { successCriteria: event.target.value.split('\n') })} rows={2} className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
      {block.evidenceSummary && <p className="mt-3 text-xs leading-5 text-muted">Evidence: {block.evidenceSummary}</p>}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        {block.status === 'draft' && <button type="button" onClick={() => save(block, { status: 'approved' })} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white"><Check className="h-4 w-4" />Approve block</button>}
        {block.status === 'draft' && <button type="button" onClick={() => save(block, { status: 'discarded' })} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-background"><Trash2 className="h-4 w-4" />Discard draft</button>}
      </div>
    </div>
  )

  return (
    <AppShell title="Training Plan" subtitle="Next training block">
      <PageHeader
        title="Training Plan"
        subtitle="Approved blocks are ready to attach to planned or completed sessions."
        action={
          <button type="button" onClick={generate} disabled={generating} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50">
            <Sparkles className="h-4 w-4" />
            {generating ? 'Generating...' : 'Generate blocks'}
          </button>
        }
      />
      {error && <p className="mb-4 rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>}
      {generating && <GenerationProgressPanel title="Generating training block drafts" steps={generationSteps} messages={generationMessages} />}
      {loading ? <p className="text-sm text-muted">Loading training blocks...</p> : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
            {[
              { id: 'active', label: `Active Plan (${active.length})` },
              { id: 'drafts', label: `Draft Review (${drafts.length})` },
              { id: 'manual', label: 'Manual Add' },
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

          {view === 'active' && (
            <section className="space-y-4">
              <div>
                <h2 className="font-display text-xl font-bold text-foreground">Active Plan</h2>
                <p className="mt-1 max-w-[60ch] text-sm text-muted">These approved blocks are the only blocks shown in session attachment.</p>
              </div>
              {active.length === 0 ? (
                <div className="rounded-card border border-border bg-surface p-6 shadow-card">
                  <p className="text-sm text-muted">No approved blocks yet. Generate drafts or add a manual block, then approve what belongs in the active plan.</p>
                </div>
              ) : (
                <div className="grid gap-4 xl:grid-cols-2">
                  {active.map(editor)}
                </div>
              )}
            </section>
          )}

          {view === 'drafts' && (
            <section className="space-y-4">
              <div>
                <h2 className="font-display text-xl font-bold text-foreground">Draft Review</h2>
                <p className="mt-1 max-w-[60ch] text-sm text-muted">Drafts stay out of the active plan until you approve them item by item.</p>
              </div>
              {drafts.length === 0 ? (
                <div className="rounded-card border border-border bg-surface p-6 shadow-card">
                  <p className="text-sm text-muted">No draft blocks. Generate drafts when you want the next block, not on a background schedule.</p>
                </div>
              ) : (
                <div className="grid gap-4 xl:grid-cols-2">
                  {drafts.map(editor)}
                </div>
              )}
            </section>
          )}

          {view === 'manual' && (
            <section className="max-w-2xl rounded-card border border-border bg-surface p-5 shadow-card">
              <h3 className="font-display text-sm font-bold uppercase tracking-label text-foreground">Manual Block</h3>
              <input value={manual.title} onChange={(event) => setManual((prev) => ({ ...prev, title: event.target.value }))} placeholder="Block title" className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
              <textarea value={manual.objective} onChange={(event) => setManual((prev) => ({ ...prev, objective: event.target.value }))} placeholder="Objective" rows={2} className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
              <textarea value={manual.instructions.join('\n')} onChange={(event) => setManual((prev) => ({ ...prev, instructions: event.target.value.split('\n') }))} placeholder="Instructions, one per line" rows={3} className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
              <textarea value={manual.successCriteria.join('\n')} onChange={(event) => setManual((prev) => ({ ...prev, successCriteria: event.target.value.split('\n') }))} placeholder="Success criteria, one per line" rows={3} className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
              <button type="button" onClick={addManual} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-background"><Plus className="h-4 w-4" />Add approved block</button>
            </section>
          )}
        </div>
      )}
    </AppShell>
  )
}
