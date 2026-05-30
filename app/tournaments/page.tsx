'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/PageHeader'
import { createTournament, deleteTournament, loadPlayer, loadTournamentMatches, loadTournaments, updateTournament } from '@/lib/api'
import type { Player, Tournament, TournamentMatch } from '@/lib/data'
import { Pencil, Plus, Trash2, Trophy } from 'lucide-react'

const surfaces = ['Hard', 'Grass', 'Clay', 'Carpet', 'Other']

type TournamentForm = {
  id?: string
  name: string
  startDate: string
  endDate: string
  location: string
  surface: string
  level: string
  drawSize: string
  result: string
  notes: string
}

const emptyTournamentForm = (): TournamentForm => ({
  name: '',
  startDate: new Date().toISOString().split('T')[0],
  endDate: '',
  location: '',
  surface: 'Hard',
  level: '',
  drawSize: '',
  result: '',
  notes: '',
})

function tournamentToForm(tournament: Tournament): TournamentForm {
  return {
    id: tournament.id,
    name: tournament.name,
    startDate: tournament.startDate,
    endDate: tournament.endDate ?? '',
    location: tournament.location,
    surface: tournament.surface || 'Hard',
    level: tournament.level,
    drawSize: tournament.drawSize ? String(tournament.drawSize) : '',
    result: tournament.result ?? '',
    notes: tournament.notes ?? '',
  }
}

function formToTournament(form: TournamentForm): Tournament {
  return {
    id: form.id ?? crypto.randomUUID(),
    name: form.name.trim(),
    startDate: form.startDate,
    endDate: form.endDate || undefined,
    location: form.location,
    surface: form.surface,
    level: form.level,
    drawSize: form.drawSize ? Number(form.drawSize) : undefined,
    result: form.result || undefined,
    notes: form.notes || undefined,
    createdAt: new Date().toISOString(),
  }
}

export default function TournamentsPage() {
  const [player, setPlayer] = useState<Player | null>(null)
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [matches, setMatches] = useState<TournamentMatch[]>([])
  const [savingTournament, setSavingTournament] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const [error, setError] = useState('')
  const [tournamentForm, setTournamentForm] = useState<TournamentForm>(emptyTournamentForm)

  useEffect(() => {
    loadPlayer().then(setPlayer)
    loadTournaments().then((loaded) => setTournaments(loaded ?? []))
    loadTournamentMatches().then((loaded) => setMatches(loaded ?? []))
  }, [])

  const matchesByTournament = useMemo(() => {
    return matches.reduce<Record<string, TournamentMatch[]>>((acc, match) => {
      acc[match.tournamentId] = [...(acc[match.tournamentId] ?? []), match]
      return acc
    }, {})
  }, [matches])

  const firstName = player?.name?.split(' ')[0] || 'there'
  const editing = Boolean(tournamentForm.id)

  const saveTournament = async () => {
    setSavingTournament(true)
    setError('')
    try {
      if (!tournamentForm.name.trim()) throw new Error('Tournament name is required.')
      const payload = formToTournament(tournamentForm)
      const saved = editing ? await updateTournament(payload) : await createTournament(payload)
      if (!saved) throw new Error(editing ? 'Could not update tournament.' : 'Could not save tournament.')

      setTournaments((prev) => editing ? prev.map((item) => item.id === saved.id ? saved : item) : [saved, ...prev])
      setTournamentForm(emptyTournamentForm())
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save tournament.')
    } finally {
      setSavingTournament(false)
    }
  }

  const startEdit = (tournament: Tournament) => {
    setTournamentForm(tournamentToForm(tournament))
    setContextMenu(null)
  }

  const removeTournament = async (id: string) => {
    setContextMenu(null)
    setError('')
    try {
      await deleteTournament(id)
      setTournaments((prev) => prev.filter((item) => item.id !== id))
      setMatches((prev) => prev.filter((match) => match.tournamentId !== id))
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete tournament.')
    }
  }

  return (
    <AppShell title="Tournaments" subtitle={`Track draws, opponents, and match results, ${firstName}.`}>
      <PageHeader title="Tournaments" subtitle="Add tournaments here. Open a tournament page to log matches." />

      {error && <p className="mb-4 rounded-lg border border-danger/20 bg-danger/5 p-3 text-sm text-danger">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]" onClick={() => setContextMenu(null)}>
        <section className="space-y-4">
          {tournaments.length === 0 ? (
            <div className="rounded-card border border-border bg-surface p-6 text-center shadow-card">
              <Trophy className="mx-auto h-8 w-8 text-muted" />
              <h2 className="mt-3 font-display text-xl font-bold text-foreground">No tournaments yet, {firstName}</h2>
              <p className="mt-2 text-sm leading-6 text-muted">Add your first tournament, then open its page to log matches and opponent ratings.</p>
            </div>
          ) : (
            tournaments.map((tournament) => {
              const tournamentMatches = matchesByTournament[tournament.id] ?? []
              const wins = tournamentMatches.filter((match) => match.result === 'won' || match.result === 'walkover').length
              const losses = tournamentMatches.filter((match) => match.result === 'lost' || match.result === 'retired').length

              return (
                <Link
                  key={tournament.id}
                  href={`/tournaments/${tournament.id}`}
                  onContextMenu={(event) => {
                    event.preventDefault()
                    setContextMenu({ id: tournament.id, x: event.clientX, y: event.clientY })
                  }}
                  className="block rounded-card border border-border bg-surface p-5 shadow-card transition-colors hover:border-accent/40"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h2 className="font-display text-xl font-bold text-foreground">{tournament.name}</h2>
                      <p className="mt-1 text-sm text-muted">
                        {tournament.startDate} · {tournament.surface || 'surface not set'} · {tournament.location || 'location not set'}
                      </p>
                    </div>
                    <div className="rounded-lg bg-background px-3 py-2 text-sm font-medium text-foreground">
                      {wins}-{losses}
                    </div>
                  </div>
                  {tournament.notes && <p className="mt-3 text-sm leading-6 text-muted">{tournament.notes}</p>}
                  <p className="mt-4 text-sm text-muted">
                    {tournamentMatches.length ? `${tournamentMatches.length} matches logged` : 'No matches logged yet'}
                  </p>
                </Link>
              )
            })
          )}
        </section>

        <aside className="rounded-card border border-border bg-surface p-5 shadow-card h-fit">
          <h2 className="font-display text-lg font-bold text-foreground">{editing ? 'Edit Tournament' : 'Add Tournament'}</h2>
          <div className="mt-4 space-y-3">
            <input value={tournamentForm.name} onChange={(event) => setTournamentForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Tournament name" className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent" />
            <div className="grid grid-cols-2 gap-3">
              <input type="date" value={tournamentForm.startDate} onChange={(event) => setTournamentForm((prev) => ({ ...prev, startDate: event.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent" />
              <input type="date" value={tournamentForm.endDate} onChange={(event) => setTournamentForm((prev) => ({ ...prev, endDate: event.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent" />
            </div>
            <input value={tournamentForm.location} onChange={(event) => setTournamentForm((prev) => ({ ...prev, location: event.target.value }))} placeholder="Location" className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent" />
            <select value={tournamentForm.surface} onChange={(event) => setTournamentForm((prev) => ({ ...prev, surface: event.target.value }))} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent">
              {surfaces.map((surface) => <option key={surface}>{surface}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <input value={tournamentForm.level} onChange={(event) => setTournamentForm((prev) => ({ ...prev, level: event.target.value }))} placeholder="Level" className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent" />
              <input type="number" value={tournamentForm.drawSize} onChange={(event) => setTournamentForm((prev) => ({ ...prev, drawSize: event.target.value }))} placeholder="Draw size" className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent" />
            </div>
            <input value={tournamentForm.result} onChange={(event) => setTournamentForm((prev) => ({ ...prev, result: event.target.value }))} placeholder="Final result" className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent" />
            <textarea value={tournamentForm.notes} onChange={(event) => setTournamentForm((prev) => ({ ...prev, notes: event.target.value }))} rows={3} placeholder="Tournament notes" className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent" />
            <div className="flex gap-3">
              {editing && (
                <button type="button" onClick={() => setTournamentForm(emptyTournamentForm())} className="inline-flex flex-1 items-center justify-center rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-background">
                  Cancel
                </button>
              )}
              <button type="button" onClick={saveTournament} disabled={savingTournament} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-60">
                <Plus className="h-4 w-4" /> {savingTournament ? 'Saving...' : editing ? 'Save Changes' : 'Add Tournament'}
              </button>
            </div>
          </div>
        </aside>
      </div>

      {contextMenu && (
        <div
          className="fixed z-50 min-w-40 overflow-hidden rounded-lg border border-border bg-surface shadow-card"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              const tournament = tournaments.find((item) => item.id === contextMenu.id)
              if (tournament) startEdit(tournament)
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-background"
          >
            <Pencil className="h-4 w-4" /> Edit
          </button>
          <button
            type="button"
            onClick={() => removeTournament(contextMenu.id)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-danger hover:bg-danger/5"
          >
            <Trash2 className="h-4 w-4" /> Delete
          </button>
        </div>
      )}
    </AppShell>
  )
}
