"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { parseUniformFormat, type ParseResult, type ParsedAccount } from "@/lib/uniform-format/parse";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { describeError, formatAmount } from "@/lib/format";

export interface YearStatus {
  year: number;
  txn_count: number;
  total_debit: number;
  total_credit: number;
  net_total_debit: number;
  net_total_credit: number;
  last_uploaded_at: string;
}

const YEAR_OPTIONS = Array.from({ length: 9 }, (_, i) => 2024 + i); // 2024–2032

// בדיקה חד-פעמית: האם שדה "קוד סיווג" (1417) שקיים במפרט הקובץ האחיד באמת נושא מידע
// שימושי (למשל זיהוי מאזני/תוצאתי) בקבצים האמיתיים שלך. מציג את הערכים שנמצאו בפועל
// ודוגמת חשבון לכל ערך, כדי שנוכל להחליט יחד אם אפשר להסתמך עליו — לא נעשה בו כרגע
// שום שימוש אוטומטי.
function ClassificationCodeDiagnostics({ accounts }: { accounts: ParsedAccount[] }) {
  if (accounts.length === 0) return null;
  const byCode = new Map<string, { count: number; example: ParsedAccount }>();
  for (const a of accounts) {
    const key = a.classificationCode || "(ריק)";
    const existing = byCode.get(key);
    if (existing) existing.count += 1;
    else byCode.set(key, { count: 1, example: a });
  }
  const rows = [...byCode.entries()].sort((a, b) => b[1].count - a[1].count);

  return (
    <div
      className="mt-3 rounded-2xl border-2 p-4 text-base"
      style={{ borderColor: "var(--border)", background: "var(--background)" }}
    >
      <b>בדיקה: שדה &quot;קוד סיווג&quot; (1417) בקובץ</b>
      <div className="mt-1" style={{ color: "var(--muted)" }}>
        זו רק תצוגת מידע לבדיקה — לא משפיע על הקליטה. הערכים שנמצאו בפועל בקובץ הזה, ודוגמת חשבון לכל ערך:
      </div>
      <table className="mt-3 w-full border-collapse text-sm">
        <thead>
          <tr style={{ color: "var(--muted)" }}>
            <td className="pb-1 pl-4">ערך</td>
            <td className="pb-1 pl-4">כמות חשבונות</td>
            <td className="pb-1">דוגמה</td>
          </tr>
        </thead>
        <tbody>
          {rows.map(([code, { count, example }]) => (
            <tr key={code} style={{ borderTop: "1px solid var(--border-soft)" }}>
              <td className="py-1 pl-4 font-mono">{code}</td>
              <td className="py-1 pl-4">{count.toLocaleString("he-IL")}</td>
              <td className="py-1">
                {example.code} · {example.name}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DropZone({
  label,
  hint,
  file,
  onFile,
}: {
  label: string;
  hint: string;
  file: File | null;
  onFile: (f: File) => void;
}) {
  return (
    <label
      className="flex cursor-pointer items-center justify-between gap-4 rounded-[28px] border-2 border-dashed p-6"
      style={{ borderColor: "var(--border)", background: "var(--background)" }}
    >
      <div>
        <div className="text-xl font-bold">{label}</div>
        <div className="mt-1 text-base" style={{ color: "var(--muted)" }}>
          {hint}
        </div>
      </div>
      {file ? (
        <span
          className="flex-none rounded-full border-2 px-4 py-2 text-base font-bold"
          style={{
            borderColor: "var(--success-border)",
            background: "var(--success-soft)",
            color: "var(--success-text)",
          }}
        >
          נטען · {(file.size / 1024).toFixed(1)}KB
        </span>
      ) : (
        <span className="flex-none text-base font-bold" style={{ color: "var(--accent-text)" }}>
          בחר קובץ…
        </span>
      )}
      <input
        type="file"
        accept=".txt"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
    </label>
  );
}

function UploadStatusPanel({ yearsLoaded }: { yearsLoaded: YearStatus[] }) {
  if (yearsLoaded.length === 0) {
    return (
      <div className="mb-6 rounded-2xl border-2 p-5 text-base" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
        עדיין לא נטענו נתונים ללקוח זה — זו הפעם הראשונה.
      </div>
    );
  }
  return (
    <div
      className="mb-6 rounded-2xl border-2 p-5 text-base"
      style={{ borderColor: "var(--success-border)", background: "var(--success-soft)", color: "var(--success-text)" }}
    >
      <div className="font-bold">כבר נטענו נתונים ללקוח זה:</div>
      <div className="mt-2 flex flex-wrap gap-3">
        {yearsLoaded.map((y) => (
          <span
            key={y.year}
            className="rounded-full border-2 px-4 py-1.5 font-bold"
            style={{ borderColor: "var(--success-border)", background: "var(--card)" }}
          >
            {y.year} · {y.txn_count.toLocaleString("he-IL")} תנועות · נטען {new Date(y.last_uploaded_at).toLocaleDateString("he-IL")}
          </span>
        ))}
      </div>
      <div className="mt-3 text-sm">
        <b>בדיקת יתרות — לפי אותה שיטה כמו &quot;סה&quot;כ לדו&quot;ח&quot; בדוח מאזן הבוחן שלכם (השוו ישירות):</b>
        <div className="mt-1 flex flex-wrap gap-3">
          {yearsLoaded.map((y) => (
            <span key={y.year} className="tabular-nums">
              {y.year}: חובה {formatAmount(y.net_total_debit)} · זכות {formatAmount(y.net_total_credit)}
            </span>
          ))}
        </div>
      </div>
      <div className="mt-3 text-sm">
        <b>בדיקה נוספת — סה&quot;כ תנועות גולמי בפועל (רגישה יותר לתנועה בודדת שאבדה, לא ניתן להשוואה ישירה מול הדוח):</b>
        <div className="mt-1 flex flex-wrap gap-3">
          {yearsLoaded.map((y) => (
            <span key={y.year} className="tabular-nums">
              {y.year}: חובה {formatAmount(y.total_debit)} · זכות {formatAmount(y.total_credit)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function FileIngestion({
  clientId,
  defaultYear,
  yearsLoaded,
}: {
  clientId: string;
  defaultYear: number;
  yearsLoaded: YearStatus[];
}) {
  const router = useRouter();
  const [iniFile, setIniFile] = useState<File | null>(null);
  const [bkmvFile, setBkmvFile] = useState<File | null>(null);
  const [year, setYear] = useState(defaultYear);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  const existingYear = yearsLoaded.find((y) => y.year === year);

  async function handleParse() {
    if (!iniFile || !bkmvFile) return;
    setParsing(true);
    setStatus("");
    try {
      const [iniBuf, bkmvBuf] = await Promise.all([iniFile.arrayBuffer(), bkmvFile.arrayBuffer()]);
      const parsed = parseUniformFormat(iniBuf, bkmvBuf);
      setResult(parsed);
    } catch (e) {
      setResult(null);
      setStatus("שגיאה בעיבוד הקבצים: " + describeError(e));
    } finally {
      setParsing(false);
    }
  }

  async function handleSave() {
    if (!result || result.errors.length > 0) return;
    setSaving(true);
    setStatus("");

    const supabase = createClient();
    try {
      // מוחקים רק תנועות של שנת הדוח שנבחרה — שנים אחרות שכבר נטענו ללקוח נשארות ללא פגע.
      const { error: delErr } = await supabase.rpc("delete_client_transactions_for_year", {
        p_client_id: clientId,
        p_year: year,
      });
      if (delErr) throw delErr;

      // יתרת פתיחה מתעדכנת בשרת רק אם התאריך החדש מוקדם-או-שווה לזה שכבר שמור, כדי שהעוגן
      // תמיד יישאר הנקודה המוקדמת ביותר שיש לנו נתונים עליה (ראו migration 0015).
      const openingDate = `${year}-01-01`;
      const accountRows = result.accounts.map((a) => ({
        code: a.code,
        name: a.name,
        opening_balance: a.openingBalance,
        opening_date: openingDate,
        source_group_code: a.sourceGroupCode || null,
        source_group_desc: a.sourceGroupDesc || null,
      }));
      const { data: savedAccounts, error: accErr } = await supabase.rpc("upsert_accounts_with_opening_balance", {
        p_client_id: clientId,
        p_accounts: accountRows,
      });
      if (accErr) throw accErr;

      const codeToId = new Map((savedAccounts ?? []).map((a: { id: string; code: string }) => [a.code, a.id]));
      const txnRows = result.transactions
        .map((t) => {
          const accountId = codeToId.get(t.accountCode);
          if (!accountId) return null;
          return {
            account_id: accountId,
            txn_date: t.date,
            reference: t.reference,
            description: t.description,
            debit: t.debit,
            credit: t.credit,
            source: "file" as const,
          };
        })
        .filter((r): r is NonNullable<typeof r> => r !== null);

      const CHUNK = 500;
      for (let i = 0; i < txnRows.length; i += CHUNK) {
        const { error: txnErr } = await supabase.from("transactions").insert(txnRows.slice(i, i + CHUNK));
        if (txnErr) throw txnErr;
      }

      setStatus(`נקלטו בהצלחה ${accountRows.length} חשבונות ו-${txnRows.length} תנועות לשנת ${year}.`);
      router.refresh();
    } catch (e) {
      setStatus("שמירה נכשלה: " + describeError(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-5xl">
      <UploadStatusPanel yearsLoaded={yearsLoaded} />

      <div className="mb-6 flex items-center gap-3 rounded-2xl border-2 p-5" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
        <label className="text-lg font-bold">שנת הדוח שמעלים:</label>
        <select
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="w-32 rounded-full border-2 px-4 py-2 text-lg font-bold tabular-nums"
          style={{ borderColor: "var(--accent)", background: "var(--card)", color: "var(--accent-text)" }}
        >
          {YEAR_OPTIONS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        {existingYear && (
          <span className="text-base font-semibold" style={{ color: "var(--warn-text)" }}>
            שים לב: שנת {year} כבר טעונה ({existingYear.txn_count.toLocaleString("he-IL")} תנועות) — קליטה חדשה תחליף אותה.
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-[28px] border-2 p-8" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <div className="text-2xl font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
            הקבצים
          </div>
          <div className="mt-5 flex flex-col gap-4">
            <DropZone label="INI.TXT" hint="רשומת סיכום ומספרי רשומות" file={iniFile} onFile={setIniFile} />
            <DropZone label="BKMVDATA.TXT" hint="חשבונות ותנועות הנהלת חשבונות" file={bkmvFile} onFile={setBkmvFile} />
            <button
              disabled={!iniFile || !bkmvFile || parsing}
              onClick={handleParse}
              className="rounded-full py-3.5 text-lg font-bold text-white disabled:opacity-50"
              style={{ background: "var(--accent)" }}
            >
              {parsing ? "מעבד…" : "חלץ נתונים מהקבצים"}
            </button>
          </div>
        </div>

        <div className="rounded-[28px] border-2 p-8" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <div className="text-2xl font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
            רשומות שזוהו
          </div>
          {!result && (
            <div className="mt-5 text-lg" style={{ color: "var(--muted)" }}>
              עדיין לא חולצו נתונים.
            </div>
          )}
          {result && (
            <>
              <table className="mt-5 w-full border-collapse text-lg">
                <thead>
                  <tr style={{ background: "var(--background)" }}>
                    <th className="p-3 text-right text-sm" style={{ color: "var(--muted)" }}>
                      קוד
                    </th>
                    <th className="p-3 text-right text-sm" style={{ color: "var(--muted)" }}>
                      תיאור
                    </th>
                    <th className="p-3 text-left text-sm" style={{ color: "var(--muted)" }}>
                      כמות
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.recordTypeCounts.map((rc) => (
                    <tr key={rc.code} style={{ borderBottom: "1.5px solid var(--border-soft)" }}>
                      <td className="p-3 font-mono font-bold">{rc.code}</td>
                      <td className="p-3">{rc.description}</td>
                      <td className="p-3 text-left font-semibold">{rc.count.toLocaleString("he-IL")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {result.errors.length > 0 && (
                <div
                  className="mt-5 rounded-2xl border-2 p-4 text-base"
                  style={{ borderColor: "var(--warn-border)", background: "var(--warn-soft)", color: "var(--warn-text)" }}
                >
                  <b>שגיאות — לא ניתן לקלוט:</b>
                  <ul className="mt-2 list-inside list-disc">
                    {result.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.warnings.length > 0 && (
                <div
                  className="mt-5 rounded-2xl border-2 p-4 text-base"
                  style={{ borderColor: "var(--border)", background: "var(--background)", color: "var(--muted)" }}
                >
                  <b>אזהרות:</b>
                  <ul className="mt-2 list-inside list-disc">
                    {result.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-5 text-lg">
                נמצאו <b>{result.accounts.length}</b> חשבונות ו-<b>{result.transactions.length}</b> תנועות עבור{" "}
                <b>{result.businessName}</b> (ח.פ {result.vatId}).
              </div>

              <ClassificationCodeDiagnostics accounts={result.accounts} />

              <div
                className="mt-3 rounded-2xl border-2 p-4 text-base"
                style={{ borderColor: "var(--border)", background: "var(--background)" }}
              >
                <b>סה&quot;כ תנועות בקובץ</b> (השוו מול &quot;סה&quot;כ לדו&quot;ח&quot; בדוח מאזן הבוחן המקורי — אמור
                תמיד להיות מאוזן):
                <div className="mt-1 tabular-nums">
                  חובה {formatAmount(result.transactions.reduce((s, t) => s + t.debit, 0))} · זכות{" "}
                  {formatAmount(result.transactions.reduce((s, t) => s + t.credit, 0))}
                </div>
              </div>

              {existingYear ? (
                <ConfirmDeleteButton
                  label={`קליטה לדאטהבייס — שנת ${year}`}
                  title="החלפת נתוני שנה קיימת"
                  message={`שנת ${year} כבר טעונה עם ${existingYear.txn_count.toLocaleString(
                    "he-IL"
                  )} תנועות (נטענה לאחרונה ${new Date(existingYear.last_uploaded_at).toLocaleDateString(
                    "he-IL"
                  )}). קליטה זו תמחק את התנועות הקיימות לשנת ${year} ותחליף אותן בקובץ החדש. שנים אחרות לא ייפגעו.`}
                  confirmLabel="כן, החלף"
                  confirmBusyLabel="קולט…"
                  onConfirm={handleSave}
                  className="mt-5 w-full rounded-full py-3.5 text-center text-lg font-bold text-white"
                  style={{ background: "var(--success)" }}
                />
              ) : (
                <button
                  disabled={result.errors.length > 0 || saving}
                  onClick={handleSave}
                  className="mt-5 w-full rounded-full py-3.5 text-lg font-bold text-white disabled:opacity-50"
                  style={{ background: "var(--success)" }}
                >
                  {saving ? "קולט…" : `קליטה לדאטהבייס — שנת ${year}`}
                </button>
              )}
            </>
          )}

          {status && <div className="mt-4 text-base font-semibold">{status}</div>}
        </div>
      </div>
    </div>
  );
}
