import { NextResponse } from 'next/server'
import type { Opponent } from '@/lib/data'
import { deleteSoloOpponent, listSoloOpponents, saveSoloOpponent } from '@/lib/solo-store'

export async function GET() {
  return NextResponse.json(listSoloOpponents())
}

export async function POST(request: Request) {
  const opponent = await request.json()
  const name = typeof opponent?.name === 'string' ? opponent.name.trim() : ''
  if (!name) return NextResponse.json({ error: 'Opponent name is required' }, { status: 400 })
  return NextResponse.json(saveSoloOpponent({ ...opponent, id: opponent.id || crypto.randomUUID(), name, createdAt: opponent.createdAt || new Date().toISOString() } as Opponent), { status: 201 })
}

export async function PATCH(request: Request) {
  const opponent = await request.json()
  if (!opponent?.id) return NextResponse.json({ error: 'Opponent id is required' }, { status: 400 })
  const name = typeof opponent.name === 'string' ? opponent.name.trim() : ''
  if (!name) return NextResponse.json({ error: 'Opponent name is required' }, { status: 400 })
  return NextResponse.json(saveSoloOpponent({ ...opponent, name } as Opponent))
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Opponent id is required' }, { status: 400 })
  deleteSoloOpponent(id)
  return NextResponse.json({ deletedId: id })
}
