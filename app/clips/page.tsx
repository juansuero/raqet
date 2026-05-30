'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/PageHeader'
import { analyzeSavedClip, createClip, deleteClip, exportClip, exportReel, importVideo, loadClips, loadVideos, updateClip } from '@/lib/api'
import type { Clip, LocalVideo, PointEnding, ReelKeyframe, ShotContext } from '@/lib/data'
import { Brain, Download, Scissors, Trash2, Upload, Video } from 'lucide-react'

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

function formatMs(ms = 0) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`
}

function currentVideoMs(video: HTMLVideoElement | null) {
  return Math.round((video?.currentTime || 0) * 1000)
}

function tagsFromText(value: string) {
  return value.split(',').map((tag) => tag.trim()).filter(Boolean)
}

export default function ClipsPage() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const clipVideoRef = useRef<HTMLVideoElement>(null)
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
  const [title, setTitle] = useState('')
  const [pointResult, setPointResult] = useState<Clip['pointResult']>('unknown')
  const [pointEnding, setPointEnding] = useState<PointEnding>('other')
  const [shotContext, setShotContext] = useState<ShotContext>('rally')
  const [scoreContext, setScoreContext] = useState('')
  const [notes, setNotes] = useState('')
  const [tags, setTags] = useState('')
  const [reelKeyframes, setReelKeyframes] = useState<ReelKeyframe[]>([])
  const [crop, setCrop] = useState(0.5)

  const selectedVideo = useMemo(() => videos.find((video) => video.id === selectedVideoId) || videos[0], [selectedVideoId, videos])
  const selectedClip = useMemo(() => clips.find((clip) => clip.id === selectedClipId) || clips[0], [selectedClipId, clips])
  const selectedVideoClips = selectedVideo ? clips.filter((clip) => clip.localVideoId === selectedVideo.id) : []

  const refresh = async () => {
    const [videoData, clipData] = await Promise.all([loadVideos(), loadClips()])
    setVideos(videoData?.videos ?? [])
    setStorage(videoData?.storage ?? {})
    setClips(clipData ?? [])
    if (!selectedVideoId && videoData?.videos?.[0]) setSelectedVideoId(videoData.videos[0].id)
    if (!selectedClipId && clipData?.[0]) setSelectedClipId(clipData[0].id)
  }

  useEffect(() => {
    refresh()
  }, [])

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
    }
  }

  const savePoint = async () => {
    if (!selectedVideo) return setError('Import a source video before saving a point.')
    if (startMs === null || endMs === null || endMs <= startMs) return setError('Mark a valid start and end before saving.')
    const clip: Clip = {
      id: crypto.randomUUID(),
      sessionId: '',
      playerId: 'solo',
      localVideoId: selectedVideo.id,
      startMs,
      endMs,
      title: title || `Point ${formatMs(startMs)}`,
      videoUrl: `/api/videos/${selectedVideo.id}/file`,
      thumbnailUrl: '',
      durationSeconds: Math.round((endMs - startMs) / 1000),
      clipType: shotContext === 'serve' ? 'serve' : shotContext === 'return' ? 'return' : 'rally',
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
    setBusy(true)
    setError('')
    try {
      const saved = await createClip(clip)
      await refresh()
      setSelectedClipId(saved?.id || clip.id)
      setStatus('Point metadata saved locally. Source video was not sent to AI.')
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
      ...prev.filter((item) => Math.abs(item.timestampMs - currentVideoMs(clipVideoRef.current)) > 250),
      { id: crypto.randomUUID(), timestampMs: currentVideoMs(clipVideoRef.current), xPercent: crop },
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
    setStatus('Clip metadata deleted. Source video and exported files were left in storage.')
  }

  return (
    <AppShell title="Video Library" subtitle="Local video review, point clips, and reel exports">
      <PageHeader title="Video Library" subtitle={`${videos.length} videos, ${clips.length} clips`} />

      <div className="mb-6 rounded-card border border-border bg-surface p-4 text-sm leading-6 text-muted shadow-card">
        Full source videos are copied into this self-hosted instance and are never uploaded to an AI provider automatically. Metadata lives in SQLite.
      </div>

      {error && <p className="mb-4 rounded-lg border border-danger/20 bg-danger/5 p-3 text-sm text-danger">{error}</p>}
      {status && <p className="mb-4 rounded-lg border border-accent/20 bg-accent-light p-3 text-sm text-foreground">{status}</p>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="space-y-4">
          <div className="rounded-card border border-border bg-surface p-4 shadow-card">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white">
              <Upload className="h-4 w-4" />
              Import local video
              <input type="file" accept="video/mp4,video/mov,video/quicktime,video/mpeg,video/webm" className="hidden" onChange={(event) => handleImport(event.target.files?.[0] ?? null)} />
            </label>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {videos.map((video) => (
                <button key={video.id} type="button" onClick={() => setSelectedVideoId(video.id)} className={`rounded-lg border px-3 py-2 text-left text-sm ${selectedVideo?.id === video.id ? 'border-accent bg-accent-light text-foreground' : 'border-border text-muted hover:bg-background'}`}>
                  <span className="block truncate font-medium">{video.fileName}</span>
                  <span className="text-xs">{video.durationMs ? formatMs(video.durationMs) : 'Duration unknown'}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-card border border-border bg-black shadow-card">
            {selectedVideo ? (
              <video ref={videoRef} src={`/api/videos/${selectedVideo.id}/file`} controls className="aspect-video w-full bg-black" />
            ) : (
              <div className="grid aspect-video place-items-center text-muted">
                <div className="text-center">
                  <Video className="mx-auto mb-3 h-8 w-8" />
                  <p>Import an MP4, MOV, MPEG, MPG, or WebM file.</p>
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-4 rounded-card border border-border bg-surface p-4 shadow-card lg:grid-cols-2">
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">Mark point</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => setStartMs(currentVideoMs(videoRef.current))} className="rounded-lg border border-border px-3 py-2 text-sm">Mark start [{formatMs(startMs ?? 0)}]</button>
                <button type="button" onClick={() => setEndMs(currentVideoMs(videoRef.current))} className="rounded-lg border border-border px-3 py-2 text-sm">Mark end [{formatMs(endMs ?? 0)}]</button>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Clip title" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                <input value={scoreContext} onChange={(event) => setScoreContext(event.target.value)} placeholder="Score/context" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                <select value={pointResult} onChange={(event) => setPointResult(event.target.value as Clip['pointResult'])} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  <option value="unknown">Unknown</option>
                  <option value="won">Won</option>
                  <option value="lost">Lost</option>
                </select>
                <select value={pointEnding} onChange={(event) => setPointEnding(event.target.value as PointEnding)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  {pointEndings.map((ending) => <option key={ending} value={ending}>{ending.replaceAll('_', ' ')}</option>)}
                </select>
                <select value={shotContext} onChange={(event) => setShotContext(event.target.value as ShotContext)} className="rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  {shotContexts.map((context) => <option key={context} value={context}>{context.replaceAll('_', ' ')}</option>)}
                </select>
                <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="tags, comma separated" className="rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </div>
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Point notes" rows={3} className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              <button type="button" disabled={busy || !selectedVideo} onClick={savePoint} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">
                <Scissors className="h-4 w-4" />
                Save point metadata
              </button>
            </div>

            <div>
              <h2 className="font-display text-lg font-bold text-foreground">Storage</h2>
              <dl className="mt-3 space-y-2 text-xs text-muted">
                <div><dt className="font-medium text-foreground">Source videos</dt><dd className="break-all">{storage.sourceVideos}</dd></div>
                <div><dt className="font-medium text-foreground">Clip exports</dt><dd className="break-all">{storage.exportedClips}</dd></div>
                <div><dt className="font-medium text-foreground">Reel exports</dt><dd className="break-all">{storage.exportedReels}</dd></div>
                <div><dt className="font-medium text-foreground">Metadata</dt><dd className="break-all">{storage.metadata}</dd></div>
              </dl>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-card border border-border bg-surface p-4 shadow-card">
            <h2 className="font-display text-lg font-bold text-foreground">Saved clips</h2>
            <div className="mt-3 space-y-2">
              {selectedVideoClips.length === 0 ? (
                <p className="text-sm text-muted">No clips saved for this video yet.</p>
              ) : selectedVideoClips.map((clip) => (
                <button key={clip.id} type="button" onClick={() => { setSelectedClipId(clip.id); setReelKeyframes(clip.reelKeyframes || []) }} className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${selectedClip?.id === clip.id ? 'border-accent bg-accent-light' : 'border-border hover:bg-background'}`}>
                  <span className="block font-medium text-foreground">{clip.title}</span>
                  <span className="text-xs text-muted">{formatMs(clip.startMs)} - {formatMs(clip.endMs)} · {clip.pointResult} · {clip.pointEnding}</span>
                </button>
              ))}
            </div>
          </section>

          {selectedClip && (
            <section className="rounded-card border border-border bg-surface p-4 shadow-card">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-bold text-foreground">{selectedClip.title}</h2>
                  <p className="text-sm text-muted">{formatMs(selectedClip.startMs)} - {formatMs(selectedClip.endMs)}</p>
                </div>
                <button type="button" onClick={() => removeSelectedClip(selectedClip)} className="rounded-lg border border-danger/30 p-2 text-danger">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {selectedClip.exportedClipPath ? (
                <video ref={clipVideoRef} src={`/api/clips/${selectedClip.id}/media`} controls className="mt-4 aspect-video w-full rounded-lg bg-black" />
              ) : (
                <p className="mt-4 rounded-lg border border-border bg-background p-3 text-sm text-muted">Export the clip to preview exported media and build a reel crop path.</p>
              )}

              <button type="button" onClick={exportSelectedClip} disabled={busy} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">
                <Download className="h-4 w-4" />
                Export standard clip
              </button>

              <div className="mt-4 rounded-lg border border-border bg-background p-3">
                <h3 className="font-display text-sm font-bold uppercase tracking-label text-foreground">Optional AI review</h3>
                <p className="mt-2 text-xs leading-5 text-muted">
                  Sends only this exported short clip plus its point metadata to your configured external AI provider. It never sends the source full-match video.
                </p>
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

              <div className="mt-5 rounded-lg border border-border bg-background p-3">
                <h3 className="font-display text-sm font-bold uppercase tracking-label text-foreground">9:16 reel crop</h3>
                <label className="mt-3 block text-xs font-medium text-muted">Crop position</label>
                <input type="range" min="0" max="1" step="0.01" value={crop} onChange={(event) => setCrop(Number(event.target.value))} className="w-full" />
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={addReelKeyframe} disabled={!selectedClip.exportedClipPath} className="rounded-lg border border-border px-3 py-2 text-sm disabled:opacity-50">Add keyframe</button>
                  <button type="button" onClick={exportSelectedReel} disabled={busy || reelKeyframes.length < 2} className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50">Export reel</button>
                </div>
                <div className="mt-3 space-y-2">
                  {reelKeyframes.map((keyframe) => (
                    <div key={keyframe.id || `${keyframe.timestampMs}-${keyframe.xPercent}`} className="flex items-center justify-between rounded border border-border px-2 py-1 text-xs text-muted">
                      <span>{formatMs(keyframe.timestampMs)}</span>
                      <span>{Math.round(keyframe.xPercent * 100)}%</span>
                    </div>
                  ))}
                </div>
                {selectedClip.exportedReelPath && (
                  <video src={`/api/clips/${selectedClip.id}/media?kind=reel`} controls className="mt-4 aspect-[9/16] max-h-[520px] w-full rounded-lg bg-black object-contain" />
                )}
              </div>
            </section>
          )}
        </aside>
      </div>
    </AppShell>
  )
}
