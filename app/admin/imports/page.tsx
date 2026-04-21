import { createClient } from '@/app/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { ContactImport } from '@/app/lib/types'

export const dynamic = 'force-dynamic'

export default async function AdminImportsPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') {
    return <div className="py-16 text-center text-red-500">Admin access required</div>
  }

  const { data: imports } = await supabase
    .from('contact_imports')
    .select('*, imported_by_user:users!imported_by(name)')
    .order('imported_at', { ascending: false })

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Import History</h1>

      {!imports?.length ? (
        <p className="text-gray-400 text-center py-12">No imports yet</p>
      ) : (
        <div className="space-y-4">
          {imports.map((imp: any) => (
            <div key={imp.id} className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-gray-900">
                    {imp.source_filename ?? 'Unknown file'}
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5">
                    {imp.imported_by_user?.name ?? 'Unknown user'} &bull;{' '}
                    {new Date(imp.imported_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                  imp.source_type === 'pdf'
                    ? 'bg-purple-100 text-purple-700'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {imp.source_type?.toUpperCase() ?? 'CSV'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4 mt-4">
                <div className="text-center">
                  <div className="text-xl font-bold text-gray-900">{imp.row_count}</div>
                  <div className="text-xs text-gray-500">Total Rows</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-green-600">{imp.success_count}</div>
                  <div className="text-xs text-gray-500">Imported</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-red-500">{imp.error_count}</div>
                  <div className="text-xs text-gray-500">Errors</div>
                </div>
              </div>

              {imp.error_count > 0 && Array.isArray(imp.error_log) && imp.error_log.length > 0 && (
                <details className="mt-4">
                  <summary className="text-sm text-red-600 cursor-pointer hover:underline">
                    View error log ({imp.error_count} errors)
                  </summary>
                  <div className="mt-2 bg-red-50 rounded-lg p-3 space-y-1">
                    {imp.error_log.map((e: { row: number; error: string }, i: number) => (
                      <div key={i} className="text-xs text-red-700">
                        Row {e.row + 1}: {e.error}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      const blob = new Blob([JSON.stringify(imp.error_log, null, 2)], { type: 'application/json' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `import-errors-${imp.id}.json`
                      a.click()
                      URL.revokeObjectURL(url)
                    }}
                    className="mt-2 text-xs text-primary hover:underline"
                  >
                    Download error log
                  </button>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
