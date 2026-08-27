-- תת-ביאור: שייך לביאור מסוים (בדיוק כמו שביאור שייך לקבוצה), מאגד כמה חשבונות תחת כותרת-משנה
-- בתוך הביאור (למשל ביאור "זכאים ויתרות זכות" -> תת-ביאור "מוסדות" -> מע"מ, ניכויי מס הכנסה וכו').
create table public.sub_notes (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes(id) on delete cascade,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.sub_notes enable row level security;
create policy "authenticated full access" on public.sub_notes for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- חשבון יכול להיות משויך ישירות לביאור (sub_note_id = null, כמו "פחת"), או דרך תת-ביאור
-- (כמו כל חשבון תחת "מוסדות"). כשיש תת-ביאור, ה-note_id עדיין נשאר מוגדר על החשבון עצמו —
-- כך שכל הלוגיקה הקיימת שמסתמכת על note_id (סינון, כללי מיון, סה"כ לביאור) ממשיכה לעבוד.
alter table public.accounts
  add column sub_note_id uuid references public.sub_notes(id) on delete set null;

-- כמות חשבונות לכל תת-ביאור, באותו דפוס כמו note_account_counts.
create or replace function public.sub_note_account_counts(p_client_id uuid)
returns jsonb
language sql
stable
security invoker
as $$
  select coalesce(jsonb_object_agg(sub_note_id::text, cnt), '{}'::jsonb)
  from (
    select sub_note_id, count(*) as cnt
    from public.accounts
    where client_id = p_client_id and sub_note_id is not null
    group by sub_note_id
  ) t;
$$;

grant execute on function public.sub_note_account_counts(uuid) to authenticated;

-- מוסיף sub_note_id לפלט account_balances_as_of, כדי שמסך מאזן הבוחן יוכל להציג ולערוך גם שיוך תת-ביאור.
create or replace function public.account_balances_as_of(p_client_id uuid, p_as_of date)
returns jsonb
language sql
stable
security invoker
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'account_id', b.id,
        'code', b.code,
        'name', b.name,
        'note_id', b.note_id,
        'sub_note_id', b.sub_note_id,
        'source_group_code', b.source_group_code,
        'source_group_desc', b.source_group_desc,
        'balance', b.balance
      )
      order by b.code
    ),
    '[]'::jsonb
  )
  from (
    select
      a.id, a.code, a.name, a.note_id, a.sub_note_id, a.source_group_code, a.source_group_desc,
      a.opening_balance + coalesce(sum(case when t.txn_date <= p_as_of then t.debit - t.credit else 0 end), 0) as balance
    from public.accounts a
    left join public.transactions t on t.account_id = a.id
    where a.client_id = p_client_id
    group by a.id, a.code, a.name, a.note_id, a.sub_note_id, a.source_group_code, a.source_group_desc, a.opening_balance
  ) b;
$$;

grant execute on function public.account_balances_as_of(uuid, date) to authenticated;
