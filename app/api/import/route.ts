import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/app/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 60 // seconds — requires Vercel Pro; free plan still gets 10s but fails cleanly

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return { headers: [], rows: [] }

  function splitCSVLine(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = !inQuotes
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
    result.push(current.trim())
    return result
  }

  const headers = splitCSVLine(lines[0])
  const rows = lines.slice(1).map((line) => {
    const vals = splitCSVLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => {
      row[h] = vals[i] ?? ''
    })
    return row
  })

  return { headers, rows }
}

export async function POST(request: NextRequest) {
  try {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const filename = file.name.toLowerCase()

  // PDF: use Claude to extract tabular data
  if (filename.endsWith('.pdf')) {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set for PDF extraction' }, { status: 500 })
    }

    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64,
              },
            } as unknown as { type: 'text'; text: string },
            {
              type: 'text',
              text: 'Extract all rows from this tabular document. Return only a JSON array where each element is an object representing one row, using column headers as keys. No explanation.',
            },
          ],
        },
      ],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''

    try {
      // Extract JSON from response
      const jsonMatch = text.match(/\[[\s\S]*\]/)
      if (!jsonMatch) throw new Error('No JSON array found in response')
      const rows = JSON.parse(jsonMatch[0]) as Record<string, string>[]
      if (!rows.length) throw new Error('No rows extracted')

      const headers = Object.keys(rows[0])
      return NextResponse.json({ headers, rows })
    } catch (err: unknown) {
      return NextResponse.json(
        { error: 'Failed to parse PDF: ' + (err instanceof Error ? err.message : String(err)) },
        { status: 500 }
      )
    }
  }

  // CSV
  if (filename.endsWith('.csv') || filename.endsWith('.txt')) {
    const text = await file.text()
    const { headers, rows } = parseCSV(text)

    if (!headers.length) {
      return NextResponse.json({ error: 'Could not parse CSV — no headers found' }, { status: 400 })
    }

    return NextResponse.json({ headers, rows })
  }

  // XLSX: ask user to convert
  if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
    return NextResponse.json(
      { error: 'Please export your spreadsheet as CSV first, then upload the CSV file.' },
      { status: 400 }
    )
  }

  return NextResponse.json({ error: 'Unsupported file type. Use .csv or .pdf' }, { status: 400 })

  } catch (err: unknown) {
    console.error('Import route error:', err)
    return NextResponse.json(
      { error: 'Import failed: ' + (err instanceof Error ? err.message : String(err)) },
      { status: 500 }
    )
  }
}
