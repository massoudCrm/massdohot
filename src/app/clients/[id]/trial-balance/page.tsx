import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { firstDayOfMonth, lastDayOfMonth } from "@/lib/format";
import { PeriodSelector } from "./period-selector";
import { TrialBalanceTable, type TbRow } from "./trial-balance-table";
import { SortRulesPanel, type SortRule } from "./sort-rules-panel";
import { fetchPlActivity, orderNotesAndNumber } from "../report-shared";

const MONTH_NAMES = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];

function periodLabel(fromM: number, toM: number, year: number) {
  const two = (m: number) => String(m).padStart(2, "0");
  return fromM === toM ? `${two(fromM)}/${year}` : `${two(fromM)}-${two(toM)}/${year}`;
}

interface BalanceRow {
  account_id: string;
  code: string;
  name: string;
  note_id: string | null;
  sub_note_id: string | null;
  source_group_code: string | null;
  source_group_desc: string | null;
  balance: number;
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

// account_balances_as_of מחזירה מערך JSON יחיד בתוך שורה בודדת (לא טבלת שורות), כדי לעקוף
// את מגבלת ה-1,000 שורות שSupabase/PostgREST אוכף על תשובות מרובות-שורות, ולחשב פעם אחת בלבד.
async function fetchAccountBalances(
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

export default async function TrialBalancePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string; year?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const supabase = await createClient();
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id, from_month, to_month, report_year")
    .eq("id", id)
    .single();
  if (clientError || !client) notFound();

  // ה-URL גובר אם קיים (כדי שקישור עם תקופה מסוימת יהיה ניתן לשיתוף); אחרת משתמשים
  // בתקופה השמורה אצל הלקוח, כדי שהיא תיזכר גם כשחוזרים למאזן ממסך אחר.
  const fromM = Number(sp.from) || client.from_month;
  const toM = Number(sp.to) || client.to_month;
  const year = Number(sp.year) || client.report_year;

  const currentAsOf = lastDayOfMonth(year, toM);
  const prevAsOf = lastDayOfMonth(year - 1, toM);
  const currentPeriod = { from: firstDayOfMonth(year, fromM), to: currentAsOf };
  const prevPeriod = { from: firstDayOfMonth(year - 1, fromM), to: prevAsOf };

  const [
    { rows: currentBalances, error: currErr },
    { rows: prevBalances, error: prevErr },
    { data: notesRaw, error: notesErr },
    { data: sortRules },
    { data: sourceGroups },
    { data: subNotesRaw },
    { data: groupsRaw },
    { rows: plCurrRows, error: plCurrErr },
    { rows: plPrevRows, error: plPrevErr },
  ] = await Promise.all([
    fetchAccountBalances(supabase, id, currentAsOf),
    fetchAccountBalances(supabase, id, prevAsOf),
    supabase.from("notes").select("id, name, group, has_note").eq("client_id", id),
    supabase
      .from("sort_rules")
      .select("id, from_code, to_code, note_id, sub_note_id, source_group_code")
      .eq("client_id", id),
    supabase.rpc("distinct_source_groups", { p_client_id: id }),
    supabase
      .from("sub_notes")
      .select("id, note_id, name, sort_order, notes!inner(client_id)")
      .eq("notes.client_id", id)
      .order("sort_order"),
    supabase.from("report_groups").select("name, statement").eq("client_id", id).order("statement").order("sort_order"),
    fetchPlActivity(supabase, id, currentPeriod),
    fetchPlActivity(supabase, id, prevPeriod),
  ]);

  // חשבונות רווח והפסד לא מוצגים כיתרה מצטברת-מאז-ומעולם (כמו מאזן) אלא כתנועת התקופה
  // הנבחרת בלבד — אותו עיקרון בדיוק כמו במסך רווח והפסד, ראו ההסבר ליד fetchPlActivity
  // ב-report-shared.ts. חשבונות שעדיין לא מוינים לביאור נשארים ביתרה המצטברת כי לא ידוע
  // אם הם בכלל רווח והפסד.
  const plGroupNames = new Set((groupsRaw ?? []).filter((g) => g.statement === "pl").map((g) => g.name));
  const plNoteIds = new Set((notesRaw ?? []).filter((n) => plGroupNames.has(n.group)).map((n) => n.id));
  const plCurrByAccount = new Map(plCurrRows.map((r) => [r.account_id, r.balance]));
  const plPrevByAccount = new Map(plPrevRows.map((r) => [r.account_id, r.balance]));

  const prevByAccount = new Map<string, number>(
    prevBalances.map((r) => [r.account_id, r.balance])
  );

  // סעיף שהקבוצה שלו נמחקה (טקסט חופשי בלי FK) מוצג בסוף הרשימה במקום לגרום לקריסה. מספור
  // "ביאור N" חל רק על סעיפים שסומנו has_note — סעיף רגיל מוצג בלי מספר (ראו report-shared.ts).
  const { ordered: orderedNotes, noteNum } = orderNotesAndNumber(notesRaw ?? [], groupsRaw ?? []);
  const subNotesByNote = new Map<string, { id: string; noteId: string; label: string }[]>();
  for (const sn of subNotesRaw ?? []) {
    const list = subNotesByNote.get(sn.note_id) ?? [];
    list.push({ id: sn.id, noteId: sn.note_id, label: sn.name });
    subNotesByNote.set(sn.note_id, list);
  }
  const noteOptions = orderedNotes.map((n) => ({
    id: n.id,
    label: noteNum.has(n.id) ? `${n.name} (ביאור ${noteNum.get(n.id)})` : n.name,
    subNotes: subNotesByNote.get(n.id) ?? [],
  }));

  const rows: TbRow[] = currentBalances.map((r) => {
    const isPl = r.note_id !== null && plNoteIds.has(r.note_id);
    return {
      accountId: r.account_id,
      code: r.code,
      name: r.name,
      noteId: r.note_id,
      subNoteId: r.sub_note_id,
      sourceGroupCode: r.source_group_code,
      sourceGroupDesc: r.source_group_desc,
      curr: isPl ? plCurrByAccount.get(r.account_id) ?? 0 : r.balance,
      prev: isPl ? plPrevByAccount.get(r.account_id) ?? 0 : prevByAccount.get(r.account_id) ?? 0,
    };
  });

  const totalCurr = rows.reduce((s, r) => s + r.curr, 0);
  const totalPrev = rows.reduce((s, r) => s + r.prev, 0);
  // חשבון ביתרת אפס בשתי התקופות לא משפיע על אף דוח, ולכן אין טעם "להציע" אותו למיון —
  // הוא לא נספר לא כחסר וגם לא כמוין, כדי שבדיקת המיון תשקף רק את מה שבאמת חשוב לסווג.
  const meaningfulRows = rows.filter((r) => Math.round(r.curr) !== 0 || Math.round(r.prev) !== 0);
  const unassignedCount = meaningfulRows.filter((r) => !r.noteId).length;

  return (
    <>
      <main className="flex-1 px-11 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-3xl font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
              מאזן בוחן
            </div>
            <div className="mt-1.5 text-lg" style={{ color: "var(--muted)" }}>
              יתרות ליום {currentAsOf.split("-").reverse().join("/")} · מקבילה{" "}
              {periodLabel(fromM, toM, year - 1)}
            </div>
          </div>
          <PeriodSelector clientId={id} months={MONTH_NAMES} fromM={fromM} toM={toM} year={year} />
        </div>

        {(clientError || currErr || prevErr || plCurrErr || plPrevErr) && (
          <div
            className="rounded-2xl border-2 p-5 text-lg"
            style={{ borderColor: "var(--warn-border)", background: "var(--warn-soft)", color: "var(--warn-text)" }}
          >
            שגיאה בטעינת הנתונים: {currErr?.message || prevErr?.message || plCurrErr?.message || plPrevErr?.message}
          </div>
        )}

        {!currErr && rows.length === 0 && (
          <div
            className="rounded-[28px] border-2 border-dashed p-10 text-center text-lg"
            style={{ borderColor: "var(--border)", color: "var(--muted)" }}
          >
            אין עדיין חשבונות עבור לקוח זה.{" "}
            <Link href={`/clients/${id}/files`} style={{ color: "var(--accent-text)" }}>
              קלוט קבצים
            </Link>{" "}
            כדי להתחיל.
          </div>
        )}

        {notesErr && (
          <div
            className="mb-4 rounded-2xl border-2 p-4 text-base"
            style={{ borderColor: "var(--warn-border)", background: "var(--warn-soft)", color: "var(--warn-text)" }}
          >
            שגיאה בטעינת הביאורים: {notesErr.message}
          </div>
        )}

        {rows.length > 0 && (
          <div
            className="mb-6 rounded-[28px] border-2 p-6"
            style={
              unassignedCount === 0
                ? { borderColor: "var(--success-border)", background: "var(--success-soft)", color: "#3d472b" }
                : { borderColor: "var(--warn-border)", background: "var(--warn-soft)", color: "var(--warn-text)" }
            }
          >
            <div className="text-xl font-extrabold">
              {unassignedCount === 0 ? "בדיקת מיון — תקין" : "בדיקת מיון — חסר מיון"}
            </div>
            <div className="mt-1.5 text-base leading-relaxed">
              {unassignedCount === 0
                ? `כל ${meaningfulRows.length.toLocaleString("he-IL")} הסעיפים בעלי יתרה שויכו לביאור.`
                : `${unassignedCount.toLocaleString("he-IL")} סעיפים בעלי יתרה אינם מוינים. הם לא ייכללו בדוחות עד שישויכו לביאור. (חשבונות ביתרת אפס לא נספרים כאן — אין צורך למיין אותם.)`}
            </div>
          </div>
        )}

        {rows.length > 0 && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <TrialBalanceTable
              clientId={id}
              rows={rows}
              notes={noteOptions}
              currLabel={periodLabel(fromM, toM, year)}
              prevLabel={periodLabel(fromM, toM, year - 1)}
              totalCurr={totalCurr}
              totalPrev={totalPrev}
            />
            <SortRulesPanel
              clientId={id}
              rules={(sortRules as SortRule[]) ?? []}
              notes={noteOptions}
              sourceGroups={(sourceGroups as { code: string; desc: string; count: number }[]) ?? []}
            />
          </div>
        )}
      </main>
    </>
  );
}
