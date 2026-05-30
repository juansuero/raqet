import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ error: 'Google Calendar sync is disabled in the self-hosted solo build.' }, { status: 404 })
}
