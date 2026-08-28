"use client";

import { Fragment, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { formatAmount, describeError } from "@/lib/format";

export interface AccountOption {
  id: string;
  code: string;
  name: string;
}

export interface JournalLine {
  id: string;
  account_id: string;
  account_code: string;
  account_name: string;
  side: "D" | "C";
  amount: number;
}

export interface JournalEntry {
  id: string;
  entry_date: string;
  description: string;
  lines: JournalLine[];
}

interface DraftLine {
  key: string;
  accountId: string;
  accountLabel: string;
  side: "D" | "C";
  amount: string;
}

function newDraftLine(side: "D" | "C" = "D"): DraftLine {
  return { key: Math.random().toString(36).slice(2), accountId: "", accountLabel: "", side, amount: "" };
}

// מודל ליצירת חשבון ידני חדש (לא מהקובץ) — משמש כשמחפשים חשבון בבורר ולא מוצאים אותו,
// למשל כרטיסי "מלאי סגירה רו״ה" בפקודות מלאי תקופתי.
function NewAccountModal({
  clientId,
  open,
  onClose,
  onCreated,
}: {
  clientId: string;
  open: boolean;
  onClose: () => void;
  onCreated: (account: AccountOption) => void;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function save() {
    if (!code.trim() || !name.trim()) {
      setError("יש למלא קוד ושם.");
      return;
    }
    setSaving(true);
    setError("");
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from("accounts")
      .insert({ client_id: clientId, code: code.trim(), name: name.trim(), is_manual: true })
      .select("id, code, name")
      .single();
    setSaving(false);
    if (err) {
      setError("יצירה נכשלה: " + describeError(err));
      return;
    }
    onCreated(data as AccountOption);
    setCode("");
    setName("");
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-6"
      style={{ background: "rgba(32,30,29,0.45)" }}
      onClick={() => !saving && onClose()}
    >
      <div
        className="w-full max-w-sm rounded-[28px] p-8"
        style={{ background: "var(--card)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-xl font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
          חשבון ידני חדש
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <label className="text-sm font-semibold" style={{ color: "var(--muted)" }}>
            קוד כרטיס
          </label>
          <input
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="rounded-full border-2 px-5 py-2.5 text-lg"
            style={{ borderColor: "var(--border)", background: "var(--background)" }}
          />
        </div>
        <div className="mt-3 flex flex-col gap-2">
          <label className="text-sm font-semibold" style={{ color: "var(--muted)" }}>
            שם החשבון
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-full border-2 px-5 py-2.5 text-lg"
            style={{ borderColor: "var(--border)", background: "var(--background)" }}
          />
        </div>
        {error && (
          <div className="mt-3 text-sm font-semibold" style={{ color: "var(--warn-text)" }}>
            {error}
          </div>
        )}
        <div className="mt-5 flex gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 rounded-full py-2.5 text-lg font-bold text-white disabled:opacity-60"
            style={{ background: "var(--accent)" }}
          >
            {saving ? "יוצר…" : "צור"}
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-full border-2 py-2.5 text-lg font-bold"
            style={{ borderColor: "var(--border)" }}
          >
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}

// בורר חשבון עם חיפוש חופשי (7,000+ חשבונות אצל חלק מהלקוחות — select רגיל לא שימושי) +
// אפשרות ליצור חשבון חדש בלי לצאת מהטופס.
function AccountCombobox({
  clientId,
  accounts,
  value,
  onChange,
  onAccountCreated,
}: {
  clientId: string;
  accounts: AccountOption[];
  value: { accountId: string; label: string };
  onChange: (accountId: string, label: string) => void;
  onAccountCreated: (account: AccountOption) => void;
}) {
  const [query, setQuery] = useState(value.label);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    return accounts.filter((a) => a.code.includes(q) || a.name.includes(q)).slice(0, 30);
  }, [accounts, query]);

  function pick(a: AccountOption) {
    const label = `${a.code} · ${a.name}`;
    setQuery(label);
    onChange(a.id, label);
    setOpen(false);
  }

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (value.accountId) onChange("", "");
        }}
        onFocus={() => setOpen(true)}
        placeholder="חפש לפי קוד או שם…"
        className="w-full rounded-full border-2 px-4 py-2 text-base"
        style={
          value.accountId
            ? { borderColor: "var(--success-border)", background: "var(--card)" }
            : { borderColor: "var(--border)", background: "var(--card)" }
        }
      />
      {open && query.trim() && (
        <div
          className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-2xl border-2 shadow-lg"
          style={{ background: "var(--card)", borderColor: "var(--border)" }}
        >
          {results.map((a) => (
            <button
              key={a.id}
              onClick={() => pick(a)}
              className="block w-full px-4 py-2 text-right text-base hover:opacity-70"
              style={{ borderBottom: "1px solid var(--border-soft)" }}
            >
              <span className="font-mono" style={{ color: "var(--muted)" }}>
                {a.code}
              </span>{" "}
              · {a.name}
            </button>
          ))}
          {results.length === 0 && (
            <div className="p-3 text-base" style={{ color: "var(--muted)" }}>
              לא נמצאו חשבונות תואמים.
            </div>
          )}
          <button
            onClick={() => {
              setCreating(true);
              setOpen(false);
            }}
            className="block w-full px-4 py-2 text-right text-base font-bold"
            style={{ color: "var(--accent-text)" }}
          >
            + חשבון ידני חדש
          </button>
        </div>
      )}
      <NewAccountModal
        clientId={clientId}
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(a) => {
          onAccountCreated(a);
          pick(a);
        }}
      />
    </div>
  );
}

function EntryForm({
  clientId,
  initial,
  accounts,
  onAccountCreated,
  onClose,
  onSaved,
}: {
  clientId: string;
  initial: JournalEntry | null;
  accounts: AccountOption[];
  onAccountCreated: (a: AccountOption) => void;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(initial?.entry_date ?? new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState(initial?.description ?? "");
  const [lines, setLines] = useState<DraftLine[]>(
    initial
      ? initial.lines.map((l) => ({
          key: l.id,
          accountId: l.account_id,
          accountLabel: `${l.account_code} · ${l.account_name}`,
          side: l.side,
          amount: String(l.amount),
        }))
      : [newDraftLine("D"), newDraftLine("C")]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const totalDebit = lines.reduce((s, l) => (l.side === "D" ? s + (Number(l.amount) || 0) : s), 0);
  const totalCredit = lines.reduce((s, l) => (l.side === "C" ? s + (Number(l.amount) || 0) : s), 0);
  const balanced = totalDebit > 0 && Math.round((totalDebit - totalCredit) * 100) === 0;

  function updateLine(key: string, patch: Partial<DraftLine>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function addLine() {
    setLines((ls) => [...ls, newDraftLine(ls.length % 2 === 0 ? "D" : "C")]);
  }

  function removeLine(key: string) {
    setLines((ls) => ls.filter((l) => l.key !== key));
  }

  async function save() {
    if (!balanced) {
      setError("הפקודה לא מאוזנת — סה\"כ חובה חייב להיות שווה לסה\"כ זכות ושונה מאפס.");
      return;
    }
    const payload = lines
      .filter((l) => l.accountId && Number(l.amount) > 0)
      .map((l) => ({ account_id: l.accountId, side: l.side, amount: Number(l.amount) }));
    if (payload.length < 2) {
      setError("צריך לפחות שתי שורות עם חשבון וסכום.");
      return;
    }
    setSaving(true);
    setError("");
    const supabase = createClient();
    const { error: err } = initial
      ? await supabase.rpc("update_journal_entry", {
          p_entry_id: initial.id,
          p_entry_date: date,
          p_description: description,
          p_lines: payload,
        })
      : await supabase.rpc("create_journal_entry", {
          p_client_id: clientId,
          p_entry_date: date,
          p_description: description,
          p_lines: payload,
        });
    setSaving(false);
    if (err) {
      setError("שמירה נכשלה: " + describeError(err));
      return;
    }
    onSaved();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(32,30,29,0.45)" }}
      onClick={() => !saving && onClose()}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-[28px] p-8"
        style={{ background: "var(--card)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-2xl font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
          {initial ? "עריכת פקודת יומן" : "פקודת יומן חדשה"}
        </div>

        <div className="mt-5 flex flex-wrap gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold" style={{ color: "var(--muted)" }}>
              תאריך
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-full border-2 px-4 py-2 text-lg"
              style={{ borderColor: "var(--border)", background: "var(--background)" }}
            />
          </div>
          <div className="flex flex-1 min-w-[220px] flex-col gap-2">
            <label className="text-sm font-semibold" style={{ color: "var(--muted)" }}>
              תיאור
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-full border-2 px-4 py-2 text-lg"
              style={{ borderColor: "var(--border)", background: "var(--background)" }}
            />
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          {lines.map((l) => (
            <div key={l.key} className="flex items-center gap-2">
              <div className="flex-1">
                <AccountCombobox
                  clientId={clientId}
                  accounts={accounts}
                  value={{ accountId: l.accountId, label: l.accountLabel }}
                  onChange={(accountId, label) => updateLine(l.key, { accountId, accountLabel: label })}
                  onAccountCreated={onAccountCreated}
                />
              </div>
              <select
                value={l.side}
                onChange={(e) => updateLine(l.key, { side: e.target.value as "D" | "C" })}
                className="rounded-full border-2 px-3 py-2 text-base"
                style={{ borderColor: "var(--border)", background: "var(--background)" }}
              >
                <option value="D">חובה</option>
                <option value="C">זכות</option>
              </select>
              <input
                type="number"
                value={l.amount}
                onChange={(e) => updateLine(l.key, { amount: e.target.value })}
                placeholder="סכום"
                className="w-32 rounded-full border-2 px-4 py-2 text-base tabular-nums"
                style={{ borderColor: "var(--border)", background: "var(--background)" }}
              />
              <button
                onClick={() => removeLine(l.key)}
                disabled={lines.length <= 2}
                className="flex h-9 w-9 items-center justify-center rounded-full border-2 text-lg font-bold disabled:opacity-30"
                style={{ borderColor: "var(--border)", color: "var(--muted)" }}
              >
                ×
              </button>
            </div>
          ))}
          <button
            onClick={addLine}
            className="w-fit rounded-full border-2 px-5 py-2 text-base font-bold"
            style={{ borderColor: "var(--border)", color: "var(--accent-text)" }}
          >
            + שורה
          </button>
        </div>

        <div
          className="mt-5 flex items-center justify-between rounded-2xl p-4 text-lg font-bold"
          style={
            balanced
              ? { background: "var(--success-soft)", color: "var(--success-text)" }
              : { background: "var(--warn-soft)", color: "var(--warn-text)" }
          }
        >
          <span>{balanced ? "מאוזן ✓" : "לא מאוזן"}</span>
          <div className="flex gap-6 tabular-nums text-base">
            <span>חובה: {formatAmount(totalDebit)}</span>
            <span>זכות: {formatAmount(totalCredit)}</span>
          </div>
        </div>

        {error && (
          <div className="mt-4 text-base font-semibold" style={{ color: "var(--warn-text)" }}>
            {error}
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            onClick={save}
            disabled={saving || !balanced}
            className="flex-1 rounded-full py-3 text-lg font-bold text-white disabled:opacity-60"
            style={{ background: "var(--accent)" }}
          >
            {saving ? "שומר…" : "שמור"}
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 rounded-full border-2 py-3 text-lg font-bold"
            style={{ borderColor: "var(--border)" }}
          >
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}

export function JournalEntriesTable({
  clientId,
  entries,
  accounts: initialAccounts,
}: {
  clientId: string;
  entries: JournalEntry[];
  accounts: AccountOption[];
}) {
  const router = useRouter();
  const [accounts, setAccounts] = useState(initialAccounts);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<JournalEntry | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpanded(id: string) {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onAccountCreated(a: AccountOption) {
    setAccounts((list) => [...list, a].sort((x, y) => x.code.localeCompare(y.code)));
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
  }

  function saved() {
    closeForm();
    router.refresh();
  }

  async function removeEntry(entry: JournalEntry) {
    const supabase = createClient();
    const { error } = await supabase.from("journal_entries").delete().eq("id", entry.id);
    if (error) throw new Error(describeError(error));
    router.refresh();
  }

  return (
    <div className="rounded-[28px] border-2 p-8" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between">
        <div className="text-2xl font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
          פקודות יומן
        </div>
        <button
          onClick={() => setFormOpen(true)}
          className="rounded-full px-6 py-3 text-lg font-bold text-white"
          style={{ background: "var(--accent)" }}
        >
          + פקודת יומן חדשה
        </button>
      </div>

      {entries.length === 0 && (
        <div className="mt-6 text-lg" style={{ color: "var(--muted)" }}>
          אין עדיין פקודות יומן. לחץ &quot;+ פקודת יומן חדשה&quot; כדי להתחיל.
        </div>
      )}

      {entries.length > 0 && (
        <table className="mt-6 w-full border-collapse text-lg">
          <thead>
            <tr style={{ background: "var(--background)" }}>
              <th className="w-32 p-3 text-right text-sm" style={{ color: "var(--muted)" }}>
                תאריך
              </th>
              <th className="p-3 text-right text-sm" style={{ color: "var(--muted)" }}>
                תיאור
              </th>
              <th className="w-32 p-3 text-left text-sm" style={{ color: "var(--muted)" }}>
                סכום
              </th>
              <th className="w-64 p-3"></th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const total = entry.lines.filter((l) => l.side === "D").reduce((s, l) => s + l.amount, 0);
              return (
                <Fragment key={entry.id}>
                  <tr style={{ borderBottom: expanded.has(entry.id) ? "none" : "1.5px solid var(--border-soft)" }}>
                    <td className="p-3 tabular-nums">{entry.entry_date.split("-").reverse().join("/")}</td>
                    <td className="p-3">{entry.description || "—"}</td>
                    <td className="p-3 text-left font-semibold tabular-nums">{formatAmount(total)}</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => toggleExpanded(entry.id)}
                          className="rounded-full border-2 px-4 py-2 text-base font-bold"
                          style={{ borderColor: "var(--border)", color: "var(--muted)" }}
                        >
                          {expanded.has(entry.id) ? "▲" : "▼"} שורות ({entry.lines.length})
                        </button>
                        <button
                          onClick={() => setEditing(entry)}
                          className="rounded-full border-2 px-5 py-2 text-base font-bold"
                          style={{ borderColor: "var(--accent)", color: "var(--accent-text)" }}
                        >
                          עריכה
                        </button>
                        <ConfirmDeleteButton
                          title="מחיקת פקודת יומן"
                          message={`למחוק את פקודת היומן מ-${entry.entry_date.split("-").reverse().join("/")}? כל התנועות שהיא יצרה יימחקו.`}
                          onConfirm={() => removeEntry(entry)}
                        />
                      </div>
                    </td>
                  </tr>
                  {expanded.has(entry.id) && (
                    <tr style={{ borderBottom: "1.5px solid var(--border-soft)" }}>
                      <td colSpan={4} className="p-3 pt-0">
                        <table className="mr-8 w-[calc(100%-2rem)] border-collapse text-base">
                          <tbody>
                            {entry.lines.map((l) => (
                              <tr key={l.id} style={{ borderBottom: "1px solid var(--border-soft)" }}>
                                <td className="p-2 font-mono" style={{ color: "var(--muted)" }}>
                                  {l.account_code}
                                </td>
                                <td className="p-2">{l.account_name}</td>
                                <td className="p-2">{l.side === "D" ? "חובה" : "זכות"}</td>
                                <td className="p-2 text-left tabular-nums">{formatAmount(l.amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      )}

      {(formOpen || editing) && (
        <EntryForm
          clientId={clientId}
          initial={editing}
          accounts={accounts}
          onAccountCreated={onAccountCreated}
          onClose={closeForm}
          onSaved={saved}
        />
      )}
    </div>
  );
}
