import { createClient } from '@/app/lib/supabase/server'
import Link from 'next/link'
import StageBadge from '@/app/components/StageBadge'
import { isStale } from '@/app/lib/stale'
import { INDIVIDUAL_STAGES, CHURCH_STAGES, TOUCHPOINT_LABELS, TYPE_LABELS } from '@/app/lib/constants'
import type { Contact, Touchpoint, User } from '@/app/lib/types'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = createClient()

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch all contacts with last touchpoint
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, name, type, stage, created_at, tags, relationship_owner')
    .order('created_at', { ascending: false })

  // Fetch all touchpoints for stale calculation and recent feed
  const { data: allTouchpoints } = await supabase
    .from('touchpoints')
    .select('id, contact_id, user_id, type, date, notes, created_at')
    .order('date', { ascending: false })

  // Map last touchpoint date per contact
  const lastTouchMap: Record<string, string> = {}
  for (const tp of (allTouchpoints ?? [])) {
    if (!lastTouchMap[tp.contact_id]) {
      lastTouchMap[tp.contact_id] = tp.date
    }
  }

  // Count by stage
  const individualCounts: Record<string, number> = {}
  const churchCounts: Record<string, number> = {}
  for (const s of INDIVIDUAL_STAGES) individualCounts[s] = 0
  for (const s of CHURCH_STAGES) churchCounts[s] = 0

  let staleCount = 0
  const staleContacts: Array<{ id: string; name: string; days: number }> = []

  for (const c of (contacts ?? [])) {
    if (c.type === 'church') {
      if (c.stage && churchCounts[c.stage] !== undefined) churchCounts[c.stage]++
    } else {
      if (c.stage && individualCounts[c.stage] !== undefined) individualCounts[c.stage]++
    }

    const stale = isStale(lastTouchMap[c.id] ?? null, c.created_at)
    if (stale) {
      staleCount++
      const lastDate = lastTouchMap[c.id] ?? c.created_at
      const days = Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000)
      staleContacts.push({ id: c.id, name: c.name, days })
    }
  }
  staleContacts.sort((a, b) => b.days - a.days)

  // Recent touchpoints (20)
  const { data: recentTouchpoints } = await supabase
    .from('touchpoints')
    .select('*, contact:contacts(id,name), user:users(id,name)')
    .order('date', { ascending: false })
    .limit(20)

  // Monthly touchpoints per user
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]

  const { data: monthTouchpoints } = await supabase
    .from('touchpoints')
    .select('user_id, user:users(id,name)')
    .gte('date', monthStart)

  const userMonthCounts: Record<string, { name: string; count: number }> = {}
  for (const tp of (monthTouchpoints ?? [])) {
    const u = tp.user as unknown as { id: string; name: string } | null
    if (u) {
      if (!userMonthCounts[u.id]) userMonthCounts[u.id] = { name: u.name, count: 0 }
      userMonthCounts[u.id].count++
    }
  }
  const teamStats = Object.values(userMonthCounts).sort((a, b) => b.count - a.count)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          {now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Individual Pipeline */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Individual & Business Pipeline
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {INDIVIDUAL_STAGES.map((stage) => (
            <Link
              key={stage}
              href={`/contacts?stage=${encodeURIComponent(stage)}`}
              className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow text-center"
            >
              <div className="text-2xl font-bold text-gray-900">{individualCounts[stage] ?? 0}</div>
              <StageBadge stage={stage} className="mt-1" />
            </Link>
          ))}
        </div>
      </section>

      {/* Church Pipeline */}
      <section>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Church Partnerships
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {CHURCH_STAGES.map((stage) => (
            <Link
              key={stage}
              href={`/contacts?type=church&stage=${encodeURIComponent(stage)}`}
              className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow text-center"
            >
              <div className="text-2xl font-bold text-gray-900">{churchCounts[stage] ?? 0}</div>
              <StageBadge stage={stage} className="mt-1" />
            </Link>
          ))}
        </div>
      </section>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Needs Attention */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              Needs Attention
            </h2>
            <Link href="/contacts?stale=true" className="text-sm text-primary hover:underline">
              View all ({staleCount})
            </Link>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
            {staleContacts.length === 0 ? (
              <p className="px-4 py-6 text-sm text-amber-700 text-center">All contacts are active!</p>
            ) : (
              <div className="divide-y divide-amber-100">
                {staleContacts.slice(0, 8).map((c) => (
                  <Link
                    key={c.id}
                    href={`/contacts/${c.id}`}
                    className="flex items-center justify-between px-4 py-3 hover:bg-amber-100 transition-colors"
                  >
                    <span className="text-sm font-medium text-gray-900">{c.name}</span>
                    <span className="text-xs text-amber-600 font-medium">{c.days}d</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Team activity this month */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Team — This Month
          </h2>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {teamStats.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-500 text-center">No activity logged yet</p>
            ) : (
              <table className="w-full">
                <tbody className="divide-y divide-gray-100">
                  {teamStats.map((u) => (
                    <tr key={u.name}>
                      <td className="px-4 py-3 text-sm text-gray-900">{u.name}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-right text-primary">
                        {u.count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>

      {/* Recent activity */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Recent Activity</h2>
          <Link href="/activity" className="text-sm text-primary hover:underline">View all</Link>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {!recentTouchpoints?.length ? (
            <p className="px-4 py-6 text-sm text-gray-500 text-center">No touchpoints logged yet</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentTouchpoints.map((tp: any) => (
                <div key={tp.id} className="px-4 py-3 flex items-start gap-3">
                  <div className="flex-shrink-0 w-2 h-2 rounded-full bg-primary mt-2" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/contacts/${tp.contact?.id}`}
                        className="text-sm font-medium text-gray-900 hover:text-primary"
                      >
                        {tp.contact?.name}
                      </Link>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {TOUCHPOINT_LABELS[tp.type as string] ?? tp.type}
                      </span>
                    </div>
                    {tp.notes && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{tp.notes}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="text-xs text-gray-400">
                      {new Date(tp.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                    <div className="text-xs text-gray-400">{tp.user?.name}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
