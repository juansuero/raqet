export type MatchResult = 'won' | 'lost' | 'unfinished' | 'walkover' | 'retired' | 'unknown'

export type ScoreSetMode = 'set' | 'set_tiebreak' | 'match_tiebreak'

export interface MatchScoreSet {
  mode: ScoreSetMode
  playerGames?: number
  opponentGames?: number
  playerTiebreakPoints?: number
  opponentTiebreakPoints?: number
}

export interface MatchScore {
  sets: MatchScoreSet[]
}

export const emptyMatchScore: MatchScore = { sets: [] }

function numeric(value: unknown) {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : undefined
}

function scoreSetMode(value: unknown): ScoreSetMode {
  return value === 'set_tiebreak' || value === 'match_tiebreak' ? value : 'set'
}

export function normalizeMatchScore(score?: Partial<MatchScore> | null): MatchScore {
  return {
    sets: Array.isArray(score?.sets)
      ? score.sets
          .map((set) => ({
            mode: scoreSetMode(set.mode),
            playerGames: numeric(set.playerGames),
            opponentGames: numeric(set.opponentGames),
            playerTiebreakPoints: numeric(set.playerTiebreakPoints),
            opponentTiebreakPoints: numeric(set.opponentTiebreakPoints),
          }))
          .filter((set) =>
            set.playerGames !== undefined ||
            set.opponentGames !== undefined ||
            set.playerTiebreakPoints !== undefined ||
            set.opponentTiebreakPoints !== undefined,
          )
      : [],
  }
}

export function legacyScoreToMatchScore(score?: string): MatchScore {
  const sets = (score ?? '')
    .split(',')
    .map((set) => set.trim())
    .filter(Boolean)
    .map<MatchScoreSet | null>((set) => {
      const tiebreak = set.match(/^(\d+)-(\d+)\s*\((\d+)-(\d+)\)$/)
      if (tiebreak) {
        return {
          mode: 'set_tiebreak',
          playerGames: Number(tiebreak[1]),
          opponentGames: Number(tiebreak[2]),
          playerTiebreakPoints: Number(tiebreak[3]),
          opponentTiebreakPoints: Number(tiebreak[4]),
        }
      }

      const normal = set.match(/^(\d+)-(\d+)$/)
      if (!normal) return null
      const playerGames = Number(normal[1])
      const opponentGames = Number(normal[2])
      return {
        mode: playerGames >= 10 || opponentGames >= 10 ? 'match_tiebreak' : 'set',
        playerGames,
        opponentGames,
      }
    })
    .filter((set): set is MatchScoreSet => Boolean(set))

  return { sets }
}

export function scoreCell(set: MatchScoreSet, side: 'player' | 'opponent') {
  const games = side === 'player' ? set.playerGames : set.opponentGames
  const tiebreakPoints = side === 'player' ? set.playerTiebreakPoints : set.opponentTiebreakPoints

  if (games === undefined) return '-'
  if (set.mode === 'set_tiebreak' && tiebreakPoints !== undefined) return `${games} (${tiebreakPoints})`
  return String(games)
}

export function formatSetScore(set: MatchScoreSet) {
  const player = set.playerGames ?? 0
  const opponent = set.opponentGames ?? 0

  if (set.mode === 'set_tiebreak') {
    const playerTb = set.playerTiebreakPoints ?? 0
    const opponentTb = set.opponentTiebreakPoints ?? 0
    return `${player}-${opponent} (${playerTb}-${opponentTb})`
  }

  return `${player}-${opponent}`
}

export function formatMatchScore(score?: MatchScore | null) {
  return normalizeMatchScore(score).sets.map(formatSetScore).join(', ')
}

export function scoreLabel(score?: MatchScore | null, fallback = 'score not set') {
  return formatMatchScore(score) || fallback
}
