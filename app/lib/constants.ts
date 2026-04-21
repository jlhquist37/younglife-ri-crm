export const INDIVIDUAL_STAGES = ['Prospect', 'Cultivating', 'Engaged', 'Committed', 'Lapsed']
export const CHURCH_STAGES = ['Aware', 'Exploring', 'Active Partner', 'Champion']
export const CONTACT_TYPES = ['individual', 'church', 'business', 'community_org']
export const TOUCHPOINT_TYPES = ['call', 'email', 'coffee_meal', 'church_visit', 'event', 'introduction', 'thank_you', 'other']
export const PARTNERSHIP_TYPES = ['volunteers', 'event_space', 'prayer', 'missional', 'financial_supporter']
export const PREDEFINED_TAGS = [
  'Donor',
  'Church Leader',
  'Volunteer',
  'Business Partner',
  'Board Prospect',
  'Committee Member',
  'Golf Event',
  'Monthly Giver',
  'Alumni',
  'Event Host',
  'Warm Introduction',
]
export const STAGE_COLORS: Record<string, string> = {
  Prospect: 'bg-slate-100 text-slate-700',
  Cultivating: 'bg-blue-100 text-blue-700',
  Engaged: 'bg-indigo-100 text-indigo-700',
  Committed: 'bg-green-100 text-green-700',
  Lapsed: 'bg-red-100 text-red-700',
  Aware: 'bg-slate-100 text-slate-700',
  Exploring: 'bg-yellow-100 text-yellow-700',
  'Active Partner': 'bg-emerald-100 text-emerald-700',
  Champion: 'bg-purple-100 text-purple-700',
}

export const TYPE_LABELS: Record<string, string> = {
  individual: 'Individual',
  church: 'Church',
  business: 'Business',
  community_org: 'Community Org',
}

export const TOUCHPOINT_LABELS: Record<string, string> = {
  call: 'Call',
  email: 'Email',
  coffee_meal: 'Coffee / Meal',
  church_visit: 'Church Visit',
  event: 'Event',
  introduction: 'Introduction',
  thank_you: 'Thank You',
  other: 'Other',
}
