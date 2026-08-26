-- מחשב את יתרת כל חשבון של לקוח נכון לתאריך נתון: יתרת פתיחה + (חובה-זכות) של כל התנועות
-- עד אותו תאריך (כולל). זהו "גרעין החישוב" היחיד שממנו ניזון מאזן הבוחן, לתקופה הנוכחית
-- ולתקופה המקבילה כאחד — כל צריכה של יתרת חשבון בכל מסך תעבור דרך הפונקציה הזו.
create or replace function public.account_balances_as_of(p_client_id uuid, p_as_of date)
returns table (account_id uuid, code text, name text, balance numeric)
language sql
stable
security invoker
as $$
  select
    a.id as account_id,
    a.code,
    a.name,
    a.opening_balance + coalesce(sum(case when t.txn_date <= p_as_of then t.debit - t.credit else 0 end), 0) as balance
  from public.accounts a
  left join public.transactions t on t.account_id = a.id
  where a.client_id = p_client_id
  group by a.id, a.code, a.name
  order by a.code;
$$;

grant execute on function public.account_balances_as_of(uuid, date) to authenticated;
