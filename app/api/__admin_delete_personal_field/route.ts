import { NextRequest, NextResponse } from 'next/server'
import { deleteKycPersonalField } from '@/app/actions/admin'

export async function POST(req: NextRequest) {
  try {
    const { userId, field } = await req.json()
    if (!userId || !field) {
      return NextResponse.json({ ok: false, error: 'Missing userId or field' }, { status: 400 })
    }
    const allowed = [
      'full_name','birth_date','country','doc_type','doc_number',
      'address_department','address_city','address_neighborhood','address_desc'
    ] as const
    if (!(allowed as readonly string[]).includes(field)) {
      return NextResponse.json({ ok: false, error: 'Invalid field' }, { status: 400 })
    }
    const res = await deleteKycPersonalField(userId, field as any)
    if (!res.success) {
      return NextResponse.json({ ok: false, error: res.error || 'Update failed' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Unhandled error' }, { status: 500 })
  }
}


