import { NextResponse } from 'next/server'
import type { Session } from '@/lib/data'
import { deleteSoloSession, listSoloSessions, saveSoloMemory, saveSoloSession } from '@/lib/solo-store'

export async function GET() {
  return NextResponse.json(listSoloSessions())
}

export async function POST(request: Request) {
  const body = await request.json()
  const { syncToGoogleCalendar, ...session } = body
  const saved = saveSoloSession({
    ...session,
    id: session.id || crypto.randomUUID(),
    visibility: 'private',
    status: session.status ?? 'completed',
    createdAt: session.createdAt || new Date().toISOString(),
  } as Session)

  if (saved.profileMemoryUpdate) {
    saveSoloMemory({
      playerId: saved.playerId,
      content: saved.profileMemoryUpdate,
      category: 'preference',
      status: 'pending',
    })
  }

  return NextResponse.json(saved, { status: 201 })
}

export async function PATCH(request: Request) {
  const body = await request.json()
  const { syncToGoogleCalendar, ...session } = body
  if (!session.id) return NextResponse.json({ error: 'Session id is required' }, { status: 400 })
  return NextResponse.json(saveSoloSession({ ...session, visibility: 'private' } as Session))
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Session id is required' }, { status: 400 })
  deleteSoloSession(id)
  return NextResponse.json({ deletedId: id })
}
