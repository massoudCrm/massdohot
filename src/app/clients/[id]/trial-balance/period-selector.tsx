"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function PeriodSelector({
  clientId,
  months,
  fromM,
  toM,
  year,
}: {
  clientId: string;
  months: string[];
  fromM: number;
  toM: number;
  year: number;
}) {
  const router = useRouter();
  // מצב מקומי, לא מבוסס על ה-props מהשרת — כי בין שינוי לשינוי (למשל חודש ואז שנה) הדף
  // עדיין לא הספיק להיטען מחדש עם הערכים החדשים, ואם מסתמכים על ה-props הישנים כל שינוי
  // "דורס" את קודמו בחזרה לערך הישן.
  const [state, setState] = useState({ from: fromM, to: toM, year });

  async function update(patch: Partial<{ from: number; to: number; year: number }>) {
    const next = { ...state, ...patch };
    setState(next);

    const params = new URLSearchParams();
    params.set("from", String(next.from));
    params.set("to", String(next.to));
    params.set("year", String(next.year));

    const supabase = createClient();
    const { error } = await supabase
      .from("clients")
      .update({ from_month: next.from, to_month: next.to, report_year: next.year })
      .eq("id", clientId);
    if (error) console.error("שמירת התקופה נכשלה:", error.message);

    router.push(`?${params.toString()}`);
  }

  const years = [state.year - 2, state.year - 1, state.year, state.year + 1];

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-full border-2 px-4 py-2" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
      <span className="text-base font-semibold" style={{ color: "var(--muted)" }}>
        תקופה
      </span>
      <select
        value={state.from}
        onChange={(e) => update({ from: Number(e.target.value) })}
        className="rounded-full border-2 px-3 py-1.5 text-base"
        style={{ borderColor: "var(--border)" }}
      >
        {months.map((m, i) => (
          <option key={i} value={i + 1}>
            {m}
          </option>
        ))}
      </select>
      <span className="text-base" style={{ color: "var(--muted)" }}>
        עד
      </span>
      <select
        value={state.to}
        onChange={(e) => update({ to: Number(e.target.value) })}
        className="rounded-full border-2 px-3 py-1.5 text-base"
        style={{ borderColor: "var(--border)" }}
      >
        {months.map((m, i) => (
          <option key={i} value={i + 1}>
            {m}
          </option>
        ))}
      </select>
      <select
        value={state.year}
        onChange={(e) => update({ year: Number(e.target.value) })}
        className="rounded-full border-2 px-3 py-1.5 text-base"
        style={{ borderColor: "var(--border)" }}
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}
