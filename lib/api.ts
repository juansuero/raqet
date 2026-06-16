import type { Clip, ClipAnalysis, CoachMessage, GoogleCalendarConnection, LocalVideo, MemoryItem, Opponent, Player, Project, RatingHistoryEntry, ReelKeyframe, Session, Tournament, TournamentMatch } from '@/lib/data'
import type { CompiledPlayerProfile, PlayerInterviewAnswers } from '@/lib/player-profile'

export const maxAudioUploadBytes = 18 * 1024 * 1024

async function request<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    })

    if (!response.ok) return null
    return response.json()
  } catch {
    return null
  }
}

async function readApiError(response: Response, fallback: string) {
  try {
    const data = await response.json()
    return typeof data?.error === 'string' ? data.error : fallback
  } catch {
    return fallback
  }
}

export function loadPlayer() {
  return request<Player>('/api/profile')
}

export function savePlayer(player: Player) {
  return request<Player>('/api/profile', {
    method: 'PUT',
    body: JSON.stringify(player),
  })
}

export function compilePlayerProfileDraft(player: Player, answers: PlayerInterviewAnswers) {
  return request<CompiledPlayerProfile>('/api/profile/compile', {
    method: 'POST',
    body: JSON.stringify({ player, answers }),
  })
}

export function savePlayerInterview(player: Player, answers: PlayerInterviewAnswers, compiledProfile?: CompiledPlayerProfile) {
  return request<Player>('/api/profile/interview', {
    method: 'POST',
    body: JSON.stringify({ player, answers, compiledProfile }),
  })
}

export async function analyzeSessionVoice(audio: File, sessionContext: string, sessionId?: string) {
  if (audio.size > maxAudioUploadBytes) {
    throw new Error('Audio file is too large for transcription. Keep recordings under 18 MB.')
  }

  const form = new FormData()
  form.append('audio', audio)
  form.append('sessionContext', sessionContext)
  if (sessionId) form.append('sessionId', sessionId)

  try {
    const response = await fetch('/api/sessions/voice-debrief', {
      method: 'POST',
      body: form,
    })

    if (!response.ok) throw new Error(await readApiError(response, 'Voice debrief failed'))
    return response.json()
  } catch (error) {
    if (error instanceof TypeError && error.message.toLowerCase().includes('failed to fetch')) {
      throw new Error('Voice analysis request was interrupted or timed out. The session draft was saved; try a shorter audio note or check the session later.')
    }
    throw error instanceof Error ? error : new Error('Voice debrief failed')
  }
}

export async function transcribeVoiceAnswer(audio: File | Blob, eventType = 'onboarding_transcription') {
  const form = new FormData()
  form.append('audio', audio, 'answer.webm')
  form.append('eventType', eventType)

  try {
    const response = await fetch('/api/voice/transcribe', {
      method: 'POST',
      body: form,
    })

    if (!response.ok) throw new Error(await readApiError(response, 'Transcription failed'))
    return response.json()
  } catch (error) {
    throw error instanceof Error ? error : new Error('Transcription failed')
  }
}

export function loadUsage() {
  return request<{
    limit: number
    used: number
    remaining: number
    cycleStart: string
    resetAt: string
  }>('/api/usage')
}

export type AiActionLog = {
  id: string
  action_type: string
  status: 'success' | 'failed'
  duration_ms: number
  error_code: string | null
  created_at: string
}

export function loadAiActionLogs() {
  return request<AiActionLog[]>('/api/ai-actions')
}

export function loadRatingHistory() {
  return request<RatingHistoryEntry[]>('/api/rating-history')
}

export function createRatingHistoryEntry(entry: Omit<RatingHistoryEntry, 'id' | 'createdAt'>) {
  return request<RatingHistoryEntry>('/api/rating-history', {
    method: 'POST',
    body: JSON.stringify(entry),
  })
}

export function loadSessions() {
  return request<Session[]>('/api/sessions')
}

export function createSession(session: Session) {
  return request<Session>('/api/sessions', {
    method: 'POST',
    body: JSON.stringify(session),
  })
}

export function createScheduledSession(session: Session, syncToGoogleCalendar: boolean) {
  return request<Session>('/api/sessions', {
    method: 'POST',
    body: JSON.stringify({ ...session, syncToGoogleCalendar }),
  })
}

export function updateSession(session: Session) {
  return request<Session>('/api/sessions', {
    method: 'PATCH',
    body: JSON.stringify(session),
  })
}

export function updateScheduledSession(session: Session, syncToGoogleCalendar: boolean) {
  return request<Session>('/api/sessions', {
    method: 'PATCH',
    body: JSON.stringify({ ...session, syncToGoogleCalendar }),
  })
}

export async function deleteSession(id: string) {
  const response = await fetch(`/api/sessions?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })

  if (!response.ok) throw new Error(await readApiError(response, 'Session delete failed'))
  return response.json() as Promise<{ deletedId: string }>
}

export function loadOpponents() {
  return request<Opponent[]>('/api/opponents')
}

export function loadGoogleCalendarConnection() {
  return request<{ connected: boolean; connection: GoogleCalendarConnection | null }>('/api/integrations/google-calendar')
}

export async function createOpponent(input: Omit<Opponent, 'id' | 'createdAt'> & { id?: string; createdAt?: string }) {
  const response = await fetch('/api/opponents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!response.ok) throw new Error(await readApiError(response, 'Opponent save failed'))
  return response.json() as Promise<Opponent>
}

export async function updateOpponent(input: Opponent) {
  const response = await fetch('/api/opponents', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!response.ok) throw new Error(await readApiError(response, 'Opponent update failed'))
  return response.json() as Promise<Opponent>
}

export async function deleteOpponent(id: string) {
  const response = await fetch(`/api/opponents?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })

  if (!response.ok) throw new Error(await readApiError(response, 'Opponent delete failed'))
  return response.json() as Promise<{ deletedId: string }>
}

export function loadTournaments() {
  return request<Tournament[]>('/api/tournaments')
}

export function createTournament(tournament: Tournament) {
  return request<Tournament>('/api/tournaments', {
    method: 'POST',
    body: JSON.stringify(tournament),
  })
}

export function updateTournament(tournament: Tournament) {
  return request<Tournament>('/api/tournaments', {
    method: 'PATCH',
    body: JSON.stringify(tournament),
  })
}

export async function deleteTournament(id: string) {
  const response = await fetch(`/api/tournaments?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })

  if (!response.ok) throw new Error(await readApiError(response, 'Tournament delete failed'))
  return response.json() as Promise<{ deletedId: string }>
}

export function loadTournamentMatches() {
  return request<TournamentMatch[]>('/api/tournament-matches')
}

export function createTournamentMatch(match: TournamentMatch) {
  return request<TournamentMatch>('/api/tournament-matches', {
    method: 'POST',
    body: JSON.stringify(match),
  })
}

export function updateTournamentMatch(match: TournamentMatch) {
  return request<TournamentMatch>('/api/tournament-matches', {
    method: 'PATCH',
    body: JSON.stringify(match),
  })
}

export async function deleteTournamentMatch(id: string) {
  const response = await fetch(`/api/tournament-matches?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.error ?? 'Tournament match delete failed')
  }
  return response.json() as Promise<{ deletedId: string }>
}

export function loadCoachMessages() {
  return fetch('/api/coach').then(async (response) => {
    if (!response.ok) throw new Error(await readApiError(response, 'Coach messages load failed'))
    return response.json() as Promise<CoachMessage[]>
  })
}

export async function sendCoachMessage(message: string) {
  const response = await fetch('/api/coach', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })

  if (!response.ok) throw new Error(await readApiError(response, 'Coach response failed'))
  return response.json() as Promise<{ userMessage: CoachMessage; assistantMessage: CoachMessage }>
}

export async function deleteCoachConversation(messageId: string) {
  const response = await fetch(`/api/coach?messageId=${encodeURIComponent(messageId)}`, {
    method: 'DELETE',
  })

  if (!response.ok) throw new Error(await readApiError(response, 'Coach conversation delete failed'))
  return response.json() as Promise<{ deletedIds: string[] }>
}

export function loadProjects() {
  return request<Project[]>('/api/projects')
}

export async function createProject(name: string) {
  const response = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!response.ok) throw new Error(await readApiError(response, 'Project creation failed'))
  return response.json() as Promise<Project>
}

export async function deleteProject(id: string) {
  const response = await fetch(`/api/projects?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!response.ok) throw new Error(await readApiError(response, 'Project delete failed'))
  return response.json() as Promise<{ deletedId: string }>
}

export function loadClips(projectId?: string) {
  const url = projectId ? `/api/clips?projectId=${encodeURIComponent(projectId)}` : '/api/clips'
  return request<Clip[]>(url)
}

export function loadVideos(projectId?: string) {
  const url = projectId ? `/api/videos?projectId=${encodeURIComponent(projectId)}` : '/api/videos'
  return request<{ videos: LocalVideo[]; storage: Record<string, string> }>(url)
}

export async function deleteVideo(id: string) {
  const response = await fetch(`/api/videos?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (!response.ok) throw new Error(await readApiError(response, 'Source video delete failed'))
  return response.json() as Promise<{ deletedId: string }>
}

export async function createVideoPlaybackProxy(id: string) {
  const response = await fetch(`/api/videos/${encodeURIComponent(id)}/proxy`, { method: 'POST' })
  if (!response.ok) throw new Error(await readApiError(response, 'Playback proxy creation failed'))
  return response.json() as Promise<LocalVideo>
}

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

export type PointDetectionJob = {
  id: string
  videoId: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  startMs: number
  endMs?: number
  maxDurationMs: number
  progressPercent: number
  createdAt: string
  updatedAt: string
  result?: PointDetectionResult
  error?: string
}

export type HighlightExportOptions = {
  projectId?: string
  localVideoId?: string
  clipIds?: string[]
  fade?: boolean
  quality?: 'draft' | 'standard' | 'high'
  resolution?: '720' | '1080' | 'source'
  fps?: 'source' | '30' | '60'
}

export type HighlightExportJob = {
  id: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  progressPercent: number
  createdAt: string
  updatedAt: string
  result?: { outputPath: string; clipCount: number; durationSeconds: number }
  error?: string
}

export async function importVideo(file: File, sessionId = '', projectId = '', onProgress?: (progress: number) => void) {
  const form = new FormData()
  if (sessionId) form.append('sessionId', sessionId)
  if (projectId) form.append('projectId', projectId)
  form.append('file', file)
  const params = new URLSearchParams()
  if (sessionId) params.set('sessionId', sessionId)
  if (projectId) params.set('projectId', projectId)
  const url = params.size ? `/api/videos?${params.toString()}` : '/api/videos'
  if (!onProgress) {
    const response = await fetch(url, { method: 'POST', body: form })
    if (!response.ok) throw new Error(await readApiError(response, 'Video import failed'))
    return response.json() as Promise<LocalVideo>
  }

  return new Promise<LocalVideo>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)))
    }
    xhr.onload = () => {
      let data: unknown = null
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : null
      } catch {
        data = null
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        const message = data && typeof data === 'object' && 'error' in data && typeof data.error === 'string' ? data.error : 'Video import failed'
        reject(new Error(message))
        return
      }
      onProgress(100)
      resolve(data as LocalVideo)
    }
    xhr.onerror = () => reject(new Error('Video import request was interrupted. Check free disk space, then use Large local file import for very large videos.'))
    xhr.onabort = () => reject(new Error('Video import was cancelled.'))
    xhr.send(form)
  })
}

export async function importVideoFromPath(filePath: string, sessionId = '', projectId = '') {
  const response = await fetch('/api/videos/local', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filePath, sessionId, projectId }),
  })
  if (!response.ok) throw new Error(await readApiError(response, 'Local video import failed'))
  return response.json() as Promise<LocalVideo>
}

export async function findPointCandidates(videoId: string, options: { startMs?: number; endMs?: number; maxDurationMs?: number } = {}) {
  const response = await fetch(`/api/videos/${encodeURIComponent(videoId)}/points`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  })
  if (!response.ok) throw new Error(await readApiError(response, 'Point detection failed'))
  return response.json() as Promise<PointDetectionResult>
}

export async function startPointDetection(videoId: string, options: { startMs?: number; endMs?: number; maxDurationMs?: number } = {}) {
  const response = await fetch(`/api/videos/${encodeURIComponent(videoId)}/points`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...options, background: true }),
  })
  if (!response.ok) throw new Error(await readApiError(response, 'Point detection failed'))
  return response.json() as Promise<PointDetectionJob>
}

export async function loadPointDetectionJob(videoId: string, jobId: string) {
  const response = await fetch(`/api/videos/${encodeURIComponent(videoId)}/points?jobId=${encodeURIComponent(jobId)}`)
  if (!response.ok) throw new Error(await readApiError(response, 'Point detection job check failed'))
  return response.json() as Promise<PointDetectionJob>
}

export async function loadPointDetectionJobs(videoId: string) {
  const response = await fetch(`/api/videos/${encodeURIComponent(videoId)}/points`)
  if (!response.ok) throw new Error(await readApiError(response, 'Point detection jobs load failed'))
  return response.json() as Promise<PointDetectionJob[]>
}

export async function cancelPointDetectionJob(videoId: string, jobId: string) {
  const response = await fetch(`/api/videos/${encodeURIComponent(videoId)}/points?jobId=${encodeURIComponent(jobId)}`, {
    method: 'DELETE',
  })
  if (!response.ok) throw new Error(await readApiError(response, 'Point detection stop failed'))
  return response.json() as Promise<PointDetectionJob>
}

export function createClip(clip: Clip) {
  return request<Clip>('/api/clips', {
    method: 'POST',
    body: JSON.stringify(clip),
  })
}

export function updateClip(clip: Clip) {
  return request<Clip>('/api/clips', {
    method: 'PATCH',
    body: JSON.stringify(clip),
  })
}

export async function deleteClip(id: string) {
  const response = await fetch(`/api/clips?id=${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })

  if (!response.ok) throw new Error(await readApiError(response, 'Clip delete failed'))
  return response.json() as Promise<{ deletedId: string }>
}

export async function exportClip(id: string) {
  const response = await fetch(`/api/clips/${encodeURIComponent(id)}/export`, { method: 'POST' })
  if (!response.ok) throw new Error(await readApiError(response, 'Clip export failed'))
  return response.json() as Promise<Clip>
}

export async function exportClips(projectId?: string) {
  const response = await fetch('/api/clips/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId }),
  })
  if (!response.ok) throw new Error(await readApiError(response, 'Batch export failed'))
  return response.json() as Promise<{ clips: Clip[]; exportedCount: number; failed: Array<{ id: string; title: string; error: string }> }>
}

export async function exportHighlight(options: HighlightExportOptions) {
  const response = await fetch('/api/clips/highlight', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  })
  if (!response.ok) throw new Error(await readApiError(response, 'Highlight export failed'))
  return response.json() as Promise<{ outputPath: string; clipCount: number; durationSeconds: number }>
}

export async function startHighlightExport(options: HighlightExportOptions) {
  const response = await fetch('/api/clips/highlight', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...options, background: true }),
  })
  if (!response.ok) throw new Error(await readApiError(response, 'Highlight export failed'))
  return response.json() as Promise<HighlightExportJob>
}

export async function loadHighlightExportJob(jobId: string) {
  const response = await fetch(`/api/clips/highlight?jobId=${encodeURIComponent(jobId)}`)
  if (!response.ok) throw new Error(await readApiError(response, 'Highlight export job check failed'))
  return response.json() as Promise<HighlightExportJob>
}

export async function showFileLocation(path: string) {
  const response = await fetch('/api/files/show', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  })
  if (!response.ok) throw new Error(await readApiError(response, 'Could not open file location'))
  return response.json() as Promise<{ ok: true }>
}

export async function exportReel(id: string, keyframes: ReelKeyframe[]) {
  const response = await fetch(`/api/clips/${encodeURIComponent(id)}/reel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keyframes }),
  })
  if (!response.ok) throw new Error(await readApiError(response, 'Reel export failed'))
  return response.json() as Promise<Clip>
}

export async function analyzeClipVideo(video: File, clipContext: string) {
  try {
    const response = await fetch('/api/clips/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': video.type || 'application/octet-stream',
        'x-file-name': encodeURIComponent(video.name || 'clip'),
        'x-clip-context': encodeURIComponent(clipContext.slice(0, 6000)),
      },
      body: video,
    })

    if (!response.ok) throw new Error(await readApiError(response, 'Clip analysis failed'))
    return response.json() as Promise<ClipAnalysis>
  } catch (error) {
    throw error instanceof Error ? error : new Error('Clip analysis failed')
  }
}

export async function analyzeSavedClip(id: string) {
  const response = await fetch(`/api/clips/${encodeURIComponent(id)}/analyze`, { method: 'POST' })
  if (!response.ok) throw new Error(await readApiError(response, 'Selected clip analysis failed'))
  return response.json() as Promise<Clip>
}

export function loadMemories() {
  return request<MemoryItem[]>('/api/memory')
}

export function updateMemoryStatus(id: string, status: MemoryItem['status']) {
  return request<{ ok: true }>('/api/memory', {
    method: 'PATCH',
    body: JSON.stringify({ id, status }),
  })
}
