-- קוד המיון שתוכנת ההנה"ח כבר קובעת לכל חשבון (B110, שדות 1405/1406 — "קוד מאזן בוחן").
-- זה בדיוק הקוד שמקבץ למשל את כל הלקוחות (חייבים/כרטיסי אשראי/שיקים לגביה) תחת קוד אחד
-- (למשל "11") בדוח המקורי — הרבה יותר אמין למיון מאשר טווחי מספרי כרטיס.
alter table public.accounts
  add column source_group_code text,
  add column source_group_desc text;

-- כלל מיון יכול להתבסס על טווח כרטיסים (כפי שהיה) *או* על קוד המיון מהקובץ — לכן טווח
-- הכרטיסים הופך לרשות (null כשמשתמשים בקוד מיון במקום).
alter table public.sort_rules
  alter column from_code drop not null,
  alter column to_code drop not null,
  add column source_group_code text;

drop function if exists public.apply_sort_rules(uuid, boolean);

create function public.apply_sort_rules(p_client_id uuid, p_only_unassigned boolean)
returns integer
language sql
security invoker
as $$
  with matched as (
    select distinct on (a.id) a.id as account_id, r.note_id
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
    set note_id = m.note_id
    from matched m
    where a.id = m.account_id
    returning a.id
  )
  select count(*)::integer from updated;
$$;

grant execute on function public.apply_sort_rules(uuid, boolean) to authenticated;

-- קודי המיון הקיימים בפועל אצל הלקוח (מהקובץ), עם כמות חשבונות לכל קוד — כדי לבנות מהם כללים
-- בלי לנחש/להקליד קודים ידנית.
create or replace function public.distinct_source_groups(p_client_id uuid)
returns jsonb
language sql
stable
security invoker
as $$
  select coalesce(
    jsonb_agg(jsonb_build_object('code', code, 'desc', descr, 'count', cnt) order by code),
    '[]'::jsonb
  )
  from (
    select source_group_code as code, max(source_group_desc) as descr, count(*) as cnt
    from public.accounts
    where client_id = p_client_id and source_group_code is not null and source_group_code <> ''
    group by source_group_code
  ) t;
$$;

grant execute on function public.distinct_source_groups(uuid) to authenticated;
