-- תבנית ביאורים צריכה לשמור גם את מבנה קבוצות הדוח, לא רק את הביאורים עצמם — כדי שהחלת
-- תבנית על לקוח חדש תשחזר את כל מבנה הדוח שלו, לא רק את שמות הביאורים.
alter table public.note_templates
  add column groups_snapshot jsonb not null default '[]'::jsonb;
