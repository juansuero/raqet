import { NextResponse } from 'next/server'
import { listSoloNotifications, markSoloNotificationsRead } from '@/lib/solo-store'

export async function GET() {
  return NextResponse.json(listSoloNotifications())
}

export async function PATCH(request: Request) {
  const body = await request.json()
  markSoloNotificationsRead(typeof body.id === 'string' ? body.id : undefined)
  return NextResponse.json({ ok: true })
}
