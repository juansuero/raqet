import { NextResponse } from 'next/server'
import { transcribeAudio } from '@/lib/ai'
import { hasConfiguredAiProvider } from '@/lib/ai-provider'

export async function POST(request: Request) {
  try {
    if (!hasConfiguredAiProvider()) {
      return NextResponse.json({ error: 'Voice transcription needs an AI endpoint plus RAQET_AI_TRANSCRIPTION_MODEL.' }, { status: 503 })
    }

    const form = await request.formData()
    const file = form.get('audio')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing audio file' }, { status: 400 })
    }

    return NextResponse.json({ transcript: await transcribeAudio(file) })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Transcription failed' }, { status: 503 })
  }
}
