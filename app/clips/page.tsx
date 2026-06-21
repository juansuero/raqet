'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent, RefObject } from 'react'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/PageHeader'
import { analyzeSavedClip, cancelPointDetectionJob, createClip, createProject, createVideoPlaybackProxy, deleteClip, deleteProject, deleteVideo, exportClip, exportClips, exportReel, importVideo, importVideoFromPath, loadClips, loadHighlightExportJob, loadPointDetectionJob, loadPointDetectionJobs, loadProjects, loadVideos, showFileLocation, startHighlightExport, startPointDetection, updateClip } from '@/lib/api'
import type { HighlightExportJob, PointCandidate, PointDetectionJob } from '@/lib/api'
import type { Clip, LocalVideo, PointEnding, Project, ReelKeyframe, ShotContext } from '@/lib/data'
import { ArrowDown, ArrowUp, Brain, Check, ChevronsDown, ChevronsUp, Download, Film, FolderOpen, GripVertical, ListChecks, Play, Plus, Scissors, Sparkles, Trash2, Upload, Video, X } from 'lucide-react'

type PointPreset = {
  label: string
  result: Clip['pointResult']
  ending: PointEnding
  context?: ShotContext
  tags: string[]
}

type PointScanMode = 'next5' | 'next10' | 'selected' | 'full'
type HighlightQuality = 'draft' | 'standard' | 'high'
type HighlightResolution = '720' | '1080' | 'source'
type HighlightFps = 'source' | '30' | '60'

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

const shotContexts: ShotContext[] = ['serve', 'return', 'rally', 'net', 'passing_shot', 'approach', 'defense', 'attack']

const pointPresets: PointPreset[] = [
  { label: 'Forehand winner', result: 'won', ending: 'forehand_winner', context: 'attack', tags: ['winner', 'forehand'] },
  { label: 'Backhand winner', result: 'won', ending: 'backhand_winner', context: 'attack', tags: ['winner', 'backhand'] },
  { label: 'Volley winner', result: 'won', ending: 'volley_winner', context: 'net', tags: ['winner', 'volley'] },
  { label: 'Opponent error', result: 'won', ending: 'opponent_error', tags: ['opponent error'] },
  { label: 'Unforced long', result: 'lost', ending: 'unforced_long_error', tags: ['unforced error', 'long'] },
  { label: 'Unforced net', result: 'lost', ending: 'unforced_net_error', tags: ['unforced error', 'net'] },
  { label: 'Unforced wide', result: 'lost', ending: 'unforced_wide_error', tags: ['unforced error', 'wide'] },
  { label: 'Forced wide', result: 'lost', ending: 'forced_wide_error', tags: ['forced error', 'wide'] },
  { label: 'Ace', result: 'won', ending: 'ace', context: 'serve', tags: ['serve', 'ace'] },
  { label: 'Double fault', result: 'lost', ending: 'double_fault_net', context: 'serve', tags: ['serve', 'double fault'] },
  { label: 'Missed return', result: 'lost', ending: 'missed_return', context: 'return', tags: ['return', 'missed return'] },
  { label: 'Opponent winner', result: 'lost', ending: 'opponent_winner', tags: ['opponent winner'] },
]

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function moveItemToIndex<T>(items: T[], fromIndex: number, targetIndex: number) {
  if (fromIndex < 0 || targetIndex < 0 || targetIndex >= items.length || fromIndex === targetIndex) return items
  const next = [...items]
  const [item] = next.splice(fromIndex, 1)
  next.splice(targetIndex, 0, item)
  return next
}

function formatMs(ms = 0) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`
}

function friendlyInputTime(ms = 0) {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function inputTime(ms = 0) {
  return (ms / 1000).toFixed(1).replace(/\.0$/, '')
}

function parseTimestamp(value: string) {
  const clean = value.trim()
  if (!clean) return null
  const parts = clean.split(':').map(Number)
  if (parts.some((part) => !Number.isFinite(part) || part < 0)) return null
  if (parts.length === 1) return Math.round(parts[0] * 1000)
  if (parts.length === 2) return Math.round((parts[0] * 60 + parts[1]) * 1000)
  if (parts.length === 3) return Math.round((parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000)
  return null
}

function currentVideoMs(video: HTMLVideoElement | null) {
  return Math.round((video?.currentTime || 0) * 1000)
}

function tagsFromText(value: string) {
  return value.split(',').map((tag) => tag.trim()).filter(Boolean)
}

function label(value?: string) {
  return (value || '').replaceAll('_', ' ')
}

function displayPath(base: string | undefined, fileName: string | undefined) {
  if (!base || !fileName) return ''
  return `${base.replace(/[\\/]+$/, '')}\\${fileName}`
}

function isTextInputTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
}

function shortId(value = '') {
  return value ? value.slice(0, 8) : ''
}

export default function ClipsPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const clipVideoRef = useRef<HTMLVideoElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const spaceHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const spaceHoldActiveRef = useRef(false)
  const projectChoiceInitializedRef = useRef(false)

  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [newProjectName, setNewProjectName] = useState('')
  const [showNewProject, setShowNewProject] = useState(false)
  const [projectStats, setProjectStats] = useState<Record<string, { videos: number; clips: number }>>({})
  const [videos, setVideos] = useState<LocalVideo[]>([])
  const [clips, setClips] = useState<Clip[]>([])
  const [storage, setStorage] = useState<Record<string, string>>({})
  const [localImportPath, setLocalImportPath] = useState('')
  const [selectedVideoId, setSelectedVideoId] = useState('')
  const [selectedClipId, setSelectedClipId] = useState('')
  const [pointCandidates, setPointCandidates] = useState<PointCandidate[]>([])
  const [activeCandidateId, setActiveCandidateId] = useState('')
  const [pointDetectionNote, setPointDetectionNote] = useState('')
  const [pointScanMode, setPointScanMode] = useState<PointScanMode>('next5')
  const [pointDetectionJobs, setPointDetectionJobs] = useState<PointDetectionJob[]>([])
  const [busy, setBusy] = useState(false)
  const [busyLabel, setBusyLabel] = useState('')
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const [exportProgress, setExportProgress] = useState<number | null>(null)
  const [highlightExportJob, setHighlightExportJob] = useState<HighlightExportJob | null>(null)
  const [status, setStatus] = useState('')
  const [statusPath, setStatusPath] = useState('')
  const [error, setError] = useState('')
  const [startMs, setStartMs] = useState<number | null>(null)
  const [endMs, setEndMs] = useState<number | null>(null)
  const [startInput, setStartInput] = useState('')
  const [endInput, setEndInput] = useState('')
  const [title, setTitle] = useState('')
  const [pointResult, setPointResult] = useState<Clip['pointResult']>('unknown')
  const [pointEnding, setPointEnding] = useState<PointEnding>('other')
  const [shotContext, setShotContext] = useState<ShotContext>('rally')
  const [scoreContext, setScoreContext] = useState('')
  const [notes, setNotes] = useState('')
  const [tags, setTags] = useState('')
  const [clipSearch, setClipSearch] = useState('')
  const [highlightClipIds, setHighlightClipIds] = useState<string[]>([])
  const [draggingHighlightClipId, setDraggingHighlightClipId] = useState('')
  const [highlightDropClipId, setHighlightDropClipId] = useState('')
  const [highlightQuality, setHighlightQuality] = useState<HighlightQuality>('standard')
  const [highlightResolution, setHighlightResolution] = useState<HighlightResolution>('720')
  const [highlightFps, setHighlightFps] = useState<HighlightFps>('source')
  const [highlightFade, setHighlightFade] = useState(true)
  const [reelKeyframes, setReelKeyframes] = useState<ReelKeyframe[]>([])
  const [crop, setCrop] = useState(0.5)
  const [clipPreviewMs, setClipPreviewMs] = useState(0)
  const [clipVideoAspect, setClipVideoAspect] = useState({ width: 16, height: 9 })

  const selectedVideo = useMemo(() => videos.find((video) => video.id === selectedVideoId) || videos[0], [selectedVideoId, videos])
  const selectedVideoClips = selectedVideo ? clips.filter((clip) => clip.localVideoId === selectedVideo.id) : []
  const selectedClip = useMemo(() => {
    if (selectedVideo) return selectedVideoClips.find((clip) => clip.id === selectedClipId) || selectedVideoClips[0]
    return clips.find((clip) => clip.id === selectedClipId) || clips[0]
  }, [selectedVideo, selectedClipId, selectedVideoClips, clips])
  const filteredClips = useMemo(() => {
    const search = clipSearch.trim().toLowerCase()
    if (!search) return selectedVideoClips
    return selectedVideoClips.filter((clip) => [
      clip.title,
      clip.pointResult,
      clip.pointEnding,
      clip.shotContext,
      clip.scoreContext,
      clip.technicalNotes,
      clip.aiAnalysis,
      ...clip.tags,
    ].join(' ').toLowerCase().includes(search))
  }, [clipSearch, selectedVideoClips])
  const videoDurationMs = selectedVideo?.durationMs || Math.max(0, ...selectedVideoClips.map((clip) => clip.endMs || 0))
  const clipReady = Boolean(selectedVideo && startMs !== null && endMs !== null && endMs > startMs)
  const reelCropWidthPercent = Math.min(100, (clipVideoAspect.height * 9 / 16 / clipVideoAspect.width) * 100)
  const reelTravelPercent = Math.max(0, 100 - reelCropWidthPercent)
  const reelLeftPercent = clamp(crop, 0, 1) * reelTravelPercent
  const selectedProject = selectedProjectId ? projects.find((project) => project.id === selectedProjectId) : null
  const selectedProjectLabel = selectedProject?.name || 'All projects'
  const selectedProjectStats = projectStats[selectedProjectId || 'all'] || { videos: videos.length, clips: clips.length }
  const isProjectWorkspace = Boolean(selectedProjectId)
  const activePointDetectionJobs = pointDetectionJobs.filter((job) => job.videoId === selectedVideo?.id && (job.status === 'queued' || job.status === 'running'))
  const highlightClipIdSet = useMemo(() => new Set(highlightClipIds), [highlightClipIds])
  const selectedHighlightClips = highlightClipIds.map((id) => selectedVideoClips.find((clip) => clip.id === id)).filter((clip): clip is Clip => Boolean(clip))
  const selectedVideoClipIds = useMemo(
    () => [...selectedVideoClips].sort((a, b) => (a.startMs ?? 0) - (b.startMs ?? 0)).map((clip) => clip.id),
    [selectedVideoClips],
  )
  const selectedVideoClipIdKey = selectedVideoClipIds.join('|')
  const highlightOrder = useMemo(() => new Map(highlightClipIds.map((id, index) => [id, index])), [highlightClipIds])
  const orderedFilteredClips = useMemo(() => [...filteredClips].sort((a, b) => {
    const orderA = highlightOrder.get(a.id)
    const orderB = highlightOrder.get(b.id)
    if (orderA !== undefined && orderB !== undefined) return orderA - orderB
    if (orderA !== undefined) return -1
    if (orderB !== undefined) return 1
    return (a.startMs ?? 0) - (b.startMs ?? 0)
  }), [filteredClips, highlightOrder])
  const activeProgress = uploadProgress ?? exportProgress
  const highlightExportActive = highlightExportJob?.status === 'queued' || highlightExportJob?.status === 'running'

  const resetClipWorkspace = () => {
    setSelectedVideoId('')
    setSelectedClipId('')
    setPointCandidates([])
    setActiveCandidateId('')
    setPointDetectionNote('')
    setPointDetectionJobs([])
    setStartMs(null)
    setEndMs(null)
    setStartInput('')
    setEndInput('')
    setTitle('')
    setScoreContext('')
    setNotes('')
    setTags('')
    setClipSearch('')
    setHighlightClipIds([])
    setReelKeyframes([])
    setStatusPath('')
    setUploadProgress(null)
    setExportProgress(null)
    setHighlightExportJob(null)
  }

  const chooseProject = (projectId: string) => {
    setSelectedProjectId(projectId)
    if (projectId) window.localStorage.setItem('raqet-last-project-id', projectId)
    else window.localStorage.removeItem('raqet-last-project-id')
  }

  const refresh = async () => {
    const [projectData, videoData, clipData, allVideoData, allClipData] = await Promise.all([
      loadProjects(),
      loadVideos(selectedProjectId || undefined),
      loadClips(selectedProjectId || undefined),
      loadVideos(),
      loadClips(),
    ])
    const nextProjects = projectData ?? []
    const nextVideos = videoData?.videos ?? []
    const nextClips = clipData ?? []
    const allVideos = allVideoData?.videos ?? nextVideos
    const allClips = allClipData ?? nextClips
    const stats: Record<string, { videos: number; clips: number }> = {
      all: { videos: allVideos.length, clips: allClips.length },
    }
    for (const project of nextProjects) {
      stats[project.id] = {
        videos: allVideos.filter((video) => video.projectId === project.id).length,
        clips: allClips.filter((clip) => clip.projectId === project.id).length,
      }
    }
    if (!projectChoiceInitializedRef.current && !selectedProjectId && nextProjects.length > 0) {
      projectChoiceInitializedRef.current = true
      const storedProjectId = window.localStorage.getItem('raqet-last-project-id')
      const storedProject = storedProjectId ? nextProjects.find((project) => project.id === storedProjectId) : undefined
      const contentProject = nextProjects.find((project) => (stats[project.id]?.videos ?? 0) > 0 || (stats[project.id]?.clips ?? 0) > 0)
      const nextProject = storedProject ?? contentProject ?? nextProjects[0]
      if (nextProject) {
        setSelectedProjectId(nextProject.id)
        return
      }
    }
    projectChoiceInitializedRef.current = true
    setProjects(nextProjects)
    setProjectStats(stats)
    setVideos(nextVideos)
    setStorage(videoData?.storage ?? {})
    setClips(nextClips)
    if (!selectedVideoId && nextVideos[0]) setSelectedVideoId(nextVideos[0].id)
    if (!selectedClipId && nextClips[0]) setSelectedClipId(nextClips[0].id)
  }

  useEffect(() => {
    resetClipWorkspace()
    refresh().catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Clip workspace could not load.'))
  }, [selectedProjectId])

  useEffect(() => {
    setPointCandidates([])
    setActiveCandidateId('')
    setPointDetectionNote('')
    setStartMs(null)
    setEndMs(null)
    setStartInput('')
    setEndInput('')
    setSelectedClipId('')
  }, [selectedVideo?.id])

  useEffect(() => {
    setHighlightClipIds(selectedVideoClipIds)
  }, [selectedVideo?.id, selectedVideoClipIdKey])

  useEffect(() => {
    if (!selectedVideo) return
    let cancelled = false
    loadPointDetectionJobs(selectedVideo.id).then((jobs) => {
      if (cancelled) return
      const activeJobs = jobs.filter((job) => job.status === 'queued' || job.status === 'running')
      if (activeJobs.length === 0) return
      setPointDetectionJobs((prev) => {
        const byId = new Map(prev.map((job) => [job.id, job]))
        for (const job of activeJobs) byId.set(job.id, job)
        return Array.from(byId.values()).slice(0, 8)
      })
    }).catch(() => null)
    return () => {
      cancelled = true
    }
  }, [selectedVideo?.id])

  useEffect(() => {
    if (!highlightExportJob || (highlightExportJob.status !== 'queued' && highlightExportJob.status !== 'running')) return

    let cancelled = false
    const poll = async () => {
      try {
        const job = await loadHighlightExportJob(highlightExportJob.id)
        if (cancelled) return
        setHighlightExportJob(job)
        setExportProgress(Math.round(job.progressPercent || 0))
        if (job.status === 'completed' && job.result) {
          setBusy(false)
          setBusyLabel('')
          setExportProgress(null)
          setStatus(`Created highlight video from ${job.result.clipCount} clips (${Math.round(job.result.durationSeconds)}s).`)
          setStatusPath(job.result.outputPath)
        }
        if (job.status === 'failed') {
          setBusy(false)
          setBusyLabel('')
          setExportProgress(null)
          setError(job.error || 'Highlight export failed.')
        }
      } catch (jobError) {
        if (cancelled) return
        setBusy(false)
        setBusyLabel('')
        setExportProgress(null)
        setError(jobError instanceof Error ? jobError.message : 'Highlight export job check failed.')
      }
    }

    poll()
    const interval = window.setInterval(poll, 1500)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [highlightExportJob])

  useEffect(() => {
    const setPlaybackRate = (rate: number) => {
      if (videoRef.current) videoRef.current.playbackRate = rate
    }

    const clearSpaceHoldTimer = () => {
      if (!spaceHoldTimerRef.current) return
      clearTimeout(spaceHoldTimerRef.current)
      spaceHoldTimerRef.current = null
    }

    const resetPlaybackRate = () => {
      clearSpaceHoldTimer()
      spaceHoldActiveRef.current = false
      setPlaybackRate(1)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      const isEnterKey = event.key === 'Enter' || event.code === 'Enter' || event.code === 'NumpadEnter'
      const isSpaceKey = event.key === ' ' || event.key === 'Spacebar' || event.code === 'Space'
      if (isTextInputTarget(event.target)) return
      if (event.key === '[') {
        event.preventDefault()
        markStart()
      }
      if (event.key === ']') {
        event.preventDefault()
        markEnd()
      }
      if (event.key.toLowerCase() === 's') {
        event.preventDefault()
        const activeCandidate = pointCandidates.find((candidate) => candidate.id === activeCandidateId)
        if (activeCandidate) acceptCandidate(activeCandidate)
        else savePoint(false)
      }
      if (event.key === 'ArrowLeft' && videoRef.current) {
        event.preventDefault()
        videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 5)
      }
      if (event.key === 'ArrowRight' && videoRef.current) {
        event.preventDefault()
        videoRef.current.currentTime = videoRef.current.currentTime + 5
      }
      if (isEnterKey && videoRef.current) {
        event.preventDefault()
        setPlaybackRate(2)
      }
      if (isSpaceKey && videoRef.current) {
        event.preventDefault()
        if (event.repeat || spaceHoldTimerRef.current || spaceHoldActiveRef.current) return
        spaceHoldTimerRef.current = setTimeout(() => {
          spaceHoldTimerRef.current = null
          spaceHoldActiveRef.current = true
          setPlaybackRate(2)
          playSource()
        }, 180)
      }
    }

    const onKeyUp = (event: KeyboardEvent) => {
      const isEnterKey = event.key === 'Enter' || event.code === 'Enter' || event.code === 'NumpadEnter'
      const isSpaceKey = event.key === ' ' || event.key === 'Spacebar' || event.code === 'Space'
      if (isTextInputTarget(event.target)) return
      if (isEnterKey) setPlaybackRate(1)
      if (isSpaceKey && videoRef.current) {
        event.preventDefault()
        if (spaceHoldActiveRef.current) {
          resetPlaybackRate()
          return
        }
        clearSpaceHoldTimer()
        if (videoRef.current.paused) playSource()
        else videoRef.current.pause()
      }
    }

    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('keyup', onKeyUp, true)
    window.addEventListener('blur', resetPlaybackRate)
    return () => {
      resetPlaybackRate()
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('keyup', onKeyUp, true)
      window.removeEventListener('blur', resetPlaybackRate)
    }
  }, [selectedVideo, startMs, endMs, title, pointResult, pointEnding, shotContext, scoreContext, notes, tags, activeCandidateId, pointCandidates])

  useEffect(() => {
    if (!selectedClip) return
    setReelKeyframes(selectedClip.reelKeyframes || [])
  }, [selectedClip?.id])

  const handleImport = async (file: File | null) => {
    if (!file) return
    const knownVideoIds = new Set(videos.map((video) => video.id))
    setBusy(true)
    setBusyLabel(`Importing ${file.name} into ${selectedProjectLabel}...`)
    setUploadProgress(0)
    setError('')
    setStatus('')
    setStatusPath('')
    try {
      const video = await importVideo(file, '', selectedProjectId, setUploadProgress)
      await refresh()
      setSelectedVideoId(video.id)
      setStatus(`Video imported into ${selectedProjectLabel}.`)
      setStatusPath(displayPath(storage.sourceVideos, video.storedFileName))
    } catch (importError) {
      const message = importError instanceof Error ? importError.message : 'Video import failed.'
      try {
        const videoData = await loadVideos(selectedProjectId || undefined)
        const recoveredVideo = (videoData?.videos ?? []).find((video) => !knownVideoIds.has(video.id))
        if (recoveredVideo) {
          await refresh()
          setSelectedVideoId(recoveredVideo.id)
          setError('')
          setStatus(`Video imported into ${selectedProjectLabel}. The browser connection closed before it could confirm, but the file is saved.`)
          setStatusPath(displayPath(videoData?.storage?.sourceVideos ?? storage.sourceVideos, recoveredVideo.storedFileName))
          return
        }
      } catch {
        // Keep the original import error.
      }
      setError(message)
    } finally {
      setBusy(false)
      setBusyLabel('')
      setUploadProgress(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleImportFromPath = async () => {
    const filePath = localImportPath.trim()
    if (!filePath) return
    if (!selectedProjectId) {
      setError('Choose a project before importing a source video.')
      return
    }
    setBusy(true)
    setBusyLabel(`Copying local video into ${selectedProjectLabel}...`)
    setError('')
    setStatus('')
    setStatusPath('')
    setUploadProgress(null)
    try {
      const video = await importVideoFromPath(filePath, '', selectedProjectId)
      await refresh()
      setSelectedVideoId(video.id)
      setLocalImportPath('')
      setStatus(`Video imported into ${selectedProjectLabel}.`)
      setStatusPath(displayPath(storage.sourceVideos, video.storedFileName))
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Local video import failed.')
    } finally {
      setBusy(false)
      setBusyLabel('')
    }
  }

  const createPlaybackProxyForSelectedVideo = async () => {
    if (!selectedVideo) return
    setBusy(true)
    setBusyLabel('Creating browser playback proxy...')
    setError('')
    setStatus('')
    setStatusPath('')
    try {
      const updated = await createVideoPlaybackProxy(selectedVideo.id)
      await refresh()
      setSelectedVideoId(updated.id)
      setStatus('Browser playback proxy created. The player will use the MP4 proxy now.')
      setStatusPath(displayPath(storage.sourceVideos?.replace(/sources$/, 'proxies'), updated.playbackProxyStoredFileName))
      videoRef.current?.load()
    } catch (proxyError) {
      setError(proxyError instanceof Error ? proxyError.message : 'Playback proxy creation failed.')
    } finally {
      setBusy(false)
      setBusyLabel('')
    }
  }

  const handleCreateProject = async () => {
    const name = newProjectName.trim()
    if (!name) return
    setBusy(true)
    setBusyLabel('Creating project...')
    setError('')
    try {
      const project = await createProject(name)
      await refresh()
      chooseProject(project.id)
      setNewProjectName('')
      setShowNewProject(false)
      setStatus(`Project "${project.name}" created.`)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Project creation failed.')
    } finally {
      setBusy(false)
      setBusyLabel('')
    }
  }

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('Delete this project? Videos and clips inside it will stay in storage but will no longer be grouped.')) return
    setBusy(true)
    setBusyLabel('Deleting project...')
    setError('')
    try {
      await deleteProject(projectId)
      if (selectedProjectId === projectId) {
        window.localStorage.removeItem('raqet-last-project-id')
        projectChoiceInitializedRef.current = false
        setSelectedProjectId('')
      }
      await refresh()
      setStatus('Project deleted.')
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Project delete failed.')
    } finally {
      setBusy(false)
      setBusyLabel('')
    }
  }

  const markStart = () => {
    const next = currentVideoMs(videoRef.current)
    setStartMs(next)
    setStartInput(inputTime(next))
    if (activeCandidateId) updateCandidate(activeCandidateId, { startMs: next })
  }

  const markEnd = () => {
    const next = currentVideoMs(videoRef.current)
    setEndMs(next)
    setEndInput(inputTime(next))
    if (activeCandidateId) updateCandidate(activeCandidateId, { endMs: next })
  }

  const updateStartFromInput = (value: string) => {
    setStartInput(value)
    const parsed = parseTimestamp(value)
    if (parsed !== null) setStartMs(parsed)
  }

  const updateEndFromInput = (value: string) => {
    setEndInput(value)
    const parsed = parseTimestamp(value)
    if (parsed !== null) setEndMs(parsed)
  }

  const unmuteSourcePlayer = () => {
    if (!videoRef.current) return
    videoRef.current.muted = false
    videoRef.current.defaultMuted = false
    videoRef.current.volume = 1
  }

  const playSource = () => {
    if (!videoRef.current) return
    unmuteSourcePlayer()
    videoRef.current.playbackRate = 1
    videoRef.current.play().catch(() => null)
  }

  const seekSource = (ms: number) => {
    if (!videoRef.current) return
    videoRef.current.currentTime = Math.max(0, ms / 1000)
    playSource()
  }

  const applyPreset = (preset: PointPreset) => {
    setPointResult(preset.result)
    setPointEnding(preset.ending)
    if (preset.context) setShotContext(preset.context)
    setTags(Array.from(new Set([...tagsFromText(tags), ...preset.tags])).join(', '))
    if (!title) setTitle(preset.label)
  }

  const makeClip = (): Clip => {
    if (!selectedVideo || startMs === null || endMs === null) throw new Error('Mark a valid start and end before saving.')
    return {
      id: crypto.randomUUID(),
      sessionId: '',
      playerId: 'solo',
      projectId: selectedVideo.projectId || selectedProjectId || undefined,
      localVideoId: selectedVideo.id,
      startMs,
      endMs,
      title: title || `Point ${formatMs(startMs)}`,
      videoUrl: `/api/videos/${selectedVideo.id}/file`,
      thumbnailUrl: '',
      durationSeconds: Math.max(1, Math.round((endMs - startMs) / 1000)),
      clipType: shotContext === 'serve' ? 'serve' : shotContext === 'return' ? 'return' : pointResult === 'won' ? 'winner' : pointResult === 'lost' ? 'error' : 'rally',
      pointResult,
      pointEnding,
      shotContext,
      scoreContext: scoreContext || undefined,
      technicalNotes: notes || undefined,
      decisionQuality: 0,
      contentScore: 0,
      suggestedUse: 'analysis',
      tags: tagsFromText(tags),
      events: [],
      reelKeyframes: [],
      createdAt: new Date().toISOString(),
    }
  }

  const makeClipFromCandidate = (candidate: PointCandidate): Clip => {
    if (!selectedVideo) throw new Error('Choose a source video before saving a candidate.')
    return {
      id: crypto.randomUUID(),
      sessionId: '',
      playerId: 'solo',
      projectId: selectedVideo.projectId || selectedProjectId || undefined,
      localVideoId: selectedVideo.id,
      startMs: candidate.startMs,
      endMs: candidate.endMs,
      title: candidate.title || `Point ${formatMs(candidate.startMs)}`,
      videoUrl: `/api/videos/${selectedVideo.id}/file`,
      thumbnailUrl: '',
      durationSeconds: Math.max(1, Math.round((candidate.endMs - candidate.startMs) / 1000)),
      clipType: 'rally',
      pointResult: 'unknown',
      pointEnding: 'other',
      shotContext: 'rally',
      technicalNotes: `Auto point candidate (${Math.round(candidate.confidence * 100)}%): ${candidate.reason}`,
      decisionQuality: 0,
      contentScore: 0,
      suggestedUse: 'analysis',
      tags: ['auto-point'],
      events: [],
      reelKeyframes: [],
      createdAt: new Date().toISOString(),
    }
  }

  const updateCandidate = (id: string, patch: Partial<PointCandidate>) => {
    setPointCandidates((prev) => prev.map((candidate) => candidate.id === id ? { ...candidate, ...patch } : candidate))
  }

  const previewCandidate = (candidate: PointCandidate) => {
    setActiveCandidateId(candidate.id)
    setStartMs(candidate.startMs)
    setEndMs(candidate.endMs)
    setStartInput(inputTime(candidate.startMs))
    setEndInput(inputTime(candidate.endMs))
    if (!title) setTitle(candidate.title)
    seekSource(candidate.startMs)
  }

  useEffect(() => {
    if (!selectedVideo) return
    const activeJobs = pointDetectionJobs.filter((job) => job.videoId === selectedVideo.id && (job.status === 'queued' || job.status === 'running'))
    if (activeJobs.length === 0) return

    let cancelled = false
    const poll = async () => {
      const updates = await Promise.all(activeJobs.map(async (job) => {
        try {
          return await loadPointDetectionJob(job.videoId, job.id)
        } catch (jobError) {
          return { ...job, status: 'failed' as const, error: jobError instanceof Error ? jobError.message : 'Point detection job check failed.' }
        }
      }))
      if (cancelled) return

      const completed = updates.filter((job) => job.status === 'completed' && job.result)
      const failed = updates.filter((job) => job.status === 'failed')
      setPointDetectionJobs((prev) => prev.map((job) => updates.find((update) => update.id === job.id) ?? job))
      if (completed.length > 0) {
        const candidates = completed.flatMap((job) => job.result?.candidates ?? [])
        setPointCandidates((prev) => [...prev, ...candidates])
        const last = completed[completed.length - 1].result
        if (last) {
          setPointDetectionNote([last.heuristic, last.warning].filter(Boolean).join(' '))
          setStatus(`Background scan finished: found ${candidates.length} point candidates from ${formatMs(last.analyzedStartMs)} to ${formatMs(last.analyzedEndMs)}.`)
        }
      }
      if (failed.length > 0) {
        setError(failed.map((job) => job.error || 'Point detection failed.').join(' '))
      }
    }

    poll()
    const interval = window.setInterval(poll, 2500)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [pointDetectionJobs, selectedVideo])

  const findPointsInSelectedVideo = async () => {
    if (!selectedVideo) {
      setError('Import or select a source video before finding points.')
      return
    }
    const playheadMs = Math.max(0, Math.round((videoRef.current?.currentTime || 0) * 1000))
    const rangeStartMs = pointScanMode === 'selected' ? startMs ?? playheadMs : pointScanMode === 'full' ? 0 : playheadMs
    const rangeEndMs = pointScanMode === 'selected'
      ? endMs !== null && endMs > rangeStartMs ? endMs : undefined
      : pointScanMode === 'full'
        ? undefined
        : rangeStartMs + (pointScanMode === 'next10' ? 10 : 5) * 60 * 1000
    const maxDurationMs = pointScanMode === 'full' ? Math.max(5 * 60 * 1000, videoDurationMs || 5 * 60 * 1000) : (rangeEndMs ? rangeEndMs - rangeStartMs : 5 * 60 * 1000)
    if (pointScanMode === 'selected' && !rangeEndMs) {
      setError('Mark both start and end before scanning the selected range.')
      return
    }
    setBusy(true)
    setBusyLabel('Starting background point scan...')
    setError('')
    setStatus('')
    setStatusPath('')
    try {
      const job = await startPointDetection(selectedVideo.id, {
        startMs: rangeStartMs,
        endMs: rangeEndMs,
        maxDurationMs,
      })
      setPointDetectionJobs((prev) => [job, ...prev].slice(0, 8))
      setStatus(`Background scan started from ${formatMs(rangeStartMs)}${rangeEndMs ? ` to ${formatMs(rangeEndMs)}` : ' to the end'}. You can keep watching while it runs.`)
    } catch (detectionError) {
      setError(detectionError instanceof Error ? detectionError.message : 'Point detection failed.')
    } finally {
      setBusy(false)
      setBusyLabel('')
    }
  }

  const stopPointDetectionJob = async (job: PointDetectionJob) => {
    setError('')
    try {
      const stoppedJob = await cancelPointDetectionJob(job.videoId, job.id)
      setPointDetectionJobs((prev) => prev.map((item) => item.id === stoppedJob.id ? stoppedJob : item))
      setStatus(`Background scan stopped: ${formatMs(stoppedJob.startMs)} to ${formatMs(stoppedJob.endMs ?? stoppedJob.startMs + stoppedJob.maxDurationMs)}.`)
    } catch (stopError) {
      setError(stopError instanceof Error ? stopError.message : 'Point detection stop failed.')
    }
  }

  const acceptCandidate = async (candidate: PointCandidate) => {
    if (candidate.endMs <= candidate.startMs) {
      setError('Candidate end must be after start.')
      return
    }
    setBusy(true)
    setBusyLabel('Saving point candidate as a clip...')
    setError('')
    setStatus('')
    setStatusPath('')
    try {
      const saved = await createClip(makeClipFromCandidate(candidate))
      if (!saved) throw new Error('Clip metadata save returned no clip.')
      await refresh()
      setSelectedClipId(saved.id)
      setPointCandidates((prev) => prev.filter((item) => item.id !== candidate.id))
      if (activeCandidateId === candidate.id) setActiveCandidateId('')
      setStatus('Point candidate saved as a normal clip.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Candidate save failed.')
    } finally {
      setBusy(false)
      setBusyLabel('')
    }
  }

  const acceptAllCandidates = async () => {
    if (!selectedVideo || pointCandidates.length === 0) return
    const validCandidates = pointCandidates.filter((candidate) => candidate.endMs > candidate.startMs)
    if (validCandidates.length === 0) {
      setError('No valid point candidates to save.')
      return
    }
    setBusy(true)
    setBusyLabel(`Saving ${validCandidates.length} point candidates...`)
    setError('')
    setStatus('')
    setStatusPath('')
    try {
      let lastSavedId = ''
      for (const candidate of validCandidates) {
        const saved = await createClip(makeClipFromCandidate(candidate))
        if (saved) lastSavedId = saved.id
      }
      await refresh()
      if (lastSavedId) setSelectedClipId(lastSavedId)
      setPointCandidates([])
      setActiveCandidateId('')
      setStatus(`Saved ${validCandidates.length} point candidates as normal clips.`)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Candidates save failed.')
    } finally {
      setBusy(false)
      setBusyLabel('')
    }
  }

  const savePoint = async (exportAfter: boolean) => {
    if (!clipReady) {
      setError(!selectedVideo ? 'Import a video before clipping.' : 'Mark a valid start and end before saving.')
      return
    }
    setBusy(true)
    setBusyLabel(exportAfter ? 'Saving point metadata and exporting clip with ffmpeg...' : 'Saving point metadata locally...')
    setError('')
    setStatus('')
    setStatusPath('')
    try {
      const saved = await createClip(makeClip())
      if (!saved) throw new Error('Clip metadata save returned no clip.')
      const finalClip = exportAfter ? await exportClip(saved.id) : saved
      await refresh()
      setSelectedClipId(finalClip?.id || saved.id)
      setStatus(exportAfter ? 'Point saved and exported with ffmpeg.' : 'Point metadata saved locally. Source video was not sent to AI.')
      setStatusPath(exportAfter ? finalClip?.exportedClipPath || '' : '')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Clip save failed.')
    } finally {
      setBusy(false)
      setBusyLabel('')
    }
  }

  const exportSelectedClip = async () => {
    if (!selectedClip) return
    setBusy(true)
    setBusyLabel('Exporting selected clip with ffmpeg...')
    setError('')
    setStatus('')
    setStatusPath('')
    try {
      const exported = await exportClip(selectedClip.id)
      await refresh()
      setSelectedClipId(exported.id)
      setStatus('Clip exported with ffmpeg.')
      setStatusPath(exported.exportedClipPath || '')
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Clip export failed.')
    } finally {
      setBusy(false)
      setBusyLabel('')
    }
  }

  const exportCurrentProjectClips = async () => {
    if (clips.length === 0) return
    setBusy(true)
    setBusyLabel(`Exporting ${clips.length} clips from ${selectedProjectLabel} with ffmpeg...`)
    setError('')
    setStatus('')
    setStatusPath('')
    try {
      const result = await exportClips(selectedProjectId || undefined)
      await refresh()
      const failedCount = result.failed.length
      setStatus(failedCount > 0 ? `Exported ${result.exportedCount} clips. ${failedCount} clips failed.` : `Exported ${result.exportedCount} clips from ${selectedProjectLabel}.`)
      setStatusPath(result.clips[0]?.exportedClipPath || storage.exportedClips || '')
      if (failedCount > 0) {
        setError(result.failed.slice(0, 3).map((item) => `${item.title}: ${item.error}`).join(' '))
      }
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Batch export failed.')
    } finally {
      setBusy(false)
      setBusyLabel('')
    }
  }

  const toggleHighlightClip = (clipId: string) => {
    setHighlightClipIds((prev) => {
      if (prev.includes(clipId)) return prev.filter((id) => id !== clipId)
      const clip = selectedVideoClips.find((item) => item.id === clipId)
      const next = [...prev, clipId]
      if (!clip) return next
      return next.sort((a, b) => {
        const clipA = selectedVideoClips.find((item) => item.id === a)
        const clipB = selectedVideoClips.find((item) => item.id === b)
        return (clipA?.startMs ?? 0) - (clipB?.startMs ?? 0)
      })
    })
  }

  const moveHighlightClip = (clipId: string, direction: -1 | 1) => {
    setHighlightClipIds((prev) => {
      const index = prev.indexOf(clipId)
      return moveItemToIndex(prev, index, index + direction)
    })
  }

  const moveHighlightClipToIndex = (clipId: string, targetIndex: number) => {
    setHighlightClipIds((prev) => {
      const index = prev.indexOf(clipId)
      return moveItemToIndex(prev, index, targetIndex)
    })
  }

  const moveHighlightClipToClip = (clipId: string, targetClipId: string) => {
    setHighlightClipIds((prev) => {
      const index = prev.indexOf(clipId)
      const targetIndex = prev.indexOf(targetClipId)
      return moveItemToIndex(prev, index, targetIndex)
    })
  }

  const startHighlightDrag = (event: DragEvent<HTMLButtonElement>, clipId: string) => {
    if (busy) {
      event.preventDefault()
      return
    }
    setDraggingHighlightClipId(clipId)
    setHighlightDropClipId(clipId)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', clipId)
  }

  const allowHighlightDrop = (event: DragEvent<HTMLDivElement>, clipId: string) => {
    const draggedClipId = draggingHighlightClipId || event.dataTransfer.getData('text/plain')
    if (!draggedClipId || draggedClipId === clipId) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setHighlightDropClipId(clipId)
  }

  const dropHighlightClip = (event: DragEvent<HTMLDivElement>, targetClipId: string) => {
    event.preventDefault()
    const clipId = event.dataTransfer.getData('text/plain') || draggingHighlightClipId
    if (clipId && clipId !== targetClipId) moveHighlightClipToClip(clipId, targetClipId)
    setDraggingHighlightClipId('')
    setHighlightDropClipId('')
  }

  const endHighlightDrag = () => {
    setDraggingHighlightClipId('')
    setHighlightDropClipId('')
  }

  const resetHighlightOrder = () => {
    setHighlightClipIds((prev) => selectedVideoClipIds.filter((id) => prev.includes(id)))
  }

  const reverseHighlightOrder = () => {
    setHighlightClipIds((prev) => [...prev].reverse())
  }

  const exportCurrentHighlight = async () => {
    if (!selectedVideo || selectedHighlightClips.length === 0) return
    setBusy(true)
    setBusyLabel(`Exporting highlight video from ${selectedHighlightClips.length} clips...`)
    setExportProgress(0)
    setError('')
    setStatus('')
    setStatusPath('')
    try {
      const job = await startHighlightExport({
        projectId: selectedProjectId || undefined,
        localVideoId: selectedVideo.id,
        clipIds: selectedHighlightClips.map((clip) => clip.id),
        fade: highlightFade,
        quality: highlightQuality,
        resolution: highlightResolution,
        fps: highlightFps,
      })
      setHighlightExportJob(job)
    } catch (highlightError) {
      setBusy(false)
      setBusyLabel('')
      setExportProgress(null)
      setError(highlightError instanceof Error ? highlightError.message : 'Highlight export failed.')
    }
  }

  const addReelKeyframe = () => {
    setReelKeyframes((prev) => [
      ...prev.filter((item) => Math.abs(item.timestampMs - clipPreviewMs) > 250),
      { id: crypto.randomUUID(), timestampMs: clipPreviewMs, xPercent: crop },
    ].sort((a, b) => a.timestampMs - b.timestampMs))
  }

  const exportSelectedReel = async () => {
    if (!selectedClip) return
    setBusy(true)
    setBusyLabel('Exporting 9:16 reel with ffmpeg...')
    setError('')
    setStatus('')
    setStatusPath('')
    try {
      const exported = await exportReel(selectedClip.id, reelKeyframes)
      await updateClip({ ...exported, reelKeyframes })
      await refresh()
      setSelectedClipId(exported.id)
      setStatus('9:16 reel exported with manual crop interpolation.')
      setStatusPath(exported.exportedReelPath || '')
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Reel export failed.')
    } finally {
      setBusy(false)
      setBusyLabel('')
    }
  }

  const analyzeSelectedClip = async () => {
    if (!selectedClip) return
    setBusy(true)
    setBusyLabel('Analyzing selected exported clip...')
    setError('')
    setStatus('')
    setStatusPath('')
    try {
      const analyzed = await analyzeSavedClip(selectedClip.id)
      await refresh()
      setSelectedClipId(analyzed.id)
      setStatus('Selected exported clip was analyzed. The source video was not sent.')
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : 'Selected clip analysis failed.')
    } finally {
      setBusy(false)
      setBusyLabel('')
    }
  }

  const removeSelectedClip = async (clip: Clip) => {
    await deleteClip(clip.id)
    setClips((prev) => prev.filter((item) => item.id !== clip.id))
    if (selectedClipId === clip.id) setSelectedClipId('')
    setStatus('Clip metadata deleted. Source video and exported files were left in storage.')
  }

  const removeSourceVideo = async (video: LocalVideo) => {
    if (!confirm(`Delete "${video.fileName}" from local source storage? Saved clip metadata and exported clips will be kept.`)) return
    setBusy(true)
    setBusyLabel('Deleting source video...')
    setError('')
    setStatus('')
    setStatusPath('')
    try {
      await deleteVideo(video.id)
      if (selectedVideoId === video.id) {
        setSelectedVideoId('')
        setSelectedClipId('')
        setPointCandidates([])
        setPointDetectionNote('')
      }
      await refresh()
      setStatus('Source video deleted from local storage. Existing clip metadata and exports were kept.')
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Source video delete failed.')
    } finally {
      setBusy(false)
      setBusyLabel('')
    }
  }

  const showStatusFileLocation = async () => {
    if (!statusPath) return
    try {
      await showFileLocation(statusPath)
    } catch (locationError) {
      setError(locationError instanceof Error ? locationError.message : 'Could not open file location.')
    }
  }

  return (
    <AppShell title="Video Review" subtitle="Local point clipping, metadata, and reel exports">
      <PageHeader title="Video Review" subtitle={`${videos.length} videos, ${clips.length} clips`} />

      <div className="mb-4 rounded-lg border border-border bg-surface px-4 py-3 text-sm leading-6 text-muted shadow-card">
        Source videos stay in local app storage. AI is optional and only receives exported short clips after explicit action.
      </div>

      {error && <p className="mb-4 rounded-lg border border-danger/20 bg-danger/5 p-3 text-sm text-danger">{error}</p>}
      {(busyLabel || status) && (
        <div className="mb-4 rounded-lg border border-accent/20 bg-accent-light p-3 text-sm text-foreground">
          {busyLabel ? (
            <div>
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                <span>{busyLabel}</span>
                {activeProgress !== null && <span className="ml-auto font-semibold text-accent">{activeProgress}%</span>}
              </div>
              {activeProgress !== null && (
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-background">
                  <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${activeProgress}%` }} />
                </div>
              )}
            </div>
          ) : (
            <p>{status}</p>
          )}
          {statusPath && (
            <button type="button" onClick={showStatusFileLocation} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-accent/30 bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-muted">
              <FolderOpen className="h-4 w-4" />
              Show file location
            </button>
          )}
        </div>
      )}

      <div className="mb-4 rounded-card border border-border bg-surface p-4 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-label text-muted">Workspace</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 className="truncate font-display text-2xl font-bold text-foreground">{selectedProjectLabel}</h2>
              {selectedProjectId && <span className="rounded-full border border-border bg-background px-2 py-1 text-xs font-semibold text-muted">Project {shortId(selectedProjectId)}</span>}
            </div>
            <p className="mt-2 text-sm text-muted">
              {isProjectWorkspace ? `Working inside ${selectedProjectLabel}. Imports, clips, point detection, and exports are scoped here.` : 'Global library view. Choose or create a project before importing match footage.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold text-muted">
            <span className="rounded-full border border-border bg-background px-2 py-1">{selectedProjectStats.videos} videos</span>
            <span className="rounded-full border border-border bg-background px-2 py-1">{selectedProjectStats.clips} clips</span>
          </div>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => chooseProject('')}
            className={`min-w-[180px] rounded-lg border px-3 py-2 text-left text-sm ${!selectedProjectId ? 'border-accent bg-accent-light text-foreground' : 'border-border bg-background text-muted hover:bg-surface-muted'}`}
          >
            <span className="block font-semibold">All projects</span>
            <span className="text-xs">{projectStats.all?.videos ?? 0} videos - {projectStats.all?.clips ?? 0} clips</span>
          </button>
          {projects.map((project) => {
            const stats = projectStats[project.id] || { videos: 0, clips: 0 }
            return (
              <button
                key={project.id}
                type="button"
                onClick={() => chooseProject(project.id)}
                className={`min-w-[180px] rounded-lg border px-3 py-2 text-left text-sm ${selectedProjectId === project.id ? 'border-accent bg-accent-light text-foreground' : 'border-border bg-background text-muted hover:bg-surface-muted'}`}
              >
                <span className="block truncate font-semibold">{project.name}</span>
                <span className="text-xs">{stats.videos} videos - {stats.clips} clips</span>
              </button>
            )
          })}
        </div>
        <div className="hidden">
        <div className="grid gap-4 lg:grid-cols-[minmax(260px,1fr)_auto] lg:items-end">
          <label className="grid gap-1">
            <p className="text-xs font-bold uppercase tracking-label text-muted">Project</p>
            <select
              value={selectedProjectId}
              onChange={(event) => chooseProject(event.target.value)}
              className="h-11 w-full min-w-0 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground"
            >
              <option value="">All projects ({projectStats.all?.clips ?? clips.length} clips)</option>
              {projects.map((project) => {
                const stats = projectStats[project.id] || { videos: 0, clips: 0 }
                return <option key={project.id} value={project.id}>{project.name} ({stats.clips} clips)</option>
              })}
            </select>
            <span className="text-xs text-muted">{selectedProjectStats.videos} videos · {selectedProjectStats.clips} clips in this view</span>
          </label>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={exportCurrentProjectClips} disabled={busy || clips.length === 0} className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2.5 text-sm font-medium text-white disabled:opacity-50">
              <Download className="h-4 w-4" />
              Export all clips
            </button>
            <button type="button" onClick={() => setShowNewProject(true)} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-medium text-foreground hover:bg-surface-muted disabled:opacity-50">
              <Plus className="h-4 w-4" />
              New project
            </button>
            {selectedProjectId && (
              <button type="button" onClick={() => handleDeleteProject(selectedProjectId)} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-danger/30 px-3 py-2.5 text-sm font-medium text-danger hover:bg-danger/10 disabled:opacity-50">
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            )}
          </div>
        </div>
        </div>
        {showNewProject && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} placeholder="Project name..." className="w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm sm:w-64" />
            <button type="button" onClick={handleCreateProject} disabled={busy || !newProjectName.trim()} className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Create</button>
            <button type="button" onClick={() => { setShowNewProject(false); setNewProjectName('') }} className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-muted">Cancel</button>
          </div>
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="space-y-4">
          <div className="rounded-card border border-border bg-surface p-4 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-label text-muted">Source video</p>
                <h2 className="font-display text-xl font-bold text-foreground">{selectedVideo?.fileName || (isProjectWorkspace ? `No videos in ${selectedProjectLabel}` : 'Choose a project to import video')}</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={busy || !isProjectWorkspace} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">
                  {busyLabel.startsWith('Importing') ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Upload className="h-4 w-4" />}
                  {busyLabel.startsWith('Importing') ? 'Importing...' : 'Import Video'}
                </button>
                <input ref={fileInputRef} type="file" accept="video/mp4,video/mov,video/quicktime,video/mpeg,video/webm" className="hidden" onChange={(event) => handleImport(event.target.files?.[0] ?? null)} />
              </div>
            </div>

            {isProjectWorkspace && (
              <div className="mt-4 border-t border-border pt-4">
                <p className="text-xs font-bold uppercase tracking-label text-muted">Large local file import</p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input
                    value={localImportPath}
                    onChange={(event) => setLocalImportPath(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') handleImportFromPath()
                    }}
                    placeholder="C:/Users/juans/Videos/match.mov"
                    className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                  />
                  <button type="button" onClick={handleImportFromPath} disabled={busy || !localImportPath.trim()} className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-muted disabled:opacity-50">
                    <FolderOpen className="h-4 w-4" />
                    Import path
                  </button>
                </div>
                <p className="mt-2 text-xs text-muted">Use this for 8GB+ videos. Paste the full local path from Windows Explorer; quoted paths are ok.</p>
              </div>
            )}

            {videos.length > 0 && (
              <div className="mt-4 flex gap-2 overflow-x-auto border-t border-border pt-4">
                {videos.map((video) => (
                  <div
                    key={video.id}
                    className={`flex min-w-[250px] items-start justify-between gap-2 px-3 py-2 text-sm ${selectedVideo?.id === video.id ? 'bg-accent-light text-foreground' : 'text-muted hover:bg-background'}`}
                  >
                    <button type="button" onClick={() => setSelectedVideoId(video.id)} className="min-w-0 flex-1 text-left">
                      <span className="block truncate font-semibold">{video.fileName}</span>
                      <span className="text-xs">{video.durationMs ? formatMs(video.durationMs) : 'Duration unknown'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeSourceVideo(video)}
                      disabled={busy}
                      title="Delete source video"
                      aria-label={`Delete source video ${video.fileName}`}
                      className="rounded border border-danger/30 p-1.5 text-danger hover:bg-danger/10 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-card border border-border bg-black shadow-card">
            {selectedVideo ? (
              <video
                key={`${selectedVideo.id}-${selectedVideo.playbackProxyStoredFileName || 'source'}`}
                ref={videoRef}
                src={`/api/videos/${selectedVideo.id}/file`}
                controls
                className="aspect-video w-full bg-black"
                onError={() => {
                  setError('The browser could not play this source video. Create a browser playback proxy for this MOV/HEVC file.')
                }}
              />
            ) : (
              <div className="grid aspect-video place-items-center bg-surface-muted text-muted">
                <div className="max-w-md text-center">
                  <Video className="mx-auto mb-3 h-9 w-9" />
                  <h2 className="font-display text-2xl font-bold text-foreground">{isProjectWorkspace ? `Import the first video for ${selectedProjectLabel}` : 'Select or create a project first'}</h2>
                  <p className="mt-2 text-sm leading-6">{isProjectWorkspace ? 'Choose an MP4, MOV, MPEG, MPG, or WebM. The file will be copied into this project workspace.' : 'Projects keep source videos, clips, point candidates, and exports separated.'}</p>
                  <button type="button" onClick={() => fileInputRef.current?.click()} disabled={busy || !isProjectWorkspace} className="mt-4 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">{busyLabel.startsWith('Importing') ? 'Importing...' : 'Import Video'}</button>
                </div>
              </div>
            )}
          </div>

          {selectedVideo && !selectedVideo.playbackProxyStoredFileName && (
            <div className="rounded-card border border-warning/30 bg-warning/10 p-3 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-foreground">If this MOV does not play in the browser, create an H.264 playback proxy. The original source file stays unchanged.</p>
                <button type="button" onClick={createPlaybackProxyForSelectedVideo} disabled={busy} className="rounded-lg border border-warning/40 bg-background px-3 py-2 text-sm font-medium text-foreground disabled:opacity-50">
                  Create playback proxy
                </button>
              </div>
            </div>
          )}

          <div className="rounded-card border border-border bg-surface p-4 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-label text-muted">Point marks</p>
                <div className="mt-1 flex flex-wrap gap-2 text-sm text-muted">
                  <button type="button" onClick={() => startMs !== null && seekSource(startMs)} className="rounded-lg border border-border px-3 py-2 text-foreground">Start {formatMs(startMs ?? 0)}</button>
                  <button type="button" onClick={() => endMs !== null && seekSource(endMs)} className="rounded-lg border border-border px-3 py-2 text-foreground">End {formatMs(endMs ?? 0)}</button>
                  <span className="rounded-lg border border-border bg-background px-3 py-2">{startMs !== null && endMs !== null && endMs > startMs ? `${Math.round((endMs - startMs) / 1000)}s clip` : 'No valid range yet'}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={markStart} className="rounded-lg border border-border px-3 py-2 text-sm">[ {activeCandidateId ? 'Update candidate start' : 'Mark start'}</button>
                <button type="button" onClick={markEnd} className="rounded-lg border border-border px-3 py-2 text-sm">] {activeCandidateId ? 'Update candidate end' : 'Mark end'}</button>
                <button
                  type="button"
                  onClick={() => {
                    const activeCandidate = pointCandidates.find((candidate) => candidate.id === activeCandidateId)
                    if (activeCandidate) acceptCandidate(activeCandidate)
                    else savePoint(false)
                  }}
                  disabled={busy || (!activeCandidateId && !clipReady)}
                  className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  S {activeCandidateId ? 'Save candidate' : 'Save'}
                </button>
              </div>
            </div>

            <div className="mt-4 h-12 border-t border-border pt-4">
              <div className="relative h-full bg-surface-muted">
                {selectedVideoClips.map((clip) => {
                  const left = videoDurationMs ? ((clip.startMs || 0) / videoDurationMs) * 100 : 0
                  const width = videoDurationMs ? Math.max(0.8, (((clip.endMs || 0) - (clip.startMs || 0)) / videoDurationMs) * 100) : 0
                  return (
                    <button
                      key={clip.id}
                      type="button"
                      title={clip.title}
                      onClick={() => {
                        setSelectedClipId(clip.id)
                        seekSource(clip.startMs ?? 0)
                      }}
                      className={`absolute top-1 h-8 rounded text-[10px] font-bold text-white ${selectedClip?.id === clip.id ? 'bg-warning' : 'bg-accent'}`}
                      style={{ left: `${left}%`, width: `${width}%` }}
                    >
                      {formatMs(clip.startMs)}
                    </button>
                  )
                })}
                {startMs !== null && <span className="absolute top-0 h-full w-0.5 bg-danger" style={{ left: `${videoDurationMs ? (startMs / videoDurationMs) * 100 : 0}%` }} />}
                {endMs !== null && <span className="absolute top-0 h-full w-0.5 bg-foreground" style={{ left: `${videoDurationMs ? (endMs / videoDurationMs) * 100 : 0}%` }} />}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-muted">
              <span className="rounded-full border border-border bg-background px-2 py-1">Tap Space play</span>
              <span className="rounded-full border border-border bg-background px-2 py-1">[ start</span>
              <span className="rounded-full border border-border bg-background px-2 py-1">] end</span>
              <span className="rounded-full border border-border bg-background px-2 py-1">S save</span>
              <span className="rounded-full border border-border bg-background px-2 py-1">Left / Right 5s</span>
              <span className="rounded-full border border-border bg-background px-2 py-1">Hold Enter / Space 2x</span>
            </div>
          </div>

          <div className="rounded-card border border-border bg-surface p-4 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-label text-muted">Automatic point finder</p>
                <h2 className="font-display text-xl font-bold text-foreground">Review candidates before saving</h2>
                <p className="mt-1 text-sm leading-6 text-muted">Runs local ffmpeg in the background. Default scans the next 5 minutes from the current playhead.</p>
              </div>
              <div className="flex w-full min-w-0 flex-wrap gap-2 sm:w-auto">
                <select
                  value={pointScanMode}
                  onChange={(event) => setPointScanMode(event.target.value as PointScanMode)}
                  className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground sm:flex-none"
                  aria-label="Point scan range"
                >
                  <option value="next5">Next 5 min</option>
                  <option value="next10">Next 10 min</option>
                  <option value="selected">Selected range</option>
                  <option value="full">Full video</option>
                </select>
                <button type="button" onClick={findPointsInSelectedVideo} disabled={busy || !selectedVideo} className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50 sm:flex-none">
                  <Sparkles className="h-4 w-4" />
                  {busyLabel.startsWith('Starting background') ? 'Starting...' : 'Start scan'}
                </button>
              </div>
            </div>

            {activePointDetectionJobs.length > 0 && (
              <div className="mt-4 border-t border-border pt-3">
                <p className="text-xs font-bold uppercase tracking-label text-muted">Background scans</p>
                <div className="mt-2 space-y-2">
                  {activePointDetectionJobs.map((job) => (
                    <div key={job.id} className="grid gap-2 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-muted">{formatMs(job.startMs)} to {formatMs(job.endMs ?? job.startMs + job.maxDurationMs)}</span>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-2 rounded-full border border-border px-2 py-1 text-xs font-semibold uppercase tracking-label text-muted">
                            <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
                            {job.status} {Math.round(job.progressPercent || 0)}%
                          </span>
                          <button type="button" onClick={() => stopPointDetectionJob(job)} className="inline-flex items-center gap-1 rounded-lg border border-danger/30 px-2 py-1 text-xs font-semibold text-danger hover:bg-danger/5">
                            <X className="h-3.5 w-3.5" />
                            Stop
                          </button>
                        </div>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
                        <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${Math.max(2, Math.min(100, job.progressPercent || 0))}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pointDetectionNote && <p className="mt-3 text-xs leading-5 text-muted">{pointDetectionNote}</p>}
            <p className="mt-3 text-sm text-muted">
              {pointCandidates.length === 0 ? 'Finished candidates will appear in the review queue on the right.' : `${pointCandidates.length} unsaved candidates are ready in the review queue.`}
            </p>
          </div>

          <div className="rounded-card border border-border bg-surface p-4 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-label text-muted">Clips and point timeline</p>
                <h2 className="font-display text-xl font-bold text-foreground">{filteredClips.length} saved clips</h2>
                {selectedVideoClips.length > 0 && (
                  <p className="mt-1 text-sm text-muted">{selectedHighlightClips.length} selected for highlight, exported top to bottom</p>
                )}
              </div>
              <div className="flex w-full min-w-0 flex-wrap gap-2 sm:w-auto">
                <button type="button" onClick={() => setHighlightClipIds(selectedVideoClipIds)} disabled={busy || selectedVideoClips.length === 0} className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-muted disabled:opacity-50">
                  Select all
                </button>
                <button type="button" onClick={() => setHighlightClipIds([])} disabled={busy || selectedHighlightClips.length === 0} className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-muted disabled:opacity-50">
                  Clear
                </button>
                <button type="button" onClick={exportCurrentHighlight} disabled={busy || highlightExportActive || !selectedVideo || selectedHighlightClips.length === 0} className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
                  <Film className="h-4 w-4" />
                  Export highlight ({selectedHighlightClips.length})
                </button>
                <input value={clipSearch} onChange={(event) => setClipSearch(event.target.value)} placeholder="Search forehand, pressure, serve..." className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm sm:w-80" />
              </div>
            </div>
            <div className="mt-4 grid gap-3 border-t border-border pt-4 md:grid-cols-4">
              <label className="grid min-w-0 gap-1 text-xs font-bold uppercase tracking-label text-muted">
                Quality
                <select value={highlightQuality} onChange={(event) => setHighlightQuality(event.target.value as HighlightQuality)} className="w-full min-w-0 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium normal-case tracking-normal text-foreground">
                  <option value="draft">Smaller</option>
                  <option value="standard">Balanced</option>
                  <option value="high">High</option>
                </select>
              </label>
              <label className="grid min-w-0 gap-1 text-xs font-bold uppercase tracking-label text-muted">
                Resolution
                <select value={highlightResolution} onChange={(event) => setHighlightResolution(event.target.value as HighlightResolution)} className="w-full min-w-0 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium normal-case tracking-normal text-foreground">
                  <option value="720">720p</option>
                  <option value="1080">1080p</option>
                  <option value="source">Source</option>
                </select>
              </label>
              <label className="grid min-w-0 gap-1 text-xs font-bold uppercase tracking-label text-muted">
                FPS
                <select value={highlightFps} onChange={(event) => setHighlightFps(event.target.value as HighlightFps)} className="w-full min-w-0 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium normal-case tracking-normal text-foreground">
                  <option value="source">Source</option>
                  <option value="30">30 fps</option>
                  <option value="60">60 fps</option>
                </select>
              </label>
              <label className="flex min-w-0 items-end gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground">
                <input type="checkbox" checked={highlightFade} onChange={(event) => setHighlightFade(event.target.checked)} className="mb-1 h-4 w-4 rounded border-border accent-accent" />
                <span className="min-w-0">Fade transitions</span>
              </label>
            </div>
            {selectedHighlightClips.length > 0 && (
              <div className="mt-4 border-t border-border pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-label text-muted">Highlight order</p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={resetHighlightOrder} disabled={busy || selectedHighlightClips.length < 2} className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-muted disabled:opacity-50">
                      Chronological
                    </button>
                    <button type="button" onClick={reverseHighlightOrder} disabled={busy || selectedHighlightClips.length < 2} className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-muted disabled:opacity-50">
                      Reverse
                    </button>
                  </div>
                </div>
                <div className="mt-3 max-h-72 overflow-auto pr-1" data-highlight-order-list>
                  {selectedHighlightClips.map((clip, index) => (
                    <div
                      key={clip.id}
                      data-highlight-order-row
                      onDragEnter={(event) => allowHighlightDrop(event, clip.id)}
                      onDragOver={(event) => allowHighlightDrop(event, clip.id)}
                      onDrop={(event) => dropHighlightClip(event, clip.id)}
                      className={`grid grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-2 border-b border-border py-2 last:border-b-0 ${draggingHighlightClipId === clip.id ? 'opacity-40' : ''} ${highlightDropClipId === clip.id && draggingHighlightClipId !== clip.id ? 'bg-accent-light' : ''}`}
                    >
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          draggable={!busy}
                          onDragStart={(event) => startHighlightDrag(event, clip.id)}
                          onDragEnd={endHighlightDrag}
                          disabled={busy}
                          className="grid h-8 w-6 cursor-grab place-items-center rounded text-muted hover:bg-surface-muted hover:text-foreground active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-30"
                          aria-label={`Drag ${clip.title} to reorder highlight`}
                          title="Drag to reorder"
                        >
                          <GripVertical className="h-4 w-4" />
                        </button>
                        <span className="text-xs font-semibold tabular-nums text-muted">{index + 1}</span>
                      </div>
                      <button type="button" onClick={() => { setSelectedClipId(clip.id); seekSource(clip.startMs ?? 0) }} className="min-w-0 text-left">
                        <span className="block truncate font-display text-sm font-bold text-foreground">{clip.title}</span>
                        <span className="mt-0.5 block text-xs text-muted">{formatMs(clip.startMs)} - {formatMs(clip.endMs)}</span>
                      </button>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => moveHighlightClipToIndex(clip.id, 0)}
                          disabled={busy || index === 0}
                          className="grid h-8 w-8 place-items-center rounded border border-border text-muted hover:text-foreground disabled:opacity-30"
                          aria-label={`Move ${clip.title} to the start of the highlight`}
                          title="Move to start"
                        >
                          <ChevronsUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveHighlightClip(clip.id, -1)}
                          disabled={busy || index === 0}
                          className="grid h-8 w-8 place-items-center rounded border border-border text-muted hover:text-foreground disabled:opacity-30"
                          aria-label={`Move ${clip.title} earlier in the highlight`}
                          title="Move earlier"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <label className="sr-only" htmlFor={`highlight-position-${clip.id}`}>Highlight position</label>
                        <select
                          id={`highlight-position-${clip.id}`}
                          value={index}
                          onChange={(event) => moveHighlightClipToIndex(clip.id, Number(event.target.value))}
                          disabled={busy}
                          className="h-8 min-w-0 rounded border border-border bg-surface px-2 text-xs font-semibold text-foreground disabled:opacity-50"
                          aria-label={`Set position for ${clip.title}`}
                        >
                          {selectedHighlightClips.map((positionClip, positionIndex) => (
                            <option key={positionClip.id} value={positionIndex}>{positionIndex + 1}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => moveHighlightClip(clip.id, 1)}
                          disabled={busy || index >= selectedHighlightClips.length - 1}
                          className="grid h-8 w-8 place-items-center rounded border border-border text-muted hover:text-foreground disabled:opacity-30"
                          aria-label={`Move ${clip.title} later in the highlight`}
                          title="Move later"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveHighlightClipToIndex(clip.id, selectedHighlightClips.length - 1)}
                          disabled={busy || index >= selectedHighlightClips.length - 1}
                          className="grid h-8 w-8 place-items-center rounded border border-border text-muted hover:text-foreground disabled:opacity-30"
                          aria-label={`Move ${clip.title} to the end of the highlight`}
                          title="Move to end"
                        >
                          <ChevronsDown className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(260px,0.75fr)_minmax(0,1.25fr)]">
              <div className="max-h-[520px] space-y-2 overflow-auto pr-1">
                {orderedFilteredClips.length === 0 ? (
                  <p className="px-2 py-3 text-sm text-muted">No clips for this video yet.</p>
                ) : orderedFilteredClips.map((clip) => (
                  <article key={clip.id} onClick={() => { setSelectedClipId(clip.id); seekSource(clip.startMs ?? 0) }} className={`cursor-pointer border-b border-border px-2 py-3 last:border-b-0 ${selectedClip?.id === clip.id ? 'bg-accent-light' : 'hover:bg-surface-muted'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <label onClick={(event) => event.stopPropagation()} className="mt-0.5 inline-flex items-center">
                        <input
                          type="checkbox"
                          checked={highlightClipIdSet.has(clip.id)}
                          onChange={() => toggleHighlightClip(clip.id)}
                          className="h-4 w-4 rounded border-border accent-accent"
                          aria-label={`Include ${clip.title} in highlight export`}
                        />
                      </label>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate font-display text-base font-bold text-foreground">{clip.title}</h3>
                        <p className="mt-1 text-xs text-muted">{formatMs(clip.startMs)} - {formatMs(clip.endMs)} · {clip.pointResult} · {label(clip.pointEnding)}</p>
                        {clip.tags.length > 0 && <p className="mt-2 text-xs text-muted">{clip.tags.join(', ')}</p>}
                      </div>
                      <button type="button" onClick={(event) => { event.stopPropagation(); removeSelectedClip(clip) }} className="rounded border border-danger/30 p-1.5 text-danger">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              <SelectedClipPanel
                selectedClip={selectedClip}
                busy={busy}
                busyLabel={busyLabel}
                crop={crop}
                clipPreviewMs={clipPreviewMs}
                reelKeyframes={reelKeyframes}
                reelLeftPercent={reelLeftPercent}
                reelCropWidthPercent={reelCropWidthPercent}
                clipVideoRef={clipVideoRef}
                setCrop={setCrop}
                setClipPreviewMs={setClipPreviewMs}
                setClipVideoAspect={setClipVideoAspect}
                addReelKeyframe={addReelKeyframe}
                exportSelectedClip={exportSelectedClip}
                exportSelectedReel={exportSelectedReel}
                analyzeSelectedClip={analyzeSelectedClip}
              />
            </div>
          </div>
        </section>

        <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <section className="rounded-card border border-border bg-surface p-4 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-label text-muted">Candidate queue</p>
                <h2 className="font-display text-lg font-bold text-foreground">{pointCandidates.length} to review</h2>
              </div>
              {pointCandidates.length > 0 && (
                <button type="button" onClick={acceptAllCandidates} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-accent bg-accent-light px-3 py-2 text-sm font-medium text-foreground disabled:opacity-50">
                  <ListChecks className="h-4 w-4" />
                  Accept all
                </button>
              )}
            </div>

            {pointCandidates.length === 0 ? (
              <p className="mt-4 text-sm text-muted">No unsaved candidates yet.</p>
            ) : (
              <div className="mt-4 max-h-[52vh] space-y-3 overflow-auto pr-1">
                {pointCandidates.map((candidate) => (
                  <article key={candidate.id} className={`border-b border-border px-1 py-3 last:border-b-0 ${activeCandidateId === candidate.id ? 'bg-accent-light' : ''}`}>
                    <div className="grid gap-3">
                      <div className="min-w-0">
                        <input
                          value={candidate.title}
                          onChange={(event) => updateCandidate(candidate.id, { title: event.target.value })}
                          aria-label="Candidate title"
                          className="w-full min-w-0 rounded-lg border border-border bg-surface px-3 py-2 font-display text-sm font-bold text-foreground"
                        />
                        <p className="mt-2 text-xs leading-5 text-muted">{formatMs(candidate.startMs)} - {formatMs(candidate.endMs)} - {Math.round(candidate.confidence * 100)}% confidence</p>
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <button type="button" onClick={() => previewCandidate(candidate)} className="inline-flex min-w-0 items-center justify-center gap-1 rounded-lg border border-border px-2 py-2 text-xs font-medium text-foreground hover:bg-surface-muted">
                          <Play className="h-3.5 w-3.5" />
                          Preview
                        </button>
                        <button type="button" onClick={() => acceptCandidate(candidate)} disabled={busy} className="inline-flex min-w-0 items-center justify-center gap-1 rounded-lg bg-accent px-2 py-2 text-xs font-medium text-white disabled:opacity-50">
                          <Check className="h-3.5 w-3.5" />
                          Save
                        </button>
                        <button type="button" onClick={() => { setPointCandidates((prev) => prev.filter((item) => item.id !== candidate.id)); if (activeCandidateId === candidate.id) setActiveCandidateId('') }} disabled={busy} className="inline-flex min-w-0 items-center justify-center gap-1 rounded-lg border border-danger/30 px-2 py-2 text-xs font-medium text-danger hover:bg-danger/10 disabled:opacity-50">
                          <X className="h-3.5 w-3.5" />
                          Reject
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <label className="grid min-w-0 gap-1 text-xs font-bold uppercase tracking-label text-muted">
                        Start
                        <input
                          value={friendlyInputTime(candidate.startMs)}
                          onChange={(event) => {
                            const parsed = parseTimestamp(event.target.value)
                            if (parsed !== null) {
                              updateCandidate(candidate.id, { startMs: parsed })
                              if (activeCandidateId === candidate.id) {
                                setStartMs(parsed)
                                setStartInput(inputTime(parsed))
                              }
                            }
                          }}
                          className="h-9 w-full min-w-0 rounded-lg border border-border bg-surface px-2 text-sm normal-case tracking-normal"
                        />
                      </label>
                      <label className="grid min-w-0 gap-1 text-xs font-bold uppercase tracking-label text-muted">
                        End
                        <input
                          value={friendlyInputTime(candidate.endMs)}
                          onChange={(event) => {
                            const parsed = parseTimestamp(event.target.value)
                            if (parsed !== null) {
                              updateCandidate(candidate.id, { endMs: parsed })
                              if (activeCandidateId === candidate.id) {
                                setEndMs(parsed)
                                setEndInput(inputTime(parsed))
                              }
                            }
                          }}
                          className="h-9 w-full min-w-0 rounded-lg border border-border bg-surface px-2 text-sm normal-case tracking-normal"
                        />
                      </label>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-card border border-border bg-surface p-4 shadow-card">
            <div className="flex items-center gap-2">
              <Scissors className="h-4 w-4 text-accent" />
              <h2 className="font-display text-lg font-bold text-foreground">Create point clip</h2>
            </div>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-xs font-bold uppercase tracking-label text-muted">
                Title
                <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Backhand under pressure" className="w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm normal-case tracking-normal" />
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="grid min-w-0 gap-1 text-xs font-bold uppercase tracking-label text-muted">
                  Start
                  <input value={startInput} onChange={(event) => updateStartFromInput(event.target.value)} placeholder="12.4" className="w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm normal-case tracking-normal" />
                </label>
                <label className="grid min-w-0 gap-1 text-xs font-bold uppercase tracking-label text-muted">
                  End
                  <input value={endInput} onChange={(event) => updateEndFromInput(event.target.value)} placeholder="19.8" className="w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm normal-case tracking-normal" />
                </label>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="grid min-w-0 gap-1 text-xs font-bold uppercase tracking-label text-muted">
                  Result
                  <select value={pointResult} onChange={(event) => setPointResult(event.target.value as Clip['pointResult'])} className="w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm normal-case tracking-normal">
                    <option value="unknown">Unknown</option>
                    <option value="won">Won</option>
                    <option value="lost">Lost</option>
                  </select>
                </label>
                <label className="grid min-w-0 gap-1 text-xs font-bold uppercase tracking-label text-muted">
                  Context
                  <select value={shotContext} onChange={(event) => setShotContext(event.target.value as ShotContext)} className="w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm normal-case tracking-normal">
                    {shotContexts.map((context) => <option key={context} value={context}>{label(context)}</option>)}
                  </select>
                </label>
              </div>
              <label className="grid gap-1 text-xs font-bold uppercase tracking-label text-muted">
                Ending
                <select value={pointEnding} onChange={(event) => setPointEnding(event.target.value as PointEnding)} className="w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm normal-case tracking-normal">
                  {pointEndings.map((ending) => <option key={ending} value={ending}>{label(ending)}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-bold uppercase tracking-label text-muted">
                Score / situation
                <input value={scoreContext} onChange={(event) => setScoreContext(event.target.value)} placeholder="30-30, break point, tiebreak..." className="w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm normal-case tracking-normal" />
              </label>
              <label className="grid gap-1 text-xs font-bold uppercase tracking-label text-muted">
                Notes
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="What happened in this point?" rows={4} className="w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm normal-case tracking-normal" />
              </label>
              <label className="grid gap-1 text-xs font-bold uppercase tracking-label text-muted">
                Tags
                <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="return, pressure, forehand" className="w-full min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-sm normal-case tracking-normal" />
              </label>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {pointPresets.map((preset) => (
                <button key={preset.label} type="button" onClick={() => applyPreset(preset)} className="min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-left text-xs font-semibold text-foreground hover:border-accent hover:bg-accent-light">
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-2">
              <button type="button" onClick={() => savePoint(true)} disabled={busy || !clipReady} className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">
                <Download className="h-4 w-4" />
                Save and export clip
              </button>
              <button type="button" onClick={() => savePoint(false)} disabled={busy || !clipReady} className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground disabled:opacity-50">
                Save metadata only
              </button>
              {!clipReady && <p className="text-xs leading-5 text-muted">Import a video and mark a valid start/end range before saving.</p>}
            </div>
          </section>

          <section className="rounded-card border border-border bg-surface p-4 shadow-card">
            <div className="flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-muted" />
              <h2 className="font-display text-lg font-bold text-foreground">Local storage</h2>
            </div>
            <dl className="mt-3 space-y-2 text-xs text-muted">
              <div className="grid gap-1"><dt className="font-medium text-foreground">Source videos</dt><dd className="max-w-[54ch] break-words font-mono leading-5 [overflow-wrap:anywhere]">{storage.sourceVideos}</dd></div>
              <div className="grid gap-1"><dt className="font-medium text-foreground">Clip exports</dt><dd className="max-w-[54ch] break-words font-mono leading-5 [overflow-wrap:anywhere]">{storage.exportedClips}</dd></div>
              <div className="grid gap-1"><dt className="font-medium text-foreground">Reel exports</dt><dd className="max-w-[54ch] break-words font-mono leading-5 [overflow-wrap:anywhere]">{storage.exportedReels}</dd></div>
              <div className="grid gap-1"><dt className="font-medium text-foreground">Highlight exports</dt><dd className="max-w-[54ch] break-words font-mono leading-5 [overflow-wrap:anywhere]">{storage.exportedHighlights}</dd></div>
              <div className="grid gap-1"><dt className="font-medium text-foreground">Metadata</dt><dd className="max-w-[54ch] break-words font-mono leading-5 [overflow-wrap:anywhere]">{storage.metadata}</dd></div>
            </dl>
          </section>
        </aside>
      </div>
    </AppShell>
  )
}

function SelectedClipPanel({
  selectedClip,
  busy,
  busyLabel,
  crop,
  clipPreviewMs,
  reelKeyframes,
  reelLeftPercent,
  reelCropWidthPercent,
  clipVideoRef,
  setCrop,
  setClipPreviewMs,
  setClipVideoAspect,
  addReelKeyframe,
  exportSelectedClip,
  exportSelectedReel,
  analyzeSelectedClip,
}: {
  selectedClip?: Clip
  busy: boolean
  busyLabel: string
  crop: number
  clipPreviewMs: number
  reelKeyframes: ReelKeyframe[]
  reelLeftPercent: number
  reelCropWidthPercent: number
  clipVideoRef: RefObject<HTMLVideoElement | null>
  setCrop: (value: number) => void
  setClipPreviewMs: (value: number) => void
  setClipVideoAspect: (value: { width: number; height: number }) => void
  addReelKeyframe: () => void
  exportSelectedClip: () => void
  exportSelectedReel: () => void
  analyzeSelectedClip: () => void
}) {
  if (!selectedClip) {
    return (
      <div className="grid min-h-[320px] place-items-center p-6 text-center text-muted">
        <div>
          <Film className="mx-auto mb-3 h-8 w-8" />
          <p className="text-sm">Save a point clip to review it here.</p>
        </div>
      </div>
    )
  }

  return (
    <aside className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-label text-muted">Selected clip</p>
          <h2 className="font-display text-xl font-bold text-foreground">{selectedClip.title}</h2>
          <p className="mt-1 text-sm text-muted">{formatMs(selectedClip.startMs)} - {formatMs(selectedClip.endMs)} · {selectedClip.pointResult} · {label(selectedClip.pointEnding)}</p>
        </div>
        <button type="button" onClick={exportSelectedClip} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
          {busyLabel.startsWith('Exporting selected') ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Download className="h-4 w-4" />}
          {busyLabel.startsWith('Exporting selected') ? 'Exporting...' : 'Export'}
        </button>
      </div>

      {(selectedClip.exportedClipPath || selectedClip.exportedReelPath) && (
        <div className="mt-4 space-y-2 border-t border-border pt-3 text-xs text-muted">
          {selectedClip.exportedClipPath && (
            <p className="break-words [overflow-wrap:anywhere]">
              <span className="font-semibold text-foreground">Clip file:</span> <span className="font-mono">{selectedClip.exportedClipPath}</span>
            </p>
          )}
          {selectedClip.exportedReelPath && (
            <p className="break-words [overflow-wrap:anywhere]">
              <span className="font-semibold text-foreground">Reel file:</span> <span className="font-mono">{selectedClip.exportedReelPath}</span>
            </p>
          )}
        </div>
      )}

      {selectedClip.exportedClipPath ? (
        <div className="relative mt-4 overflow-hidden rounded-lg bg-black">
          <video
            ref={clipVideoRef}
            src={`/api/clips/${selectedClip.id}/media`}
            controls
            className="aspect-video w-full bg-black"
            onLoadedMetadata={(event) => {
              const video = event.currentTarget
              setClipVideoAspect({ width: video.videoWidth || 16, height: video.videoHeight || 9 })
            }}
            onTimeUpdate={(event) => setClipPreviewMs(Math.round(event.currentTarget.currentTime * 1000))}
          />
          <span className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-black/70 px-2 py-1 text-xs font-semibold text-white">Clip preview</span>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">Export this clip to preview media, build a reel crop path, or send selected clip AI review.</p>
      )}

      <div className="mt-4 grid gap-3 border-t border-border pt-4">
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 h-4 w-4 text-accent" />
          <div>
            <h3 className="font-display text-sm font-bold uppercase tracking-label text-foreground">9:16 reel crop</h3>
            <p className="mt-1 text-xs leading-5 text-muted">Frame the vertical crop and add keyframes. Export uses smooth interpolation.</p>
          </div>
        </div>

        {selectedClip.exportedClipPath && (
          <div className="relative overflow-hidden rounded-lg bg-black">
            <video src={`/api/clips/${selectedClip.id}/media`} className="aspect-video w-full bg-black" muted />
            <div className="pointer-events-none absolute inset-y-0 bg-black/45" style={{ left: 0, width: `${reelLeftPercent}%` }} />
            <div className="pointer-events-none absolute inset-y-0 border-2 border-tennis" style={{ left: `${reelLeftPercent}%`, width: `${reelCropWidthPercent}%` }}>
              <span className="absolute left-2 top-2 rounded-full bg-black/70 px-2 py-1 text-[11px] font-semibold text-white">Reel frame</span>
            </div>
            <div className="pointer-events-none absolute inset-y-0 bg-black/45" style={{ left: `${reelLeftPercent + reelCropWidthPercent}%`, right: 0 }} />
          </div>
        )}

        <label className="grid gap-1 text-xs font-bold uppercase tracking-label text-muted">
          Crop position
          <input type="range" min="0" max="1" step="0.01" value={crop} onChange={(event) => setCrop(Number(event.target.value))} />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setCrop(0)} className="rounded-lg border border-border px-3 py-2 text-sm">Left</button>
          <button type="button" onClick={() => setCrop(0.5)} className="rounded-lg border border-border px-3 py-2 text-sm">Center</button>
          <button type="button" onClick={() => setCrop(1)} className="rounded-lg border border-border px-3 py-2 text-sm">Right</button>
          <button type="button" onClick={addReelKeyframe} disabled={!selectedClip.exportedClipPath} className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50">Add keyframe at {formatMs(clipPreviewMs)}</button>
        </div>
        <div className="space-y-2">
          {reelKeyframes.length === 0 ? (
            <p className="text-xs text-muted">Add at least two keyframes before exporting a reel.</p>
          ) : reelKeyframes.map((keyframe) => (
            <div key={keyframe.id || `${keyframe.timestampMs}-${keyframe.xPercent}`} className="flex items-center justify-between border-b border-border px-2 py-1 text-xs text-muted last:border-b-0">
              <span>{formatMs(keyframe.timestampMs)}</span>
              <span>{Math.round(keyframe.xPercent * 100)}%</span>
            </div>
          ))}
        </div>
        <button type="button" onClick={exportSelectedReel} disabled={busy || !selectedClip.exportedClipPath || reelKeyframes.length < 2} className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">
          {busyLabel.startsWith('Exporting 9:16') ? 'Exporting reel...' : 'Export 9:16 reel'}
        </button>
      </div>

      <div className="mt-4 border-t border-border pt-4">
        <h3 className="font-display text-sm font-bold uppercase tracking-label text-foreground">Optional AI review</h3>
        <p className="mt-2 text-xs leading-5 text-muted">Sends only this exported short clip plus point metadata to your configured external AI provider.</p>
        <button type="button" onClick={analyzeSelectedClip} disabled={busy || !selectedClip.exportedClipPath} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground disabled:opacity-50">
          <Brain className="h-4 w-4" />
          Analyze selected clip
        </button>
        {selectedClip.aiAnalysis && (
          <div className="mt-3 space-y-2 text-sm text-foreground">
            <p>{selectedClip.aiAnalysis}</p>
            {selectedClip.aiPromptVersion && <p className="text-xs text-muted">Prompt: {selectedClip.aiPromptVersion}</p>}
          </div>
        )}
      </div>
    </aside>
  )
}
