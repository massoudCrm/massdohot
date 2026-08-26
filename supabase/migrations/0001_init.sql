-- Initial schema for the financial reports app (מסעוד אסעד, יועץ מס)
-- Run this once in the Supabase SQL Editor (Project → SQL Editor → New query → paste → Run).

create extension if not exists pgcrypto;

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tax_id text not null,
  kind text not null default 'חברה בע"מ',
  status text not null default 'בעריכה',
  general_note text not null default '',
  from_month smallint not null default 1,
  to_month smallint not null default 6,
  report_year smallint not null default extract(year from now())::smallint,
  unit text not null default 'ones',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  "group" text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  code text not null,
  name text not null,
  note_id uuid references public.notes(id) on delete set null,
  is_manual boolean not null default false,
  created_at timestamptz not null default now(),
  unique (client_id, code)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  txn_date date not null,
  reference text,
  description text,
  debit numeric(14,2) not null default 0,
  credit numeric(14,2) not null default 0,
  source text not null default 'file' check (source in ('file','manual')),
  created_at timestamptz not null default now()
);

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  entry_date date not null,
  description text not null default '',
  created_at timestamptz not null default now()
);

create table public.journal_entry_lines (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.journal_entries(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  side text not null check (side in ('D','C')),
  amount numeric(14,2) not null check (amount > 0)
);

create table public.sort_rules (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  from_code text not null,
  to_code text not null,
  note_id uuid not null references public.notes(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.note_templates (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade, -- null = ברירת מחדל גלובלית
  name text not null,
  notes_snapshot jsonb not null,
  general_note text not null default '',
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.report_versions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  period_label text not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

-- RLS: כלי פנימי למשתמש יחיד — כל משתמש מחובר (authenticated) מקבל גישה מלאה, גולשים אנונימיים לא.
alter table public.clients enable row level security;
alter table public.notes enable row level security;
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_entry_lines enable row level security;
alter table public.sort_rules enable row level security;
alter table public.note_templates enable row level security;
alter table public.report_versions enable row level security;

create policy "authenticated full access" on public.clients for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on public.notes for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on public.accounts for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on public.transactions for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on public.journal_entries for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on public.journal_entry_lines for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on public.sort_rules for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on public.note_templates for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on public.report_versions for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
