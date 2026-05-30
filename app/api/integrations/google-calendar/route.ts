import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ connected: false, connection: null, disabled: true })
}

export async function DELETE() {
  return NextResponse.json({ ok: true })
}
