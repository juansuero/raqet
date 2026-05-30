import { NextResponse } from 'next/server'
import type { Tournament } from '@/lib/data'
import { deleteSoloTournament, listSoloTournaments, saveSoloTournament } from '@/lib/solo-store'

export async function GET() {
  return NextResponse.json(listSoloTournaments())
}

export async function POST(request: Request) {
  const tournament = await request.json()
  return NextResponse.json(saveSoloTournament({ ...tournament, id: tournament.id || crypto.randomUUID(), createdAt: tournament.createdAt || new Date().toISOString() } as Tournament), { status: 201 })
}

export async function PATCH(request: Request) {
  const tournament = await request.json()
  if (!tournament.id) return NextResponse.json({ error: 'Tournament id is required' }, { status: 400 })
  return NextResponse.json(saveSoloTournament(tournament as Tournament))
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Tournament id is required' }, { status: 400 })
  deleteSoloTournament(id)
  return NextResponse.json({ deletedId: id })
}
