import { NextRequest, NextResponse } from 'next/server'
import { Client } from 'pg'

export async function POST(request: NextRequest) {
  const auth = request.headers.get('x-migrate-key')
  if (auth !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL })
  try {
    await client.connect()
    await client.query(`
      ALTER TABLE public.contacts
        ADD COLUMN IF NOT EXISTS church_id UUID REFERENCES public.contacts(id);
    `)
    await client.query(`
      ALTER TABLE public.church_details
        ADD COLUMN IF NOT EXISTS primary_contact_id UUID REFERENCES public.contacts(id);
    `)
    return NextResponse.json({ ok: true, message: 'Migration complete' })
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  } finally {
    await client.end()
  }
}
