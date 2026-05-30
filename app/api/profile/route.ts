import { NextResponse } from 'next/server'
import type { RatingMetricType } from '@/lib/data'
import { loadSoloPlayer, saveSoloPlayer, saveSoloRating } from '@/lib/solo-store'

type RatingProfileField = {
  key: 'utrSingles' | 'utrDoubles' | 'wtnSingles' | 'wtnDoubles'
  metricType: Exclude<RatingMetricType, 'custom_ranking'>
  label: string
  lowerIsBetter: boolean
}

const ratingProfileFields: RatingProfileField[] = [
  { key: 'utrSingles', metricType: 'utr_singles', label: 'UTR Singles', lowerIsBetter: false },
  { key: 'utrDoubles', metricType: 'utr_doubles', label: 'UTR Doubles', lowerIsBetter: false },
  { key: 'wtnSingles', metricType: 'wtn_singles', label: 'WTN Singles', lowerIsBetter: true },
  { key: 'wtnDoubles', metricType: 'wtn_doubles', label: 'WTN Doubles', lowerIsBetter: true },
]

function finiteNumber(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export async function GET() {
  return NextResponse.json(loadSoloPlayer())
}

export async function PUT(request: Request) {
  const previous = loadSoloPlayer()
  const body = await request.json()
  const player = saveSoloPlayer({ ...previous, ...body })

  for (const field of ratingProfileFields) {
    const previousValue = finiteNumber(previous[field.key])
    const currentValue = finiteNumber(player[field.key])
    if (currentValue !== null && previousValue !== currentValue) {
      saveSoloRating({
        playerId: player.id,
        metricType: field.metricType,
        label: field.label,
        value: currentValue,
        eventDate: new Date().toISOString().slice(0, 10),
        lowerIsBetter: field.lowerIsBetter,
        notes: 'Updated from profile',
      })
    }
  }

  return NextResponse.json(player)
}
