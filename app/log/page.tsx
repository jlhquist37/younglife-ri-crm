'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/app/lib/supabase/client'
import TouchpointForm from '@/app/components/TouchpointForm'
import Link from 'next/link'
import type { Contact, User } from '@/app/lib/types'

type Step = 'search' | 'form' | 'done'

export default function LogPage() {
  const [step, setStep] = useState<Step>('search')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Contact[]>([])
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loggedContact, setLoggedContact] = useState<Contact | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from('users').select('*').eq('id', user.id).single()
        setCurrentUser(data)
      }
    }
    loadUser()
    // Focus search on mount
    setTimeout(() => searchRef.current?.focus(), 100)
  }, [])

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }
    const timer = setTimeout(async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from('contacts')
        .select('id, name, organization, type, stage')
        .or(`name.ilike.%${query}%,organization.ilike.%${query}%`)
        .limit(10)
      setResults(data ?? [])
    }, 200)
    return () => clearTimeout(timer)
  }, [query])

  function selectContact(contact: Contact) {
    setSelectedContact(contact)
    setStep('form')
    setQuery('')
    setResults([])
  }

  function handleSuccess() {
    setLoggedContact(selectedContact)
    setStep('done')
  }

  function logAnother() {
    setStep('search')
    setSelectedContact(null)
    setLoggedContact(null)
    setTimeout(() => searchRef.current?.focus(), 100)
  }

  if (step === 'done') {
    return (
      <div className="max-w-md mx-auto text-center py-16 space-y-4">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900">Logged!</h2>
        <p className="text-gray-500">Touchpoint saved for <strong>{loggedContact?.name}</strong></p>
        <div className="flex flex-col gap-3 pt-2">
          <button onClick={logAnother} className="btn-primary w-full text-center">
            Log Another
          </button>
          {loggedContact && (
            <Link href={`/contacts/${loggedContact.id}`} className="btn-secondary w-full text-center">
              View {loggedContact.name}
            </Link>
          )}
        </div>
      </div>
    )
  }

  if (step === 'form' && selectedContact && currentUser) {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setStep('search')}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Log Touchpoint</h1>
            <p className="text-sm text-gray-500">{selectedContact.name}</p>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <TouchpointForm
            contactId={selectedContact.id}
            userId={currentUser.id}
            onSuccess={handleSuccess}
            onCancel={() => setStep('search')}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Quick Log</h1>
      <p className="text-gray-500 text-sm">Search for a contact to log a touchpoint</p>

      <div className="relative">
        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          ref={searchRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search contacts..."
          className="form-input pl-10 text-lg py-4"
          autoComplete="off"
        />
      </div>

      {results.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          {results.map((contact) => (
            <button
              key={contact.id}
              onClick={() => selectContact(contact)}
              className="w-full text-left px-5 py-4 flex items-center gap-3 hover:bg-gray-50 border-b border-gray-100 last:border-0 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-primary font-semibold text-sm">
                  {contact.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <div className="font-medium text-gray-900">{contact.name}</div>
                {contact.organization && (
                  <div className="text-sm text-gray-500">{contact.organization}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {query.length > 1 && results.length === 0 && (
        <div className="text-center py-6 text-gray-400">
          <p>No contacts found for "{query}"</p>
          <Link href="/contacts/new" className="text-primary hover:underline text-sm mt-1 inline-block">
            Add new contact
          </Link>
        </div>
      )}

      {!query && (
        <div className="text-center py-8 text-gray-300">
          <svg className="w-12 h-12 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <p>Type to search</p>
        </div>
      )}
    </div>
  )
}
