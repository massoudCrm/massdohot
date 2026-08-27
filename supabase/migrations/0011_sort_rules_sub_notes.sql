-- כלל מיון צריך להיות מסוגל להצביע גם על תת-ביאור (למשל קוד מיון 311 -> תת-ביאור "עובדים"
-- שתחת ביאור "זכאים אחרים"), לא רק על ביאור. note_id נשאר חובה (הביאור-האב) כדי שכל הלוגיקה
-- הקיימת שמסתמכת עליו (בדיקת "לא מוין", סה"כ לביאור) תמשיך לעבוד גם לחשבונות עם תת-ביאור.
alter table public.sort_rules
  add column sub_note_id uuid references public.sub_notes(id) on delete set null;

drop function if exists public.apply_sort_rules(uuid, boolean);

create function public.apply_sort_rules(p_client_id uuid, p_only_unassigned boolean)
returns integer
language sql
security invoker
as $$
  with matched as (
    select distinct on (a.id) a.id as account_id, r.note_id, r.sub_note_id
    from public.accounts a
    join public.sort_rules r
      on r.client_id = p_client_id
      and (
        -- כלל לפי קוד מיון מהקובץ: התאמה מדויקת
        (r.source_group_code is not null and a.source_group_code = r.source_group_code)
        or
        -- כלל לפי טווח כרטיסים נומרי (כמו קודם)
        (
          r.source_group_code is null
          and r.from_code ~ '^[0-9]+$' and r.to_code ~ '^[0-9]+$' and a.code ~ '^[0-9]+$'
          and a.code::numeric >= r.from_code::numeric
          and a.code::numeric <= r.to_code::numeric
        )
      )
    where a.client_id = p_client_id
      and (p_only_unassigned = false or a.note_id is null)
    order by a.id, r.created_at asc
  ),
  updated as (
    update public.accounts a
    set note_id = m.note_id, sub_note_id = m.sub_note_id
    from matched m
    where a.id = m.account_id
    returning a.id
  )
  select count(*)::integer from updated;
$$;

grant execute on function public.apply_sort_rules(uuid, boolean) to authenticated;
