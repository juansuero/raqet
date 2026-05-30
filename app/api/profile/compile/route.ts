import { NextResponse } from 'next/server'
import { compilePlayerProfile } from '@/lib/openai'
import { hasConfiguredAiProvider } from '@/lib/ai-provider'
import { loadSoloPlayer } from '@/lib/solo-store'

export async function POST(request: Request) {
  try {
    const { answers, player } = await request.json()
    const basePlayer = {
      ...loadSoloPlayer(),
      ...player,
    }

    if (!hasConfiguredAiProvider()) {
      return NextResponse.json({
        profileSummary: basePlayer.profileSummary || `${basePlayer.name || 'Player'} is building a local Raqet profile.`,
        playingStyle: basePlayer.playingStyle || '',
        currentGoal: basePlayer.currentGoal || '',
        preferredSurface: basePlayer.preferredSurface || '',
        weeklyTrainingFrequency: basePlayer.weeklyTrainingFrequency || 0,
        strengths: basePlayer.strengths || [],
        weaknesses: basePlayer.weaknesses || [],
        profileMarkdown: basePlayer.profileMarkdown || '# Player Profile\n\nComplete onboarding to generate a richer AI profile when an AI key is configured.',
      })
    }

    return NextResponse.json(await compilePlayerProfile(basePlayer, answers || {}))
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Profile compile failed' }, { status: 503 })
  }
}
