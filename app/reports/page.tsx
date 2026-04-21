'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/app/lib/supabase/client'
import { buildSummaryPlainText } from '@/app/lib/email/summary-template'
import type { MonthlySummary, SnapshotData } from '@/app/lib/types'
import { INDIVIDUAL_STAGES, CHURCH_STAGES } from '@/app/lib/constants'

export default function ReportsPage() {
  const [summaries, setSummaries] = useState<MonthlySummary[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [selectedSummary, setSelectedSummary] = useState<MonthlySummary | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genResult, setGenResult] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
        setIsAdmin(profile?.role === 'admin')
      }
      const { data } = await supabase
        .from('monthly_summaries')
        .select('*')
        .order('period_month', { ascending: false })
      setSummaries(data ?? [])
      if (data?.length) {
        setSelectedId(data[0].id)
        setSelectedSummary(data[0])
      }
      setLoading(false)
    }
    load()
  }, [])

  function handleSelectSummary(id: string) {
    setSelectedId(id)
    const s = summaries.find((x) => x.id === id) ?? null
    setSelectedSummary(s)
  }

  async function handleGenerate() {
    setGenerating(true)
    setGenResult(null)
    try {
      const res = await fetch('/api/reports/generate', { method: 'POST' })
      const json = await res.json()
      if (json.ok) {
        setGenResult(`Summary generated and sent to ${json.recipientCount} recipient${json.recipientCount !== 1 ? 's' : ''}`)
        // Reload summaries
        const supabase = createClient()
        const { data } = await supabase
          .from('monthly_summaries')
          .select('*')
          .order('period_month', { ascending: false })
        setSummaries(data ?? [])
        if (json.summaryId) {
          const newS = (data ?? []).find((x: MonthlySummary) => x.id === json.summaryId) ?? null
          setSelectedId(json.summaryId)
          setSelectedSummary(newS)
        }
      } else {
        setGenResult('Error: ' + (json.error ?? 'Unknown error'))
      }
    } catch (err: unknown) {
      setGenResult('Request failed: ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setGenerating(false)
    }
  }

  async function handleCopyPlainText() {
    if (!selectedSummary) return
    const text = buildSummaryPlainText(selectedSummary.snapshot_data)
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Get last month label
  const lastMonthDate = new Date()
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1)
  const lastMonthLabel = lastMonthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  if (loading) return <div className="py-16 text-center text-gray-400">Loading...</div>

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Reports</h1>

      {isAdmin && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-gray-900">Generate Monthly Summary</h2>
          <p className="text-sm text-gray-600">
            Generates and emails the summary for <strong>{lastMonthLabel}</strong> to all active recipients.
          </p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="btn-primary"
          >
            {generating ? 'Generating...' : `Generate & Send — ${lastMonthLabel}`}
          </button>
          {genResult && (
            <p className={`text-sm ${genResult.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>
              {genResult}
            </p>
          )}
        </div>
      )}

      {/* Select summary */}
      {summaries.length > 0 && (
        <div>
          <label className="form-label">View Past Summary</label>
          <select
            value={selectedId}
            onChange={(e) => handleSelectSummary(e.target.value)}
            className="form-select"
          >
            {summaries.map((s) => (
              <option key={s.id} value={s.id}>
                {new Date(s.period_month + 'T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                {' — '}
                {new Date(s.generated_at).toLocaleDateString()}
              </option>
            ))}
          </select>
        </div>
      )}

      {selectedSummary && (
        <SummaryView summary={selectedSummary} onCopy={handleCopyPlainText} copied={copied} />
      )}

      {summaries.length === 0 && !isAdmin && (
        <p className="text-gray-400 text-center py-8">No summaries generated yet</p>
      )}
    </div>
  )
}

function SummaryView({
  summary,
  onCopy,
  copied,
}: {
  summary: MonthlySummary
  onCopy: () => void
  copied: boolean
}) {
  const d = summary.snapshot_data
  const month = new Date(d.period + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-900">{month}</h2>
        <button onClick={onCopy} className="btn-secondary text-sm py-2 px-4">
          {copied ? 'Copied!' : 'Copy as Plain Text'}
        </button>
      </div>

      {/* Individual Pipeline */}
      <SummarySection title="Individual & Business Pipeline">
        <PipelineTable counts={d.pipeline_individual} deltas={d.delta_individual} stages={INDIVIDUAL_STAGES} />
      </SummarySection>

      {/* Church Pipeline */}
      <SummarySection title="Church Partnerships">
        <PipelineTable counts={d.pipeline_church} deltas={d.delta_church} stages={CHURCH_STAGES} />
        <p className="text-sm text-gray-600 mt-2">
          Active partners: <strong>{d.church_summary.active_partners}</strong> &bull;
          New this month: <strong>{d.church_summary.new_churches}</strong>
        </p>
      </SummarySection>

      {/* Touchpoints */}
      <SummarySection title="Touchpoints This Month">
        <div className="space-y-1.5">
          {Object.entries(d.touchpoints_by_type).map(([type, count]) => (
            <div key={type} className="flex justify-between text-sm">
              <span className="text-gray-600 capitalize">{type.replace(/_/g, ' ')}</span>
              <span className="font-medium">{count}</span>
            </div>
          ))}
        </div>
      </SummarySection>

      {/* Team */}
      <SummarySection title="Team Activity">
        <div className="space-y-1.5">
          {d.touchpoints_by_user.map((u) => (
            <div key={u.name} className="flex justify-between text-sm">
              <span className="text-gray-600">{u.name}</span>
              <span className="font-medium">{u.count}</span>
            </div>
          ))}
        </div>
      </SummarySection>

      {/* New contacts */}
      {d.new_contacts.length > 0 && (
        <SummarySection title={`New Contacts (${d.new_contacts_count})`}>
          <div className="space-y-1">
            {d.new_contacts.map((c, i) => (
              <div key={i} className="text-sm text-gray-700">
                {c.name} — <span className="text-gray-500">{c.type}</span>
                {c.stage && <span className="text-gray-400 ml-1">· {c.stage}</span>}
              </div>
            ))}
          </div>
        </SummarySection>
      )}

      {/* Stage changes */}
      {d.stage_changes.length > 0 && (
        <SummarySection title="Stage Changes">
          <div className="space-y-1">
            {d.stage_changes.map((s, i) => (
              <div key={i} className="text-sm text-gray-700">
                {s.name} &mdash; {s.from ?? '—'} → {s.to ?? '—'}
              </div>
            ))}
          </div>
        </SummarySection>
      )}

      {/* Stale contacts */}
      {d.stale_contacts.length > 0 && (
        <SummarySection title="Needs Attention (60+ days)" accent="amber">
          <div className="space-y-1">
            {d.stale_contacts.map((c, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-gray-700">{c.name}</span>
                <span className="text-amber-600">{c.days}d</span>
              </div>
            ))}
          </div>
        </SummarySection>
      )}
    </div>
  )
}

function SummarySection({
  title,
  children,
  accent,
}: {
  title: string
  children: React.ReactNode
  accent?: string
}) {
  return (
    <div className={`bg-white border rounded-xl p-5 ${accent === 'amber' ? 'border-amber-200 bg-amber-50' : 'border-gray-200'}`}>
      <h3 className={`font-semibold mb-3 ${accent === 'amber' ? 'text-amber-800' : 'text-gray-900'}`}>{title}</h3>
      {children}
    </div>
  )
}

function PipelineTable({
  counts,
  deltas,
  stages,
}: {
  counts: Record<string, number>
  deltas?: Record<string, number>
  stages: string[]
}) {
  return (
    <div className="space-y-1.5">
      {stages.map((stage) => {
        const count = counts[stage] ?? 0
        const delta = deltas?.[stage]
        return (
          <div key={stage} className="flex justify-between items-center text-sm">
            <span className="text-gray-600">{stage}</span>
            <div className="flex items-center gap-2">
              {delta !== undefined && delta !== 0 && (
                <span className={`text-xs ${delta > 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {delta > 0 ? '+' : ''}{delta}
                </span>
              )}
              <span className="font-semibold">{count}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
