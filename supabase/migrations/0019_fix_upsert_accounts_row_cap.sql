-- באג נוסף ב-0015/0017: הפונקציה הייתה returns table(id uuid, code text) — תשובה מרובת-שורות
-- רגילה של PostgREST, שכפופה למגבלת ה-1,000 שורות שכבר נלמדה ותועדה בפרויקט הזה (ראו
-- account_balances_as_of, migration 0005). ללקוח עם 7,243 חשבונות, רק ~1,000 הראשונים חזרו
-- מה-RPC, ולכן codeToId ב-file-ingestion.tsx החסיר את שאר החשבונות — ותנועות של חשבונות
-- שלא היו במפה נזרקו בשקט (בלי שגיאה) בלולאת ה-map/filter. התיקון: כמו בכל מקום אחר
-- באפליקציה — jsonb יחיד (jsonb_agg) במקום table, כך שאין יותר מגבלת-שורות בכלל.
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
  )
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'code', code)), '[]'::jsonb) from upserted;
$$;

grant execute on function public.upsert_accounts_with_opening_balance(uuid, jsonb) to authenticated;
