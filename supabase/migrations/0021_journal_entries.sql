-- פקודות יומן ידניות: journal_entries/journal_entry_lines כבר קיימות מאז migration 0001
-- (בתור "מסמך" מאוזן של השורה), אבל שום חישוב יתרה קיים (account_balances_as_of,
-- pl_period_activity וכו') לא קורא מהן — כולן קוראות רק מ-transactions. הפתרון: כל פקודת
-- יומן "מתפרסמת" מיד לשורות רגילות בטבלת transactions (source='manual'), כך שכל מנגנוני
-- החישוב הקיימים רואים אותה אוטומטית בלי שום שינוי בהם. journal_entry_line_id על transactions
-- מקשר בחזרה לשורה שיצרה אותה, כדי שמחיקה/עדכון של פקודת יומן ינקו את התנועות שלה (cascade).
alter table public.transactions
  add column journal_entry_line_id uuid references public.journal_entry_lines(id) on delete cascade;

create index transactions_journal_entry_line_id_idx on public.transactions(journal_entry_line_id);

-- יוצר פקודת יומן מאוזנת (חובה=זכות, אחרת שגיאה) ומפרסם אותה מיד לתנועות.
-- p_lines: jsonb array של {account_id, side ('D'/'C'), amount}.
create function public.create_journal_entry(
  p_client_id uuid,
  p_entry_date date,
  p_description text,
  p_lines jsonb
)
returns uuid
language plpgsql
security invoker
as $$
declare
  v_entry_id uuid;
  v_total_debit numeric(14,2);
  v_total_credit numeric(14,2);
begin
  select
    coalesce(sum(case when x.side = 'D' then x.amount else 0 end), 0),
    coalesce(sum(case when x.side = 'C' then x.amount else 0 end), 0)
  into v_total_debit, v_total_credit
  from jsonb_to_recordset(p_lines) as x(account_id uuid, side text, amount numeric);

  if v_total_debit <> v_total_credit then
    raise exception 'פקודת היומן אינה מאוזנת: חובה % זכות %', v_total_debit, v_total_credit;
  end if;
  if v_total_debit = 0 then
    raise exception 'פקודת היומן ריקה';
  end if;

  insert into public.journal_entries (client_id, entry_date, description)
  values (p_client_id, p_entry_date, coalesce(p_description, ''))
  returning id into v_entry_id;

  with inserted_lines as (
    insert into public.journal_entry_lines (entry_id, account_id, side, amount)
    select v_entry_id, x.account_id, x.side, x.amount
    from jsonb_to_recordset(p_lines) as x(account_id uuid, side text, amount numeric)
    returning id, account_id, side, amount
  )
  insert into public.transactions (account_id, txn_date, reference, description, debit, credit, source, journal_entry_line_id)
  select
    account_id,
    p_entry_date,
    null,
    coalesce(p_description, ''),
    case when side = 'D' then amount else 0 end,
    case when side = 'C' then amount else 0 end,
    'manual',
    id
  from inserted_lines;

  return v_entry_id;
end;
$$;

grant execute on function public.create_journal_entry(uuid, date, text, jsonb) to authenticated;

-- עריכת פקודה קיימת: מוחקת את השורות/תנועות הישנות (cascade) ובונה מחדש — פשוט וחסין
-- יותר מהתאמת-שינויים (diff) בין הישן לחדש, ועקבי עם דפוסי "החלפה מלאה" אחרים בפרויקט.
create function public.update_journal_entry(
  p_entry_id uuid,
  p_entry_date date,
  p_description text,
  p_lines jsonb
)
returns void
language plpgsql
security invoker
as $$
declare
  v_total_debit numeric(14,2);
  v_total_credit numeric(14,2);
begin
  select
    coalesce(sum(case when x.side = 'D' then x.amount else 0 end), 0),
    coalesce(sum(case when x.side = 'C' then x.amount else 0 end), 0)
  into v_total_debit, v_total_credit
  from jsonb_to_recordset(p_lines) as x(account_id uuid, side text, amount numeric);

  if v_total_debit <> v_total_credit then
    raise exception 'פקודת היומן אינה מאוזנת: חובה % זכות %', v_total_debit, v_total_credit;
  end if;
  if v_total_debit = 0 then
    raise exception 'פקודת היומן ריקה';
  end if;

  delete from public.journal_entry_lines where entry_id = p_entry_id;

  update public.journal_entries
  set entry_date = p_entry_date, description = coalesce(p_description, '')
  where id = p_entry_id;

  with inserted_lines as (
    insert into public.journal_entry_lines (entry_id, account_id, side, amount)
    select p_entry_id, x.account_id, x.side, x.amount
    from jsonb_to_recordset(p_lines) as x(account_id uuid, side text, amount numeric)
    returning id, account_id, side, amount
  )
  insert into public.transactions (account_id, txn_date, reference, description, debit, credit, source, journal_entry_line_id)
  select
    account_id,
    p_entry_date,
    null,
    coalesce(p_description, ''),
    case when side = 'D' then amount else 0 end,
    case when side = 'C' then amount else 0 end,
    'manual',
    id
  from inserted_lines;
end;
$$;

grant execute on function public.update_journal_entry(uuid, date, text, jsonb) to authenticated;

-- כל פקודות היומן של לקוח, כולל השורות שלהן ופרטי החשבון — jsonb יחיד (לא טבלת שורות),
-- כדי לעקוף את מגבלת ה-1,000 השורות ולהימנע מ-N+1 שאילתות למסך הרשימה.
create function public.journal_entries_list(p_client_id uuid)
returns jsonb
language sql
stable
security invoker
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', e.id,
        'entry_date', e.entry_date,
        'description', e.description,
        'lines', (
          select coalesce(
            jsonb_agg(
              jsonb_build_object(
                'id', l.id,
                'account_id', l.account_id,
                'account_code', a.code,
                'account_name', a.name,
                'side', l.side,
                'amount', l.amount
              )
              order by l.side, a.code
            ),
            '[]'::jsonb
          )
          from public.journal_entry_lines l
          join public.accounts a on a.id = l.account_id
          where l.entry_id = e.id
        )
      )
      order by e.entry_date desc, e.created_at desc
    ),
    '[]'::jsonb
  )
  from public.journal_entries e
  where e.client_id = p_client_id;
$$;

grant execute on function public.journal_entries_list(uuid) to authenticated;

-- כל חשבונות הלקוח (קוד+שם בלבד) — jsonb יחיד, לצורך בורר החשבון בעריכת פקודת יומן
-- (יכולים להיות אלפי חשבונות, ראו אותה מגבלת 1,000 שורות).
create function public.client_accounts_list(p_client_id uuid)
returns jsonb
language sql
stable
security invoker
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'code', code, 'name', name) order by code), '[]'::jsonb)
  from public.accounts
  where client_id = p_client_id;
$$;

grant execute on function public.client_accounts_list(uuid) to authenticated;
