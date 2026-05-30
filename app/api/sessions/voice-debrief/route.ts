import { NextResponse } from 'next/server'
import { analyzeVoiceDebrief, transcribeAudio } from '@/lib/openai'
import { hasConfiguredAiProvider } from '@/lib/ai-provider'
import { getSoloSession, listSoloMemories, loadSoloPlayer, saveSoloMemory, saveSoloSession } from '@/lib/solo-store'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
  try {
    if (!hasConfiguredAiProvider()) {
      return NextResponse.json({ error: 'Voice debrief needs a local AI API key.' }, { status: 503 })
    }

    const form = await request.formData()
    const file = form.get('audio')
    const sessionId = String(form.get('sessionId') || '')
    const sessionContext = String(form.get('sessionContext') || '')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing audio file' }, { status: 400 })
    }

    const transcript = await transcribeAudio(file)
    const player = loadSoloPlayer()
    const memoryContext = [
      player.profileMarkdown ? `Player Profile:\n${player.profileMarkdown}` : '',
      !player.profileMarkdown && player.profileSummary ? `Profile summary: ${player.profileSummary}` : '',
      listSoloMemories().filter((memory) => memory.status === 'confirmed').slice(0, 12).map((memory) => `- [${memory.category}] ${memory.content}`).join('\n'),
    ].filter(Boolean).join('\n\n').slice(0, 8000)

    const debrief = await analyzeVoiceDebrief(transcript, sessionContext, memoryContext)

    if (sessionId) {
      const existingSession = getSoloSession(sessionId)
      if (!existingSession) return NextResponse.json(debrief)
      saveSoloSession({
        ...existingSession,
        id: sessionId,
        transcript: debrief.transcript,
        aiSummary: debrief.summary,
        whatWentWell: debrief.whatWentWell,
        whatWentWrong: debrief.whatWentWrong,
        mainTakeaway: debrief.mainTakeaway,
        nextFocus: debrief.nextFocus,
        profileMemoryUpdate: debrief.profileMemoryUpdate || undefined,
        tags: debrief.tags,
      })

      if (debrief.profileMemoryUpdate) {
        saveSoloMemory({
          playerId: player.id,
          content: debrief.profileMemoryUpdate,
          category: 'preference',
          status: 'pending',
        })
      }
    }

    return NextResponse.json(debrief)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Voice debrief failed' }, { status: 503 })
  }
}
