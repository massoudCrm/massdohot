-- קבוצות התצוגה בדוח (למשל "נכסים שוטפים", "הכנסות") הפכו מקבוע גלובלי בקוד לטבלה per-client,
-- כדי שכל לקוח יוכל להתאים את מבנה הדוח שלו ולא יהיה נעול על דוגמת המאזן שהועלתה בהתחלה.
create table public.report_groups (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  statement text not null check (statement in ('bs', 'pl')),
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.report_groups enable row level security;
create policy "authenticated full access" on public.report_groups for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ערכת ברירת המחדל (זהה למה שהיה קבוע בקוד עד כה) — משמשת גם לזריעה אוטומטית של לקוח חדש
-- (טריגר למטה) וגם למילוי-בדיעבד של לקוחות קיימים, כדי שההתנהגות הנוכחית תישמר בלי שינוי.
create or replace function public.seed_default_report_groups(p_client_id uuid)
returns void
language sql
security invoker
as $$
  insert into public.report_groups (client_id, statement, name, sort_order)
  values
    (p_client_id, 'bs', 'נכסים שוטפים', 0),
    (p_client_id, 'bs', 'רכוש קבוע', 1),
    (p_client_id, 'bs', 'התחייבויות שוטפות', 2),
    (p_client_id, 'bs', 'התחייבויות לזמן ארוך', 3),
    (p_client_id, 'bs', 'הון', 4),
    (p_client_id, 'pl', 'הכנסות', 0),
    (p_client_id, 'pl', 'עלות המכירות', 1),
    (p_client_id, 'pl', 'עלות העבודות', 2),
    (p_client_id, 'pl', 'הוצאות הנהלה וכלליות', 3),
    (p_client_id, 'pl', 'הוצאות מימון', 4);
$$;

grant execute on function public.seed_default_report_groups(uuid) to authenticated;

create or replace function public.trg_seed_report_groups()
returns trigger
language plpgsql
security invoker
as $$
begin
  perform public.seed_default_report_groups(new.id);
  return new;
end;
$$;

create trigger seed_report_groups_after_insert
  after insert on public.clients
  for each row execute function public.trg_seed_report_groups();

-- מילוי בדיעבד ללקוחות שכבר קיימים ועדיין אין להם קבוצות (כלומר כולם, נכון לרגע הזה).
insert into public.report_groups (client_id, statement, name, sort_order)
select c.id, g.statement, g.name, g.sort_order
from public.clients c
cross join (values
  ('bs', 'נכסים שוטפים', 0),
  ('bs', 'רכוש קבוע', 1),
  ('bs', 'התחייבויות שוטפות', 2),
  ('bs', 'התחייבויות לזמן ארוך', 3),
  ('bs', 'הון', 4),
  ('pl', 'הכנסות', 0),
  ('pl', 'עלות המכירות', 1),
  ('pl', 'עלות העבודות', 2),
  ('pl', 'הוצאות הנהלה וכלליות', 3),
  ('pl', 'הוצאות מימון', 4)
) as g(statement, name, sort_order)
where not exists (select 1 from public.report_groups rg where rg.client_id = c.id);

-- notes.group הוא טקסט חופשי (לא FK), כדי שכל לקוח יוכל להשתמש בשמות קבוצה משלו. לכן שינוי
-- שם קבוצה חייב לעדכן גם את כל הביאורים שכבר מצביעים על השם הישן, אחרת הם "יתייתמו" מהקבוצה.
create or replace function public.rename_report_group(p_group_id uuid, p_new_name text)
returns void
language plpgsql
security invoker
as $$
declare
  v_client_id uuid;
  v_old_name text;
begin
  select client_id, name into v_client_id, v_old_name from public.report_groups where id = p_group_id;
  if v_client_id is null then
    raise exception 'report group not found';
  end if;
  update public.report_groups set name = p_new_name where id = p_group_id;
  update public.notes set "group" = p_new_name where client_id = v_client_id and "group" = v_old_name;
end;
$$;

grant execute on function public.rename_report_group(uuid, text) to authenticated;
