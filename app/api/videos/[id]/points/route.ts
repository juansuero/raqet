import { NextResponse } from 'next/server'
import { cancelPointDetectionJob, startPointDetectionJob, getPointDetectionJob, listPointDetectionJobs } from '@/lib/point-detection-jobs'
import { detectPointCandidatesAsync } from '@/lib/video-library'

export const runtime = 'nodejs'

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params
  const body = await request.json().catch(() => ({})) as { startMs?: unknown; endMs?: unknown; maxDurationMs?: unknown; background?: unknown }
  const options = {
    startMs: Number.isFinite(Number(body.startMs)) ? Number(body.startMs) : undefined,
    endMs: Number.isFinite(Number(body.endMs)) ? Number(body.endMs) : undefined,
    maxDurationMs: Number.isFinite(Number(body.maxDurationMs)) ? Number(body.maxDurationMs) : undefined,
  }

  try {
    if (body.background) {
      const job = startPointDetectionJob({ videoId: id, ...options })
      return NextResponse.json(job, { status: 202 })
    }
    const result = await detectPointCandidatesAsync(id, options)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Point detection failed.' }, { status: 500 })
  }
}

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params
  const jobId = new URL(request.url).searchParams.get('jobId')
  if (!jobId) return NextResponse.json(listPointDetectionJobs(id))
  const job = getPointDetectionJob(jobId)
  if (!job) return NextResponse.json({ error: 'Point detection job was not found.' }, { status: 404 })
  return NextResponse.json(job)
}

export async function DELETE(request: Request) {
  const jobId = new URL(request.url).searchParams.get('jobId')
  if (!jobId) return NextResponse.json({ error: 'Point detection job id is required.' }, { status: 400 })
  const job = cancelPointDetectionJob(jobId)
  if (!job) return NextResponse.json({ error: 'Point detection job was not found.' }, { status: 404 })
  return NextResponse.json(job)
}
