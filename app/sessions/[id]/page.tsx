'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/PageHeader'
import { AIInsightBox } from '@/components/AIInsightBox'
import { deleteSession, loadPlayer, loadSessionTrainingBlocks, loadSessions, loadTrainingBlocks } from '@/lib/api'
import type { Player, Session, SessionTrainingBlockLink, TrainingBlock } from '@/lib/data'
import { legacyScoreToMatchScore, normalizeMatchScore, scoreCell } from '@/lib/match-score'
import {
  Clock,
  Zap,
  TrendingUp,
  FileText,
  Lightbulb,
  Pencil,
  Trash2,
} from 'lucide-react'

const tabs = ['Summary', 'AI Analysis', 'Notes']

function PracticeScoreboard({ session, playerName }: { session: Session; playerName: string }) {
  const sets = normalizeMatchScore(session.scoreData ?? legacyScoreToMatchScore(session.score)).sets
  if (session.type !== 'match' || sets.length === 0) return null

  return (
    <div className="overflow-hidden rounded-card border border-border bg-surface shadow-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="font-display text-sm font-bold uppercase tracking-label text-foreground">Practice Match Score</h2>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[320px]">
          <div className="grid items-center border-b border-border" style={{ gridTemplateColumns: `minmax(0, 1fr) repeat(${sets.length}, 52px)` }}>
            <p className="truncate px-4 py-3 text-sm font-medium text-foreground">{playerName}</p>
            {sets.map((set, index) => (
              <p key={`player-${index}`} className="border-l border-border px-3 py-3 text-center font-mono text-sm text-foreground">{scoreCell(set, 'player')}</p>
            ))}
          </div>
          <div className="grid items-center" style={{ gridTemplateColumns: `minmax(0, 1fr) repeat(${sets.length}, 52px)` }}>
            <p className="truncate px-4 py-3 text-sm font-medium text-muted">{session.opponentName || 'Opponent'}</p>
            {sets.map((set, index) => (
              <p key={`opponent-${index}`} className="border-l border-border px-3 py-3 text-center font-mono text-sm text-muted">{scoreCell(set, 'opponent')}</p>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SessionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [player, setPlayer] = useState<Player | null>(null)
  const [trainingBlocks, setTrainingBlocks] = useState<TrainingBlock[]>([])
  const [blockLinks, setBlockLinks] = useState<SessionTrainingBlockLink[]>([])
  const [activeTab, setActiveTab] = useState('Summary')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const id = String(params.id)
    loadSessions()
      .then((loaded) => setSession((loaded ?? []).find((item) => item.id === id) ?? null))
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : 'Session could not load.')
        setSession(null)
      })
    loadPlayer().then(setPlayer).catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Player profile could not load.'))
    loadTrainingBlocks()
      .then((loaded) => setTrainingBlocks(loaded ?? []))
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Training blocks could not load.'))
    loadSessionTrainingBlocks(id)
      .then((loaded) => setBlockLinks(loaded ?? []))
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Session training blocks could not load.'))
  }, [params.id])

  if (session === undefined) {
    return (
      <AppShell title="Session">
        <PageHeader title="Loading Session" backHref="/sessions" />
        <p className="text-muted">Loading your session...</p>
      </AppShell>
    )
  }

  if (!session) {
    return (
      <AppShell title="Session Not Found">
        <PageHeader title="Session Not Found" backHref="/sessions" />
        <p className="text-muted">This session does not exist.</p>
      </AppShell>
    )
  }

  const isPlanned = session.status === 'planned'
  const linkedBlocks = blockLinks
    .map((link) => ({ link, block: trainingBlocks.find((block) => block.id === link.trainingBlockId) }))
    .filter((item): item is { link: SessionTrainingBlockLink; block: TrainingBlock } => Boolean(item.block))

  const handleDelete = async () => {
    if (!window.confirm('Delete this session? This cannot be undone.')) return
    setDeleting(true)
    try {
      await deleteSession(session.id)
      router.push('/sessions')
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete session.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <AppShell title={session.title} subtitle={`${session.date} · ${session.surface}`}>
      <PageHeader
        title={session.title}
        subtitle={`${session.date} · ${session.type} · ${session.surface}`}
        backHref="/sessions"
        action={
          <div className="flex gap-2">
            <Link
              href={`/sessions/new?edit=${session.id}`}
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-surface text-foreground transition-colors hover:bg-background"
              aria-label="Edit session"
              title="Edit session"
            >
              <Pencil className="w-4 h-4" />
            </Link>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-surface text-danger transition-colors hover:bg-background disabled:opacity-50"
              aria-label="Delete session"
              title="Delete session"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        }
      />

      {error && <p className="mb-4 rounded-lg border border-danger/20 bg-danger/5 p-3 text-sm text-danger">{error}</p>}

      {/* Session Meta */}
      <div className={`grid grid-cols-2 gap-4 mb-6 ${isPlanned ? 'sm:grid-cols-3' : 'sm:grid-cols-4'}`}>
        <div className="bg-surface border border-border rounded-card p-4">
          <div className="flex items-center gap-2 text-muted mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-xs tracking-label uppercase font-medium">Duration</span>
          </div>
          <p className="text-lg font-display font-bold text-foreground">{session.durationMinutes} min</p>
        </div>
        {isPlanned ? (
          <>
            <div className="bg-surface border border-border rounded-card p-4">
              <div className="flex items-center gap-2 text-muted mb-1">
                <FileText className="w-4 h-4" />
                <span className="text-xs tracking-label uppercase font-medium">Status</span>
              </div>
              <p className="text-lg font-display font-bold text-foreground">Scheduled</p>
            </div>
            <div className="bg-surface border border-border rounded-card p-4">
              <div className="flex items-center gap-2 text-muted mb-1">
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs tracking-label uppercase font-medium">Energy Before</span>
              </div>
              <p className="text-lg font-display font-bold text-foreground">{session.energyBefore}/10</p>
            </div>
          </>
        ) : (
          <>
            <div className="bg-surface border border-border rounded-card p-4">
              <div className="flex items-center gap-2 text-muted mb-1">
                <Zap className="w-4 h-4" />
                <span className="text-xs tracking-label uppercase font-medium">Intensity</span>
              </div>
              <p className="text-lg font-display font-bold text-foreground">{session.intensity}/10</p>
            </div>
            <div className="bg-surface border border-border rounded-card p-4">
              <div className="flex items-center gap-2 text-muted mb-1">
                <TrendingUp className="w-4 h-4" />
                <span className="text-xs tracking-label uppercase font-medium">Confidence</span>
              </div>
              <p className="text-lg font-display font-bold text-foreground">{session.confidence}/10</p>
            </div>
            <div className="bg-surface border border-border rounded-card p-4">
              <div className="flex items-center gap-2 text-muted mb-1">
                <FileText className="w-4 h-4" />
                <span className="text-xs tracking-label uppercase font-medium">Result</span>
              </div>
              <p className="text-lg font-display font-bold text-foreground">{session.result && session.result !== 'unknown' ? session.result : 'N/A'}</p>
            </div>
          </>
        )}
      </div>

      {/* Tabs */}
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

      {/* Tab Content */}
      {activeTab === 'Summary' && (
        <div className="space-y-6">
          <PracticeScoreboard session={session} playerName={player?.name || 'You'} />

          <div className="bg-surface border border-border rounded-card shadow-card p-5">
            <h2 className="font-display text-lg font-bold tracking-label uppercase text-foreground mb-3">
              Session Overview
            </h2>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted">Location:</span>{' '}
                <span className="text-foreground font-medium">{session.location}</span>
              </div>
              <div>
                <span className="text-muted">Opponent:</span>{' '}
                <span className="text-foreground font-medium">{session.opponentName || 'N/A'}</span>
              </div>
              <div>
                <span className="text-muted">Main Focus:</span>{' '}
                <span className="text-foreground font-medium">{session.mainFocus}</span>
              </div>
              <div>
                <span className="text-muted">Energy Before:</span>{' '}
                <span className="text-foreground font-medium">{session.energyBefore}/10</span>
              </div>
              {!isPlanned && (
                <div>
                  <span className="text-muted">Energy After:</span>{' '}
                  <span className="text-foreground font-medium">{session.energyAfter}/10</span>
                </div>
              )}
            </div>
          </div>

          {session.aiSummary && (
            <AIInsightBox type="insight" title="AI Summary">
              {session.aiSummary}
            </AIInsightBox>
          )}

          {session.mainTakeaway && (
            <div className="readable-panel bg-surface border border-border rounded-card shadow-card p-5">
              <h2 className="font-display text-lg font-bold tracking-label uppercase text-foreground mb-3">
                Main Takeaway
              </h2>
              <p className="text-sm text-foreground leading-relaxed">{session.mainTakeaway}</p>
            </div>
          )}

          {session.nextFocus && (
            <div className="readable-panel bg-accent-light border border-accent-muted/30 rounded-card p-5">
              <div className="flex items-start gap-3">
                <Lightbulb className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                <div>
                  <h2 className="font-display text-sm font-bold tracking-label uppercase text-foreground mb-1">
                    Next Focus
                  </h2>
                  <p className="text-sm text-foreground leading-relaxed">{session.nextFocus}</p>
                </div>
              </div>
            </div>
          )}

          {linkedBlocks.length > 0 && (
            <div className="rounded-card border border-border bg-surface p-5 shadow-card">
              <h2 className="font-display text-lg font-bold tracking-label uppercase text-foreground mb-3">
                Training Block Context
              </h2>
              <div className="space-y-3">
                {linkedBlocks.map(({ link, block }) => (
                  <div key={link.id} className="rounded-lg border border-border bg-background p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{block.title}</p>
                        <p className="mt-1 max-w-[54ch] text-xs leading-5 text-muted">{block.objective}</p>
                      </div>
                      <span className="inline-flex w-fit rounded-full bg-accent-light px-2 py-1 text-[10px] font-semibold uppercase tracking-label text-accent">
                        {link.completionStatus}
                      </span>
                    </div>
                    {link.successCriteriaNotes && <p className="mt-2 text-xs leading-5 text-muted">{link.successCriteriaNotes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'AI Analysis' && (
        <div className="space-y-6">
          {session.whatWentWell && (
            <div className="bg-surface border border-border rounded-card shadow-card p-5">
              <h2 className="font-display text-lg font-bold tracking-label uppercase text-success mb-3">
                What Went Well
              </h2>
              <ul className="space-y-2">
                {session.whatWentWell.map((item, i) => (
                  <li key={i} className="text-sm text-foreground flex items-start gap-2">
                    <span className="text-success mt-0.5">✓</span> {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {session.whatWentWrong && (
            <div className="bg-surface border border-border rounded-card shadow-card p-5">
              <h2 className="font-display text-lg font-bold tracking-label uppercase text-danger mb-3">
                What Went Wrong
              </h2>
              <ul className="space-y-2">
                {session.whatWentWrong.map((item, i) => (
                  <li key={i} className="text-sm text-foreground flex items-start gap-2">
                    <span className="text-danger mt-0.5">×</span> {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {session.profileMemoryUpdate && (
            <AIInsightBox type="insight" title="Player Memory Update">
              {session.profileMemoryUpdate}
            </AIInsightBox>
          )}
        </div>
      )}

      {activeTab === 'Notes' && (
        <div className="space-y-6">
          <div className="readable-panel bg-surface border border-border rounded-card shadow-card p-5">
            <h2 className="font-display text-lg font-bold tracking-label uppercase text-foreground mb-3">
              Original Notes
            </h2>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
              {session.rawNotes}
            </p>
          </div>

          {session.transcript && (
            <div className="readable-panel bg-surface border border-border rounded-card shadow-card p-5">
              <h2 className="font-display text-lg font-bold tracking-label uppercase text-foreground mb-3">
                Voice Transcript
              </h2>
              <p className="max-w-[54ch] text-sm text-muted leading-relaxed italic">
                "{session.transcript}"
              </p>
            </div>
          )}
        </div>
      )}
    </AppShell>
  )
}
