-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- users (mirrors auth.users)
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text unique not null,
  role text not null default 'member' check (role in ('admin','member')),
  created_at timestamptz default now()
);

-- contacts
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  organization text,
  phone text,
  email text,
  address text,
  type text check (type in ('individual','church','business','community_org')),
  relationship_owner uuid references public.users(id),
  stage text,
  previous_stage text,
  stage_changed_at timestamptz,
  notes text,
  tags text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- church_details
create table public.church_details (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid unique not null references public.contacts(id) on delete cascade,
  denomination text,
  congregation_size text check (congregation_size in ('small','medium','large')),
  partnership_types text[] default '{}',
  what_committed text,
  primary_contact_name text,
  primary_contact_email text,
  primary_contact_phone text
);

-- touchpoints
create table public.touchpoints (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  user_id uuid not null references public.users(id),
  type text not null check (type in ('call','email','coffee_meal','church_visit','event','introduction','thank_you','other')),
  date date not null,
  notes text,
  outcome text,
  next_step text,
  next_step_date date,
  created_at timestamptz default now()
);

-- monthly_summaries
create table public.monthly_summaries (
  id uuid primary key default gen_random_uuid(),
  period_month date not null,
  generated_by uuid references public.users(id),
  generated_at timestamptz default now(),
  snapshot_data jsonb not null
);

-- summary_recipients
create table public.summary_recipients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  added_by uuid references public.users(id),
  active boolean default true,
  created_at timestamptz default now()
);

-- contact_imports
create table public.contact_imports (
  id uuid primary key default gen_random_uuid(),
  imported_by uuid references public.users(id),
  imported_at timestamptz default now(),
  source_filename text,
  source_type text check (source_type in ('csv','xlsx','pdf')),
  row_count int default 0,
  success_count int default 0,
  error_count int default 0,
  error_log jsonb default '[]'
);

-- RLS
alter table public.users enable row level security;
alter table public.contacts enable row level security;
alter table public.church_details enable row level security;
alter table public.touchpoints enable row level security;
alter table public.monthly_summaries enable row level security;
alter table public.summary_recipients enable row level security;
alter table public.contact_imports enable row level security;

-- All authenticated users can read everything
create policy "auth read users" on public.users for select using (auth.role() = 'authenticated');
create policy "auth read contacts" on public.contacts for select using (auth.role() = 'authenticated');
create policy "auth read church_details" on public.church_details for select using (auth.role() = 'authenticated');
create policy "auth read touchpoints" on public.touchpoints for select using (auth.role() = 'authenticated');
create policy "auth read summaries" on public.monthly_summaries for select using (auth.role() = 'authenticated');
create policy "auth read recipients" on public.summary_recipients for select using (auth.role() = 'authenticated');
create policy "auth read imports" on public.contact_imports for select using (auth.role() = 'authenticated');

-- Members can insert/update contacts, church_details, touchpoints
create policy "auth insert contacts" on public.contacts for insert with check (auth.role() = 'authenticated');
create policy "auth update contacts" on public.contacts for update using (auth.role() = 'authenticated');
create policy "auth insert church_details" on public.church_details for insert with check (auth.role() = 'authenticated');
create policy "auth update church_details" on public.church_details for update using (auth.role() = 'authenticated');
create policy "auth insert touchpoints" on public.touchpoints for insert with check (auth.role() = 'authenticated');
create policy "auth insert imports" on public.contact_imports for insert with check (auth.role() = 'authenticated');

-- Helper function: get current user role
create or replace function public.get_user_role()
returns text language sql security definer as $$
  select role from public.users where id = auth.uid();
$$;

-- Admin-only policies
create policy "admin delete contacts" on public.contacts for delete using (public.get_user_role() = 'admin');
create policy "admin insert summaries" on public.monthly_summaries for insert with check (public.get_user_role() = 'admin');
create policy "admin manage recipients" on public.summary_recipients for all using (public.get_user_role() = 'admin');
create policy "admin manage users" on public.users for all using (public.get_user_role() = 'admin');

-- Updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger contacts_updated_at before update on public.contacts
  for each row execute function public.set_updated_at();

-- Indexes for performance
create index on public.contacts(relationship_owner);
create index on public.contacts(type);
create index on public.contacts(stage);
create index on public.touchpoints(contact_id);
create index on public.touchpoints(user_id);
create index on public.touchpoints(date);
