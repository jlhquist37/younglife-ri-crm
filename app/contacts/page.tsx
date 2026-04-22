import { createClient } from '@/app/lib/supabase/server'
import Link from 'next/link'
import ContactCard from '@/app/components/ContactCard'
import { INDIVIDUAL_STAGES, CHURCH_STAGES, CONTACT_TYPES, TYPE_LABELS } from '@/app/lib/constants'
import { isStale } from '@/app/lib/stale'
import type { ContactWithOwner } from '@/app/lib/types'

export const dynamic = 'force-dynamic'

interface SearchParams {
  q?: string
  type?: string
  stage?: string
  owner?: string
  stale?: string
  tag?: string
}

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const supabase = createClient()

  // Fetch all staff for owner filter
  const { data: users } = await supabase.from('staff_members').select('id, name').order('name')

  // Build query
  let query = supabase
    .from('contacts')
    .select('*, owner:staff_members!relationship_owner(id, name)')
    .order('updated_at', { ascending: false })

  if (searchParams.q) {
    query = query.or(`name.ilike.%${searchParams.q}%,organization.ilike.%${searchParams.q}%,email.ilike.%${searchParams.q}%`)
  }
  if (searchParams.type) query = query.eq('type', searchParams.type)
  if (searchParams.stage) query = query.eq('stage', searchParams.stage)
  if (searchParams.owner) query = query.eq('relationship_owner', searchParams.owner)
  if (searchParams.tag) query = query.contains('tags', [searchParams.tag])

  const { data: contacts } = await query

  // Fetch last touchpoint dates
  const { data: touchpoints } = await supabase
    .from('touchpoints')
    .select('contact_id, date')
    .order('date', { ascending: false })

  const lastTouchMap: Record<string, string> = {}
  for (const tp of (touchpoints ?? [])) {
    if (!lastTouchMap[tp.contact_id]) lastTouchMap[tp.contact_id] = tp.date
  }

  // Attach and filter stale
  let enriched: ContactWithOwner[] = (contacts ?? []).map((c: any) => ({
    ...c,
    last_touchpoint_date: lastTouchMap[c.id] ?? null,
  }))

  if (searchParams.stale === 'true') {
    enriched = enriched.filter((c) => isStale(c.last_touchpoint_date ?? null, c.created_at))
  }

  const allStages = [...INDIVIDUAL_STAGES, ...CHURCH_STAGES]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
        <Link href="/contacts/new" className="btn-primary text-sm py-2 px-4">
          + Add Contact
        </Link>
      </div>

      {/* Filters */}
      <form method="GET" className="space-y-3">
        <input
          type="text"
          name="q"
          defaultValue={searchParams.q ?? ''}
          placeholder="Search by name, org, or email..."
          className="form-input"
        />

        <div className="flex gap-2 flex-wrap">
          <select name="type" defaultValue={searchParams.type ?? ''} className="form-select flex-1 min-w-[120px]">
            <option value="">All Types</option>
            {CONTACT_TYPES.map((t) => (
              <option key={t} value={t}>{TYPE_LABELS[t]}</option>
            ))}
          </select>

          <select name="stage" defaultValue={searchParams.stage ?? ''} className="form-select flex-1 min-w-[120px]">
            <option value="">All Stages</option>
            {allStages.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select name="owner" defaultValue={searchParams.owner ?? ''} className="form-select flex-1 min-w-[120px]">
            <option value="">All Owners</option>
            {(users ?? []).map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              name="stale"
              value="true"
              defaultChecked={searchParams.stale === 'true'}
              className="rounded"
            />
            Only stale (60+ days)
          </label>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary text-sm py-2 px-4">Filter</button>
            <Link href="/contacts" className="btn-secondary text-sm py-2 px-4">Clear</Link>
          </div>
        </div>
      </form>

      {/* Results count */}
      <p className="text-sm text-gray-500">{enriched.length} contact{enriched.length !== 1 ? 's' : ''}</p>

      {/* Contact cards */}
      {enriched.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-lg">No contacts found</p>
          <Link href="/contacts/new" className="text-primary hover:underline text-sm mt-2 inline-block">
            Add your first contact
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {enriched.map((contact) => (
            <ContactCard key={contact.id} contact={contact} />
          ))}
        </div>
      )}
    </div>
  )
}
