import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from 'fs'
import path from 'path'
import { spawn, spawnSync } from 'child_process'
import type { Clip, LocalVideo, ReelKeyframe } from '@/lib/data'
import { initSoloDatabase } from '@/lib/solo-store'

const { DatabaseSync } = require('node:sqlite') as { DatabaseSync: new (path: string) => any }

export const videoStorageRoot = process.env.RAQET_VIDEO_STORAGE_PATH || path.join(process.cwd(), 'data', 'video-library')
export const sourceVideoDir = path.join(videoStorageRoot, 'sources')
export const exportedClipDir = path.join(videoStorageRoot, 'exports', 'clips')
export const exportedReelDir = path.join(videoStorageRoot, 'exports', 'reels')

type RangeRead = {
  stream: ReturnType<typeof createReadStream>
  start: number
  end: number
  size: number
  contentLength: number
}

function db() {
  const { path: dbPath } = initSoloDatabase()
  return new DatabaseSync(dbPath)
}

function ensureDirs() {
  mkdirSync(sourceVideoDir, { recursive: true })
  mkdirSync(exportedClipDir, { recursive: true })
  mkdirSync(exportedReelDir, { recursive: true })
}

function safeFileStem(value: string) {
  const stem = value
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return stem || 'raqet-video'
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

export function getLocalVideo(id: string) {
  return row<LocalVideo>('local_video', id)
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
  return path.join(sourceVideoDir, video.storedFileName)
}

export async function importLocalVideo(file: File, sessionId?: string) {
  ensureDirs()
  const id = crypto.randomUUID()
  const storedFileName = `${id}-${safeFileStem(file.name)}${extensionFor(file.name, file.type)}`
  const bytes = Buffer.from(await file.arrayBuffer())
  writeFileSync(path.join(sourceVideoDir, storedFileName), bytes)
  const video: LocalVideo = {
    id,
    sessionId: sessionId || undefined,
    fileName: file.name || storedFileName,
    storedFileName,
    mimeType: file.type || 'application/octet-stream',
    sizeBytes: bytes.length,
    durationMs: probeDurationMs(path.join(sourceVideoDir, storedFileName)),
    importedAt: new Date().toISOString(),
  }
  return save('local_video', video)
}

export function readVideoRange(video: LocalVideo, rangeHeader: string | null): RangeRead {
  const filePath = localVideoPath(video)
  const size = statSync(filePath).size
  const match = rangeHeader?.match(/bytes=(\d+)-(\d*)/)
  const start = match ? Number(match[1]) : 0
  const end = match && match[2] ? Number(match[2]) : size - 1
  return {
    stream: createReadStream(filePath, { start, end }),
    start,
    end,
    size,
    contentLength: end - start + 1,
  }
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

function ffmpegError(stderr: string) {
  const tail = stderr.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).filter((line) => !line.startsWith('frame=')).slice(-8).join('\n')
  return tail || 'ffmpeg failed while exporting the video.'
}

async function runFfmpeg(args: string[]) {
  const binary = assertFfmpegAvailable()
  const result = await new Promise<{ code: number | null; stderr: string }>((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    child.stderr.on('data', (chunk) => {
      stderr += String(chunk)
    })
    child.on('error', reject)
    child.on('close', (code) => resolve({ code, stderr }))
  })
  if (result.code !== 0) throw new Error(ffmpegError(result.stderr))
}

export async function exportStandardClip(clipId: string) {
  ensureDirs()
  const clip = getLocalClip(clipId)
  if (!clip) throw new Error('Clip was not found in the local library.')
  const video = getLocalVideo(clip.localVideoId || '')
  if (!video) throw new Error('Source video was not found in the local library.')
  const source = localVideoPath(video)
  if (!existsSync(source)) throw new Error('The source video no longer exists in local Raqet storage.')
  const startMs = clip.startMs ?? 0
  const durationMs = Math.max(0, (clip.endMs ?? 0) - startMs)
  if (durationMs <= 0) throw new Error('Clip end must be after clip start.')
  const output = path.join(exportedClipDir, `${clip.id}-${safeFileStem(clip.title)}.mp4`)
  await runFfmpeg(['-y', '-ss', seconds(startMs), '-i', source, '-t', seconds(durationMs), '-c', 'copy', output])
  return saveLocalClip({ ...clip, exportedClipPath: output })
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
  ensureDirs()
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
  const output = path.join(exportedReelDir, `${clip.id}-${safeFileStem(clip.title)}-reel.mp4`)
  const cropX = `min(${maxX}\\,max(0\\,2*floor((${cropExpression(normalized)})/2)))`
  const filter = `crop=${cropWidth}:${cropHeight}:${cropX}:0,scale=1080:1920,setsar=1`
  await runFfmpeg(['-y', '-ss', seconds(startMs), '-i', source, '-t', seconds(durationMs), '-vf', filter, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', output])
  return saveLocalClip({ ...clip, exportedReelPath: output, reelKeyframes: keyframes })
}

export function videoStorageInfo() {
  ensureDirs()
  return {
    root: videoStorageRoot,
    sourceVideos: sourceVideoDir,
    exportedClips: exportedClipDir,
    exportedReels: exportedReelDir,
    metadata: process.env.RAQET_DB_PATH || path.join(process.cwd(), 'data', 'raqet.sqlite'),
  }
}
