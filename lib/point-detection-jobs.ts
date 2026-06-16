import { detectPointCandidatesAsync, type PointDetectionResult } from '@/lib/video-library'

export type PointDetectionJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'

export type PointDetectionJob = {
  id: string
  videoId: string
  status: PointDetectionJobStatus
  startMs: number
  endMs?: number
  maxDurationMs: number
  progressPercent: number
  createdAt: string
  updatedAt: string
  result?: PointDetectionResult
  error?: string
}

type JobStore = Map<string, PointDetectionJob>
type ControllerStore = Map<string, AbortController>

const globalJobs = globalThis as typeof globalThis & { __raqetPointDetectionJobs?: JobStore; __raqetPointDetectionControllers?: ControllerStore }
const jobs = globalJobs.__raqetPointDetectionJobs ?? new Map<string, PointDetectionJob>()
const controllers = globalJobs.__raqetPointDetectionControllers ?? new Map<string, AbortController>()
globalJobs.__raqetPointDetectionJobs = jobs
globalJobs.__raqetPointDetectionControllers = controllers

function updateJob(id: string, patch: Partial<PointDetectionJob>) {
  const current = jobs.get(id)
  if (!current) return null
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() }
  jobs.set(id, next)
  return next
}

export function getPointDetectionJob(id: string) {
  return jobs.get(id) ?? null
}

export function listPointDetectionJobs(videoId?: string) {
  return Array.from(jobs.values())
    .filter((job) => !videoId || job.videoId === videoId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function cancelPointDetectionJob(id: string) {
  const job = jobs.get(id)
  if (!job) return null
  if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') return job
  controllers.get(id)?.abort()
  controllers.delete(id)
  return updateJob(id, { status: 'cancelled', error: 'Point detection scan was stopped.' })
}

export function startPointDetectionJob(input: { videoId: string; startMs?: number; endMs?: number; maxDurationMs?: number }) {
  const now = new Date().toISOString()
  const job: PointDetectionJob = {
    id: crypto.randomUUID(),
    videoId: input.videoId,
    status: 'queued',
    startMs: Math.max(0, Number(input.startMs || 0)),
    endMs: Number.isFinite(Number(input.endMs)) ? Number(input.endMs) : undefined,
    maxDurationMs: Math.max(30 * 1000, Number(input.maxDurationMs || 5 * 60 * 1000)),
    progressPercent: 0,
    createdAt: now,
    updatedAt: now,
  }
  jobs.set(job.id, job)

  setTimeout(async () => {
    const current = jobs.get(job.id)
    if (!current || current.status === 'cancelled') return
    const controller = new AbortController()
    controllers.set(job.id, controller)
    updateJob(job.id, { status: 'running', progressPercent: 1 })
    try {
      const result = await detectPointCandidatesAsync(job.videoId, {
        startMs: job.startMs,
        endMs: job.endMs,
        maxDurationMs: job.maxDurationMs,
      }, (progressPercent) => {
        updateJob(job.id, { progressPercent })
      }, controller.signal)
      controllers.delete(job.id)
      if (controller.signal.aborted || jobs.get(job.id)?.status === 'cancelled') return
      updateJob(job.id, { status: 'completed', progressPercent: 100, result })
    } catch (error) {
      controllers.delete(job.id)
      if (controller.signal.aborted) {
        updateJob(job.id, { status: 'cancelled', error: 'Point detection scan was stopped.' })
        return
      }
      updateJob(job.id, { status: 'failed', error: error instanceof Error ? error.message : 'Point detection failed.' })
    }
  }, 0)

  return job
}
