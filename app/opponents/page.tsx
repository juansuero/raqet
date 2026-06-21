'use client'

import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/PageHeader'
import { createOpponent, deleteOpponent, loadOpponents, loadSessions, loadTournamentMatches, updateOpponent } from '@/lib/api'
import type { Opponent, Session, TournamentMatch } from '@/lib/data'
import { legacyScoreToMatchScore, normalizeMatchScore } from '@/lib/match-score'
import { Pencil, Plus, Save, Trash2, X } from 'lucide-react'

type OpponentForm = {
  name: string
  style: string
  dominantHand: Opponent['dominantHand']
  utrSingles: string
  wtnSingles: string
  rankingLabel: string
  rankingValue: string
  notes: string
}

const emptyForm: OpponentForm = {
  name: '',
  style: '',
  dominantHand: 'unknown',
  utrSingles: '',
  wtnSingles: '',
  rankingLabel: '',
  rankingValue: '',
  notes: '',
}

function formFromOpponent(opponent: Opponent): OpponentForm {
  return {
    name: opponent.name,
    style: opponent.style ?? '',
    dominantHand: opponent.dominantHand ?? 'unknown',
    utrSingles: opponent.utrSingles?.toString() ?? '',
    wtnSingles: opponent.wtnSingles?.toString() ?? '',
    rankingLabel: opponent.rankingLabel ?? '',
    rankingValue: opponent.rankingValue?.toString() ?? '',
    notes: opponent.notes ?? '',
  }
}

function opponentFromForm(form: OpponentForm, existing?: Opponent): Opponent {
  return {
    id: existing?.id ?? crypto.randomUUID(),
    playerId: existing?.playerId,
    name: form.name.trim(),
    style: form.style.trim() || undefined,
    dominantHand: form.dominantHand,
    utrSingles: form.utrSingles ? Number(form.utrSingles) : undefined,
    wtnSingles: form.wtnSingles ? Number(form.wtnSingles) : undefined,
    rankingLabel: form.rankingLabel.trim() || undefined,
    rankingValue: form.rankingValue ? Number(form.rankingValue) : undefined,
    notes: form.notes.trim() || undefined,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
  }
}

function matchOutcome(match: Session | TournamentMatch) {
  const result = `${match.result || ''}`.toLowerCase()
  if (/\b(won|win|victory|walkover)\b/.test(result)) return 'won'
  if (/\b(lost|loss|defeat|retired)\b/.test(result)) return 'lost'
  if (/\b(unfinished|not finished)\b/.test(result)) return 'unfinished'

  const sets = normalizeMatchScore(match.scoreData ?? legacyScoreToMatchScore(match.score)).sets
  const setScore = sets.reduce(
    (total, set) => {
      if (set.playerGames === undefined || set.opponentGames === undefined || set.playerGames === set.opponentGames) return total
      return set.playerGames > set.opponentGames
        ? { ...total, player: total.player + 1 }
        : { ...total, opponent: total.opponent + 1 }
    },
    { player: 0, opponent: 0 },
  )

  if (setScore.player > setScore.opponent) return 'won'
  if (setScore.opponent > setScore.player) return 'lost'
  return 'unknown'
}

function opponentKeyFromMatch(match: Session | TournamentMatch) {
  return match.opponentId || match.opponentName?.trim().toLowerCase() || ''
}

function partnerKeyFromMatch(match: Session | TournamentMatch) {
  return match.partnerId || match.partnerName?.trim().toLowerCase() || ''
}

export default function OpponentsPage() {
  const [opponents, setOpponents] = useState<Opponent[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [tournamentMatches, setTournamentMatches] = useState<TournamentMatch[]>([])
  const [form, setForm] = useState<OpponentForm>(emptyForm)
  const [editingId, setEditingId] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const refreshOpponents = () => loadOpponents()
    .then((loaded) => {
      setOpponents(loaded ?? [])
      setError('')
    })
    .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Opponents could not load.'))

  useEffect(() => {
    refreshOpponents()
    loadSessions()
      .then((loaded) => setSessions(loaded ?? []))
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Session history could not load.'))
    loadTournamentMatches()
      .then((loaded) => setTournamentMatches(loaded ?? []))
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Tournament matches could not load.'))
  }, [])

  const stats = useMemo(() => {
    const byKey = new Map<string, { vsPlayed: number; vsWins: number; vsLosses: number; withPlayed: number; withWins: number; withLosses: number; lastDate: string }>()
    const ensure = (key: string) => byKey.get(key) ?? { vsPlayed: 0, vsWins: 0, vsLosses: 0, withPlayed: 0, withWins: 0, withLosses: 0, lastDate: '' }
    const addOpponentMatch = (match: Session | TournamentMatch) => {
      const key = opponentKeyFromMatch(match)
      if (!key) return
      const current = ensure(key)
      current.vsPlayed += 1
      const outcome = matchOutcome(match)
      if (outcome === 'won') current.vsWins += 1
      if (outcome === 'lost') current.vsLosses += 1
      if (!current.lastDate || match.date > current.lastDate) current.lastDate = match.date
      byKey.set(key, current)
    }
    const addPartnerMatch = (match: Session | TournamentMatch) => {
      const key = partnerKeyFromMatch(match)
      if (!key) return
      const current = ensure(key)
      current.withPlayed += 1
      const outcome = matchOutcome(match)
      if (outcome === 'won') current.withWins += 1
      if (outcome === 'lost') current.withLosses += 1
      if (!current.lastDate || match.date > current.lastDate) current.lastDate = match.date
      byKey.set(key, current)
    }

    sessions.filter((session) => session.type === 'match').forEach((match) => {
      addOpponentMatch(match)
      if (match.matchType === 'doubles') addPartnerMatch(match)
    })
    tournamentMatches.forEach((match) => {
      addOpponentMatch(match)
      if (match.matchType === 'doubles') addPartnerMatch(match)
    })
    return byKey
  }, [sessions, tournamentMatches])

  const resetForm = () => {
    setEditingId('')
    setForm(emptyForm)
  }

  const saveOpponent = async () => {
    setError('')
    const existing = opponents.find((opponent) => opponent.id === editingId)
    const payload = opponentFromForm(form, existing)
    if (!payload.name) {
      setError('Opponent name is required.')
      return
    }

    setSaving(true)
    try {
      const saved = existing ? await updateOpponent(payload) : await createOpponent(payload)
      setOpponents((prev) => existing ? prev.map((item) => item.id === saved.id ? saved : item) : [...prev, saved].sort((a, b) => a.name.localeCompare(b.name)))
      resetForm()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save opponent.')
    } finally {
      setSaving(false)
    }
  }

  const removeOpponent = async (id: string) => {
    setError('')
    try {
      await deleteOpponent(id)
      setOpponents((prev) => prev.filter((opponent) => opponent.id !== id))
      if (editingId === id) resetForm()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete opponent.')
    }
  }

  return (
    <AppShell title="Opponents & Partners" subtitle="Track matchup history, doubles partners, and scouting notes">
      <PageHeader title="Opponents & Partners" subtitle="Save recurring players and connect matches to their history." />

      {error && <p className="mb-4 rounded-lg border border-danger/20 bg-danger/5 p-3 text-sm text-danger">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="rounded-card border border-border bg-surface shadow-card">
          <div className="grid grid-cols-[minmax(0,1.4fr)_110px_110px_96px] gap-3 border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-label text-muted">
            <p>Player</p>
            <p>Vs record</p>
            <p>With record</p>
            <p>Last</p>
          </div>
          {opponents.length === 0 ? (
            <div className="p-6 text-sm text-muted">No saved opponents yet. Add the first one from the panel.</div>
          ) : (
            <div className="divide-y divide-border">
              {opponents.map((opponent) => {
                const record = stats.get(opponent.id) ?? stats.get(opponent.name.trim().toLowerCase()) ?? { vsPlayed: 0, vsWins: 0, vsLosses: 0, withPlayed: 0, withWins: 0, withLosses: 0, lastDate: '' }
                return (
                  <article key={opponent.id} className="grid grid-cols-[minmax(0,1.4fr)_110px_110px_96px] items-center gap-3 px-4 py-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{opponent.name}</p>
                      <p className="mt-1 truncate text-xs text-muted">
                        {[opponent.style, opponent.dominantHand && opponent.dominantHand !== 'unknown' ? `${opponent.dominantHand} handed` : '', opponent.utrSingles ? `UTR ${opponent.utrSingles}` : '', opponent.wtnSingles ? `WTN ${opponent.wtnSingles}` : ''].filter(Boolean).join(' - ') || 'No scouting data'}
                      </p>
                    </div>
                    <p className="font-mono text-sm text-foreground">{record.vsWins}-{record.vsLosses} <span className="text-xs text-muted">({record.vsPlayed})</span></p>
                    <p className="font-mono text-sm text-foreground">{record.withWins}-{record.withLosses} <span className="text-xs text-muted">({record.withPlayed})</span></p>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm text-muted">{record.lastDate || '-'}</span>
                      <span className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(opponent.id)
                            setForm(formFromOpponent(opponent))
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-background hover:text-foreground"
                          aria-label="Edit opponent"
                          title="Edit opponent"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeOpponent(opponent.id)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-danger/10 hover:text-danger"
                          aria-label="Delete opponent"
                          title="Delete opponent"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </span>
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>

        <aside className="h-fit rounded-card border border-border bg-surface p-5 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold text-foreground">{editingId ? 'Edit Opponent' : 'Add Opponent'}</h2>
            {editingId && (
              <button type="button" onClick={resetForm} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-background hover:text-foreground" aria-label="Cancel edit">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="mt-4 space-y-3">
            <input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Opponent name" className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent" />
            <input value={form.style} onChange={(event) => setForm((prev) => ({ ...prev, style: event.target.value }))} placeholder="Style, e.g. counter-puncher" className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent" />
            <select value={form.dominantHand} onChange={(event) => setForm((prev) => ({ ...prev, dominantHand: event.target.value as Opponent['dominantHand'] }))} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent">
              <option value="unknown">Hand unknown</option>
              <option value="right">Right handed</option>
              <option value="left">Left handed</option>
            </select>
            <div className="grid grid-cols-2 gap-3">
              <input type="number" step="0.01" value={form.utrSingles} onChange={(event) => setForm((prev) => ({ ...prev, utrSingles: event.target.value }))} placeholder="UTR" className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent" />
              <input type="number" step="0.01" value={form.wtnSingles} onChange={(event) => setForm((prev) => ({ ...prev, wtnSingles: event.target.value }))} placeholder="WTN" className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input value={form.rankingLabel} onChange={(event) => setForm((prev) => ({ ...prev, rankingLabel: event.target.value }))} placeholder="Ranking name" className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent" />
              <input type="number" value={form.rankingValue} onChange={(event) => setForm((prev) => ({ ...prev, rankingValue: event.target.value }))} placeholder="Value" className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent" />
            </div>
            <textarea value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} rows={4} placeholder="Scouting notes, patterns, tendencies" className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent" />
            <button type="button" onClick={saveOpponent} disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-60">
              {editingId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {saving ? 'Saving...' : editingId ? 'Save Opponent' : 'Add Opponent'}
            </button>
          </div>
        </aside>
      </div>
    </AppShell>
  )
}
