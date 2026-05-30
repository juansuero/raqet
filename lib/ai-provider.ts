import { GoogleGenAI } from '@google/genai'

export type AiProviderId = 'gemini' | 'openai'

export type AiProviderStatus = {
  configured: boolean
  provider: AiProviderId | null
  model: string | null
  source: 'env'
  missingEnv: string[]
  supportsAudioTranscription: boolean
  supportsVideoAnalysis: boolean
}

export class AiProviderError extends Error {
  status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'AiProviderError'
    this.status = status
  }
}

type GenerateOptions = {
  systemInstruction?: string
  userContent: string
  temperature?: number
  json?: boolean
}

type GenerateVideoOptions = {
  systemInstruction: string
  mimeType: string
  dataBase64: string
  text: string
  temperature?: number
}

const DEFAULT_GEMINI_MODEL = 'gemini-flash-latest'
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini'
const DEFAULT_OPENAI_TRANSCRIPTION_MODEL = 'gpt-4o-mini-transcribe'

export function redactAiSecrets(value: string) {
  return value
    .replace(/AIza[0-9A-Za-z_-]+/g, '[redacted_gemini_key]')
    .replace(/sk-[A-Za-z0-9_-]+/g, '[redacted_openai_key]')
    .replace(/gsk_[A-Za-z0-9_-]+/g, '[redacted_groq_key]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [redacted_token]')
}

function normalizeProvider(value: string | undefined): AiProviderId | null {
  const normalized = (value || '').trim().toLowerCase()
  if (normalized === 'gemini' || normalized === 'google') return 'gemini'
  if (normalized === 'openai') return 'openai'
  return null
}

export function selectedAiProvider(): AiProviderId | null {
  if (process.env.RAQET_AI_DISABLED === 'true') return null
  const explicit = normalizeProvider(process.env.RAQET_AI_PROVIDER)
  if (explicit) return explicit
  if (process.env.GEMINI_API_KEY) return 'gemini'
  if (process.env.OPENAI_API_KEY) return 'openai'
  return null
}

export function aiProviderStatus(): AiProviderStatus {
  const provider = selectedAiProvider()
  if (!provider) {
    return {
      configured: false,
      provider: null,
      model: null,
      source: 'env',
      missingEnv: ['RAQET_AI_PROVIDER plus provider API key, or GEMINI_API_KEY / OPENAI_API_KEY'],
      supportsAudioTranscription: false,
      supportsVideoAnalysis: false,
    }
  }

  if (provider === 'gemini') {
    const configured = Boolean(process.env.GEMINI_API_KEY)
    return {
      configured,
      provider,
      model: process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
      source: 'env',
      missingEnv: configured ? [] : ['GEMINI_API_KEY'],
      supportsAudioTranscription: configured,
      supportsVideoAnalysis: configured,
    }
  }

  const configured = Boolean(process.env.OPENAI_API_KEY)
  return {
    configured,
    provider,
    model: process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
    source: 'env',
    missingEnv: configured ? [] : ['OPENAI_API_KEY'],
    supportsAudioTranscription: configured,
    supportsVideoAnalysis: false,
  }
}

export function hasConfiguredAiProvider() {
  return aiProviderStatus().configured
}

function configuredProvider(): AiProviderId {
  const status = aiProviderStatus()
  if (!status.configured || !status.provider) {
    throw new AiProviderError(`AI is optional and no provider is configured. Set ${status.missingEnv.join(', ')} to enable this action.`, 503)
  }
  return status.provider
}

function normalizeProviderError(error: unknown, action: string) {
  if (error instanceof AiProviderError) return error
  const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status?: unknown }).status) : undefined
  const raw = error instanceof Error ? error.message : String(error)
  return new AiProviderError(`${action} failed${status ? ` (${status})` : ''}: ${redactAiSecrets(raw)}`, status || 503)
}

async function generateWithGemini(options: GenerateOptions) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new AiProviderError('Gemini is selected but GEMINI_API_KEY is not configured.', 503)
  const client = new GoogleGenAI({ apiKey })
  const response = await client.models.generateContent({
    model: process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
    contents: options.userContent,
    config: {
      systemInstruction: options.systemInstruction,
      temperature: options.temperature ?? 0.2,
      responseMimeType: options.json ? 'application/json' : undefined,
    },
  })
  return String(response.text || '').trim()
}

async function generateWithOpenAi(options: GenerateOptions) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new AiProviderError('OpenAI is selected but OPENAI_API_KEY is not configured.', 503)

  const messages = [
    options.systemInstruction ? { role: 'system', content: options.systemInstruction } : null,
    { role: 'user', content: options.userContent },
  ].filter(Boolean)

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
      messages,
      temperature: options.temperature ?? 0.2,
      response_format: options.json ? { type: 'json_object' } : undefined,
    }),
  })

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new AiProviderError(`OpenAI request failed (${response.status}): ${redactAiSecrets(String(data?.error?.message || response.statusText || 'unknown error'))}`, response.status)
  }

  return String(data?.choices?.[0]?.message?.content || '').trim()
}

export async function generateAiText(options: GenerateOptions) {
  const provider = configuredProvider()
  try {
    return provider === 'gemini'
      ? await generateWithGemini(options)
      : await generateWithOpenAi(options)
  } catch (error) {
    throw normalizeProviderError(error, 'AI request')
  }
}

export async function generateAiVideoJson(options: GenerateVideoOptions) {
  const provider = configuredProvider()
  if (provider !== 'gemini') {
    throw new AiProviderError('Selected clip video analysis currently requires Gemini. OpenAI remains available for text and session actions.', 400)
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new AiProviderError('Gemini is selected but GEMINI_API_KEY is not configured.', 503)
    const client = new GoogleGenAI({ apiKey })
    const response = await client.models.generateContent({
      model: process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
      contents: [
        {
          inlineData: {
            mimeType: options.mimeType,
            data: options.dataBase64,
          },
        },
        { text: options.text },
      ],
      config: {
        systemInstruction: options.systemInstruction,
        temperature: options.temperature ?? 0.2,
        responseMimeType: 'application/json',
      },
    })
    return String(response.text || '').trim()
  } catch (error) {
    throw normalizeProviderError(error, 'Selected clip analysis')
  }
}

export async function transcribeAudioWithProvider(file: File, mimeType: string) {
  const provider = configuredProvider()

  if (provider === 'gemini') {
    try {
      const apiKey = process.env.GEMINI_API_KEY
      if (!apiKey) throw new AiProviderError('Gemini is selected but GEMINI_API_KEY is not configured.', 503)
      const client = new GoogleGenAI({ apiKey })
      const audioData = Buffer.from(await file.arrayBuffer()).toString('base64')
      const response = await client.models.generateContent({
        model: process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
        contents: [
          {
            inlineData: {
              mimeType,
              data: audioData,
            },
          },
          {
            text: [
              'You are a strict speech-to-text engine, not a creative assistant.',
              'Transcribe only words that are clearly spoken in the attached audio.',
              'Never infer, summarize, complete, translate, or invent tennis content.',
              'If the audio is silent, too short, malformed, or unclear, set speechPresent to false and transcript to an empty string.',
              'Return JSON only with this exact shape:',
              '{"speechPresent":false,"confidence":0,"transcript":""}',
            ].join(' '),
          },
        ],
        config: {
          temperature: 0,
          responseMimeType: 'application/json',
        },
      })
      return String(response.text || '{}')
    } catch (error) {
      throw normalizeProviderError(error, 'Transcription')
    }
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new AiProviderError('OpenAI is selected but OPENAI_API_KEY is not configured.', 503)
  const form = new FormData()
  form.append('file', file, file.name || 'voice-note.webm')
  form.append('model', process.env.OPENAI_TRANSCRIPTION_MODEL || DEFAULT_OPENAI_TRANSCRIPTION_MODEL)

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: form,
  })

  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new AiProviderError(`OpenAI transcription failed (${response.status}): ${redactAiSecrets(String(data?.error?.message || response.statusText || 'unknown error'))}`, response.status)
  }

  return JSON.stringify({ speechPresent: Boolean(data?.text), confidence: data?.text ? 1 : 0, transcript: String(data?.text || '').trim() })
}
