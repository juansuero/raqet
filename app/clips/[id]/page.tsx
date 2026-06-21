'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/PageHeader'
import { loadClips } from '@/lib/api'
import type { Clip } from '@/lib/data'
import { Calendar, Target, TrendingUp, Video } from 'lucide-react'

const tabs = ['Tactical Analysis', 'Technical Analysis', 'Key Decision']

export default function ClipDetailPage() {
  const params = useParams()
  const [clip, setClip] = useState<Clip | null | undefined>(undefined)
  const [activeTab, setActiveTab] = useState('Tactical Analysis')
  const [error, setError] = useState('')

  useEffect(() => {
    const id = String(params.id)
    loadClips()
      .then((loaded) => {
        setClip((loaded ?? []).find((item) => item.id === id) ?? null)
        setError('')
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : 'Clip could not load.')
        setClip(null)
      })
  }, [params.id])

  if (clip === undefined) {
    return (
      <AppShell title="Clip">
        <PageHeader title="Loading Clip" backHref="/clips" />
        <p className="text-muted">Loading your clip...</p>
      </AppShell>
    )
  }

  if (!clip) {
    return (
      <AppShell title="Clip Not Found">
        <PageHeader title="Clip Not Found" backHref="/clips" />
        <p className={error ? 'text-danger' : 'text-muted'}>{error || 'This clip does not exist in your account.'}</p>
      </AppShell>
    )
  }

  return (
    <AppShell title={clip.title} subtitle={`${clip.clipType} - ${clip.pointResult}`}>
      <PageHeader
        title={clip.title}
        subtitle={`${clip.durationSeconds}s - ${clip.clipType} - ${clip.pointResult}`}
        backHref="/clips"
      />

      <div className="aspect-video bg-foreground rounded-card flex items-center justify-center mb-6 relative overflow-hidden">
        <Video className="w-12 h-12 text-muted" />
        <div className="absolute bottom-4 left-4 right-4">
          <div className="h-1 bg-white/20 rounded-full overflow-hidden">
            <div className="h-full w-1/3 bg-accent rounded-full" />
          </div>
          <div className="flex justify-between mt-2 text-xs text-white/70 font-mono">
            <span>0:00</span>
            <span>0:{clip.durationSeconds}</span>
          </div>
        </div>
        {clip.scoreContext && (
          <div className="absolute top-4 left-4 px-2 py-1 bg-black/60 rounded text-xs text-white font-mono">
            {clip.scoreContext}
          </div>
        )}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="min-w-0 rounded-card border border-border bg-surface p-4">
          <div className="mb-1 flex min-w-0 items-center gap-2 text-muted">
            <Target className="w-4 h-4" />
            <span className="min-w-0 text-xs font-medium uppercase tracking-label">Decision</span>
          </div>
          <p className="text-2xl font-display font-bold text-foreground">{clip.decisionQuality}/10</p>
        </div>
        <div className="min-w-0 rounded-card border border-border bg-surface p-4">
          <div className="mb-1 flex min-w-0 items-center gap-2 text-muted">
            <TrendingUp className="w-4 h-4" />
            <span className="min-w-0 text-xs font-medium uppercase tracking-label">Review</span>
          </div>
          <p className="text-2xl font-display font-bold text-foreground">{clip.contentScore}/10</p>
        </div>
        <div className="min-w-0 rounded-card border border-border bg-surface p-4">
          <div className="mb-1 flex min-w-0 items-center gap-2 text-muted">
            <Video className="w-4 h-4" />
            <span className="min-w-0 text-xs font-medium uppercase tracking-label">Type</span>
          </div>
          <p className="min-w-0 break-words font-display text-lg font-bold capitalize text-foreground">{clip.clipType.replace('_', ' ')}</p>
        </div>
        <div className="min-w-0 rounded-card border border-border bg-surface p-4">
          <div className="mb-1 flex min-w-0 items-center gap-2 text-muted">
            <Calendar className="w-4 h-4" />
            <span className="min-w-0 text-xs font-medium uppercase tracking-label">Result</span>
          </div>
          <p className="min-w-0 break-words font-display text-lg font-bold capitalize text-foreground">{clip.pointResult}</p>
        </div>
      </div>

      <div className="flex gap-1 mb-6 border-b border-border overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab
                ? 'border-accent text-accent'
                : 'border-transparent text-muted hover:text-foreground'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Tactical Analysis' && (
        <div className="space-y-4">
          <div className="readable-panel bg-surface border border-border rounded-card shadow-card p-5">
            <h2 className="font-display text-sm font-bold tracking-label uppercase text-muted mb-2">Tactical Breakdown</h2>
            <p className="text-sm text-foreground leading-relaxed">{clip.tacticalBreakdown || 'No tactical breakdown saved yet.'}</p>
          </div>
          <div className="readable-panel bg-surface border border-border rounded-card shadow-card p-5">
            <h2 className="font-display text-sm font-bold tracking-label uppercase text-muted mb-2">Score Context</h2>
            <p className="text-sm text-foreground">{clip.scoreContext || 'No score context provided.'}</p>
          </div>
          <div className="readable-panel bg-surface border border-border rounded-card shadow-card p-5">
            <h2 className="font-display text-sm font-bold tracking-label uppercase text-muted mb-2">Player Intention</h2>
            <p className="text-sm text-foreground">{clip.playerIntention || 'No intention recorded.'}</p>
          </div>
        </div>
      )}

      {activeTab === 'Technical Analysis' && (
        <div className="space-y-4">
          <div className="readable-panel bg-surface border border-border rounded-card shadow-card p-5">
            <h2 className="font-display text-sm font-bold tracking-label uppercase text-muted mb-2">Technical Notes</h2>
            <p className="text-sm text-foreground leading-relaxed">{clip.technicalNotes || 'No technical notes saved yet.'}</p>
          </div>
          <div className="readable-panel bg-surface border border-border rounded-card shadow-card p-5">
            <h2 className="font-display text-sm font-bold tracking-label uppercase text-muted mb-2">AI Analysis</h2>
            <p className="text-sm text-foreground leading-relaxed">{clip.aiAnalysis || 'No AI analysis saved yet.'}</p>
          </div>
        </div>
      )}

      {activeTab === 'Key Decision' && (
        <div className="space-y-4">
          <div className="readable-panel bg-accent-light border border-accent-muted/30 rounded-card p-5">
            <h2 className="font-display text-sm font-bold tracking-label uppercase text-accent mb-2">Decision Quality: {clip.decisionQuality}/10</h2>
            <p className="text-sm text-foreground leading-relaxed">
              {clip.decisionQuality >= 8
                ? 'Strong decision-making. The moment is worth keeping as a positive reference.'
                : clip.decisionQuality >= 6
                ? 'Useful review moment. The intention may be sound, but execution or court position needs review.'
                : 'Flag this point for review. The decision likely came from pressure, fatigue, or poor court position.'}
            </p>
          </div>
        </div>
      )}
    </AppShell>
  )
}
