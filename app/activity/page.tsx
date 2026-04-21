import { createClient } from '@/app/lib/supabase/server'
import Link from 'next/link'
import { TOUCHPOINT_LABELS, TYPE_LABELS } from '@/app/lib/constants'

export const dynamic = 'force-dynamic'

interface SearchParams {
  user?: string
  type?: string
  from?: string
  to?: string
}

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const supabase = createClient()

  const { data: users } = await supabase.from('users').select('id, name').order('name')

  let query = supabase
    .from('touchpoints')
    .select('*, contact:contacts(id, name, type), user:users(id, name)')
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(200)

  if (searchParams.user) query = query.eq('user_id', searchParams.user)
  if (searchParams.type) query = query.eq('type', searchParams.type)
  if (searchParams.from) query = query.gte('date', searchParams.from)
  if (searchParams.to) query = query.lte('date', searchParams.to)

  const { data: touchpoints } = await query

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Activity Log</h1>

      {/* Filters */}
      <form method="GET" className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label">Team Member</label>
            <select name="user" defaultValue={searchParams.user ?? ''} className="form-select">
              <option value="">All Members</option>
              {(users ?? []).map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Type</label>
            <select name="type" defaultValue={searchParams.type ?? ''} className="form-select">
              <option value="">All Types</option>
              {Object.entries(TOUCHPOINT_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">From</label>
            <input type="date" name="from" defaultValue={searchParams.from ?? ''} className="form-input" />
          </div>
          <div>
            <label className="form-label">To</label>
            <input type="date" name="to" defaultValue={searchParams.to ?? ''} className="form-input" />
          </div>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary text-sm py-2 px-4">Filter</button>
          <Link href="/activity" className="btn-secondary text-sm py-2 px-4">Clear</Link>
        </div>
      </form>

      <p className="text-sm text-gray-500">{touchpoints?.length ?? 0} touchpoints</p>

      {/* Desktop table */}
      <div className="hidden md:block bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">By</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {!touchpoints?.length ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400 text-sm">No activity found</td>
              </tr>
            ) : (
              touchpoints.map((tp: any) => (
                <tr key={tp.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                    {new Date(tp.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {TOUCHPOINT_LABELS[tp.type as string] ?? tp.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {tp.contact ? (
                      <Link href={`/contacts/${tp.contact.id}`} className="text-sm font-medium text-primary hover:underline">
                        {tp.contact.name}
                      </Link>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{tp.user?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{tp.notes ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {!touchpoints?.length ? (
          <p className="text-center text-gray-400 py-8">No activity found</p>
        ) : (
          touchpoints.map((tp: any) => (
            <div key={tp.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  {tp.contact ? (
                    <Link href={`/contacts/${tp.contact.id}`} className="font-medium text-primary hover:underline">
                      {tp.contact.name}
                    </Link>
                  ) : (
                    <span className="font-medium text-gray-900">Unknown</span>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {TOUCHPOINT_LABELS[tp.type as string] ?? tp.type}
                    </span>
                    <span className="text-xs text-gray-400">{tp.user?.name}</span>
                  </div>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {new Date(tp.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
              {tp.notes && <p className="text-sm text-gray-500 mt-2">{tp.notes}</p>}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
