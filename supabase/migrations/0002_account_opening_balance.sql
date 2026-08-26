-- יתרת פתיחה לחשבון, כפי שמדווחת ברשומת B110 (שדה 1414): חיובי = יתרת חובה, שלילי = יתרת זכות.
-- יתרה בכל תאריך = opening_balance + סכום (חובה-זכות) של תנועות עד אותו תאריך.
alter table public.accounts
  add column opening_balance numeric(14,2) not null default 0,
  add column opening_date date;
