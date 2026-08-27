-- תמיכה בכמה שנות דוח לאותו לקוח: קליטת קובץ מציינת עכשיו במפורש לאיזו שנה הוא שייך,
-- ומחיקה בקליטה מוגבלת לתנועות של אותה שנה בלבד — לא כל התנועות של הלקוח כמו עד כה.
-- כך אפשר להעלות גם 2024 וגם 2025 לאותו לקוח בלי ששנה אחת תמחק את השנייה.
drop function if exists public.delete_client_transactions(uuid);

create function public.delete_client_transactions_for_year(p_client_id uuid, p_year smallint)
returns void
language sql
security invoker
as $$
  delete from public.transactions t
  using public.accounts a
  where t.account_id = a.id
    and a.client_id = p_client_id
    and extract(year from t.txn_date)::smallint = p_year;
$$;

grant execute on function public.delete_client_transactions_for_year(uuid, smallint) to authenticated;

-- תקציר מה שכבר נטען ללקוח, לפי שנה — מוצג במסך "קליטת קבצים" כדי למנוע העלאה כפולה בטעות.
create or replace function public.client_upload_status(p_client_id uuid)
returns jsonb
language sql
stable
security invoker
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object('year', y.year, 'txn_count', y.txn_count, 'last_uploaded_at', y.last_uploaded_at)
      order by y.year desc
    ),
    '[]'::jsonb
  )
  from (
    select
      extract(year from t.txn_date)::int as year,
      count(*) as txn_count,
      max(t.created_at) as last_uploaded_at
    from public.transactions t
    join public.accounts a on a.id = t.account_id
    where a.client_id = p_client_id
    group by extract(year from t.txn_date)
  ) y;
$$;

grant execute on function public.client_upload_status(uuid) to authenticated;

-- upsert חשבונות עם יתרת פתיחה "חכמה": יתרת הפתיחה מתעדכנת רק אם התאריך החדש מוקדם או שווה
-- לזה שכבר שמור (או שאין עדיין ערך) — כך שהעוגן תמיד נשאר הנקודה הכי מוקדמת שיש לנו נתונים
-- עליה, ושנה מאוחרת שמועלית אחרי שנה מוקדמת יותר לא "מקדמת" את העוגן ומשבשת את החישוב.
-- note_id/sub_note_id לא מוזכרים כאן בכוונה, כדי שמיון ידני ישרוד קליטה חוזרת (כמו עד היום).
create or replace function public.upsert_accounts_with_opening_balance(p_client_id uuid, p_accounts jsonb)
returns table(id uuid, code text)
language plpgsql
security invoker
as $$
begin
  return query
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
end;
$$;

grant execute on function public.upsert_accounts_with_opening_balance(uuid, jsonb) to authenticated;
