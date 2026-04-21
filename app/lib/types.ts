export interface User {
  id: string
  name: string
  email: string
  role: 'admin' | 'member'
  created_at: string
}

export interface Contact {
  id: string
  name: string
  organization: string | null
  phone: string | null
  email: string | null
  address: string | null
  type: 'individual' | 'church' | 'business' | 'community_org' | null
  relationship_owner: string | null
  stage: string | null
  previous_stage: string | null
  stage_changed_at: string | null
  notes: string | null
  tags: string[]
  created_at: string
  updated_at: string
}

export interface ChurchDetails {
  id: string
  contact_id: string
  denomination: string | null
  congregation_size: 'small' | 'medium' | 'large' | null
  partnership_types: string[]
  what_committed: string | null
  primary_contact_name: string | null
  primary_contact_email: string | null
  primary_contact_phone: string | null
}

export interface Touchpoint {
  id: string
  contact_id: string
  user_id: string
  type: 'call' | 'email' | 'coffee_meal' | 'church_visit' | 'event' | 'introduction' | 'thank_you' | 'other'
  date: string
  notes: string | null
  outcome: string | null
  next_step: string | null
  next_step_date: string | null
  created_at: string
}

export interface MonthlySummary {
  id: string
  period_month: string
  generated_by: string | null
  generated_at: string
  snapshot_data: SnapshotData
}

export interface SnapshotData {
  period: string
  pipeline_individual: Record<string, number>
  pipeline_church: Record<string, number>
  delta_individual?: Record<string, number>
  delta_church?: Record<string, number>
  touchpoints_by_type: Record<string, number>
  touchpoints_by_user: Array<{ name: string; count: number }>
  new_contacts_count: number
  new_contacts: Array<{ name: string; type: string; stage: string | null }>
  stage_changes: Array<{ name: string; from: string | null; to: string | null }>
  stale_contacts: Array<{ name: string; days: number }>
  church_summary: {
    active_partners: number
    new_churches: number
    partnership_type_counts: Record<string, number>
  }
}

export interface SummaryRecipient {
  id: string
  name: string
  email: string
  added_by: string | null
  active: boolean
  created_at: string
}

export interface ContactImport {
  id: string
  imported_by: string | null
  imported_at: string
  source_filename: string | null
  source_type: 'csv' | 'xlsx' | 'pdf' | null
  row_count: number
  success_count: number
  error_count: number
  error_log: Array<{ row: number; error: string; data?: Record<string, string> }>
}

// Extended types with joins
export interface ContactWithOwner extends Contact {
  owner?: User | null
  last_touchpoint_date?: string | null
}

export interface TouchpointWithDetails extends Touchpoint {
  contact?: Pick<Contact, 'id' | 'name'> | null
  user?: Pick<User, 'id' | 'name'> | null
}
