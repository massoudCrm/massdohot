-- הגרסה הקודמת (0003) החזירה טבלת שורות, שכפופה למגבלת 1,000 השורות שServer-הצד (Supabase/
-- PostgREST) אוכף על כל תשובה — מה שחייב לדפדף בעמודים, וכל עמוד חישב מחדש את כל הצירוף
-- (JOIN + GROUP BY) על כל התנועות במקום פעם אחת. עם 7,000+ חשבונות ו-~50,000 תנועות זה יקר.
--
-- הפתרון: מחזירים את כל היתרות כאובייקט JSON יחיד (מערך אחד בתוך שורה אחת) — כך PostgREST
-- לא מגביל את התשובה (זו שורה בודדת), והחישוב היקר רץ פעם אחת בלבד לכל תקופה.
drop function if exists public.account_balances_as_of(uuid, date);

create function public.account_balances_as_of(p_client_id uuid, p_as_of date)
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
        'balance', b.balance
      )
      order by b.code
    ),
    '[]'::jsonb
  )
  from (
    select
      a.id, a.code, a.name,
      a.opening_balance + coalesce(sum(case when t.txn_date <= p_as_of then t.debit - t.credit else 0 end), 0) as balance
    from public.accounts a
    left join public.transactions t on t.account_id = a.id
    where a.client_id = p_client_id
    group by a.id, a.code, a.name, a.opening_balance
  ) b;
$$;

grant execute on function public.account_balances_as_of(uuid, date) to authenticated;

-- אין אינדקס אוטומטי על מפתח זר ב-Postgres — עם עשרות אלפי תנועות זה משמעותי הן לחישוב
-- היתרות (JOIN) והן למחיקה בקליטה חוזרת.
create index if not exists transactions_account_id_idx on public.transactions(account_id);
