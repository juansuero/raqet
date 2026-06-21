'use client'

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, CheckCircle, Loader2, Save, Upload } from 'lucide-react'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/PageHeader'
import { currentPlayer } from '@/lib/data'
import { compilePlayerProfileDraft, loadPlayer, savePlayerInterview } from '@/lib/api'
import { playerInterviewQuestions, type CompiledPlayerProfile, type PlayerInterviewAnswers } from '@/lib/player-profile'
import { VoiceAnswerInput } from '@/components/VoiceAnswerInput'

const onboardingDraftKey = 'raqet:onboarding-draft:v1'

export default function OnboardingPage() {
  const router = useRouter()
  const [player, setPlayer] = useState(currentPlayer)
  const [answers, setAnswers] = useState<PlayerInterviewAnswers>({})
  const [compiledProfile, setCompiledProfile] = useState<CompiledPlayerProfile | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [reviewing, setReviewing] = useState(false)
  const [compiling, setCompiling] = useState(false)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [draggingImport, setDraggingImport] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [loadedDraft, setLoadedDraft] = useState(false)
  const questionCardRef = useRef<HTMLElement | null>(null)
  const importInputRef = useRef<HTMLInputElement | null>(null)

  const currentQuestion = playerInterviewQuestions[currentIndex]
  const isFirst = currentIndex === 0
  const isLast = currentIndex === playerInterviewQuestions.length - 1

  const interviewAnswers = (raw: Record<string, unknown> | undefined): PlayerInterviewAnswers => {
    return playerInterviewQuestions.reduce<PlayerInterviewAnswers>((acc, question) => {
      const value = raw?.[question.id]
      if (typeof value === 'string') acc[question.id] = value
      return acc
    }, {})
  }

  useEffect(() => {
    loadPlayer()
      .then((loaded) => {
        if (!loaded) return
        setPlayer(loaded)
        setAnswers((prev) => ({ ...interviewAnswers(loaded.profileInterviewAnswers), ...prev }))
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Player profile could not load.'))
  }, [])

  useEffect(() => {
    try {
      const rawDraft = window.localStorage.getItem(onboardingDraftKey)
      if (!rawDraft) {
        setLoadedDraft(true)
        return
      }

      const draft = JSON.parse(rawDraft) as {
        answers?: Record<string, unknown>
        currentIndex?: unknown
      }

      setAnswers((prev) => ({ ...prev, ...interviewAnswers(draft.answers) }))
      if (typeof draft.currentIndex === 'number') {
        setCurrentIndex(Math.max(0, Math.min(playerInterviewQuestions.length - 1, draft.currentIndex)))
      }
    } catch {
      window.localStorage.removeItem(onboardingDraftKey)
    } finally {
      setLoadedDraft(true)
    }
  }, [])

  useEffect(() => {
    if (!loadedDraft || saved) return
    window.localStorage.setItem(onboardingDraftKey, JSON.stringify({ answers, currentIndex }))
  }, [answers, currentIndex, loadedDraft, saved])

  const answeredCount = useMemo(
    () => playerInterviewQuestions.filter((question) => answers[question.id]?.trim()).length,
    [answers]
  )

  const progress = Math.round(((currentIndex + 1) / playerInterviewQuestions.length) * 100)

  const handleAnswer = (id: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [id]: value }))
    setCompiledProfile(null)
    setReviewing(false)
    setSaved(false)
  }

  const scrollToQuestion = () => {
    window.requestAnimationFrame(() => {
      questionCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const goToQuestion = (nextIndex: number) => {
    setCurrentIndex(Math.max(0, Math.min(playerInterviewQuestions.length - 1, nextIndex)))
    scrollToQuestion()
  }

  const appendTranscript = (transcript: string) => {
    const current = answers[currentQuestion.id]?.trim()
    handleAnswer(currentQuestion.id, current ? `${current}\n${transcript}` : transcript)
  }

  const importFile = async (file: File) => {
    const confirmed = window.confirm('Import this Raqet export into your local self-hosted database? Existing records with the same IDs will be updated.')
    if (!confirmed) return

    setImporting(true)
    setError('')
    try {
      const data = JSON.parse(await file.text())
      const response = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(typeof body?.error === 'string' ? body.error : 'Import failed')
      }

      window.localStorage.removeItem(onboardingDraftKey)
      router.push('/dashboard')
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const importData = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) await importFile(file)
  }

  const allowImportDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    if (!importing) setDraggingImport(true)
  }

  const endImportDrag = () => {
    setDraggingImport(false)
  }

  const dropImportFile = async (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    setDraggingImport(false)
    if (importing) return
    const file = event.dataTransfer.files?.[0]
    if (file) await importFile(file)
  }

  const updateCompiledField = (
    field: keyof CompiledPlayerProfile,
    value: string | string[] | number | undefined
  ) => {
    setCompiledProfile((prev) => (prev ? { ...prev, [field]: value } : prev))
    setSaved(false)
  }

  const compileDraft = async () => {
    setCompiling(true)
    setError('')
    const compiled = await compilePlayerProfileDraft(player, answers)
    if (compiled) {
      setCompiledProfile(compiled)
      setReviewing(true)
    } else {
      setError('Could not compile your Player Profile. Try again, or save the profile without AI review.')
    }
    setCompiling(false)
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    const updated = await savePlayerInterview(player, answers, compiledProfile ?? undefined)
    if (updated) {
      window.localStorage.removeItem(onboardingDraftKey)
      setPlayer(updated)
      setAnswers(interviewAnswers(updated.profileInterviewAnswers))
      setSaved(true)
      router.push('/dashboard')
    } else {
      setError('Could not save your Player Profile.')
    }
    setSaving(false)
  }

  if (reviewing && compiledProfile) {
    return (
      <AppShell title="Review Player Profile" subtitle="Edit the AI-structured draft before saving it">
        <PageHeader
          title="Review Player Profile"
          subtitle="Raqet has structured your answers. Review the draft carefully before it becomes permanent profile context."
          action={
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-60"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Approve & Save'}
            </button>
          }
        />

        <div className="grid lg:grid-cols-[1fr_360px] gap-6">
          <section className="bg-surface border border-border rounded-card shadow-card p-5 sm:p-6 space-y-5">
            <div>
              <label className="block text-xs font-medium tracking-label uppercase text-muted mb-1.5">Profile Summary</label>
              <textarea
                value={compiledProfile.profileSummary}
                onChange={(event) => updateCompiledField('profileSummary', event.target.value)}
                rows={5}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm leading-relaxed outline-none focus:border-accent resize-y"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium tracking-label uppercase text-muted mb-1.5">Playing Style</label>
                <input
                  value={compiledProfile.playingStyle}
                  onChange={(event) => updateCompiledField('playingStyle', event.target.value)}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium tracking-label uppercase text-muted mb-1.5">Current Goal</label>
                <input
                  value={compiledProfile.currentGoal}
                  onChange={(event) => updateCompiledField('currentGoal', event.target.value)}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-accent"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium tracking-label uppercase text-muted mb-1.5">Preferred Surface</label>
                <select
                  value={compiledProfile.preferredSurface ?? ''}
                  onChange={(event) => updateCompiledField('preferredSurface', event.target.value)}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-accent"
                >
                  <option value="">Not set</option>
                  <option value="Hard">Hard</option>
                  <option value="Grass">Grass</option>
                  <option value="Clay">Clay</option>
                  <option value="Carpet">Carpet</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium tracking-label uppercase text-muted mb-1.5">Weekly Frequency</label>
                <input
                  type="number"
                  min={0}
                  value={compiledProfile.weeklyTrainingFrequency ?? 0}
                  onChange={(event) => updateCompiledField('weeklyTrainingFrequency', Number(event.target.value))}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-accent"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium tracking-label uppercase text-muted mb-1.5">Strengths</label>
                <textarea
                  value={compiledProfile.strengths.join('\n')}
                  onChange={(event) => updateCompiledField('strengths', event.target.value.split('\n').map((item) => item.trim()).filter(Boolean))}
                  rows={5}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm leading-relaxed outline-none focus:border-accent resize-y"
                />
              </div>
              <div>
                <label className="block text-xs font-medium tracking-label uppercase text-muted mb-1.5">Weaknesses</label>
                <textarea
                  value={compiledProfile.weaknesses.join('\n')}
                  onChange={(event) => updateCompiledField('weaknesses', event.target.value.split('\n').map((item) => item.trim()).filter(Boolean))}
                  rows={5}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm leading-relaxed outline-none focus:border-accent resize-y"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium tracking-label uppercase text-muted mb-1.5">Profile Markdown</label>
              <textarea
                value={compiledProfile.profileMarkdown}
                onChange={(event) => updateCompiledField('profileMarkdown', event.target.value)}
                rows={14}
                className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-xs leading-relaxed font-mono outline-none focus:border-accent resize-y"
              />
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}

            <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setReviewing(false)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-background transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Answers
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : 'Approve & Save'}
              </button>
            </div>
          </section>

          <aside className="bg-accent-light border border-accent/20 rounded-card p-5 h-fit">
            <h2 className="font-display text-lg font-bold text-foreground">Review Before Saving</h2>
            <p className="text-sm text-muted leading-relaxed mt-2">
              The AI is organizing your answers into durable profile context. Edit anything that feels wrong, too confident, or not useful for future debriefs.
            </p>
          </aside>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell title="Player Profile" subtitle="Build the context Raqet uses to understand your game">
      <PageHeader
        title="Player Profile"
        subtitle="Answer one prompt at a time. Record, review, edit, then save when the profile reflects you."
        action={
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-60"
          >
            {saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : saved ? 'Saved' : 'Save Profile'}
          </button>
        }
      />

      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        <section ref={questionCardRef} className="space-y-4">
          {isFirst && (
            <div
              onDragEnter={allowImportDrop}
              onDragOver={allowImportDrop}
              onDragLeave={endImportDrag}
              onDrop={dropImportFile}
              className={`rounded-card border bg-surface p-5 shadow-card transition-colors sm:p-6 ${draggingImport ? 'border-accent bg-accent-light' : 'border-border'}`}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="font-display text-xl font-bold text-foreground">Already used Raqet?</h2>
                  <p className="mt-2 max-w-[58ch] text-sm leading-relaxed text-muted">
                    Drop a Raqet hosted or self-hosted JSON export here, or choose a file instead of rebuilding your profile from scratch.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => importInputRef.current?.click()}
                  disabled={importing}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-background disabled:opacity-50"
                >
                  {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {importing ? 'Importing...' : 'Import JSON'}
                </button>
              </div>
              <input ref={importInputRef} type="file" accept="application/json,.json" onChange={importData} className="hidden" />
            </div>
          )}

          <div className="bg-surface border border-border rounded-card shadow-card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <p className="text-xs font-medium tracking-label uppercase text-muted">
              Question {currentIndex + 1} of {playerInterviewQuestions.length}
            </p>
            <p className="text-xs text-muted">{answeredCount} answered</p>
          </div>

          <div className="h-2 bg-background border border-border rounded-full overflow-hidden mb-6">
            <div
              className="h-full w-full origin-left bg-accent transition-transform"
              style={{ transform: `scaleX(${progress / 100})` }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium tracking-label uppercase text-muted mb-2">
              {currentQuestion.label}
            </label>
            <h2 className="font-display text-2xl font-bold text-foreground leading-tight">
              {currentQuestion.question}
            </h2>
            <textarea
              value={answers[currentQuestion.id] ?? ''}
              onChange={(event) => handleAnswer(currentQuestion.id, event.target.value)}
              rows={8}
              className="mt-5 w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm leading-relaxed outline-none focus:border-accent resize-y"
              placeholder="Write your answer here, or record audio and review the transcript before adding it."
            />
            <VoiceAnswerInput onTranscript={appendTranscript} />
          </div>

          <div className="mt-6 pt-5 border-t border-border">
            <p className="mb-3 text-xs font-medium tracking-label uppercase text-muted" aria-live="polite">
              Question {currentIndex + 1} of {playerInterviewQuestions.length} · {currentQuestion.label}
            </p>
            <div className="flex flex-col sm:flex-row justify-between gap-3">
              <button
                type="button"
                onClick={() => goToQuestion(currentIndex - 1)}
                disabled={isFirst}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-background transition-colors disabled:opacity-40"
              >
                <ArrowLeft className="w-4 h-4" />
                Previous
              </button>
              {isLast ? (
              <button
                type="button"
                onClick={compileDraft}
                disabled={compiling}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                {compiling ? 'Structuring...' : 'Review AI Draft'}
              </button>
              ) : (
              <button
                type="button"
                onClick={() => goToQuestion(currentIndex + 1)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors"
              >
                Next
                <ArrowRight className="w-4 h-4" />
              </button>
              )}
            </div>
          </div>
          {error && <p className="text-sm text-danger mt-3">{error}</p>}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="bg-surface border border-border rounded-card shadow-card p-5">
            <h2 className="font-display text-lg font-bold text-foreground">
              Progress
            </h2>
            <div className="mt-4 space-y-2">
              {playerInterviewQuestions.map((question, index) => (
                <button
                  key={question.id}
                  type="button"
                  onClick={() => goToQuestion(index)}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    index === currentIndex
                      ? 'bg-accent-light text-accent'
                      : 'text-muted hover:bg-background hover:text-foreground'
                  }`}
                >
                  <span className="text-sm font-medium truncate">{question.label}</span>
                  {answers[question.id]?.trim() && <CheckCircle className="w-4 h-4 flex-shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-surface border border-border rounded-card shadow-card p-5">
            <h2 className="font-display text-lg font-bold text-foreground mb-3">
              Current Player Profile
            </h2>
            <pre className="text-xs text-foreground bg-background border border-border rounded-lg p-3 whitespace-pre-wrap max-h-[360px] overflow-auto">
              {player.profileMarkdown || 'Save the interview to generate your player profile context.'}
            </pre>
            <Link
              href="/profile"
              className="mt-4 inline-flex text-sm text-accent hover:underline font-medium"
            >
              Back to profile
            </Link>
          </div>
        </aside>
      </div>
    </AppShell>
  )
}
