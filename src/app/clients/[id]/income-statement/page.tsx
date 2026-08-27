import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatAmount, formatPercentChange, lastDayOfMonth } from "@/lib/format";
import { fetchReportData } from "../report-shared";
import { ChangeColumnToggle } from "../change-column-toggle";

function periodLabel(fromM: number, toM: number, year: number) {
  const two = (m: number) => String(m).padStart(2, "0");
  return fromM === toM ? `${two(fromM)}/${year}` : `${two(fromM)}-${two(toM)}/${year}`;
}

export default async function IncomeStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string; year?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();

  const [{ data: client, error: clientError }, { data: countsRaw }] = await Promise.all([
    supabase.from("clients").select("id, from_month, to_month, report_year, show_changes").eq("id", id).single(),
    supabase.rpc("note_account_counts", { p_client_id: id }),
  ]);
  if (clientError || !client) notFound();
  const showChanges = client.show_changes;

  const fromM = Number(sp.from) || client.from_month;
  const toM = Number(sp.to) || client.to_month;
  const year = Number(sp.year) || client.report_year;
  const currentAsOf = lastDayOfMonth(year, toM);
  const prevAsOf = lastDayOfMonth(year - 1, toM);
  const currLabel = periodLabel(fromM, toM, year);
  const prevLabel = periodLabel(fromM, toM, year - 1);

  const pl = await fetchReportData(supabase, id, currentAsOf, prevAsOf, "pl");
  const counts = (countsRaw as Record<string, number>) ?? {};
  const unassignedCount = counts["unassigned"] ?? 0;

  return (
    <main className="flex-1 px-11 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-3xl font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
              רווח והפסד
            </div>
            <div className="mt-1.5 text-lg" style={{ color: "var(--muted)" }}>
              לתקופה {currLabel} · מקבילה {prevLabel}
            </div>
          </div>
          <ChangeColumnToggle clientId={id} showChanges={showChanges} />
        </div>

        {pl.error && (
          <div
            className="mb-6 rounded-2xl border-2 p-5 text-lg"
            style={{ borderColor: "var(--warn-border)", background: "var(--warn-soft)", color: "var(--warn-text)" }}
          >
            שגיאה בטעינת הנתונים: {pl.error}
          </div>
        )}

        {unassignedCount > 0 && (
          <div
            className="mb-6 rounded-[28px] border-2 p-6"
            style={{ borderColor: "var(--warn-border)", background: "var(--warn-soft)", color: "var(--warn-text)" }}
          >
            <div className="text-xl font-extrabold">חסר מיון</div>
            <div className="mt-1.5 text-base leading-relaxed">
              {unassignedCount.toLocaleString("he-IL")} סעיפים אינם מוינים לביאור, ולכן לא נכללים בדוח. לך ל
              <Link href={`/clients/${id}/trial-balance`} className="mx-1 font-bold" style={{ color: "var(--accent-text)" }}>
                מאזן בוחן ומיון
              </Link>
              כדי לשייך אותם.
            </div>
          </div>
        )}

        <div className="rounded-[28px] border-2 p-8" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <table className="w-full border-collapse text-lg">
            <thead>
              <tr style={{ background: "var(--background)" }}>
                <th className="p-3 text-right text-sm" style={{ color: "var(--muted)" }}>
                  סעיף
                </th>
                <th className="p-3 text-left text-sm" style={{ color: "var(--muted)" }}>
                  {currLabel}
                </th>
                <th className="p-3 text-left text-sm" style={{ color: "var(--muted)" }}>
                  {prevLabel}
                </th>
                {showChanges && (
                  <>
                    <th className="p-3 text-left text-sm" style={{ color: "var(--muted)" }}>
                      שינוי
                    </th>
                    <th className="p-3 text-left text-sm" style={{ color: "var(--muted)" }}>
                      %
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {pl.groups.map((g) => (
                <Fragment key={g.id}>
                  {g.notes.map((n) => (
                    <tr key={n.id} style={{ borderBottom: "1px solid var(--border-soft)" }}>
                      <td className="p-3">
                        {n.name} <span style={{ color: "var(--muted)" }}>(ביאור {n.num})</span>
                      </td>
                      <td className="p-3 text-left tabular-nums">{formatAmount(n.curr)}</td>
                      <td className="p-3 text-left tabular-nums" style={{ color: "var(--muted)" }}>
                        {formatAmount(n.prev)}
                      </td>
                      {showChanges && (
                        <>
                          <td className="p-3 text-left tabular-nums" style={{ color: "var(--muted)" }}>
                            {formatAmount(n.curr - n.prev)}
                          </td>
                          <td className="p-3 text-left tabular-nums" style={{ color: "var(--muted)" }}>
                            {formatPercentChange(n.curr, n.prev)}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                  <tr style={{ borderBottom: "2px solid var(--border)" }}>
                    <td className="p-3 font-bold">סה&quot;כ {g.name}</td>
                    <td className="p-3 text-left font-bold tabular-nums">{formatAmount(g.curr)}</td>
                    <td className="p-3 text-left font-bold tabular-nums">{formatAmount(g.prev)}</td>
                    {showChanges && (
                      <>
                        <td className="p-3 text-left font-bold tabular-nums">{formatAmount(g.curr - g.prev)}</td>
                        <td className="p-3 text-left font-bold tabular-nums">{formatPercentChange(g.curr, g.prev)}</td>
                      </>
                    )}
                  </tr>
                </Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "3px solid var(--border)" }}>
                <td className="p-4 text-xl font-extrabold">רווח (הפסד) לתקופה</td>
                <td className="p-4 text-left text-xl font-extrabold tabular-nums">{formatAmount(pl.total.curr)}</td>
                <td className="p-4 text-left text-xl font-extrabold tabular-nums">{formatAmount(pl.total.prev)}</td>
                {showChanges && (
                  <>
                    <td className="p-4 text-left text-xl font-extrabold tabular-nums">
                      {formatAmount(pl.total.curr - pl.total.prev)}
                    </td>
                    <td className="p-4 text-left text-xl font-extrabold tabular-nums">
                      {formatPercentChange(pl.total.curr, pl.total.prev)}
                    </td>
                  </>
                )}
              </tr>
            </tfoot>
          </table>
        </div>
    </main>
  );
}
