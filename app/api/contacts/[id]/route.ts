import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function getAdmin() {
  // Strip BOM + whitespace that Vercel CLI can inject into pulled env files
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!.replace(/^\uFEFF/, '').trim()
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Auth check
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()

  // Only update explicitly passed allowed fields
  const allowed = ['phone', 'email', 'address', 'organization', 'notes', 'tags', 'relationship_owner', 'church_id']
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) update[key] = body[key]
  }

  const admin = getAdmin()

  // Step 1: run the update — if this fails, return the error
  const { error: updateError } = await admin
    .from('contacts')
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq('id', params.id)

  if (updateError) {
    console.error('Contact PATCH update error:', updateError)
    return NextResponse.json(
      { error: updateError.message, details: updateError.details, hint: updateError.hint },
      { status: 500 }
    )
  }

  // Step 2: fetch the refreshed row (separate query so a join failure never blocks the write)
  const { data, error: selectError } = await admin
    .from('contacts')
    .select('*, owner:contacts!relationship_owner(id, name)')
    .eq('id', params.id)
    .single()

  if (selectError) {
    console.error('Contact PATCH select error:', selectError)
    // Update succeeded — return minimal data so UI still reflects the save
    return NextResponse.json({ id: params.id, ...update })
  }

  return NextResponse.json(data)
}
