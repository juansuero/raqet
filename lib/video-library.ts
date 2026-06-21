import { createReadStream, createWriteStream, existsSync, mkdirSync, mkdtempSync, rmSync, statSync, unlinkSync, writeFileSync } from 'fs'
import path from 'path'
import os from 'os'
import { spawn, spawnSync } from 'child_process'
import { Readable } from 'stream'
import { pipeline } from 'stream/promises'
import type { ReadableStream as NodeReadableStream } from 'stream/web'
import { fileURLToPath } from 'url'
import type { Clip, LocalVideo, ReelKeyframe } from '@/lib/data'
import { getSoloProject, initSoloDatabase } from '@/lib/solo-store'

function localDataPath(...segments: string[]) {
  return [process.cwd(), 'data', ...segments].join(path.sep)
}

export const videoStorageRoot = process.env.RAQET_VIDEO_STORAGE_PATH || localDataPath('video-library')
export const defaultSourceVideoDir = path.join(videoStorageRoot, 'sources')
export const defaultExportedClipDir = path.join(videoStorageRoot, 'exports', 'clips')
export const defaultExportedReelDir = path.join(videoStorageRoot, 'exports', 'reels')
export const defaultExportedHighlightDir = path.join(videoStorageRoot, 'exports', 'highlights')
export const defaultPlaybackProxyDir = path.join(videoStorageRoot, 'proxies')

export const projectsDir = path.join(videoStorageRoot, 'projects')

export type PointCandidate = {
  id: string
  startMs: number
  endMs: number
  title: string
  confidence: number
  reason: string
}

export type PointDetectionResult = {
  videoId: string
  analyzedStartMs: number
  analyzedEndMs: number
  durationMs?: number
  candidates: PointCandidate[]
  heuristic: string
  warning?: string
}

function projectSourceDir(projectId?: string) {
  return projectId ? path.join(projectsDir, projectId, 'sources') : defaultSourceVideoDir
}

function projectPlaybackProxyDir(projectId?: string) {
  return projectId ? path.join(projectsDir, projectId, 'proxies') : defaultPlaybackProxyDir
}

type RangeRead = {
  stream: ReturnType<typeof createReadStream>
  start: number
  end: number
  size: number
  contentLength: number
}

function db() {
  const { path: dbPath } = initSoloDatabase()
  const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite')
  return new DatabaseSync(dbPath)
}

function ensureDirs(projectId?: string) {
  mkdirSync(projectSourceDir(projectId), { recursive: true })
  mkdirSync(projectPlaybackProxyDir(projectId), { recursive: true })
  mkdirSync(projectExportedClipDir(projectId), { recursive: true })
  mkdirSync(projectExportedReelDir(projectId), { recursive: true })
  mkdirSync(projectExportedHighlightDir(projectId), { recursive: true })
}

export function nodeStreamToWebStream(nodeStream: ReturnType<typeof createReadStream>): ReadableStream {
  return Readable.toWeb(nodeStream) as unknown as ReadableStream
  /*
  return new ReadableStream({
    start(controller) {
      let closed = false
      const safeClose = () => {
        if (closed) return
        closed = true
        try {
          controller.close()
        } catch {
          // Already closed — ignore
        }
      }
      const safeError = (err: Error) => {
        if (closed) return
        closed = true
        try {
          controller.error(err)
        } catch {
          // Already closed — ignore
        }
      }
      nodeStream.on('data', (chunk) => {
        try {
          controller.enqueue(chunk)
        } catch {
          // Controller may be closed by browser — ignore
        }
      })
      nodeStream.on('end', safeClose)
      nodeStream.on('error', safeError)
      nodeStream.on('close', safeClose)
    },
    cancel() {
      nodeStream.destroy()
    },
  })
  */
}

function safeFileStem(value: string) {
  const stem = value
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return stem || 'raqet-video'
}

function projectExportFolder(projectId?: string) {
  if (!projectId) return ''
  const project = getSoloProject(projectId)
  const name = safeFileStem(project?.name || projectId)
  return project && name !== projectId ? `${name}-${projectId.slice(0, 8)}` : name
}

function projectExportedClipDir(projectId?: string) {
  const folder = projectExportFolder(projectId)
  return folder ? path.join(defaultExportedClipDir, folder) : defaultExportedClipDir
}

function projectExportedReelDir(projectId?: string) {
  const folder = projectExportFolder(projectId)
  return folder ? path.join(defaultExportedReelDir, folder) : defaultExportedReelDir
}

function projectExportedHighlightDir(projectId?: string) {
  const folder = projectExportFolder(projectId)
  return folder ? path.join(defaultExportedHighlightDir, folder) : defaultExportedHighlightDir
}

function extensionFor(fileName: string, mimeType: string) {
  const ext = path.extname(fileName).toLowerCase()
  if (['.mp4', '.mov', '.mpeg', '.mpg', '.webm'].includes(ext)) return ext
  if (mimeType.includes('webm')) return '.webm'
  if (mimeType.includes('quicktime')) return '.mov'
  return '.mp4'
}

function row<T>(type: string, id: string): T | null {
  const database = db()
  try {
    const result = database.prepare('select data from records where type = ? and id = ?').get(type, id) as { data: string } | undefined
    return result ? JSON.parse(result.data) as T : null
  } finally {
    database.close()
  }
}

function rows<T>(type: string): T[] {
  const database = db()
  try {
    return (database.prepare('select data from records where type = ?').all(type) as { data: string }[]).map((item) => JSON.parse(item.data) as T)
  } finally {
    database.close()
  }
}

function save<T extends { id: string }>(type: string, item: T) {
  const database = db()
  const timestamp = new Date().toISOString()
  try {
    database
      .prepare('insert or replace into records (type, id, data, created_at, updated_at) values (?, ?, ?, coalesce((select created_at from records where type = ? and id = ?), ?), ?)')
      .run(type, item.id, JSON.stringify(item), type, item.id, timestamp, timestamp)
  } finally {
    database.close()
  }
  return item
}

function remove(type: string, id: string) {
  const database = db()
  try {
    database.prepare('delete from records where type = ? and id = ?').run(type, id)
  } finally {
    database.close()
  }
}

export function listLocalVideos() {
  return rows<LocalVideo>('local_video').sort((a, b) => b.importedAt.localeCompare(a.importedAt))
}

export function localVideoFileAvailable(video: LocalVideo) {
  try {
    return statSync(localVideoPath(video)).size > 0
  } catch {
    return false
  }
}

export function listAvailableLocalVideos() {
  return listLocalVideos().filter(localVideoFileAvailable)
}

export function getLocalVideo(id: string) {
  return row<LocalVideo>('local_video', id)
}

export function deleteLocalVideo(id: string) {
  const video = getLocalVideo(id)
  if (!video) return null
  const filePath = localVideoPath(video)
  if (existsSync(filePath)) unlinkSync(filePath)
  const proxyPath = playbackProxyPath(video)
  if (proxyPath && existsSync(proxyPath)) unlinkSync(proxyPath)
  remove('local_video', id)
  return video
}

export function listLocalClips() {
  return rows<Clip>('video_clip').sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function getLocalClip(id: string) {
  return row<Clip>('video_clip', id)
}

export function saveLocalClip(clip: Clip) {
  return save('video_clip', clip)
}

export function deleteLocalClip(id: string) {
  remove('video_clip', id)
}

export function localVideoPath(video: LocalVideo) {
  return path.join(projectSourceDir(video.projectId), video.storedFileName)
}

export function playbackProxyPath(video: LocalVideo) {
  return video.playbackProxyStoredFileName ? path.join(projectPlaybackProxyDir(video.projectId), video.playbackProxyStoredFileName) : ''
}

function localVideoPlaybackPath(video: LocalVideo) {
  const proxyPath = playbackProxyPath(video)
  return proxyPath && existsSync(proxyPath) ? proxyPath : localVideoPath(video)
}

function probeDurationMsAsync(filePath: string, videoId: string) {
  // Probe duration in the background so large imports don't block the HTTP response
  setTimeout(() => {
    try {
      const durationMs = probeDurationMs(filePath)
      if (!durationMs) return
      const video = getLocalVideo(videoId)
      if (!video) return
      save('local_video', { ...video, durationMs })
    } catch {
      // Ignore probing errors — duration can stay unknown
    }
  }, 0)
}

type LocalVideoImport = {
  stream: NodeJS.ReadableStream
  fileName: string
  mimeType: string
  sessionId?: string
  projectId?: string
}

export class LocalVideoImportError extends Error {
  status: number
  code: string

  constructor(message: string, status = 400, code = 'LOCAL_VIDEO_IMPORT_ERROR') {
    super(message)
    this.name = 'LocalVideoImportError'
    this.status = status
    this.code = code
  }
}

function normalizeImportPath(filePath: string) {
  const trimmed = filePath.trim().replace(/^["']|["']$/g, '')
  if (trimmed.startsWith('file://')) return fileURLToPath(trimmed)
  return path.resolve(trimmed)
}

export async function importLocalVideoStream(input: LocalVideoImport) {
  const { stream, fileName, mimeType, sessionId, projectId } = input
  ensureDirs(projectId)
  const id = crypto.randomUUID()
  const storedFileName = `${id}-${safeFileStem(fileName)}${extensionFor(fileName, mimeType)}`
  const filePath = path.join(projectSourceDir(projectId), storedFileName)

  const writeStream = createWriteStream(filePath, { highWaterMark: 1024 * 1024 })
  try {
    await pipeline(stream, writeStream)
  } catch (error) {
    if (existsSync(filePath)) {
      try {
        unlinkSync(filePath)
      } catch {
        // Best-effort cleanup after interrupted browser uploads.
      }
    }
    throw error
  }

  const size = statSync(filePath).size
  if (size <= 0) {
    try {
      unlinkSync(filePath)
    } catch {
      // Best-effort cleanup after interrupted browser uploads.
    }
    throw new Error('Video upload wrote an empty file. Try importing the source video again.')
  }
  const video: LocalVideo = {
    id,
    sessionId: sessionId || undefined,
    projectId: projectId || undefined,
    fileName: fileName || storedFileName,
    storedFileName,
    mimeType: mimeType || 'application/octet-stream',
    sizeBytes: size,
    importedAt: new Date().toISOString(),
  }
  const saved = save('local_video', video)
  probeDurationMsAsync(filePath, saved.id)
  return saved
}

export function importLocalVideo(file: File, sessionId?: string, projectId?: string) {
  return importLocalVideoStream({
    stream: Readable.fromWeb(file.stream() as unknown as NodeReadableStream<Uint8Array>),
    fileName: file.name,
    mimeType: file.type,
    sessionId,
    projectId,
  })
}

export async function importLocalVideoPath(input: { filePath: string; sessionId?: string; projectId?: string }) {
  const filePath = normalizeImportPath(input.filePath)
  if (!existsSync(filePath)) {
    throw new LocalVideoImportError(`Source file was not found on this machine: ${filePath}`, 400, 'LOCAL_VIDEO_NOT_FOUND')
  }
  const size = statSync(filePath).size
  if (size <= 0) throw new LocalVideoImportError(`Source file is empty: ${filePath}`, 400, 'LOCAL_VIDEO_EMPTY')
  const fileName = path.basename(filePath)
  const extension = path.extname(fileName).toLowerCase()
  if (!['.mp4', '.mov', '.mpeg', '.mpg', '.webm'].includes(extension)) {
    throw new LocalVideoImportError('Choose an MP4, MOV, MPEG, MPG, or WebM file.', 400, 'LOCAL_VIDEO_UNSUPPORTED_FORMAT')
  }
  return importLocalVideoStream({
    stream: createReadStream(filePath, { highWaterMark: 4 * 1024 * 1024 }),
    fileName,
    mimeType: extension === '.mov' ? 'video/quicktime' : extension === '.webm' ? 'video/webm' : 'video/mp4',
    sessionId: input.sessionId,
    projectId: input.projectId,
  })
}

export function readVideoRange(video: LocalVideo, rangeHeader: string | null): RangeRead {
  const filePath = localVideoPlaybackPath(video)
  const size = statSync(filePath).size
  const chunkSize = 4 * 1024 * 1024
  const match = rangeHeader?.match(/bytes=(\d+)-(\d*)/)
  const start = Math.min(match ? Number(match[1]) : 0, Math.max(0, size - 1))
  const end = match
    ? match[2]
      ? Math.min(Number(match[2]), size - 1)
      : Math.min(start + chunkSize - 1, size - 1)
    : size - 1
  return {
    stream: createReadStream(filePath, { start, end }),
    start,
    end,
    size,
    contentLength: end - start + 1,
  }
}

export function playbackMimeType(video: LocalVideo) {
  return playbackProxyPath(video) && existsSync(playbackProxyPath(video)) ? 'video/mp4' : video.mimeType || 'video/mp4'
}

export function assertFfmpegAvailable(binary = process.env.FFMPEG_PATH || 'ffmpeg') {
  const result = spawnSync(binary, ['-version'], { stdio: 'ignore' })
  if (result.error || result.status !== 0) {
    throw new Error('ffmpeg was not found. Install ffmpeg and make sure it is available on PATH, or set FFMPEG_PATH.')
  }
  return binary
}

function probeDurationMs(filePath: string) {
  const binary = process.env.FFPROBE_PATH || 'ffprobe'
  const result = spawnSync(binary, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath], { encoding: 'utf8' })
  const seconds = Number(result.stdout?.trim())
  return Number.isFinite(seconds) ? Math.round(seconds * 1000) : undefined
}

function probeVideoInfo(filePath: string) {
  const binary = process.env.FFPROBE_PATH || 'ffprobe'
  const result = spawnSync(binary, ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1', filePath], { encoding: 'utf8' })
  if (result.error || result.status !== 0) throw new Error('ffprobe could not read the video metadata. Install ffmpeg/ffprobe and make sure they are available on PATH.')
  const values = Object.fromEntries(result.stdout.split(/\r?\n/).map((line) => line.split('=')).filter((parts) => parts.length === 2))
  const width = Number(values.width)
  const height = Number(values.height)
  const duration = Number(values.duration)
  if (!Number.isFinite(width) || !Number.isFinite(height) || !Number.isFinite(duration)) {
    throw new Error('ffprobe returned unreadable video metadata.')
  }
  return { width, height, durationMs: Math.round(duration * 1000) }
}

function seconds(ms: number) {
  return (ms / 1000).toFixed(3)
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function percentile(values: number[], p: number) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)))]
}

function motionFallbackCandidates(startMs: number, endMs: number, reason: string): PointCandidate[] {
  const spanMs = Math.max(0, endMs - startMs)
  const windowMs = 18000
  const stepMs = 45000
  const count = Math.min(12, Math.max(1, Math.floor(spanMs / stepMs)))
  return Array.from({ length: count }, (_, index) => {
    const candidateStart = startMs + index * stepMs
    const candidateEnd = Math.min(endMs, candidateStart + windowMs)
    return {
      id: crypto.randomUUID(),
      startMs: candidateStart,
      endMs: candidateEnd,
      title: `Review window ${index + 1}`,
      confidence: 0.2,
      reason,
    }
  }).filter((candidate) => candidate.endMs > candidate.startMs)
}

function pointCandidatesFromMotion(diffs: number[], analyzedStartMs: number, analyzedEndMs: number, fps: number): PointCandidate[] {
  if (diffs.length < 4) return []
  const median = percentile(diffs, 0.5)
  const p80 = percentile(diffs, 0.8)
  const p90 = percentile(diffs, 0.9)
  const mean = diffs.reduce((sum, value) => sum + value, 0) / diffs.length
  const variance = diffs.reduce((sum, value) => sum + (value - mean) ** 2, 0) / diffs.length
  const stdev = Math.sqrt(variance)
  const threshold = Math.max(p80, median + stdev * 0.35, 0.1)
  const frameMs = 1000 / fps
  const rawSegments: Array<{ startMs: number; endMs: number; peak: number; samples: number }> = []
  let current: { startMs: number; endMs: number; peak: number; samples: number } | null = null

  diffs.forEach((diff, index) => {
    const frameTime = analyzedStartMs + (index + 1) * frameMs
    const active = diff >= threshold
    if (active && !current) current = { startMs: frameTime, endMs: frameTime + frameMs, peak: diff, samples: 1 }
    else if (active && current) {
      current.endMs = frameTime + frameMs
      current.peak = Math.max(current.peak, diff)
      current.samples += 1
    } else if (!active && current) {
      rawSegments.push(current)
      current = null
    }
  })
  if (current) rawSegments.push(current)

  const merged: typeof rawSegments = []
  for (const segment of rawSegments) {
    const padded = {
      startMs: clampNumber(Math.round(segment.startMs - 2000), analyzedStartMs, analyzedEndMs),
      endMs: clampNumber(Math.round(segment.endMs + 3000), analyzedStartMs, analyzedEndMs),
      peak: segment.peak,
      samples: segment.samples,
    }
    const previous = merged[merged.length - 1]
    if (previous && padded.startMs - previous.endMs <= 6500) {
      previous.endMs = Math.max(previous.endMs, padded.endMs)
      previous.peak = Math.max(previous.peak, padded.peak)
      previous.samples += padded.samples
    } else {
      merged.push(padded)
    }
  }

  const candidates: PointCandidate[] = []
  for (const segment of merged) {
    const duration = segment.endMs - segment.startMs
    if (duration < 6000) continue
    const parts = duration > 50000 ? Math.ceil(duration / 35000) : 1
    for (let part = 0; part < parts; part += 1) {
      const partStart = segment.startMs + Math.round((duration / parts) * part)
      const partEnd = part === parts - 1 ? segment.endMs : segment.startMs + Math.round((duration / parts) * (part + 1))
      if (partEnd - partStart < 6000) continue
      const normalizedPeak = p90 > threshold ? (segment.peak - threshold) / (p90 - threshold) : 0.5
      candidates.push({
        id: crypto.randomUUID(),
        startMs: partStart,
        endMs: partEnd,
        title: `Point candidate ${candidates.length + 1}`,
        confidence: clampNumber(Number((0.45 + normalizedPeak * 0.35).toFixed(2)), 0.35, 0.86),
        reason: `Motion rose above baseline across ${segment.samples} sampled frames.`,
      })
    }
  }

  return candidates.slice(0, 40)
}

type PointDetectionPrepared = {
  videoId: string
  source: string
  binary: string
  fullDurationMs: number
  requestedStartMs: number
  requestedEndMs: number
  analyzedEndMs: number
  analyzedDurationMs: number
  fps: number
  width: number
  height: number
  frameSize: number
}

function preparePointDetection(videoId: string, options: { startMs?: number; endMs?: number; maxDurationMs?: number } = {}): PointDetectionPrepared {
  const video = getLocalVideo(videoId)
  if (!video) throw new Error('Source video was not found in the local library.')
  const source = localVideoPath(video)
  if (!existsSync(source)) throw new Error('The source video no longer exists in local Raqet storage.')

  const binary = assertFfmpegAvailable()
  const info = probeVideoInfo(source)
  const fullDurationMs = info.durationMs
  const maxDurationMs = clampNumber(Number(options.maxDurationMs || 12 * 60 * 1000), 30 * 1000, 2 * 60 * 60 * 1000)
  const requestedStartMs = clampNumber(Number(options.startMs || 0), 0, Math.max(0, fullDurationMs - 1000))
  const requestedEndMs = Number.isFinite(Number(options.endMs)) ? clampNumber(Number(options.endMs), requestedStartMs + 1000, fullDurationMs) : fullDurationMs
  const analyzedEndMs = Math.min(requestedEndMs, requestedStartMs + maxDurationMs)
  const analyzedDurationMs = Math.max(1000, analyzedEndMs - requestedStartMs)
  const fps = 2
  const width = 160
  const height = Math.max(2, Math.round((width * info.height / info.width) / 2) * 2)
  const frameSize = width * height
  return { videoId, source, binary, fullDurationMs, requestedStartMs, requestedEndMs, analyzedEndMs, analyzedDurationMs, fps, width, height, frameSize }
}

function pointDetectionArgs(prepared: PointDetectionPrepared) {
  return [
    '-hide_banner',
    '-v',
    'error',
    '-nostats',
    '-progress',
    'pipe:2',
    '-ss',
    seconds(prepared.requestedStartMs),
    '-i',
    prepared.source,
    '-t',
    seconds(prepared.analyzedDurationMs),
    '-vf',
    `fps=${prepared.fps},scale=${prepared.width}:${prepared.height},format=gray`,
    '-an',
    '-f',
    'rawvideo',
    'pipe:1',
  ]
}

function buildPointDetectionResult(prepared: PointDetectionPrepared, buffer: Buffer): PointDetectionResult {
  const { videoId, fullDurationMs, requestedStartMs, requestedEndMs, analyzedEndMs, fps, width, height, frameSize } = prepared
  const frameCount = Math.floor(buffer.length / frameSize)
  const diffs: number[] = []
  for (let frame = 1; frame < frameCount; frame += 1) {
    const previousStart = (frame - 1) * frameSize
    const currentStart = frame * frameSize
    const histogram = new Array<number>(256).fill(0)
    let samples = 0
    for (let offset = 0; offset < frameSize; offset += 2) {
      histogram[Math.abs(buffer[currentStart + offset] - buffer[previousStart + offset])] += 1
      samples += 1
    }
    const target = Math.max(1, Math.round(samples * 0.08))
    let remaining = target
    let sum = 0
    for (let value = 255; value >= 0 && remaining > 0; value -= 1) {
      const count = Math.min(remaining, histogram[value])
      sum += value * count
      remaining -= count
    }
    diffs.push(target ? sum / target / 255 : 0)
  }

  const motionCandidates = pointCandidatesFromMotion(diffs, requestedStartMs, analyzedEndMs, fps)
  const candidates = motionCandidates.length > 0
    ? motionCandidates
    : motionFallbackCandidates(requestedStartMs, analyzedEndMs, 'Motion signal was too flat for confident segmentation; use this as a quick review window.')
  const capped = analyzedEndMs < requestedEndMs

  return {
    videoId,
    analyzedStartMs: requestedStartMs,
    analyzedEndMs,
    durationMs: fullDurationMs,
    candidates,
    heuristic: `Sampled ${frameCount} grayscale frames at ${fps} fps (${width}x${height}) and segmented motion above baseline.`,
    warning: capped ? `Analysis was capped to ${Math.round((analyzedEndMs - requestedStartMs) / 60000)} minutes for fast review. Run another range for the rest of the video.` : undefined,
  }
}

export function detectPointCandidates(videoId: string, options: { startMs?: number; endMs?: number; maxDurationMs?: number } = {}): PointDetectionResult {
  const prepared = preparePointDetection(videoId, options)

  const result = spawnSync(prepared.binary, pointDetectionArgs(prepared), { encoding: 'buffer', maxBuffer: 220 * 1024 * 1024 })

  if (result.error || result.status !== 0) {
    const stderr = Buffer.isBuffer(result.stderr) ? result.stderr.toString('utf8') : String(result.stderr || '')
    throw new Error(ffmpegError(stderr) || 'ffmpeg could not sample frames for point detection.')
  }

  return buildPointDetectionResult(prepared, result.stdout as Buffer)
}

export async function detectPointCandidatesAsync(
  videoId: string,
  options: { startMs?: number; endMs?: number; maxDurationMs?: number } = {},
  onProgress?: (progressPercent: number) => void,
  signal?: AbortSignal,
): Promise<PointDetectionResult> {
  const prepared = preparePointDetection(videoId, options)
  const buffer = await runFfmpegBuffer(prepared.binary, pointDetectionArgs(prepared), prepared.analyzedDurationMs, onProgress, signal)
  return buildPointDetectionResult(prepared, buffer)
}

function ffmpegError(stderr: string) {
  const tail = stderr.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).filter((line) => !line.startsWith('frame=')).slice(-8).join('\n')
  return tail || 'ffmpeg failed while exporting the video.'
}

async function runFfmpeg(args: string[], durationMs?: number, onProgress?: (progressPercent: number) => void) {
  const binary = assertFfmpegAvailable()
  const ffmpegArgs = durationMs && onProgress
    ? args[0] === '-y'
      ? ['-y', '-nostats', '-progress', 'pipe:2', ...args.slice(1)]
      : ['-nostats', '-progress', 'pipe:2', ...args]
    : args
  const result = await new Promise<{ code: number | null; stderr: string }>((resolve, reject) => {
    const child = spawn(binary, ffmpegArgs, { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    let lastProgress = 0
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk)
      if (!durationMs || !onProgress) return
      const progress = parseFfmpegProgress(stderr, durationMs)
      if (progress !== null && progress > lastProgress) {
        lastProgress = progress
        onProgress(Math.round(progress))
      }
    })
    child.on('error', reject)
    child.on('close', (code) => resolve({ code, stderr }))
  })
  if (result.code !== 0) throw new Error(ffmpegError(result.stderr))
}

function parseFfmpegProgress(stderr: string, durationMs: number) {
  const matches = [...stderr.matchAll(/(?:out_time_ms|out_time_us)=(\d+)/g)]
  const last = matches[matches.length - 1]
  if (last) {
    const raw = Number(last[1])
    if (Number.isFinite(raw) && raw > 0) return clampNumber((raw / 1000 / durationMs) * 100, 0, 99)
  }
  const timeMatch = [...stderr.matchAll(/out_time=(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/g)].at(-1)
  if (timeMatch) {
    const elapsedMs = ((Number(timeMatch[1]) * 3600) + (Number(timeMatch[2]) * 60) + Number(timeMatch[3])) * 1000
    return clampNumber((elapsedMs / durationMs) * 100, 0, 99)
  }
  return null
}

async function runFfmpegBuffer(binary: string, args: string[], durationMs: number, onProgress?: (progressPercent: number) => void, signal?: AbortSignal) {
  const result = await new Promise<{ code: number | null; stderr: string; stdout: Buffer }>((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    const stdoutChunks: Buffer[] = []
    let stderr = ''
    let lastProgress = 0
    let aborting = false
    const abort = () => {
      if (aborting) return
      aborting = true
      if (process.platform === 'win32' && child.pid) {
        spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
        return
      }
      child.kill('SIGTERM')
      setTimeout(() => {
        if (child.exitCode === null) child.kill('SIGKILL')
      }, 1500)
    }
    if (signal?.aborted) abort()
    signal?.addEventListener('abort', abort, { once: true })
    child.stdout.on('data', (chunk) => {
      stdoutChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    })
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk)
      const progress = parseFfmpegProgress(stderr, durationMs)
      if (progress !== null && progress > lastProgress) {
        lastProgress = progress
        onProgress?.(Math.round(progress))
      }
    })
    child.on('error', reject)
    child.on('close', (code) => {
      signal?.removeEventListener('abort', abort)
      resolve({ code, stderr, stdout: Buffer.concat(stdoutChunks) })
    })
  })
  if (signal?.aborted) throw new Error('Point detection scan was stopped.')
  if (result.code !== 0) throw new Error(ffmpegError(result.stderr) || 'ffmpeg could not sample frames for point detection.')
  return result.stdout
}

export async function exportStandardClip(clipId: string) {
  const clip = getLocalClip(clipId)
  if (!clip) throw new Error('Clip was not found in the local library.')
  const video = getLocalVideo(clip.localVideoId || '')
  if (!video) throw new Error('Source video was not found in the local library.')
  const source = localVideoPath(video)
  if (!existsSync(source)) throw new Error('The source video no longer exists in local Raqet storage.')
  const startMs = clip.startMs ?? 0
  const durationMs = Math.max(0, (clip.endMs ?? 0) - startMs)
  if (durationMs <= 0) throw new Error('Clip end must be after clip start.')
  ensureDirs(video.projectId)
  const output = path.join(projectExportedClipDir(video.projectId), `${clip.id}-${safeFileStem(clip.title)}.mp4`)
  await runFfmpeg(['-y', '-ss', seconds(startMs), '-i', source, '-t', seconds(durationMs), '-c', 'copy', output])
  return saveLocalClip({ ...clip, exportedClipPath: output })
}

export async function createPlaybackProxy(videoId: string) {
  const video = getLocalVideo(videoId)
  if (!video) throw new Error('Source video was not found in the local library.')
  const source = localVideoPath(video)
  if (!existsSync(source)) throw new Error('The source video no longer exists in local Raqet storage.')
  ensureDirs(video.projectId)

  const storedFileName = `${video.id}-browser-playback.mp4`
  const output = path.join(projectPlaybackProxyDir(video.projectId), storedFileName)
  await runFfmpeg([
    '-y',
    '-i',
    source,
    '-map',
    '0:v:0',
    '-map',
    '0:a?',
    '-c',
    'copy',
    '-movflags',
    '+faststart',
    output,
  ])

  return save('local_video', {
    ...video,
    playbackProxyStoredFileName: storedFileName,
    playbackProxyCreatedAt: new Date().toISOString(),
  })
}

function smoothstepExpression(t0: number, t1: number) {
  const span = Math.max(0.001, t1 - t0)
  const x = `min(1\\,max(0\\,(t-${t0.toFixed(3)})/${span.toFixed(3)}))`
  return `(${x}*${x}*(3-2*${x}))`
}

function cropExpression(keyframes: Array<[number, number]>) {
  if (keyframes.length === 1) return String(keyframes[0][1])
  let expression = String(keyframes[keyframes.length - 1][1])
  for (let index = keyframes.length - 2; index >= 0; index -= 1) {
    const [t0, x0] = keyframes[index]
    const [t1, x1] = keyframes[index + 1]
    expression = `if(lt(t\\,${t1.toFixed(3)})\\,(${x0}+(${x1 - x0})*${smoothstepExpression(t0, t1)})\\,${expression})`
  }
  return expression
}

export async function exportReelClip(clipId: string, keyframes: ReelKeyframe[]) {
  if (keyframes.length < 2) throw new Error('Add at least two reel keyframes before exporting.')
  const clip = getLocalClip(clipId)
  if (!clip) throw new Error('Clip was not found in the local library.')
  const video = getLocalVideo(clip.localVideoId || '')
  if (!video) throw new Error('Source video was not found in the local library.')
  const source = localVideoPath(video)
  if (!existsSync(source)) throw new Error('The source video no longer exists in local Raqet storage.')

  const startMs = clip.startMs ?? 0
  const durationMs = Math.max(0, (clip.endMs ?? 0) - startMs)
  if (durationMs <= 0) throw new Error('Clip end must be after clip start.')
  const info = probeVideoInfo(source)
  const cropHeight = info.height % 2 === 0 ? info.height : info.height - 1
  let cropWidth = Math.min(info.width, Math.round(cropHeight * 9 / 16))
  if (cropWidth % 2) cropWidth -= 1
  const maxX = Math.max(0, info.width - cropWidth)
  const durationSeconds = Math.min(durationMs, Math.max(0, info.durationMs - startMs)) / 1000
  const normalized = keyframes
    .map((keyframe) => [Math.min(durationSeconds, Math.max(0, keyframe.timestampMs / 1000)), Math.round(Math.min(1, Math.max(0, keyframe.xPercent)) * maxX / 2) * 2] as [number, number])
    .sort((a, b) => a[0] - b[0])
  ensureDirs(video.projectId)
  const output = path.join(projectExportedReelDir(video.projectId), `${clip.id}-${safeFileStem(clip.title)}-reel.mp4`)
  const cropX = `min(${maxX}\,max(0\,2*floor((${cropExpression(normalized)})/2)))`
  const filter = `crop=${cropWidth}:${cropHeight}:${cropX}:0,scale=1080:1920,setsar=1`
  await runFfmpeg(['-y', '-ss', seconds(startMs), '-i', source, '-t', seconds(durationMs), '-vf', filter, '-c:v', 'libx264', '-threads', '2', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', output])
  return saveLocalClip({ ...clip, exportedReelPath: output, reelKeyframes: keyframes })
}

function concatListPath(filePath: string) {
  return filePath.replace(/\\/g, '/').replace(/'/g, "'\\''")
}

type HighlightQuality = 'draft' | 'standard' | 'high'
type HighlightResolution = '720' | '1080' | 'source'
type HighlightFps = 'source' | '30' | '60'

const highlightQualitySettings: Record<HighlightQuality, { crf: string; preset: string; audioBitrate: string }> = {
  draft: { crf: '28', preset: 'veryfast', audioBitrate: '96k' },
  standard: { crf: '23', preset: 'veryfast', audioBitrate: '128k' },
  high: { crf: '18', preset: 'medium', audioBitrate: '192k' },
}

function highlightWidth(resolution: HighlightResolution) {
  if (resolution === '720') return 1280
  if (resolution === '1080') return 1920
  return null
}

export async function exportHighlightVideo(input: { projectId?: string; localVideoId?: string; clipIds?: string[]; fade?: boolean; quality?: HighlightQuality; resolution?: HighlightResolution; fps?: HighlightFps; onProgress?: (progressPercent: number) => void } = {}) {
  const quality = input.quality && input.quality in highlightQualitySettings ? input.quality : 'standard'
  const resolution = input.resolution === '1080' || input.resolution === 'source' ? input.resolution : '720'
  const fps = input.fps === '30' || input.fps === '60' ? input.fps : 'source'
  const qualitySettings = highlightQualitySettings[quality]
  const selectedClipIds = new Set(input.clipIds ?? [])
  const clips = listLocalClips()
    .filter((clip) => selectedClipIds.size > 0 ? selectedClipIds.has(clip.id) : true)
    .filter((clip) => (input.projectId ? clip.projectId === input.projectId : true))
    .filter((clip) => (input.localVideoId ? clip.localVideoId === input.localVideoId : true))
    .filter((clip) => clip.localVideoId && (clip.endMs ?? 0) > (clip.startMs ?? 0))
    .sort((a, b) => selectedClipIds.size > 0
      ? (input.clipIds?.indexOf(a.id) ?? 0) - (input.clipIds?.indexOf(b.id) ?? 0)
      : (a.startMs ?? 0) - (b.startMs ?? 0))

  if (clips.length === 0) throw new Error(selectedClipIds.size > 0 ? 'None of the selected clips have valid start/end times for this highlight.' : 'No saved clips with valid start/end times were found for this highlight.')

  const projectId = input.projectId || clips[0].projectId
  ensureDirs(projectId)
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'raqet-highlight-'))
  const segmentPaths: string[] = []
  const output = path.join(projectExportedHighlightDir(projectId), `highlight-${new Date().toISOString().replace(/[:.]/g, '-')}.mp4`)
  const totalDurationMs = Math.max(1, clips.reduce((sum, clip) => sum + Math.max(0, (clip.endMs ?? 0) - (clip.startMs ?? 0)), 0))
  let completedDurationMs = 0

  try {
    for (const [index, clip] of clips.entries()) {
      const video = getLocalVideo(clip.localVideoId || '')
      if (!video) throw new Error(`Source video was not found for ${clip.title}.`)
      const source = localVideoPath(video)
      if (!existsSync(source)) throw new Error(`Source video no longer exists for ${clip.title}.`)
      const startMs = clip.startMs ?? 0
      const durationMs = Math.max(0, (clip.endMs ?? 0) - startMs)
      const durationSeconds = durationMs / 1000
      const segment = path.join(tempDir, `${String(index).padStart(4, '0')}.mp4`)
      const fadeSeconds = input.fade === false ? 0 : Math.min(0.35, durationSeconds / 4)
      const width = highlightWidth(resolution)
      const filters = [
        width ? `scale=${width}:-2` : null,
        'setsar=1',
        fps === 'source' ? null : `fps=${fps}`,
        fadeSeconds > 0 ? `fade=t=in:st=0:d=${fadeSeconds.toFixed(2)}` : null,
        fadeSeconds > 0 ? `fade=t=out:st=${Math.max(0, durationSeconds - fadeSeconds).toFixed(2)}:d=${fadeSeconds.toFixed(2)}` : null,
        'format=yuv420p',
      ].filter(Boolean).join(',')

      await runFfmpeg([
        '-y',
        '-ss',
        seconds(startMs),
        '-i',
        source,
        '-t',
        seconds(durationMs),
        '-map',
        '0:v:0',
        '-map',
        '0:a?',
        '-vf',
        filters,
        '-c:v',
        'libx264',
        '-threads',
        '2',
        '-preset',
        qualitySettings.preset,
        '-crf',
        qualitySettings.crf,
        '-c:a',
        'aac',
        '-b:a',
        qualitySettings.audioBitrate,
        '-movflags',
        '+faststart',
        segment,
      ], durationMs, (segmentProgress) => {
        const progress = ((completedDurationMs + durationMs * (segmentProgress / 100)) / totalDurationMs) * 98
        input.onProgress?.(Math.max(1, Math.min(98, Math.round(progress))))
      })
      completedDurationMs += durationMs
      input.onProgress?.(Math.max(1, Math.min(98, Math.round((completedDurationMs / totalDurationMs) * 98))))
      segmentPaths.push(segment)
    }

    const listPath = path.join(tempDir, 'segments.txt')
    writeFileSync(listPath, segmentPaths.map((segment) => `file '${concatListPath(segment)}'`).join('\n'), 'utf8')
    input.onProgress?.(99)
    await runFfmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', '-movflags', '+faststart', output])
    input.onProgress?.(100)
    return {
      outputPath: output,
      clipCount: clips.length,
      durationSeconds: Math.round(clips.reduce((sum, clip) => sum + ((clip.endMs ?? 0) - (clip.startMs ?? 0)), 0) / 1000),
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
}

export function videoStorageInfo(projectId?: string) {
  ensureDirs(projectId)
  return {
    root: videoStorageRoot,
    sourceVideos: projectSourceDir(projectId),
    exportedClips: projectExportedClipDir(projectId),
    exportedReels: projectExportedReelDir(projectId),
    exportedHighlights: projectExportedHighlightDir(projectId),
    metadata: process.env.RAQET_DB_PATH || localDataPath('raqet.sqlite'),
  }
}
