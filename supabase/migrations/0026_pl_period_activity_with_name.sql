-- מוסיף את שם החשבון לפלט pl_period_activity, כדי שביאור רווח והפסד יוכל להציג כל חשבון
-- שמשויך ישירות (בלי תת-ביאור) כשורה נפרדת משלו — ראו report-shared.ts / buildNoteDetails.
-- חשבון מאזני ממשיך להסתכם לביאור אחד כמו היום; רק חשבונות רו"ה מקבלים את הפירוט הזה.
create or replace function public.pl_period_activity(p_client_id uuid, p_period_start date, p_period_end date)
returns jsonb
language sql
stable
security invoker
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'account_id', b.id,
        'name', b.name,
        'note_id', b.note_id,
        'sub_note_id', b.sub_note_id,
        'balance', b.balance
      )
    ),
    '[]'::jsonb
  )
  from (
    select
      a.id, a.name, a.note_id, a.sub_note_id,
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
    group by a.id, a.name, a.note_id, a.sub_note_id
  ) b;
$$;

grant execute on function public.pl_period_activity(uuid, date, date) to authenticated;
