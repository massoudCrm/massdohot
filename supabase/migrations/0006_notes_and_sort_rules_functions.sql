-- כמות חשבונות לכל ביאור (כולל "ללא ביאור"), כאובייקט JSON יחיד — אותה סיבה כמו ב-0005:
-- להימנע ממגבלת 1,000 השורות וממספר קריאות מיותר.
create or replace function public.note_account_counts(p_client_id uuid)
returns jsonb
language sql
stable
security invoker
as $$
  select coalesce(jsonb_object_agg(coalesce(note_id::text, 'unassigned'), cnt), '{}'::jsonb)
  from (
    select note_id, count(*) as cnt
    from public.accounts
    where client_id = p_client_id
    group by note_id
  ) t;
$$;

grant execute on function public.note_account_counts(uuid) to authenticated;

-- מחיל את כללי המיון האוטומטיים (טווח כרטיסים -> ביאור) על חשבונות הלקוח.
-- p_only_unassigned=true מחיל רק על חשבונות שעדיין ללא ביאור; false מחיל על הכל.
-- כשכמה כללים חופפים לאותו חשבון, הכלל שנוצר ראשון מנצח (התנהגות "התאמה ראשונה").
-- חשבונות שהקוד שלהם אינו נומרי, או כללים עם טווח לא נומרי, מדולגים בשקט (כמו באב-הטיפוס).
create or replace function public.apply_sort_rules(p_client_id uuid, p_only_unassigned boolean)
returns integer
language sql
security invoker
as $$
  with matched as (
    select distinct on (a.id) a.id as account_id, r.note_id
    from public.accounts a
    join public.sort_rules r
      on r.client_id = p_client_id
      and a.code ~ '^[0-9]+$' and r.from_code ~ '^[0-9]+$' and r.to_code ~ '^[0-9]+$'
      and a.code::numeric >= r.from_code::numeric
      and a.code::numeric <= r.to_code::numeric
    where a.client_id = p_client_id
      and (p_only_unassigned = false or a.note_id is null)
    order by a.id, r.created_at asc
  ),
  updated as (
    update public.accounts a
    set note_id = m.note_id
    from matched m
    where a.id = m.account_id
    returning a.id
  )
  select count(*)::integer from updated;
$$;

grant execute on function public.apply_sort_rules(uuid, boolean) to authenticated;
