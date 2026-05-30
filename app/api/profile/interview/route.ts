import { NextResponse } from 'next/server'
import { playerFromCompiledProfile, playerFromInterview } from '@/lib/player-profile'
import { loadSoloPlayer, saveSoloPlayer } from '@/lib/solo-store'

export async function POST(request: Request) {
  const { answers, player, compiledProfile } = await request.json()
  const basePlayer = {
    ...loadSoloPlayer(),
    ...player,
  }
  const nextPlayer = compiledProfile
    ? playerFromCompiledProfile(basePlayer, answers || {}, compiledProfile)
    : playerFromInterview(basePlayer, answers || {})

  return NextResponse.json(saveSoloPlayer(nextPlayer))
}
