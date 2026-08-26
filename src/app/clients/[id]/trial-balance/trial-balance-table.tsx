"use client";

import { useMemo, useState } from "react";
import { formatAmount } from "@/lib/format";

export interface TbRow {
  accountId: string;
  code: string;
  name: string;
  curr: number;
  prev: number;
}

export function TrialBalanceTable({
  rows,
  currLabel,
  prevLabel,
  totalCurr,
  totalPrev,
}: {
  rows: TbRow[];
  currLabel: string;
  prevLabel: string;
  totalCurr: number;
  totalPrev: number;
}) {
  const [search, setSearch] = useState("");
  const [hideZero, setHideZero] = useState(true);

  const filtered = useMemo(() => {
    const q = search.trim();
    return rows.filter((r) => {
      if (hideZero && Math.round(r.curr) === 0 && Math.round(r.prev) === 0) return false;
      if (q && !r.name.includes(q) && !r.code.includes(q)) return false;
      return true;
    });
  }, [rows, search, hideZero]);

  return (
    <div className="rounded-[28px] border-2" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
      <div className="flex flex-wrap items-center gap-3 p-6 pb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חיפוש שם חשבון או כרטיס"
          className="w-64 rounded-full border-2 px-5 py-2.5 text-lg"
          style={{ borderColor: "var(--border)", background: "var(--background)" }}
        />
        <label className="flex items-center gap-2 text-base font-semibold" style={{ color: "var(--muted)" }}>
          <input type="checkbox" checked={hideZero} onChange={(e) => setHideZero(e.target.checked)} />
          הסתר יתרות אפס
        </label>
        <span className="mr-auto text-base font-semibold" style={{ color: "var(--muted)" }}>
          מציג {filtered.length.toLocaleString("he-IL")} מתוך {rows.length.toLocaleString("he-IL")}
        </span>
      </div>

      <div className="max-h-[620px] overflow-auto px-6 pb-6">
        <table className="w-full border-collapse text-lg">
          <thead>
            <tr style={{ background: "var(--background)", position: "sticky", top: 0 }}>
              <th className="p-3 text-right text-sm" style={{ color: "var(--muted)" }}>
                כרטיס
              </th>
              <th className="p-3 text-right text-sm" style={{ color: "var(--muted)" }}>
                שם החשבון
              </th>
              <th className="p-3 text-left text-sm" style={{ color: "var(--muted)" }}>
                {currLabel}
              </th>
              <th className="p-3 text-left text-sm" style={{ color: "var(--muted)" }}>
                {prevLabel}
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.accountId} style={{ borderBottom: "1.5px solid var(--border-soft)" }}>
                <td className="p-3 font-mono text-base" style={{ color: "var(--muted)" }}>
                  {r.code}
                </td>
                <td className="p-3 font-semibold">{r.name}</td>
                <td className="p-3 text-left font-bold tabular-nums">{formatAmount(r.curr)}</td>
                <td className="p-3 text-left tabular-nums" style={{ color: "var(--muted)" }}>
                  {formatAmount(r.prev)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: "3px solid var(--border)" }}>
              <td colSpan={2} className="p-4 text-xl font-extrabold">
                סה&quot;כ מאזן בוחן (חובה = זכות)
              </td>
              <td className="p-4 text-left text-xl font-extrabold tabular-nums">{formatAmount(totalCurr)}</td>
              <td className="p-4 text-left text-xl font-extrabold tabular-nums">{formatAmount(totalPrev)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
