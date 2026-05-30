import { NextResponse } from 'next/server'
import type { Clip } from '@/lib/data'
import { deleteLocalClip, listLocalClips, saveLocalClip } from '@/lib/video-library'

function clipFromBody(body: Partial<Clip>): Clip {
  const startMs = Number(body.startMs ?? 0)
  const endMs = Number(body.endMs ?? 0)
  const notes = typeof (body as { notes?: unknown }).notes === 'string' ? String((body as { notes?: string }).notes) : undefined
  return {
    id: body.id || crypto.randomUUID(),
    sessionId: body.sessionId || '',
    playerId: 'solo',
    localVideoId: body.localVideoId,
    startMs,
    endMs,
    title: body.title || 'Untitled point',
    videoUrl: body.videoUrl || '',
    thumbnailUrl: body.thumbnailUrl || '',
    durationSeconds: Math.max(0, Math.round((endMs - startMs) / 1000)),
    clipType: body.clipType || 'rally',
    pointResult: body.pointResult || 'unknown',
    pointEnding: body.pointEnding || 'other',
    shotContext: body.shotContext || 'rally',
    scoreContext: body.scoreContext || undefined,
    playerIntention: body.playerIntention || undefined,
    technicalNotes: body.technicalNotes || notes || undefined,
    decisionQuality: body.decisionQuality ?? 0,
    contentScore: body.contentScore ?? 0,
    suggestedUse: body.suggestedUse || 'analysis',
    tags: body.tags || [],
    exportedClipPath: body.exportedClipPath,
    exportedReelPath: body.exportedReelPath,
    reelKeyframes: body.reelKeyframes || [],
    events: body.events || [],
    createdAt: body.createdAt || new Date().toISOString(),
  }
}

export async function GET() {
  return NextResponse.json(listLocalClips())
}

export async function POST(request: Request) {
  const body = await request.json()
  if (!body.localVideoId) return NextResponse.json({ error: 'Choose a source video before saving a clip.' }, { status: 400 })
  if (Number(body.endMs) <= Number(body.startMs)) return NextResponse.json({ error: 'Clip end must be after clip start.' }, { status: 400 })
  return NextResponse.json(saveLocalClip(clipFromBody(body)), { status: 201 })
}

export async function PATCH(request: Request) {
  const body = await request.json()
  if (!body.id) return NextResponse.json({ error: 'Clip id is required.' }, { status: 400 })
  return NextResponse.json(saveLocalClip(clipFromBody(body)))
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Clip id is required.' }, { status: 400 })
  deleteLocalClip(id)
  return NextResponse.json({ deletedId: id })
}
