'use client'

import { useState, useEffect } from 'react'

interface StaffMember { id: string; name: string }

interface Props {
  value: string
  onChange: (id: string) => void
}

export default function StaffPicker({ value, onChange }: Props) {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/staff')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setStaff(data) })
  }, [])

  async function handleAdd() {
    if (!newName.trim()) return
    setSaving(true)
    setAddError(null)
    try {
      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to add')
      setStaff((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
      onChange(data.id)
      setNewName('')
      setAdding(false)
    } catch (e: unknown) {
      setAddError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="form-select flex-1"
        >
          <option value="">— Unassigned —</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => { setAdding(!adding); setNewName(''); setAddError(null) }}
          className="px-3 py-2 rounded-lg border border-gray-200 text-gray-500 hover:border-primary hover:text-primary transition-colors text-sm font-medium"
          title="Add team member"
        >
          {adding ? '✕' : '+ Add'}
        </button>
      </div>

      {adding && (
        <div className="flex gap-2 mt-1">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); handleAdd() }
              if (e.key === 'Escape') setAdding(false)
            }}
            placeholder="Full name..."
            className="form-input flex-1 text-sm"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={saving || !newName.trim()}
            className="btn-primary px-3 text-sm"
          >
            {saving ? '...' : 'Save'}
          </button>
        </div>
      )}
      {addError && <p className="text-xs text-red-500">{addError}</p>}
    </div>
  )
}
