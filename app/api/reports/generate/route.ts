import { NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { buildSummaryEmail } from '@/app/lib/email/summary-template'
import { INDIVIDUAL_STAGES, CHURCH_STAGES } from '@/app/lib/constants'
import { isStale } from '@/app/lib/stale'
import type { SnapshotData } from '@/app/lib/types'

export async function POST() {
  const supabase = createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  // Determine last month range
  const now = new Date()
  const periodStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const periodEnd = new Date(now.getFullYear(), now.getMonth(), 0) // last day of last month
  const periodStartStr = periodStart.toISOString().split('T')[0]
  const periodEndStr = periodEnd.toISOString().split('T')[0]
  const periodMonth = periodStartStr.substring(0, 7) + '-01'

  // Fetch all current contacts
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, name, type, stage, created_at, tags')

  // Fetch touchpoints for last month
  const { data: monthTouchpoints } = await supabase
    .from('touchpoints')
    .select('*, user:users(id, name)')
    .gte('date', periodStartStr)
    .lte('date', periodEndStr)

  // Fetch all touchpoints for stale calculation
  const { data: allTouchpoints } = await supabase
    .from('touchpoints')
    .select('contact_id, date')
    .order('date', { ascending: false })

  const lastTouchMap: Record<string, string> = {}
  for (const tp of (allTouchpoints ?? [])) {
    if (!lastTouchMap[tp.contact_id]) lastTouchMap[tp.contact_id] = tp.date
  }

  // Pipeline counts
  const pipelineIndividual: Record<string, number> = {}
  const pipelineChurch: Record<string, number> = {}
  for (const s of INDIVIDUAL_STAGES) pipelineIndividual[s] = 0
  for (const s of CHURCH_STAGES) pipelineChurch[s] = 0

  for (const c of (contacts ?? [])) {
    if (c.type === 'church') {
      if (c.stage && pipelineChurch[c.stage] !== undefined) pipelineChurch[c.stage]++
    } else {
      if (c.stage && pipelineIndividual[c.stage] !== undefined) pipelineIndividual[c.stage]++
    }
  }

  // Delta vs prior monthly summary
  const { data: priorSummary } = await supabase
    .from('monthly_summaries')
    .select('snapshot_data')
    .lt('period_month', periodMonth)
    .order('period_month', { ascending: false })
    .limit(1)
    .single()

  let deltaIndividual: Record<string, number> | undefined
  let deltaChurch: Record<string, number> | undefined

  if (priorSummary?.snapshot_data) {
    const prior = priorSummary.snapshot_data as SnapshotData
    deltaIndividual = {}
    deltaChurch = {}
    for (const s of INDIVIDUAL_STAGES) {
      deltaIndividual[s] = (pipelineIndividual[s] ?? 0) - (prior.pipeline_individual[s] ?? 0)
    }
    for (const s of CHURCH_STAGES) {
      deltaChurch[s] = (pipelineChurch[s] ?? 0) - (prior.pipeline_church[s] ?? 0)
    }
  }

  // Touchpoints by type and user
  const touchpointsByType: Record<string, number> = {}
  const touchpointsByUserMap: Record<string, { name: string; count: number }> = {}

  for (const tp of (monthTouchpoints ?? [])) {
    touchpointsByType[tp.type] = (touchpointsByType[tp.type] ?? 0) + 1
    const u = tp.user as { id: string; name: string } | null
    if (u) {
      if (!touchpointsByUserMap[u.id]) touchpointsByUserMap[u.id] = { name: u.name, count: 0 }
      touchpointsByUserMap[u.id].count++
    }
  }

  const touchpointsByUser = Object.values(touchpointsByUserMap).sort((a, b) => b.count - a.count)

  // New contacts this month
  const newContacts = (contacts ?? []).filter((c) => {
    const d = c.created_at.split('T')[0]
    return d >= periodStartStr && d <= periodEndStr
  })

  // Stage changes this month
  const { data: stageChanges } = await supabase
    .from('contacts')
    .select('name, stage, previous_stage, stage_changed_at')
    .gte('stage_changed_at', periodStart.toISOString())
    .lte('stage_changed_at', new Date(periodEnd.getTime() + 86400000).toISOString())

  // Stale contacts
  const staleContacts = (contacts ?? [])
    .filter((c) => isStale(lastTouchMap[c.id] ?? null, c.created_at))
    .map((c) => {
      const lastDate = lastTouchMap[c.id] ?? c.created_at
      return {
        name: c.name,
        days: Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000),
      }
    })
    .sort((a, b) => b.days - a.days)

  // Church summary
  const { data: churchDetails } = await supabase
    .from('church_details')
    .select('partnership_types, contact_id')

  const churchPartnershipCounts: Record<string, number> = {}
  for (const cd of (churchDetails ?? [])) {
    for (const pt of (cd.partnership_types ?? [])) {
      churchPartnershipCounts[pt] = (churchPartnershipCounts[pt] ?? 0) + 1
    }
  }

  const newChurches = newContacts.filter((c) => c.type === 'church')
  const activePartners = pipelineChurch['Active Partner'] + pipelineChurch['Champion']

  const snapshotData: SnapshotData = {
    period: periodMonth.substring(0, 7),
    pipeline_individual: pipelineIndividual,
    pipeline_church: pipelineChurch,
    delta_individual: deltaIndividual,
    delta_church: deltaChurch,
    touchpoints_by_type: touchpointsByType,
    touchpoints_by_user: touchpointsByUser,
    new_contacts_count: newContacts.length,
    new_contacts: newContacts.map((c) => ({ name: c.name, type: c.type ?? 'individual', stage: c.stage })),
    stage_changes: (stageChanges ?? []).map((s) => ({
      name: s.name,
      from: s.previous_stage,
      to: s.stage,
    })),
    stale_contacts: staleContacts,
    church_summary: {
      active_partners: activePartners,
      new_churches: newChurches.length,
      partnership_type_counts: churchPartnershipCounts,
    },
  }

  // Save to DB
  const { data: savedSummary, error: saveErr } = await supabase
    .from('monthly_summaries')
    .insert({
      period_month: periodMonth,
      generated_by: user.id,
      snapshot_data: snapshotData,
    })
    .select()
    .single()

  if (saveErr) {
    return NextResponse.json({ error: saveErr.message }, { status: 500 })
  }

  // Send email to recipients
  const { data: recipients } = await supabase
    .from('summary_recipients')
    .select('name, email')
    .eq('active', true)

  let recipientCount = 0

  if (recipients?.length && process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const html = buildSummaryEmail(snapshotData)
    const monthLabel = new Date(snapshotData.period + '-01').toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    })

    for (const recipient of recipients) {
      try {
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL ?? 'reports@youngliferi.org',
          to: recipient.email,
          subject: `YoungLife RI — Monthly Summary: ${monthLabel}`,
          html,
        })
        recipientCount++
      } catch {
        // Continue on send failure
      }
    }
  }

  return NextResponse.json({ ok: true, recipientCount, summaryId: savedSummary.id })
}
