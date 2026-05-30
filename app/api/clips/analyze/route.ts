import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: 'Raw video AI analysis is disabled in the self-hosted local-first build. Export a short clip manually before using any external AI workflow.' },
    { status: 404 }
  )
}
