-- "סה"כ לדו"ח" בדוח מאזן הבוחן של תוכנת ההנה"ח הוא סיכום *יתרות* (חובה חיובית / זכות שלילית
-- לכל חשבון, ליום נתון) — לא סיכום כל תנועות חובה/זכות הגולמיות שנעשו. זו בדיקה שונה
-- ומשלימה לזו שכבר יש ב-client_upload_status (שם, סיכום תנועות גולמי — רגיש יותר לאובדן
-- תנועה בודדת, אבל לא ניתן להשוואה ישירה מול הדוח המקורי). הפונקציה הזו משתמשת באותה
-- נוסחת יתרה בדיוק כמו account_balances_as_of, אבל מחזירה רק שני סכומים — לא שורה לכל חשבון.
create or replace function public.trial_balance_check(p_client_id uuid, p_as_of date)
returns jsonb
language sql
stable
security invoker
as $$
  select jsonb_build_object(
    'total_debit', coalesce(sum(case when b.balance > 0 then b.balance else 0 end), 0),
    'total_credit', coalesce(sum(case when b.balance < 0 then -b.balance else 0 end), 0)
  )
  from (
    select
      a.opening_balance + coalesce(sum(case when t.txn_date <= p_as_of then t.debit - t.credit else 0 end), 0) as balance
    from public.accounts a
    left join public.transactions t on t.account_id = a.id
    where a.client_id = p_client_id
    group by a.id, a.opening_balance
  ) b;
$$;

grant execute on function public.trial_balance_check(uuid, date) to authenticated;
