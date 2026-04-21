'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/app/lib/supabase/client'
import ContactCard from '@/app/components/ContactCard'
import { INDIVIDUAL_STAGES, CHURCH_STAGES } from '@/app/lib/constants'
import { isStale } from '@/app/lib/stale'
import type { ContactWithOwner } from '@/app/lib/types'

type Tab = 'individual' | 'church'

export default function PipelinePage() {
  const [tab, setTab] = useState<Tab>('individual')
  const [contacts, setContacts] = useState<ContactWithOwner[]>([])
  const [loading, setLoading] = useState(true)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  // Mobile: stage accordion
  const [mobileStageIdx, setMobileStageIdx] = useState(0)
  // Mobile stage select sheet
  const [mobileSelectContact, setMobileSelectContact] = useState<ContactWithOwner | null>(null)

  const stages = tab === 'individual' ? INDIVIDUAL_STAGES : CHURCH_STAGES

  async function fetchContacts() {
    setLoading(true)
    const supabase = createClient()

    const typeFilter = tab === 'church' ? ['church'] : ['individual', 'business', 'community_org']

    const { data } = await supabase
      .from('contacts')
      .select('*, owner:users!relationship_owner(id, name)')
      .in('type', typeFilter)
      .order('updated_at', { ascending: false })

    // Fetch last touchpoint dates
    const { data: tps } = await supabase
      .from('touchpoints')
      .select('contact_id, date')
      .order('date', { ascending: false })

    const lastTouchMap: Record<string, string> = {}
    for (const tp of (tps ?? [])) {
      if (!lastTouchMap[tp.contact_id]) lastTouchMap[tp.contact_id] = tp.date
    }

    setContacts(
      (data ?? []).map((c: any) => ({
        ...c,
        last_touchpoint_date: lastTouchMap[c.id] ?? null,
      }))
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

  // HTML5 drag/drop handlers
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

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Pipeline</h1>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setTab('individual')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'individual'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Individual & Business
        </button>
        <button
          onClick={() => setTab('church')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'church'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Church Partnerships
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-400">Loading...</div>
      ) : (
        <>
          {/* Desktop: horizontal kanban */}
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
                    <span className="text-xs bg-white border border-gray-200 rounded-full px-2 py-0.5 text-gray-500">
                      {stageContacts.length}
                    </span>
                  </div>
                  {stageContacts.length === 0 ? (
                    <div className="flex items-center justify-center h-16 text-gray-300 text-xs rounded-lg border-2 border-dashed border-gray-200">
                      Drop here
                    </div>
                  ) : (
                    stageContacts.map((c) => (
                      <div
                        key={c.id}
                        className={draggingId === c.id ? 'opacity-50' : ''}
                      >
                        <ContactCard
                          contact={c}
                          draggable
                          onDragStart={handleDragStart}
                        />
                      </div>
                    ))
                  )}
                </div>
              )
            })}
          </div>

          {/* Mobile: accordion stages */}
          <div className="md:hidden space-y-3">
            {/* Stage selector */}
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
                <span className="ml-2 text-sm text-gray-400">
                  ({getContactsForStage(stages[mobileStageIdx]).length})
                </span>
              </div>
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

            {/* Stage dot indicators */}
            <div className="flex justify-center gap-1.5">
              {stages.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setMobileStageIdx(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === mobileStageIdx ? 'bg-primary' : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>

            {/* Cards for current stage */}
            <div className="space-y-3">
              {getContactsForStage(stages[mobileStageIdx]).length === 0 ? (
                <p className="text-center text-gray-400 py-8 text-sm">No contacts in this stage</p>
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

      {/* Mobile stage select sheet */}
      {mobileSelectContact && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileSelectContact(null)} />
          <div className="relative w-full bg-white rounded-t-2xl p-5 space-y-3">
            <h3 className="font-semibold text-gray-900">Move {mobileSelectContact.name} to...</h3>
            {stages.map((s) => (
              <button
                key={s}
                onClick={() => updateStage(mobileSelectContact.id, s)}
                className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${
                  mobileSelectContact.stage === s
                    ? 'border-primary bg-primary/5 font-medium text-primary'
                    : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {s}
              </button>
            ))}
            <button
              onClick={() => setMobileSelectContact(null)}
              className="w-full text-center text-gray-500 py-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
