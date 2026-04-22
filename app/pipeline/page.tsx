'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/app/lib/supabase/client'
import ContactCard from '@/app/components/ContactCard'
import { INDIVIDUAL_STAGES, CHURCH_STAGES } from '@/app/lib/constants'
import type { ContactWithOwner } from '@/app/lib/types'

type Tab = 'individual' | 'church'

export default function PipelinePage() {
  const [tab, setTab] = useState<Tab>('individual')
  const [contacts, setContacts] = useState<ContactWithOwner[]>([])
  const [loading, setLoading] = useState(true)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  // Mobile stage nav
  const [mobileStageIdx, setMobileStageIdx] = useState(0)
  const [mobileSelectContact, setMobileSelectContact] = useState<ContactWithOwner | null>(null)
  // Search-and-add modal
  const [addToStage, setAddToStage] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ContactWithOwner[]>([])
  const [searching, setSearching] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const stages = tab === 'individual' ? INDIVIDUAL_STAGES : CHURCH_STAGES

  async function fetchContacts() {
    setLoading(true)
    const supabase = createClient()
    const typeFilter = tab === 'church' ? ['church'] : ['individual', 'business', 'community_org']

    const { data } = await supabase
      .from('contacts')
      .select('*, owner:staff_members!relationship_owner(id, name)')
      .in('type', typeFilter)
      .in('stage', stages)
      .order('updated_at', { ascending: false })

    const { data: tps } = await supabase
      .from('touchpoints')
      .select('contact_id, date')
      .order('date', { ascending: false })

    const lastTouchMap: Record<string, string> = {}
    for (const tp of (tps ?? [])) {
      if (!lastTouchMap[tp.contact_id]) lastTouchMap[tp.contact_id] = tp.date
    }

    setContacts(
      (data ?? []).map((c: any) => ({ ...c, last_touchpoint_date: lastTouchMap[c.id] ?? null }))
    )
    setLoading(false)
  }

  useEffect(() => {
    fetchContacts()
    setMobileStageIdx(0)
  }, [tab])

  function getContactsForStage(stage: string) {
    return contacts.filter((c) => c.stage === stage)
  }

  // Drag/drop
  function handleDragStart(e: React.DragEvent, contactId: string) {
    setDraggingId(contactId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', contactId)
  }
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    ;(e.currentTarget as HTMLElement).classList.add('drag-over')
  }
  function handleDragLeave(e: React.DragEvent) {
    ;(e.currentTarget as HTMLElement).classList.remove('drag-over')
  }
  async function handleDrop(e: React.DragEvent, newStage: string) {
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).classList.remove('drag-over')
    const id = e.dataTransfer.getData('text/plain')
    if (!id) return
    setDraggingId(null)
    await updateStage(id, newStage)
  }

  async function updateStage(contactId: string, newStage: string) {
    const res = await fetch(`/api/contacts/${contactId}/stage`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: newStage }),
    })
    if (res.ok) {
      setContacts((prev) =>
        prev.map((c) => (c.id === contactId ? { ...c, stage: newStage } : c))
      )
    }
    setMobileSelectContact(null)
  }

  // Search contacts to add to pipeline
  async function doSearch(q: string) {
    setSearchQuery(q)
    if (!q.trim()) { setSearchResults([]); return }
    setSearching(true)
    const supabase = createClient()
    const typeFilter = tab === 'church' ? ['church'] : ['individual', 'business', 'community_org']
    const { data } = await supabase
      .from('contacts')
      .select('id, name, organization, type, stage')
      .in('type', typeFilter)
      .ilike('name', `%${q}%`)
      .limit(12)
    setSearchResults((data ?? []) as ContactWithOwner[])
    setSearching(false)
  }

  function openAddModal(stage: string) {
    setAddToStage(stage)
    setSearchQuery('')
    setSearchResults([])
    setTimeout(() => searchRef.current?.focus(), 50)
  }

  async function assignToStage(contact: ContactWithOwner) {
    if (!addToStage) return
    await updateStage(contact.id, addToStage)
    // Add to pipeline list if not already present
    setContacts((prev) => {
      const exists = prev.find((c) => c.id === contact.id)
      if (exists) return prev.map((c) => c.id === contact.id ? { ...c, stage: addToStage } : c)
      return [...prev, { ...contact, stage: addToStage, last_touchpoint_date: null }]
    })
    setAddToStage(null)
    setSearchQuery('')
    setSearchResults([])
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Pipeline</h1>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {(['individual', 'church'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'individual' ? 'Individual & Business' : 'Church Partnerships'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-400">Loading...</div>
      ) : (
        <>
          {/* Desktop kanban */}
          <div className="hidden md:flex gap-4 overflow-x-auto pb-4">
            {stages.map((stage) => {
              const stageContacts = getContactsForStage(stage)
              return (
                <div
                  key={stage}
                  className="pipeline-col"
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, stage)}
                >
                  <div className="pipeline-col-header">
                    <span className="text-sm font-semibold text-gray-700">{stage}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs bg-white border border-gray-200 rounded-full px-2 py-0.5 text-gray-500">
                        {stageContacts.length}
                      </span>
                      <button
                        onClick={() => openAddModal(stage)}
                        className="w-6 h-6 rounded-full bg-primary/10 text-primary hover:bg-primary hover:text-white flex items-center justify-center transition-colors font-bold text-sm"
                        title={`Add contact to ${stage}`}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {stageContacts.length === 0 ? (
                    <button
                      onClick={() => openAddModal(stage)}
                      className="w-full flex flex-col items-center justify-center h-20 text-gray-300 text-xs rounded-lg border-2 border-dashed border-gray-200 hover:border-primary hover:text-primary transition-colors gap-1"
                    >
                      <span className="text-lg font-light">+</span>
                      <span>Add contact</span>
                    </button>
                  ) : (
                    <div className="space-y-2">
                      {stageContacts.map((c) => (
                        <div key={c.id} className={draggingId === c.id ? 'opacity-50' : ''}>
                          <ContactCard contact={c} draggable onDragStart={handleDragStart} />
                        </div>
                      ))}
                      <button
                        onClick={() => openAddModal(stage)}
                        className="w-full py-2 text-xs text-gray-400 hover:text-primary border border-dashed border-gray-200 hover:border-primary rounded-lg transition-colors"
                      >
                        + Add another
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Mobile */}
          <div className="md:hidden space-y-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMobileStageIdx((i) => Math.max(0, i - 1))}
                disabled={mobileStageIdx === 0}
                className="p-2 rounded-lg border border-gray-200 disabled:opacity-30"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="flex-1 text-center">
                <span className="font-semibold text-gray-900">{stages[mobileStageIdx]}</span>
                <span className="ml-2 text-sm text-gray-400">({getContactsForStage(stages[mobileStageIdx]).length})</span>
              </div>
              <button
                onClick={() => openAddModal(stages[mobileStageIdx])}
                className="p-2 rounded-lg border border-gray-200 text-primary hover:bg-primary/5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
              <button
                onClick={() => setMobileStageIdx((i) => Math.min(stages.length - 1, i + 1))}
                disabled={mobileStageIdx === stages.length - 1}
                className="p-2 rounded-lg border border-gray-200 disabled:opacity-30"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            <div className="flex justify-center gap-1.5">
              {stages.map((_, i) => (
                <button key={i} onClick={() => setMobileStageIdx(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${i === mobileStageIdx ? 'bg-primary' : 'bg-gray-300'}`}
                />
              ))}
            </div>

            <div className="space-y-3">
              {getContactsForStage(stages[mobileStageIdx]).length === 0 ? (
                <button
                  onClick={() => openAddModal(stages[mobileStageIdx])}
                  className="w-full py-8 text-center text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-xl hover:border-primary hover:text-primary transition-colors"
                >
                  + Add contact to {stages[mobileStageIdx]}
                </button>
              ) : (
                getContactsForStage(stages[mobileStageIdx]).map((c) => (
                  <div key={c.id} className="relative">
                    <ContactCard contact={c} />
                    <button
                      onClick={() => setMobileSelectContact(c)}
                      className="absolute top-3 right-3 text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-full text-gray-600"
                    >
                      Move
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* Mobile move sheet */}
      {mobileSelectContact && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileSelectContact(null)} />
          <div className="relative w-full bg-white rounded-t-2xl p-5 space-y-3">
            <h3 className="font-semibold text-gray-900">Move {mobileSelectContact.name} to...</h3>
            {stages.map((s) => (
              <button key={s} onClick={() => updateStage(mobileSelectContact.id, s)}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                  mobileSelectContact.stage === s
                    ? 'border-primary bg-primary/5 font-medium text-primary'
                    : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {s}
              </button>
            ))}
            <button onClick={() => setMobileSelectContact(null)} className="w-full text-center text-gray-500 py-2">Cancel</button>
          </div>
        </div>
      )}

      {/* Search-and-add modal */}
      {addToStage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAddToStage(null)} />
          <div className="relative bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900">
                  Add to <span className="text-primary">{addToStage}</span>
                </h3>
                <button onClick={() => setAddToStage(null)} className="text-gray-400 hover:text-gray-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <input
                ref={searchRef}
                value={searchQuery}
                onChange={(e) => doSearch(e.target.value)}
                placeholder="Search by name..."
                className="form-input"
                autoComplete="off"
              />
            </div>

            <div className="max-h-72 overflow-y-auto">
              {!searchQuery && (
                <p className="text-center text-gray-400 text-sm py-8">Type a name to search contacts</p>
              )}
              {searchQuery && searching && (
                <p className="text-center text-gray-400 text-sm py-8">Searching...</p>
              )}
              {searchQuery && !searching && searchResults.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-8">No contacts found for "{searchQuery}"</p>
              )}
              {searchResults.map((c) => (
                <button
                  key={c.id}
                  onClick={() => assignToStage(c)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between border-b border-gray-50 last:border-0 transition-colors"
                >
                  <div>
                    <div className="font-medium text-gray-900 text-sm">{c.name}</div>
                    {c.organization && <div className="text-xs text-gray-400">{c.organization}</div>}
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    {c.stage && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full whitespace-nowrap">
                        {c.stage}
                      </span>
                    )}
                    <svg className="w-4 h-4 text-primary flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
