'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/app/lib/supabase/client'
import TagPicker from '@/app/components/TagPicker'
import StaffPicker from '@/app/components/StaffPicker'
import {
  CONTACT_TYPES,
  INDIVIDUAL_STAGES,
  CHURCH_STAGES,
  PARTNERSHIP_TYPES,
  TYPE_LABELS,
} from '@/app/lib/constants'

export default function NewContactPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '',
    organization: '',
    phone: '',
    email: '',
    address: '',
    type: '' as string,
    stage: '',
    notes: '',
    tags: [] as string[],
    relationship_owner: '',
  })

  const [church, setChurch] = useState({
    denomination: '',
    congregation_size: '' as 'small' | 'medium' | 'large' | '',
    partnership_types: [] as string[],
    what_committed: '',
    primary_contact_name: '',
    primary_contact_email: '',
    primary_contact_phone: '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function handleChurchChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setChurch((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  function togglePartnershipType(pt: string) {
    setChurch((prev) => ({
      ...prev,
      partnership_types: prev.partnership_types.includes(pt)
        ? prev.partnership_types.filter((p) => p !== pt)
        : [...prev.partnership_types, pt],
    }))
  }

  const stages = form.type === 'church' ? CHURCH_STAGES : INDIVIDUAL_STAGES

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)

    try {
      const supabase = createClient()

      const contactPayload: Record<string, unknown> = {
        name: form.name,
        organization: form.organization || null,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        type: form.type || null,
        stage: form.stage || null,
        notes: form.notes || null,
        tags: form.tags,
        relationship_owner: form.relationship_owner || null,
      }

      const { data: contact, error: contactErr } = await supabase
        .from('contacts')
        .insert(contactPayload)
        .select()
        .single()

      if (contactErr) throw contactErr

      if (form.type === 'church') {
        const churchPayload = {
          contact_id: contact.id,
          denomination: church.denomination || null,
          congregation_size: church.congregation_size || null,
          partnership_types: church.partnership_types,
          what_committed: church.what_committed || null,
          primary_contact_name: church.primary_contact_name || null,
          primary_contact_email: church.primary_contact_email || null,
          primary_contact_phone: church.primary_contact_phone || null,
        }
        const { error: churchErr } = await supabase.from('church_details').insert(churchPayload)
        if (churchErr) throw churchErr
      }

      router.push(`/contacts/${contact.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save contact')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-2xl font-bold text-gray-900">New Contact</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
        )}

        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Basic Info</h2>

          <div>
            <label className="form-label">Name *</label>
            <input name="name" value={form.name} onChange={handleChange} className="form-input" required />
          </div>

          <div>
            <label className="form-label">Organization / Church</label>
            <input name="organization" value={form.organization} onChange={handleChange} className="form-input" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label">Type</label>
              <select name="type" value={form.type} onChange={handleChange} className="form-select">
                <option value="">Select type...</option>
                {CONTACT_TYPES.map((t) => (
                  <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Stage</label>
              <select name="stage" value={form.stage} onChange={handleChange} className="form-select">
                <option value="">Select stage...</option>
                {stages.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="form-label">Phone</label>
            <input type="tel" name="phone" value={form.phone} onChange={handleChange} className="form-input" />
          </div>

          <div>
            <label className="form-label">Email</label>
            <input type="email" name="email" value={form.email} onChange={handleChange} className="form-input" />
          </div>

          <div>
            <label className="form-label">Address</label>
            <input name="address" value={form.address} onChange={handleChange} className="form-input" />
          </div>

          <div>
            <label className="form-label">Notes</label>
            <textarea name="notes" value={form.notes} onChange={handleChange} className="form-textarea" rows={3} />
          </div>
        </div>

        {/* Church details */}
        {form.type === 'church' && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <h2 className="font-semibold text-gray-900">Church Details</h2>

            <div>
              <label className="form-label">Denomination</label>
              <input name="denomination" value={church.denomination} onChange={handleChurchChange} className="form-input" />
            </div>

            <div>
              <label className="form-label">Congregation Size</label>
              <select name="congregation_size" value={church.congregation_size} onChange={handleChurchChange} className="form-select">
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
                    onClick={() => togglePartnershipType(pt)}
                    className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      church.partnership_types.includes(pt)
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-primary'
                    }`}
                  >
                    {pt.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="form-label">What Committed</label>
              <textarea name="what_committed" value={church.what_committed} onChange={handleChurchChange} className="form-textarea" rows={2} />
            </div>

            <h3 className="font-medium text-gray-700 pt-1">Primary Contact at Church</h3>
            <div>
              <label className="form-label">Name</label>
              <input name="primary_contact_name" value={church.primary_contact_name} onChange={handleChurchChange} className="form-input" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="form-label">Email</label>
                <input type="email" name="primary_contact_email" value={church.primary_contact_email} onChange={handleChurchChange} className="form-input" />
              </div>
              <div>
                <label className="form-label">Phone</label>
                <input type="tel" name="primary_contact_phone" value={church.primary_contact_phone} onChange={handleChurchChange} className="form-input" />
              </div>
            </div>
          </div>
        )}

        {/* Relationship Owner */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-gray-900">Relationship Owner</h2>
          <StaffPicker
            value={form.relationship_owner}
            onChange={(id) => setForm((prev) => ({ ...prev, relationship_owner: id }))}
          />
        </div>

        {/* Tags */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-gray-900">Tags</h2>
          <TagPicker value={form.tags} onChange={(tags) => setForm((prev) => ({ ...prev, tags }))} />
        </div>

        <button type="submit" disabled={saving} className="btn-primary w-full text-center py-4 text-base">
          {saving ? 'Saving...' : 'Create Contact'}
        </button>
      </form>
    </div>
  )
}
