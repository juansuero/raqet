import { NextResponse } from 'next/server'
import { getHighlightExportJob, startHighlightExportJob } from '@/lib/highlight-export-jobs'
import { exportHighlightVideo } from '@/lib/video-library'

export const runtime = 'nodejs'

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T) {
  return typeof value === 'string' && allowed.includes(value as T) ? value as T : fallback
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { projectId?: unknown; localVideoId?: unknown; clipIds?: unknown; fade?: unknown; quality?: unknown; resolution?: unknown; fps?: unknown; background?: unknown }
  const options = {
    projectId: typeof body.projectId === 'string' && body.projectId ? body.projectId : undefined,
    localVideoId: typeof body.localVideoId === 'string' && body.localVideoId ? body.localVideoId : undefined,
    clipIds: Array.isArray(body.clipIds) ? body.clipIds.filter((id): id is string => typeof id === 'string' && id.length > 0) : undefined,
    fade: body.fade !== false,
    quality: oneOf(body.quality, ['draft', 'standard', 'high'] as const, 'standard'),
    resolution: oneOf(body.resolution, ['720', '1080', 'source'] as const, '720'),
    fps: oneOf(body.fps, ['source', '30', '60'] as const, 'source'),
  }
  try {
    if (body.background) {
      const job = startHighlightExportJob(options)
      return NextResponse.json(job, { status: 202 })
    }
    const result = await exportHighlightVideo(options)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Highlight export failed.' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const jobId = new URL(request.url).searchParams.get('jobId')
  if (!jobId) return NextResponse.json({ error: 'Highlight export job id is required.' }, { status: 400 })
  const job = getHighlightExportJob(jobId)
  if (!job) return NextResponse.json({ error: 'Highlight export job was not found.' }, { status: 404 })
  return NextResponse.json(job)
}
