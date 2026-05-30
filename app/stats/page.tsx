'use client'

import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { createRatingHistoryEntry, loadRatingHistory, loadSessions, loadTournamentMatches, loadTournaments } from '@/lib/api'
import type { RatingHistoryEntry, RatingMetricType, Session, Tournament, TournamentMatch } from '@/lib/data'
import { legacyScoreToMatchScore, scoreLabel } from '@/lib/match-score'
import { BarChart3, Plus, Target, Trophy, Waves } from 'lucide-react'

const metricOptions: { value: RatingMetricType; label: string; lowerIsBetter: boolean }[] = [
  { value: 'utr_singles', label: 'UTR Singles', lowerIsBetter: false },
  { value: 'utr_doubles', label: 'UTR Doubles', lowerIsBetter: false },
  { value: 'wtn_singles', label: 'WTN Singles', lowerIsBetter: true },
  { value: 'wtn_doubles', label: 'WTN Doubles', lowerIsBetter: true },
  { value: 'custom_ranking', label: 'Custom Ranking', lowerIsBetter: true },
]

function matchOutcome(session: Session) {
  const result = `${session.result || ''}`.toLowerCase()
  if (/\b(won|win|victory)\b/.test(result)) return 'won'
  if (/\b(lost|loss|defeat)\b/.test(result)) return 'lost'
  if (/\b(unfinished|not finished)\b/.test(result)) return 'unfinished'
  return 'unknown'
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`
}

function groupSurfaces(sessions: Session[], tournaments: Tournament[]) {
  const counts = new Map<string, number>()
  sessions.forEach((session) => {
    const surface = session.surface || 'Not set'
    counts.set(surface, (counts.get(surface) ?? 0) + 1)
  })
  tournaments.forEach((tournament) => {
    const surface = tournament.surface || 'Not set'
    counts.set(surface, (counts.get(surface) ?? 0) + 1)
  })
  return [...counts.entries()].sort((a, b) => b[1] - a[1])
}

function entriesByLabel(entries: RatingHistoryEntry[]) {
  return entries.reduce<Record<string, RatingHistoryEntry[]>>((acc, entry) => {
    const key = entry.label || entry.metricType
    acc[key] = [...(acc[key] ?? []), entry]
    return acc
  }, {})
}

function trendText(entries: RatingHistoryEntry[]) {
  if (entries.length < 2) return 'Need 2 entries'
  const first = entries[0]
  const last = entries[entries.length - 1]
  const diff = last.value - first.value
  const improved = first.lowerIsBetter ? diff < 0 : diff > 0
  if (diff === 0) return 'No change'
  return `${improved ? 'Improved' : 'Down'} ${Math.abs(diff).toFixed(1)}`
}

function RatingTrend({ label, entries }: { label: string; entries: RatingHistoryEntry[] }) {
  const sorted = [...entries].sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime())
  const values = sorted.map((entry) => entry.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  return (
    <article className="rounded-card border border-border bg-surface p-5 shadow-card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-bold text-foreground">{label}</h2>
          <p className="mt-1 text-sm text-muted">{trendText(sorted)}</p>
        </div>
        <p className="font-mono text-xl font-semibold text-foreground">
          {sorted[sorted.length - 1]?.value ?? '-'}
        </p>
      </div>
      <div className="mt-5 flex h-32 items-end gap-2 border-b border-border">
        {sorted.map((entry) => {
          const height = 18 + ((entry.value - min) / range) * 82
          return (
            <div key={entry.id} className="flex flex-1 flex-col items-center gap-2">
              <div
                className="w-full max-w-10 rounded-t bg-accent"
                style={{ height: `${height}%` }}
                title={`${entry.eventDate}: ${entry.value}`}
              />
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex justify-between text-xs text-muted">
        <span>{sorted[0]?.eventDate}</span>
        <span>{sorted[sorted.length - 1]?.eventDate}</span>
      </div>
    </article>
  )
}

export default function StatsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [tournamentMatches, setTournamentMatches] = useState<TournamentMatch[]>([])
  const [ratings, setRatings] = useState<RatingHistoryEntry[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    metricType: 'utr_singles' as RatingMetricType,
    label: '',
    value: '',
    eventDate: new Date().toISOString().split('T')[0],
    notes: '',
  })

  useEffect(() => {
    loadSessions().then((loaded) => setSessions(loaded ?? []))
    loadTournaments().then((loaded) => setTournaments(loaded ?? []))
    loadTournamentMatches().then((loaded) => setTournamentMatches(loaded ?? []))
    loadRatingHistory().then((loaded) => setRatings(loaded ?? []))
  }, [])

  const practiceMatches = sessions.filter((session) => session.type === 'match')
  const practiceWins = practiceMatches.filter((session) => matchOutcome(session) === 'won').length
  const practiceLosses = practiceMatches.filter((session) => matchOutcome(session) === 'lost').length
  const practiceUnfinished = practiceMatches.filter((session) => matchOutcome(session) === 'unfinished').length
  const tournamentWins = tournamentMatches.filter((match) => match.result === 'won' || match.result === 'walkover').length
  const tournamentLosses = tournamentMatches.filter((match) => match.result === 'lost' || match.result === 'retired').length
  const tournamentUnfinished = tournamentMatches.filter((match) => match.result === 'unfinished').length
  const totalWins = practiceWins + tournamentWins
  const totalLosses = practiceLosses + tournamentLosses
  const totalUnfinished = practiceUnfinished + tournamentUnfinished
  const knownResults = practiceWins + practiceLosses
  const tournamentKnownResults = tournamentWins + tournamentLosses
  const totalKnownResults = knownResults + tournamentKnownResults
  const winRate = totalKnownResults ? (totalWins / totalKnownResults) * 100 : 0
  const practiceWinRate = knownResults ? (practiceWins / knownResults) * 100 : 0
  const tournamentWinRate = tournamentKnownResults ? (tournamentWins / tournamentKnownResults) * 100 : 0
  const surfaces = groupSurfaces(sessions, tournaments)
  const surfaceTotal = sessions.length + tournaments.length
  const groupedRatings = useMemo(() => entriesByLabel(ratings), [ratings])
  const selectedMetric = metricOptions.find((option) => option.value === form.metricType) ?? metricOptions[0]

  const saveRating = async () => {
    setSaving(true)
    setError('')

    try {
      const value = Number(form.value)
      if (!Number.isFinite(value)) throw new Error('Enter a numeric value.')

      const saved = await createRatingHistoryEntry({
        metricType: form.metricType,
        label: form.metricType === 'custom_ranking' ? form.label || 'Custom Ranking' : selectedMetric.label,
        value,
        eventDate: form.eventDate,
        lowerIsBetter: selectedMetric.lowerIsBetter,
        notes: form.notes || undefined,
      })

      if (!saved) throw new Error('Could not save ranking entry.')
      setRatings((prev) => [...prev, saved])
      setForm((prev) => ({ ...prev, value: '', notes: '' }))
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save ranking entry.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppShell title="Stats" subtitle="Match record, surfaces, ratings, and rankings">
      <PageHeader title="Stats" subtitle="Track your tennis activity and ranking progress." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard title="Sessions" value={sessions.length} subtitle="total" icon={<BarChart3 className="h-4 w-4" />} />
        <StatCard title="Practice Record" value={`${practiceWins}-${practiceLosses}-${practiceUnfinished}`} subtitle={`${practiceMatches.length} practice matches - ${formatPercent(practiceWinRate)}`} icon={<Target className="h-4 w-4" />} />
        <StatCard title="Tournament Record" value={`${tournamentWins}-${tournamentLosses}-${tournamentUnfinished}`} subtitle={`${tournamentMatches.length} tournament matches - ${formatPercent(tournamentWinRate)}`} icon={<Trophy className="h-4 w-4" />} />
        <StatCard title="Overall Record" value={`${totalWins}-${totalLosses}-${totalUnfinished}`} subtitle={`${formatPercent(winRate)} win rate`} icon={<Target className="h-4 w-4" />} />
        <StatCard title="Surfaces" value={surfaces.length} subtitle="played" icon={<Waves className="h-4 w-4" />} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="space-y-6">
          <div className="rounded-card border border-border bg-surface p-5 shadow-card">
            <h2 className="font-display text-lg font-bold text-foreground">Session Breakdown</h2>
            <div className="mt-4 space-y-3">
              {surfaces.length === 0 ? (
                <p className="text-sm text-muted">Log sessions to see surface distribution.</p>
              ) : (
                surfaces.map(([surface, count]) => (
                  <div key={surface}>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-foreground">{surface}</span>
                      <span className="text-muted">{count}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-background">
                      <div className="h-full bg-accent" style={{ width: `${(count / surfaceTotal) * 100}%` }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-card border border-border bg-surface p-5 shadow-card">
            <h2 className="font-display text-lg font-bold text-foreground">Tournament Matches</h2>
            <div className="mt-4 space-y-3">
              {tournamentMatches.length === 0 ? (
                <p className="text-sm text-muted">Add tournament matches to see opponent-level and tournament-record context here.</p>
              ) : (
                tournamentMatches.slice(0, 8).map((match) => (
                  <div key={match.id} className="rounded-lg border border-border bg-background p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{match.result} vs {match.opponentName || 'Opponent'}</p>
                        <p className="mt-1 text-xs text-muted">{match.date} · {match.round || 'round not set'} · {scoreLabel(match.scoreData ?? legacyScoreToMatchScore(match.score))}</p>
                      </div>
                      <p className="text-right text-xs text-muted">
                        UTR {match.opponentUtr ?? '-'}<br />WTN {match.opponentWtn ?? '-'}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div>
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="font-display text-xl font-bold text-foreground">Rating Progress</h2>
              <p className="text-sm text-muted">{ratings.length} entries</p>
            </div>
            {ratings.length === 0 ? (
              <div className="rounded-card border border-border bg-surface p-6 shadow-card">
                <p className="text-sm text-muted">
                  Add UTR, WTN, or custom ranking entries to start seeing progress over time.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {Object.entries(groupedRatings).map(([label, entries]) => (
                  <RatingTrend key={label} label={label} entries={entries} />
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="rounded-card border border-border bg-surface p-5 shadow-card h-fit">
          <h2 className="font-display text-lg font-bold text-foreground">Add Ranking Entry</h2>
          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-label text-muted">Metric</label>
              <select
                value={form.metricType}
                onChange={(event) => setForm((prev) => ({ ...prev, metricType: event.target.value as RatingMetricType }))}
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent"
              >
                {metricOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            {form.metricType === 'custom_ranking' && (
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-label text-muted">Ranking Name</label>
                <input
                  value={form.label}
                  onChange={(event) => setForm((prev) => ({ ...prev, label: event.target.value }))}
                  placeholder="National ranking"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent"
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-label text-muted">Value</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.value}
                  onChange={(event) => setForm((prev) => ({ ...prev, value: event.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-label text-muted">Date</label>
                <input
                  type="date"
                  value={form.eventDate}
                  onChange={(event) => setForm((prev) => ({ ...prev, eventDate: event.target.value }))}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-label text-muted">Notes</label>
              <textarea
                value={form.notes}
                onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                rows={3}
                placeholder="Optional context"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
            </div>
            <p className="text-xs leading-relaxed text-muted">
              UTR improves upward. WTN and custom rankings improve downward.
            </p>
            {error && <p className="text-sm text-danger">{error}</p>}
            <button
              type="button"
              onClick={saveRating}
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent/90 disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              {saving ? 'Saving...' : 'Add Entry'}
            </button>
          </div>
        </aside>
      </div>
    </AppShell>
  )
}
