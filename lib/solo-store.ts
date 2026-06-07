import { mkdirSync } from 'fs'
import path from 'path'
import type { CoachMessage, InAppNotification, MemoryItem, Opponent, Player, Project, RatingHistoryEntry, Session, Tournament, TournamentMatch } from '@/lib/data'
import { emptyPlayer } from '@/lib/player-defaults'

import { DatabaseSync } from 'node:sqlite'

export const soloUser = {
  id: 'solo',
  email: process.env.RAQET_SOLO_EMAIL || 'player@localhost',
  created_at: '2026-01-01T00:00:00.000Z',
  user_metadata: { full_name: process.env.RAQET_SOLO_NAME || 'Player' },
}

const dbPath = process.env.RAQET_DB_PATH || path.join(process.cwd(), 'data', 'raqet.sqlite')

let db: DatabaseSync | null = null

function now() {
  return new Date().toISOString()
}

function database() {
  if (db) return db
  mkdirSync(path.dirname(dbPath), { recursive: true })
  db = new DatabaseSync(dbPath)
  db.exec(`
    create table if not exists records (
      type text not null,
      id text not null,
      data text not null,
      created_at text not null,
      updated_at text not null,
      primary key (type, id)
    );
  `)
  return db
}

function parse<T>(row: { data: string } | undefined): T | null {
  return row ? JSON.parse(row.data) as T : null
}

function all<T>(type: string): T[] {
  const rows = database().prepare('select data from records where type = ?').all(type) as { data: string }[]
  return rows.map((row) => JSON.parse(row.data) as T)
}

function get<T>(type: string, id: string): T | null {
  const row = database().prepare('select data from records where type = ? and id = ?').get(type, id) as { data: string } | undefined
  return parse<T>(row)
}

function save<T extends { id: string; createdAt?: string }>(type: string, item: T): T {
  const createdAt = item.createdAt || now()
  const next = { ...item, id: item.id || crypto.randomUUID(), createdAt }
  const timestamp = now()
  database()
    .prepare('insert or replace into records (type, id, data, created_at, updated_at) values (?, ?, ?, coalesce((select created_at from records where type = ? and id = ?), ?), ?)')
    .run(type, next.id, JSON.stringify(next), type, next.id, createdAt, timestamp)
  return next
}

function remove(type: string, id: string) {
  database().prepare('delete from records where type = ? and id = ?').run(type, id)
}

export function initSoloDatabase() {
  database()
  return { path: dbPath }
}

export function loadSoloPlayer(): Player {
  return get<Player>('player', soloUser.id) ?? emptyPlayer(soloUser)
}

export function saveSoloPlayer(player: Player): Player {
  return save('player', {
    ...player,
    id: soloUser.id,
    userId: soloUser.id,
    email: soloUser.email,
    name: player.name || soloUser.user_metadata.full_name,
  })
}

export function listSoloSessions() {
  return all<Session>('session').sort((a, b) => b.date.localeCompare(a.date))
}

export function getSoloSession(id: string) {
  return get<Session>('session', id)
}

export function saveSoloSession(session: Session) {
  return save('session', { ...session, id: session.id || crypto.randomUUID(), playerId: session.playerId || soloUser.id })
}

export function deleteSoloSession(id: string) {
  remove('session', id)
}

export function listSoloOpponents() {
  return all<Opponent>('opponent').sort((a, b) => a.name.localeCompare(b.name))
}

export function saveSoloOpponent(opponent: Opponent) {
  return save('opponent', { ...opponent, id: opponent.id || crypto.randomUUID(), playerId: soloUser.id })
}

export function deleteSoloOpponent(id: string) {
  remove('opponent', id)
}

export function listSoloTournaments() {
  return all<Tournament>('tournament').sort((a, b) => b.startDate.localeCompare(a.startDate))
}

export function getSoloTournament(id: string) {
  return get<Tournament>('tournament', id)
}

export function saveSoloTournament(tournament: Tournament) {
  return save('tournament', { ...tournament, id: tournament.id || crypto.randomUUID(), playerId: soloUser.id })
}

export function deleteSoloTournament(id: string) {
  remove('tournament', id)
  listSoloTournamentMatches().filter((match) => match.tournamentId === id).forEach((match) => remove('tournament_match', match.id))
}

export function listSoloTournamentMatches() {
  return all<TournamentMatch>('tournament_match').sort((a, b) => b.date.localeCompare(a.date))
}

export function saveSoloTournamentMatch(match: TournamentMatch) {
  return save('tournament_match', { ...match, id: match.id || crypto.randomUUID(), playerId: soloUser.id })
}

export function deleteSoloTournamentMatch(id: string) {
  remove('tournament_match', id)
}

export function listSoloMemories() {
  return all<MemoryItem>('memory').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function saveSoloMemory(memory: Omit<MemoryItem, 'id' | 'createdAt' | 'updatedAt'> & Partial<MemoryItem>) {
  const timestamp = now()
  return save('memory', {
    ...memory,
    id: memory.id || crypto.randomUUID(),
    playerId: memory.playerId || soloUser.id,
    createdAt: memory.createdAt || timestamp,
    updatedAt: timestamp,
  } as MemoryItem)
}

export function updateSoloMemoryStatus(id: string, status: MemoryItem['status']) {
  const memory = get<MemoryItem>('memory', id)
  if (!memory) return null
  return saveSoloMemory({ ...memory, status })
}

export function listSoloCoachMessages() {
  return all<CoachMessage>('coach_message').sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(-40)
}

export function saveSoloCoachMessage(message: Omit<CoachMessage, 'id' | 'createdAt'> & Partial<CoachMessage>) {
  return save('coach_message', {
    id: message.id || crypto.randomUUID(),
    role: message.role,
    content: message.content,
    createdAt: message.createdAt || now(),
  } as CoachMessage)
}

export function deleteSoloCoachPair(messageId: string) {
  const messages = listSoloCoachMessages()
  const targetIndex = messages.findIndex((message) => message.id === messageId)
  if (targetIndex < 0) return []
  const ids = [messages[targetIndex].id]
  if (messages[targetIndex].role === 'user' && messages[targetIndex + 1]?.role === 'assistant') ids.push(messages[targetIndex + 1].id)
  ids.forEach((id) => remove('coach_message', id))
  return ids
}

export function listSoloRatingHistory() {
  return all<RatingHistoryEntry>('rating').sort((a, b) => a.eventDate.localeCompare(b.eventDate) || a.createdAt.localeCompare(b.createdAt))
}

export function saveSoloRating(entry: Omit<RatingHistoryEntry, 'id' | 'createdAt'> & Partial<RatingHistoryEntry>) {
  return save('rating', {
    ...entry,
    id: entry.id || crypto.randomUUID(),
    playerId: entry.playerId || soloUser.id,
    createdAt: entry.createdAt || now(),
  } as RatingHistoryEntry)
}

export function listSoloNotifications() {
  return all<InAppNotification>('notification').sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 20)
}

export function markSoloNotificationsRead(id?: string) {
  listSoloNotifications()
    .filter((item) => !id || item.id === id)
    .forEach((item) => save('notification', { ...item, readAt: now() }))
}

export function listSoloProjects() {
  return all<Project>('project').sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function getSoloProject(id: string) {
  return get<Project>('project', id)
}

export function saveSoloProject(project: Project) {
  return save('project', { ...project, id: project.id || crypto.randomUUID() })
}

export function deleteSoloProject(id: string) {
  remove('project', id)
}

export function soloExport() {
  return {
    exportedAt: now(),
    user: { id: soloUser.id, email: soloUser.email },
    profile: loadSoloPlayer(),
    sessions: listSoloSessions(),
    opponents: listSoloOpponents(),
    tournaments: listSoloTournaments(),
    tournamentMatches: listSoloTournamentMatches(),
    memories: listSoloMemories(),
    coachMessages: listSoloCoachMessages(),
    ratingHistory: listSoloRatingHistory(),
    projects: listSoloProjects(),
  }
}
