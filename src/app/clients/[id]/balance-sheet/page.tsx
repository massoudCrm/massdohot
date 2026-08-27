import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatAmount, formatPercentChange, lastDayOfMonth } from "@/lib/format";
import { fetchReportData, type GroupTotal } from "../report-shared";
import { ChangeColumnToggle } from "../change-column-toggle";

function periodLabel(fromM: number, toM: number, year: number) {
  const two = (m: number) => String(m).padStart(2, "0");
  return fromM === toM ? `${two(fromM)}/${year}` : `${two(fromM)}-${two(toM)}/${year}`;
}

function GroupBlock({
  group,
  currLabel,
  prevLabel,
  showChanges,
}: {
  group: GroupTotal;
  currLabel: string;
  prevLabel: string;
  showChanges: boolean;
}) {
  return (
    <div className="mb-5">
      <div className="text-lg font-extrabold">{group.name}</div>
      <table className="mt-2 w-full border-collapse text-lg">
        <thead>
          <tr className="text-sm" style={{ color: "var(--muted)" }}>
            <td></td>
            <td className="p-2 text-left">{currLabel}</td>
            <td className="p-2 text-left">{prevLabel}</td>
            {showChanges && (
              <>
                <td className="p-2 text-left">שינוי</td>
                <td className="p-2 text-left">%</td>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {group.notes.length === 0 && (
            <tr>
              <td className="p-2 text-base" style={{ color: "var(--muted)" }} colSpan={showChanges ? 5 : 3}>
                אין ביאורים בקבוצה זו.
              </td>
            </tr>
          )}
          {group.notes.map((n) => (
            <tr key={n.id} style={{ borderBottom: "1px solid var(--border-soft)" }}>
              <td className="p-2">
                {n.name} <span style={{ color: "var(--muted)" }}>(ביאור {n.num})</span>
              </td>
              <td className="p-2 text-left tabular-nums">{formatAmount(n.curr)}</td>
              <td className="p-2 text-left tabular-nums" style={{ color: "var(--muted)" }}>
                {formatAmount(n.prev)}
              </td>
              {showChanges && (
                <>
                  <td className="p-2 text-left tabular-nums" style={{ color: "var(--muted)" }}>
                    {formatAmount(n.curr - n.prev)}
                  </td>
                  <td className="p-2 text-left tabular-nums" style={{ color: "var(--muted)" }}>
                    {formatPercentChange(n.curr, n.prev)}
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: "2px solid var(--border)" }}>
            <td className="p-2 font-bold">סה&quot;כ {group.name}</td>
            <td className="p-2 text-left font-bold tabular-nums">{formatAmount(group.curr)}</td>
            <td className="p-2 text-left font-bold tabular-nums">{formatAmount(group.prev)}</td>
            {showChanges && (
              <>
                <td className="p-2 text-left font-bold tabular-nums">{formatAmount(group.curr - group.prev)}</td>
                <td className="p-2 text-left font-bold tabular-nums">{formatPercentChange(group.curr, group.prev)}</td>
              </>
            )}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default async function BalanceSheetPage({
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

  const [bs, pl] = await Promise.all([
    fetchReportData(supabase, id, currentAsOf, prevAsOf, "bs"),
    fetchReportData(supabase, id, currentAsOf, prevAsOf, "pl"),
  ]);

  const counts = (countsRaw as Record<string, number>) ?? {};
  const unassignedCount = counts["unassigned"] ?? 0;

  const assetGroups = bs.groups.filter((g) => g.side === "assets");
  const liabEquityGroups = bs.groups.filter((g) => g.side === "liabilities_equity");
  const assetsTotal = { curr: assetGroups.reduce((s, g) => s + g.curr, 0), prev: assetGroups.reduce((s, g) => s + g.prev, 0) };
  const liabEquityBase = {
    curr: liabEquityGroups.reduce((s, g) => s + g.curr, 0),
    prev: liabEquityGroups.reduce((s, g) => s + g.prev, 0),
  };
  const liabEquityTotal = { curr: liabEquityBase.curr + pl.total.curr, prev: liabEquityBase.prev + pl.total.prev };

  const error = bs.error || pl.error;

  return (
    <main className="flex-1 px-11 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-3xl font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
              מאזן
            </div>
            <div className="mt-1.5 text-lg" style={{ color: "var(--muted)" }}>
              ליום {currentAsOf.split("-").reverse().join("/")} · מקבילה {prevLabel}
            </div>
          </div>
          <ChangeColumnToggle clientId={id} showChanges={showChanges} />
        </div>

        {error && (
          <div
            className="mb-6 rounded-2xl border-2 p-5 text-lg"
            style={{ borderColor: "var(--warn-border)", background: "var(--warn-soft)", color: "var(--warn-text)" }}
          >
            שגיאה בטעינת הנתונים: {error}
          </div>
        )}

        {unassignedCount > 0 && (
          <div
            className="mb-6 rounded-[28px] border-2 p-6"
            style={{ borderColor: "var(--warn-border)", background: "var(--warn-soft)", color: "var(--warn-text)" }}
          >
            <div className="text-xl font-extrabold">חסר מיון</div>
            <div className="mt-1.5 text-base leading-relaxed">
              {unassignedCount.toLocaleString("he-IL")} סעיפים אינם מוינים לביאור, ולכן לא נכללים במאזן. לך ל
              <Link href={`/clients/${id}/trial-balance`} className="mx-1 font-bold" style={{ color: "var(--accent-text)" }}>
                מאזן בוחן ומיון
              </Link>
              כדי לשייך אותם.
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <div className="rounded-[28px] border-2 p-6" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            <div className="text-2xl font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
              נכסים
            </div>
            <div className="mt-4">
              {assetGroups.map((g) => (
                <GroupBlock key={g.id} group={g} currLabel={currLabel} prevLabel={prevLabel} showChanges={showChanges} />
              ))}
            </div>
            <div
              className="mt-4 flex items-center justify-between rounded-2xl p-4 text-xl font-extrabold"
              style={{ background: "var(--background)" }}
            >
              <span>סה&quot;כ נכסים</span>
              <div className="flex gap-8 tabular-nums">
                <span>{formatAmount(assetsTotal.curr)}</span>
                <span style={{ color: "var(--muted)" }}>{formatAmount(assetsTotal.prev)}</span>
                {showChanges && (
                  <>
                    <span style={{ color: "var(--muted)" }}>{formatAmount(assetsTotal.curr - assetsTotal.prev)}</span>
                    <span style={{ color: "var(--muted)" }}>{formatPercentChange(assetsTotal.curr, assetsTotal.prev)}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border-2 p-6" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
            <div className="text-2xl font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
              התחייבויות והון
            </div>
            <div className="mt-4">
              {liabEquityGroups.map((g) => (
                <GroupBlock key={g.id} group={g} currLabel={currLabel} prevLabel={prevLabel} showChanges={showChanges} />
              ))}
            </div>
            <div className="mb-2 flex items-center justify-between px-2 text-base" style={{ color: "var(--muted)" }}>
              <span>רווח (הפסד) לתקופה — טרם שויך לעודפים</span>
              <div className="flex gap-8 tabular-nums">
                <span>{formatAmount(pl.total.curr)}</span>
                <span>{formatAmount(pl.total.prev)}</span>
                {showChanges && (
                  <>
                    <span>{formatAmount(pl.total.curr - pl.total.prev)}</span>
                    <span>{formatPercentChange(pl.total.curr, pl.total.prev)}</span>
                  </>
                )}
              </div>
            </div>
            <div
              className="mt-2 flex items-center justify-between rounded-2xl p-4 text-xl font-extrabold"
              style={{ background: "var(--background)" }}
            >
              <span>סה&quot;כ התחייבויות והון</span>
              <div className="flex gap-8 tabular-nums">
                <span>{formatAmount(liabEquityTotal.curr)}</span>
                <span style={{ color: "var(--muted)" }}>{formatAmount(liabEquityTotal.prev)}</span>
                {showChanges && (
                  <>
                    <span style={{ color: "var(--muted)" }}>
                      {formatAmount(liabEquityTotal.curr - liabEquityTotal.prev)}
                    </span>
                    <span style={{ color: "var(--muted)" }}>
                      {formatPercentChange(liabEquityTotal.curr, liabEquityTotal.prev)}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
    </main>
  );
}
