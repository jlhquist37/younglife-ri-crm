import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Auth check via user session
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()

  // Strip undefined / disallowed fields — only update what's explicitly passed
  const allowed = ['phone', 'email', 'address', 'organization', 'notes', 'tags', 'relationship_owner', 'church_id']
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  // Use service role client for the write — bypasses RLS to avoid anon-key edge cases
  // Strip BOM and whitespace that can appear in env vars pulled via Vercel CLI
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!.replace(/^\uFEFF/, '').trim()
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey
  )

  const { data, error } = await admin
    .from('contacts')
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq('id', params.id)
    .select('*, owner:contacts!relationship_owner(id, name)')
    .single()

  if (error) {
    console.error('Contact PATCH error:', error)
    return NextResponse.json({ error: error.message, details: error.details, hint: error.hint }, { status: 500 })
  }

  return NextResponse.json(data)
}
