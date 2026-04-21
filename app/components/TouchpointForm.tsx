'use client'

import { useState } from 'react'
import { createClient } from '@/app/lib/supabase/client'
import { TOUCHPOINT_TYPES, TOUCHPOINT_LABELS } from '@/app/lib/constants'

interface TouchpointFormProps {
  contactId: string
  userId: string
  onSuccess: () => void
  onCancel?: () => void
}

export default function TouchpointForm({ contactId, userId, onSuccess, onCancel }: TouchpointFormProps) {
  const today = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState({
    type: 'call' as string,
    date: today,
    notes: '',
    outcome: '',
    next_step: '',
    next_step_date: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)

    try {
      const supabase = createClient()
      const payload: Record<string, unknown> = {
        contact_id: contactId,
        user_id: userId,
        type: form.type,
        date: form.date,
        notes: form.notes || null,
        outcome: form.outcome || null,
        next_step: form.next_step || null,
        next_step_date: form.next_step_date || null,
      }

      const { error: err } = await supabase.from('touchpoints').insert(payload)
      if (err) throw err
      onSuccess()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">Type *</label>
          <select name="type" value={form.type} onChange={handleChange} className="form-select" required>
            {TOUCHPOINT_TYPES.map((t) => (
              <option key={t} value={t}>{TOUCHPOINT_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label">Date *</label>
          <input
            type="date"
            name="date"
            value={form.date}
            onChange={handleChange}
            className="form-input"
            required
          />
        </div>
      </div>

      <div>
        <label className="form-label">Notes</label>
        <textarea
          name="notes"
          value={form.notes}
          onChange={handleChange}
          className="form-textarea"
          rows={3}
          placeholder="What happened? Who was there?"
        />
      </div>

      <div>
        <label className="form-label">Outcome</label>
        <input
          type="text"
          name="outcome"
          value={form.outcome}
          onChange={handleChange}
          className="form-input"
          placeholder="Result of this interaction"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="form-label">Next Step</label>
          <input
            type="text"
            name="next_step"
            value={form.next_step}
            onChange={handleChange}
            className="form-input"
            placeholder="What's next?"
          />
        </div>
        <div>
          <label className="form-label">Next Step Date</label>
          <input
            type="date"
            name="next_step_date"
            value={form.next_step_date}
            onChange={handleChange}
            className="form-input"
          />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={saving} className="btn-primary flex-1">
          {saving ? 'Saving...' : 'Log Touchpoint'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
