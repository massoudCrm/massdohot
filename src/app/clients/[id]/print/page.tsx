import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatAmount, lastDayOfMonth } from "@/lib/format";
import { fetchReportData, fetchNoteDetails, type GroupTotal, type NoteDetail } from "../report-shared";
import { PrintButton } from "./print-button";

function periodLabel(fromM: number, toM: number, year: number) {
  const two = (m: number) => String(m).padStart(2, "0");
  return fromM === toM ? `${two(fromM)}/${year}` : `${two(fromM)}-${two(toM)}/${year}`;
}

function Row({ label, curr, prev, bold }: { label: string; curr: number; prev: number; bold?: boolean }) {
  return (
    <tr style={{ borderBottom: "1px solid #ddd" }}>
      <td className={`py-1.5 ${bold ? "font-bold" : ""}`}>{label}</td>
      <td className={`py-1.5 text-left tabular-nums ${bold ? "font-bold" : ""}`}>{formatAmount(curr)}</td>
      <td className={`py-1.5 text-left tabular-nums ${bold ? "font-bold" : ""}`} style={{ color: "#555" }}>
        {formatAmount(prev)}
      </td>
    </tr>
  );
}

function GroupRows({ group }: { group: GroupTotal }) {
  return (
    <>
      {group.notes.map((n) => (
        <Row key={n.id} label={`${n.name} (ביאור ${n.num})`} curr={n.curr} prev={n.prev} />
      ))}
      <Row label={`סה"כ ${group.name}`} curr={group.curr} prev={group.prev} bold />
    </>
  );
}

function NoteSection({ note, currLabel, prevLabel }: { note: NoteDetail; currLabel: string; prevLabel: string }) {
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
          </tr>
        </thead>
        <tbody>
          {note.subNotes.map((sn) => (
            <Row key={sn.id} label={sn.name} curr={sn.curr} prev={sn.prev} />
          ))}
          {note.subNotes.length > 0 && (
            <Row label="יתרת כרטיסים ללא תת-ביאור" curr={note.direct.curr} prev={note.direct.prev} />
          )}
          <Row label='סה"כ' curr={note.curr} prev={note.prev} bold />
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
    .select("id, name, tax_id, kind, from_month, to_month, report_year, general_note")
    .eq("id", id)
    .single();
  if (clientError || !client) notFound();

  const fromM = Number(sp.from) || client.from_month;
  const toM = Number(sp.to) || client.to_month;
  const year = Number(sp.year) || client.report_year;
  const currentAsOf = lastDayOfMonth(year, toM);
  const prevAsOf = lastDayOfMonth(year - 1, toM);
  const currLabel = periodLabel(fromM, toM, year);
  const prevLabel = periodLabel(fromM, toM, year - 1);

  const [bs, pl, noteDetails] = await Promise.all([
    fetchReportData(supabase, id, currentAsOf, prevAsOf, "bs"),
    fetchReportData(supabase, id, currentAsOf, prevAsOf, "pl"),
    fetchNoteDetails(supabase, id, currentAsOf, prevAsOf),
  ]);

  const assetGroups = bs.groups.filter((g) => g.side === "assets");
  const liabEquityGroups = bs.groups.filter((g) => g.side === "liabilities_equity");
  const assetsTotal = {
    curr: assetGroups.reduce((s, g) => s + g.curr, 0),
    prev: assetGroups.reduce((s, g) => s + g.prev, 0),
  };
  const liabEquityBase = {
    curr: liabEquityGroups.reduce((s, g) => s + g.curr, 0),
    prev: liabEquityGroups.reduce((s, g) => s + g.prev, 0),
  };
  const liabEquityTotal = { curr: liabEquityBase.curr + pl.total.curr, prev: liabEquityBase.prev + pl.total.prev };

  const error = bs.error || pl.error || noteDetails.error;

  return (
    <div style={{ background: "var(--background)" }}>
      <div className="print:hidden flex items-center justify-between px-11 py-6">
        <div className="text-lg" style={{ color: "var(--muted)" }}>
          תצוגה מוכנה להדפסה / שמירה כ-PDF (Ctrl+P)
        </div>
        <PrintButton />
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
          <div className="mb-4 text-2xl font-extrabold">מאזן</div>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <td className="pb-2 font-bold">נכסים</td>
                <td className="pb-2 text-left font-bold">{currLabel}</td>
                <td className="pb-2 text-left font-bold" style={{ color: "#555" }}>
                  {prevLabel}
                </td>
              </tr>
            </thead>
            <tbody>
              {assetGroups.map((g) => (
                <GroupRows key={g.id} group={g} />
              ))}
              <Row label='סה"כ נכסים' curr={assetsTotal.curr} prev={assetsTotal.prev} bold />
            </tbody>
          </table>

          <table className="mt-8 w-full border-collapse text-sm">
            <thead>
              <tr>
                <td className="pb-2 font-bold">התחייבויות והון</td>
                <td className="pb-2 text-left font-bold">{currLabel}</td>
                <td className="pb-2 text-left font-bold" style={{ color: "#555" }}>
                  {prevLabel}
                </td>
              </tr>
            </thead>
            <tbody>
              {liabEquityGroups.map((g) => (
                <GroupRows key={g.id} group={g} />
              ))}
              <Row label="רווח (הפסד) לתקופה — טרם שויך לעודפים" curr={pl.total.curr} prev={pl.total.prev} />
              <Row label='סה"כ התחייבויות והון' curr={liabEquityTotal.curr} prev={liabEquityTotal.prev} bold />
            </tbody>
          </table>
        </section>

        <section
          className="mb-10 break-after-page"
          style={{ breakAfter: "page", pageBreakAfter: "always" }}
        >
          <div className="mb-4 text-2xl font-extrabold">רווח והפסד</div>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <td className="pb-2 font-bold">סעיף</td>
                <td className="pb-2 text-left font-bold">{currLabel}</td>
                <td className="pb-2 text-left font-bold" style={{ color: "#555" }}>
                  {prevLabel}
                </td>
              </tr>
            </thead>
            <tbody>
              {pl.groups.map((g) => (
                <GroupRows key={g.id} group={g} />
              ))}
              <Row label="רווח (הפסד) לתקופה" curr={pl.total.curr} prev={pl.total.prev} bold />
            </tbody>
          </table>
        </section>

        <section>
          <div className="mb-4 text-2xl font-extrabold">ביאורים</div>
          {client.general_note && (
            <div className="mb-6 break-inside-avoid">
              <div className="text-base font-bold">מהות הפעילות ועיקרי המדיניות החשבונאית</div>
              <div className="mt-1 whitespace-pre-wrap text-sm">{client.general_note}</div>
            </div>
          )}
          {noteDetails.notes.map((n) => (
            <NoteSection key={n.id} note={n} currLabel={currLabel} prevLabel={prevLabel} />
          ))}
        </section>
      </div>
    </div>
  );
}
