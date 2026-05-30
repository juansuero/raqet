import { NextResponse } from 'next/server'
import type { RatingMetricType } from '@/lib/data'
import { listSoloRatingHistory, loadSoloPlayer, saveSoloPlayer, saveSoloRating } from '@/lib/solo-store'

const metricLabels: Record<RatingMetricType, string> = {
  utr_singles: 'UTR Singles',
  utr_doubles: 'UTR Doubles',
  wtn_singles: 'WTN Singles',
  wtn_doubles: 'WTN Doubles',
  custom_ranking: 'Custom Ranking',
}

const lowerIsBetterByMetric: Record<RatingMetricType, boolean> = {
  utr_singles: false,
  utr_doubles: false,
  wtn_singles: true,
  wtn_doubles: true,
  custom_ranking: true,
}

const profileFieldByMetric: Partial<Record<RatingMetricType, 'utrSingles' | 'utrDoubles' | 'wtnSingles' | 'wtnDoubles'>> = {
  utr_singles: 'utrSingles',
  utr_doubles: 'utrDoubles',
  wtn_singles: 'wtnSingles',
  wtn_doubles: 'wtnDoubles',
}

function isMetricType(value: string): value is RatingMetricType {
  return value in metricLabels
}

export async function GET() {
  return NextResponse.json(listSoloRatingHistory())
}

export async function POST(request: Request) {
  const body = await request.json()
  const metricType = String(body.metricType || '')
  if (!isMetricType(metricType)) return NextResponse.json({ error: 'Invalid ranking metric.' }, { status: 400 })

  const value = Number(body.value)
  if (!Number.isFinite(value)) return NextResponse.json({ error: 'Ranking value must be a number.' }, { status: 400 })

  const eventDate = String(body.eventDate || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return NextResponse.json({ error: 'Event date is required.' }, { status: 400 })

  const entry = saveSoloRating({
    metricType,
    label: metricType === 'custom_ranking' ? String(body.label || 'Custom Ranking').trim() : metricLabels[metricType],
    value,
    eventDate,
    lowerIsBetter: lowerIsBetterByMetric[metricType],
    notes: body.notes ? String(body.notes) : undefined,
  })

  const profileField = profileFieldByMetric[metricType]
  if (profileField) {
    const player = loadSoloPlayer()
    saveSoloPlayer({ ...player, [profileField]: value })
  }

  return NextResponse.json(entry, { status: 201 })
}
