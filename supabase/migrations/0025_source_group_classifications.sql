-- מיפוי "קוד מיון" (השדה שכבר מגיע מהקובץ האחיד, שדות 1405/1406) לסיווג מאזני/תוצאתי,
-- ברמת לקוח. המטרה: חשבון שעוד לא שויך לביאור עדיין יחושב נכון (תנועת תקופה לתוצאתי,
-- יתרה מצטברת למאזני) בלי להמתין לשיוך ביאור ידני — כי הקוד מיון כבר ידוע מרגע הקליטה.
-- statement = null אומר "עדיין לא נקבע" (קוד חדש שהתגלה, ממתין להחלטת המשתמש) — לא ניחוש.
create table if not exists public.source_group_classifications (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  source_group_code text not null,
  source_group_desc text,
  statement text check (statement in ('bs', 'pl')),
  created_at timestamptz not null default now(),
  unique (client_id, source_group_code)
);

alter table public.source_group_classifications enable row level security;
drop policy if exists "authenticated full access" on public.source_group_classifications;
create policy "authenticated full access" on public.source_group_classifications
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- איכלוס ראשוני מהחשבונות שכבר נטענו עד היום, כדי שלקוחות קיימים לא יתחילו מרשימה ריקה.
insert into public.source_group_classifications (client_id, source_group_code, source_group_desc)
select distinct client_id, source_group_code, source_group_desc
from public.accounts
where source_group_code is not null
on conflict (client_id, source_group_code) do nothing;

-- מוסיף איכלוס/עדכון אוטומטי של source_group_classifications בכל קליטת קובץ: קוד מיון
-- חדש נכנס עם statement = null (ממתין להחלטה), קוד קיים רק מתעדכן בתיאור העדכני מהקובץ.
drop function if exists public.upsert_accounts_with_opening_balance(uuid, jsonb);

create function public.upsert_accounts_with_opening_balance(p_client_id uuid, p_accounts jsonb)
returns jsonb
language sql
security invoker
as $$
  with upserted as (
    insert into public.accounts (client_id, code, name, opening_balance, opening_date, source_group_code, source_group_desc)
    select
      p_client_id,
      x.code,
      x.name,
      x.opening_balance,
      x.opening_date,
      nullif(x.source_group_code, ''),
      nullif(x.source_group_desc, '')
    from jsonb_to_recordset(p_accounts) as x(
      code text,
      name text,
      opening_balance numeric,
      opening_date date,
      source_group_code text,
      source_group_desc text
    )
    on conflict (client_id, code) do update set
      name = excluded.name,
      source_group_code = excluded.source_group_code,
      source_group_desc = excluded.source_group_desc,
      opening_balance = case
        when public.accounts.opening_date is null or excluded.opening_date <= public.accounts.opening_date
          then excluded.opening_balance
        else public.accounts.opening_balance
      end,
      opening_date = case
        when public.accounts.opening_date is null or excluded.opening_date <= public.accounts.opening_date
          then excluded.opening_date
        else public.accounts.opening_date
      end
    returning id, code
  ),
  group_codes as (
    select distinct nullif(x.source_group_code, '') as code, nullif(x.source_group_desc, '') as group_desc
    from jsonb_to_recordset(p_accounts) as x(source_group_code text, source_group_desc text)
    where nullif(x.source_group_code, '') is not null
  ),
  upsert_groups as (
    insert into public.source_group_classifications (client_id, source_group_code, source_group_desc)
    select p_client_id, code, group_desc from group_codes
    on conflict (client_id, source_group_code) do update set
      source_group_desc = coalesce(excluded.source_group_desc, public.source_group_classifications.source_group_desc)
    returning 1
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'code', code)), '[]'::jsonb) from upserted;
$$;

grant execute on function public.upsert_accounts_with_opening_balance(uuid, jsonb) to authenticated;
