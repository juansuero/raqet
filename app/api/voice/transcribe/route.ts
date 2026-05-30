import { NextResponse } from 'next/server'
import { transcribeAudio } from '@/lib/openai'
import { hasConfiguredAiProvider } from '@/lib/ai-provider'

export async function POST(request: Request) {
  try {
    if (!hasConfiguredAiProvider()) {
      return NextResponse.json({ error: 'Voice transcription needs a local AI API key.' }, { status: 503 })
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
