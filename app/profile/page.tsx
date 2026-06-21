'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AppShell } from '@/components/AppShell'
import { PageHeader } from '@/components/PageHeader'
import { currentPlayer } from '@/lib/data'
import { loadPlayer, savePlayer } from '@/lib/api'
import { Save, CheckCircle } from 'lucide-react'

const preferredSurfaceOptions = ['Hard', 'Grass', 'Clay', 'Carpet', 'Other']

export default function ProfilePage() {
  const [player, setPlayer] = useState(currentPlayer)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadPlayer()
      .then((loaded) => {
        if (loaded) setPlayer(loaded)
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Player profile could not load.'))
  }, [])

  const handleChange = (field: string, value: string | string[] | number | undefined) => {
    setPlayer((prev) => ({ ...prev, [field]: value }))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const savedPlayer = await savePlayer(player)
      if (savedPlayer) {
        setPlayer(savedPlayer)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      } else {
        setError('Could not save player profile.')
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save player profile.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AppShell title="Profile" subtitle="Your player profile and preferences">
      <PageHeader
        title="Player Profile"
        action={
          <div className="flex gap-2">
            <Link
              href="/onboarding"
              className="inline-flex items-center gap-2 px-4 py-2.5 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-background transition-colors"
            >
              Review Interview
            </Link>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-accent text-white rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors disabled:opacity-60"
            >
              {saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
            </button>
          </div>
        }
      />

      <div className="readable-panel bg-surface border border-border rounded-card shadow-card p-6">
        {error && <p className="mb-4 rounded-lg border border-danger/20 bg-danger/5 p-3 text-sm text-danger">{error}</p>}
        {/* Avatar & Name */}
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-border">
          <div className="w-16 h-16 rounded-full bg-accent text-white flex items-center justify-center text-xl font-bold">
            {player.name.split(' ').map((n) => n[0]).join('')}
          </div>
          <div>
            <label className="block text-xs font-medium tracking-label uppercase text-muted mb-1.5">Name</label>
            <input
              type="text"
              value={player.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-accent font-semibold"
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium tracking-label uppercase text-muted mb-1.5">UTR Singles</label>
            <input
              type="number"
              step="0.1"
              value={player.utrSingles ?? ''}
              onChange={(e) => handleChange('utrSingles', e.target.value ? parseFloat(e.target.value) : undefined)}
              className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium tracking-label uppercase text-muted mb-1.5">UTR Doubles</label>
            <input
              type="number"
              step="0.1"
              value={player.utrDoubles ?? ''}
              onChange={(e) => handleChange('utrDoubles', e.target.value ? parseFloat(e.target.value) : undefined)}
              className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium tracking-label uppercase text-muted mb-1.5">WTN Singles</label>
            <input
              type="number"
              step="0.1"
              value={player.wtnSingles ?? ''}
              onChange={(e) => handleChange('wtnSingles', e.target.value ? parseFloat(e.target.value) : undefined)}
              className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium tracking-label uppercase text-muted mb-1.5">WTN Doubles</label>
            <input
              type="number"
              step="0.1"
              value={player.wtnDoubles ?? ''}
              onChange={(e) => handleChange('wtnDoubles', e.target.value ? parseFloat(e.target.value) : undefined)}
              className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium tracking-label uppercase text-muted mb-1.5">Dominant Hand</label>
            <select
              value={player.dominantHand}
              onChange={(e) => handleChange('dominantHand', e.target.value)}
              className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-accent"
            >
              <option value="right">Right</option>
              <option value="left">Left</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium tracking-label uppercase text-muted mb-1.5">Backhand</label>
            <select
              value={player.backhandType}
              onChange={(e) => handleChange('backhandType', e.target.value)}
              className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-accent"
            >
              <option value="one-handed">One-handed</option>
              <option value="two-handed">Two-handed</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium tracking-label uppercase text-muted mb-1.5">Playing Style</label>
            <input
              type="text"
              value={player.playingStyle}
              onChange={(e) => handleChange('playingStyle', e.target.value)}
              className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-xs font-medium tracking-label uppercase text-muted mb-1.5">Preferred Surface</label>
            <select
              value={player.preferredSurface}
              onChange={(e) => handleChange('preferredSurface', e.target.value)}
              className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-accent"
            >
              <option value="">Not set</option>
              {preferredSurfaceOptions.map((surface) => (
                <option key={surface} value={surface}>{surface}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium tracking-label uppercase text-muted mb-1.5">Weekly Frequency</label>
            <input
              type="number"
              value={player.weeklyTrainingFrequency}
              onChange={(e) => handleChange('weeklyTrainingFrequency', parseInt(e.target.value))}
              className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-accent"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-xs font-medium tracking-label uppercase text-muted mb-1.5">Current Goal</label>
          <input
            type="text"
            value={player.currentGoal}
            onChange={(e) => handleChange('currentGoal', e.target.value)}
            className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-accent"
          />
        </div>

        <div className="mb-4">
          <label className="block text-xs font-medium tracking-label uppercase text-muted mb-1.5">Strengths (comma separated)</label>
          <input
            type="text"
            value={player.strengths.join(', ')}
            onChange={(e) => handleChange('strengths', e.target.value.split(',').map((s) => s.trim()))}
            className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-accent"
          />
        </div>

        <div className="mb-4">
          <label className="block text-xs font-medium tracking-label uppercase text-muted mb-1.5">Weaknesses (comma separated)</label>
          <input
            type="text"
            value={player.weaknesses.join(', ')}
            onChange={(e) => handleChange('weaknesses', e.target.value.split(',').map((s) => s.trim()))}
            className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-accent"
          />
        </div>

        <div className="mb-4">
          <label className="block text-xs font-medium tracking-label uppercase text-muted mb-1.5">Profile Summary</label>
          <textarea
            value={player.profileSummary}
            onChange={(e) => handleChange('profileSummary', e.target.value)}
            rows={3}
            className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-sm outline-none focus:border-accent resize-y"
          />
        </div>
      </div>
    </AppShell>
  )
}
