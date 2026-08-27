-- מוסיף note_id לפלט של account_balances_as_of, כדי שמסך מאזן הבוחן יוכל להציג ולערוך
-- את שיוך הביאור לכל חשבון בלי קריאה נפרדת.
create or replace function public.account_balances_as_of(p_client_id uuid, p_as_of date)
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
        'note_id', b.note_id,
        'balance', b.balance
      )
      order by b.code
    ),
    '[]'::jsonb
  )
  from (
    select
      a.id, a.code, a.name, a.note_id,
      a.opening_balance + coalesce(sum(case when t.txn_date <= p_as_of then t.debit - t.credit else 0 end), 0) as balance
    from public.accounts a
    left join public.transactions t on t.account_id = a.id
    where a.client_id = p_client_id
    group by a.id, a.code, a.name, a.note_id, a.opening_balance
  ) b;
$$;

grant execute on function public.account_balances_as_of(uuid, date) to authenticated;
