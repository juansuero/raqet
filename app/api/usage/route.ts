import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    limit: 0,
    used: 0,
    remaining: 0,
    cycleStart: new Date(0).toISOString(),
    resetAt: new Date(0).toISOString(),
    unlimited: true,
  })
}
