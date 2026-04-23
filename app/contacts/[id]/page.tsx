import { createClient } from '@/app/lib/supabase/server'
import { notFound } from 'next/navigation'
import ContactDetailClient from './ContactDetailClient'

export const dynamic = 'force-dynamic'

export default async function ContactDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return notFound()

  const { data: currentUser } = await supabase
    .from('users')
    .select('id, name, role')
    .eq('id', user.id)
    .single()

  const { data: contact } = await supabase
    .from('contacts')
    .select('*, owner:contacts!relationship_owner(id, name)')
    .eq('id', params.id)
    .single()

  if (!contact) return notFound()

  const { data: churchDetails } = await supabase
    .from('church_details')
    .select('*')
    .eq('contact_id', params.id)
    .single()

  const { data: touchpoints } = await supabase
    .from('touchpoints')
    .select('*, user:users(id, name)')
    .eq('contact_id', params.id)
    .order('date', { ascending: false })

  // For church contacts: fetch all individuals who belong to this church
  let members: any[] = []
  if (contact.type === 'church') {
    const { data } = await supabase
      .from('contacts')
      .select('id, name, type, phone, email')
      .eq('church_id', params.id)
      .order('name')
    members = data ?? []
  }

  // For individual contacts: fetch church affiliation name
  let churchAffiliation: { id: string; name: string } | null = null
  if (contact.church_id) {
    const { data } = await supabase
      .from('contacts')
      .select('id, name')
      .eq('id', contact.church_id)
      .single()
    churchAffiliation = data
  }

  return (
    <ContactDetailClient
      contact={contact}
      churchDetails={churchDetails ?? null}
      touchpoints={touchpoints ?? []}
      currentUser={currentUser!}
      members={members}
      churchAffiliation={churchAffiliation}
    />
  )
}
