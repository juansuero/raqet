import { exportHighlightVideo } from '@/lib/video-library'

export type HighlightExportJobStatus = 'queued' | 'running' | 'completed' | 'failed'

export type HighlightExportJob = {
  id: string
  status: HighlightExportJobStatus
  progressPercent: number
  createdAt: string
  updatedAt: string
  result?: {
    outputPath: string
    clipCount: number
    durationSeconds: number
  }
  error?: string
}

type JobStore = Map<string, HighlightExportJob>

const globalJobs = globalThis as typeof globalThis & { __raqetHighlightExportJobs?: JobStore }
const jobs = globalJobs.__raqetHighlightExportJobs ?? new Map<string, HighlightExportJob>()
globalJobs.__raqetHighlightExportJobs = jobs

function updateJob(id: string, patch: Partial<HighlightExportJob>) {
  const current = jobs.get(id)
  if (!current) return null
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() }
  jobs.set(id, next)
  return next
}

export function getHighlightExportJob(id: string) {
  return jobs.get(id) ?? null
}

export function startHighlightExportJob(input: {
  projectId?: string
  localVideoId?: string
  clipIds?: string[]
  fade?: boolean
  quality?: 'draft' | 'standard' | 'high'
  resolution?: '720' | '1080' | 'source'
  fps?: 'source' | '30' | '60'
}) {
  const now = new Date().toISOString()
  const job: HighlightExportJob = {
    id: crypto.randomUUID(),
    status: 'queued',
    progressPercent: 0,
    createdAt: now,
    updatedAt: now,
  }
  jobs.set(job.id, job)

  setTimeout(async () => {
    updateJob(job.id, { status: 'running', progressPercent: 1 })
    try {
      const result = await exportHighlightVideo({
        ...input,
        onProgress: (progressPercent) => updateJob(job.id, { progressPercent }),
      })
      updateJob(job.id, { status: 'completed', progressPercent: 100, result })
    } catch (error) {
      updateJob(job.id, { status: 'failed', error: error instanceof Error ? error.message : 'Highlight export failed.' })
    }
  }, 0)

  return job
}
