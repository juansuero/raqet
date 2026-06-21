export type AiProviderId = 'external-http'

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

type ExternalAiConfig = {
  apiKey: string
  baseUrl: string
  textEndpoint: string
  transcriptionEndpoint: string
  videoEndpoint: string
  model: string
  transcriptionModel: string
  videoModel: string
}

export function redactAiSecrets(value: string) {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted_token]')
    .replace(/\b[A-Za-z0-9_-]{24,}\.[A-Za-z0-9._-]{12,}\b/g, '[redacted_token]')
    .replace(/\b(?:sk|gsk|rk|xai)-[A-Za-z0-9_-]+/gi, '[redacted_ai_key]')
    .replace(/\bAIza[0-9A-Za-z_-]+/g, '[redacted_ai_key]')
}

function clean(value: string | undefined) {
  return (value || '').trim()
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '')
}

function joinUrl(baseUrl: string, path: string) {
  return `${trimTrailingSlash(baseUrl)}${path.startsWith('/') ? path : `/${path}`}`
}

function externalAiConfig(): ExternalAiConfig {
  const baseUrl = clean(process.env.RAQET_AI_BASE_URL)
  return {
    apiKey: clean(process.env.RAQET_AI_API_KEY),
    baseUrl,
    textEndpoint: clean(process.env.RAQET_AI_TEXT_ENDPOINT) || (baseUrl ? joinUrl(baseUrl, '/chat/completions') : ''),
    transcriptionEndpoint: clean(process.env.RAQET_AI_TRANSCRIPTION_ENDPOINT) || (baseUrl ? joinUrl(baseUrl, '/audio/transcriptions') : ''),
    videoEndpoint: clean(process.env.RAQET_AI_VIDEO_ENDPOINT),
    model: clean(process.env.RAQET_AI_MODEL),
    transcriptionModel: clean(process.env.RAQET_AI_TRANSCRIPTION_MODEL),
    videoModel: clean(process.env.RAQET_AI_VIDEO_MODEL) || clean(process.env.RAQET_AI_MODEL),
  }
}

function textMissingEnv(config = externalAiConfig()) {
  return [
    config.apiKey ? null : 'RAQET_AI_API_KEY',
    config.baseUrl || config.textEndpoint ? null : 'RAQET_AI_BASE_URL or RAQET_AI_TEXT_ENDPOINT',
    config.model ? null : 'RAQET_AI_MODEL',
  ].filter(Boolean) as string[]
}

function hasAnyAiEnv(config = externalAiConfig()) {
  return Boolean(
    config.apiKey ||
    config.baseUrl ||
    config.textEndpoint ||
    config.transcriptionEndpoint ||
    config.videoEndpoint ||
    config.model ||
    config.transcriptionModel
  )
}

export function aiProviderStatus(): AiProviderStatus {
  if (process.env.RAQET_AI_DISABLED === 'true') {
    return {
      configured: false,
      provider: null,
      model: null,
      source: 'env',
      missingEnv: [],
      supportsAudioTranscription: false,
      supportsVideoAnalysis: false,
    }
  }

  const config = externalAiConfig()
  const missingEnv = textMissingEnv(config)
  const configured = missingEnv.length === 0

  return {
    configured,
    provider: configured || hasAnyAiEnv(config) ? 'external-http' : null,
    model: config.model || null,
    source: 'env',
    missingEnv,
    supportsAudioTranscription: configured && Boolean(config.transcriptionEndpoint && config.transcriptionModel),
    supportsVideoAnalysis: configured && Boolean(config.videoEndpoint),
  }
}

export function hasConfiguredAiProvider() {
  return aiProviderStatus().configured
}

function configuredExternalAi() {
  const config = externalAiConfig()
  const missingEnv = textMissingEnv(config)
  if (missingEnv.length > 0) {
    throw new AiProviderError(`AI is optional and no endpoint is configured. Set ${missingEnv.join(', ')} to enable this action.`, 503)
  }
  return config
}

function normalizeProviderError(error: unknown, action: string) {
  if (error instanceof AiProviderError) return error
  const status = typeof error === 'object' && error && 'status' in error ? Number((error as { status?: unknown }).status) : undefined
  const raw = error instanceof Error ? error.message : String(error)
  return new AiProviderError(`${action} failed${status ? ` (${status})` : ''}: ${redactAiSecrets(raw)}`, status || 503)
}

async function readJsonResponse(response: Response, action: string) {
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    const message = data?.error?.message || data?.message || response.statusText || 'unknown error'
    throw new AiProviderError(`${action} failed (${response.status}): ${redactAiSecrets(String(message))}`, response.status)
  }
  return data
}

function stringifyContent(content: unknown): string {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object') {
          const record = item as Record<string, unknown>
          return record.text || record.value || ''
        }
        return ''
      })
      .join('')
      .trim()
  }
  return ''
}

function extractText(data: unknown) {
  if (!data || typeof data !== 'object') return ''
  const record = data as Record<string, unknown>
  if (typeof record.text === 'string') return record.text.trim()
  if (typeof record.result === 'string') return record.result.trim()
  if (typeof record.output_text === 'string') return record.output_text.trim()

  const choices = Array.isArray(record.choices) ? record.choices : []
  const firstChoice = choices[0] as Record<string, unknown> | undefined
  if (firstChoice) {
    const message = firstChoice.message as Record<string, unknown> | undefined
    const messageText = stringifyContent(message?.content)
    if (messageText) return messageText
    if (typeof firstChoice.text === 'string') return firstChoice.text.trim()
  }

  const output = Array.isArray(record.output) ? record.output : []
  const outputText = output.map((item) => stringifyContent((item as Record<string, unknown>)?.content)).join('').trim()
  return outputText
}

async function generateWithExternalHttp(options: GenerateOptions) {
  const config = configuredExternalAi()
  const messages = [
    options.systemInstruction ? { role: 'system', content: options.systemInstruction } : null,
    { role: 'user', content: options.userContent },
  ].filter(Boolean)

  const response = await fetch(config.textEndpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      temperature: options.temperature ?? 0.2,
      response_format: options.json ? { type: 'json_object' } : undefined,
    }),
  })

  const data = await readJsonResponse(response, 'AI request')
  const text = extractText(data)
  if (!text) throw new AiProviderError('AI request returned an empty response.', 502)
  return text
}

export async function generateAiText(options: GenerateOptions) {
  try {
    return await generateWithExternalHttp(options)
  } catch (error) {
    throw normalizeProviderError(error, 'AI request')
  }
}

export async function generateAiVideoJson(options: GenerateVideoOptions) {
  const config = configuredExternalAi()
  if (!config.videoEndpoint) {
    throw new AiProviderError('Selected clip video analysis needs RAQET_AI_VIDEO_ENDPOINT. Text AI remains available through the configured endpoint.', 400)
  }

  try {
    const response = await fetch(config.videoEndpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.videoModel,
        systemInstruction: options.systemInstruction,
        mimeType: options.mimeType,
        dataBase64: options.dataBase64,
        text: options.text,
        temperature: options.temperature ?? 0.2,
        responseFormat: 'json',
      }),
    })

    const data = await readJsonResponse(response, 'Selected clip analysis')
    const text = extractText(data)
    if (!text) throw new AiProviderError('Selected clip analysis returned an empty response.', 502)
    return text
  } catch (error) {
    throw normalizeProviderError(error, 'Selected clip analysis')
  }
}

export async function transcribeAudioWithProvider(file: File) {
  const config = configuredExternalAi()
  if (!config.transcriptionEndpoint || !config.transcriptionModel) {
    throw new AiProviderError('Audio transcription needs RAQET_AI_TRANSCRIPTION_MODEL and either RAQET_AI_BASE_URL or RAQET_AI_TRANSCRIPTION_ENDPOINT.', 503)
  }

  const form = new FormData()
  form.append('file', file, file.name || 'voice-note.webm')
  form.append('model', config.transcriptionModel)
  form.append('response_format', 'json')

  const response = await fetch(config.transcriptionEndpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: form,
  })

  const data = await readJsonResponse(response, 'Transcription')
  if (typeof data?.speechPresent === 'boolean' || typeof data?.transcript === 'string') {
    return JSON.stringify(data)
  }

  const transcript = String(data?.text || data?.transcript || extractText(data)).trim()
  return JSON.stringify({ speechPresent: Boolean(transcript), confidence: transcript ? 1 : 0, transcript })
}
