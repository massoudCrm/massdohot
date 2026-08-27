import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

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
}

interface BalanceRow {
  account_id: string;
  note_id: string | null;
  sub_note_id: string | null;
  balance: number;
}

export interface NoteTotal {
  id: string;
  name: string;
  num: number;
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

// account_balances_as_of מחזירה מערך JSON יחיד בתוך שורה בודדת (לא טבלת שורות), כדי לעקוף
// את מגבלת ה-1,000 שורות שSupabase/PostgREST אוכף על תשובות מרובות-שורות.
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

// מרכיב את מבנה הדוח (קבוצות -> ביאורים -> סכומים) לתקופה נתונה, עבור statement מסוים
// (מאזן או רווח והפסד). מספור הביאורים מחושב על כל הביאורים של הלקוח יחד (כמו במסך "ביאורים"),
// כדי ש"ביאור 4" יתייחס לאותו ביאור בכל מסכי המערכת.
export async function fetchReportData(
  supabase: SupabaseClient,
  clientId: string,
  currentAsOf: string,
  prevAsOf: string,
  statement: "bs" | "pl"
): Promise<{
  groups: GroupTotal[];
  total: { curr: number; prev: number };
  error: string | null;
}> {
  const [
    { rows: currBalances, error: currErr },
    { rows: prevBalances, error: prevErr },
    { data: notesRaw, error: notesErr },
    { data: groupsRaw, error: groupsErr },
  ] = await Promise.all([
    fetchBalances(supabase, clientId, currentAsOf),
    fetchBalances(supabase, clientId, prevAsOf),
    supabase.from("notes").select("id, name, group").eq("client_id", clientId),
    supabase
      .from("report_groups")
      .select("id, statement, side, name, sort_order")
      .eq("client_id", clientId)
      .order("statement")
      .order("sort_order"),
  ]);

  const error = currErr?.message || prevErr?.message || notesErr?.message || groupsErr?.message || null;
  if (error) return { groups: [], total: { curr: 0, prev: 0 }, error };

  const allGroups = (groupsRaw ?? []) as ReportGroupRow[];
  const notes = (notesRaw ?? []) as NoteRow[];

  // אותה שיטת מיספור בדיוק כמו במסך "ביאורים": קבוצה שנמחקה מוצגת בסוף במקום לגרום לקריסה.
  const groupOrder = new Map(allGroups.map((g, i) => [g.name, i]));
  const orderedNotes = notes
    .slice()
    .sort((a, b) => (groupOrder.get(a.group) ?? 999) - (groupOrder.get(b.group) ?? 999));
  const noteNum = new Map(orderedNotes.map((n, i) => [n.id, i + 1]));

  const currByNote = new Map<string, number>();
  for (const r of currBalances) {
    if (!r.note_id) continue;
    currByNote.set(r.note_id, (currByNote.get(r.note_id) ?? 0) + r.balance);
  }
  const prevByNote = new Map<string, number>();
  for (const r of prevBalances) {
    if (!r.note_id) continue;
    prevByNote.set(r.note_id, (prevByNote.get(r.note_id) ?? 0) + r.balance);
  }

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
          num: noteNum.get(n.id) ?? 0,
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

  return { groups, total, error: null };
}

export interface NoteDetail {
  id: string;
  name: string;
  num: number;
  statement: "bs" | "pl";
  curr: number;
  prev: number;
  direct: { curr: number; prev: number };
  subNotes: { id: string; name: string; curr: number; prev: number }[];
}

interface SubNoteRow {
  id: string;
  note_id: string;
  name: string;
}

// פירוט מלא של כל ביאור (משני הדוחות יחד, במספור אחיד) לצורך תצוגת הדפסה: סכום כולל,
// ופילוח לפי תת-ביאור (אם יש) + יתרת החשבונות המשויכים ישירות לביאור בלי תת-ביאור.
export async function fetchNoteDetails(
  supabase: SupabaseClient,
  clientId: string,
  currentAsOf: string,
  prevAsOf: string
): Promise<{ notes: NoteDetail[]; error: string | null }> {
  const [
    { rows: currBalances, error: currErr },
    { rows: prevBalances, error: prevErr },
    { data: notesRaw, error: notesErr },
    { data: groupsRaw, error: groupsErr },
    { data: subNotesRaw, error: subNotesErr },
  ] = await Promise.all([
    fetchBalances(supabase, clientId, currentAsOf),
    fetchBalances(supabase, clientId, prevAsOf),
    supabase.from("notes").select("id, name, group").eq("client_id", clientId),
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
    currErr?.message || prevErr?.message || notesErr?.message || groupsErr?.message || subNotesErr?.message || null;
  if (error) return { notes: [], error };

  const allGroups = (groupsRaw ?? []) as ReportGroupRow[];
  const notes = (notesRaw ?? []) as NoteRow[];
  const subNotes = (subNotesRaw ?? []) as SubNoteRow[];

  const groupByName = new Map(allGroups.map((g) => [g.name, g]));
  const groupOrder = new Map(allGroups.map((g, i) => [g.name, i]));
  const orderedNotes = notes
    .slice()
    .sort((a, b) => (groupOrder.get(a.group) ?? 999) - (groupOrder.get(b.group) ?? 999));
  const noteNum = new Map(orderedNotes.map((n, i) => [n.id, i + 1]));

  const subNotesByNote = new Map<string, SubNoteRow[]>();
  for (const sn of subNotes) {
    const list = subNotesByNote.get(sn.note_id) ?? [];
    list.push(sn);
    subNotesByNote.set(sn.note_id, list);
  }

  function aggregate(rows: BalanceRow[]) {
    const byKey = new Map<string, number>();
    for (const r of rows) {
      if (!r.note_id) continue;
      const key = `${r.note_id}|${r.sub_note_id ?? ""}`;
      byKey.set(key, (byKey.get(key) ?? 0) + r.balance);
    }
    return byKey;
  }
  const currByKey = aggregate(currBalances);
  const prevByKey = aggregate(prevBalances);

  const details: NoteDetail[] = orderedNotes.map((n) => {
    const group = groupByName.get(n.group);
    const statement = group?.statement ?? "bs";
    const shouldFlip = statement === "pl" ? true : group?.side === "liabilities_equity";

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

    return {
      id: n.id,
      name: n.name,
      num: noteNum.get(n.id) ?? 0,
      statement,
      curr: direct.curr + subDetails.reduce((s, d) => s + d.curr, 0),
      prev: direct.prev + subDetails.reduce((s, d) => s + d.prev, 0),
      direct,
      subNotes: subDetails,
    };
  });

  return { notes: details, error: null };
}
