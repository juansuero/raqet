'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState } from '@/components/EmptyState'
import { deleteSession, loadPlayer, loadSessions } from '@/lib/api'
import type { Player, Session } from '@/lib/data'
import { legacyScoreToMatchScore, normalizeMatchScore, scoreCell } from '@/lib/match-score'
import { Plus, Search, Filter, BookOpen, Clock, Zap, TrendingUp, Pencil, Trash2, CalendarDays } from 'lucide-react'

const sessionTypes = ['all', 'training', 'match', 'class', 'tournament', 'fitness']
const sortOptions = [
  { value: 'date-desc', label: 'Newest first' },
  { value: 'date-asc', label: 'Oldest first' },
  { value: 'intensity', label: 'Highest intensity' },
  { value: 'confidence', label: 'Highest confidence' },
]

function sessionMetaParts(session: Session) {
  return [
    session.status === 'planned' && session.scheduledStartAt ? new Date(session.scheduledStartAt).toLocaleString() : session.date,
    session.surface,
    session.location,
  ].filter(Boolean)
}

function PracticeScoreboard({ session, playerName }: { session: Session; playerName: string }) {
  const sets = normalizeMatchScore(session.scoreData ?? legacyScoreToMatchScore(session.score)).sets
  if (session.type !== 'match' || sets.length === 0) return null

  return (
    <div className="mt-3 max-w-md overflow-hidden rounded-lg border border-border bg-background">
      <div className="grid items-center border-b border-border" style={{ gridTemplateColumns: `minmax(0, 1fr) repeat(${sets.length}, 40px)` }}>
        <p className="truncate px-3 py-2 text-xs font-medium text-foreground">{playerName}</p>
        {sets.map((set, index) => (
          <p key={`player-${index}`} className="border-l border-border px-2 py-2 text-center font-mono text-xs text-foreground">{scoreCell(set, 'player')}</p>
        ))}
      </div>
      <div className="grid items-center" style={{ gridTemplateColumns: `minmax(0, 1fr) repeat(${sets.length}, 40px)` }}>
        <p className="truncate px-3 py-2 text-xs font-medium text-muted">{session.opponentName || 'Opponent'}</p>
        {sets.map((set, index) => (
          <p key={`opponent-${index}`} className="border-l border-border px-2 py-2 text-center font-mono text-xs text-muted">{scoreCell(set, 'opponent')}</p>
        ))}
      </div>
    </div>
  )
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [player, setPlayer] = useState<Player | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [sortBy, setSortBy] = useState('date-desc')
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    loadSessions().then((loaded) => {
      setSessions(loaded ?? [])
    })
    loadPlayer().then(setPlayer)
  }, [])

  let filtered = sessions.filter((s) => {
    const matchesSearch =
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
    const matchesType = typeFilter === 'all' || s.type === typeFilter
    return matchesSearch && matchesType
  })

  filtered = [...filtered].sort((a, b) => {
    if (sortBy === 'date-desc') return new Date(b.date).getTime() - new Date(a.date).getTime()
    if (sortBy === 'date-asc') return new Date(a.date).getTime() - new Date(b.date).getTime()
    if (sortBy === 'intensity') return b.intensity - a.intensity
    if (sortBy === 'confidence') return b.confidence - a.confidence
    return 0
  })

  const removeSession = async (id: string) => {
    setContextMenu(null)
    setError('')
    try {
      await deleteSession(id)
      setSessions((prev) => prev.filter((session) => session.id !== id))
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete session.')
    }
  }

  return (
    <AppShell title="Sessions" subtitle="Your training journal and match history">
      <PageHeader
        title="Session Journal"
        subtitle={`${sessions.length} sessions logged`}
        action={
          <Link
            href="/sessions/new"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Session
          </Link>
        }
      />

      {error && <p className="mb-4 rounded-lg border border-danger/20 bg-danger/5 p-3 text-sm text-danger">{error}</p>}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            placeholder="Search sessions, tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-surface border border-border rounded-lg text-sm outline-none focus:border-accent"
          />
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="pl-9 pr-8 py-2.5 bg-surface border border-border rounded-lg text-sm outline-none focus:border-accent appearance-none"
            >
              {sessionTypes.map((t) => (
                <option key={t} value={t}>
                  {t === 'all' ? 'All types' : t === 'match' ? 'Practice match' : t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-4 py-2.5 bg-surface border border-border rounded-lg text-sm outline-none focus:border-accent"
          >
            {sortOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No sessions found"
          description="Try adjusting your filters or log your first session."
          action={
            <Link
              href="/sessions/new"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent text-white rounded-lg text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              New Session
            </Link>
          }
        />
      ) : (
        <div className="space-y-3" onClick={() => setContextMenu(null)}>
          {filtered.map((session) => (
            <Link
              key={session.id}
              href={`/sessions/${session.id}`}
              onContextMenu={(event) => {
                event.preventDefault()
                setContextMenu({ id: session.id, x: event.clientX, y: event.clientY })
              }}
              className="block bg-surface border border-border rounded-card shadow-card hover:shadow-hover transition-shadow p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="min-w-0 truncate font-semibold text-foreground">{session.title}</h2>
                    {session.status === 'planned' && (
                      <span className="inline-flex flex-shrink-0 items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-warning/10 text-warning uppercase tracking-label">
                        Scheduled
                      </span>
                    )}
                    <span className="inline-flex flex-shrink-0 items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-accent-light text-accent uppercase tracking-label">
                      {session.type}
                    </span>
                  </div>
                  <p className="flex max-w-[54ch] flex-wrap gap-x-2 gap-y-1 text-sm text-muted">
                    {sessionMetaParts(session).map((item, index) => (
                      <span key={`${session.id}-${item}`} className="inline-flex items-center gap-2">
                        {index > 0 && <span aria-hidden="true">-</span>}
                        <span>{item}</span>
                      </span>
                    ))}
                  </p>
                  <div className="flex flex-wrap items-center gap-4 mt-3">
                    <div className="flex items-center gap-1.5 text-sm text-muted">
                      {session.status === 'planned' ? <CalendarDays className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                      {session.durationMinutes} min
                    </div>
                    {session.status !== 'planned' && (
                      <>
                        <div className="flex items-center gap-1.5 text-sm text-muted">
                          <Zap className="w-4 h-4" />
                          Intensity {session.intensity}/10
                        </div>
                        <div className="flex items-center gap-1.5 text-sm text-muted">
                          <TrendingUp className="w-4 h-4" />
                          Confidence {session.confidence}/10
                        </div>
                      </>
                    )}
                    {session.result && session.result !== 'unknown' && (
                      <div className="text-sm font-medium text-foreground">
                        {session.result}
                      </div>
                    )}
                  </div>
                  <PracticeScoreboard session={session} playerName={player?.name || 'You'} />
                  {session.aiSummary && (
                    <p className="text-sm text-muted mt-2 line-clamp-2">{session.aiSummary}</p>
                  )}
                  <div className="flex items-center gap-2 mt-3">
                    {session.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-background text-muted border border-border"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  {session.aiSummary && (
                    <span className="flex items-center gap-1 text-[10px] font-medium text-accent bg-accent-light px-2 py-1 rounded-full">
                      <BookOpen className="w-3 h-3" />
                      AI Debrief
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
      {contextMenu && (
        <div
          className="fixed z-50 min-w-40 overflow-hidden rounded-lg border border-border bg-surface shadow-card"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <Link
            href={`/sessions/new?edit=${contextMenu.id}`}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-background"
          >
            <Pencil className="h-4 w-4" /> Edit
          </Link>
          <button
            type="button"
            onClick={() => removeSession(contextMenu.id)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-danger hover:bg-danger/5"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      )}
    </AppShell>
  )
}
