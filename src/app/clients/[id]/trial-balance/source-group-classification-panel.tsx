"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatSourceGroupCode, formatAmount } from "@/lib/format";

export interface SourceGroupClassification {
  id: string;
  sourceGroupCode: string;
  sourceGroupDesc: string | null;
  statement: "bs" | "pl" | null;
}

// כל קוד מיון (השדה שכבר מגיע מהקובץ האחיד) מסווג כאן פעם אחת לכל לקוח: מאזני או תוצאתי.
// זה מה שמאפשר לחשבון שעדיין לא שויך לביאור להיות מחושב נכון (תנועת תקופה לתוצאתי, יתרה
// מצטברת למאזני) כבר מרגע הקליטה — קוד שלא סווג עדיין מסומן באדום בטבלת המיון.
export function SourceGroupClassificationPanel({
  clientId,
  classifications,
  summaryByGroupCode,
}: {
  clientId: string;
  classifications: SourceGroupClassification[];
  summaryByGroupCode: Record<string, { count: number; curr: number; prev: number }>;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState<string | null>(null);
  const unresolvedCount = classifications.filter((c) => !c.statement).length;

  async function setStatement(id: string, statement: "bs" | "pl" | "") {
    setSaving(id);
    const supabase = createClient();
    await supabase
      .from("source_group_classifications")
      .update({ statement: statement || null })
      .eq("id", id);
    setSaving(null);
    router.refresh();
  }

  if (classifications.length === 0) return null;

  return (
    <div className="rounded-[28px] border-2 p-6" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
      <div className="text-xl font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
        סיווג קודי מיון
      </div>
      <div className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
        לכל קוד מיון שמגיע מהקובץ קובעים כאן פעם אחת אם הוא מאזני או תוצאתי — כך חשבון שעדיין לא
        שויך לביאור מחושב נכון כבר מהקליטה.
        {unresolvedCount > 0 && (
          <span className="mr-1 font-bold" style={{ color: "var(--warn-text)" }}>
            {unresolvedCount.toLocaleString("he-IL")} קודים עדיין לא סווגו.
          </span>
        )}
      </div>
      <div className="mt-4 flex flex-col gap-2">
        {classifications.map((c) => {
          const summary = summaryByGroupCode[c.sourceGroupCode];
          return (
          <div
            key={c.id}
            className="rounded-2xl p-3"
            style={{ background: c.statement ? "var(--background)" : "#ffe3e3" }}
          >
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-sm" style={{ color: "var(--muted)" }}>
                {formatSourceGroupCode(c.sourceGroupCode)}
              </span>
              <span className="break-words text-base font-semibold">{c.sourceGroupDesc || "—"}</span>
            </div>
            <div className="mt-1 text-sm tabular-nums" style={{ color: "var(--muted)" }}>
              {summary
                ? `${summary.count.toLocaleString("he-IL")} כרטיסים · יתרה נוכחית ${formatAmount(
                    summary.curr
                  )} · מקבילה ${formatAmount(summary.prev)}`
                : "אין חשבונות עם הקוד הזה כרגע"}
            </div>
            <select
              value={c.statement ?? ""}
              onChange={(e) => setStatement(c.id, e.target.value as "bs" | "pl" | "")}
              disabled={saving === c.id}
              className="mt-2 w-full rounded-full border-2 px-3 py-1.5 text-sm"
              style={{ borderColor: "var(--border)", background: "var(--card)" }}
            >
              <option value="">— לא נקבע —</option>
              <option value="bs">מאזני</option>
              <option value="pl">תוצאתי</option>
            </select>
          </div>
          );
        })}
      </div>
    </div>
  );
}
