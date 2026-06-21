import type { MatchResult, MatchScore } from '@/lib/match-score'

export type SessionVisibility = 'private'

export interface Player {
  id: string
  userId?: string
  email?: string
  name: string
  utrSingles?: number
  utrDoubles?: number
  wtnSingles?: number
  wtnDoubles?: number
  dominantHand: 'right' | 'left'
  backhandType: 'one-handed' | 'two-handed'
  playingStyle: string
  currentGoal: string
  strengths: string[]
  weaknesses: string[]
  preferredSurface: 'Hard' | 'Grass' | 'Clay' | 'Carpet' | 'Other' | ''
  weeklyTrainingFrequency: number
  profileSummary: string
  profileMarkdown?: string
  profileInterviewAnswers?: Record<string, unknown>
  coachPreferences?: CoachPreferences
  createdAt: string
}

export interface CoachPreferences {
  completed?: boolean
  coachName: string
  style: 'supportive' | 'direct' | 'tactical' | 'technical'
  detailLevel: 'brief' | 'balanced' | 'detailed'
  encouragement: 'calm' | 'encouraging' | 'blunt'
}

export interface Session {
  id: string
  playerId: string
  organizationId?: string
  teamId?: string
  seasonId?: string
  visibility?: SessionVisibility
  status?: 'planned' | 'completed' | 'cancelled'
  date: string
  scheduledStartAt?: string
  scheduledEndAt?: string
  reminderMinutes?: number
  calendarId?: string
  calendarEventId?: string
  calendarHtmlLink?: string
  preSessionFocus?: string
  preSessionFocusSentAt?: string
  type: 'training' | 'match' | 'class' | 'tournament' | 'fitness'
  title: string
  durationMinutes: number
  surface: string
  location: string
  matchType?: 'singles' | 'doubles'
  opponentId?: string
  opponentName?: string
  partnerId?: string
  partnerName?: string
  opponentPartnerId?: string
  opponentPartnerName?: string
  opponentStyle?: string
  result?: string
  score?: string
  scoreData?: MatchScore
  intensity: number
  energyBefore: number
  energyAfter: number
  confidence: number
  mainFocus: string
  rawNotes: string
  transcript?: string
  aiSummary?: string
  whatWentWell?: string[]
  whatWentWrong?: string[]
  mainTakeaway?: string
  nextFocus?: string
  profileMemoryUpdate?: string
  tags: string[]
  createdAt: string
}

export interface GoogleCalendarConnection {
  id: string
  email?: string
  calendarId: string
  connectedAt: string
}

export interface InAppNotification {
  id: string
  sessionId?: string
  kind: 'pre_session_focus'
  title: string
  body: string
  readAt?: string
  createdAt: string
}

export interface Opponent {
  id: string
  playerId?: string
  name: string
  style?: string
  dominantHand?: 'right' | 'left' | 'unknown'
  utrSingles?: number
  wtnSingles?: number
  rankingLabel?: string
  rankingValue?: number
  notes?: string
  createdAt: string
}

export interface Clip {
  id: string
  sessionId: string
  playerId: string
  projectId?: string
  localVideoId?: string
  startMs?: number
  endMs?: number
  title: string
  videoUrl: string
  thumbnailUrl: string
  durationSeconds: number
  clipType: 'serve' | 'return' | 'rally' | 'defense' | 'attack' | 'net' | 'error' | 'winner' | 'pressure_point'
  pointResult: 'won' | 'lost' | 'unknown'
  pointEnding?: PointEnding
  shotContext?: ShotContext
  scoreContext?: string
  playerIntention?: string
  aiAnalysis?: string
  aiPromptVersion?: string
  tacticalBreakdown?: string
  technicalNotes?: string
  decisionQuality: number
  contentScore: number
  suggestedUse: 'analysis' | 'training_reference' | 'technical_review'
  timestamps?: string[]
  tags: string[]
  profileMemoryUpdate?: string
  exportedClipPath?: string
  exportedReelPath?: string
  reelKeyframes?: ReelKeyframe[]
  events?: ClipEvent[]
  createdAt: string
}

export type PointEnding =
  | 'forehand_winner'
  | 'backhand_winner'
  | 'volley_winner'
  | 'smash_winner'
  | 'opponent_winner'
  | 'opponent_error'
  | 'forced_long_error'
  | 'forced_net_error'
  | 'forced_wide_error'
  | 'unforced_long_error'
  | 'unforced_net_error'
  | 'unforced_wide_error'
  | 'ace'
  | 'double_fault_wide'
  | 'double_fault_net'
  | 'double_fault_long'
  | 'missed_return'
  | 'other'

export type ShotContext = 'serve' | 'return' | 'rally' | 'net' | 'passing_shot' | 'approach' | 'defense' | 'attack'

export interface ClipEvent {
  id: string
  timestampMs: number
  action: string
  note: string
}

export interface ReelKeyframe {
  id?: string
  timestampMs: number
  xPercent: number
}

export interface Project {
  id: string
  name: string
  createdAt: string
}

export interface LocalVideo {
  id: string
  sessionId?: string
  projectId?: string
  fileName: string
  storedFileName: string
  mimeType: string
  sizeBytes: number
  durationMs?: number
  playbackProxyStoredFileName?: string
  playbackProxyCreatedAt?: string
  importedAt: string
}

export type ClipAnalysis = {
  aiAnalysis: string
  tacticalBreakdown: string
  technicalNotes: string
  decisionQuality: number
  contentScore: number
  suggestedUse: 'analysis' | 'training_reference' | 'technical_review'
  timestamps: string[]
  tags: string[]
  profileMemoryUpdate: string
}

export type RatingMetricType = 'utr_singles' | 'utr_doubles' | 'wtn_singles' | 'wtn_doubles' | 'custom_ranking'

export interface RatingHistoryEntry {
  id: string
  playerId?: string
  metricType: RatingMetricType
  label: string
  value: number
  eventDate: string
  lowerIsBetter: boolean
  notes?: string
  createdAt: string
}

export interface Tournament {
  id: string
  playerId?: string
  name: string
  startDate: string
  endDate?: string
  location: string
  surface: string
  level: string
  drawSize?: number
  result?: string
  notes?: string
  createdAt: string
}

export interface TournamentMatch {
  id: string
  tournamentId: string
  playerId?: string
  round: string
  date: string
  matchType?: 'singles' | 'doubles'
  opponentId?: string
  opponentName: string
  partnerId?: string
  partnerName?: string
  opponentPartnerName?: string
  opponentUtr?: number
  opponentWtn?: number
  opponentRankingLabel?: string
  opponentRankingValue?: number
  score: string
  scoreData?: MatchScore
  result: MatchResult
  durationMinutes?: number
  notes?: string
  createdAt: string
}

export type CoachMessageRole = 'user' | 'assistant'

export interface CoachMessage {
  id: string
  role: CoachMessageRole
  content: string
  createdAt: string
}

export interface Pattern {
  id: string
  playerId: string
  memoryId?: string
  title: string
  description: string
  category: 'tactical' | 'technical' | 'mental' | 'physical' | 'serve' | 'return' | 'movement' | 'decision_making'
  evidenceCount: number
  confidence: 'low' | 'medium' | 'high'
  trend: 'improving' | 'worsening' | 'stable' | 'new'
  lastSeen: string
  relatedSessionIds: string[]
  relatedTournamentMatchIds?: string[]
  relatedClipIds: string[]
  recommendation: string
  status: 'draft' | 'approved' | 'discarded'
  evidenceSummary?: string
  uncertainty?: string
  createdAt?: string
  updatedAt?: string
}

export interface TrainingBlock {
  id: string
  playerId: string
  patternId?: string
  title: string
  objective: string
  category: 'tactical' | 'technical' | 'mental' | 'physical' | 'serve' | 'return' | 'movement' | 'matchplay'
  priority: 'low' | 'medium' | 'high'
  durationMinutes: number
  instructions: string[]
  successCriteria: string[]
  evidenceSummary?: string
  status: 'draft' | 'approved' | 'discarded'
  source: 'ai' | 'manual'
  createdAt: string
  updatedAt: string
}

export interface SessionTrainingBlockLink {
  id: string
  sessionId: string
  trainingBlockId: string
  completionStatus: 'planned' | 'attempted' | 'completed' | 'missed'
  successCriteriaNotes: string
  createdAt: string
  updatedAt: string
}

export interface Drill {
  id: string
  title: string
  objective: string
  durationMinutes: number
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  category: string
  instructions: string[]
  measurableGoal: string
  progression?: string
  commonMistakes?: string[]
}

export interface TrainingPlan {
  id: string
  playerId: string
  weekStart: string
  mainPriority: string
  secondaryPriorities: string[]
  summary: string
  sessions: {
    day: string
    title: string
    objective: string
    duration: number
    drills: string[]
    completed?: boolean
  }[]
  drills: Drill[]
  successMetrics: string[]
  generatedFrom?: string
  createdAt: string
}

export interface MemoryItem {
  id: string
  playerId: string
  content: string
  category: 'tactical' | 'technical' | 'mental' | 'physical' | 'preference'
  status: 'confirmed' | 'pending' | 'archived' | 'incorrect'
  createdAt: string
  updatedAt: string
}

export const currentPlayer: Player = {
  id: '',
  name: 'Player',
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

export const sessions: Session[] = []
export const clips: Clip[] = []
export const patterns: Pattern[] = []
export const drills: Drill[] = []
export const memoryItems: MemoryItem[] = []

export const trainingPlan: TrainingPlan = {
  id: '',
  playerId: '',
  weekStart: new Date().toISOString().split('T')[0],
  mainPriority: 'No training plan generated yet.',
  secondaryPriorities: [],
  summary: 'Create and review sessions first. Raqet will use your approved profile memories and recent session notes to make training focus more useful.',
  sessions: [],
  drills: [],
  successMetrics: [],
  createdAt: new Date().toISOString(),
}
