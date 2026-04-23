'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/app/lib/supabase/client'

interface Person { id: string; name: string }

interface Props {
  value: string
  onChange: (id: string) => void
}

export default function StaffPicker({ value, onChange }: Props) {
  const [selected, setSelected] = useState<Person | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Person[]>([])
  const [searching, setSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Resolve current value to a name on mount / value change
  useEffect(() => {
    if (!value) { setSelected(null); return }
    const supabase = createClient()
    supabase.from('contacts').select('id, name').eq('id', value).single()
      .then(({ data }) => { if (data) setSelected(data) })
  }, [value])

  // Search contacts as user types
  useEffect(() => {
    if (!showDropdown) return
    if (!query.trim()) {
      setResults([])
      return
    }
    setSearching(true)
    const supabase = createClient()
    const timer = setTimeout(() => {
      supabase
        .from('contacts')
        .select('id, name')
        .ilike('name', `%${query}%`)
        .not('type', 'eq', 'church')
        .order('name')
        .limit(10)
        .then(({ data }) => {
          setResults(data ?? [])
          setSearching(false)
        })
    }, 150)
    return () => clearTimeout(timer)
  }, [query, showDropdown])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function openSearch() {
    setQuery('')
    setResults([])
    setShowDropdown(true)
    setTimeout(() => inputRef.current?.focus(), 30)
  }

  function pick(person: Person) {
    setSelected(person)
    onChange(person.id)
    setShowDropdown(false)
    setQuery('')
  }

  function clear() {
    setSelected(null)
    onChange('')
  }

  return (
    <div ref={containerRef} className="relative">
      {selected ? (
        <div className="flex items-center gap-2 px-3 py-2.5 border border-gray-300 rounded-lg bg-gray-50">
          <span className="flex-1 text-sm font-medium text-gray-900">{selected.name}</span>
          <button type="button" onClick={openSearch} className="text-xs text-gray-400 hover:text-primary transition-colors">
            Change
          </button>
          <button type="button" onClick={clear} className="text-gray-400 hover:text-gray-600 transition-colors" title="Remove owner">
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
          Search contacts...
        </button>
      )}

      {showDropdown && (
        <div className="absolute z-20 w-full bg-white border border-gray-200 rounded-lg mt-1 shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type a name..."
              className="w-full text-sm px-2 py-1.5 outline-none"
              autoComplete="off"
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {!query && (
              <p className="text-xs text-gray-400 px-3 py-3 text-center">Start typing to search contacts</p>
            )}
            {query && searching && (
              <p className="text-xs text-gray-400 px-3 py-3 text-center">Searching...</p>
            )}
            {query && !searching && results.length === 0 && (
              <p className="text-xs text-gray-400 px-3 py-3 text-center">No contacts found for &ldquo;{query}&rdquo;</p>
            )}
            {results.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => pick(p)}
                className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors"
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
