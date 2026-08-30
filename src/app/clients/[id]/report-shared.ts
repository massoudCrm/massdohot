import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export interface Period {
  from: string;
  to: string;
}

export interface ReportGroupRow {
  id: string;
  statement: "bs" | "pl";
  side: "assets" | "liabilities_equity" | null;
  name: string;
  sort_order: number;
}

export interface NoteRow {
  id: string;
  name: string;
  group: string;
  has_note: boolean;
}

interface BalanceRow {
  account_id: string;
  note_id: string | null;
  sub_note_id: string | null;
  balance: number;
  // רק pl_period_activity מחזירה שם חשבון — נחוץ כדי להציג כל חשבון רו"ה שמשויך ישירות
  // לביאור (בלי תת-ביאור) כשורה נפרדת משלו, ראו buildNoteDetails למטה.
  name?: string;
}

interface SubNoteRow {
  id: string;
  note_id: string;
  name: string;
}

export interface NoteTotal {
  id: string;
  name: string;
  num: number | null;
  curr: number;
  prev: number;
}

export interface GroupTotal {
  id: string;
  name: string;
  side: "assets" | "liabilities_equity" | null;
  notes: NoteTotal[];
  curr: number;
  prev: number;
}

export interface NoteDetail {
  id: string;
  name: string;
  num: number | null;
  statement: "bs" | "pl";
  curr: number;
  prev: number;
  direct: { curr: number; prev: number };
  subNotes: { id: string; name: string; curr: number; prev: number }[];
  // חשבונות רו"ה שמשויכים ישירות לביאור (בלי תת-ביאור), כל אחד בשורה נפרדת משלו לפי שמו
  // בכרטסת — לא צריך תת-ביאור בשביל זה. ריק תמיד לביאורי מאזן (שם ה"direct" הכולל מספיק,
  // כי חשבון מאזני בדרך כלל מרכיב יתרה משותפת ולא שורה עצמאית משמעותית — ראו השיחה איתו).
  directAccounts: { id: string; name: string; curr: number; prev: number }[];
}

// account_balances_as_of מחזירה מערך JSON יחיד בתוך שורה בודדת (לא טבלת שורות), כדי לעקוף
// את מגבלת ה-1,000 שורות שSupabase/PostgREST אוכף על תשובות מרובות-שורות. משמשת למאזן
// (חשבונות מאזן הם מטבעם יתרה מצטברת "נכון לתאריך").
async function fetchBalances(
  supabase: SupabaseClient,
  clientId: string,
  asOf: string
): Promise<{ rows: BalanceRow[]; error: { message: string } | null }> {
  const { data, error } = await supabase.rpc("account_balances_as_of", {
    p_client_id: clientId,
    p_as_of: asOf,
  });
  if (error) return { rows: [], error };
  return { rows: (data as BalanceRow[]) ?? [], error: null };
}

// חשבונות רווח והפסד לא יכולים להיות "יתרה מצטברת נכון לתאריך" כמו מאזן — ברגע שיש כמה
// שנים טעונות, תוכנת ההנה"ח כבר ביצעה "סגירת שנה" (מאפסת כל חשבון רו"ה ומעבירה לעודפים)
// לשנים סגורות, ופקודת הסגירה הזו כלולה בנתונים. חישוב מצטבר "עד תאריך" יכלול את פקודת
// הסגירה ותמיד יראה 0 לשנה סגורה. לכן רו"ה מחושב כתנועה בתוך טווח התקופה בלבד, תוך
// החרגה מפורשת של פקודות הסגירה עצמן (מזוהות לפי התיאור שלהן בכרטסת — ראו migration 0018).
// שאילתה יקרה (סריקת כל התנועות + GROUP BY על כל החשבונות) — לכן נקראת פעם אחת בלבד לכל
// תקופה דרך fetchPeriodData, ולא בנפרד מכל מקום שצריך רווח והפסד (ראו fetchReportData/
// fetchNoteDetails הישנים — קריאה כפולה-משולשת לפונקציה הזו גרמה בפועל ל-timeout באתר).
export async function fetchPlActivity(
  supabase: SupabaseClient,
  clientId: string,
  period: Period
): Promise<{ rows: BalanceRow[]; error: { message: string } | null }> {
  const { data, error } = await supabase.rpc("pl_period_activity", {
    p_client_id: clientId,
    p_period_start: period.from,
    p_period_end: period.to,
  });
  if (error) return { rows: [], error };
  return { rows: (data as BalanceRow[]) ?? [], error: null };
}

export interface PeriodData {
  bsCurr: BalanceRow[];
  bsPrev: BalanceRow[];
  plCurr: BalanceRow[];
  plPrev: BalanceRow[];
  notes: NoteRow[];
  groups: ReportGroupRow[];
  subNotes: SubNoteRow[];
  error: string | null;
}

// טוען פעם אחת בלבד את כל הנתונים הגולמיים הדרושים למאזן + רווח והפסד + פירוט ביאורים
// לתקופה נתונה. מסכי מאזן/רווח והפסד/הדפסה קוראים לזה פעם אחת ומעבירים את התוצאה הלאה
// ל-buildReportData/buildNoteDetails (פונקציות טהורות, בלי עוד קריאות רשת) — לא קוראים
// שוב לשאילתות היקרות (במיוחד pl_period_activity) בכל פעם שצריך תצוגה נוספת של אותה תקופה.
export async function fetchPeriodData(
  supabase: SupabaseClient,
  clientId: string,
  current: Period,
  prev: Period
): Promise<PeriodData> {
  const [
    { rows: bsCurr, error: bsCurrErr },
    { rows: bsPrev, error: bsPrevErr },
    { rows: plCurr, error: plCurrErr },
    { rows: plPrev, error: plPrevErr },
    { data: notesRaw, error: notesErr },
    { data: groupsRaw, error: groupsErr },
    { data: subNotesRaw, error: subNotesErr },
  ] = await Promise.all([
    fetchBalances(supabase, clientId, current.to),
    fetchBalances(supabase, clientId, prev.to),
    fetchPlActivity(supabase, clientId, current),
    fetchPlActivity(supabase, clientId, prev),
    supabase.from("notes").select("id, name, group, has_note").eq("client_id", clientId),
    supabase
      .from("report_groups")
      .select("id, statement, side, name, sort_order")
      .eq("client_id", clientId)
      .order("statement")
      .order("sort_order"),
    supabase
      .from("sub_notes")
      .select("id, note_id, name, sort_order, notes!inner(client_id)")
      .eq("notes.client_id", clientId)
      .order("sort_order"),
  ]);

  const error =
    bsCurrErr?.message ||
    bsPrevErr?.message ||
    plCurrErr?.message ||
    plPrevErr?.message ||
    notesErr?.message ||
    groupsErr?.message ||
    subNotesErr?.message ||
    null;

  return {
    bsCurr,
    bsPrev,
    plCurr,
    plPrev,
    notes: (notesRaw ?? []) as NoteRow[],
    groups: (groupsRaw ?? []) as ReportGroupRow[],
    subNotes: (subNotesRaw ?? []) as SubNoteRow[],
    error,
  };
}

function aggregateByNote(rows: BalanceRow[]) {
  const byNote = new Map<string, number>();
  for (const r of rows) {
    if (!r.note_id) continue;
    byNote.set(r.note_id, (byNote.get(r.note_id) ?? 0) + r.balance);
  }
  return byNote;
}

function aggregateByKey(rows: BalanceRow[]) {
  const byKey = new Map<string, number>();
  for (const r of rows) {
    if (!r.note_id) continue;
    const key = `${r.note_id}|${r.sub_note_id ?? ""}`;
    byKey.set(key, (byKey.get(key) ?? 0) + r.balance);
  }
  return byKey;
}

// notes הן בפועל "סעיפים" בגוף הדוח (מאזן/רו"ה) — כל חשבון משויך לסעיף, אבל רק סעיף
// שסומן has_note=true הופך בפועל ל"ביאור" ממוספר. הסדר עצמו (לפי מיקום הקבוצה בדוח) זהה
// לכל הסעיפים; המספור עצמו מדלג על סעיפים בלי ביאור, כדי שהמספור יישאר רציף ומשמעותי.
export function orderNotesAndNumber<T extends { id: string; group: string; has_note: boolean }>(
  notes: T[],
  groups: { name: string }[]
) {
  const groupOrder = new Map(groups.map((g, i) => [g.name, i]));
  const ordered = notes
    .slice()
    .sort((a, b) => (groupOrder.get(a.group) ?? 999) - (groupOrder.get(b.group) ?? 999));
  const noteNum = new Map<string, number>();
  let counter = 0;
  for (const n of ordered) {
    if (n.has_note) {
      counter += 1;
      noteNum.set(n.id, counter);
    }
  }
  return { ordered, noteNum };
}

// מרכיב את מבנה הדוח (קבוצות -> ביאורים -> סכומים) עבור statement מסוים (מאזן או רווח
// והפסד), מתוך הנתונים שכבר נטענו ב-fetchPeriodData. מספור הביאורים מחושב על כל הביאורים
// של הלקוח יחד (כמו במסך "ביאורים"), כדי ש"ביאור 4" יתייחס לאותו ביאור בכל מסכי המערכת.
export function buildReportData(
  data: PeriodData,
  statement: "bs" | "pl"
): { groups: GroupTotal[]; total: { curr: number; prev: number } } {
  const { notes, groups: allGroups } = data;
  const currRows = statement === "pl" ? data.plCurr : data.bsCurr;
  const prevRows = statement === "pl" ? data.plPrev : data.bsPrev;

  // אותה שיטת מיספור בדיוק כמו במסך "ביאורים": קבוצה שנמחקה מוצגת בסוף במקום לגרום לקריסה.
  const { ordered: orderedNotes, noteNum } = orderNotesAndNumber(notes, allGroups);

  const currByNote = aggregateByNote(currRows);
  const prevByNote = aggregateByNote(prevRows);

  const relevantGroups = allGroups
    .filter((g) => g.statement === statement)
    .sort((a, b) => a.sort_order - b.sort_order);

  // סימן התצוגה: ברווח והפסד, וב"התחייבויות והון" שבמאזן, מציגים את ההפוך מהיתרה הגולמית
  // (חובה=חיובי) — כך שהכנסות/התחייבויות/הון מוצגים כערכים חיוביים במקום ביתרת זכות שלילית.
  const groups: GroupTotal[] = relevantGroups.map((g) => {
    const shouldFlip = statement === "pl" ? true : g.side === "liabilities_equity";
    const groupNotes = orderedNotes
      .filter((n) => n.group === g.name)
      .map((n) => {
        const rawCurr = currByNote.get(n.id) ?? 0;
        const rawPrev = prevByNote.get(n.id) ?? 0;
        return {
          id: n.id,
          name: n.name,
          num: noteNum.get(n.id) ?? null,
          curr: shouldFlip ? -rawCurr : rawCurr,
          prev: shouldFlip ? -rawPrev : rawPrev,
        };
      });
    return {
      id: g.id,
      name: g.name,
      side: g.side,
      notes: groupNotes,
      curr: groupNotes.reduce((s, n) => s + n.curr, 0),
      prev: groupNotes.reduce((s, n) => s + n.prev, 0),
    };
  });

  const total = {
    curr: groups.reduce((s, g) => s + g.curr, 0),
    prev: groups.reduce((s, g) => s + g.prev, 0),
  };

  return { groups, total };
}

// לביאור רו"ה: כל חשבון שמשויך ישירות לביאור (בלי תת-ביאור) בשורה נפרדת משלו, לפי השם
// שכבר יש לו בכרטסת — אין צורך ביצירת תת-ביאור בשביל זה (בניגוד לביאורי מאזן, שם חשבונות
// ישירים מסתכמים יחד ל-"direct" אחד, כי הם בדרך כלל מרכיבים יתרה משותפת לא-משמעותית לבד).
function directAccountRows(
  currRows: BalanceRow[],
  prevRows: BalanceRow[],
  noteId: string,
  shouldFlip: boolean
): { id: string; name: string; curr: number; prev: number }[] {
  const isDirect = (r: BalanceRow) => r.note_id === noteId && !r.sub_note_id;
  const currByAccount = new Map(currRows.filter(isDirect).map((r) => [r.account_id, r]));
  const prevByAccount = new Map(prevRows.filter(isDirect).map((r) => [r.account_id, r]));
  const accountIds = new Set([...currByAccount.keys(), ...prevByAccount.keys()]);

  return [...accountIds]
    .map((accountId) => {
      const curr = currByAccount.get(accountId);
      const prev = prevByAccount.get(accountId);
      const rawCurr = curr?.balance ?? 0;
      const rawPrev = prev?.balance ?? 0;
      return {
        id: accountId,
        name: curr?.name ?? prev?.name ?? accountId,
        curr: shouldFlip ? -rawCurr : rawCurr,
        prev: shouldFlip ? -rawPrev : rawPrev,
      };
    })
    .filter((a) => Math.round(a.curr) !== 0 || Math.round(a.prev) !== 0);
}

// פירוט מלא של כל ביאור (משני הדוחות יחד, במספור אחיד) לצורך תצוגת הדפסה: סכום כולל,
// ופילוח לפי תת-ביאור (אם יש) + יתרת החשבונות המשויכים ישירות לביאור בלי תת-ביאור.
// ביאורי מאזן משתמשים ביתרה מצטברת, ביאורי רו"ה בתנועת התקופה — ראו buildReportData למעלה.
export function buildNoteDetails(data: PeriodData): NoteDetail[] {
  const { notes, groups: allGroups, subNotes } = data;

  const groupByName = new Map(allGroups.map((g) => [g.name, g]));
  const { ordered: orderedNotes, noteNum } = orderNotesAndNumber(notes, allGroups);

  const subNotesByNote = new Map<string, SubNoteRow[]>();
  for (const sn of subNotes) {
    const list = subNotesByNote.get(sn.note_id) ?? [];
    list.push(sn);
    subNotesByNote.set(sn.note_id, list);
  }

  const bsCurrByKey = aggregateByKey(data.bsCurr);
  const bsPrevByKey = aggregateByKey(data.bsPrev);
  const plCurrByKey = aggregateByKey(data.plCurr);
  const plPrevByKey = aggregateByKey(data.plPrev);

  return orderedNotes.map((n) => {
    const group = groupByName.get(n.group);
    const statement = group?.statement ?? "bs";
    const shouldFlip = statement === "pl" ? true : group?.side === "liabilities_equity";
    const currByKey = statement === "pl" ? plCurrByKey : bsCurrByKey;
    const prevByKey = statement === "pl" ? plPrevByKey : bsPrevByKey;

    const subDetails = (subNotesByNote.get(n.id) ?? []).map((sn) => {
      const key = `${n.id}|${sn.id}`;
      const rawCurr = currByKey.get(key) ?? 0;
      const rawPrev = prevByKey.get(key) ?? 0;
      return { id: sn.id, name: sn.name, curr: shouldFlip ? -rawCurr : rawCurr, prev: shouldFlip ? -rawPrev : rawPrev };
    });

    const directKey = `${n.id}|`;
    const directRawCurr = currByKey.get(directKey) ?? 0;
    const directRawPrev = prevByKey.get(directKey) ?? 0;
    const direct = {
      curr: shouldFlip ? -directRawCurr : directRawCurr,
      prev: shouldFlip ? -directRawPrev : directRawPrev,
    };
    const directAccounts =
      statement === "pl" ? directAccountRows(data.plCurr, data.plPrev, n.id, shouldFlip) : [];

    return {
      id: n.id,
      name: n.name,
      num: noteNum.get(n.id) ?? null,
      statement,
      curr: direct.curr + subDetails.reduce((s, d) => s + d.curr, 0),
      prev: direct.prev + subDetails.reduce((s, d) => s + d.prev, 0),
      direct,
      directAccounts,
      subNotes: subDetails,
    };
  });
}
