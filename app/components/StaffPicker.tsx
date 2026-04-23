'use client'

import { useState, useEffect, useRef } from 'react'

interface StaffMember { id: string; name: string }

interface Props {
  value: string
  onChange: (id: string) => void
}

export default function StaffPicker({ value, onChange }: Props) {
  const [allStaff, setAllStaff] = useState<StaffMember[]>([])
  const [selected, setSelected] = useState<StaffMember | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<StaffMember[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [addingNew, setAddingNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Load staff on mount and resolve current value to a name
  useEffect(() => {
    fetch('/api/staff')
      .then((r) => r.json())
      .then((data: StaffMember[]) => {
        if (!Array.isArray(data)) return
        setAllStaff(data)
        if (value) {
          const match = data.find((s) => s.id === value)
          if (match) setSelected(match)
        }
      })
  }, [])

  // Update selected when value changes externally
  useEffect(() => {
    if (!value) { setSelected(null); return }
    const match = allStaff.find((s) => s.id === value)
    if (match) setSelected(match)
  }, [value, allStaff])

  // Filter staff by query
  useEffect(() => {
    if (!query.trim()) { setResults(allStaff.slice(0, 8)); return }
    const q = query.toLowerCase()
    setResults(allStaff.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 8))
  }, [query, allStaff])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
        setAddingNew(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function openSearch() {
    setQuery('')
    setResults(allStaff.slice(0, 8))
    setShowDropdown(true)
    setAddingNew(false)
    setTimeout(() => inputRef.current?.focus(), 30)
  }

  function pick(staff: StaffMember) {
    setSelected(staff)
    onChange(staff.id)
    setShowDropdown(false)
    setQuery('')
  }

  function clear() {
    setSelected(null)
    onChange('')
  }

  async function handleAddNew() {
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
      const newMember = { id: data.id, name: data.name }
      setAllStaff((prev) => [...prev, newMember].sort((a, b) => a.name.localeCompare(b.name)))
      pick(newMember)
      setNewName('')
      setAddingNew(false)
    } catch (e: unknown) {
      setAddError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Selected state */}
      {selected ? (
        <div className="flex items-center gap-2 px-3 py-2.5 border border-gray-300 rounded-lg bg-gray-50">
          <span className="flex-1 text-sm font-medium text-gray-900">{selected.name}</span>
          <button
            type="button"
            onClick={openSearch}
            className="text-xs text-gray-400 hover:text-primary transition-colors"
          >
            Change
          </button>
          <button
            type="button"
            onClick={clear}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            title="Remove owner"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={openSearch}
          className="w-full text-left px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-400 hover:border-primary hover:text-gray-700 transition-colors bg-white"
        >
          Search team member...
        </button>
      )}

      {/* Search dropdown */}
      {showDropdown && (
        <div className="absolute z-20 w-full bg-white border border-gray-200 rounded-lg mt-1 shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name..."
              className="w-full text-sm px-2 py-1.5 outline-none"
              autoComplete="off"
            />
          </div>

          <div className="max-h-48 overflow-y-auto">
            {results.length === 0 && query ? (
              <p className="text-xs text-gray-400 px-3 py-2">No match for &ldquo;{query}&rdquo;</p>
            ) : (
              results.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => pick(s)}
                  className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors"
                >
                  {s.name}
                </button>
              ))
            )}
          </div>

          {/* Add new person */}
          {!addingNew ? (
            <button
              type="button"
              onClick={() => { setAddingNew(true); setNewName(query) }}
              className="w-full text-left px-3 py-2.5 text-sm text-primary hover:bg-primary/5 border-t border-gray-100 transition-colors font-medium"
            >
              + Add new team member
            </button>
          ) : (
            <div className="p-2 border-t border-gray-100 space-y-1.5">
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); handleAddNew() }
                  if (e.key === 'Escape') setAddingNew(false)
                }}
                placeholder="Full name..."
                className="w-full text-sm px-2 py-1.5 border border-gray-300 rounded outline-none focus:border-primary"
              />
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={handleAddNew}
                  disabled={saving || !newName.trim()}
                  className="flex-1 text-xs bg-primary text-white rounded py-1.5 hover:bg-primary/90 disabled:opacity-50 transition-colors font-medium"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => setAddingNew(false)}
                  className="text-xs text-gray-500 px-2 py-1.5 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
              {addError && <p className="text-xs text-red-500">{addError}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
