import { AI_COACH_SYSTEM_PROMPT, CLIP_ANALYSIS_SYSTEM_PROMPT, PLAYER_PROFILE_COMPILER_SYSTEM_PROMPT, SESSION_VOICE_DEBRIEF_SYSTEM_PROMPT } from '@/lib/ai-prompts'
import type { ClipAnalysis, Player } from '@/lib/data'
import type { CompiledPlayerProfile, PlayerInterviewAnswers } from '@/lib/player-profile'
import { generateAiText, generateAiVideoJson, redactAiSecrets, transcribeAudioWithProvider } from '@/lib/ai-provider'

type VoiceDebrief = {
  transcript: string
  summary: string
  whatWentWell: string[]
  whatWentWrong: string[]
  mainTakeaway: string
  nextFocus: string
  tags: string[]
  profileMemoryUpdate: string
}

export type PreSessionFocus = {
  focus: string
  tacticalCues: string[]
  avoid: string
  warmupIntention: string
  matchupNote: string
}

type TranscriptionResult = {
  speechPresent?: boolean
  confidence?: number
  transcript?: string
}

const DEFAULT_GROQ_TRANSCRIPTION_MODEL = 'whisper-large-v3-turbo'
const MAX_INLINE_AUDIO_BYTES = 18 * 1024 * 1024
const MAX_INLINE_VIDEO_BYTES = 25 * 1024 * 1024

const supportedAudioTypes = new Set([
  'audio/aac',
  'audio/flac',
  'audio/mp3',
  'audio/m4a',
  'audio/mpeg',
  'audio/mpga',
  'audio/mp4',
  'audio/ogg',
  'audio/opus',
  'audio/pcm',
  'audio/wav',
  'audio/webm',
  'audio/x-m4a',
  'audio/x-wav',
])

const supportedVideoTypes = new Set([
  'video/mp4',
  'video/mpeg',
  'video/mov',
  'video/quicktime',
  'video/webm',
])

function groqKey() {
  return process.env.GROQ_API_KEY || ''
}

function groqTranscriptionModel() {
  return process.env.GROQ_TRANSCRIPTION_MODEL || DEFAULT_GROQ_TRANSCRIPTION_MODEL
}

function aiErrorMessage(error: unknown, action: string) {
  const rawMessage = error instanceof Error ? error.message : String(error)
  const status = typeof error === 'object' && error && 'status' in error ? ` (${String(error.status)})` : ''
  return `${action} failed${status}: ${redactAiSecrets(rawMessage)}`
}

function parseJsonResponse<T>(text: string, action: string): T {
  try {
    return JSON.parse(text) as T
  } catch {
    const cleaned = text
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
    try {
      return JSON.parse(cleaned) as T
    } catch {
      throw new Error(`${action} returned invalid JSON.`)
    }
  }
}

async function generateJson<T>({
  systemInstruction,
  userContent,
  action,
}: {
  systemInstruction: string
  userContent: string
  action: string
}) {
  try {
    const text = await generateAiText({
      systemInstruction,
      userContent,
      temperature: 0.2,
      json: true,
    })
    return parseJsonResponse<T>(text || '{}', action)
  } catch (error) {
    throw new Error(aiErrorMessage(error, action))
  }
}

function normalizeAudioType(file: File) {
  const mimeType = file.type || 'audio/webm'
  const baseType = mimeType.split(';')[0].toLowerCase()

  if (!supportedAudioTypes.has(baseType)) {
    throw new Error(`Audio type ${mimeType || 'unknown'} is not supported. Upload webm, mp3, m4a, wav, ogg, flac, or mp4 audio.`)
  }

  return baseType
}

function normalizeVideoType(file: File) {
  const mimeType = file.type || 'video/mp4'
  const baseType = mimeType.split(';')[0].toLowerCase()

  if (!supportedVideoTypes.has(baseType)) {
    throw new Error(`Video type ${mimeType || 'unknown'} is not supported. Upload mp4, mov, mpeg, or webm video.`)
  }

  return baseType
}

async function transcribeAudioWithGroq(file: File) {
  const apiKey = groqKey()
  if (!apiKey) throw new Error('Missing GROQ_API_KEY for transcription fallback.')

  const form = new FormData()
  form.append('file', file, file.name || 'voice-note.webm')
  form.append('model', groqTranscriptionModel())
  form.append('response_format', 'json')

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  })

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const message = data?.error?.message || response.statusText || 'Groq transcription failed'
    throw new Error(`Groq transcription failed (${response.status}): ${redactAiSecrets(String(message))}`)
  }

  const transcript = String(data?.text || '').trim()
  if (!transcript) throw new Error('Groq transcription returned an empty transcript.')
  return transcript
}

export async function transcribeAudio(file: File) {
  if (file.size > MAX_INLINE_AUDIO_BYTES) {
    throw new Error('Audio file is too large for transcription. Keep recordings under 18 MB.')
  }

  const mimeType = normalizeAudioType(file)
  try {
    const text = await transcribeAudioWithProvider(file, mimeType)
    const parsed = parseJsonResponse<TranscriptionResult>(text || '{}', 'Transcription')
    const transcript = String(parsed.transcript || '').trim()
    const confidence = Number(parsed.confidence || 0)

    if (!parsed.speechPresent || !transcript || confidence < 0.7) {
      throw new Error('No clear speech was detected. Please record again, speak closer to the microphone, or upload a clearer audio file.')
    }

    return transcript
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('No clear speech was detected.')) {
      throw error
    }

    try {
      return await transcribeAudioWithGroq(file)
    } catch (fallbackError) {
      throw new Error(`${aiErrorMessage(error, 'Transcription')} Groq transcription fallback also failed: ${redactAiSecrets(fallbackError instanceof Error ? fallbackError.message : String(fallbackError))}`)
    }
  }
}

export async function analyzeVoiceDebrief(
  transcript: string,
  sessionContext: string,
  playerMemoryContext = ''
): Promise<VoiceDebrief> {
  const parsed = await generateJson<Omit<VoiceDebrief, 'transcript'>>({
    action: 'Debrief analysis',
    systemInstruction: SESSION_VOICE_DEBRIEF_SYSTEM_PROMPT,
    userContent: [
      'Return valid JSON with this exact shape:',
      '{"summary":"","whatWentWell":[],"whatWentWrong":[],"mainTakeaway":"","nextFocus":"","tags":[],"profileMemoryUpdate":""}',
      '',
      `Player memory context:\n${playerMemoryContext || 'No player profile or confirmed memories available yet.'}`,
      `Session context:\n${sessionContext || 'No extra session context.'}`,
      `Transcript:\n${transcript}`,
    ].join('\n\n'),
  })

  return {
    transcript,
    summary: String(parsed.summary || ''),
    whatWentWell: Array.isArray(parsed.whatWentWell) ? parsed.whatWentWell.map(String) : [],
    whatWentWrong: Array.isArray(parsed.whatWentWrong) ? parsed.whatWentWrong.map(String) : [],
    mainTakeaway: String(parsed.mainTakeaway || ''),
    nextFocus: String(parsed.nextFocus || ''),
    tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
    profileMemoryUpdate: String(parsed.profileMemoryUpdate || ''),
  }
}

export async function generatePreSessionFocus(sessionContext: string, playerMemoryContext = ''): Promise<PreSessionFocus> {
  const parsed = await generateJson<PreSessionFocus>({
    action: 'Pre-session focus',
    systemInstruction: [
      'You are Raqet, a concise tennis preparation assistant.',
      'Create a short pre-session focus note from the player context and scheduled session details.',
      'Do not invent injuries, rankings, opponents, scores, or facts not present in the context.',
      'Keep it specific, practical, and short enough to read before walking on court.',
    ].join(' '),
    userContent: [
      'Return valid JSON with this exact shape:',
      '{"focus":"","tacticalCues":[],"avoid":"","warmupIntention":"","matchupNote":""}',
      '',
      `Player memory context:\n${playerMemoryContext || 'No player profile or confirmed memories available yet.'}`,
      `Scheduled session context:\n${sessionContext}`,
    ].join('\n\n'),
  })

  return {
    focus: String(parsed.focus || ''),
    tacticalCues: Array.isArray(parsed.tacticalCues) ? parsed.tacticalCues.map(String).slice(0, 2) : [],
    avoid: String(parsed.avoid || ''),
    warmupIntention: String(parsed.warmupIntention || ''),
    matchupNote: String(parsed.matchupNote || ''),
  }
}

function asStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map(String).map((item) => item.trim()).filter(Boolean).slice(0, 8)
    : []
}

export async function compilePlayerProfile(
  player: Player,
  answers: PlayerInterviewAnswers
): Promise<CompiledPlayerProfile> {
  const parsed = await generateJson<CompiledPlayerProfile>({
    action: 'Player profile compile',
    systemInstruction: PLAYER_PROFILE_COMPILER_SYSTEM_PROMPT,
    userContent: [
      'Return valid JSON with this exact shape:',
      '{"profileSummary":"","playingStyle":"","currentGoal":"","preferredSurface":"","weeklyTrainingFrequency":0,"strengths":[],"weaknesses":[],"profileMarkdown":""}',
      '',
      JSON.stringify(
        {
          playerBasics: {
            name: player.name,
            dominantHand: player.dominantHand,
            backhandType: player.backhandType,
            utrSingles: player.utrSingles,
            utrDoubles: player.utrDoubles,
            wtnSingles: player.wtnSingles,
            wtnDoubles: player.wtnDoubles,
            preferredSurface: player.preferredSurface,
            weeklyTrainingFrequency: player.weeklyTrainingFrequency,
          },
          onboardingAnswers: answers,
        },
        null,
        2
      ),
    ].join('\n\n'),
  })

  return {
    profileSummary: String(parsed.profileSummary || ''),
    playingStyle: String(parsed.playingStyle || ''),
    currentGoal: String(parsed.currentGoal || ''),
    strengths: asStringArray(parsed.strengths),
    weaknesses: asStringArray(parsed.weaknesses),
    profileMarkdown: String(parsed.profileMarkdown || ''),
  }
}

function clampScore(value: unknown) {
  const score = Math.round(Number(value || 0))
  if (!Number.isFinite(score)) return 0
  return Math.max(0, Math.min(10, score))
}

function suggestedUse(value: unknown): ClipAnalysis['suggestedUse'] {
  const normalized = String(value || '').trim()
  if (normalized === 'training_reference' || normalized === 'technical_review') return normalized
  return 'analysis'
}

export async function analyzeClipVideo(file: File, clipContext: string, playerMemoryContext = ''): Promise<ClipAnalysis> {
  if (file.size > MAX_INLINE_VIDEO_BYTES) {
    throw new Error('Video file is too large for clip analysis. Keep clips under 25 MB.')
  }

  const mimeType = normalizeVideoType(file)
  return analyzeClipBuffer(Buffer.from(await file.arrayBuffer()), mimeType, clipContext, playerMemoryContext)
}

export async function analyzeClipBuffer(buffer: Buffer, mimeType: string, clipContext: string, playerMemoryContext = ''): Promise<ClipAnalysis> {
  if (buffer.byteLength > MAX_INLINE_VIDEO_BYTES) {
    throw new Error('Video file is too large for clip analysis. Keep clips under 25 MB.')
  }

  const videoData = buffer.toString('base64')

  try {
    const text = await generateAiVideoJson({
      mimeType,
      dataBase64: videoData,
      systemInstruction: CLIP_ANALYSIS_SYSTEM_PROMPT,
      temperature: 0.2,
      text: [
        'Return valid JSON with this exact shape:',
        '{"aiAnalysis":"","tacticalBreakdown":"","technicalNotes":"","decisionQuality":0,"contentScore":0,"suggestedUse":"analysis","timestamps":[],"tags":[],"profileMemoryUpdate":""}',
        '',
        'Analysis goal:',
        '- Produce a visually grounded review, not a generic tennis lesson.',
        '- If the video is not clear enough, explain the limitation and return low scores.',
        '- Include one concrete "Review next:" action in the most relevant text field.',
        '',
        `Clip context:\n${clipContext || 'No clip context provided.'}`,
        `Player memory context:\n${playerMemoryContext || 'No player profile or confirmed memories available yet.'}`,
      ].join('\n\n'),
    })

    const parsed = parseJsonResponse<Partial<ClipAnalysis>>(text || '{}', 'Clip analysis')

    return {
      aiAnalysis: String(parsed.aiAnalysis || ''),
      tacticalBreakdown: String(parsed.tacticalBreakdown || ''),
      technicalNotes: String(parsed.technicalNotes || ''),
      decisionQuality: clampScore(parsed.decisionQuality),
      contentScore: clampScore(parsed.contentScore),
      suggestedUse: suggestedUse(parsed.suggestedUse),
      timestamps: Array.isArray(parsed.timestamps) ? parsed.timestamps.map(String).slice(0, 8) : [],
      tags: Array.isArray(parsed.tags) ? parsed.tags.map(String).map((tag) => tag.trim().toLowerCase()).filter(Boolean).slice(0, 8) : [],
      profileMemoryUpdate: String(parsed.profileMemoryUpdate || ''),
    }
  } catch (error) {
    throw new Error(aiErrorMessage(error, 'Clip analysis'))
  }
}

export async function generateCoachReply(message: string, context: string) {
  const userContent = [
    `Player context:\n${context || 'No player context available yet.'}`,
    `User message:\n${message}`,
  ].join('\n\n')
  try {
    const text = await generateAiText({
      systemInstruction: AI_COACH_SYSTEM_PROMPT,
      userContent,
      temperature: 0.35,
    })

    return String(text || '').trim() || 'I need a little more context before I can give you a useful answer.'
  } catch (error) {
    throw new Error(aiErrorMessage(error, 'Coach response'))
  }
}
