'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/app/lib/supabase/client'
import type { SummaryRecipient } from '@/app/lib/types'

export default function AdminSettingsPage() {
  const [recipients, setRecipients] = useState<SummaryRecipient[]>([])
  const [currentUser, setCurrentUser] = useState<{ id: string; role: string } | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [adding, setAdding] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase.from('users').select('id, role').eq('id', user.id).single()
      setCurrentUser(profile)
    }
    const { data } = await supabase
      .from('summary_recipients')
      .select('*')
      .order('created_at', { ascending: false })
    setRecipients(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAdding(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data, error: err } = await supabase
        .from('summary_recipients')
        .insert({ name, email, added_by: currentUser?.id ?? null })
        .select()
        .single()
      if (err) throw err
      setRecipients((prev) => [data, ...prev])
      setName('')
      setEmail('')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add')
    } finally {
      setAdding(false)
    }
  }

  async function handleToggleActive(id: string, current: boolean) {
    const supabase = createClient()
    await supabase.from('summary_recipients').update({ active: !current }).eq('id', id)
    setRecipients((prev) => prev.map((r) => r.id === id ? { ...r, active: !current } : r))
  }

  async function handleRemove(id: string) {
    if (!confirm('Remove this recipient?')) return
    const supabase = createClient()
    await supabase.from('summary_recipients').delete().eq('id', id)
    setRecipients((prev) => prev.filter((r) => r.id !== id))
  }

  if (loading) return <div className="py-16 text-center text-gray-400">Loading...</div>

  if (currentUser?.role !== 'admin') {
    return <div className="py-16 text-center text-red-500">Admin access required</div>
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* Summary recipients */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-gray-900">Monthly Summary Recipients</h2>
        <p className="text-sm text-gray-500">
          These people receive the automated monthly summary email.
        </p>

        <form onSubmit={handleAdd} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="form-input"
                placeholder="Full name"
                required
              />
            </div>
            <div>
              <label className="form-label">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                placeholder="email@example.com"
                required
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={adding} className="btn-primary">
            {adding ? 'Adding...' : 'Add Recipient'}
          </button>
        </form>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Recipients ({recipients.length})</h2>
        </div>
        {recipients.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-400 text-center">No recipients yet</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {recipients.map((r) => (
              <div key={r.id} className="px-5 py-4 flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-gray-900">{r.name}</div>
                  <div className="text-sm text-gray-500">{r.email}</div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleToggleActive(r.id, r.active)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      r.active ? 'bg-green-500' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        r.active ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <button
                    onClick={() => handleRemove(r.id)}
                    className="text-red-400 hover:text-red-600 text-sm"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
