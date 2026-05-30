import { NextResponse } from 'next/server'
import { soloExport } from '@/lib/solo-store'

export async function GET() {
  return NextResponse.json(soloExport())
}
