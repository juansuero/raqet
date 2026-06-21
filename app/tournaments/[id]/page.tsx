'use client'

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { useParams } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/PageHeader'
import {
  createTournamentMatch,
  createOpponent,
  deleteTournamentMatch,
  loadOpponents,
  loadPlayer,
  loadTournamentMatches,
  loadTournaments,
  updateTournamentMatch,
} from '@/lib/api'
import type { Opponent, Player, Tournament, TournamentMatch } from '@/lib/data'
import type { MatchScore, ScoreSetMode } from '@/lib/match-score'
import { formatMatchScore, legacyScoreToMatchScore, normalizeMatchScore, scoreCell } from '@/lib/match-score'
import { CalendarDays, Pencil, Plus, Trash2, Trophy } from 'lucide-react'

type SetScore = {
  mode: ScoreSetMode
  playerGames: string
  opponentGames: string
  playerTiebreakPoints: string
  opponentTiebreakPoints: string
}

const results: TournamentMatch['result'][] = ['won', 'lost', 'unfinished', 'walkover', 'retired', 'unknown']

const emptyMatchForm = {
  round: '',
  date: new Date().toISOString().split('T')[0],
  matchType: 'singles' as TournamentMatch['matchType'],
  opponentId: '',
  opponentName: '',
  partnerId: '',
  partnerName: '',
  opponentPartnerName: '',
  opponentUtr: '',
  opponentWtn: '',
  opponentRankingLabel: '',
  opponentRankingValue: '',
  result: 'unknown' as TournamentMatch['result'],
  durationMinutes: '',
  notes: '',
}

function defaultSetScores(): SetScore[] {
  return [
    { mode: 'set', playerGames: '', opponentGames: '', playerTiebreakPoints: '', opponentTiebreakPoints: '' },
    { mode: 'set', playerGames: '', opponentGames: '', playerTiebreakPoints: '', opponentTiebreakPoints: '' },
  ]
}

function scoreFromInputs(sets: SetScore[]): MatchScore {
  return normalizeMatchScore({
    sets: sets
      .filter((set) =>
        set.playerGames.trim() !== '' ||
        set.opponentGames.trim() !== '' ||
        set.playerTiebreakPoints.trim() !== '' ||
        set.opponentTiebreakPoints.trim() !== '',
      )
      .map((set) => ({
        mode: set.mode,
        playerGames: set.playerGames ? Number(set.playerGames) : undefined,
        opponentGames: set.opponentGames ? Number(set.opponentGames) : undefined,
        playerTiebreakPoints: set.playerTiebreakPoints ? Number(set.playerTiebreakPoints) : undefined,
        opponentTiebreakPoints: set.opponentTiebreakPoints ? Number(set.opponentTiebreakPoints) : undefined,
      })),
  })
}

function inputsFromScore(scoreData?: MatchScore, legacyScore?: string): SetScore[] {
  const parsed = normalizeMatchScore(scoreData ?? legacyScoreToMatchScore(legacyScore)).sets.map((set) => ({
    mode: set.mode,
    playerGames: set.playerGames?.toString() ?? '',
    opponentGames: set.opponentGames?.toString() ?? '',
    playerTiebreakPoints: set.playerTiebreakPoints?.toString() ?? '',
    opponentTiebreakPoints: set.opponentTiebreakPoints?.toString() ?? '',
  }))

  return parsed.length > 0 ? parsed : defaultSetScores()
}

function updateSetScores(sets: SetScore[], index: number, patch: Partial<SetScore>) {
  return sets.map((set, itemIndex) => {
    if (itemIndex !== index) return set
    const next = { ...set, ...patch }
    if (patch.mode === 'set' || patch.mode === 'match_tiebreak') {
      return { ...next, playerTiebreakPoints: '', opponentTiebreakPoints: '' }
    }
    return next
  })
}

function prettyResult(result: string) {
  return result.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}

function scoreModeLabel(mode: ScoreSetMode) {
  return mode === 'set_tiebreak' ? 'TB' : mode === 'match_tiebreak' ? 'MTB' : 'Set'
}

function ScoreInputs({
  setScores,
  setSetScores,
  playerName,
  opponentName,
}: {
  setScores: SetScore[]
  setSetScores: Dispatch<SetStateAction<SetScore[]>>
  playerName: string
  opponentName: string
}) {
  return (
    <div className="space-y-2">
      {setScores.map((set, index) => (
        <div key={index} className="rounded-lg border border-border bg-surface p-3">
          <div className="mb-2 grid grid-cols-[64px_1fr] items-center gap-2">
            <p className="text-xs font-medium text-muted">Set {index + 1}</p>
            <select
              value={set.mode}
              onChange={(event) => setSetScores((prev) => updateSetScores(prev, index, { mode: event.target.value as ScoreSetMode }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            >
              <option value="set">Set</option>
              <option value="set_tiebreak">Set with tiebreak</option>
              <option value="match_tiebreak">Match tiebreak</option>
            </select>
          </div>
          <div className="grid grid-cols-[64px_1fr_1fr] items-center gap-2">
            <p className="text-xs font-medium text-muted">{scoreModeLabel(set.mode)}</p>
            <input type="number" min="0" value={set.playerGames} onChange={(event) => setSetScores((prev) => updateSetScores(prev, index, { playerGames: event.target.value }))} placeholder={playerName} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
            <input type="number" min="0" value={set.opponentGames} onChange={(event) => setSetScores((prev) => updateSetScores(prev, index, { opponentGames: event.target.value }))} placeholder={opponentName || 'Opponent'} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
          </div>
          {set.mode === 'set_tiebreak' && (
            <div className="mt-2 grid grid-cols-[64px_1fr_1fr] items-center gap-2">
              <p className="text-xs font-medium text-muted">TB pts</p>
              <input type="number" min="0" value={set.playerTiebreakPoints} onChange={(event) => setSetScores((prev) => updateSetScores(prev, index, { playerTiebreakPoints: event.target.value }))} placeholder={playerName} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
              <input type="number" min="0" value={set.opponentTiebreakPoints} onChange={(event) => setSetScores((prev) => updateSetScores(prev, index, { opponentTiebreakPoints: event.target.value }))} placeholder={opponentName || 'Opponent'} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function MatchScoreboard({ match, playerName }: { match: TournamentMatch; playerName: string }) {
  const sets = normalizeMatchScore(match.scoreData ?? legacyScoreToMatchScore(match.score)).sets

  if (sets.length === 0) {
    return <p className="mt-3 text-sm text-muted">Score not set</p>
  }

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-border bg-background">
      <div
        className="grid items-center border-b border-border"
        style={{ gridTemplateColumns: `minmax(0, 1fr) repeat(${sets.length}, 44px)` }}
      >
        <p className="truncate px-3 py-2 text-sm font-medium text-foreground">{playerName}</p>
        {sets.map((set, index) => (
          <p key={`player-${index}`} className="border-l border-border px-2 py-2 text-center font-mono text-sm text-foreground">
            {scoreCell(set, 'player')}
          </p>
        ))}
      </div>
      <div
        className="grid items-center"
        style={{ gridTemplateColumns: `minmax(0, 1fr) repeat(${sets.length}, 44px)` }}
      >
        <p className="truncate px-3 py-2 text-sm font-medium text-muted">{match.opponentName || 'Opponent'}</p>
        {sets.map((set, index) => (
          <p key={`opponent-${index}`} className="border-l border-border px-2 py-2 text-center font-mono text-sm text-muted">
            {scoreCell(set, 'opponent')}
          </p>
        ))}
      </div>
    </div>
  )
}

export default function TournamentDetailPage() {
  const params = useParams<{ id: string }>()
  const tournamentId = params.id
  const [player, setPlayer] = useState<Player | null>(null)
  const [opponents, setOpponents] = useState<Opponent[]>([])
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [matches, setMatches] = useState<TournamentMatch[]>([])
  const [savingMatch, setSavingMatch] = useState(false)
  const [savingPerson, setSavingPerson] = useState(false)
  const [editingMatchId, setEditingMatchId] = useState('')
  const [error, setError] = useState('')
  const [matchForm, setMatchForm] = useState(emptyMatchForm)
  const [setScores, setSetScores] = useState<SetScore[]>(defaultSetScores)

  useEffect(() => {
    loadPlayer().then(setPlayer).catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Player profile could not load.'))
    loadOpponents()
      .then((loaded) => setOpponents(loaded ?? []))
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Opponents could not load.'))
    loadTournaments()
      .then((loaded) => {
        setTournament((loaded ?? []).find((item) => item.id === tournamentId) ?? null)
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Tournament could not load.'))
    loadTournamentMatches()
      .then((loaded) => {
        setMatches((loaded ?? []).filter((match) => match.tournamentId === tournamentId))
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Tournament matches could not load.'))
  }, [tournamentId])

  const record = useMemo(() => {
    const wins = matches.filter((match) => match.result === 'won' || match.result === 'walkover').length
    const losses = matches.filter((match) => match.result === 'lost' || match.result === 'retired').length
    const unfinished = matches.filter((match) => match.result === 'unfinished').length
    return unfinished ? `${wins}-${losses}-${unfinished}` : `${wins}-${losses}`
  }, [matches])

  const playerName = player?.name || 'You'

  const selectOpponent = (opponentId: string) => {
    const opponent = opponents.find((item) => item.id === opponentId)
    setMatchForm((prev) => ({
      ...prev,
      opponentId,
      opponentName: opponent?.name ?? '',
      opponentUtr: opponent?.utrSingles?.toString() ?? prev.opponentUtr,
      opponentWtn: opponent?.wtnSingles?.toString() ?? prev.opponentWtn,
      opponentRankingLabel: opponent?.rankingLabel ?? prev.opponentRankingLabel,
      opponentRankingValue: opponent?.rankingValue?.toString() ?? prev.opponentRankingValue,
    }))
  }

  const selectPartner = (partnerId: string) => {
    const partner = opponents.find((item) => item.id === partnerId)
    setMatchForm((prev) => ({ ...prev, partnerId, partnerName: partner?.name ?? '' }))
  }

  const saveManualPerson = async (kind: 'opponent' | 'partner') => {
    const name = kind === 'opponent' ? matchForm.opponentName.trim() : matchForm.partnerName.trim()
    if (!name) return
    setSavingPerson(true)
    try {
      const saved = await createOpponent({
        name,
        dominantHand: 'unknown',
        utrSingles: kind === 'opponent' && matchForm.opponentUtr ? Number(matchForm.opponentUtr) : undefined,
        wtnSingles: kind === 'opponent' && matchForm.opponentWtn ? Number(matchForm.opponentWtn) : undefined,
        rankingLabel: kind === 'opponent' ? matchForm.opponentRankingLabel || undefined : undefined,
        rankingValue: kind === 'opponent' && matchForm.opponentRankingValue ? Number(matchForm.opponentRankingValue) : undefined,
      })
      setOpponents((prev) => [...prev, saved].sort((a, b) => a.name.localeCompare(b.name)))
      setMatchForm((prev) => kind === 'opponent'
        ? { ...prev, opponentId: saved.id, opponentName: saved.name }
        : { ...prev, partnerId: saved.id, partnerName: saved.name })
    } finally {
      setSavingPerson(false)
    }
  }

  const resetMatchForm = () => {
    setEditingMatchId('')
    setMatchForm(emptyMatchForm)
    setSetScores(defaultSetScores())
  }

  const saveMatch = async () => {
    setSavingMatch(true)
    setError('')
    try {
      const scoreData = scoreFromInputs(setScores)
      const match: TournamentMatch = {
        id: editingMatchId || crypto.randomUUID(),
        tournamentId,
        round: matchForm.round,
        date: matchForm.date,
        matchType: matchForm.matchType,
        opponentId: matchForm.opponentId || undefined,
        opponentName: matchForm.opponentName,
        partnerId: matchForm.matchType === 'doubles' ? matchForm.partnerId || undefined : undefined,
        partnerName: matchForm.matchType === 'doubles' ? matchForm.partnerName || undefined : undefined,
        opponentPartnerName: matchForm.matchType === 'doubles' ? matchForm.opponentPartnerName || undefined : undefined,
        opponentUtr: matchForm.opponentUtr ? Number(matchForm.opponentUtr) : undefined,
        opponentWtn: matchForm.opponentWtn ? Number(matchForm.opponentWtn) : undefined,
        opponentRankingLabel: matchForm.opponentRankingLabel || undefined,
        opponentRankingValue: matchForm.opponentRankingValue ? Number(matchForm.opponentRankingValue) : undefined,
        score: formatMatchScore(scoreData),
        scoreData,
        result: matchForm.result,
        durationMinutes: matchForm.durationMinutes ? Number(matchForm.durationMinutes) : undefined,
        notes: matchForm.notes || undefined,
        createdAt: matches.find((item) => item.id === editingMatchId)?.createdAt ?? new Date().toISOString(),
      }

      const saved = editingMatchId ? await updateTournamentMatch(match) : await createTournamentMatch(match)
      if (!saved) throw new Error('Could not save match.')

      setMatches((prev) => {
        if (editingMatchId) {
          return prev.map((item) => (item.id === saved.id ? saved : item))
        }
        return [saved, ...prev]
      })
      resetMatchForm()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save match.')
    } finally {
      setSavingMatch(false)
    }
  }

  const startEditMatch = (match: TournamentMatch) => {
    setEditingMatchId(match.id)
    setMatchForm({
      round: match.round,
      date: match.date,
      matchType: match.matchType ?? 'singles',
      opponentId: match.opponentId ?? '',
      opponentName: match.opponentName,
      partnerId: match.partnerId ?? '',
      partnerName: match.partnerName ?? '',
      opponentPartnerName: match.opponentPartnerName ?? '',
      opponentUtr: match.opponentUtr?.toString() ?? '',
      opponentWtn: match.opponentWtn?.toString() ?? '',
      opponentRankingLabel: match.opponentRankingLabel ?? '',
      opponentRankingValue: match.opponentRankingValue?.toString() ?? '',
      result: match.result,
      durationMinutes: match.durationMinutes?.toString() ?? '',
      notes: match.notes ?? '',
    })
    setSetScores(inputsFromScore(match.scoreData, match.score))
  }

  const removeMatch = async (id: string) => {
    setError('')
    try {
      await deleteTournamentMatch(id)
      setMatches((prev) => prev.filter((match) => match.id !== id))
      if (editingMatchId === id) resetMatchForm()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete match.')
    }
  }

  if (!tournament) {
    return (
      <AppShell title="Tournament" subtitle="Tournament detail">
        <PageHeader title="Tournament Not Found" backHref="/tournaments" />
        <div className="rounded-card border border-border bg-surface p-6 shadow-card">
          <p className="text-sm text-muted">This tournament does not exist in your account.</p>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell title={tournament.name} subtitle={`${tournament.surface || 'Surface not set'} - ${record}`}>
      <PageHeader title={tournament.name} subtitle="Tournament detail and matches." backHref="/tournaments" />

      {error && <p className="mb-4 rounded-lg border border-danger/20 bg-danger/5 p-3 text-sm text-danger">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <section className="space-y-6">
          <div className="rounded-card border border-border bg-surface p-5 shadow-card">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-display text-2xl font-bold text-foreground">{tournament.name}</h2>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {tournament.startDate}{tournament.endDate ? ` to ${tournament.endDate}` : ''} - {tournament.location || 'location not set'}
                </p>
              </div>
              <div className="rounded-lg bg-background px-4 py-3 text-center">
                <p className="font-mono text-2xl font-semibold text-foreground">{record}</p>
                <p className="text-xs uppercase tracking-label text-muted">Record</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-background p-3">
                <p className="text-xs uppercase tracking-label text-muted">Surface</p>
                <p className="mt-1 font-medium text-foreground">{tournament.surface || 'Not set'}</p>
              </div>
              <div className="rounded-lg bg-background p-3">
                <p className="text-xs uppercase tracking-label text-muted">Level</p>
                <p className="mt-1 font-medium text-foreground">{tournament.level || 'Not set'}</p>
              </div>
              <div className="rounded-lg bg-background p-3">
                <p className="text-xs uppercase tracking-label text-muted">Draw</p>
                <p className="mt-1 font-medium text-foreground">{tournament.drawSize ?? 'Not set'}</p>
              </div>
            </div>
            {tournament.notes && <p className="mt-5 text-sm leading-6 text-muted">{tournament.notes}</p>}
          </div>

          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold text-foreground">Matches</h2>
              <p className="text-sm text-muted">{matches.length} logged</p>
            </div>
            {matches.length === 0 ? (
              <div className="rounded-card border border-border bg-surface p-6 text-center shadow-card">
                <Trophy className="mx-auto h-8 w-8 text-muted" />
                <p className="mt-3 text-sm text-muted">No matches logged for this tournament yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {matches.map((match) => (
                  <article key={match.id} className="rounded-card border border-border bg-surface p-4 shadow-card">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="font-display text-lg font-bold text-foreground">
                          {match.round || 'Round'} vs {match.opponentName || 'Opponent'}
                        </h3>
                        <p className="mt-1 text-sm text-muted">
                          {match.date} - {match.result} - {match.matchType === 'doubles' ? `Doubles${match.partnerName ? ` with ${match.partnerName}` : ''}` : 'Singles'}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-start gap-2">
                        <div className="hidden text-right text-xs text-muted sm:block">
                          <p>UTR {match.opponentUtr ?? '-'}</p>
                          <p>WTN {match.opponentWtn ?? '-'}</p>
                          {match.opponentRankingLabel && <p>{match.opponentRankingLabel} {match.opponentRankingValue ?? '-'}</p>}
                        </div>
                        <button
                          type="button"
                          onClick={() => startEditMatch(match)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-background hover:text-foreground"
                          aria-label="Edit match"
                          title="Edit match"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeMatch(match.id)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                          aria-label="Delete match"
                          title="Delete match"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <MatchScoreboard match={match} playerName={playerName} />
                    {(match.opponentUtr || match.opponentWtn || match.opponentRankingLabel) && (
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted sm:hidden">
                        <span>UTR {match.opponentUtr ?? '-'}</span>
                        <span>WTN {match.opponentWtn ?? '-'}</span>
                        {match.opponentRankingLabel && <span>{match.opponentRankingLabel} {match.opponentRankingValue ?? '-'}</span>}
                      </div>
                    )}
                    {match.notes && <p className="mt-3 text-sm leading-6 text-muted">{match.notes}</p>}
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="h-fit rounded-card border border-border bg-surface p-5 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold text-foreground">{editingMatchId ? 'Edit Match' : 'Add Match'}</h2>
            {editingMatchId && (
              <button type="button" onClick={resetMatchForm} className="text-sm font-medium text-muted hover:text-foreground">
                Cancel
              </button>
            )}
          </div>
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input value={matchForm.round} onChange={(event) => setMatchForm((prev) => ({ ...prev, round: event.target.value }))} placeholder="Round" className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent" />
              <input type="date" value={matchForm.date} onChange={(event) => setMatchForm((prev) => ({ ...prev, date: event.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent" />
            </div>
            <select value={matchForm.matchType} onChange={(event) => setMatchForm((prev) => ({ ...prev, matchType: event.target.value as TournamentMatch['matchType'] }))} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent">
              <option value="singles">Singles</option>
              <option value="doubles">Doubles</option>
            </select>
            <select value={matchForm.opponentId} onChange={(event) => selectOpponent(event.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent">
              <option value="">Manual / unsaved opponent</option>
              {opponents.map((opponent) => <option key={opponent.id} value={opponent.id}>{opponent.name}</option>)}
            </select>
            <div>
              <input value={matchForm.opponentName} onChange={(event) => setMatchForm((prev) => ({ ...prev, opponentName: event.target.value, opponentId: '' }))} placeholder="Opponent name" className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent" />
              {matchForm.opponentName && !matchForm.opponentId && (
                <button type="button" onClick={() => saveManualPerson('opponent')} disabled={savingPerson} className="mt-2 text-xs font-medium text-accent disabled:opacity-60">
                  {savingPerson ? 'Saving opponent...' : 'Save as opponent'}
                </button>
              )}
            </div>
            {matchForm.matchType === 'doubles' && (
              <>
                <select value={matchForm.partnerId} onChange={(event) => selectPartner(event.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent">
                  <option value="">Manual / unsaved partner</option>
                  {opponents.map((opponent) => <option key={opponent.id} value={opponent.id}>{opponent.name}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <input value={matchForm.partnerName} onChange={(event) => setMatchForm((prev) => ({ ...prev, partnerName: event.target.value, partnerId: '' }))} placeholder="Your partner" className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent" />
                    {matchForm.partnerName && !matchForm.partnerId && (
                      <button type="button" onClick={() => saveManualPerson('partner')} disabled={savingPerson} className="mt-2 text-xs font-medium text-accent disabled:opacity-60">
                        {savingPerson ? 'Saving partner...' : 'Save as partner'}
                      </button>
                    )}
                  </div>
                  <input value={matchForm.opponentPartnerName} onChange={(event) => setMatchForm((prev) => ({ ...prev, opponentPartnerName: event.target.value }))} placeholder="Opponent partner" className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent" />
                </div>
              </>
            )}
            <div className="grid grid-cols-2 gap-3">
              <input type="number" step="0.01" value={matchForm.opponentUtr} onChange={(event) => setMatchForm((prev) => ({ ...prev, opponentUtr: event.target.value }))} placeholder="Opponent UTR" className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent" />
              <input type="number" step="0.01" value={matchForm.opponentWtn} onChange={(event) => setMatchForm((prev) => ({ ...prev, opponentWtn: event.target.value }))} placeholder="Opponent WTN" className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input value={matchForm.opponentRankingLabel} onChange={(event) => setMatchForm((prev) => ({ ...prev, opponentRankingLabel: event.target.value }))} placeholder="Ranking name" className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent" />
              <input type="number" value={matchForm.opponentRankingValue} onChange={(event) => setMatchForm((prev) => ({ ...prev, opponentRankingValue: event.target.value }))} placeholder="Ranking value" className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent" />
            </div>

            <div className="rounded-lg border border-border bg-background p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-xs font-medium uppercase tracking-label text-muted">Score by set</p>
                <button
                  type="button"
                  onClick={() => setSetScores((prev) => [...prev, { mode: 'set', playerGames: '', opponentGames: '', playerTiebreakPoints: '', opponentTiebreakPoints: '' }])}
                  className="inline-flex items-center gap-1 text-xs font-medium text-accent"
                >
                  <Plus className="h-3.5 w-3.5" /> Add set
                </button>
              </div>
              <ScoreInputs setScores={setScores} setSetScores={setSetScores} playerName={playerName} opponentName={matchForm.opponentName} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <select value={matchForm.result} onChange={(event) => setMatchForm((prev) => ({ ...prev, result: event.target.value as TournamentMatch['result'] }))} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent">
                {results.map((result) => <option key={result} value={result}>{prettyResult(result)}</option>)}
              </select>
              <input type="number" value={matchForm.durationMinutes} onChange={(event) => setMatchForm((prev) => ({ ...prev, durationMinutes: event.target.value }))} placeholder="Duration minutes" className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent" />
            </div>
            <textarea value={matchForm.notes} onChange={(event) => setMatchForm((prev) => ({ ...prev, notes: event.target.value }))} rows={3} placeholder="Match notes, patterns, pressure moments" className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent" />
            <button type="button" onClick={saveMatch} disabled={savingMatch} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-60">
              <CalendarDays className="h-4 w-4" /> {savingMatch ? 'Saving...' : editingMatchId ? 'Save Match' : 'Add Match'}
            </button>
          </div>
        </aside>
      </div>
    </AppShell>
  )
}
