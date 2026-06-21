'use client'

import { Suspense, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/PageHeader'
import { LoadingGenerationState } from '@/components/LoadingGenerationState'
import { AIInsightBox } from '@/components/AIInsightBox'
import { analyzeSessionVoice, createOpponent, createScheduledSession, createSession, loadGoogleCalendarConnection, loadOpponents, loadPlayer, loadSessionTrainingBlocks, loadSessions, loadTrainingBlocks, maxAudioUploadBytes, saveSessionTrainingBlocks, updateScheduledSession, updateSession } from '@/lib/api'
import { currentPlayer, type Opponent, type Player, type Session, type SessionTrainingBlockLink, type TrainingBlock } from '@/lib/data'
import type { MatchResult, MatchScore, ScoreSetMode } from '@/lib/match-score'
import { formatMatchScore, legacyScoreToMatchScore, normalizeMatchScore } from '@/lib/match-score'

const sessionTypes = ['training', 'match', 'class', 'tournament', 'fitness']
const surfaces = ['Hard court', 'Clay', 'Grass', 'Carpet']
const clubs = ['Fuencarral', 'Club de Campo Villa de Madrid', 'Ciudad de la Raqueta', 'Riverside Tennis Club']
const matchResults: MatchResult[] = ['unknown', 'won', 'lost', 'unfinished', 'retired']

type SetScore = {
  mode: ScoreSetMode
  playerGames: string
  opponentGames: string
  playerTiebreakPoints: string
  opponentTiebreakPoints: string
}

function defaultSetScores(): SetScore[] {
  return [
    { mode: 'set', playerGames: '', opponentGames: '', playerTiebreakPoints: '', opponentTiebreakPoints: '' },
    { mode: 'set', playerGames: '', opponentGames: '', playerTiebreakPoints: '', opponentTiebreakPoints: '' },
  ]
}

function scoreFromInputs(sets: SetScore[]): MatchScore {
  return normalizeMatchScore({
    sets: sets
      .filter((set) =>
        set.playerGames.trim() !== '' ||
        set.opponentGames.trim() !== '' ||
        set.playerTiebreakPoints.trim() !== '' ||
        set.opponentTiebreakPoints.trim() !== '',
      )
      .map((set) => ({
        mode: set.mode,
        playerGames: set.playerGames ? Number(set.playerGames) : undefined,
        opponentGames: set.opponentGames ? Number(set.opponentGames) : undefined,
        playerTiebreakPoints: set.playerTiebreakPoints ? Number(set.playerTiebreakPoints) : undefined,
        opponentTiebreakPoints: set.opponentTiebreakPoints ? Number(set.opponentTiebreakPoints) : undefined,
      })),
  })
}

function inputsFromScore(scoreData?: MatchScore, legacyScore?: string): SetScore[] {
  const parsed = normalizeMatchScore(scoreData ?? legacyScoreToMatchScore(legacyScore)).sets.map((set) => ({
    mode: set.mode,
    playerGames: set.playerGames?.toString() ?? '',
    opponentGames: set.opponentGames?.toString() ?? '',
    playerTiebreakPoints: set.playerTiebreakPoints?.toString() ?? '',
    opponentTiebreakPoints: set.opponentTiebreakPoints?.toString() ?? '',
  }))

  return parsed.length > 0 ? parsed : defaultSetScores()
}

function updateSetScores(sets: SetScore[], index: number, patch: Partial<SetScore>) {
  return sets.map((set, itemIndex) => {
    if (itemIndex !== index) return set
    const next = { ...set, ...patch }
    if (patch.mode === 'set' || patch.mode === 'match_tiebreak') {
      return { ...next, playerTiebreakPoints: '', opponentTiebreakPoints: '' }
    }
    return next
  })
}

function prettyResult(result: string) {
  return result.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ')
}

function scoreModeLabel(mode: ScoreSetMode) {
  return mode === 'set_tiebreak' ? 'TB' : mode === 'match_tiebreak' ? 'MTB' : 'Set'
}

function ScoreInputs({
  setScores,
  setSetScores,
  playerName,
  opponentName,
}: {
  setScores: SetScore[]
  setSetScores: Dispatch<SetStateAction<SetScore[]>>
  playerName: string
  opponentName: string
}) {
  return (
    <div className="space-y-2">
      {setScores.map((set, index) => (
        <div key={index} className="rounded-lg border border-border bg-surface p-3">
          <div className="mb-2 grid grid-cols-[64px_1fr] items-center gap-2">
            <p className="text-xs font-medium text-muted">Set {index + 1}</p>
            <select
              value={set.mode}
              onChange={(event) => setSetScores((prev) => updateSetScores(prev, index, { mode: event.target.value as ScoreSetMode }))}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            >
              <option value="set">Set</option>
              <option value="set_tiebreak">Set with tiebreak</option>
              <option value="match_tiebreak">Match tiebreak</option>
            </select>
          </div>
          <div className="grid grid-cols-[64px_1fr_1fr] items-center gap-2">
            <p className="text-xs font-medium text-muted">{scoreModeLabel(set.mode)}</p>
            <input
              type="number"
              min="0"
              value={set.playerGames}
              onChange={(event) => setSetScores((prev) => updateSetScores(prev, index, { playerGames: event.target.value }))}
              placeholder={playerName}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <input
              type="number"
              min="0"
              value={set.opponentGames}
              onChange={(event) => setSetScores((prev) => updateSetScores(prev, index, { opponentGames: event.target.value }))}
              placeholder={opponentName || 'Opponent'}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </div>
          {set.mode === 'set_tiebreak' && (
            <div className="mt-2 grid grid-cols-[64px_1fr_1fr] items-center gap-2">
              <p className="text-xs font-medium text-muted">TB pts</p>
              <input
                type="number"
                min="0"
                value={set.playerTiebreakPoints}
                onChange={(event) => setSetScores((prev) => updateSetScores(prev, index, { playerTiebreakPoints: event.target.value }))}
                placeholder={playerName}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <input
                type="number"
                min="0"
                value={set.opponentTiebreakPoints}
                onChange={(event) => setSetScores((prev) => updateSetScores(prev, index, { opponentTiebreakPoints: event.target.value }))}
                placeholder={opponentName || 'Opponent'}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function NewSessionPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('edit')
  const [sessionId] = useState(() => editId || crypto.randomUUID())
  const [sessionPersisted, setSessionPersisted] = useState(Boolean(editId))
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const [loading, setLoading] = useState(false)
  const [voiceLoading, setVoiceLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [recording, setRecording] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [voiceError, setVoiceError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [player, setPlayer] = useState<Player | null>(null)
  const [opponents, setOpponents] = useState<Opponent[]>([])
  const [trainingBlocks, setTrainingBlocks] = useState<TrainingBlock[]>([])
  const [blockLinks, setBlockLinks] = useState<Array<Pick<SessionTrainingBlockLink, 'trainingBlockId' | 'completionStatus' | 'successCriteriaNotes'>>>([])
  const [calendarConnected, setCalendarConnected] = useState(false)
  const [opponentSaving, setOpponentSaving] = useState(false)
  const [newOpponentName, setNewOpponentName] = useState('')
  const [newPartnerName, setNewPartnerName] = useState('')
  const [newOpponentPartnerName, setNewOpponentPartnerName] = useState('')
  const [setScores, setSetScores] = useState<SetScore[]>(defaultSetScores)
  const [voiceDebrief, setVoiceDebrief] = useState<{
    transcript: string
    summary: string
    whatWentWell: string[]
    whatWentWrong: string[]
    mainTakeaway: string
    nextFocus: string
    tags: string[]
    profileMemoryUpdate: string
  } | null>(null)
  const [formData, setFormData] = useState({
    status: searchParams.get('mode') === 'planned' ? 'planned' : 'completed',
    type: 'training',
    title: '',
    date: new Date().toISOString().split('T')[0],
    scheduledStart: '',
    scheduledEnd: '',
    reminderMinutes: '60',
    syncToGoogleCalendar: 'false',
    duration: '',
    surface: 'Hard court',
    location: '',
    matchType: 'singles',
    opponentId: '',
    opponent: '',
    partnerId: '',
    partnerName: '',
    opponentPartnerId: '',
    opponentPartnerName: '',
    opponentStyle: '',
    result: 'unknown',
    intensity: '5',
    energyBefore: '5',
    energyAfter: '5',
    confidence: '5',
    mainFocus: '',
    notes: '',
    tags: '',
    linkToTeam: 'false',
    visibility: 'coaches',
  })

  useEffect(() => {
    loadPlayer()
      .then(setPlayer)
      .catch((loadError) => setSaveError(loadError instanceof Error ? loadError.message : 'Player profile could not load.'))
    loadOpponents()
      .then((loaded) => setOpponents(loaded ?? []))
      .catch((loadError) => setSaveError(loadError instanceof Error ? loadError.message : 'Opponents could not load.'))
    loadTrainingBlocks()
      .then((loaded) => setTrainingBlocks((loaded ?? []).filter((block) => block.status === 'approved')))
      .catch((loadError) => setSaveError(loadError instanceof Error ? loadError.message : 'Training blocks could not load.'))
    loadGoogleCalendarConnection()
      .then((loaded) => setCalendarConnected(Boolean(loaded?.connected)))
      .catch((loadError) => setSaveError(loadError instanceof Error ? loadError.message : 'Google Calendar status could not load.'))
    loadSessionTrainingBlocks(editId || sessionId)
      .then((loaded) => setBlockLinks((loaded ?? []).map((link) => ({
        trainingBlockId: link.trainingBlockId,
        completionStatus: link.completionStatus,
        successCriteriaNotes: link.successCriteriaNotes,
      }))))
      .catch((loadError) => setSaveError(loadError instanceof Error ? loadError.message : 'Session training blocks could not load.'))
    if (!editId) return
    loadSessions().then((loaded) => {
      const session = (loaded ?? []).find((item) => item.id === editId)
      if (!session) {
        setSaveError('Session not found.')
        return
      }
      setFormData({
        status: session.status || 'completed',
        type: session.type,
        title: session.title,
        date: session.date,
        scheduledStart: session.scheduledStartAt ? session.scheduledStartAt.slice(0, 16) : '',
        scheduledEnd: session.scheduledEndAt ? session.scheduledEndAt.slice(0, 16) : '',
        reminderMinutes: String(session.reminderMinutes ?? 60),
        syncToGoogleCalendar: session.calendarEventId ? 'true' : 'false',
        duration: String(session.durationMinutes || ''),
        surface: session.surface || 'Hard court',
        location: session.location || '',
        matchType: session.matchType || 'singles',
        opponentId: session.opponentId || '',
        opponent: session.opponentName || '',
        partnerId: session.partnerId || '',
        partnerName: session.partnerName || '',
        opponentPartnerId: session.opponentPartnerId || '',
        opponentPartnerName: session.opponentPartnerName || '',
        opponentStyle: session.opponentStyle || '',
        result: session.result || 'unknown',
        intensity: String(session.intensity || 5),
        energyBefore: String(session.energyBefore || 5),
        energyAfter: String(session.energyAfter || 5),
        confidence: String(session.confidence || 5),
        mainFocus: session.mainFocus || '',
        notes: session.rawNotes || '',
        tags: session.tags.join(', '),
        linkToTeam: session.teamId ? 'true' : 'false',
        visibility: session.visibility || 'coaches',
      })
      setSetScores(inputsFromScore(session.scoreData, session.score))
      if (session.aiSummary || session.transcript) {
        setVoiceDebrief({
          transcript: session.transcript || '',
          summary: session.aiSummary || '',
          whatWentWell: session.whatWentWell || [],
          whatWentWrong: session.whatWentWrong || [],
          mainTakeaway: session.mainTakeaway || '',
          nextFocus: session.nextFocus || '',
          tags: session.tags || [],
          profileMemoryUpdate: session.profileMemoryUpdate || '',
        })
      }
    }).catch((loadError) => setSaveError(loadError instanceof Error ? loadError.message : 'Session could not load.'))
  }, [editId, sessionId])

  useEffect(() => {
    if (formData.status !== 'planned' || !formData.scheduledStart || !formData.duration) return
    const durationMinutes = Number(formData.duration)
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return
    const start = new Date(formData.scheduledStart)
    if (Number.isNaN(start.getTime())) return
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000)
    const timezoneOffsetMs = end.getTimezoneOffset() * 60 * 1000
    const scheduledEnd = new Date(end.getTime() - timezoneOffsetMs).toISOString().slice(0, 16)
    setFormData((prev) => prev.scheduledEnd === scheduledEnd ? prev : { ...prev, scheduledEnd })
  }, [formData.status, formData.scheduledStart, formData.duration])

  useEffect(() => {
    if (formData.status !== 'planned') return
    const plannedDate = (formData.scheduledStart || formData.scheduledEnd).slice(0, 10)
    if (!plannedDate) return
    setFormData((prev) => prev.date === plannedDate ? prev : { ...prev, date: plannedDate })
  }, [formData.status, formData.scheduledStart, formData.scheduledEnd])

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const selectOpponent = (opponentId: string) => {
    const opponent = opponents.find((item) => item.id === opponentId)
    setFormData((prev) => ({
      ...prev,
      opponentId,
      opponent: opponent?.name ?? '',
      opponentStyle: opponent?.style ?? prev.opponentStyle,
    }))
  }

  const selectPartner = (partnerId: string) => {
    const partner = opponents.find((item) => item.id === partnerId)
    setFormData((prev) => ({
      ...prev,
      partnerId,
      partnerName: partner?.name ?? '',
    }))
  }

  const selectOpponentPartner = (opponentPartnerId: string) => {
    const opponentPartner = opponents.find((item) => item.id === opponentPartnerId)
    setFormData((prev) => ({
      ...prev,
      opponentPartnerId,
      opponentPartnerName: opponentPartner?.name ?? '',
    }))
  }

  const createAndAssignOpponent = async (
    name: string,
    assign: (saved: Opponent) => void,
    style?: string,
  ) => {
    const trimmedName = name.trim()
    if (!trimmedName) return
    setOpponentSaving(true)
    try {
      const saved = await createOpponent({
        name: trimmedName,
        style: style || undefined,
        dominantHand: 'unknown',
      })
      setOpponents((prev) => [...prev, saved].sort((a, b) => a.name.localeCompare(b.name)))
      assign(saved)
    } finally {
      setOpponentSaving(false)
    }
  }

  const saveManualOpponent = async () => {
    const name = formData.opponent.trim()
    if (!name) return
    await createAndAssignOpponent(name, (saved) => {
      setFormData((prev) => ({ ...prev, opponentId: saved.id, opponent: saved.name, opponentStyle: saved.style ?? prev.opponentStyle }))
    }, formData.opponentStyle)
  }

  const saveManualPartner = async () => {
    const name = formData.partnerName.trim()
    if (!name) return
    await createAndAssignOpponent(name, (saved) => {
      setFormData((prev) => ({ ...prev, partnerId: saved.id, partnerName: saved.name }))
    })
  }

  const buildSession = (): Session => {
    const isPlanned = formData.status === 'planned'
    const manualTags = isPlanned ? [] : formData.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
    const isPracticeMatch = formData.type === 'match'
    const scoreData = isPracticeMatch ? scoreFromInputs(setScores) : undefined

    return {
      id: sessionId,
      playerId: currentPlayer.id,
      visibility: 'private',
      status: formData.status as Session['status'],
      date: formData.date,
      scheduledStartAt: formData.status === 'planned' && formData.scheduledStart ? new Date(formData.scheduledStart).toISOString() : undefined,
      scheduledEndAt: formData.status === 'planned' && formData.scheduledEnd ? new Date(formData.scheduledEnd).toISOString() : undefined,
      reminderMinutes: formData.status === 'planned' ? Number(formData.reminderMinutes || 60) : undefined,
      type: formData.type as Session['type'],
      title: formData.title || `${formData.type} session`,
      durationMinutes: parseInt(formData.duration || '0'),
      surface: formData.surface,
      location: formData.location,
      matchType: isPracticeMatch ? formData.matchType as Session['matchType'] : undefined,
      opponentId: isPracticeMatch ? formData.opponentId || undefined : undefined,
      opponentName: formData.opponent || undefined,
      partnerId: isPracticeMatch && formData.matchType === 'doubles' ? formData.partnerId || undefined : undefined,
      partnerName: isPracticeMatch && formData.matchType === 'doubles' ? formData.partnerName || undefined : undefined,
      opponentPartnerId: isPracticeMatch && formData.matchType === 'doubles' ? formData.opponentPartnerId || undefined : undefined,
      opponentPartnerName: isPracticeMatch && formData.matchType === 'doubles' ? formData.opponentPartnerName || undefined : undefined,
      opponentStyle: formData.opponentStyle || undefined,
      result: isPracticeMatch ? formData.result : formData.result !== 'unknown' ? formData.result : undefined,
      score: isPracticeMatch ? formatMatchScore(scoreData) : undefined,
      scoreData,
      intensity: parseInt(formData.intensity),
      energyBefore: parseInt(formData.energyBefore),
      energyAfter: parseInt(formData.energyAfter),
      confidence: parseInt(formData.confidence),
      mainFocus: formData.mainFocus,
      rawNotes: isPlanned ? '' : formData.notes,
      transcript: isPlanned ? undefined : voiceDebrief?.transcript,
      aiSummary: isPlanned ? undefined : voiceDebrief?.summary,
      whatWentWell: isPlanned ? undefined : voiceDebrief?.whatWentWell,
      whatWentWrong: isPlanned ? undefined : voiceDebrief?.whatWentWrong,
      mainTakeaway: isPlanned ? undefined : voiceDebrief?.mainTakeaway,
      nextFocus: isPlanned ? undefined : voiceDebrief?.nextFocus,
      profileMemoryUpdate: isPlanned ? undefined : voiceDebrief?.profileMemoryUpdate,
      tags: [...new Set([...manualTags, ...(voiceDebrief?.tags ?? [])])],
      createdAt: new Date().toISOString(),
    }
  }

  const selectedTrainingBlocks = blockLinks
    .map((link) => ({ link, block: trainingBlocks.find((block) => block.id === link.trainingBlockId) }))
    .filter((item): item is { link: Pick<SessionTrainingBlockLink, 'trainingBlockId' | 'completionStatus' | 'successCriteriaNotes'>; block: TrainingBlock } => Boolean(item.block))

  const toggleBlock = (blockId: string) => {
    setBlockLinks((prev) => prev.some((link) => link.trainingBlockId === blockId)
      ? prev.filter((link) => link.trainingBlockId !== blockId)
      : [...prev, { trainingBlockId: blockId, completionStatus: isPlannedSession ? 'planned' : 'attempted', successCriteriaNotes: '' }])
  }

  const updateBlockLink = (blockId: string, patch: Partial<Pick<SessionTrainingBlockLink, 'completionStatus' | 'successCriteriaNotes'>>) => {
    setBlockLinks((prev) => prev.map((link) => link.trainingBlockId === blockId ? { ...link, ...patch } : link))
  }

  const persistBlockLinks = async () => {
    if (!sessionPersisted && blockLinks.length === 0) return
    await saveSessionTrainingBlocks(sessionId, blockLinks)
  }

  const handleSave = async () => {
    const isPlanned = formData.status === 'planned'
    const syncCalendar = isPlanned && formData.syncToGoogleCalendar === 'true'
    if (isPlanned && !formData.scheduledStart) {
      setSaveError('Add a start time before scheduling this session.')
      return
    }
    if (isPlanned && (!formData.duration || Number(formData.duration) <= 0)) {
      setSaveError('Add a duration before scheduling this session.')
      return
    }

    setSaving(true)
    setSaveError('')
    try {
      let saved: Session | null = null
      if (sessionPersisted) {
        saved = isPlanned ? await updateScheduledSession(buildSession(), syncCalendar) : await updateSession(buildSession())
        if (saved) setSessionPersisted(true)
      } else {
        saved = isPlanned ? await createScheduledSession(buildSession(), syncCalendar) : await createSession(buildSession())
        if (saved) setSessionPersisted(true)
      }
      if (!saved) throw new Error(isPlanned ? 'Session schedule failed.' : 'Session save failed.')
      await persistBlockLinks()
      router.push(isPlanned ? '/schedule' : '/sessions')
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : isPlanned ? 'Session schedule failed.' : 'Session save failed.')
    } finally {
      setSaving(false)
    }
  }

  const saveSessionDraft = async () => {
    if (sessionPersisted) {
      const saved = await updateSession(buildSession())
      if (!saved) throw new Error('Session save failed')
      return saved
    }

    const saved = await createSession(buildSession())
    if (!saved) throw new Error('Session save failed')
    setSessionPersisted(true)
    return saved
  }

  const handleSaveAndAnalyze = async () => {
    if (!voiceDebrief) {
      await handleSave()
      return
    }
    setLoading(true)
    setCurrentStep(0)

    const steps = ['Analyzing session...', 'Detecting patterns...', 'Generating summary...', 'Building recommendations...']

    steps.forEach((_, index) => {
      setTimeout(() => setCurrentStep(index + 1), (index + 1) * 1500)
    })

    setTimeout(() => {
      setLoading(false)
      setGenerated(true)
    }, steps.length * 1500 + 500)
  }

  const handleVoiceAnalyze = async () => {
    if (!audioFile) return

    if (audioFile.size > maxAudioUploadBytes) {
      setVoiceError('Audio file is too large for transcription. Keep recordings under 18 MB.')
      return
    }

    setVoiceLoading(true)
    setVoiceError('')
    const sessionContext = [
      `Type: ${formData.type}`,
      `Date: ${formData.date}`,
      `Surface: ${formData.surface}`,
      `Match format: ${isPracticeMatch ? formData.matchType : 'not applicable'}`,
      `Opponent: ${formData.opponent || 'not provided'}`,
      `Partner: ${formData.matchType === 'doubles' ? formData.partnerName || 'not provided' : 'not applicable'}`,
      `Second opponent: ${formData.matchType === 'doubles' ? formData.opponentPartnerName || 'not provided' : 'not applicable'}`,
      `Result: ${formData.result || 'not provided'}`,
      `Score: ${isPracticeMatch ? formatMatchScore(scoreFromInputs(setScores)) || 'not provided' : 'not applicable'}`,
      `Main focus: ${formData.mainFocus || 'not provided'}`,
      `Written notes: ${formData.notes || 'not provided'}`,
      selectedTrainingBlocks.length > 0 ? `Selected training block context:\n${selectedTrainingBlocks.map(({ block, link }) => [
        `Title: ${block.title}`,
        `Objective: ${block.objective}`,
        `Success criteria: ${block.successCriteria.join('; ') || 'not provided'}`,
        `Completion status: ${link.completionStatus}`,
        `Notes: ${link.successCriteriaNotes || 'not provided'}`,
      ].join('\n')).join('\n\n')}` : 'Selected training block context: none',
    ].join('\n')

    try {
      await saveSessionDraft()
      const debrief = await analyzeSessionVoice(audioFile, sessionContext, sessionId)
      setVoiceDebrief(debrief)
      setFormData((prev) => ({
        ...prev,
        notes: prev.notes ? `${prev.notes}\n\nVoice transcript:\n${debrief.transcript}` : debrief.transcript,
        tags: [...new Set([...prev.tags.split(',').map((tag) => tag.trim()).filter(Boolean), ...debrief.tags])].join(', '),
      }))
    } catch (error) {
      setVoiceError(error instanceof Error ? error.message : 'Voice debrief failed')
    } finally {
      setVoiceLoading(false)
    }
  }

  const playerName = player?.name || currentPlayer.name || 'You'
  const isPracticeMatch = formData.type === 'match'
  const isPlannedSession = formData.status === 'planned'

  const startRecording = async () => {
    setVoiceError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const file = new File([blob], `session-debrief-${Date.now()}.webm`, { type: 'audio/webm' })
        setAudioFile(file)
        if (file.size > maxAudioUploadBytes) {
          setVoiceError('Recording is too large for transcription. Keep voice notes under 18 MB.')
        }
      }

      recorderRef.current = recorder
      recorder.start()
      setRecording(true)
    } catch (error) {
      setVoiceError(error instanceof Error ? error.message : 'Microphone access failed')
    }
  }

  const stopRecording = () => {
    recorderRef.current?.stop()
    setRecording(false)
  }

  const aiResult = generated ? (
    <div className="space-y-4">
      <AIInsightBox type="success" title="Debrief Ready For Review">
        Review the generated transcript and debrief before saving it to your journal.
      </AIInsightBox>

      <div className="readable-panel bg-surface border border-border rounded-card p-5 space-y-4">
        <div>
          <h2 className="font-display text-sm font-bold tracking-label uppercase text-muted mb-2">Summary</h2>
          <p className="text-sm text-foreground leading-relaxed">
            {voiceDebrief?.summary}
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <h2 className="font-display text-sm font-bold tracking-label uppercase text-muted mb-2">What Went Well</h2>
            <ul className="space-y-1.5">
              {(voiceDebrief?.whatWentWell ?? []).map((item) => (
                <li key={item} className="text-sm text-foreground flex items-start gap-2">
                  <span className="text-success mt-1">✓</span> {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="font-display text-sm font-bold tracking-label uppercase text-muted mb-2">What Went Wrong</h2>
            <ul className="space-y-1.5">
              {(voiceDebrief?.whatWentWrong ?? []).map((item) => (
                <li key={item} className="text-sm text-foreground flex items-start gap-2">
                  <span className="text-danger mt-1">×</span> {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div>
          <h2 className="font-display text-sm font-bold tracking-label uppercase text-muted mb-2">Memory Suggestion</h2>
          <p className="text-sm text-foreground leading-relaxed">
            {voiceDebrief?.profileMemoryUpdate || 'No durable player memory suggested for this debrief.'}
          </p>
        </div>

        <div>
          <h2 className="font-display text-sm font-bold tracking-label uppercase text-muted mb-2">Next Priority</h2>
          <p className="text-sm text-foreground leading-relaxed">
            {voiceDebrief?.nextFocus}
          </p>
        </div>

      </div>

      <div className="readable-panel flex gap-3">
        <button
          onClick={handleSave}
          className="flex-1 px-4 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
        >
          Save to Journal
        </button>
        <button
          onClick={() => setGenerated(false)}
          className="px-4 py-2.5 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-background transition-colors"
        >
          Edit Session
        </button>
      </div>
    </div>
  ) : null

  return (
    <AppShell title={editId ? 'Edit Session' : 'New Session'} subtitle={editId ? 'Update this session' : 'Log a training session or match'}>
      <PageHeader title={editId ? 'Edit Session' : 'New Session'} backHref="/sessions" />

      {loading ? (
        <LoadingGenerationState
          title="Preparing Debrief Review"
          steps={['Analyzing session...', 'Detecting patterns...', 'Generating summary...', 'Building recommendations...']}
          currentStep={currentStep}
        />
      ) : generated ? (
        aiResult
      ) : (
        <div className="bg-surface border border-border rounded-card shadow-card p-6 max-w-3xl">
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium tracking-label uppercase text-muted mb-1.5">Status</label>
              <select
                value={formData.status}
                onChange={(e) => handleChange('status', e.target.value)}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-accent"
              >
                <option value="completed">Completed log</option>
                <option value="planned">Planned session</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium tracking-label uppercase text-muted mb-1.5">Session Type *</label>
              <select
                value={formData.type}
                onChange={(e) => handleChange('type', e.target.value)}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-accent"
              >
                {sessionTypes.map((t) => (
                  <option key={t} value={t}>{t === 'match' ? 'Practice match' : t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium tracking-label uppercase text-muted mb-1.5">Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => handleChange('title', e.target.value)}
                placeholder="e.g. Practice Match vs. Marcus"
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-accent"
              />
            </div>
            {formData.status === 'planned' && (
              <>
                <div>
                  <label className="block text-xs font-medium tracking-label uppercase text-muted mb-1.5">Start Time</label>
                  <input
                    type="datetime-local"
                    value={formData.scheduledStart}
                    onChange={(e) => {
                      handleChange('scheduledStart', e.target.value)
                      if (e.target.value) handleChange('date', e.target.value.slice(0, 10))
                    }}
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium tracking-label uppercase text-muted mb-1.5">End Time</label>
                  <input
                    type="datetime-local"
                    value={formData.scheduledEnd}
                    onChange={(e) => handleChange('scheduledEnd', e.target.value)}
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium tracking-label uppercase text-muted mb-1.5">Reminder</label>
                  <select
                    value={formData.reminderMinutes}
                    onChange={(e) => handleChange('reminderMinutes', e.target.value)}
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-accent"
                  >
                    <option value="30">30 minutes before</option>
                    <option value="60">1 hour before</option>
                    <option value="1440">1 day before</option>
                  </select>
                </div>
                <div className="rounded-lg border border-border bg-background p-3">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={formData.syncToGoogleCalendar === 'true'}
                      onChange={(event) => handleChange('syncToGoogleCalendar', event.target.checked ? 'true' : 'false')}
                      disabled={!calendarConnected}
                      className="mt-1"
                    />
                    <span>
                      <span className="block text-xs font-medium uppercase tracking-label text-muted">Google Calendar</span>
                      <span className="mt-1 block text-sm text-foreground">{calendarConnected ? 'Add or update calendar event' : 'Connect Calendar in Settings first'}</span>
                    </span>
                  </label>
                </div>
              </>
            )}
            <div>
              <label className="block text-xs font-medium tracking-label uppercase text-muted mb-1.5">Date *</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => handleChange('date', e.target.value)}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium tracking-label uppercase text-muted mb-1.5">Duration (min) *</label>
              <input
                type="number"
                value={formData.duration}
                onChange={(e) => handleChange('duration', e.target.value)}
                placeholder="60"
                min="1"
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium tracking-label uppercase text-muted mb-1.5">Surface</label>
              <select
                value={formData.surface}
                onChange={(e) => handleChange('surface', e.target.value)}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-accent"
              >
                {surfaces.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium tracking-label uppercase text-muted mb-1.5">Club</label>
              <select
                value={formData.location}
                onChange={(e) => handleChange('location', e.target.value)}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-accent"
              >
                <option value="">Select club</option>
                {clubs.map((club) => (
                  <option key={club} value={club}>{club}</option>
                ))}
              </select>
            </div>
            {isPracticeMatch && (
              <div>
                <label className="block text-xs font-medium tracking-label uppercase text-muted mb-1.5">Match Format</label>
                <select
                  value={formData.matchType}
                  onChange={(event) => handleChange('matchType', event.target.value)}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-accent"
                >
                  <option value="singles">Singles</option>
                  <option value="doubles">Doubles</option>
                </select>
              </div>
            )}
            {isPracticeMatch && (
              <div>
                <label className="block text-xs font-medium tracking-label uppercase text-muted mb-1.5">Opponent</label>
                <select
                  value={formData.opponentId}
                  onChange={(event) => selectOpponent(event.target.value)}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-accent"
                >
                  <option value="">{isPlannedSession ? 'Select saved opponent' : 'Manual / unsaved'}</option>
                  {opponents.map((opponent) => (
                    <option key={opponent.id} value={opponent.id}>{opponent.name}</option>
                  ))}
                </select>
                {isPlannedSession && opponents.length === 0 && (
                  <p className="mt-2 text-xs text-muted">Create one below to keep stats tied to this player.</p>
                )}
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={newOpponentName}
                    onChange={(event) => setNewOpponentName(event.target.value)}
                    placeholder="New opponent"
                    className="min-w-0 flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-accent"
                  />
                  <button
                    type="button"
                    onClick={() => createAndAssignOpponent(newOpponentName, (saved) => {
                      setFormData((prev) => ({ ...prev, opponentId: saved.id, opponent: saved.name, opponentStyle: saved.style ?? prev.opponentStyle }))
                      setNewOpponentName('')
                    })}
                    disabled={opponentSaving || !newOpponentName.trim()}
                    className="shrink-0 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-background disabled:opacity-50"
                  >
                    Create
                  </button>
                </div>
              </div>
            )}
            {!isPlannedSession && (
              <div>
                <label className="block text-xs font-medium tracking-label uppercase text-muted mb-1.5">Opponent Name</label>
                <input
                  type="text"
                  value={formData.opponent}
                  onChange={(e) => setFormData((prev) => ({ ...prev, opponent: e.target.value, opponentId: '' }))}
                  placeholder="Opponent name"
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-accent"
                />
                {isPracticeMatch && formData.opponent && !formData.opponentId && (
                  <button
                    type="button"
                    onClick={saveManualOpponent}
                    disabled={opponentSaving}
                    className="mt-2 text-xs font-medium text-accent disabled:opacity-60"
                  >
                    {opponentSaving ? 'Saving opponent...' : 'Save as opponent'}
                  </button>
                )}
              </div>
            )}
            {isPracticeMatch && formData.matchType === 'doubles' && (
              <>
                <div>
                  <label className="block text-xs font-medium tracking-label uppercase text-muted mb-1.5">Saved Partner</label>
                  <select
                    value={formData.partnerId}
                    onChange={(event) => selectPartner(event.target.value)}
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-accent"
                  >
                    <option value="">{isPlannedSession ? 'Select saved partner' : 'Manual / unsaved'}</option>
                    {opponents.map((opponent) => (
                      <option key={opponent.id} value={opponent.id}>{opponent.name}</option>
                    ))}
                  </select>
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      value={newPartnerName}
                      onChange={(event) => setNewPartnerName(event.target.value)}
                      placeholder="New partner"
                      className="min-w-0 flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-accent"
                    />
                    <button
                      type="button"
                      onClick={() => createAndAssignOpponent(newPartnerName, (saved) => {
                        setFormData((prev) => ({ ...prev, partnerId: saved.id, partnerName: saved.name }))
                        setNewPartnerName('')
                      })}
                      disabled={opponentSaving || !newPartnerName.trim()}
                      className="shrink-0 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-background disabled:opacity-50"
                    >
                      Create
                    </button>
                  </div>
                </div>
                {!isPlannedSession && (
                <div>
                  <label className="block text-xs font-medium tracking-label uppercase text-muted mb-1.5">Your Partner</label>
                  <input
                    type="text"
                    value={formData.partnerName}
                    onChange={(e) => setFormData((prev) => ({ ...prev, partnerName: e.target.value, partnerId: '' }))}
                    placeholder="Partner name"
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-accent"
                  />
                  {formData.partnerName && !formData.partnerId && (
                    <button
                      type="button"
                      onClick={saveManualPartner}
                      disabled={opponentSaving}
                      className="mt-2 text-xs font-medium text-accent disabled:opacity-60"
                    >
                      {opponentSaving ? 'Saving partner...' : 'Save as partner'}
                    </button>
                  )}
                </div>
                )}
                <div>
                  <label className="block text-xs font-medium tracking-label uppercase text-muted mb-1.5">Opponent Partner</label>
                  <select
                    value={formData.opponentPartnerId}
                    onChange={(event) => selectOpponentPartner(event.target.value)}
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-accent"
                  >
                    <option value="">Select saved opponent partner</option>
                    {opponents.map((opponent) => (
                      <option key={opponent.id} value={opponent.id}>{opponent.name}</option>
                    ))}
                  </select>
                  <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      value={newOpponentPartnerName}
                      onChange={(event) => setNewOpponentPartnerName(event.target.value)}
                      placeholder="New opponent partner"
                      className="min-w-0 flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-accent"
                    />
                    <button
                      type="button"
                      onClick={() => createAndAssignOpponent(newOpponentPartnerName, (saved) => {
                        setFormData((prev) => ({ ...prev, opponentPartnerId: saved.id, opponentPartnerName: saved.name }))
                        setNewOpponentPartnerName('')
                      })}
                      disabled={opponentSaving || !newOpponentPartnerName.trim()}
                      className="shrink-0 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-background disabled:opacity-50"
                    >
                      Create
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {isPracticeMatch && !isPlannedSession && (
            <div className="mb-4 rounded-lg border border-border bg-background p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <label className="block text-xs font-medium tracking-label uppercase text-muted">Practice Match Score</label>
                  <p className="mt-1 text-xs text-muted">Add the score set by set. Your name appears above the opponent in match views.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSetScores((prev) => [...prev, { mode: 'set', playerGames: '', opponentGames: '', playerTiebreakPoints: '', opponentTiebreakPoints: '' }])}
                  className="text-xs font-medium text-accent"
                >
                  Add set
                </button>
              </div>
              <div className="mb-3">
                <label className="block text-xs font-medium tracking-label uppercase text-muted mb-1.5">Result</label>
                <select
                  value={formData.result}
                  onChange={(event) => handleChange('result', event.target.value)}
                  className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-sm outline-none focus:border-accent"
                >
                  {matchResults.map((result) => (
                    <option key={result} value={result}>{prettyResult(result)}</option>
                  ))}
                </select>
              </div>
              <ScoreInputs setScores={setScores} setSetScores={setSetScores} playerName={playerName} opponentName={formData.opponent} />
            </div>
          )}

          <div className={`grid gap-4 mb-4 ${isPlannedSession ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
            {!isPlannedSession && (
              <div>
                <label className="block text-xs font-medium tracking-label uppercase text-muted mb-1.5">Intensity (1-10)</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={formData.intensity}
                  onChange={(e) => handleChange('intensity', e.target.value)}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-accent"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-medium tracking-label uppercase text-muted mb-1.5">Energy Before (1-10)</label>
              <input
                type="number"
                min="1"
                max="10"
                value={formData.energyBefore}
                onChange={(e) => handleChange('energyBefore', e.target.value)}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-accent"
              />
            </div>
            {!isPlannedSession && (
              <div>
                <label className="block text-xs font-medium tracking-label uppercase text-muted mb-1.5">Energy After (1-10)</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={formData.energyAfter}
                  onChange={(e) => handleChange('energyAfter', e.target.value)}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-accent"
                />
              </div>
            )}
          </div>

          {!isPlannedSession && (
          <div className="mb-4">
            <label className="block text-xs font-medium tracking-label uppercase text-muted mb-1.5">Confidence (1-10)</label>
            <input
              type="number"
              min="1"
              max="10"
              value={formData.confidence}
              onChange={(e) => handleChange('confidence', e.target.value)}
              className="w-full sm:w-1/3 px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-accent"
            />
          </div>
          )}

          <div className="mb-4">
            <label className="block text-xs font-medium tracking-label uppercase text-muted mb-1.5">Main Focus</label>
            <input
              type="text"
              value={formData.mainFocus}
              onChange={(e) => handleChange('mainFocus', e.target.value)}
              placeholder="e.g. Return depth and rally patience"
              className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-accent"
            />
          </div>

          <div className="mb-4 rounded-lg border border-border bg-background p-4">
            <div className="mb-3">
              <label className="block text-xs font-medium tracking-label uppercase text-muted">
                {isPlannedSession ? 'Planned focus blocks' : 'Training blocks worked on'}
              </label>
              <p className="mt-1 text-xs leading-5 text-muted">
                {isPlannedSession
                  ? 'Optional. Pick the blocks you intend to work on. Mark what happened after the session.'
                  : 'Optional. Select the blocks you worked on and record whether you completed them.'}
              </p>
            </div>
            {trainingBlocks.length === 0 ? (
              <p className="text-sm text-muted">No approved training blocks yet.</p>
            ) : (
              <div className="space-y-3">
                {trainingBlocks.map((block) => {
                  const link = blockLinks.find((item) => item.trainingBlockId === block.id)
                  return (
                    <div key={block.id} className="rounded-lg border border-border bg-surface p-3">
                      <label className="flex items-start gap-3">
                        <input type="checkbox" checked={Boolean(link)} onChange={() => toggleBlock(block.id)} className="mt-1 h-4 w-4 rounded border-border text-accent" />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-foreground">{block.title}</span>
                          <span className="mt-1 block text-xs leading-5 text-muted">{block.objective}</span>
                        </span>
                      </label>
                      {link && !isPlannedSession && (
                        <div className="mt-3 grid gap-3 sm:grid-cols-[180px_1fr]">
                          <select value={link.completionStatus} onChange={(event) => updateBlockLink(block.id, { completionStatus: event.target.value as SessionTrainingBlockLink['completionStatus'] })} className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent">
                            {['planned', 'attempted', 'completed', 'missed'].map((status) => <option key={status} value={status}>{status}</option>)}
                          </select>
                          <input value={link.successCriteriaNotes} onChange={(event) => updateBlockLink(block.id, { successCriteriaNotes: event.target.value })} placeholder="Success criteria notes" className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent" />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="mb-4">
            <label className="block text-xs font-medium tracking-label uppercase text-muted mb-1.5">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="What happened? How did you feel? What did you work on?"
              rows={4}
              className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-accent resize-y"
            />
          </div>

          {!isPlannedSession && (
          <div className="mb-4 border border-border rounded-lg p-4 bg-background">
            <label className="block text-xs font-medium tracking-label uppercase text-muted mb-1.5">Voice Debrief</label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="file"
                accept="audio/*"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null
                  setAudioFile(file)
                  setVoiceError(file && file.size > maxAudioUploadBytes ? 'Audio file is too large for transcription. Keep recordings under 18 MB.' : '')
                }}
                className="flex-1 text-sm text-muted file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border file:border-border file:bg-surface file:text-foreground file:text-sm"
              />
              <button
                type="button"
                onClick={handleVoiceAnalyze}
                disabled={!audioFile || voiceLoading}
                className="px-4 py-2.5 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-surface transition-colors disabled:opacity-50"
              >
                {voiceLoading ? 'Analyzing...' : 'Analyze Voice Note'}
              </button>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 mt-3">
              <button
                type="button"
                onClick={recording ? stopRecording : startRecording}
                disabled={voiceLoading}
                className="px-4 py-2.5 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-surface transition-colors disabled:opacity-50"
              >
                {recording ? 'Stop Recording' : 'Record Voice Note'}
              </button>
            {audioFile && (
              <p className="text-xs text-muted self-center">
                Selected audio: {audioFile.name}
              </p>
            )}
            </div>
            {voiceDebrief && (
              <p className="text-xs text-muted mt-2">
                Voice debrief ready. It will be saved with the session.
              </p>
            )}
            {voiceLoading && (
              <p className="text-xs text-muted mt-2">
                Session draft saved. You can move around the app while analysis finishes; the debrief will be attached to this session if it completes.
              </p>
            )}
            {voiceError && <p className="text-xs text-danger mt-2">{voiceError}</p>}
          </div>
          )}

          <div className="mb-6">
            <label className="block text-xs font-medium tracking-label uppercase text-muted mb-1.5">Tags (comma separated)</label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => handleChange('tags', e.target.value)}
              placeholder="match, forehand, mental-resilience"
              className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-accent"
            />
          </div>

          {saveError && (
            <p className="mb-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              {saveError}
            </p>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={handleSaveAndAnalyze}
              disabled={saving || voiceLoading}
              className="flex-1 px-4 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-60"
            >
              {saving ? isPlannedSession ? 'Scheduling...' : 'Saving...' : isPlannedSession ? 'Schedule Session' : voiceDebrief ? 'Review & Save Debrief' : editId ? 'Save Changes' : 'Save Session'}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || voiceLoading}
              className="px-4 py-2.5 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-background transition-colors disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Draft'}
            </button>
          </div>
        </div>
      )}
    </AppShell>
  )
}

export default function NewSessionPage() {
  return (
    <Suspense fallback={null}>
      <NewSessionPageContent />
    </Suspense>
  )
}
