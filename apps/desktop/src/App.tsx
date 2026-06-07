import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { convertFileSrc, invoke } from '@tauri-apps/api/core'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import type { CandidateClip, Clip, ClipEvent, DetectionMode, DetectorBenchmark, LibraryState, LocalVideo, PointEnding, PointResult, Session, ShotContext } from './types'
import raqetLogo from './assets/raqet-logo-imagegen.png'

type AppView = 'clipper' | 'library' | 'stats' | 'sessions'

const pointEndings: PointEnding[] = [
  'forehand_winner',
  'backhand_winner',
  'volley_winner',
  'smash_winner',
  'opponent_winner',
  'opponent_error',
  'forced_long_error',
  'forced_net_error',
  'forced_wide_error',
  'unforced_long_error',
  'unforced_net_error',
  'unforced_wide_error',
  'ace',
  'double_fault_wide',
  'double_fault_net',
  'double_fault_long',
  'missed_return',
  'other',
]

const detectionModes: Array<{ value: DetectionMode; label: string; description: string }> = [
  { value: 'auto', label: 'Auto', description: 'Best first pass for raw tennis footage.' },
  { value: 'activity', label: 'Activity', description: 'Motion plus audio, useful for one fixed camera.' },
  { value: 'scene', label: 'Scene cuts', description: 'Best for highlight reels with visible edits.' },
  { value: 'audio', label: 'Audio pauses', description: 'Uses quiet gaps between points.' },
  { value: 'pyscenedetect', label: 'PySceneDetect', description: 'Optional external scene detector if installed.' },
]

const pointPresets: Array<{
  label: string
  result: PointResult
  ending: PointEnding
  context?: ShotContext
  tags: string[]
}> = [
  { label: 'Forehand winner', result: 'won', ending: 'forehand_winner', context: 'attack', tags: ['winner', 'forehand'] },
  { label: 'Backhand winner', result: 'won', ending: 'backhand_winner', context: 'attack', tags: ['winner', 'backhand'] },
  { label: 'Volley winner', result: 'won', ending: 'volley_winner', context: 'net', tags: ['winner', 'volley'] },
  { label: 'Smash winner', result: 'won', ending: 'smash_winner', context: 'net', tags: ['winner', 'smash'] },
  { label: 'Opponent winner', result: 'lost', ending: 'opponent_winner', tags: ['opponent winner'] },
  { label: 'Opponent error', result: 'won', ending: 'opponent_error', tags: ['opponent error'] },
  { label: 'Unforced long', result: 'lost', ending: 'unforced_long_error', tags: ['unforced error', 'long'] },
  { label: 'Unforced net', result: 'lost', ending: 'unforced_net_error', tags: ['unforced error', 'net'] },
  { label: 'Unforced wide', result: 'lost', ending: 'unforced_wide_error', tags: ['unforced error', 'wide'] },
  { label: 'Forced long', result: 'lost', ending: 'forced_long_error', tags: ['forced error', 'long'] },
  { label: 'Forced net', result: 'lost', ending: 'forced_net_error', tags: ['forced error', 'net'] },
  { label: 'Forced wide', result: 'lost', ending: 'forced_wide_error', tags: ['forced error', 'wide'] },
  { label: 'Ace', result: 'won', ending: 'ace', context: 'serve', tags: ['serve', 'ace'] },
  { label: 'Double fault wide', result: 'lost', ending: 'double_fault_wide', context: 'serve', tags: ['serve', 'double fault', 'wide'] },
  { label: 'Double fault net', result: 'lost', ending: 'double_fault_net', context: 'serve', tags: ['serve', 'double fault', 'net'] },
  { label: 'Double fault long', result: 'lost', ending: 'double_fault_long', context: 'serve', tags: ['serve', 'double fault', 'long'] },
  { label: 'Missed return', result: 'lost', ending: 'missed_return', context: 'return', tags: ['return', 'missed return'] },
]

interface ReelKeyframe {
  id: string
  timestampMs: number
  xPercent: number
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function interpolateReelCrop(keyframes: ReelKeyframe[], timestampMs: number, fallback: number) {
  if (keyframes.length === 0) return fallback

  const sorted = [...keyframes].sort((a, b) => a.timestampMs - b.timestampMs)
  if (timestampMs <= sorted[0].timestampMs) return sorted[0].xPercent
  if (timestampMs >= sorted[sorted.length - 1].timestampMs) return sorted[sorted.length - 1].xPercent

  const nextIndex = sorted.findIndex((keyframe) => keyframe.timestampMs >= timestampMs)
  const previous = sorted[nextIndex - 1]
  const next = sorted[nextIndex]
  const span = Math.max(1, next.timestampMs - previous.timestampMs)
  const progress = clamp((timestampMs - previous.timestampMs) / span, 0, 1)
  const eased = progress * progress * (3 - 2 * progress)
  return previous.xPercent + (next.xPercent - previous.xPercent) * eased
}

function formatMs(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function parseTimestamp(value: string) {
  const cleanValue = value.trim()
  if (!cleanValue) return null

  const parts = cleanValue.split(':').map((part) => Number(part))
  if (parts.some((part) => !Number.isFinite(part) || part < 0)) return null

  if (parts.length === 1) return Math.round(parts[0] * 1000)
  if (parts.length === 2) return Math.round((parts[0] * 60 + parts[1]) * 1000)
  if (parts.length === 3) return Math.round((parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000)
  return null
}

function timestampInput(ms: number) {
  return (ms / 1000).toFixed(1).replace(/\.0$/, '')
}

function formatDate(value: string) {
  const timestamp = Number(value)
  if (!Number.isFinite(timestamp)) return '-'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(timestamp))
}

function label(value: string) {
  return value.replaceAll('_', ' ')
}

function isWinnerEnding(value: string) {
  return value === 'ace' || value === 'winner' || value.endsWith('_winner')
}

function isErrorEnding(value: string) {
  return value.includes('error') || value === 'missed_return' || value === 'double_fault' || value.startsWith('double_fault_')
}

function isUnforcedEnding(value: string) {
  return value === 'unforced_error' || value.startsWith('unforced_')
}

function isForcedEnding(value: string) {
  return value === 'forced_error' || value.startsWith('forced_')
}

function percent(part: number, total: number) {
  if (total === 0) return '0%'
  return `${Math.round((part / total) * 100)}%`
}

function topCounts(values: string[], limit = 3) {
  return Object.entries(
    values.reduce<Record<string, number>>((counts, value) => {
      if (!value) return counts
      counts[value] = (counts[value] ?? 0) + 1
      return counts
    }, {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
}

function clipStats(clips: Clip[]) {
  const won = clips.filter((clip) => clip.pointResult === 'won').length
  const lost = clips.filter((clip) => clip.pointResult === 'lost').length
  const unknown = clips.filter((clip) => clip.pointResult === 'unknown').length
  const winners = clips.filter((clip) => isWinnerEnding(clip.pointEnding)).length
  const errors = clips.filter((clip) => isErrorEnding(clip.pointEnding)).length
  const lostClips = clips.filter((clip) => clip.pointResult === 'lost')

  return {
    total: clips.length,
    won,
    lost,
    unknown,
    winRate: percent(won, won + lost),
    winners,
    errors,
    topEndings: topCounts(clips.map((clip) => clip.pointEnding)),
    topTags: topCounts(clips.flatMap((clip) => clip.tags)),
    topContexts: topCounts(clips.map((clip) => clip.shotContext)),
    lostEndings: topCounts(lostClips.map((clip) => clip.pointEnding), 1),
    lostTags: topCounts(lostClips.flatMap((clip) => clip.tags), 1),
    errorContexts: topCounts(
      clips
        .filter((clip) => isErrorEnding(clip.pointEnding))
        .map((clip) => clip.shotContext),
      1,
    ),
  }
}

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const clipVideoRef = useRef<HTMLVideoElement>(null)
  const enterHoldWasPausedRef = useRef(true)
  const enterHoldPreviousRateRef = useRef(1)
  const enterHoldActiveRef = useRef(false)
  const [library, setLibrary] = useState<LibraryState>({ sessions: [], videos: [], clips: [], candidateClips: [] })
  const [activeView, setActiveView] = useState<AppView>('sessions')
  const [clipsFolder, setClipsFolder] = useState('')
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [newSessionTitle, setNewSessionTitle] = useState('')
  const [newSessionNotes, setNewSessionNotes] = useState('')
  const [editingSessionId, setEditingSessionId] = useState('')
  const [editingSessionTitle, setEditingSessionTitle] = useState('')
  const [editingSessionNotes, setEditingSessionNotes] = useState('')
  const [selectedVideoId, setSelectedVideoId] = useState('')
  const [selectedClipId, setSelectedClipId] = useState('')
  const [startMs, setStartMs] = useState<number | null>(null)
  const [endMs, setEndMs] = useState<number | null>(null)
  const [loadedCandidateId, setLoadedCandidateId] = useState('')
  const [startInput, setStartInput] = useState('')
  const [endInput, setEndInput] = useState('')
  const [title, setTitle] = useState('')
  const [pointResult, setPointResult] = useState<PointResult>('unknown')
  const [pointEnding, setPointEnding] = useState<PointEnding>('other')
  const [shotContext, setShotContext] = useState<ShotContext>('rally')
  const [notes, setNotes] = useState('')
  const [tags, setTags] = useState('')
  const [editTitle, setEditTitle] = useState('')
  const [editPointResult, setEditPointResult] = useState<PointResult>('unknown')
  const [editPointEnding, setEditPointEnding] = useState<PointEnding>('other')
  const [editShotContext, setEditShotContext] = useState<ShotContext>('rally')
  const [editNotes, setEditNotes] = useState('')
  const [editTags, setEditTags] = useState('')
  const [editEvents, setEditEvents] = useState<ClipEvent[]>([])
  const [newEventTime, setNewEventTime] = useState('')
  const [newEventAction, setNewEventAction] = useState('')
  const [newEventNote, setNewEventNote] = useState('')
  const [clipSearch, setClipSearch] = useState('')
  const [clipResultFilter, setClipResultFilter] = useState<'all' | PointResult>('all')
  const [clipEndingFilter, setClipEndingFilter] = useState<'all' | PointEnding>('all')
  const [clipContextFilter, setClipContextFilter] = useState<'all' | ShotContext>('all')
  const [clipVideoFilter, setClipVideoFilter] = useState('all')
  const [clipSessionFilter, setClipSessionFilter] = useState('all')
  const [clipTagFilter, setClipTagFilter] = useState('')
  const [status, setStatus] = useState('')
  const [lastExportPath, setLastExportPath] = useState('')
  const [lastExportKind, setLastExportKind] = useState<'clip' | 'reel' | ''>('')
  const [error, setError] = useState('')
  const [videoError, setVideoError] = useState('')
  const [draggingVideo, setDraggingVideo] = useState(false)
  const [detectionMode, setDetectionMode] = useState<DetectionMode>('auto')
  const [benchmarkResults, setBenchmarkResults] = useState<DetectorBenchmark[]>([])
  const [showDetectorDetails, setShowDetectorDetails] = useState(false)
  const [busy, setBusy] = useState(false)
  const [reelKeyframes, setReelKeyframes] = useState<ReelKeyframe[]>([])
  const [reelCropPercent, setReelCropPercent] = useState(0.5)
  const [clipPreviewTimeMs, setClipPreviewTimeMs] = useState(0)
  const [clipVideoAspect, setClipVideoAspect] = useState({ width: 16, height: 9 })

  const eventPresets = ['Serve', 'Return', 'Forehand', 'Backhand', 'Volley', 'Approach', 'Defensive slice', 'Error', 'Winner']

  useEffect(() => {
    invoke<LibraryState>('load_library')
      .then(setLibrary)
      .catch((loadError) => setError(String(loadError)))
    invoke<string>('get_clips_folder')
      .then(setClipsFolder)
      .catch((folderError) => setError(String(folderError)))
  }, [])

  const selectedSession = useMemo(
    () => library.sessions.find((session) => session.id === selectedSessionId),
    [library.sessions, selectedSessionId],
  )
  const selectedProjectVideos = useMemo(
    () => (selectedSessionId ? library.videos.filter((video) => video.sessionId === selectedSessionId) : []),
    [library.videos, selectedSessionId],
  )
  const selectedVideo = useMemo(() => {
    if (!selectedSessionId) return undefined
    return selectedProjectVideos.find((video) => video.id === selectedVideoId) ?? selectedProjectVideos[0]
  }, [selectedProjectVideos, selectedSessionId, selectedVideoId])
  const selectedVideoSession = selectedVideo ? library.sessions.find((session) => session.id === selectedVideo.sessionId) : undefined

  useEffect(() => {
    if (!selectedSessionId) {
      if (selectedVideoId) setSelectedVideoId('')
      return
    }
    if (selectedVideo && selectedVideo.id !== selectedVideoId) setSelectedVideoId(selectedVideo.id)
    if (!selectedVideo && selectedVideoId) setSelectedVideoId('')
  }, [selectedSessionId, selectedVideo, selectedVideoId])

  const videoClips = selectedVideo ? library.clips.filter((clip) => clip.localVideoId === selectedVideo.id) : []
  const selectedClip = useMemo(
    () => library.clips.find((clip) => clip.id === selectedClipId) ?? library.clips[0],
    [library.clips, selectedClipId],
  )
  const selectedClipVideo = selectedClip ? library.videos.find((video) => video.id === selectedClip.localVideoId) : undefined
  const selectedVideoPlaybackPath = selectedVideo?.previewFilePath ?? selectedVideo?.filePath
  const selectedVideoCandidates = selectedVideo
    ? library.candidateClips.filter((candidate) => candidate.localVideoId === selectedVideo.id && candidate.status === 'pending')
    : []
  const selectedVideoDurationMs = selectedVideo?.durationMs ?? Math.max(0, ...videoClips.map((clip) => clip.endMs), ...selectedVideoCandidates.map((candidate) => candidate.endMs))
  const selectedClipDurationMs = selectedClip ? Math.max(0, selectedClip.endMs - selectedClip.startMs) : 0
  const reelCropWidthPercent = Math.min(100, (clipVideoAspect.height * 9 / 16 / clipVideoAspect.width) * 100)
  const reelCropTravelPercent = Math.max(0, 100 - reelCropWidthPercent)
  const previewCropPercent = clamp(reelCropPercent, 0, 1)
  const previewCropLeftPercent = previewCropPercent * reelCropTravelPercent
  const selectedSessionClips = selectedSession ? library.clips.filter((clip) => clip.sessionId === selectedSession.id) : []
  const selectedSessionStats = clipStats(selectedSessionClips)
  const globalStats = clipStats(library.clips)
  const sessionSummaries = library.sessions.map((session) => {
    const clips = library.clips.filter((clip) => clip.sessionId === session.id)
    const videos = library.videos.filter((video) => video.sessionId === session.id)
    return {
      session,
      clips,
      videos,
      stats: clipStats(clips),
    }
  })
  const filteredClips = useMemo(() => {
    const search = clipSearch.trim().toLowerCase()
    const tagSearch = clipTagFilter.trim().toLowerCase()

    return library.clips.filter((clip) => {
      const video = library.videos.find((item) => item.id === clip.localVideoId)
      const searchable = [
        clip.title,
        clip.notes,
        clip.pointResult,
        clip.pointEnding,
        clip.shotContext,
        video?.fileName ?? '',
        ...clip.tags,
      ].join(' ').toLowerCase()

      if (search && !searchable.includes(search)) return false
      if (tagSearch && !clip.tags.some((tag) => tag.toLowerCase().includes(tagSearch))) return false
      if (clipResultFilter !== 'all' && clip.pointResult !== clipResultFilter) return false
      if (clipEndingFilter !== 'all' && clip.pointEnding !== clipEndingFilter) return false
      if (clipContextFilter !== 'all' && clip.shotContext !== clipContextFilter) return false
      if (clipVideoFilter !== 'all' && clip.localVideoId !== clipVideoFilter) return false
      if (clipSessionFilter !== 'all' && (clip.sessionId ?? '') !== clipSessionFilter) return false
      return true
    })
  }, [clipContextFilter, clipEndingFilter, clipResultFilter, clipSearch, clipSessionFilter, clipTagFilter, clipVideoFilter, library.clips, library.videos])
  const filtersActive =
    clipSearch.trim() !== ''
    || clipTagFilter.trim() !== ''
    || clipResultFilter !== 'all'
    || clipEndingFilter !== 'all'
    || clipContextFilter !== 'all'
    || clipVideoFilter !== 'all'
    || clipSessionFilter !== 'all'
  const clipValidationMessage =
    !selectedSession ? 'Open or create a project before clipping.'
    : !selectedVideo ? 'Import a video before saving a clip.'
    : startMs === null ? 'Set a start time first. You can mark it from the player or type it manually.'
    : endMs === null ? 'Set an end time first. You can mark it from the player or type it manually.'
    : endMs <= startMs ? 'End time must be after start time. If the preview is stuck at 0:00, type the timestamps manually.'
    : ''
  const clipReady = clipValidationMessage === ''

  useEffect(() => {
    if (library.clips.length === 0) {
      setSelectedClipId('')
      return
    }

    if (filteredClips.length > 0 && !filteredClips.some((clip) => clip.id === selectedClipId)) {
      setSelectedClipId(filteredClips[0].id)
    } else if (filteredClips.length === 0 && !library.clips.some((clip) => clip.id === selectedClipId)) {
      setSelectedClipId(library.clips[0].id)
    }
  }, [filteredClips, library.clips, selectedClipId])

  useEffect(() => {
    if (!selectedClip) return
    setEditTitle(selectedClip.title)
    setEditPointResult(selectedClip.pointResult)
    setEditPointEnding(selectedClip.pointEnding)
    setEditShotContext(selectedClip.shotContext)
    setEditNotes(selectedClip.notes)
    setEditTags(selectedClip.tags.join(', '))
    setEditEvents(selectedClip.events ?? [])
    setNewEventTime('')
    setNewEventAction('')
    setNewEventNote('')
    setReelKeyframes([])
    setReelCropPercent(0.5)
    setClipPreviewTimeMs(0)
  }, [selectedClip])

  const finishVideoImport = useCallback(async (video: LocalVideo, message = 'Video imported locally.') => {
      setLibrary((prev) => ({
        ...prev,
        videos: [video, ...prev.videos.filter((item) => item.id !== video.id)],
        clips: prev.clips,
      }))
      let selectedVideo = video
      if (selectedSessionId) {
        const updatedVideo = await invoke<LocalVideo>('assign_video_session', {
          localVideoId: video.id,
          sessionId: selectedSessionId,
        })
        selectedVideo = updatedVideo
        setLibrary((prev) => ({
          ...prev,
          videos: prev.videos.map((item) => (item.id === updatedVideo.id ? updatedVideo : item)),
        }))
      }
      setSelectedVideoId(selectedVideo.id)
      setStartMs(null)
      setEndMs(null)
      setStartInput('')
      setEndInput('')
      setVideoError('')
      setStatus(message)
  }, [selectedSessionId])

  const importVideo = async () => {
    setBusy(true)
    setError('')
    setStatus('')

    try {
      const video = await invoke<LocalVideo | null>('import_video')
      if (!video) return
      await finishVideoImport(video)
    } catch (importError) {
      setError(String(importError))
    } finally {
      setBusy(false)
    }
  }

  const importDroppedVideo = useCallback(async (filePath: string) => {
    if (!selectedSessionId) {
      setError('Open or create a project before dropping a video.')
      setActiveView('sessions')
      return
    }

    setBusy(true)
    setError('')
    setStatus('')

    try {
      const video = await invoke<LocalVideo>('import_video_path', { filePath })
      await finishVideoImport(video, 'Video imported from drop.')
      setActiveView('clipper')
    } catch (dropError) {
      setError(String(dropError))
    } finally {
      setDraggingVideo(false)
      setBusy(false)
    }
  }, [finishVideoImport, selectedSessionId])

  useEffect(() => {
    let unlisten: (() => void) | undefined

    getCurrentWebview()
      .onDragDropEvent((event) => {
        const payload = event.payload
        if (payload.type === 'over') {
          setDraggingVideo(true)
          return
        }
        if (payload.type === 'drop') {
          setDraggingVideo(false)
          const [filePath] = payload.paths
          if (filePath) void importDroppedVideo(filePath)
          return
        }
        setDraggingVideo(false)
      })
      .then((nextUnlisten) => {
        unlisten = nextUnlisten
      })
      .catch((dragError) => {
        setError(String(dragError))
      })

    return () => {
      if (unlisten) unlisten()
    }
  }, [importDroppedVideo])

  const markStart = () => {
    const current = Math.round((videoRef.current?.currentTime ?? 0) * 1000)
    setStartMs(current)
    setStartInput(timestampInput(current))
    if (endMs !== null && endMs <= current) setEndMs(null)
    if (endMs !== null && endMs <= current) setEndInput('')
  }

  const markEnd = () => {
    const current = Math.round((videoRef.current?.currentTime ?? 0) * 1000)
    setEndMs(current)
    setEndInput(timestampInput(current))
  }

  const currentVideoMs = () => Math.round((videoRef.current?.currentTime ?? 0) * 1000)

  const updateStartInput = (value: string) => {
    setStartInput(value)
    const parsed = parseTimestamp(value)
    setStartMs(parsed)
    if (parsed !== null && endMs !== null && endMs <= parsed) {
      setEndMs(null)
      setEndInput('')
    }
  }

  const updateEndInput = (value: string) => {
    setEndInput(value)
    setEndMs(parseTimestamp(value))
  }

  const applyPointPreset = (preset: (typeof pointPresets)[number]) => {
    setPointResult(preset.result)
    setPointEnding(preset.ending)
    if (preset.context) setShotContext(preset.context)

    const existingTags = tags.split(',').map((tag) => tag.trim()).filter(Boolean)
    const mergedTags = Array.from(new Set([...existingTags, ...preset.tags]))
    setTags(mergedTags.join(', '))
  }

  const togglePlayback = () => {
    const video = videoRef.current
    if (!video) return

    if (video.paused) {
      void video.play()
    } else {
      video.pause()
    }
  }

  const seekVideo = (secondsDelta: number) => {
    const video = videoRef.current
    if (!video) return
    video.currentTime = Math.max(0, video.currentTime + secondsDelta)
  }

  const startEnterHoldPlayback = () => {
    const video = videoRef.current
    if (!video || enterHoldActiveRef.current) return

    enterHoldWasPausedRef.current = video.paused
    enterHoldPreviousRateRef.current = video.playbackRate || 1
    enterHoldActiveRef.current = true
    video.playbackRate = 2
    void video.play()
  }

  const stopEnterHoldPlayback = () => {
    if (!enterHoldActiveRef.current) return

    const video = videoRef.current
    enterHoldActiveRef.current = false
    if (!video) return

    video.playbackRate = enterHoldPreviousRateRef.current
    if (enterHoldWasPausedRef.current) {
      video.pause()
    }
  }

  const saveClip = async () => {
    if (!selectedVideo || !clipReady) {
      setError(clipValidationMessage)
      setStatus('')
      return
    }
    const shouldResumePlayback = Boolean(videoRef.current && !videoRef.current.paused)
    setBusy(true)
    setError('')
    setStatus('')

    try {
      const clip = await invoke<Clip>('create_clip', {
        input: {
          localVideoId: selectedVideo.id,
          sessionId: selectedSessionId || selectedVideo.sessionId || null,
          startMs,
          endMs,
          title: title.trim() || `Point ${videoClips.length + 1}`,
          pointResult,
          pointEnding,
          shotContext,
          notes,
          tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean),
        },
      })
      setLibrary((prev) => ({ ...prev, clips: [clip, ...prev.clips] }))
      if (loadedCandidateId) {
        try {
          const updatedCandidate = await invoke<CandidateClip>('accept_candidate_clip', { candidateId: loadedCandidateId })
          setLibrary((prev) => ({
            ...prev,
            candidateClips: prev.candidateClips.map((candidate) => (candidate.id === updatedCandidate.id ? updatedCandidate : candidate)),
          }))
        } catch {
          setLibrary((prev) => ({
            ...prev,
            candidateClips: prev.candidateClips.filter((candidate) => candidate.id !== loadedCandidateId),
          }))
        }
      }
      setSelectedClipId(clip.id)
      setClipSessionFilter(clip.sessionId ?? 'all')
      setTitle('')
      setNotes('')
      setTags('')
      setStartMs(null)
      setEndMs(null)
      setLoadedCandidateId('')
      setStartInput('')
      setEndInput('')
      setStatus(clip.exportedClipPath ? `Clip exported: ${clip.exportedClipPath}` : 'Clip metadata saved. ffmpeg was not available for export.')
      if (clip.exportedClipPath) {
        setLastExportPath(clip.exportedClipPath)
        setLastExportKind('clip')
      }
      if (shouldResumePlayback) {
        window.setTimeout(() => {
          void videoRef.current?.play()
        }, 0)
      }
    } catch (saveError) {
      setError(String(saveError))
    } finally {
      setBusy(false)
    }
  }

  const removeClip = async (clipId: string) => {
    setBusy(true)
    setError('')
    try {
      await invoke('delete_clip', { clipId })
      setLibrary((prev) => ({ ...prev, clips: prev.clips.filter((clip) => clip.id !== clipId) }))
      if (selectedClipId === clipId) setSelectedClipId('')
      setStatus('Clip removed from local library.')
    } catch (deleteError) {
      setError(String(deleteError))
    } finally {
      setBusy(false)
    }
  }

  const openClipsFolder = async () => {
    setError('')
    try {
      await invoke('open_clips_folder')
    } catch (openError) {
      setError(String(openError))
    }
  }

  const openLastExportFolder = async () => {
    if (!lastExportPath) return
    setError('')
    try {
      await invoke('open_export_folder', { path: lastExportPath })
    } catch (openError) {
      setError(String(openError))
    }
  }

  const openDataFolder = async () => {
    setError('')
    try {
      await invoke('open_data_folder')
    } catch (openError) {
      setError(String(openError))
    }
  }

  const exportLibraryBackup = async () => {
    setError('')
    setStatus('')
    try {
      const backupPath = await invoke<string | null>('export_library_backup')
      if (backupPath) setStatus(`Library backup exported: ${backupPath}`)
    } catch (backupError) {
      setError(String(backupError))
    }
  }

  const importLibraryBackup = async () => {
    const shouldImport = window.confirm('Importing a backup will replace the current local library. Export a backup first if you want to keep the current state.')
    if (!shouldImport) return

    setError('')
    setStatus('')
    try {
      const importedLibrary = await invoke<LibraryState | null>('import_library_backup')
      if (!importedLibrary) return
      const normalizedLibrary = {
        ...importedLibrary,
        candidateClips: importedLibrary.candidateClips ?? [],
      }
      setLibrary(normalizedLibrary)
      setSelectedSessionId(normalizedLibrary.sessions[0]?.id ?? '')
      setSelectedVideoId(normalizedLibrary.videos[0]?.id ?? '')
      setSelectedClipId(normalizedLibrary.clips[0]?.id ?? '')
      clearClipFilters()
      setStatus('Library backup imported. Videos are referenced by file path and must still exist on this computer.')
    } catch (backupError) {
      setError(String(backupError))
    }
  }

  const exportProjectReport = async (sessionId: string) => {
    if (!sessionId) {
      setError('Open a project before exporting a report.')
      return
    }

    setError('')
    setStatus('')
    try {
      const reportPath = await invoke<string | null>('export_project_report', { sessionId })
      if (reportPath) setStatus(`Project report exported: ${reportPath}`)
    } catch (reportError) {
      setError(String(reportError))
    }
  }

  const copyProjectReportToClipboard = async (sessionId: string) => {
    if (!sessionId) {
      setError('Open a project before copying a report.')
      return
    }

    setError('')
    setStatus('')
    try {
      const markdown = await invoke<string>('get_project_report_markdown', { sessionId })
      await navigator.clipboard.writeText(markdown)
      setStatus('Project report copied to clipboard.')
    } catch (copyError) {
      setError(String(copyError))
    }
  }

  const createSession = async () => {
    setError('')
    setStatus('')
    const title = newSessionTitle.trim()
    if (!title) {
      setError('Session title is required.')
      return
    }

    setBusy(true)
    try {
      const session = await invoke<Session>('create_session', {
        input: {
          title,
          notes: newSessionNotes,
        },
      })
      setLibrary((prev) => ({ ...prev, sessions: [session, ...prev.sessions] }))
      setSelectedSessionId(session.id)
      setSelectedVideoId('')
      setClipSessionFilter(session.id)
      setActiveView('clipper')
      setNewSessionTitle('')
      setNewSessionNotes('')
      setStatus('Session created.')
    } catch (sessionError) {
      setError(String(sessionError))
    } finally {
      setBusy(false)
    }
  }

  const assignSelectedVideoToSession = async (sessionId: string) => {
    if (!selectedVideo) return
    setSelectedSessionId(sessionId)
    setError('')

    try {
      const updatedVideo = await invoke<LocalVideo>('assign_video_session', {
        localVideoId: selectedVideo.id,
        sessionId: sessionId || null,
      })
      setLibrary((prev) => ({
        ...prev,
        videos: prev.videos.map((video) => (video.id === updatedVideo.id ? updatedVideo : video)),
      }))
      setStatus(sessionId ? 'Video assigned to session.' : 'Video removed from session.')
    } catch (assignError) {
      setError(String(assignError))
    }
  }

  const openSession = (sessionId: string) => {
    setSelectedSessionId(sessionId)
    setSelectedVideoId('')
    setClipSessionFilter(sessionId)
    setActiveView('clipper')
  }

  const startEditingSession = (session: Session) => {
    setEditingSessionId(session.id)
    setEditingSessionTitle(session.title)
    setEditingSessionNotes(session.notes)
  }

  const cancelEditingSession = () => {
    setEditingSessionId('')
    setEditingSessionTitle('')
    setEditingSessionNotes('')
  }

  const updateSession = async () => {
    if (!editingSessionId) return
    const title = editingSessionTitle.trim()
    if (!title) {
      setError('Session title is required.')
      return
    }

    setBusy(true)
    setError('')
    setStatus('')

    try {
      const updatedSession = await invoke<Session>('update_session', {
        input: {
          sessionId: editingSessionId,
          title,
          notes: editingSessionNotes,
        },
      })
      setLibrary((prev) => ({
        ...prev,
        sessions: prev.sessions.map((session) => (session.id === updatedSession.id ? updatedSession : session)),
      }))
      cancelEditingSession()
      setStatus('Session updated.')
    } catch (sessionError) {
      setError(String(sessionError))
    } finally {
      setBusy(false)
    }
  }

  const addClipEvent = () => {
    const timestampMs = parseTimestamp(newEventTime)
    if (timestampMs === null) {
      setError('Add a valid event time, for example 0:05 or 5.')
      return
    }

    const action = newEventAction.trim()
    const note = newEventNote.trim()
    if (!action && !note) {
      setError('Add an action or note for the event.')
      return
    }

    setError('')
    setEditEvents((prev) => [
      ...prev,
      {
        id: `event-${Date.now()}`,
        timestampMs,
        action,
        note,
      },
    ].sort((a, b) => a.timestampMs - b.timestampMs))
    setNewEventTime('')
    setNewEventAction('')
    setNewEventNote('')
  }

  const prefillEventAtClipTime = (action = '') => {
    const currentMs = Math.round((clipVideoRef.current?.currentTime ?? 0) * 1000)
    setNewEventTime(timestampInput(currentMs))
    if (action) setNewEventAction(action)
  }

  const seekClipToEvent = (timestampMs: number) => {
    if (!clipVideoRef.current) return
    clipVideoRef.current.currentTime = Math.max(0, timestampMs / 1000)
    void clipVideoRef.current.play()
  }

  const addReelKeyframeAtCurrentTime = () => {
    if (!selectedClip?.exportedClipPath) {
      setError('Select an exported clip before adding reel keyframes.')
      return
    }

    const timestampMs = Math.round((clipVideoRef.current?.currentTime ?? clipPreviewTimeMs / 1000) * 1000)
    const boundedTime = clamp(timestampMs, 0, selectedClipDurationMs)
    const xPercent = clamp(reelCropPercent, 0, 1)

    setError('')
    setReelKeyframes((prev) => {
      const nearby = prev.find((keyframe) => Math.abs(keyframe.timestampMs - boundedTime) < 250)
      if (nearby) {
        return prev
          .map((keyframe) => (keyframe.id === nearby.id ? { ...keyframe, timestampMs: boundedTime, xPercent } : keyframe))
          .sort((a, b) => a.timestampMs - b.timestampMs)
      }

      return [
        ...prev,
        {
          id: `reel-keyframe-${Date.now()}`,
          timestampMs: boundedTime,
          xPercent,
        },
      ].sort((a, b) => a.timestampMs - b.timestampMs)
    })
    setStatus(`Reel keyframe added at ${formatMs(boundedTime)}.`)
  }

  const updateReelKeyframe = (keyframeId: string, patch: Partial<ReelKeyframe>) => {
    if (patch.xPercent !== undefined) setReelCropPercent(clamp(patch.xPercent, 0, 1))
    setReelKeyframes((prev) => prev
      .map((keyframe) => {
        if (keyframe.id !== keyframeId) return keyframe
        return {
          ...keyframe,
          ...patch,
          timestampMs: patch.timestampMs === undefined ? keyframe.timestampMs : clamp(patch.timestampMs, 0, selectedClipDurationMs),
          xPercent: patch.xPercent === undefined ? keyframe.xPercent : clamp(patch.xPercent, 0, 1),
        }
      })
      .sort((a, b) => a.timestampMs - b.timestampMs))
  }

  const removeReelKeyframe = (keyframeId: string) => {
    setReelKeyframes((prev) => prev.filter((keyframe) => keyframe.id !== keyframeId))
  }

  const seekClipToReelKeyframe = (timestampMs: number) => {
    if (!clipVideoRef.current) return
    const nextTime = Math.max(0, timestampMs / 1000)
    clipVideoRef.current.currentTime = nextTime
    setClipPreviewTimeMs(timestampMs)
    const keyframe = reelKeyframes.find((item) => item.timestampMs === timestampMs)
    if (keyframe) setReelCropPercent(keyframe.xPercent)
  }

  const setReelCropPreset = (xPercent: number) => {
    setReelCropPercent(clamp(xPercent, 0, 1))
  }

  const removeClipEvent = (eventId: string) => {
    setEditEvents((prev) => prev.filter((event) => event.id !== eventId))
  }

  const updateClipEvent = (eventId: string, patch: Partial<ClipEvent>) => {
    setEditEvents((prev) => prev.map((event) => (event.id === eventId ? { ...event, ...patch } : event)).sort((a, b) => a.timestampMs - b.timestampMs))
  }

  const deleteSession = async (sessionId: string) => {
    const session = library.sessions.find((item) => item.id === sessionId)
    if (!session) return
    const shouldDelete = window.confirm(`Delete "${session.title}"? Clips and videos will be kept, but moved to No session.`)
    if (!shouldDelete) return

    setBusy(true)
    setError('')
    setStatus('')

    try {
      await invoke('delete_session', { sessionId })
      setLibrary((prev) => ({
        ...prev,
        sessions: prev.sessions.filter((item) => item.id !== sessionId),
        videos: prev.videos.map((video) => (video.sessionId === sessionId ? { ...video, sessionId: undefined } : video)),
        clips: prev.clips.map((clip) => (clip.sessionId === sessionId ? { ...clip, sessionId: undefined } : clip)),
      }))
      if (selectedSessionId === sessionId) setSelectedSessionId('')
      if (clipSessionFilter === sessionId) setClipSessionFilter('all')
      if (editingSessionId === sessionId) cancelEditingSession()
      setStatus('Session deleted. Clips and videos were moved to No session.')
    } catch (sessionError) {
      setError(String(sessionError))
    } finally {
      setBusy(false)
    }
  }

  const createCompatiblePreview = async () => {
    if (!selectedVideo) return
    setBusy(true)
    setError('')
    setStatus('Creating compatible preview copy...')

    try {
      const updatedVideo = await invoke<LocalVideo>('create_compatible_preview', {
        localVideoId: selectedVideo.id,
      })
      setLibrary((prev) => ({
        ...prev,
        videos: prev.videos.map((video) => (video.id === updatedVideo.id ? updatedVideo : video)),
      }))
      setVideoError('')
      setStatus('Compatible preview copy created. The player is now using it.')
    } catch (previewError) {
      setError(String(previewError))
      setStatus('')
    } finally {
      setBusy(false)
    }
  }

  const detectCandidateClips = async () => {
    if (!selectedVideo || !selectedSession) {
      setError('Open a project and select a video before detecting candidates.')
      return
    }

    setBusy(true)
    setError('')
    setStatus('Analyzing video activity for candidate points...')

    try {
      const candidates = await invoke<CandidateClip[]>('detect_candidate_clips', {
        input: {
          localVideoId: selectedVideo.id,
          sessionId: selectedSession.id,
          mode: detectionMode,
        },
      })
      setLibrary((prev) => ({
        ...prev,
        candidateClips: [
          ...prev.candidateClips.filter((candidate) => !(candidate.localVideoId === selectedVideo.id && candidate.status === 'pending')),
          ...candidates,
        ],
      }))
      const modeLabel = detectionModes.find((mode) => mode.value === detectionMode)?.label ?? 'Detector'
      setStatus(candidates.length > 0 ? `${candidates.length} candidate points detected with ${modeLabel}. Review before saving clips.` : 'No candidate points detected.')
    } catch (detectError) {
      setError(String(detectError))
      setStatus('')
    } finally {
      setBusy(false)
    }
  }

  const benchmarkDetectionModes = async () => {
    if (!selectedVideo) {
      setError('Select a video before benchmarking detectors.')
      return
    }

    setBusy(true)
    setError('')
    setStatus('Benchmarking detector modes on this video...')

    try {
      const results = await invoke<DetectorBenchmark[]>('benchmark_detectors', {
        localVideoId: selectedVideo.id,
      })
      setBenchmarkResults(results)
      setShowDetectorDetails(true)
      setStatus('Detector benchmark complete. Use the best-looking mode, then review the timeline before saving clips.')
    } catch (benchmarkError) {
      setError(String(benchmarkError))
      setStatus('')
    } finally {
      setBusy(false)
    }
  }

  const loadCandidateClip = (candidate: CandidateClip, startValue?: string, endValue?: string) => {
    const nextStartMs = startValue ? parseTimestamp(startValue) : candidate.startMs
    const nextEndMs = endValue ? parseTimestamp(endValue) : candidate.endMs
    if (nextStartMs === null || nextEndMs === null || nextEndMs <= nextStartMs) {
      setError('Candidate needs a valid start and end before loading it.')
      return
    }

    setStartMs(nextStartMs)
    setEndMs(nextEndMs)
    setLoadedCandidateId(candidate.id)
    setStartInput(timestampInput(nextStartMs))
    setEndInput(timestampInput(nextEndMs))
    setTitle((current) => current || `Candidate ${formatMs(nextStartMs)}-${formatMs(nextEndMs)}`)
    setStatus('Candidate loaded. Adjust start/end if needed, then save as a clip.')
  }

  const rejectCandidateClip = async (candidateId: string) => {
    setError('')
    try {
      const updatedCandidate = await invoke<CandidateClip>('reject_candidate_clip', { candidateId })
      setLibrary((prev) => ({
        ...prev,
        candidateClips: prev.candidateClips.map((candidate) => (candidate.id === updatedCandidate.id ? updatedCandidate : candidate)),
      }))
      setStatus('Candidate rejected.')
    } catch (rejectError) {
      setError(String(rejectError))
    }
  }

  const updateCandidateClip = async (candidate: CandidateClip, startValue: string, endValue: string) => {
    const nextStartMs = parseTimestamp(startValue)
    const nextEndMs = parseTimestamp(endValue)
    if (nextStartMs === null || nextEndMs === null || nextEndMs <= nextStartMs) {
      setError('Candidate needs a valid start and end, for example 1:12 and 1:24.')
      return
    }

    setError('')
    try {
      const updatedCandidate = await invoke<CandidateClip>('upsert_candidate_clip', {
        input: {
          candidateId: candidate.id,
          sessionId: candidate.sessionId ?? (selectedSessionId || null),
          localVideoId: candidate.localVideoId,
          startMs: nextStartMs,
          endMs: nextEndMs,
        },
      })
      setLibrary((prev) => ({
        ...prev,
        candidateClips: prev.candidateClips.map((item) => (item.id === updatedCandidate.id ? updatedCandidate : item)),
      }))
      setStatus('Candidate updated.')
    } catch (candidateError) {
      setError(String(candidateError))
    }
  }

  const addCandidateFromMarkedRange = async () => {
    if (!selectedVideo || !selectedSession) {
      setError('Open a project and select a video before adding a candidate.')
      return
    }
    if (!clipReady) {
      setError(clipValidationMessage)
      return
    }

    setError('')
    try {
      const candidate = await invoke<CandidateClip>('upsert_candidate_clip', {
        input: {
          candidateId: null,
          sessionId: selectedSession.id,
          localVideoId: selectedVideo.id,
          startMs,
          endMs,
        },
      })
      setLibrary((prev) => ({
        ...prev,
        candidateClips: [...prev.candidateClips, candidate],
      }))
      setStatus('Candidate added from marked range.')
    } catch (candidateError) {
      setError(String(candidateError))
    }
  }

  const addCandidateAroundPlayhead = async (windowSeconds = 12) => {
    if (!selectedVideo || !selectedSession) {
      setError('Open a project and select a video before adding a candidate.')
      return
    }

    const centerMs = currentVideoMs()
    const halfWindowMs = Math.round((windowSeconds * 1000) / 2)
    const start = Math.max(0, centerMs - halfWindowMs)
    const durationLimit = selectedVideoDurationMs > 0 ? selectedVideoDurationMs : centerMs + halfWindowMs
    const end = Math.min(durationLimit, centerMs + halfWindowMs)

    if (end <= start) {
      setError('Move the playhead into the point before adding a quick range.')
      return
    }

    setError('')
    try {
      const candidate = await invoke<CandidateClip>('upsert_candidate_clip', {
        input: {
          candidateId: null,
          sessionId: selectedSession.id,
          localVideoId: selectedVideo.id,
          startMs: start,
          endMs: end,
        },
      })
      setLibrary((prev) => ({
        ...prev,
        candidateClips: [...prev.candidateClips, candidate],
      }))
      loadCandidateClip(candidate)
      setStatus(`Candidate added around playhead: ${formatMs(start)} - ${formatMs(end)}.`)
    } catch (candidateError) {
      setError(String(candidateError))
    }
  }

  const splitLoadedCandidateAtPlayhead = async () => {
    if (!loadedCandidateId) {
      setError('Load a candidate before splitting it.')
      return
    }
    const candidate = selectedVideoCandidates.find((item) => item.id === loadedCandidateId)
    if (!candidate) {
      setError('Loaded candidate was not found.')
      return
    }

    const splitMs = currentVideoMs()
    const minimumSegmentMs = 1_500
    if (splitMs <= candidate.startMs + minimumSegmentMs || splitMs >= candidate.endMs - minimumSegmentMs) {
      setError('Move the playhead inside the candidate before splitting it.')
      return
    }

    setError('')
    try {
      const first = await invoke<CandidateClip>('upsert_candidate_clip', {
        input: {
          candidateId: candidate.id,
          sessionId: candidate.sessionId ?? (selectedSessionId || null),
          localVideoId: candidate.localVideoId,
          startMs: candidate.startMs,
          endMs: splitMs,
        },
      })
      const second = await invoke<CandidateClip>('upsert_candidate_clip', {
        input: {
          candidateId: null,
          sessionId: candidate.sessionId ?? (selectedSessionId || null),
          localVideoId: candidate.localVideoId,
          startMs: splitMs,
          endMs: candidate.endMs,
        },
      })
      setLibrary((prev) => ({
        ...prev,
        candidateClips: [...prev.candidateClips.map((item) => (item.id === first.id ? first : item)), second],
      }))
      loadCandidateClip(first)
      setStatus(`Candidate split at ${formatMs(splitMs)}.`)
    } catch (candidateError) {
      setError(String(candidateError))
    }
  }

  const updateClip = async () => {
    if (!selectedClip) return
    setBusy(true)
    setError('')
    setStatus('')

    try {
      const updatedClip = await invoke<Clip>('update_clip', {
        input: {
          clipId: selectedClip.id,
          title: editTitle.trim() || selectedClip.title,
          pointResult: editPointResult,
          pointEnding: editPointEnding,
          shotContext: editShotContext,
          notes: editNotes,
          tags: editTags.split(',').map((tag) => tag.trim()).filter(Boolean),
          events: editEvents,
        },
      })
      setLibrary((prev) => ({
        ...prev,
        clips: prev.clips.map((clip) => (clip.id === updatedClip.id ? updatedClip : clip)),
      }))
      setStatus('Clip metadata updated.')
    } catch (updateError) {
      setError(String(updateError))
    } finally {
      setBusy(false)
    }
  }

  const exportSelectedClipReel = async () => {
    if (!selectedClip) return
    if (reelKeyframes.length < 2) {
      setError('Add at least two reel keyframes: one near the start and one near the end. Add extra keyframes where the player changes direction.')
      return
    }

    setBusy(true)
    setError('')
    setStatus('Exporting Instagram-ready reel...')

    try {
      const output = await invoke<string>('export_reel_clip', {
        input: {
          clipId: selectedClip.id,
          keyframes: reelKeyframes.map((keyframe) => ({
            timestampMs: keyframe.timestampMs,
            xPercent: keyframe.xPercent,
          })),
        },
      })
      setLastExportPath(output)
      setLastExportKind('reel')
      setStatus(`Instagram reel exported: ${output}`)
    } catch (reelError) {
      setError(String(reelError))
      setStatus('')
    } finally {
      setBusy(false)
    }
  }

  const clearClipFilters = () => {
    setClipSearch('')
    setClipResultFilter('all')
    setClipEndingFilter('all')
    setClipContextFilter('all')
    setClipVideoFilter('all')
    setClipSessionFilter('all')
    setClipTagFilter('')
  }

  const filterByResult = (result: PointResult) => {
    setClipResultFilter(result)
    setClipEndingFilter('all')
    setClipContextFilter('all')
    setClipTagFilter('')
  }

  const filterByEnding = (ending: PointEnding) => {
    setClipEndingFilter(ending)
    setClipResultFilter('all')
    setClipContextFilter('all')
    setClipTagFilter('')
  }

  const filterByContext = (context: ShotContext) => {
    setClipContextFilter(context)
    setClipResultFilter('all')
    setClipEndingFilter('all')
    setClipTagFilter('')
  }

  const filterByTag = (tag: string) => {
    setClipTagFilter(tag)
    setClipResultFilter('all')
    setClipEndingFilter('all')
    setClipContextFilter('all')
  }

  const filterBySelectedSession = () => {
    if (!selectedSession) return
    setClipSessionFilter(selectedSession.id)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isTyping = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT'
      if (isTyping) return

      if (event.code === 'Space') {
        event.preventDefault()
        togglePlayback()
      } else if (event.key === 'Enter' || event.code === 'NumpadEnter') {
        event.preventDefault()
        if (!event.repeat) startEnterHoldPlayback()
      } else if (event.key === '[') {
        event.preventDefault()
        markStart()
      } else if (event.key === ']') {
        event.preventDefault()
        markEnd()
      } else if (event.key.toLowerCase() === 's') {
        event.preventDefault()
        void saveClip()
      } else if (event.key.toLowerCase() === 'e') {
        event.preventDefault()
        if (activeView === 'library' && selectedClip) prefillEventAtClipTime()
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        seekVideo(-5)
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        seekVideo(5)
      }
    }

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.code !== 'NumpadEnter') return
      event.preventDefault()
      stopEnterHoldPlayback()
    }

    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('keyup', onKeyUp, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('keyup', onKeyUp, true)
      stopEnterHoldPlayback()
    }
  }, [activeView, clipReady, clipValidationMessage, endMs, selectedClip, selectedVideo, startMs, tags])

  return (
    <main className="app">
      <header className="topbar">
        <div className="brand-lockup">
          <img src={raqetLogo} alt="Raqet" />
          <div>
          <p className="eyebrow">Raqet Desktop MVP</p>
          <h1>Local video clipper</h1>
          </div>
        </div>
        <button type="button" onClick={selectedSession ? importVideo : () => setActiveView('sessions')} disabled={busy}>
          {busy ? 'Working...' : selectedSession ? 'Import Video' : 'Create Or Open Project'}
        </button>
      </header>

      <section className="notice">
        This MVP stores metadata locally and keeps source videos on your computer. Exported clips are saved into one local Raqet folder.
      </section>

      {error && <p className="error">{error}</p>}
      {status && (
        <div className="status export-status">
          <span>{status}</span>
          {lastExportPath && (
            <button type="button" className="secondary-button" onClick={openLastExportFolder}>
              Open {lastExportKind === 'reel' ? 'Reel' : 'Clip'} Folder
            </button>
          )}
        </div>
      )}

      <nav className="app-nav" aria-label="Desktop sections">
        {([
          ['clipper', 'Clipper'],
          ['library', 'Clips & Timeline'],
          ['stats', 'Stats'],
          ['sessions', 'Projects'],
        ] as Array<[AppView, string]>).map(([view, text]) => (
          <button key={view} type="button" className={activeView === view ? 'active' : ''} onClick={() => setActiveView(view)}>
            {text}
          </button>
        ))}
      </nav>

      <section className="current-session-strip">
        <div>
          <p className="eyebrow">Active project</p>
          <strong>{selectedSession?.title ?? 'No project open'}</strong>
        </div>
        <div className="strip-actions">
          <button type="button" className="secondary-button" onClick={() => setActiveView('sessions')}>Choose Project</button>
          {selectedSession && <button type="button" className="secondary-button" onClick={() => { setClipSessionFilter(selectedSession.id); setActiveView('library') }}>View Project Clips</button>}
        </div>
      </section>

      {activeView === 'sessions' && (
      <section className="panel session-panel">
        <div className="session-create">
          <div>
            <p className="eyebrow">{selectedSession ? 'Active project' : 'Start here'}</p>
            <h2>{selectedSession?.title ?? 'Open or create a project'}</h2>
            {selectedSession?.notes && <p className="muted">{selectedSession.notes}</p>}
          </div>
          <label>
            Set active project
            <select value={selectedSessionId} onChange={(event) => setSelectedSessionId(event.target.value)}>
              <option value="">No project</option>
              {library.sessions.map((session) => <option key={session.id} value={session.id}>{session.title}</option>)}
            </select>
          </label>
        </div>
        <div className="session-create">
          <label>
            New project
            <input value={newSessionTitle} onChange={(event) => setNewSessionTitle(event.target.value)} placeholder="Practice with Carlos" />
          </label>
          <label>
            Notes
            <input value={newSessionNotes} onChange={(event) => setNewSessionNotes(event.target.value)} placeholder="Hard court, two sets, serve focus" />
          </label>
          <button type="button" onClick={createSession} disabled={busy}>Create Project</button>
        </div>
        {selectedSession && (
          <div className="session-stats">
            <span>{selectedSessionStats.total} clips</span>
            <span>{selectedSessionStats.won} won</span>
            <span>{selectedSessionStats.lost} lost</span>
            <span>{selectedSessionStats.winners} winners</span>
            <span>{selectedSessionStats.errors} errors</span>
          </div>
        )}
        <div className="session-list">
          <div className="section-title">
            <div>
              <p className="eyebrow">Saved sessions</p>
              <h2>{library.sessions.length} projects</h2>
            </div>
          </div>
          {sessionSummaries.length === 0 ? (
            <p className="muted">No projects yet. Create one before importing a match or practice video.</p>
          ) : sessionSummaries.map(({ session, videos, stats }) => (
            <article key={session.id} className={`session-row ${selectedSessionId === session.id ? 'selected' : ''}`}>
              {editingSessionId === session.id ? (
                <div className="session-edit">
                  <label>
                    Title
                    <input value={editingSessionTitle} onChange={(event) => setEditingSessionTitle(event.target.value)} />
                  </label>
                  <label>
                    Notes
                    <textarea value={editingSessionNotes} onChange={(event) => setEditingSessionNotes(event.target.value)} rows={3} />
                  </label>
                  <div className="session-actions">
                    <button type="button" onClick={updateSession} disabled={busy}>Save</button>
                    <button type="button" className="secondary-button" onClick={cancelEditingSession}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <h3>{session.title}</h3>
                    <p>{session.notes || 'No notes yet.'}</p>
                    <small>{formatDate(session.createdAt)}</small>
                  </div>
                  <div className="session-row-stats">
                    <span>{videos.length} videos</span>
                    <span>{stats.total} clips</span>
                    <span>{stats.winRate} win rate</span>
                    <span>{stats.won}-{stats.lost}</span>
                  </div>
                  <div className="session-actions">
                    <button type="button" onClick={() => openSession(session.id)}>Open</button>
                    <button type="button" className="secondary-button" onClick={() => exportProjectReport(session.id)}>Export Report</button>
                    <button type="button" className="secondary-button" onClick={() => copyProjectReportToClipboard(session.id)}>Copy Report</button>
                    <button type="button" className="secondary-button" onClick={() => startEditingSession(session)}>Edit</button>
                    <button type="button" className="danger-button" onClick={() => deleteSession(session.id)} disabled={busy}>Delete</button>
                  </div>
                </>
              )}
            </article>
          ))}
        </div>
        <div className="data-tools">
          <div>
            <p className="eyebrow">Local data</p>
            <h2>Backup and storage</h2>
            <p className="muted">Backups save sessions, clips, tags, notes, and file paths. Source videos and exported clips are not embedded in the JSON file.</p>
          </div>
          <div className="data-actions">
            <button type="button" onClick={exportLibraryBackup}>Export Library JSON</button>
            <button type="button" className="secondary-button" onClick={() => exportProjectReport(selectedSessionId)} disabled={!selectedSessionId}>Export Active Project Report</button>
            <button type="button" className="secondary-button" onClick={() => copyProjectReportToClipboard(selectedSessionId)} disabled={!selectedSessionId}>Copy Active Project Report</button>
            <button type="button" className="secondary-button" onClick={importLibraryBackup}>Import Library JSON</button>
            <button type="button" className="secondary-button" onClick={openDataFolder}>Open Data Folder</button>
            <button type="button" className="secondary-button" onClick={openClipsFolder}>Open Clips Folder</button>
          </div>
        </div>
      </section>
      )}

      {activeView === 'stats' && (
      <section className="panel stats-panel">
        <div className="section-title">
          <div>
            <p className="eyebrow">Local stats</p>
            <h2>Point patterns</h2>
          </div>
          {selectedSession && <button type="button" className="secondary-button" onClick={filterBySelectedSession}>Filter to Session</button>}
        </div>
        <div className="stats-grid">
          <button type="button" className="stat-card" onClick={() => setClipSessionFilter('all')}>
            <span>All clips</span>
            <strong>{globalStats.total}</strong>
            <small>{globalStats.winRate} win rate</small>
          </button>
          <button type="button" className="stat-card" onClick={() => filterByResult('won')}>
            <span>Won</span>
            <strong>{globalStats.won}</strong>
            <small>confirmed points</small>
          </button>
          <button type="button" className="stat-card" onClick={() => filterByResult('lost')}>
            <span>Lost</span>
            <strong>{globalStats.lost}</strong>
            <small>review these first</small>
          </button>
          <button type="button" className="stat-card" onClick={() => filterByTag('unforced error')}>
            <span>Unforced errors</span>
            <strong>{library.clips.filter((clip) => isUnforcedEnding(clip.pointEnding)).length}</strong>
            <small>avoidable misses</small>
          </button>
          <button type="button" className="stat-card" onClick={() => filterByTag('winner')}>
            <span>Winners</span>
            <strong>{globalStats.winners}</strong>
            <small>winners + aces</small>
          </button>
          <button type="button" className="stat-card" onClick={() => filterByTag('forced error')}>
            <span>Forced errors</span>
            <strong>{library.clips.filter((clip) => isForcedEnding(clip.pointEnding)).length}</strong>
            <small>under pressure</small>
          </button>
        </div>
        <div className="pattern-grid">
          <div className="pattern-card">
            <h3>Top endings</h3>
            {globalStats.topEndings.length === 0 ? <p className="muted">No endings yet.</p> : globalStats.topEndings.map(([ending, count]) => (
              <button key={ending} type="button" onClick={() => filterByEnding(ending as PointEnding)}>
                <span>{label(ending)}</span>
                <strong>{count}</strong>
              </button>
            ))}
          </div>
          <div className="pattern-card">
            <h3>Top contexts</h3>
            {globalStats.topContexts.length === 0 ? <p className="muted">No contexts yet.</p> : globalStats.topContexts.map(([context, count]) => (
              <button key={context} type="button" onClick={() => filterByContext(context as ShotContext)}>
                <span>{label(context)}</span>
                <strong>{count}</strong>
              </button>
            ))}
          </div>
          <div className="pattern-card">
            <h3>Top tags</h3>
            {globalStats.topTags.length === 0 ? <p className="muted">No tags yet.</p> : globalStats.topTags.map(([tag, count]) => (
              <button key={tag} type="button" onClick={() => filterByTag(tag)}>
                <span>{tag}</span>
                <strong>{count}</strong>
              </button>
            ))}
          </div>
          <div className="pattern-card">
            <h3>Weakness signals</h3>
            <p>Lost-point ending: <strong>{globalStats.lostEndings[0] ? label(globalStats.lostEndings[0][0]) : '-'}</strong></p>
            <p>Lost-point tag: <strong>{globalStats.lostTags[0]?.[0] ?? '-'}</strong></p>
            <p>Error context: <strong>{globalStats.errorContexts[0] ? label(globalStats.errorContexts[0][0]) : '-'}</strong></p>
          </div>
        </div>
        {selectedSession && (
          <div className="session-breakdown">
            <h3>{selectedSession.title}</h3>
            <span>{selectedSessionStats.total} clips</span>
            <span>{selectedSessionStats.winRate} win rate</span>
            <span>{selectedSessionStats.winners} winners</span>
            <span>{selectedSessionStats.errors} errors</span>
          </div>
        )}
      </section>
      )}

      {activeView === 'clipper' && (
      !selectedSession ? (
      <section className="panel project-gate">
        <div>
          <p className="eyebrow">Start here</p>
          <h2>Open a project before clipping</h2>
          <p className="muted">A project keeps the source video, exported point clips, timeline notes, and stats together. Create one for each practice, match, or video review session.</p>
        </div>
        <div className="project-gate-grid">
          <div className="project-create-card">
            <h3>Create project</h3>
            <label>
              Project name
              <input value={newSessionTitle} onChange={(event) => setNewSessionTitle(event.target.value)} placeholder="Practice with Carlos" />
            </label>
            <label>
              Notes
              <input value={newSessionNotes} onChange={(event) => setNewSessionNotes(event.target.value)} placeholder="Hard court, serve focus, two sets" />
            </label>
            <button type="button" onClick={createSession} disabled={busy}>Create And Open</button>
          </div>
          <div className="project-create-card">
            <h3>Open existing</h3>
            {library.sessions.length === 0 ? (
              <p className="muted">No saved projects yet.</p>
            ) : (
              <div className="project-pick-list">
                {library.sessions.map((session) => (
                  <button key={session.id} type="button" className="secondary-button" onClick={() => openSession(session.id)}>
                    {session.title}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
      ) : (
      <div className="layout">
        <section className="panel video-panel">
          {selectedVideo ? (
            <>
              <div className="video-meta">
                <div>
                  <p className="eyebrow">Current video</p>
                  <h2>{selectedVideo.fileName}</h2>
                  <p className="muted">Project: {selectedVideoSession?.title ?? 'Not assigned yet'}</p>
                </div>
                <select value={selectedVideo.id} onChange={(event) => setSelectedVideoId(event.target.value)}>
                  {selectedProjectVideos.map((video) => (
                    <option key={video.id} value={video.id}>{video.fileName}</option>
                  ))}
                </select>
              </div>
              {selectedVideo.sessionId !== selectedSession.id && (
                <div className="video-project-warning">
                  <span>This video is not assigned to the active project.</span>
                  <button type="button" className="secondary-button" onClick={() => assignSelectedVideoToSession(selectedSession.id)}>Assign to {selectedSession.title}</button>
                </div>
              )}
              <video
                key={selectedVideoPlaybackPath}
                ref={videoRef}
                src={selectedVideoPlaybackPath ? convertFileSrc(selectedVideoPlaybackPath) : undefined}
                controls
                onCanPlay={() => setVideoError('')}
                onError={() => setVideoError('This video could not be played in the desktop preview. Try an H.264 MP4, or enter start/end times manually and export the clip.')}
              />
              {videoError && <p className="video-error">{videoError}</p>}
              <div className="video-actions">
                <button type="button" className="secondary-button" onClick={createCompatiblePreview} disabled={busy}>
                  {selectedVideo.previewFilePath ? 'Rebuild Compatible Preview' : 'Create Compatible Preview'}
                </button>
                {selectedVideo.previewFilePath && <span>Using preview copy for playback. Original video is unchanged.</span>}
              </div>
              <div className="marks">
                <button type="button" onClick={markStart}>Mark Start</button>
                <button type="button" onClick={markEnd}>Mark End</button>
                <div className="mark-readout">
                  <span>Start: {startMs === null ? '-' : formatMs(startMs)}</span>
                  <span>End: {endMs === null ? '-' : formatMs(endMs)}</span>
                </div>
              </div>
              <div className="timestamp-fields">
                <label>
                  Manual start
                  <input value={startInput} onChange={(event) => updateStartInput(event.target.value)} placeholder="0:12.5 or 12.5" />
                </label>
                <label>
                  Manual end
                  <input value={endInput} onChange={(event) => updateEndInput(event.target.value)} placeholder="0:21.0 or 21" />
                </label>
              </div>
              <div className="candidate-tools">
                <div>
                  <p className="eyebrow">Suggested cuts</p>
                  <h3>Auto-detect point candidates</h3>
                  <p className="muted">Run a detector, then use the timeline below to load, adjust, or remove ranges.</p>
                </div>
                <div className="candidate-tool-actions">
                  <label className="detector-mode-select">
                    Detector
                    <select value={detectionMode} onChange={(event) => setDetectionMode(event.target.value as DetectionMode)} disabled={busy}>
                      {detectionModes.map((mode) => (
                        <option key={mode.value} value={mode.value}>{mode.label}</option>
                      ))}
                    </select>
                  </label>
                  <button type="button" className="secondary-button" onClick={detectCandidateClips} disabled={busy || !selectedVideo}>
                    Detect Candidates
                  </button>
                  <button type="button" className="secondary-button" onClick={addCandidateFromMarkedRange} disabled={!clipReady}>
                    Add Current Range
                  </button>
                </div>
                <div className="quick-candidate-actions">
                  <button type="button" className="secondary-button" onClick={() => addCandidateAroundPlayhead(12)} disabled={!selectedVideo || !selectedSession}>
                    Add 12s Around Playhead
                  </button>
                  <button type="button" className="secondary-button" onClick={splitLoadedCandidateAtPlayhead} disabled={!loadedCandidateId}>
                    Split Loaded Candidate
                  </button>
                </div>
                <div className="candidate-tool-footer">
                  <button type="button" className="text-button" onClick={() => setShowDetectorDetails((current) => !current)}>
                    {showDetectorDetails ? 'Hide detector details' : 'Show detector details'}
                  </button>
                  <button type="button" className="text-button" onClick={benchmarkDetectionModes} disabled={busy || !selectedVideo}>
                    Benchmark modes
                  </button>
                </div>
              </div>
              {showDetectorDetails && (
                <div className="detector-details">
                  <div className="detector-mode-help">
                    {detectionModes.map((mode) => (
                      <button
                        key={mode.value}
                        type="button"
                        className={detectionMode === mode.value ? 'selected' : ''}
                        onClick={() => setDetectionMode(mode.value)}
                        disabled={busy}
                      >
                        <strong>{mode.label}</strong>
                        <span>{mode.description}</span>
                      </button>
                    ))}
                  </div>
                  {benchmarkResults.length > 0 && benchmarkResults.map((result) => (
                    <button
                      key={result.mode}
                      type="button"
                      className={detectionMode === result.mode ? 'selected' : ''}
                      onClick={() => setDetectionMode(result.mode)}
                    >
                      <strong>{result.label}</strong>
                      <span>{result.available ? `${result.candidateCount} ranges · ${(result.elapsedMs / 1000).toFixed(1)}s` : 'Not installed'}</span>
                      {result.error && <small>{result.error}</small>}
                    </button>
                  ))}
                </div>
              )}
              {selectedVideoCandidates.length > 0 && (
                <>
                  <div className="candidate-timeline" aria-label="Editable candidate timeline">
                    {selectedVideoCandidates.map((candidate, index) => {
                      const left = selectedVideoDurationMs > 0 ? Math.max(0, Math.min(100, (candidate.startMs / selectedVideoDurationMs) * 100)) : 0
                      const width = selectedVideoDurationMs > 0 ? Math.max(1.5, Math.min(100 - left, ((candidate.endMs - candidate.startMs) / selectedVideoDurationMs) * 100)) : 8
                      return (
                        <button
                          key={candidate.id}
                          type="button"
                          className={loadedCandidateId === candidate.id ? 'selected' : ''}
                          style={{ left: `${left}%`, width: `${width}%` }}
                          title={`Candidate ${index + 1}: ${formatMs(candidate.startMs)} - ${formatMs(candidate.endMs)}`}
                          onClick={() => loadCandidateClip(candidate)}
                        >
                          {index + 1}
                        </button>
                      )
                    })}
                  </div>
                  <div className="candidate-list" aria-label="Candidate clips">
                    {selectedVideoCandidates.map((candidate, index) => (
                      <form
                        key={candidate.id}
                        className="candidate-row"
                        onSubmit={(event) => {
                          event.preventDefault()
                          const data = new FormData(event.currentTarget)
                          void updateCandidateClip(candidate, String(data.get('start') ?? ''), String(data.get('end') ?? ''))
                        }}
                      >
                        <div>
                          <strong>Candidate {index + 1}</strong>
                          <span>{formatMs(candidate.startMs)} - {formatMs(candidate.endMs)}</span>
                          <small>{label(candidate.source ?? detectionMode)}</small>
                        </div>
                        <div className="candidate-time-fields">
                          <label>
                            Start
                            <input name="start" defaultValue={timestampInput(candidate.startMs)} />
                          </label>
                          <label>
                            End
                            <input name="end" defaultValue={timestampInput(candidate.endMs)} />
                          </label>
                        </div>
                        <div className="candidate-actions">
                          <button type="submit" className="secondary-button">
                            Update
                          </button>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={(event) => {
                              const form = event.currentTarget.closest('form')
                              const data = form ? new FormData(form) : null
                              loadCandidateClip(candidate, String(data?.get('start') ?? ''), String(data?.get('end') ?? ''))
                            }}
                          >
                            Load
                          </button>
                          <button type="button" className="danger-button" onClick={() => rejectCandidateClip(candidate.id)}>
                            Remove
                          </button>
                        </div>
                      </form>
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className={`empty drop-zone ${draggingVideo ? 'dragging' : ''}`}>
              <h2>Import a local tennis video</h2>
              <p>Drag an MP4, MOV, MPEG, MPG, or WebM file here, or choose it from your computer. The full video stays local.</p>
              <button type="button" onClick={importVideo} disabled={busy}>Import Video</button>
            </div>
          )}
        </section>

        <aside className="panel form-panel">
          <h2>Create point clip</h2>
          <div className="shortcut-strip">
            <span>Space play</span>
            <span>[ start</span>
            <span>] end</span>
            <span>S save</span>
            <span>←/→ seek</span>
          </div>
          <label>
            Title
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Backhand under pressure" />
          </label>
          <div className="preset-grid" aria-label="Point presets">
            {pointPresets.map((preset) => (
              <button key={preset.label} type="button" className="preset-button" onClick={() => applyPointPreset(preset)}>
                {preset.label}
              </button>
            ))}
          </div>
          <div className="field-grid">
            <label>
              Result
              <select value={pointResult} onChange={(event) => setPointResult(event.target.value as PointResult)}>
                <option value="unknown">Unknown</option>
                <option value="won">Won</option>
                <option value="lost">Lost</option>
              </select>
            </label>
            <label>
              Ending
              <select value={pointEnding} onChange={(event) => setPointEnding(event.target.value as PointEnding)}>
                {pointEndings.map((ending) => <option key={ending} value={ending}>{label(ending)}</option>)}
              </select>
            </label>
          </div>
          <label>
            Notes
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="What happened in this point?" rows={4} />
          </label>
          <label>
            Tags
            <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="return, pressure, forehand" />
          </label>
          <button type="button" onClick={saveClip} disabled={busy || !selectedVideo}>
            Save And Export Clip
          </button>
          {!clipReady && <p className="hint">{clipValidationMessage}</p>}
          <div className="folder-card">
            <div>
              <p className="eyebrow">Clips folder</p>
              <p>{clipsFolder || 'Resolving local clips folder...'}</p>
            </div>
            <button type="button" className="secondary-button" onClick={openClipsFolder} disabled={!clipsFolder}>
              Open Folder
            </button>
          </div>
        </aside>
      </div>
      )
      )}

      {activeView === 'library' && (
      <section className="panel clips-panel">
        <div className="section-title">
          <h2>Clips and point timeline</h2>
          <p>{filteredClips.length} of {library.clips.length} saved clips</p>
        </div>
        {library.clips.length === 0 ? (
          <p className="muted">No clips yet. Mark a start and end, then save the point.</p>
        ) : (
          <div className="clip-review-layout">
          <div className="clip-filters">
            <label>
              Search
              <input value={clipSearch} onChange={(event) => setClipSearch(event.target.value)} placeholder="forehand, return, pressure..." />
            </label>
            <div className="filter-grid">
              <label>
                Result
                <select value={clipResultFilter} onChange={(event) => setClipResultFilter(event.target.value as 'all' | PointResult)}>
                  <option value="all">All</option>
                  <option value="unknown">Unknown</option>
                  <option value="won">Won</option>
                  <option value="lost">Lost</option>
                </select>
              </label>
              <label>
                Ending
                <select value={clipEndingFilter} onChange={(event) => setClipEndingFilter(event.target.value as 'all' | PointEnding)}>
                  <option value="all">All</option>
                  {pointEndings.map((ending) => <option key={ending} value={ending}>{label(ending)}</option>)}
                </select>
              </label>
              <label>
                Source
                <select value={clipVideoFilter} onChange={(event) => setClipVideoFilter(event.target.value)}>
                  <option value="all">All videos</option>
                  {library.videos.map((video) => <option key={video.id} value={video.id}>{video.fileName}</option>)}
                </select>
              </label>
              <label>
                Session
                <select value={clipSessionFilter} onChange={(event) => setClipSessionFilter(event.target.value)}>
                  <option value="all">All sessions</option>
                  <option value="">No session</option>
                  {library.sessions.map((session) => <option key={session.id} value={session.id}>{session.title}</option>)}
                </select>
              </label>
            </div>
            <label>
              Tag
              <input value={clipTagFilter} onChange={(event) => setClipTagFilter(event.target.value)} placeholder="unforced, serve, backhand" />
            </label>
            {filtersActive && (
              <button type="button" className="secondary-button" onClick={clearClipFilters}>Clear Filters</button>
            )}
          </div>
          <div className="clip-list">
            {filteredClips.length === 0 ? (
              <p className="muted">No clips match these filters.</p>
            ) : filteredClips.map((clip) => (
              <article key={clip.id} className={`clip-card ${selectedClip?.id === clip.id ? 'selected' : ''}`} onClick={() => setSelectedClipId(clip.id)}>
                <div>
                  <h3>{clip.title}</h3>
                  <p>{formatMs(clip.startMs)} - {formatMs(clip.endMs)} · {clip.pointResult} · {label(clip.pointEnding)}</p>
                  <p>{(clip.events ?? []).length} timeline events</p>
                  {clip.notes && <p className="notes">{clip.notes}</p>}
                  {clip.exportedClipPath && <p className="path">{clip.exportedClipPath}</p>}
                </div>
                <button type="button" onClick={(event) => { event.stopPropagation(); removeClip(clip.id) }} disabled={busy}>Delete</button>
              </article>
            ))}
          </div>
          {selectedClip && filteredClips.length > 0 && (
            <aside className="clip-detail">
              <div>
                <p className="eyebrow">Selected clip</p>
                <h2>{selectedClip.title}</h2>
                <p className="muted">
                  {formatMs(selectedClip.startMs)} - {formatMs(selectedClip.endMs)}
                  {selectedClipVideo ? ` · ${selectedClipVideo.fileName}` : ''}
                </p>
              </div>

              <div className="timeline-callout">
                <strong>Timeline editor</strong>
                <span>Add the sequence of moments inside this point, then save.</span>
              </div>

              {selectedClip.exportedClipPath ? (
                <div className="reel-preview-frame">
                  <video
                    ref={clipVideoRef}
                    src={convertFileSrc(selectedClip.exportedClipPath)}
                    controls
                    onLoadedMetadata={(event) => {
                      const video = event.currentTarget
                      setClipVideoAspect({
                        width: video.videoWidth || 16,
                        height: video.videoHeight || 9,
                      })
                    }}
                    onTimeUpdate={(event) => setClipPreviewTimeMs(Math.round(event.currentTarget.currentTime * 1000))}
                  />
                  <div className="reel-crop-shade left" style={{ width: `${previewCropLeftPercent}%` }} />
                  <div
                    className="reel-crop-window"
                    style={{ left: `${previewCropLeftPercent}%`, width: `${reelCropWidthPercent}%` }}
                  >
                    <span>Reel frame</span>
                  </div>
                  <div
                    className="reel-crop-shade right"
                    style={{ left: `${previewCropLeftPercent + reelCropWidthPercent}%`, width: `${100 - previewCropLeftPercent - reelCropWidthPercent}%` }}
                  />
                </div>
              ) : (
                <p className="video-error">This clip does not have an exported video file.</p>
              )}

              <div className="reel-export-card">
                <div>
                  <p className="eyebrow">Instagram reel</p>
                  <h3>Manual 9:16 crop path</h3>
                  <p className="muted">Set crop keyframes where framing matters. Raqet eases between them and exports a vertical MP4.</p>
                </div>
                <button type="button" onClick={exportSelectedClipReel} disabled={busy || !selectedClip.exportedClipPath || reelKeyframes.length < 2}>
                  Export Reel
                </button>
              </div>

              <div className="reel-keyframe-editor">
                <div>
                  <p className="eyebrow">Reel framing</p>
                  <h3>Build the camera move</h3>
                  <ol className="reel-instructions">
                    <li>Play or scrub to a moment where the player position matters.</li>
                    <li>Move the crop slider until the player is inside the vertical frame.</li>
                    <li>Add a keyframe at the start, at direction changes, and near the end.</li>
                    <li>Export Reel. The final video smoothly moves between your keyframes.</li>
                  </ol>
                </div>
                <div className="reel-controls">
                  <label>
                    Crop position
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={reelCropPercent}
                      onChange={(event) => setReelCropPercent(Number(event.target.value))}
                    />
                  </label>
                  <div className="reel-preset-row">
                    <button type="button" className="secondary-button" onClick={() => setReelCropPreset(0)}>Left</button>
                    <button type="button" className="secondary-button" onClick={() => setReelCropPreset(0.5)}>Center</button>
                    <button type="button" className="secondary-button" onClick={() => setReelCropPreset(1)}>Right</button>
                    <button type="button" onClick={addReelKeyframeAtCurrentTime} disabled={!selectedClip.exportedClipPath}>
                      Add Keyframe At {formatMs(clipPreviewTimeMs)}
                    </button>
                  </div>
                </div>
                {reelKeyframes.length === 0 ? (
                  <p className="muted">No reel keyframes yet. Add at least two before exporting.</p>
                ) : (
                  <div className="reel-keyframe-list">
                    {reelKeyframes.map((keyframe) => (
                      <article key={keyframe.id} className="reel-keyframe-row">
                        <button type="button" className="event-time-button" onClick={() => seekClipToReelKeyframe(keyframe.timestampMs)}>
                          {formatMs(keyframe.timestampMs)}
                        </button>
                        <label>
                          Time
                          <input
                            value={timestampInput(keyframe.timestampMs)}
                            onChange={(event) => {
                              const parsed = parseTimestamp(event.target.value)
                              if (parsed !== null) updateReelKeyframe(keyframe.id, { timestampMs: parsed })
                            }}
                          />
                        </label>
                        <label>
                          Crop
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            value={keyframe.xPercent}
                            onChange={(event) => updateReelKeyframe(keyframe.id, { xPercent: Number(event.target.value) })}
                          />
                        </label>
                        <span className="path">{Math.round(keyframe.xPercent * 100)}%</span>
                        <button type="button" className="danger-button" onClick={() => removeReelKeyframe(keyframe.id)}>Delete</button>
                      </article>
                    ))}
                  </div>
                )}
              </div>

              <div className="timeline-editor prominent">
                <div>
                  <p className="eyebrow">Point timeline</p>
                  <h3>Sequence notes</h3>
                </div>
                <div className="event-toolbar">
                  <button type="button" className="secondary-button" onClick={() => prefillEventAtClipTime()}>
                    Add Event At Current Time
                  </button>
                  <span>Shortcut: E</span>
                </div>
                <div className="event-presets">
                  {eventPresets.map((preset) => (
                    <button key={preset} type="button" className="preset-button" onClick={() => prefillEventAtClipTime(preset)}>
                      {preset}
                    </button>
                  ))}
                </div>
                <div className="event-create">
                  <label>
                    Time
                    <input value={newEventTime} onChange={(event) => setNewEventTime(event.target.value)} placeholder="0:05" />
                  </label>
                  <label>
                    Action
                    <input value={newEventAction} onChange={(event) => setNewEventAction(event.target.value)} placeholder="Backhand neutral cross" />
                  </label>
                  <label>
                    Note
                    <input value={newEventNote} onChange={(event) => setNewEventNote(event.target.value)} placeholder="Good depth, reset point" />
                  </label>
                  <button type="button" className="secondary-button" onClick={addClipEvent}>Add Event</button>
                </div>
                {editEvents.length === 0 ? (
                  <p className="muted">No timeline events yet. Add the important moments inside the point.</p>
                ) : (
                  <div className="event-list">
                    {editEvents.map((eventItem) => (
                        <article key={eventItem.id} className="event-row">
                          <button type="button" className="event-time-button" onClick={() => seekClipToEvent(eventItem.timestampMs)}>
                            {formatMs(eventItem.timestampMs)}
                          </button>
                          <label>
                            Time
                          <input
                            value={timestampInput(eventItem.timestampMs)}
                            onChange={(event) => {
                              const parsed = parseTimestamp(event.target.value)
                              if (parsed !== null) updateClipEvent(eventItem.id, { timestampMs: parsed })
                            }}
                          />
                        </label>
                        <label>
                          Action
                          <input value={eventItem.action} onChange={(event) => updateClipEvent(eventItem.id, { action: event.target.value })} />
                        </label>
                        <label>
                          Note
                          <input value={eventItem.note} onChange={(event) => updateClipEvent(eventItem.id, { note: event.target.value })} />
                        </label>
                        <button type="button" className="danger-button" onClick={() => removeClipEvent(eventItem.id)}>Delete</button>
                      </article>
                    ))}
                  </div>
                )}
                <button type="button" onClick={updateClip} disabled={busy}>Save Timeline And Metadata</button>
              </div>

              <div className="edit-grid">
                <label>
                  Title
                  <input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} />
                </label>
                <div className="field-grid">
                  <label>
                    Result
                    <select value={editPointResult} onChange={(event) => setEditPointResult(event.target.value as PointResult)}>
                      <option value="unknown">Unknown</option>
                      <option value="won">Won</option>
                      <option value="lost">Lost</option>
                    </select>
                  </label>
                  <label>
                    Ending
                    <select value={editPointEnding} onChange={(event) => setEditPointEnding(event.target.value as PointEnding)}>
                      {pointEndings.map((ending) => <option key={ending} value={ending}>{label(ending)}</option>)}
                    </select>
                  </label>
                </div>
                <label>
                  Notes
                  <textarea value={editNotes} onChange={(event) => setEditNotes(event.target.value)} rows={4} />
                </label>
                <label>
                  Tags
                  <input value={editTags} onChange={(event) => setEditTags(event.target.value)} />
                </label>
                <button type="button" onClick={updateClip} disabled={busy}>Save Metadata</button>
              </div>
            </aside>
          )}
          </div>
        )}
      </section>
      )}
    </main>
  )
}
