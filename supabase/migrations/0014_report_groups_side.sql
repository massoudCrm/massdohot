-- כדי להרכיב את פני המאזן (נכסים מול התחייבויות+הון) בלי להסתמך על שמות קבוצה קבועים
-- (הקבוצות עכשיו ניתנות לעריכה per-client), כל קבוצת מאזן (statement='bs') מסומנת גם באיזה
-- צד היא מוצגת. קבוצות רו"ה (statement='pl') לא רלוונטיות ל-side, ולכן הוא נשאר null אצלן.
alter table public.report_groups
  add column side text check (side in ('assets', 'liabilities_equity'));

update public.report_groups set side = 'assets'
where statement = 'bs' and name in ('נכסים שוטפים', 'רכוש קבוע');

update public.report_groups set side = 'liabilities_equity'
where statement = 'bs' and name in ('התחייבויות שוטפות', 'התחייבויות לזמן ארוך', 'הון');

-- זריעת ברירת המחדל ללקוח חדש כוללת מעכשיו גם side עבור קבוצות מאזן.
create or replace function public.seed_default_report_groups(p_client_id uuid)
returns void
language sql
security invoker
as $$
  insert into public.report_groups (client_id, statement, side, name, sort_order)
  values
    (p_client_id, 'bs', 'assets', 'נכסים שוטפים', 0),
    (p_client_id, 'bs', 'assets', 'רכוש קבוע', 1),
    (p_client_id, 'bs', 'liabilities_equity', 'התחייבויות שוטפות', 2),
    (p_client_id, 'bs', 'liabilities_equity', 'התחייבויות לזמן ארוך', 3),
    (p_client_id, 'bs', 'liabilities_equity', 'הון', 4),
    (p_client_id, 'pl', null, 'הכנסות', 0),
    (p_client_id, 'pl', null, 'עלות המכירות', 1),
    (p_client_id, 'pl', null, 'עלות העבודות', 2),
    (p_client_id, 'pl', null, 'הוצאות הנהלה וכלליות', 3),
    (p_client_id, 'pl', null, 'הוצאות מימון', 4);
$$;

grant execute on function public.seed_default_report_groups(uuid) to authenticated;
