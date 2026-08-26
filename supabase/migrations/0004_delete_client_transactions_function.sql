-- מוחק את כל התנועות של לקוח (לקראת קליטה מחדש) בפעולה אחת בצד השרת.
-- נמנעים מלשלוף את כל מזהי החשבונות לדפדפן ולהעביר אותם ב-URL (עם אלפי חשבונות
-- זה עלול לחרוג ממגבלת אורך URL), ומהסתמכות על עמוד תוצאות שעלול להיחתך ב-1000 שורות.
create or replace function public.delete_client_transactions(p_client_id uuid)
returns void
language sql
security invoker
as $$
  delete from public.transactions
  where account_id in (select id from public.accounts where client_id = p_client_id);
$$;

grant execute on function public.delete_client_transactions(uuid) to authenticated;
