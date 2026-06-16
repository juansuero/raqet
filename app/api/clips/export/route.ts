import { NextResponse } from 'next/server'
import { exportStandardClip, listLocalClips } from '@/lib/video-library'

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Batch export request body must be valid JSON.' }, { status: 400 })
  const projectId = typeof body.projectId === 'string' && body.projectId ? body.projectId : undefined
  const clips = listLocalClips().filter((clip) => (projectId ? clip.projectId === projectId : true))

  if (clips.length === 0) {
    return NextResponse.json({ clips: [], exportedCount: 0, failed: [] })
  }

  const exported = []
  const failed = []

  for (const clip of clips) {
    try {
      exported.push(await exportStandardClip(clip.id))
    } catch (error) {
      failed.push({
        id: clip.id,
        title: clip.title,
        error: error instanceof Error ? error.message : 'Clip export failed.',
      })
    }
  }

  if (exported.length === 0 && failed.length > 0) {
    return NextResponse.json({
      error: failed[0]?.error || 'Batch export failed.',
      clips: exported,
      exportedCount: 0,
      failed,
    }, { status: 503 })
  }

  return NextResponse.json({ clips: exported, exportedCount: exported.length, failed })
}
