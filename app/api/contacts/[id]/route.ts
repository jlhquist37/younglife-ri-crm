import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

  const { data, error } = await supabase
    .from('contacts')
    .update(update)
    .eq('id', params.id)
    .select('*, owner:contacts!relationship_owner(id, name)')
    .single()

  if (error) {
    console.error('Contact PATCH error:', error)
    return NextResponse.json({ error: error.message, details: error.details, hint: error.hint }, { status: 500 })
  }

  return NextResponse.json(data)
}
