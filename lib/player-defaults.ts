import type { Player } from '@/lib/data'

export function emptyPlayer(user: { id: string; email?: string; user_metadata?: Record<string, any> }): Player {
  return {
    id: user.id,
    userId: user.id,
    email: user.email,
    name: user.user_metadata?.full_name || user.email || 'Player',
    dominantHand: 'right',
    backhandType: 'two-handed',
    playingStyle: '',
    currentGoal: '',
    strengths: [],
    weaknesses: [],
    preferredSurface: '',
    weeklyTrainingFrequency: 0,
    profileSummary: '',
    profileMarkdown: '',
    profileInterviewAnswers: {},
    createdAt: new Date().toISOString(),
  }
}
