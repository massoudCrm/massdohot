-- תוכנות הנה"ח מבצעות "סגירת שנה" שמאפסת כל חשבון רווח והפסד ב-31/12 (מעבירה את היתרה
-- לעודפים) — ומתארכת את פקודת הסגירה לאותו יום שממנו אנחנו רוצים לדווח. חישוב יתרה מצטברת
-- "נכון לתאריך" (account_balances_as_of, כמו שמשמש למאזן) לכן תמיד מראה 0 לחשבונות רווח
-- והפסד בשנה סגורה — הוא סוכם את כל הפעילות האמיתית ואז את פקodת הסגירה שמאפסת אותה בדיוק.
-- הפתרון: רווח והפסד מחושב כתנועה בתוך טווח התקופה (לא יתרה מצטברת), ומחריג את פקודות
-- הסגירה עצמן לפי התיאור המזהה שלהן ("פרטים" בכרטסת) — כפי שאומת מול כרטסת אמיתית.
create or replace function public.pl_period_activity(p_client_id uuid, p_period_start date, p_period_end date)
returns jsonb
language sql
stable
security invoker
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object('account_id', b.id, 'note_id', b.note_id, 'sub_note_id', b.sub_note_id, 'balance', b.balance)
    ),
    '[]'::jsonb
  )
  from (
    select
      a.id, a.note_id, a.sub_note_id,
      coalesce(sum(
        case
          when t.txn_date between p_period_start and p_period_end
               and coalesce(trim(t.description), '') not in ('יתרת סגירה', 'סגירת שנה')
          then t.debit - t.credit
          else 0
        end
      ), 0) as balance
    from public.accounts a
    left join public.transactions t on t.account_id = a.id
    where a.client_id = p_client_id
    group by a.id, a.note_id, a.sub_note_id
  ) b;
$$;

grant execute on function public.pl_period_activity(uuid, date, date) to authenticated;
