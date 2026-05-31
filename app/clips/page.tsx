'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/PageHeader'
import { analyzeSavedClip, createClip, deleteClip, exportClip, exportReel, importVideo, loadClips, loadVideos, updateClip } from '@/lib/api'
import type { Clip, LocalVideo, PointEnding, ReelKeyframe, ShotContext } from '@/lib/data'
import { Brain, Download, Film, FolderOpen, Scissors, Sparkles, Trash2, Upload, Video } from 'lucide-react'

type PointPreset = {
  label: string
  result: Clip['pointResult']
  ending: PointEnding
  context?: ShotContext
  tags: string[]
}

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

function formatMs(ms = 0) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`
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

function isTyping(target: EventTarget | null) {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
}

export default function ClipsPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const clipVideoRef = useRef<HTMLVideoElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [videos, setVideos] = useState<LocalVideo[]>([])
  const [clips, setClips] = useState<Clip[]>([])
  const [storage, setStorage] = useState<Record<string, string>>({})
  const [selectedVideoId, setSelectedVideoId] = useState('')
  const [selectedClipId, setSelectedClipId] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
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
  const [reelKeyframes, setReelKeyframes] = useState<ReelKeyframe[]>([])
  const [crop, setCrop] = useState(0.5)
  const [clipPreviewMs, setClipPreviewMs] = useState(0)
  const [clipVideoAspect, setClipVideoAspect] = useState({ width: 16, height: 9 })

  const selectedVideo = useMemo(() => videos.find((video) => video.id === selectedVideoId) || videos[0], [selectedVideoId, videos])
  const selectedVideoClips = selectedVideo ? clips.filter((clip) => clip.localVideoId === selectedVideo.id) : []
  const selectedClip = useMemo(() => selectedVideoClips.find((clip) => clip.id === selectedClipId) || selectedVideoClips[0] || clips.find((clip) => clip.id === selectedClipId) || clips[0], [selectedClipId, selectedVideoClips, clips])
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

  const refresh = async () => {
    const [videoData, clipData] = await Promise.all([loadVideos(), loadClips()])
    const nextVideos = videoData?.videos ?? []
    const nextClips = clipData ?? []
    setVideos(nextVideos)
    setStorage(videoData?.storage ?? {})
    setClips(nextClips)
    if (!selectedVideoId && nextVideos[0]) setSelectedVideoId(nextVideos[0].id)
    if (!selectedClipId && nextClips[0]) setSelectedClipId(nextClips[0].id)
  }

  useEffect(() => {
    refresh()
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return
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
        savePoint(false)
      }
      if (event.key === 'ArrowLeft' && videoRef.current) {
        event.preventDefault()
        videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 3)
      }
      if (event.key === 'ArrowRight' && videoRef.current) {
        event.preventDefault()
        videoRef.current.currentTime = videoRef.current.currentTime + 3
      }
      if (event.key === ' ' && videoRef.current) {
        event.preventDefault()
        if (videoRef.current.paused) videoRef.current.play()
        else videoRef.current.pause()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedVideo, startMs, endMs, title, pointResult, pointEnding, shotContext, scoreContext, notes, tags])

  useEffect(() => {
    if (!selectedClip) return
    setReelKeyframes(selectedClip.reelKeyframes || [])
  }, [selectedClip?.id])

  const handleImport = async (file: File | null) => {
    if (!file) return
    setBusy(true)
    setError('')
    setStatus('')
    try {
      const video = await importVideo(file)
      await refresh()
      setSelectedVideoId(video.id)
      setStatus('Video imported into local Raqet storage.')
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Video import failed.')
    } finally {
      setBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const markStart = () => {
    const next = currentVideoMs(videoRef.current)
    setStartMs(next)
    setStartInput(inputTime(next))
  }

  const markEnd = () => {
    const next = currentVideoMs(videoRef.current)
    setEndMs(next)
    setEndInput(inputTime(next))
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

  const seekSource = (ms: number) => {
    if (!videoRef.current) return
    videoRef.current.currentTime = Math.max(0, ms / 1000)
    videoRef.current.play().catch(() => null)
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

  const savePoint = async (exportAfter: boolean) => {
    if (!clipReady) {
      setError(!selectedVideo ? 'Import a video before clipping.' : 'Mark a valid start and end before saving.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const saved = await createClip(makeClip())
      if (!saved) throw new Error('Clip metadata save returned no clip.')
      const finalClip = exportAfter ? await exportClip(saved.id) : saved
      await refresh()
      setSelectedClipId(finalClip?.id || saved.id)
      setStatus(exportAfter ? 'Point saved and exported with ffmpeg.' : 'Point metadata saved locally. Source video was not sent to AI.')
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Clip save failed.')
    } finally {
      setBusy(false)
    }
  }

  const exportSelectedClip = async () => {
    if (!selectedClip) return
    setBusy(true)
    setError('')
    try {
      const exported = await exportClip(selectedClip.id)
      await refresh()
      setSelectedClipId(exported.id)
      setStatus('Clip exported with ffmpeg.')
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Clip export failed.')
    } finally {
      setBusy(false)
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
    setError('')
    try {
      const exported = await exportReel(selectedClip.id, reelKeyframes)
      await updateClip({ ...exported, reelKeyframes })
      await refresh()
      setSelectedClipId(exported.id)
      setStatus('9:16 reel exported with manual crop interpolation.')
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Reel export failed.')
    } finally {
      setBusy(false)
    }
  }

  const analyzeSelectedClip = async () => {
    if (!selectedClip) return
    setBusy(true)
    setError('')
    try {
      const analyzed = await analyzeSavedClip(selectedClip.id)
      await refresh()
      setSelectedClipId(analyzed.id)
      setStatus('Selected exported clip was analyzed. The source video was not sent.')
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : 'Selected clip analysis failed.')
    } finally {
      setBusy(false)
    }
  }

  const removeSelectedClip = async (clip: Clip) => {
    await deleteClip(clip.id)
    setClips((prev) => prev.filter((item) => item.id !== clip.id))
    if (selectedClipId === clip.id) setSelectedClipId('')
    setStatus('Clip metadata deleted. Source video and exported files were left in storage.')
  }

  return (
    <AppShell title="Video Review" subtitle="Local point clipping, metadata, and reel exports">
      <PageHeader title="Video Review" subtitle={`${videos.length} videos, ${clips.length} clips`} />

      <div className="mb-4 rounded-lg border border-border bg-surface px-4 py-3 text-sm leading-6 text-muted shadow-card">
        Source videos stay in local app storage. AI is optional and only receives exported short clips after explicit action.
      </div>

      {error && <p className="mb-4 rounded-lg border border-danger/20 bg-danger/5 p-3 text-sm text-danger">{error}</p>}
      {status && <p className="mb-4 rounded-lg border border-accent/20 bg-accent-light p-3 text-sm text-foreground">{status}</p>}

      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="space-y-4">
          <div className="rounded-card border border-border bg-surface p-4 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-label text-muted">Source video</p>
                <h2 className="font-display text-xl font-bold text-foreground">{selectedVideo?.fileName || 'Import a local tennis video'}</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => fileInputRef.current?.click()} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white">
                  <Upload className="h-4 w-4" />
                  Import Video
                </button>
                <input ref={fileInputRef} type="file" accept="video/mp4,video/mov,video/quicktime,video/mpeg,video/webm" className="hidden" onChange={(event) => handleImport(event.target.files?.[0] ?? null)} />
              </div>
            </div>

            {videos.length > 0 && (
              <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                {videos.map((video) => (
                  <button
                    key={video.id}
                    type="button"
                    onClick={() => setSelectedVideoId(video.id)}
                    className={`min-w-[210px] rounded-lg border px-3 py-2 text-left text-sm ${selectedVideo?.id === video.id ? 'border-accent bg-accent-light text-foreground' : 'border-border text-muted hover:bg-background'}`}
                  >
                    <span className="block truncate font-semibold">{video.fileName}</span>
                    <span className="text-xs">{video.durationMs ? formatMs(video.durationMs) : 'Duration unknown'}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-card border border-border bg-black shadow-card">
            {selectedVideo ? (
              <video ref={videoRef} src={`/api/videos/${selectedVideo.id}/file`} controls className="aspect-video w-full bg-black" />
            ) : (
              <div className="grid aspect-video place-items-center bg-surface-muted text-muted">
                <div className="max-w-md text-center">
                  <Video className="mx-auto mb-3 h-9 w-9" />
                  <h2 className="font-display text-2xl font-bold text-foreground">Import a match or practice video</h2>
                  <p className="mt-2 text-sm leading-6">Choose an MP4, MOV, MPEG, MPG, or WebM. Raqet copies it into local self-hosted storage.</p>
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="mt-4 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white">Import Video</button>
                </div>
              </div>
            )}
          </div>

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
                <button type="button" onClick={markStart} className="rounded-lg border border-border px-3 py-2 text-sm">[ Mark start</button>
                <button type="button" onClick={markEnd} className="rounded-lg border border-border px-3 py-2 text-sm">] Mark end</button>
                <button type="button" onClick={() => savePoint(false)} disabled={busy || !clipReady} className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50">S Save</button>
              </div>
            </div>

            <div className="mt-4 h-12 rounded-lg border border-border bg-background p-2">
              <div className="relative h-full overflow-hidden rounded bg-surface-muted">
                {selectedVideoClips.map((clip) => {
                  const left = videoDurationMs ? ((clip.startMs || 0) / videoDurationMs) * 100 : 0
                  const width = videoDurationMs ? Math.max(0.8, (((clip.endMs || 0) - (clip.startMs || 0)) / videoDurationMs) * 100) : 0
                  return (
                    <button
                      key={clip.id}
                      type="button"
                      title={clip.title}
                      onClick={() => setSelectedClipId(clip.id)}
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
              <span className="rounded-full border border-border bg-background px-2 py-1">Space play</span>
              <span className="rounded-full border border-border bg-background px-2 py-1">[ start</span>
              <span className="rounded-full border border-border bg-background px-2 py-1">] end</span>
              <span className="rounded-full border border-border bg-background px-2 py-1">S save</span>
              <span className="rounded-full border border-border bg-background px-2 py-1">← / → seek</span>
            </div>
          </div>

          <div className="rounded-card border border-border bg-surface p-4 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-label text-muted">Clips and point timeline</p>
                <h2 className="font-display text-xl font-bold text-foreground">{filteredClips.length} saved clips</h2>
              </div>
              <input value={clipSearch} onChange={(event) => setClipSearch(event.target.value)} placeholder="Search forehand, pressure, serve..." className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm sm:w-80" />
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(260px,0.75fr)_minmax(0,1.25fr)]">
              <div className="max-h-[520px] space-y-2 overflow-auto pr-1">
                {filteredClips.length === 0 ? (
                  <p className="rounded-lg border border-border bg-background p-3 text-sm text-muted">No clips for this video yet.</p>
                ) : filteredClips.map((clip) => (
                  <article key={clip.id} onClick={() => setSelectedClipId(clip.id)} className={`cursor-pointer rounded-lg border p-3 ${selectedClip?.id === clip.id ? 'border-accent bg-accent-light' : 'border-border bg-background hover:bg-surface-muted'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
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

        <aside className="space-y-4">
          <section className="rounded-card border border-border bg-surface p-4 shadow-card">
            <div className="flex items-center gap-2">
              <Scissors className="h-4 w-4 text-accent" />
              <h2 className="font-display text-lg font-bold text-foreground">Create point clip</h2>
            </div>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-1 text-xs font-bold uppercase tracking-label text-muted">
                Title
                <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Backhand under pressure" className="rounded-lg border border-border bg-background px-3 py-2 text-sm normal-case tracking-normal" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1 text-xs font-bold uppercase tracking-label text-muted">
                  Start
                  <input value={startInput} onChange={(event) => updateStartFromInput(event.target.value)} placeholder="12.4" className="rounded-lg border border-border bg-background px-3 py-2 text-sm normal-case tracking-normal" />
                </label>
                <label className="grid gap-1 text-xs font-bold uppercase tracking-label text-muted">
                  End
                  <input value={endInput} onChange={(event) => updateEndFromInput(event.target.value)} placeholder="19.8" className="rounded-lg border border-border bg-background px-3 py-2 text-sm normal-case tracking-normal" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="grid gap-1 text-xs font-bold uppercase tracking-label text-muted">
                  Result
                  <select value={pointResult} onChange={(event) => setPointResult(event.target.value as Clip['pointResult'])} className="rounded-lg border border-border bg-background px-3 py-2 text-sm normal-case tracking-normal">
                    <option value="unknown">Unknown</option>
                    <option value="won">Won</option>
                    <option value="lost">Lost</option>
                  </select>
                </label>
                <label className="grid gap-1 text-xs font-bold uppercase tracking-label text-muted">
                  Context
                  <select value={shotContext} onChange={(event) => setShotContext(event.target.value as ShotContext)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm normal-case tracking-normal">
                    {shotContexts.map((context) => <option key={context} value={context}>{label(context)}</option>)}
                  </select>
                </label>
              </div>
              <label className="grid gap-1 text-xs font-bold uppercase tracking-label text-muted">
                Ending
                <select value={pointEnding} onChange={(event) => setPointEnding(event.target.value as PointEnding)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm normal-case tracking-normal">
                  {pointEndings.map((ending) => <option key={ending} value={ending}>{label(ending)}</option>)}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-bold uppercase tracking-label text-muted">
                Score / situation
                <input value={scoreContext} onChange={(event) => setScoreContext(event.target.value)} placeholder="30-30, break point, tiebreak..." className="rounded-lg border border-border bg-background px-3 py-2 text-sm normal-case tracking-normal" />
              </label>
              <label className="grid gap-1 text-xs font-bold uppercase tracking-label text-muted">
                Notes
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="What happened in this point?" rows={4} className="rounded-lg border border-border bg-background px-3 py-2 text-sm normal-case tracking-normal" />
              </label>
              <label className="grid gap-1 text-xs font-bold uppercase tracking-label text-muted">
                Tags
                <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="return, pressure, forehand" className="rounded-lg border border-border bg-background px-3 py-2 text-sm normal-case tracking-normal" />
              </label>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {pointPresets.map((preset) => (
                <button key={preset.label} type="button" onClick={() => applyPreset(preset)} className="rounded-lg border border-border bg-background px-3 py-2 text-left text-xs font-semibold text-foreground hover:border-accent hover:bg-accent-light">
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
              <div><dt className="font-medium text-foreground">Source videos</dt><dd className="break-all">{storage.sourceVideos}</dd></div>
              <div><dt className="font-medium text-foreground">Clip exports</dt><dd className="break-all">{storage.exportedClips}</dd></div>
              <div><dt className="font-medium text-foreground">Reel exports</dt><dd className="break-all">{storage.exportedReels}</dd></div>
              <div><dt className="font-medium text-foreground">Metadata</dt><dd className="break-all">{storage.metadata}</dd></div>
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
      <div className="grid min-h-[320px] place-items-center rounded-lg border border-border bg-background p-6 text-center text-muted">
        <div>
          <Film className="mx-auto mb-3 h-8 w-8" />
          <p className="text-sm">Save a point clip to review it here.</p>
        </div>
      </div>
    )
  }

  return (
    <aside className="rounded-lg border border-border bg-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-label text-muted">Selected clip</p>
          <h2 className="font-display text-xl font-bold text-foreground">{selectedClip.title}</h2>
          <p className="mt-1 text-sm text-muted">{formatMs(selectedClip.startMs)} - {formatMs(selectedClip.endMs)} · {selectedClip.pointResult} · {label(selectedClip.pointEnding)}</p>
        </div>
        <button type="button" onClick={exportSelectedClip} disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
          <Download className="h-4 w-4" />
          Export
        </button>
      </div>

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
        <p className="mt-4 rounded-lg border border-border bg-surface p-3 text-sm text-muted">Export this clip to preview media, build a reel crop path, or send selected clip AI review.</p>
      )}

      <div className="mt-4 grid gap-3 rounded-lg border border-border bg-surface p-3">
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
            <div key={keyframe.id || `${keyframe.timestampMs}-${keyframe.xPercent}`} className="flex items-center justify-between rounded border border-border bg-background px-2 py-1 text-xs text-muted">
              <span>{formatMs(keyframe.timestampMs)}</span>
              <span>{Math.round(keyframe.xPercent * 100)}%</span>
            </div>
          ))}
        </div>
        <button type="button" onClick={exportSelectedReel} disabled={busy || !selectedClip.exportedClipPath || reelKeyframes.length < 2} className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">Export 9:16 reel</button>
      </div>

      <div className="mt-4 rounded-lg border border-border bg-surface p-3">
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
