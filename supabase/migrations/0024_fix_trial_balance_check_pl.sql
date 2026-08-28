-- באג ב-0023: trial_balance_check חישבה יתרה מצטברת-מאז-ומעולם (point-in-time) לכל
-- החשבונות, כולל רווח והפסד — בדיוק הבעיה שכבר תיקנו במסך מאזן בוחן ובמסכי הדוח: ברגע
-- שיש כמה שנים טעונות בלי סגירת שנה, חשבון רו"ה "ממשיך לצבור" משנה לשנה במקום להתאפס.
-- התיקון: אותו עיקרון בדיוק כמו בשאר המערכת — סעיף מאזן מחושב כיתרה מצטברת ליום, סעיף
-- רווח והפסד מחושב כתנועת התקופה הנבחרת בלבד (עם החרגת פקודות סגירה, ראו migration 0018).
-- חשבון שעדיין לא מוין לביאור (ולכן לא ידוע אם הוא מאזן או רו"ה) נשאר ביתרה מצטברת כברירת מחדל.
drop function if exists public.trial_balance_check(uuid, date);

create function public.trial_balance_check(p_client_id uuid, p_period_start date, p_period_end date)
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
      a.id,
      case
        when rg.statement = 'pl' then
          coalesce(
            sum(
              case
                when t.txn_date between p_period_start and p_period_end
                     and coalesce(trim(t.description), '') not in ('יתרת סגירה', 'סגירת שנה')
                then t.debit - t.credit
                else 0
              end
            ),
            0
          )
        else
          a.opening_balance
          + coalesce(sum(case when t.txn_date <= p_period_end then t.debit - t.credit else 0 end), 0)
      end as balance
    from public.accounts a
    left join public.transactions t on t.account_id = a.id
    left join public.notes n on n.id = a.note_id
    left join public.report_groups rg on rg.client_id = a.client_id and rg.name = n."group"
    where a.client_id = p_client_id
    group by a.id, a.opening_balance, rg.statement
  ) b;
$$;

grant execute on function public.trial_balance_check(uuid, date, date) to authenticated;
