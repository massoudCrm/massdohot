"use client";

import { useRouter, useSearchParams } from "next/navigation";

export function PeriodSelector({
  months,
  fromM,
  toM,
  year,
}: {
  months: string[];
  fromM: number;
  toM: number;
  year: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function update(patch: Partial<{ from: number; to: number; year: number }>) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("from", String(patch.from ?? fromM));
    params.set("to", String(patch.to ?? toM));
    params.set("year", String(patch.year ?? year));
    router.push(`?${params.toString()}`);
  }

  const years = [year - 2, year - 1, year, year + 1];

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-full border-2 px-4 py-2" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
      <span className="text-base font-semibold" style={{ color: "var(--muted)" }}>
        תקופה
      </span>
      <select
        value={fromM}
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
        value={toM}
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
        value={year}
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
