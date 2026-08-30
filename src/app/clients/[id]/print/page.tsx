import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatAmount, formatPercentChange, firstDayOfMonth, lastDayOfMonth } from "@/lib/format";
import { fetchPeriodData, buildReportData, buildNoteDetails, type GroupTotal, type NoteDetail } from "../report-shared";
import { PrintButton } from "./print-button";
import { ChangeColumnToggle } from "../change-column-toggle";

function periodLabel(fromM: number, toM: number, year: number) {
  const two = (m: number) => String(m).padStart(2, "0");
  return fromM === toM ? `${two(fromM)}/${year}` : `${two(fromM)}-${two(toM)}/${year}`;
}

// המאזן הוא תמונת מצב לרגע נתון (לא לתקופה) — הכותרת מציגה "ליום DD/MM/YYYY", לא טווח חודשים.
function asOfLabel(isoDate: string) {
  return `ליום ${isoDate.split("-").reverse().join("/")}`;
}

// בדוח האמיתי סעיפים עם יתרה אפסית בשתי השנים לא מוצגים כלל, וקבוצה שכל הסעיפים בה
// התאפסו לא מוצגת בכלל. מיושם רק במאזן המודפס (לא במסך האינטראקטיבי, ששם רואים הכול).
function hideZeroRows(groups: GroupTotal[]): GroupTotal[] {
  return groups
    .map((g) => ({
      ...g,
      notes: g.notes.filter((n) => Math.round(n.curr) !== 0 || Math.round(n.prev) !== 0),
    }))
    .filter((g) => g.notes.length > 0 || Math.round(g.curr) !== 0 || Math.round(g.prev) !== 0);
}

// "item" = שורת סעיף רגילה (קו דק), "subtotal" = סה"כ קבוצה (קו בינוני), "final" = סה"כ נכסים/התחייבויות והון (קו כפול, כמו בדוח האמיתי).
type RowVariant = "item" | "subtotal" | "final";

const ROW_BORDER: Record<RowVariant, string> = {
  item: "1px solid #ddd",
  subtotal: "1.5px solid #333",
  final: "3px double #000",
};

function Row({
  label,
  noteNum,
  curr,
  prev,
  bold,
  variant = "item",
  showChanges,
}: {
  label: string;
  noteNum?: number | null;
  curr: number;
  prev: number;
  bold?: boolean;
  variant?: RowVariant;
  showChanges: boolean;
}) {
  return (
    <tr style={{ borderBottom: ROW_BORDER[variant] }}>
      <td className={`py-1.5 ${bold ? "font-bold" : ""}`}>{label}</td>
      {noteNum !== undefined && (
        <td className={`py-1.5 text-center ${bold ? "font-bold" : ""}`} style={{ color: "#555" }}>
          {noteNum ?? ""}
        </td>
      )}
      <td className={`py-1.5 text-left tabular-nums ${bold ? "font-bold" : ""}`}>{formatAmount(curr)}</td>
      <td className={`py-1.5 text-left tabular-nums ${bold ? "font-bold" : ""}`} style={{ color: "#555" }}>
        {formatAmount(prev)}
      </td>
      {showChanges && (
        <>
          <td className={`py-1.5 text-left tabular-nums ${bold ? "font-bold" : ""}`} style={{ color: "#555" }}>
            {formatAmount(curr - prev)}
          </td>
          <td className={`py-1.5 text-left tabular-nums ${bold ? "font-bold" : ""}`} style={{ color: "#555" }}>
            {formatPercentChange(curr, prev)}
          </td>
        </>
      )}
    </tr>
  );
}

function GroupRows({
  group,
  showChanges,
  showNoteCol,
  colCount,
}: {
  group: GroupTotal;
  showChanges: boolean;
  showNoteCol: boolean;
  colCount: number;
}) {
  return (
    <>
      <tr>
        <td colSpan={colCount} className="pt-4 pb-1 text-base font-extrabold" style={{ borderBottom: "2px solid #333" }}>
          {group.name}
        </td>
      </tr>
      {group.notes.map((n) => (
        <Row
          key={n.id}
          label={n.name}
          noteNum={showNoteCol ? n.num : undefined}
          curr={n.curr}
          prev={n.prev}
          showChanges={showChanges}
        />
      ))}
      <Row
        label={`סה"כ ${group.name}`}
        noteNum={showNoteCol ? null : undefined}
        curr={group.curr}
        prev={group.prev}
        bold
        variant="subtotal"
        showChanges={showChanges}
      />
    </>
  );
}

function PageHeader({ name }: { name: string }) {
  return (
    <div className="mb-4 border-b-2 pb-2 text-center text-xl font-extrabold" style={{ borderColor: "#999", color: "#000" }}>
      {name}
    </div>
  );
}

function NoteSection({
  note,
  currLabel,
  prevLabel,
  showChanges,
}: {
  note: NoteDetail;
  currLabel: string;
  prevLabel: string;
  showChanges: boolean;
}) {
  return (
    <div className="mb-4 break-inside-avoid">
      <div className="text-base font-bold">
        ביאור {note.num} — {note.name}
      </div>
      <table className="mt-1 w-full border-collapse text-sm">
        <thead>
          <tr>
            <td></td>
            <td className="text-left" style={{ color: "#555" }}>
              {currLabel}
            </td>
            <td className="text-left" style={{ color: "#555" }}>
              {prevLabel}
            </td>
            {showChanges && (
              <>
                <td className="text-left" style={{ color: "#555" }}>
                  שינוי
                </td>
                <td className="text-left" style={{ color: "#555" }}>
                  %
                </td>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {note.subNotes.map((sn) => (
            <Row key={sn.id} label={sn.name} curr={sn.curr} prev={sn.prev} showChanges={showChanges} />
          ))}
          {note.statement === "pl"
            ? note.directAccounts.map((a) => (
                <Row key={a.id} label={a.name} curr={a.curr} prev={a.prev} showChanges={showChanges} />
              ))
            : note.subNotes.length > 0 && (
                <Row
                  label="יתרת כרטיסים ללא תת-ביאור"
                  curr={note.direct.curr}
                  prev={note.direct.prev}
                  showChanges={showChanges}
                />
              )}
          <Row label='סה"כ' curr={note.curr} prev={note.prev} bold showChanges={showChanges} />
        </tbody>
      </table>
    </div>
  );
}

export default async function PrintPage({
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
    .select("id, name, tax_id, kind, from_month, to_month, report_year, general_note, show_changes")
    .eq("id", id)
    .single();
  if (clientError || !client) notFound();
  const showChanges = client.show_changes;

  const fromM = Number(sp.from) || client.from_month;
  const toM = Number(sp.to) || client.to_month;
  const year = Number(sp.year) || client.report_year;
  const currentAsOf = lastDayOfMonth(year, toM);
  const prevAsOf = lastDayOfMonth(year - 1, toM);
  const currLabel = periodLabel(fromM, toM, year);
  const prevLabel = periodLabel(fromM, toM, year - 1);
  const currentPeriod = { from: firstDayOfMonth(year, fromM), to: currentAsOf };
  const prevPeriod = { from: firstDayOfMonth(year - 1, fromM), to: prevAsOf };

  const periodData = await fetchPeriodData(supabase, id, currentPeriod, prevPeriod);
  const bs = buildReportData(periodData, "bs");
  const pl = buildReportData(periodData, "pl");
  const noteDetails = { notes: buildNoteDetails(periodData) };

  const assetGroups = bs.groups.filter((g) => g.side === "assets");
  const liabEquityGroups = bs.groups.filter((g) => g.side === "liabilities_equity");
  const assetGroupsPrint = hideZeroRows(assetGroups);
  const liabEquityGroupsPrint = hideZeroRows(liabEquityGroups);
  const currAsOfLabel = asOfLabel(currentAsOf);
  const prevAsOfLabel = asOfLabel(prevAsOf);
  const assetsTotal = {
    curr: assetGroups.reduce((s, g) => s + g.curr, 0),
    prev: assetGroups.reduce((s, g) => s + g.prev, 0),
  };
  const liabEquityBase = {
    curr: liabEquityGroups.reduce((s, g) => s + g.curr, 0),
    prev: liabEquityGroups.reduce((s, g) => s + g.prev, 0),
  };
  const liabEquityTotal = { curr: liabEquityBase.curr + pl.total.curr, prev: liabEquityBase.prev + pl.total.prev };

  // מספר עמודות בפועל בכל טבלה: שם + ביאור + חובה/זכות (2) + שינוי/% אופציונלי (2) — נחוץ ל-colSpan של שורת כותרת הקבוצה.
  const bsColCount = 4 + (showChanges ? 2 : 0);
  const plColCount = 4 + (showChanges ? 2 : 0);

  const error = periodData.error;

  return (
    <div style={{ background: "var(--background)" }}>
      <div className="print:hidden flex items-center justify-between px-11 py-6">
        <div className="text-lg" style={{ color: "var(--muted)" }}>
          תצוגה מוכנה להדפסה / שמירה כ-PDF (Ctrl+P)
        </div>
        <div className="flex items-center gap-3">
          <ChangeColumnToggle clientId={id} showChanges={showChanges} />
          <PrintButton />
        </div>
      </div>

      {error && (
        <div className="print:hidden mx-11 mb-6 rounded-2xl border-2 p-5 text-lg" style={{ borderColor: "var(--warn-border)", background: "var(--warn-soft)", color: "var(--warn-text)" }}>
          שגיאה בטעינת הנתונים: {error}
        </div>
      )}

      <div className="mx-auto max-w-3xl bg-white px-10 py-10 text-black print:mx-0 print:max-w-none print:p-0" dir="rtl">
        <section
          className="mb-10 break-after-page"
          style={{ breakAfter: "page", pageBreakAfter: "always" }}
        >
          <div className="text-3xl font-extrabold">{client.name}</div>
          <div className="mt-2 text-lg">ח.פ / ע.מ {client.tax_id} · {client.kind}</div>
          <div className="mt-8 text-2xl font-bold">דוחות כספיים ליום {currentAsOf.split("-").reverse().join("/")}</div>
          <div className="mt-1 text-base" style={{ color: "#555" }}>
            לתקופה {currLabel} · מקבילה {prevLabel}
          </div>
        </section>

        <section
          className="mb-10 break-after-page"
          style={{ breakAfter: "page", pageBreakAfter: "always" }}
        >
          <PageHeader name={client.name} />
          <div className="mb-4 text-2xl font-extrabold">מאזן</div>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <td></td>
                <td className="pb-2 text-center font-bold" style={{ color: "#555" }}>
                  ביאור
                </td>
                <td className="pb-2 text-left font-bold">{currAsOfLabel}</td>
                <td className="pb-2 text-left font-bold" style={{ color: "#555" }}>
                  {prevAsOfLabel}
                </td>
                {showChanges && (
                  <>
                    <td className="pb-2 text-left font-bold" style={{ color: "#555" }}>
                      שינוי
                    </td>
                    <td className="pb-2 text-left font-bold" style={{ color: "#555" }}>
                      %
                    </td>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {assetGroupsPrint.map((g) => (
                <GroupRows key={g.id} group={g} showChanges={showChanges} showNoteCol colCount={bsColCount} />
              ))}
              <Row
                label='סה"כ נכסים'
                noteNum={null}
                curr={assetsTotal.curr}
                prev={assetsTotal.prev}
                bold
                variant="final"
                showChanges={showChanges}
              />
            </tbody>
          </table>

          <table className="mt-8 w-full border-collapse text-sm">
            <thead>
              <tr>
                <td></td>
                <td className="pb-2 text-center font-bold" style={{ color: "#555" }}>
                  ביאור
                </td>
                <td className="pb-2 text-left font-bold">{currAsOfLabel}</td>
                <td className="pb-2 text-left font-bold" style={{ color: "#555" }}>
                  {prevAsOfLabel}
                </td>
                {showChanges && (
                  <>
                    <td className="pb-2 text-left font-bold" style={{ color: "#555" }}>
                      שינוי
                    </td>
                    <td className="pb-2 text-left font-bold" style={{ color: "#555" }}>
                      %
                    </td>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {liabEquityGroupsPrint.map((g) => (
                <GroupRows key={g.id} group={g} showChanges={showChanges} showNoteCol colCount={bsColCount} />
              ))}
              <Row
                label="רווח (הפסד) לתקופה — טרם שויך לעודפים"
                noteNum={null}
                curr={pl.total.curr}
                prev={pl.total.prev}
                showChanges={showChanges}
              />
              <Row
                label='סה"כ התחייבויות והון'
                noteNum={null}
                curr={liabEquityTotal.curr}
                prev={liabEquityTotal.prev}
                bold
                variant="final"
                showChanges={showChanges}
              />
            </tbody>
          </table>
        </section>

        <section
          className="mb-10 break-after-page"
          style={{ breakAfter: "page", pageBreakAfter: "always" }}
        >
          <PageHeader name={client.name} />
          <div className="mb-4 text-2xl font-extrabold">רווח והפסד</div>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <td className="pb-2 font-bold">סעיף</td>
                <td className="pb-2 text-center font-bold" style={{ color: "#555" }}>
                  ביאור
                </td>
                <td className="pb-2 text-left font-bold">{currLabel}</td>
                <td className="pb-2 text-left font-bold" style={{ color: "#555" }}>
                  {prevLabel}
                </td>
                {showChanges && (
                  <>
                    <td className="pb-2 text-left font-bold" style={{ color: "#555" }}>
                      שינוי
                    </td>
                    <td className="pb-2 text-left font-bold" style={{ color: "#555" }}>
                      %
                    </td>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {pl.groups.map((g) => (
                <GroupRows key={g.id} group={g} showChanges={showChanges} showNoteCol colCount={plColCount} />
              ))}
              <Row
                label="רווח (הפסד) לתקופה"
                noteNum={null}
                curr={pl.total.curr}
                prev={pl.total.prev}
                bold
                variant="final"
                showChanges={showChanges}
              />
            </tbody>
          </table>
        </section>

        <section>
          <PageHeader name={client.name} />
          <div className="mb-4 text-2xl font-extrabold">ביאורים</div>
          {client.general_note && (
            <div className="mb-6 break-inside-avoid">
              <div className="text-base font-bold">מהות הפעילות ועיקרי המדיניות החשבונאית</div>
              <div className="mt-1 whitespace-pre-wrap text-sm">{client.general_note}</div>
            </div>
          )}
          {noteDetails.notes
            .filter((n) => n.num !== null)
            .map((n) => (
              <NoteSection key={n.id} note={n} currLabel={currLabel} prevLabel={prevLabel} showChanges={showChanges} />
            ))}
        </section>
      </div>
    </div>
  );
}
