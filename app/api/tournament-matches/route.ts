import { NextResponse } from 'next/server'
import type { TournamentMatch } from '@/lib/data'
import { deleteSoloTournamentMatch, getSoloTournament, listSoloTournamentMatches, saveSoloTournamentMatch } from '@/lib/solo-store'

function missingTournament(tournamentId: string) {
  return tournamentId && !getSoloTournament(tournamentId)
}

export async function GET() {
  return NextResponse.json(listSoloTournamentMatches())
}

export async function POST(request: Request) {
  const match = await request.json()
  if (missingTournament(match.tournamentId)) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
  return NextResponse.json(saveSoloTournamentMatch({ ...match, id: match.id || crypto.randomUUID(), createdAt: match.createdAt || new Date().toISOString() } as TournamentMatch), { status: 201 })
}

export async function PATCH(request: Request) {
  const match = await request.json()
  if (!match?.id) return NextResponse.json({ error: 'Match id is required' }, { status: 400 })
  if (missingTournament(match.tournamentId)) return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
  return NextResponse.json(saveSoloTournamentMatch(match as TournamentMatch))
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Match id is required' }, { status: 400 })
  deleteSoloTournamentMatch(id)
  return NextResponse.json({ deletedId: id })
}
