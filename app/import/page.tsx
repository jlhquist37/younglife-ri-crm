'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/app/lib/supabase/client'
import { CONTACT_TYPES, INDIVIDUAL_STAGES, CHURCH_STAGES, TYPE_LABELS } from '@/app/lib/constants'

type Step = 'upload' | 'mapping' | 'preview' | 'conflicts' | 'confirm' | 'results'

const CONTACT_FIELDS = [
  { key: 'name', label: 'Name *', required: true },
  { key: 'organization', label: 'Organization' },
  { key: 'phone', label: 'Phone' },
  { key: 'email', label: 'Email' },
  { key: 'address', label: 'Address' },
  { key: 'type', label: 'Type' },
  { key: 'stage', label: 'Stage' },
  { key: 'notes', label: 'Notes' },
  { key: 'tags', label: 'Tags (comma-separated)' },
  { key: '__skip__', label: '— Skip this column —' },
]

interface ParsedRow {
  [key: string]: string
}

interface MappedContact {
  name: string
  organization?: string
  phone?: string
  email?: string
  address?: string
  type?: string
  stage?: string
  notes?: string
  tags?: string[]
}

interface ConflictRow {
  index: number
  incoming: MappedContact
  existing: { id: string; name: string; organization: string | null }
  action: 'skip' | 'merge'
}

interface Results {
  imported: number
  skipped: number
  errors: number
  errorDetails: Array<{ row: number; error: string }>
}

export default function ImportPage() {
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [conflicts, setConflicts] = useState<ConflictRow[]>([])
  const [results, setResults] = useState<Results | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileSelect(f: File) {
    setFile(f)
    setError(null)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFileSelect(f)
  }

  async function handleUpload() {
    if (!file) return
    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/import', { method: 'POST', body: formData })

      let json: Record<string, unknown> = {}
      try {
        json = await res.json()
      } catch {
        throw new Error(
          res.status === 504 || res.status === 500
            ? 'The server timed out processing this file. Try a smaller PDF or export as CSV.'
            : 'Server returned an unreadable response. Check your file and try again.'
        )
      }

      if (!res.ok || json.error) throw new Error((json.error as string) ?? 'Parse failed')

      const rows = json.rows as ParsedRow[]
      const hdrs = json.headers as string[]
      setParsedRows(rows)
      setHeaders(hdrs)
      // Auto-map by matching header names
      const autoMap: Record<string, string> = {}
      for (const h of hdrs) {
        const lower = h.toLowerCase().trim()
        const match = CONTACT_FIELDS.find(
          (f) => f.key !== '__skip__' && (f.key === lower || f.label.toLowerCase().includes(lower))
        )
        autoMap[h] = match?.key ?? '__skip__'
      }
      setMapping(autoMap)
      setStep('mapping')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  function getMappedContacts(): MappedContact[] {
    return parsedRows.map((row) => {
      const contact: Record<string, string | string[]> = {}
      for (const [header, field] of Object.entries(mapping)) {
        if (field === '__skip__' || !field) continue
        const val = row[header]?.trim() ?? ''
        if (!val) continue
        if (field === 'tags') {
          contact.tags = val.split(',').map((t) => t.trim()).filter(Boolean)
        } else {
          contact[field] = val
        }
      }
      return contact as unknown as MappedContact
    }).filter((c) => c.name)
  }

  async function handlePreviewNext() {
    const mapped = getMappedContacts()
    if (!mapped.length) {
      setError('No valid rows found. Make sure "Name" is mapped.')
      return
    }

    // Check for conflicts
    setLoading(true)
    try {
      const supabase = createClient()
      const names = mapped.map((c) => c.name)
      const { data: existing } = await supabase
        .from('contacts')
        .select('id, name, organization')
        .in('name', names)

      const conflictList: ConflictRow[] = []
      for (let i = 0; i < mapped.length; i++) {
        const c = mapped[i]
        const match = (existing ?? []).find(
          (e) => e.name.toLowerCase() === c.name.toLowerCase()
        )
        if (match) {
          conflictList.push({ index: i, incoming: c, existing: match, action: 'skip' })
        }
      }

      setConflicts(conflictList)
      setStep(conflictList.length > 0 ? 'conflicts' : 'confirm')
    } finally {
      setLoading(false)
    }
  }

  async function handleImport() {
    setLoading(true)
    const mapped = getMappedContacts()
    const skipIds = new Set(conflicts.filter((c) => c.action === 'skip').map((c) => c.index))

    const toImport = mapped.filter((_, i) => !skipIds.has(i))
    const mergeRows = conflicts.filter((c) => c.action === 'merge')

    let imported = 0
    let skipped = skipIds.size
    const errorDetails: Array<{ row: number; error: string }> = []

    try {
      const supabase = createClient()

      for (let i = 0; i < toImport.length; i++) {
        const c = toImport[i]
        try {
          const { error: err } = await supabase.from('contacts').insert({
            name: c.name,
            organization: c.organization ?? null,
            phone: c.phone ?? null,
            email: c.email ?? null,
            address: c.address ?? null,
            type: c.type ?? null,
            stage: c.stage ?? null,
            notes: c.notes ?? null,
            tags: c.tags ?? [],
          })
          if (err) throw err
          imported++
        } catch (err: unknown) {
          errorDetails.push({ row: i, error: err instanceof Error ? err.message : String(err) })
        }
      }

      // Merge rows: update existing
      for (const conflict of mergeRows) {
        try {
          const c = conflict.incoming
          const { error: err } = await supabase
            .from('contacts')
            .update({
              organization: c.organization ?? null,
              phone: c.phone ?? null,
              email: c.email ?? null,
              address: c.address ?? null,
              type: c.type ?? null,
              stage: c.stage ?? null,
              notes: c.notes ?? null,
              tags: c.tags ?? [],
            })
            .eq('id', conflict.existing.id)
          if (err) throw err
          imported++
        } catch (err: unknown) {
          errorDetails.push({ row: conflict.index, error: err instanceof Error ? err.message : String(err) })
        }
      }

      // Log import
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('contact_imports').insert({
        imported_by: user?.id ?? null,
        source_filename: file?.name ?? null,
        source_type: file?.name.endsWith('.pdf') ? 'pdf' : 'csv',
        row_count: mapped.length,
        success_count: imported,
        error_count: errorDetails.length,
        error_log: errorDetails,
      })

      setResults({ imported, skipped, errors: errorDetails.length, errorDetails })
      setStep('results')
    } finally {
      setLoading(false)
    }
  }

  const mappedContacts = step === 'preview' || step === 'conflicts' || step === 'confirm' ? getMappedContacts() : []

  const STEPS: Record<Step, string> = {
    upload: 'Upload',
    mapping: 'Map Columns',
    preview: 'Preview',
    conflicts: 'Review Conflicts',
    confirm: 'Confirm',
    results: 'Results',
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Import Contacts</h1>

      {/* Step indicator */}
      <div className="flex items-center gap-1 overflow-x-auto">
        {(Object.keys(STEPS) as Step[]).filter(s => s !== 'conflicts' || conflicts.length > 0).map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            {i > 0 && <div className="w-4 h-px bg-gray-300" />}
            <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${step === s ? 'bg-primary text-white' : 'bg-gray-100 text-gray-500'}`}>
              {STEPS[s]}
            </span>
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
              dragging ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <svg className="w-10 h-10 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            <p className="text-gray-600 font-medium">Drop a file here or click to upload</p>
            <p className="text-gray-400 text-sm mt-1">Accepts .csv or .pdf</p>
            {file && <p className="text-primary text-sm mt-2 font-medium">{file.name}</p>}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.pdf"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(f) }}
          />
          <p className="text-xs text-gray-400">
            XLSX: please export as CSV first. PDF: contact data will be extracted via AI.
          </p>
          <button
            onClick={handleUpload}
            disabled={!file || loading}
            className="btn-primary w-full text-center"
          >
            {loading ? 'Parsing...' : 'Upload & Parse'}
          </button>
        </div>
      )}

      {/* Step 2: Column mapping */}
      {step === 'mapping' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">{parsedRows.length} rows found. Map each column:</p>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">File Column</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Sample Value</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Maps To</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {headers.map((h) => (
                  <tr key={h}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{h}</td>
                    <td className="px-4 py-3 text-sm text-gray-400 truncate max-w-[100px]">
                      {parsedRows[0]?.[h] ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={mapping[h] ?? '__skip__'}
                        onChange={(e) => setMapping((prev) => ({ ...prev, [h]: e.target.value }))}
                        className="form-select py-1.5 text-sm"
                      >
                        {CONTACT_FIELDS.map((f) => (
                          <option key={f.key} value={f.key}>{f.label}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep('upload')} className="btn-secondary">Back</button>
            <button
              onClick={() => { setStep('preview') }}
              className="btn-primary flex-1"
            >
              Preview ({parsedRows.length} rows)
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Preview */}
      {step === 'preview' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">First 5 rows (of {mappedContacts.length} valid contacts):</p>
          <div className="space-y-3">
            {mappedContacts.slice(0, 5).map((c, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 text-sm">
                <div className="font-medium text-gray-900">{c.name}</div>
                {c.organization && <div className="text-gray-500">{c.organization}</div>}
                <div className="flex gap-3 flex-wrap mt-1 text-xs text-gray-400">
                  {c.phone && <span>{c.phone}</span>}
                  {c.email && <span>{c.email}</span>}
                  {c.type && <span className="capitalize">{c.type}</span>}
                  {c.stage && <span>{c.stage}</span>}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep('mapping')} className="btn-secondary">Back</button>
            <button
              onClick={handlePreviewNext}
              disabled={loading}
              className="btn-primary flex-1"
            >
              {loading ? 'Checking...' : 'Next'}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Conflicts */}
      {step === 'conflicts' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {conflicts.length} contact{conflicts.length !== 1 ? 's' : ''} already exist. Choose to skip or merge each:
          </p>
          <div className="space-y-3">
            {conflicts.map((c, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="font-medium text-gray-900">{c.incoming.name}</div>
                <div className="text-xs text-gray-400 mt-0.5">Existing: {c.existing.name} {c.existing.organization ? `· ${c.existing.organization}` : ''}</div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => setConflicts((prev) =>
                      prev.map((x, j) => j === i ? { ...x, action: 'skip' } : x)
                    )}
                    className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${
                      c.action === 'skip' ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-700'
                    }`}
                  >
                    Skip
                  </button>
                  <button
                    onClick={() => setConflicts((prev) =>
                      prev.map((x, j) => j === i ? { ...x, action: 'merge' } : x)
                    )}
                    className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${
                      c.action === 'merge' ? 'bg-primary text-white border-primary' : 'border-gray-300 text-gray-700'
                    }`}
                  >
                    Merge (overwrite)
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep('preview')} className="btn-secondary">Back</button>
            <button onClick={() => setStep('confirm')} className="btn-primary flex-1">Next</button>
          </div>
        </div>
      )}

      {/* Step 5: Confirm */}
      {step === 'confirm' && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <h2 className="font-semibold text-gray-900">Ready to Import</h2>
            <div className="space-y-2 text-sm text-gray-700">
              <div className="flex justify-between">
                <span>Total rows in file</span>
                <span className="font-medium">{parsedRows.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Valid contacts</span>
                <span className="font-medium">{mappedContacts.length}</span>
              </div>
              <div className="flex justify-between text-amber-700">
                <span>To skip (duplicates)</span>
                <span className="font-medium">{conflicts.filter((c) => c.action === 'skip').length}</span>
              </div>
              <div className="flex justify-between text-blue-700">
                <span>To merge (update existing)</span>
                <span className="font-medium">{conflicts.filter((c) => c.action === 'merge').length}</span>
              </div>
              <div className="flex justify-between text-green-700 font-semibold pt-1 border-t border-gray-100">
                <span>To import</span>
                <span>{mappedContacts.length - conflicts.filter((c) => c.action === 'skip').length}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(conflicts.length > 0 ? 'conflicts' : 'preview')} className="btn-secondary">Back</button>
            <button
              onClick={handleImport}
              disabled={loading}
              className="btn-primary flex-1"
            >
              {loading ? 'Importing...' : 'Import Now'}
            </button>
          </div>
        </div>
      )}

      {/* Step 6: Results */}
      {step === 'results' && results && (
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-xl p-6 text-center space-y-3">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900">Import Complete</h2>
            <div className="grid grid-cols-3 gap-4 pt-2">
              <div><div className="text-2xl font-bold text-green-600">{results.imported}</div><div className="text-xs text-gray-500">Imported</div></div>
              <div><div className="text-2xl font-bold text-amber-500">{results.skipped}</div><div className="text-xs text-gray-500">Skipped</div></div>
              <div><div className="text-2xl font-bold text-red-500">{results.errors}</div><div className="text-xs text-gray-500">Errors</div></div>
            </div>
          </div>

          {results.errorDetails.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <h3 className="font-medium text-red-800 mb-2">Errors</h3>
              <div className="space-y-1 text-sm text-red-700">
                {results.errorDetails.map((e, i) => (
                  <div key={i}>Row {e.row + 1}: {e.error}</div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={() => { setStep('upload'); setFile(null); setParsedRows([]); setHeaders([]); setMapping({}); setConflicts([]); setResults(null) }}
            className="btn-secondary w-full text-center"
          >
            Import Another File
          </button>
        </div>
      )}
    </div>
  )
}
