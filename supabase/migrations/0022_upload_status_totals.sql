-- מוסיף לתקציר "מה כבר נטען" (מסך קליטת קבצים) גם סה"כ חובה/זכות בפועל לכל שנה, לא רק
-- כמות תנועות — כדי שאפשר יהיה להשוות ישירות מול "סה"כ לדו"ח" שמופיע בדוח מאזן הבוחן
-- של תוכנת ההנה"ח המקורית, ולוודא שאף תנועה לא אבדה בקליטה (לא רק בפענוח הקובץ אלא גם
-- בשמירה בפועל ב-DB — בדיוק הבאג שכבר תפסנו פעם עם מגבלת ה-1,000 שורות).
create or replace function public.client_upload_status(p_client_id uuid)
returns jsonb
language sql
stable
security invoker
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'year', y.year,
        'txn_count', y.txn_count,
        'total_debit', y.total_debit,
        'total_credit', y.total_credit,
        'last_uploaded_at', y.last_uploaded_at
      )
      order by y.year desc
    ),
    '[]'::jsonb
  )
  from (
    select
      extract(year from t.txn_date)::int as year,
      count(*) as txn_count,
      sum(t.debit) as total_debit,
      sum(t.credit) as total_credit,
      max(t.created_at) as last_uploaded_at
    from public.transactions t
    join public.accounts a on a.id = t.account_id
    where a.client_id = p_client_id
    group by extract(year from t.txn_date)
  ) y;
$$;

grant execute on function public.client_upload_status(uuid) to authenticated;
