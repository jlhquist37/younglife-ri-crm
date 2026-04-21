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
  const { stage } = body

  if (!stage) {
    return NextResponse.json({ error: 'stage is required' }, { status: 400 })
  }

  // Get current stage
  const { data: current } = await supabase
    .from('contacts')
    .select('stage')
    .eq('id', params.id)
    .single()

  const { data, error } = await supabase
    .from('contacts')
    .update({
      stage,
      previous_stage: current?.stage ?? null,
      stage_changed_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
