'use client'

import { useRef, useState } from 'react'
import { Check, Mic, Square, Upload, X } from 'lucide-react'
import { transcribeVoiceAnswer } from '@/lib/api'

type Props = {
  onTranscript: (transcript: string) => void
  eventType?: 'onboarding_transcription' | 'session_transcription'
}

export function VoiceAnswerInput({ onTranscript, eventType = 'onboarding_transcription' }: Props) {
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const [recording, setRecording] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [draftTranscript, setDraftTranscript] = useState('')

  const transcribe = async (blob: Blob) => {
    setLoading(true)
    setError('')

    try {
      const data = await transcribeVoiceAnswer(blob, eventType)
      if (data?.transcript) setDraftTranscript(data.transcript)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not transcribe audio')
    } finally {
      setLoading(false)
    }
  }

  const startRecording = async () => {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop())
        transcribe(new Blob(chunksRef.current, { type: 'audio/webm' }))
      }

      recorderRef.current = recorder
      recorder.start()
      setRecording(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Microphone access failed')
    }
  }

  const stopRecording = () => {
    recorderRef.current?.stop()
    setRecording(false)
  }

  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={recording ? stopRecording : startRecording}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-xs font-medium text-foreground hover:bg-background transition-colors disabled:opacity-50"
        >
          {recording ? <Square className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
          {recording ? 'Stop' : loading ? 'Transcribing...' : 'Record answer'}
        </button>
        <label className="inline-flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-xs font-medium text-foreground hover:bg-background transition-colors cursor-pointer">
          <Upload className="w-3 h-3" />
          Upload audio
          <input
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) transcribe(file)
            }}
          />
        </label>
      </div>

      {draftTranscript && (
        <div className="border border-border rounded-lg bg-background p-3">
          <label className="block text-[10px] font-medium tracking-label uppercase text-muted mb-2">
            Review transcript before adding it
          </label>
          <textarea
            value={draftTranscript}
            onChange={(event) => setDraftTranscript(event.target.value)}
            rows={4}
            className="w-full px-3 py-2.5 bg-surface border border-border rounded-lg text-sm outline-none focus:border-accent resize-y"
          />
          <div className="flex flex-col sm:flex-row gap-2 mt-3">
            <button
              type="button"
              onClick={() => {
                const cleaned = draftTranscript.trim()
                if (cleaned) onTranscript(cleaned)
                setDraftTranscript('')
              }}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 bg-accent text-white rounded-lg text-xs font-medium hover:bg-accent/90 transition-colors"
            >
              <Check className="w-3 h-3" />
              Add to Answer
            </button>
            <button
              type="button"
              onClick={() => setDraftTranscript('')}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 border border-border rounded-lg text-xs font-medium text-foreground hover:bg-surface transition-colors"
            >
              <X className="w-3 h-3" />
              Discard
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  )
}
