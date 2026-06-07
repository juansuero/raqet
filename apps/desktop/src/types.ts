export type PointResult = 'won' | 'lost' | 'unknown'

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
  | 'winner'
  | 'forced_error'
  | 'unforced_error'
  | 'double_fault'
  | 'net_error'
  | 'long_error'
  | 'wide_error'
  | 'other'

export type ShotContext =
  | 'serve'
  | 'return'
  | 'rally'
  | 'net'
  | 'passing_shot'
  | 'approach'
  | 'defense'
  | 'attack'

export interface Session {
  id: string
  title: string
  notes: string
  createdAt: string
}

export interface LocalVideo {
  id: string
  sessionId?: string
  filePath: string
  previewFilePath?: string
  fileName: string
  durationMs?: number
  importedAt: string
}

export interface ClipEvent {
  id: string
  timestampMs: number
  action: string
  note: string
}

export interface Clip {
  id: string
  sessionId?: string
  localVideoId: string
  startMs: number
  endMs: number
  title: string
  exportedClipPath?: string
  pointResult: PointResult
  pointEnding: PointEnding
  shotContext: ShotContext
  notes: string
  tags: string[]
  events: ClipEvent[]
  createdAt: string
}

export interface CandidateClip {
  id: string
  sessionId?: string
  localVideoId: string
  startMs: number
  endMs: number
  status: 'pending' | 'accepted' | 'rejected'
  source?: string
  confidence?: number
  createdAt: string
}

export type DetectionMode = 'auto' | 'activity' | 'scene' | 'audio' | 'pyscenedetect'

export interface DetectorBenchmark {
  mode: DetectionMode
  label: string
  available: boolean
  candidateCount: number
  elapsedMs: number
  error?: string
}

export interface LibraryState {
  sessions: Session[]
  videos: LocalVideo[]
  clips: Clip[]
  candidateClips: CandidateClip[]
}
