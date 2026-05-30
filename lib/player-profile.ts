import type { Player } from '@/lib/data'

export type PlayerInterviewAnswers = Record<string, string>

export type CompiledPlayerProfile = {
  profileSummary: string
  playingStyle: string
  currentGoal: string
  preferredSurface?: Player['preferredSurface']
  weeklyTrainingFrequency?: number
  strengths: string[]
  weaknesses: string[]
  profileMarkdown: string
}

const preferredSurfaces: Player['preferredSurface'][] = ['Hard', 'Grass', 'Clay', 'Carpet', 'Other']

export function normalizePreferredSurface(value: unknown): Player['preferredSurface'] {
  const normalized = String(value || '').trim().toLowerCase()
  if (!normalized) return ''
  if (normalized.includes('hard')) return 'Hard'
  if (normalized.includes('grass')) return 'Grass'
  if (normalized.includes('clay')) return 'Clay'
  if (normalized.includes('carpet')) return 'Carpet'
  if (preferredSurfaces.some((surface) => surface.toLowerCase() === normalized)) {
    return preferredSurfaces.find((surface) => surface.toLowerCase() === normalized) || ''
  }
  return 'Other'
}

export const playerInterviewQuestions = [
  {
    id: 'tennisBackground',
    label: 'Tennis background',
    question: 'How long have you played, and what kind of player are you right now?',
  },
  {
    id: 'currentGoals',
    label: 'Current goals',
    question: 'What are you trying to improve over the next 8-12 weeks?',
  },
  {
    id: 'strengths',
    label: 'Strengths',
    question: 'What parts of your game reliably win you points?',
  },
  {
    id: 'weaknesses',
    label: 'Weaknesses',
    question: 'What are the weakest parts of your game right now, especially under pressure, fatigue, or stronger opponents?',
  },
  {
    id: 'patterns',
    label: 'Recurring patterns',
    question: 'What mistakes, tactical habits, or emotional patterns keep repeating?',
  },
  {
    id: 'trainingContext',
    label: 'Training context',
    question: 'How often do you train, what surfaces do you play on, and what constraints matter?',
  },
  {
    id: 'bodyAndRecovery',
    label: 'Body and recovery',
    question: 'Any injuries, fitness limits, recovery issues, sleep patterns, or energy constraints?',
  },
  {
    id: 'mindset',
    label: 'Mindset',
    question: 'How do you usually react to pressure, frustration, losing leads, or playing badly?',
  },
  {
    id: 'lifeContext',
    label: 'General life context',
    question: 'What non-tennis context should the journal remember: schedule, stress, travel, work, motivation?',
  },
  {
    id: 'feedbackStyle',
    label: 'Feedback style',
    question: 'What kind of feedback helps you most: direct, technical, tactical, encouraging, blunt, data-driven?',
  },
]

function splitList(value: string) {
  return value
    .split(/\n|,|;/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8)
}

function extractWeeklyFrequency(value: string) {
  const lower = value.toLowerCase()
  const explicitPerWeek = lower.match(/(\d+(?:\.\d+)?)\s*(?:x|times?|sessions?|practices?|matches?)?\s*(?:a|per)?\s*week/)
  if (explicitPerWeek) return Math.max(0, Math.round(Number(explicitPerWeek[1])))
  if (/\bonce\s+(?:a|per)\s+week\b/.test(lower) || /\bone\s+time\s+(?:a|per)\s+week\b/.test(lower)) return 1
  if (/\btwice\s+(?:a|per)\s+week\b/.test(lower)) return 2
  if (/\bthree\s+times\s+(?:a|per)\s+week\b/.test(lower)) return 3
  return undefined
}

export function buildPlayerMarkdown(player: Player, answers: PlayerInterviewAnswers) {
  return `# Player Profile

## Identity
- Name: ${player.name}
- Dominant hand: ${player.dominantHand}
- Backhand: ${player.backhandType}
- UTR singles: ${player.utrSingles ?? 'not set'}
- UTR doubles: ${player.utrDoubles ?? 'not set'}
- WTN singles: ${player.wtnSingles ?? 'not set'}
- WTN doubles: ${player.wtnDoubles ?? 'not set'}

## Tennis Background
${answers.tennisBackground || 'Not provided.'}

## Current Goals
${answers.currentGoals || player.currentGoal || 'Not provided.'}

## Strengths
${splitList(answers.strengths || player.strengths.join(', ')).map((item) => `- ${item}`).join('\n') || '- Not provided.'}

## Weaknesses
${splitList(answers.weaknesses || player.weaknesses.join(', ')).map((item) => `- ${item}`).join('\n') || '- Not provided.'}

## Recurring Patterns
${answers.patterns || 'Not provided.'}

## Training Context
${answers.trainingContext || `Weekly frequency: ${player.weeklyTrainingFrequency}. Preferred surface: ${player.preferredSurface}.`}

## Body and Recovery
${answers.bodyAndRecovery || 'Not provided.'}

## Mindset
${answers.mindset || 'Not provided.'}

## General Life Context
${answers.lifeContext || 'Not provided.'}

## Feedback Style
${answers.feedbackStyle || 'Not provided.'}
`
}

export function playerFromInterview(player: Player, answers: PlayerInterviewAnswers): Player {
  const strengths = splitList(answers.strengths || player.strengths.join(', '))
  const weaknesses = splitList(answers.weaknesses || player.weaknesses.join(', '))
  const profileSummary = [
    answers.tennisBackground,
    answers.currentGoals ? `Current goal: ${answers.currentGoals}` : '',
    answers.patterns ? `Recurring patterns: ${answers.patterns}` : '',
    answers.feedbackStyle ? `Best feedback style: ${answers.feedbackStyle}` : '',
  ]
    .filter(Boolean)
    .join(' ')

  const inferredSurface = normalizePreferredSurface(answers.trainingContext)
  const inferredFrequency = extractWeeklyFrequency(answers.trainingContext || '')

  const nextPlayer = {
    ...player,
    currentGoal: answers.currentGoals || player.currentGoal,
    preferredSurface: inferredSurface || player.preferredSurface,
    weeklyTrainingFrequency: inferredFrequency ?? player.weeklyTrainingFrequency,
    strengths,
    weaknesses,
    profileSummary: profileSummary || player.profileSummary,
    profileInterviewAnswers: answers,
  }

  return {
    ...nextPlayer,
    profileMarkdown: buildPlayerMarkdown(nextPlayer, answers),
  }
}

export function playerFromCompiledProfile(
  player: Player,
  answers: PlayerInterviewAnswers,
  compiled: CompiledPlayerProfile
): Player {
  return {
    ...player,
    playingStyle: compiled.playingStyle || player.playingStyle,
    currentGoal: compiled.currentGoal || player.currentGoal,
    preferredSurface: normalizePreferredSurface(compiled.preferredSurface) || player.preferredSurface,
    weeklyTrainingFrequency: Number.isFinite(compiled.weeklyTrainingFrequency)
      ? Math.max(0, Math.round(Number(compiled.weeklyTrainingFrequency)))
      : player.weeklyTrainingFrequency,
    strengths: compiled.strengths.length ? compiled.strengths : player.strengths,
    weaknesses: compiled.weaknesses.length ? compiled.weaknesses : player.weaknesses,
    profileSummary: compiled.profileSummary || player.profileSummary,
    profileInterviewAnswers: answers,
    profileMarkdown: compiled.profileMarkdown || buildPlayerMarkdown(player, answers),
  }
}
