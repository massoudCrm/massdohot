"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { parseUniformFormat, type ParseResult } from "@/lib/uniform-format/parse";

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

export function FileIngestion({ clientId }: { clientId: string }) {
  const [iniFile, setIniFile] = useState<File | null>(null);
  const [bkmvFile, setBkmvFile] = useState<File | null>(null);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

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
      setStatus("שגיאה בעיבוד הקבצים: " + (e instanceof Error ? e.message : String(e)));
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
      // מוחקים תנועות קיימות (קליטה מחדש = החלפה מלאה, לא צבירה)
      const { data: existingAccounts } = await supabase
        .from("accounts")
        .select("id")
        .eq("client_id", clientId);
      if (existingAccounts && existingAccounts.length > 0) {
        const { error: delErr } = await supabase
          .from("transactions")
          .delete()
          .in("account_id", existingAccounts.map((a) => a.id));
        if (delErr) throw delErr;
      }

      const accountRows = result.accounts.map((a) => ({
        client_id: clientId,
        code: a.code,
        name: a.name,
        opening_balance: a.openingBalance,
      }));
      const { data: savedAccounts, error: accErr } = await supabase
        .from("accounts")
        .upsert(accountRows, { onConflict: "client_id,code" })
        .select("id, code");
      if (accErr) throw accErr;

      const codeToId = new Map((savedAccounts ?? []).map((a) => [a.code, a.id]));
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

      setStatus(
        `נקלטו בהצלחה ${accountRows.length} חשבונות ו-${txnRows.length} תנועות.`
      );
    } catch (e) {
      setStatus("שמירה נכשלה: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="rounded-[28px] border-2 p-8" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <div className="text-2xl font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
          הקבצים
        </div>
        <div className="mt-5 flex flex-col gap-4">
          <DropZone
            label="INI.TXT"
            hint="רשומת סיכום ומספרי רשומות"
            file={iniFile}
            onFile={setIniFile}
          />
          <DropZone
            label="BKMVDATA.TXT"
            hint="חשבונות ותנועות הנהלת חשבונות"
            file={bkmvFile}
            onFile={setBkmvFile}
          />
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

            <button
              disabled={result.errors.length > 0 || saving}
              onClick={handleSave}
              className="mt-5 w-full rounded-full py-3.5 text-lg font-bold text-white disabled:opacity-50"
              style={{ background: "var(--success)" }}
            >
              {saving ? "קולט…" : "קליטה לדאטהבייס"}
            </button>
          </>
        )}

        {status && <div className="mt-4 text-base font-semibold">{status}</div>}
      </div>
    </div>
  );
}
