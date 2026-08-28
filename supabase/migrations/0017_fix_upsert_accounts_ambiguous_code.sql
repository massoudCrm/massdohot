-- באג ב-0015: פונקציית plpgsql עם returns table(id uuid, code text) יוצרת באופן שקוף משתנים
-- בשם id/code בתוך גוף הפונקציה — וה-code הבלתי-מוכשר ב-"on conflict (client_id, code)" התנגש
-- איתם ("column reference \"code\" is ambiguous"). התיקון: language sql בלי plpgsql/return query
-- כלל, כך שאין בכלל משתנים כאלה — רק ה-INSERT...RETURNING עצמו כגוף הפונקציה.
create or replace function public.upsert_accounts_with_opening_balance(p_client_id uuid, p_accounts jsonb)
returns table(id uuid, code text)
language sql
security invoker
as $$
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
  returning public.accounts.id, public.accounts.code;
$$;

grant execute on function public.upsert_accounts_with_opening_balance(uuid, jsonb) to authenticated;
