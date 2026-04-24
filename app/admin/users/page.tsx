'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/app/lib/supabase/client'
import type { User } from '@/app/lib/types'

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Contact search for invite form
  const [contactResults, setContactResults] = useState<{ id: string; name: string; email: string | null }[]>([])
  const [showContactDrop, setShowContactDrop] = useState(false)
  const [selectedContact, setSelectedContact] = useState<string | null>(null)
  const nameRef = useRef<HTMLDivElement>(null)

  async function loadData() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase.from('users').select('*').eq('id', user.id).single()
      setCurrentUser(profile)
      if (profile?.role !== 'admin') return
    }
    const { data } = await supabase.from('users').select('*').order('name')
    setUsers(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  // Search contacts as name is typed
  async function handleNameChange(val: string) {
    setInviteName(val)
    setSelectedContact(null)
    if (!val.trim()) { setContactResults([]); setShowContactDrop(false); return }
    const supabase = createClient()
    const { data } = await supabase
      .from('contacts')
      .select('id, name, email')
      .not('type', 'eq', 'church')
      .ilike('name', `%${val}%`)
      .limit(8)
    setContactResults(data ?? [])
    setShowContactDrop(true)
  }

  function pickContact(c: { id: string; name: string; email: string | null }) {
    setInviteName(c.name)
    setInviteEmail(c.email ?? '')
    setSelectedContact(c.id)
    setContactResults([])
    setShowContactDrop(false)
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (nameRef.current && !nameRef.current.contains(e.target as Node)) {
        setShowContactDrop(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function handleRoleChange(userId: string, newRole: 'admin' | 'member') {
    const supabase = createClient()
    await supabase.from('users').update({ role: newRole }).eq('id', userId)
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: newRole } : u))
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviting(true)
    setInviteMsg(null)
    try {
      // Use Supabase admin invite via service role — we call a server action pattern
      // For MVP, we use the admin API via a fetch to a lightweight endpoint
      const res = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, name: inviteName }),
      })
      const json = await res.json()
      if (json.ok) {
        setInviteMsg(`Invite sent to ${inviteEmail}`)
        setInviteEmail('')
        setInviteName('')
      } else {
        setInviteMsg('Error: ' + (json.error ?? 'Unknown'))
      }
    } finally {
      setInviting(false)
    }
  }

  async function handleRemove(userId: string, name: string) {
    if (!confirm(`Remove ${name}? This will delete their account.`)) return
    const supabase = createClient()
    await supabase.from('users').delete().eq('id', userId)
    setUsers((prev) => prev.filter((u) => u.id !== userId))
  }

  if (loading) return <div className="py-16 text-center text-gray-400">Loading...</div>

  if (currentUser?.role !== 'admin') {
    return <div className="py-16 text-center text-red-500">Admin access required</div>
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Team Members</h1>

      {/* Invite form */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-gray-900">Invite New Member</h2>
        <form onSubmit={handleInvite} className="space-y-3">
          <div ref={nameRef} className="relative">
            <label className="form-label">Name</label>
            <div className="relative">
              <input
                value={inviteName}
                onChange={(e) => handleNameChange(e.target.value)}
                className="form-input"
                placeholder="Full name or search existing contact..."
                autoComplete="off"
                required
              />
              {selectedContact && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-green-600 font-medium">
                  ✓ Contact linked
                </span>
              )}
            </div>
            {showContactDrop && contactResults.length > 0 && (
              <div className="absolute z-20 w-full bg-white border border-gray-200 rounded-lg mt-1 shadow-lg overflow-hidden">
                {contactResults.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => pickContact(c)}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors"
                  >
                    <div className="text-sm font-medium text-gray-900">{c.name}</div>
                    {c.email
                      ? <div className="text-xs text-gray-400">{c.email}</div>
                      : <div className="text-xs text-gray-400 italic">No email on file</div>
                    }
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="form-label">Email</label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="form-input"
              placeholder="they@example.com"
              required
            />
          </div>
          <button type="submit" disabled={inviting} className="btn-primary">
            {inviting ? 'Sending...' : 'Send Invite'}
          </button>
          {inviteMsg && (
            <p className={`text-sm ${inviteMsg.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>
              {inviteMsg}
            </p>
          )}
        </form>
      </div>

      {/* User list */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">All Users ({users.length})</h2>
        </div>
        {users.length === 0 ? (
          <p className="px-5 py-8 text-gray-400 text-sm text-center">No users yet</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {users.map((u) => (
              <div key={u.id} className="px-5 py-4 flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-gray-900">{u.name}</div>
                  <div className="text-sm text-gray-500">{u.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={u.role}
                    onChange={(e) => handleRoleChange(u.id, e.target.value as 'admin' | 'member')}
                    disabled={u.id === currentUser.id}
                    className="form-select py-1.5 text-sm w-28"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                  {u.id !== currentUser.id && (
                    <button
                      onClick={() => handleRemove(u.id, u.name)}
                      className="text-red-400 hover:text-red-600 text-sm"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
