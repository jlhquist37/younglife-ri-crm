'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/app/lib/supabase/client'
import StageBadge from '@/app/components/StageBadge'
import TagPicker from '@/app/components/TagPicker'
import StaffPicker from '@/app/components/StaffPicker'
import TouchpointForm from '@/app/components/TouchpointForm'
import {
  INDIVIDUAL_STAGES,
  CHURCH_STAGES,
  PARTNERSHIP_TYPES,
  TOUCHPOINT_LABELS,
  TYPE_LABELS,
} from '@/app/lib/constants'
import type { ChurchDetails, User } from '@/app/lib/types'

interface Props {
  contact: any
  churchDetails: ChurchDetails | null
  touchpoints: any[]
  currentUser: Pick<User, 'id' | 'name' | 'role'>
  members?: any[]
  churchAffiliation?: { id: string; name: string } | null
}

export default function ContactDetailClient({
  contact: initialContact,
  churchDetails: initialChurch,
  touchpoints: initialTouchpoints,
  currentUser,
  members: initialMembers = [],
  churchAffiliation: initialChurchAffiliation = null,
}: Props) {
  const router = useRouter()
  const [contact, setContact] = useState(initialContact)
  const [church, setChurch] = useState(initialChurch)
  const [touchpoints, setTouchpoints] = useState(initialTouchpoints)
  const [editing, setEditing] = useState(false)
  const [showLogForm, setShowLogForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showStageMenu, setShowStageMenu] = useState(false)

  // Church affiliation (for individual contacts)
  const [currentChurchAffiliation, setCurrentChurchAffiliation] = useState(initialChurchAffiliation)
  const [churchSearchQuery, setChurchSearchQuery] = useState('')
  const [churchSearchResults, setChurchSearchResults] = useState<any[]>([])

  // Members (for church contacts)
  const [members, setMembers] = useState(initialMembers)
  const [primaryContactId, setPrimaryContactId] = useState<string | null>(
    initialChurch?.primary_contact_id ?? null
  )
  const [showMemberSearch, setShowMemberSearch] = useState(false)
  const [memberQuery, setMemberQuery] = useState('')
  const [memberResults, setMemberResults] = useState<any[]>([])
  const [memberSearching, setMemberSearching] = useState(false)

  const [editForm, setEditForm] = useState({
    phone: contact.phone ?? '',
    email: contact.email ?? '',
    address: contact.address ?? '',
    organization: contact.organization ?? '',
    notes: contact.notes ?? '',
    tags: contact.tags ?? [],
    relationship_owner: contact.relationship_owner ?? '',
    church_id: contact.church_id ?? '',
  })

  const [churchForm, setChurchForm] = useState({
    denomination: church?.denomination ?? '',
    congregation_size: church?.congregation_size ?? '',
    partnership_types: church?.partnership_types ?? [],
    what_committed: church?.what_committed ?? '',
    primary_contact_name: church?.primary_contact_name ?? '',
    primary_contact_email: church?.primary_contact_email ?? '',
    primary_contact_phone: church?.primary_contact_phone ?? '',
  })

  const stages = contact.type === 'church' ? CHURCH_STAGES : INDIVIDUAL_STAGES

  // --- Church affiliation search (for individual contacts) ---
  async function searchChurches(q: string) {
    setChurchSearchQuery(q)
    if (!q.trim()) { setChurchSearchResults([]); return }
    const supabase = createClient()
    const { data } = await supabase
      .from('contacts')
      .select('id, name')
      .eq('type', 'church')
      .ilike('name', `%${q}%`)
      .limit(8)
    setChurchSearchResults(data ?? [])
  }

  function selectChurch(c: { id: string; name: string }) {
    setCurrentChurchAffiliation(c)
    setEditForm(p => ({ ...p, church_id: c.id }))
    setChurchSearchQuery('')
    setChurchSearchResults([])
  }

  function clearChurch() {
    setCurrentChurchAffiliation(null)
    setEditForm(p => ({ ...p, church_id: '' }))
    setChurchSearchQuery('')
    setChurchSearchResults([])
  }

  // --- Member management (for church contacts) ---
  async function searchMembers(q: string) {
    setMemberQuery(q)
    if (!q.trim()) { setMemberResults([]); return }
    setMemberSearching(true)
    const supabase = createClient()
    const { data } = await supabase
      .from('contacts')
      .select('id, name, type')
      .in('type', ['individual', 'business', 'community_org'])
      .ilike('name', `%${q}%`)
      .limit(10)
    setMemberResults(data ?? [])
    setMemberSearching(false)
  }

  async function addMember(member: any) {
    const supabase = createClient()
    await supabase.from('contacts').update({ church_id: contact.id }).eq('id', member.id)
    setMembers(prev => [...prev, member].sort((a: any, b: any) => a.name.localeCompare(b.name)))
    setShowMemberSearch(false)
    setMemberQuery('')
    setMemberResults([])
  }

  async function removeMember(memberId: string) {
    const supabase = createClient()
    await supabase.from('contacts').update({ church_id: null }).eq('id', memberId)
    if (primaryContactId === memberId) setPrimaryContactId(null)
    setMembers((prev: any[]) => prev.filter((m: any) => m.id !== memberId))
  }

  async function setPrimaryMember(memberId: string) {
    const supabase = createClient()
    if (church) {
      await supabase.from('church_details').update({ primary_contact_id: memberId }).eq('id', church.id)
    } else {
      // create church_details row if it doesn't exist
      await supabase.from('church_details').upsert({ contact_id: contact.id, primary_contact_id: memberId })
    }
    setPrimaryContactId(memberId)
  }

  // --- Save contact ---
  async function handleSaveContact() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: editForm.phone || null,
          email: editForm.email || null,
          address: editForm.address || null,
          organization: editForm.organization || null,
          notes: editForm.notes || null,
          tags: editForm.tags,
          relationship_owner: editForm.relationship_owner || null,
          church_id: editForm.church_id || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? json.details ?? 'Save failed')
      const data = json
      setContact(data)

      if (contact.type === 'church') {
        const churchPayload = {
          denomination: churchForm.denomination || null,
          congregation_size: churchForm.congregation_size || null,
          partnership_types: churchForm.partnership_types,
          what_committed: churchForm.what_committed || null,
          primary_contact_name: churchForm.primary_contact_name || null,
          primary_contact_email: churchForm.primary_contact_email || null,
          primary_contact_phone: churchForm.primary_contact_phone || null,
        }
        const supabase = createClient()
        if (church) {
          const { data: cd, error: cErr } = await supabase
            .from('church_details')
            .update(churchPayload)
            .eq('id', church.id)
            .select()
            .single()
          if (cErr) throw cErr
          setChurch(cd)
        } else {
          const { data: cd, error: cErr } = await supabase
            .from('church_details')
            .insert({ contact_id: contact.id, ...churchPayload })
            .select()
            .single()
          if (cErr) throw cErr
          setChurch(cd)
        }
      }

      setEditing(false)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleStageChange(newStage: string) {
    const supabase = createClient()
    const res = await fetch(`/api/contacts/${contact.id}/stage`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: newStage }),
    })
    if (res.ok) {
      const updated = await res.json()
      setContact((prev: any) => ({ ...prev, ...updated }))
    }
    setShowStageMenu(false)
  }

  async function handleDelete() {
    if (!confirm(`Delete ${contact.name}? This cannot be undone.`)) return
    const supabase = createClient()
    await supabase.from('contacts').delete().eq('id', contact.id)
    router.push('/contacts')
  }

  function handleTouchpointLogged() {
    setShowLogForm(false)
    router.refresh()
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700 mt-1">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{contact.name}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {contact.type && (
              <span className="type-badge">{TYPE_LABELS[contact.type] ?? contact.type}</span>
            )}
            {contact.stage && <StageBadge stage={contact.stage} />}
            {contact.owner?.name && (
              <span className="text-sm text-gray-500">{contact.owner.name}</span>
            )}
          </div>
        </div>
        {currentUser.role === 'admin' && (
          <button onClick={handleDelete} className="text-red-400 hover:text-red-600 text-sm">
            Delete
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {/* Stage update */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 mb-1">Current Stage</p>
            <StageBadge stage={contact.stage} />
            {!contact.stage && <span className="text-sm text-gray-400">No stage set</span>}
          </div>
          <div className="relative">
            <button
              onClick={() => setShowStageMenu(!showStageMenu)}
              className="btn-secondary text-sm py-2 px-3"
            >
              Change Stage
            </button>
            {showStageMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 min-w-[160px]">
                {stages.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleStageChange(s)}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 first:rounded-t-xl last:rounded-b-xl ${
                      contact.stage === s ? 'font-semibold text-primary' : 'text-gray-700'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {contact.stage_changed_at && (
          <p className="text-xs text-gray-400 mt-2">
            Changed {new Date(contact.stage_changed_at).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Contact info */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Contact Info</h2>
          {!editing ? (
            <button onClick={() => setEditing(true)} className="text-sm text-primary hover:underline">Edit</button>
          ) : (
            <div className="flex gap-2">
              <button onClick={handleSaveContact} disabled={saving} className="text-sm text-primary hover:underline font-medium">
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => setEditing(false)} className="text-sm text-gray-500 hover:underline">Cancel</button>
            </div>
          )}
        </div>

        {editing ? (
          <div className="space-y-4">
            <div>
              <label className="form-label">Organization</label>
              <input
                value={editForm.organization}
                onChange={(e) => setEditForm((p) => ({ ...p, organization: e.target.value }))}
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Phone</label>
              <input
                type="tel"
                value={editForm.phone}
                onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Email</label>
              <input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Address</label>
              <input
                value={editForm.address}
                onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value }))}
                className="form-input"
              />
            </div>

            {/* Church affiliation — only for non-church contacts */}
            {contact.type !== 'church' && (
              <div>
                <label className="form-label">Church Affiliation</label>
                {currentChurchAffiliation ? (
                  <div className="flex items-center gap-2 px-3 py-2.5 border border-gray-300 rounded-lg bg-gray-50">
                    <span className="flex-1 text-sm font-medium text-gray-900">
                      {currentChurchAffiliation.name}
                    </span>
                    <button
                      type="button"
                      onClick={clearChurch}
                      className="text-gray-400 hover:text-gray-600 text-xs"
                    >
                      ✕ Remove
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      value={churchSearchQuery}
                      onChange={(e) => searchChurches(e.target.value)}
                      placeholder="Search for a church..."
                      className="form-input"
                      autoComplete="off"
                    />
                    {churchSearchResults.length > 0 && (
                      <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg mt-1 shadow-lg overflow-hidden">
                        {churchSearchResults.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => selectChurch(c)}
                            className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0"
                          >
                            {c.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="form-label">Relationship Owner</label>
              <StaffPicker
                value={editForm.relationship_owner}
                onChange={(id) => setEditForm((p) => ({ ...p, relationship_owner: id }))}
              />
            </div>
            <div>
              <label className="form-label">Notes</label>
              <textarea
                value={editForm.notes}
                onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))}
                className="form-textarea"
                rows={3}
              />
            </div>
            <div>
              <label className="form-label">Tags</label>
              <TagPicker
                value={editForm.tags}
                onChange={(tags) => setEditForm((p) => ({ ...p, tags }))}
              />
            </div>
          </div>
        ) : (
          <dl className="space-y-3">
            {contact.organization && (
              <div><dt className="text-xs text-gray-400">Organization</dt><dd className="text-sm text-gray-900">{contact.organization}</dd></div>
            )}
            {contact.phone && (
              <div><dt className="text-xs text-gray-400">Phone</dt><dd><a href={`tel:${contact.phone}`} className="text-sm text-primary">{contact.phone}</a></dd></div>
            )}
            {contact.email && (
              <div><dt className="text-xs text-gray-400">Email</dt><dd><a href={`mailto:${contact.email}`} className="text-sm text-primary">{contact.email}</a></dd></div>
            )}
            {contact.address && (
              <div><dt className="text-xs text-gray-400">Address</dt><dd className="text-sm text-gray-900">{contact.address}</dd></div>
            )}
            {/* Church affiliation — view mode */}
            {contact.type !== 'church' && currentChurchAffiliation && (
              <div>
                <dt className="text-xs text-gray-400">Church</dt>
                <dd>
                  <Link href={`/contacts/${currentChurchAffiliation.id}`} className="text-sm text-primary hover:underline">
                    {currentChurchAffiliation.name}
                  </Link>
                </dd>
              </div>
            )}
            {contact.notes && (
              <div><dt className="text-xs text-gray-400">Notes</dt><dd className="text-sm text-gray-900 whitespace-pre-wrap">{contact.notes}</dd></div>
            )}
            {contact.tags?.length > 0 && (
              <div>
                <dt className="text-xs text-gray-400 mb-1">Tags</dt>
                <dd className="flex flex-wrap gap-1.5">
                  {contact.tags.map((tag: string) => (
                    <span key={tag} className="px-2.5 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-medium">{tag}</span>
                  ))}
                </dd>
              </div>
            )}
            {!contact.phone && !contact.email && !contact.address && !contact.notes && !currentChurchAffiliation && (
              <p className="text-sm text-gray-400">No contact info yet. Click Edit to add details.</p>
            )}
          </dl>
        )}
      </div>

      {/* Church details (edit + view) */}
      {contact.type === 'church' && editing && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Church Details</h2>
          <div>
            <label className="form-label">Denomination</label>
            <input
              value={churchForm.denomination}
              onChange={(e) => setChurchForm((p) => ({ ...p, denomination: e.target.value }))}
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">Congregation Size</label>
            <select
              value={churchForm.congregation_size}
              onChange={(e) => setChurchForm((p) => ({ ...p, congregation_size: e.target.value }))}
              className="form-select"
            >
              <option value="">Select...</option>
              <option value="small">Small (&lt;100)</option>
              <option value="medium">Medium (100–500)</option>
              <option value="large">Large (500+)</option>
            </select>
          </div>
          <div>
            <label className="form-label">Partnership Types</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {PARTNERSHIP_TYPES.map((pt) => (
                <button
                  key={pt}
                  type="button"
                  onClick={() =>
                    setChurchForm((p) => ({
                      ...p,
                      partnership_types: p.partnership_types.includes(pt)
                        ? p.partnership_types.filter((x: string) => x !== pt)
                        : [...p.partnership_types, pt],
                    }))
                  }
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    churchForm.partnership_types.includes(pt)
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-gray-600 border-gray-300'
                  }`}
                >
                  {pt.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="form-label">What Committed</label>
            <textarea
              value={churchForm.what_committed}
              onChange={(e) => setChurchForm((p) => ({ ...p, what_committed: e.target.value }))}
              className="form-textarea"
              rows={2}
            />
          </div>
          <h3 className="font-medium text-gray-700">Primary Church Contact</h3>
          <div>
            <label className="form-label">Name</label>
            <input
              value={churchForm.primary_contact_name}
              onChange={(e) => setChurchForm((p) => ({ ...p, primary_contact_name: e.target.value }))}
              className="form-input"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Email</label>
              <input
                type="email"
                value={churchForm.primary_contact_email}
                onChange={(e) => setChurchForm((p) => ({ ...p, primary_contact_email: e.target.value }))}
                className="form-input"
              />
            </div>
            <div>
              <label className="form-label">Phone</label>
              <input
                type="tel"
                value={churchForm.primary_contact_phone}
                onChange={(e) => setChurchForm((p) => ({ ...p, primary_contact_phone: e.target.value }))}
                className="form-input"
              />
            </div>
          </div>
        </div>
      )}

      {contact.type === 'church' && !editing && church && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-gray-900">Church Details</h2>
          <dl className="space-y-2">
            {church.denomination && <div><dt className="text-xs text-gray-400">Denomination</dt><dd className="text-sm">{church.denomination}</dd></div>}
            {church.congregation_size && <div><dt className="text-xs text-gray-400">Congregation Size</dt><dd className="text-sm capitalize">{church.congregation_size}</dd></div>}
            {church.partnership_types?.length > 0 && (
              <div>
                <dt className="text-xs text-gray-400 mb-1">Partnership Types</dt>
                <dd className="flex flex-wrap gap-1.5">
                  {church.partnership_types.map((pt: string) => (
                    <span key={pt} className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs">{pt.replace(/_/g, ' ')}</span>
                  ))}
                </dd>
              </div>
            )}
            {church.what_committed && <div><dt className="text-xs text-gray-400">What Committed</dt><dd className="text-sm">{church.what_committed}</dd></div>}
            {church.primary_contact_name && (
              <div>
                <dt className="text-xs text-gray-400">Primary Contact</dt>
                <dd className="text-sm font-medium">{church.primary_contact_name}</dd>
                {church.primary_contact_email && <dd><a href={`mailto:${church.primary_contact_email}`} className="text-sm text-primary">{church.primary_contact_email}</a></dd>}
                {church.primary_contact_phone && <dd><a href={`tel:${church.primary_contact_phone}`} className="text-sm text-primary">{church.primary_contact_phone}</a></dd>}
              </div>
            )}
          </dl>
        </div>
      )}

      {/* ── Members section (church contacts only) ── */}
      {contact.type === 'church' && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">
              Members
              <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-normal">{members.length}</span>
            </h2>
            <button
              onClick={() => setShowMemberSearch((v) => !v)}
              className="text-sm text-primary hover:underline"
            >
              {showMemberSearch ? 'Cancel' : '+ Add Member'}
            </button>
          </div>

          {/* Add member search */}
          {showMemberSearch && (
            <div className="space-y-2 pb-1">
              <input
                autoFocus
                value={memberQuery}
                onChange={(e) => searchMembers(e.target.value)}
                placeholder="Search individuals by name..."
                className="form-input text-sm"
                autoComplete="off"
              />
              {memberSearching && <p className="text-xs text-gray-400 px-1">Searching...</p>}
              {memberResults.length > 0 && (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  {memberResults.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => addMember(m)}
                      className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0 flex items-center justify-between"
                    >
                      <span>{m.name}</span>
                      <span className="text-xs text-gray-400 capitalize">{TYPE_LABELS[m.type] ?? m.type}</span>
                    </button>
                  ))}
                </div>
              )}
              {memberQuery && !memberSearching && memberResults.length === 0 && (
                <p className="text-xs text-gray-400 px-1">No contacts found for &ldquo;{memberQuery}&rdquo;</p>
              )}
            </div>
          )}

          {/* Member list */}
          {members.length === 0 ? (
            <p className="text-sm text-gray-400">No members linked yet. Use &ldquo;Add Member&rdquo; to connect individuals to this church.</p>
          ) : (
            <div className="space-y-2">
              {members.map((m: any) => (
                <div key={m.id} className="flex items-center justify-between px-3 py-2.5 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 min-w-0">
                    <Link
                      href={`/contacts/${m.id}`}
                      className="font-medium text-sm text-gray-900 hover:text-primary truncate"
                    >
                      {m.name}
                    </Link>
                    {m.id === primaryContactId && (
                      <span className="flex-shrink-0 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                        Primary
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                    {m.id !== primaryContactId && (
                      <button
                        onClick={() => setPrimaryMember(m.id)}
                        className="text-xs text-gray-400 hover:text-primary transition-colors"
                      >
                        Set primary
                      </button>
                    )}
                    <button
                      onClick={() => removeMember(m.id)}
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Log touchpoint */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Log Touchpoint</h2>
        </div>
        {showLogForm ? (
          <TouchpointForm
            contactId={contact.id}
            userId={currentUser.id}
            onSuccess={handleTouchpointLogged}
            onCancel={() => setShowLogForm(false)}
          />
        ) : (
          <button onClick={() => setShowLogForm(true)} className="btn-primary w-full text-center">
            + Log Touchpoint
          </button>
        )}
      </div>

      {/* Touchpoint history */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="font-semibold text-gray-900 mb-4">
          Activity History ({touchpoints.length})
        </h2>
        {touchpoints.length === 0 ? (
          <p className="text-sm text-gray-400">No touchpoints yet</p>
        ) : (
          <div className="space-y-4">
            {touchpoints.map((tp: any) => {
              const isOverdue = tp.next_step_date && new Date(tp.next_step_date) < new Date()
              return (
                <div key={tp.id} className="border-l-2 border-gray-200 pl-4 pb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900">
                      {TOUCHPOINT_LABELS[tp.type as string] ?? tp.type}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(tp.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <span className="text-xs text-gray-400">· {tp.user?.name}</span>
                  </div>
                  {tp.notes && <p className="text-sm text-gray-700 mt-1">{tp.notes}</p>}
                  {tp.outcome && <p className="text-sm text-gray-500 mt-0.5">Outcome: {tp.outcome}</p>}
                  {tp.next_step && (
                    <p className={`text-sm mt-0.5 ${isOverdue ? 'text-amber-600 font-medium' : 'text-gray-500'}`}>
                      Next: {tp.next_step}
                      {tp.next_step_date && (
                        <span className="ml-1 text-xs">
                          ({new Date(tp.next_step_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          {isOverdue && ' — overdue'})
                        </span>
                      )}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
