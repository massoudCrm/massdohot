-- האם להציג את עמודות "שינוי" ו-"%" (הפרש מהתקופה המקבילה) במסכי מאזן/רווח והפסד/הדפסה.
-- שדה אחד על הלקוח כדי שהבחירה תחול על כל המסכים יחד בלחיצה אחת (כמו תקופת הדוח).
alter table public.clients
  add column show_changes boolean not null default true;
