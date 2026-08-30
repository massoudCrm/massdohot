"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatAmount, formatSourceGroupCode, describeError } from "@/lib/format";

export interface TbRow {
  accountId: string;
  code: string;
  name: string;
  noteId: string | null;
  subNoteId: string | null;
  sourceGroupCode: string | null;
  sourceGroupDesc: string | null;
  curr: number;
  prev: number;
  // true כשאין שיוך ביאור וגם קוד המיון של החשבון עדיין לא סווג מאזני/תוצאתי — ראו
  // "סיווג קודי מיון" ב-source-group-classification-panel.tsx. לא ניחוש: מסומן לתשומת לב.
  unclassified: boolean;
}

export interface SubNoteOption {
  id: string;
  noteId: string;
  label: string;
}

export interface NoteOption {
  id: string;
  label: string;
  subNotes: SubNoteOption[];
}

type Filter = "all" | "unassigned" | "assigned";

export interface Assignment {
  noteId: string | null;
  subNoteId: string | null;
}

export function parseAssignmentValue(value: string, notes: NoteOption[]): Assignment {
  if (!value) return { noteId: null, subNoteId: null };
  if (value.startsWith("sub:")) {
    const subId = value.slice(4);
    const parent = notes.find((n) => n.subNotes.some((sn) => sn.id === subId));
    return { noteId: parent?.id ?? null, subNoteId: subId };
  }
  return { noteId: value.slice(5), subNoteId: null };
}

export function assignmentValue(a: Assignment): string {
  if (a.subNoteId) return `sub:${a.subNoteId}`;
  if (a.noteId) return `note:${a.noteId}`;
  return "";
}

export function AssignmentOptions({ notes }: { notes: NoteOption[] }) {
  return (
    <>
      {notes.map((n) => (
        <optgroup key={n.id} label={n.label}>
          <option value={`note:${n.id}`}>{n.label} (כללי)</option>
          {n.subNotes.map((sn) => (
            <option key={sn.id} value={`sub:${sn.id}`}>
              {"↳ " + sn.label}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );
}

const NEW_SUB_NOTE = "__new_sub_note__";

// מודל ליצירת תת-ביאור מבלי לצאת ממסך המיון — נפתח כשבוחרים "+ תת-ביאור חדש" בתוך תפריט הביאור,
// יוצר את תת-הביאור ומיד משייך אליו את השורה/השורות שנבחרו.
function CreateSubNoteModal({
  open,
  notes,
  defaultNoteId,
  onClose,
  onCreated,
}: {
  open: boolean;
  notes: NoteOption[];
  defaultNoteId: string;
  onClose: () => void;
  onCreated: (parentNoteId: string, subNote: SubNoteOption) => void;
}) {
  const [parentId, setParentId] = useState(defaultNoteId);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setParentId(defaultNoteId);
      setName("");
      setError("");
    }
  }, [open, defaultNoteId]);

  if (!open) return null;

  async function save() {
    if (!parentId) {
      setError("יש לבחור תחת איזה ביאור ליצור את תת-הביאור.");
      return;
    }
    if (!name.trim()) {
      setError("יש להזין שם.");
      return;
    }
    setSaving(true);
    setError("");
    const parent = notes.find((n) => n.id === parentId);
    const supabase = createClient();
    const { data, error: err } = await supabase
      .from("sub_notes")
      .insert({ note_id: parentId, name: name.trim(), sort_order: parent?.subNotes.length ?? 0 })
      .select("id")
      .single();
    setSaving(false);
    if (err || !data) {
      setError("יצירה נכשלה: " + describeError(err));
      return;
    }
    onCreated(parentId, { id: data.id as string, noteId: parentId, label: name.trim() });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(32,30,29,0.45)" }}
      onClick={() => !saving && onClose()}
    >
      <div
        className="w-full max-w-md rounded-[28px] p-8"
        style={{ background: "var(--card)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-2xl font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
          תת-ביאור חדש
        </div>
        <div className="mt-5 flex flex-col gap-2">
          <label className="text-base font-semibold" style={{ color: "var(--muted)" }}>
            תחת איזה ביאור
          </label>
          <select
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            className="rounded-full border-2 px-5 py-3 text-lg"
            style={{ borderColor: "var(--border)", background: "var(--background)" }}
          >
            <option value="">בחר ביאור…</option>
            {notes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.label}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <label className="text-base font-semibold" style={{ color: "var(--muted)" }}>
            שם תת-הביאור
          </label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-full border-2 px-5 py-3 text-lg"
            style={{ borderColor: "var(--border)", background: "var(--background)" }}
          />
        </div>
        {error && (
          <div className="mt-4 text-base font-semibold" style={{ color: "var(--warn-text)" }}>
            {error}
          </div>
        )}
        <div className="mt-6 flex gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 rounded-full py-3 text-lg font-bold text-white disabled:opacity-60"
            style={{ background: "var(--accent)" }}
          >
            {saving ? "יוצר…" : "צור ושייך"}
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

export function TrialBalanceTable({
  clientId,
  rows,
  notes,
  currLabel,
  prevLabel,
  totalCurr,
  totalPrev,
}: {
  clientId: string;
  rows: TbRow[];
  notes: NoteOption[];
  currLabel: string;
  prevLabel: string;
  totalCurr: number;
  totalPrev: number;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [hideZero, setHideZero] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkValue, setBulkValue] = useState("");
  const [assigning, setAssigning] = useState(false);
  // מצב אופטימי מקומי לשיוך ביאור/תת-ביאור, כדי שהטבלה תתעדכן מיד בלי לחכות לרענון מהשרת
  const [assignOverride, setAssignOverride] = useState<Record<string, Assignment>>({});
  // עותק מקומי של רשימת הביאורים, כדי שתת-ביאור שנוצר עכשיו יופיע מיד ברשימה בלי לחכות לרענון מהשרת
  const [localNotes, setLocalNotes] = useState(notes);
  useEffect(() => setLocalNotes(notes), [notes]);
  // איפה לפתוח את מודל "תת-ביאור חדש": לשורה בודדת, או לכל השורות המסומנות
  const [newSubNoteTarget, setNewSubNoteTarget] = useState<
    { scope: "row"; accountId: string; defaultNoteId: string } | { scope: "bulk"; defaultNoteId: string } | null
  >(null);

  const assignmentOf = (r: TbRow): Assignment =>
    r.accountId in assignOverride ? assignOverride[r.accountId] : { noteId: r.noteId, subNoteId: r.subNoteId };
  const noteIdOf = (r: TbRow) => assignmentOf(r).noteId;

  const filtered = useMemo(() => {
    const q = search.trim();
    return rows.filter((r) => {
      const noteId = noteIdOf(r);
      if (filter === "unassigned" && noteId) return false;
      if (filter === "assigned" && !noteId) return false;
      if (hideZero && Math.round(r.curr) === 0 && Math.round(r.prev) === 0) return false;
      if (q && !r.name.includes(q) && !r.code.includes(q)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, search, hideZero, filter, assignOverride]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.accountId));

  function toggleAll() {
    setSelected((s) => {
      if (allFilteredSelected) return new Set();
      const next = new Set(s);
      filtered.forEach((r) => next.add(r.accountId));
      return next;
    });
  }

  function toggleOne(accountId: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      return next;
    });
  }

  async function setRowAssignment(accountId: string, value: string) {
    const assignment = parseAssignmentValue(value, localNotes);
    setAssignOverride((s) => ({ ...s, [accountId]: assignment }));
    const supabase = createClient();
    await supabase
      .from("accounts")
      .update({ note_id: assignment.noteId, sub_note_id: assignment.subNoteId })
      .eq("id", accountId);
    router.refresh();
  }

  function handleRowSelectChange(r: TbRow, value: string) {
    if (value === NEW_SUB_NOTE) {
      setNewSubNoteTarget({ scope: "row", accountId: r.accountId, defaultNoteId: assignmentOf(r).noteId ?? "" });
      return;
    }
    setRowAssignment(r.accountId, value);
  }

  async function applyAssignmentToSelected(value: string) {
    if (!value || selected.size === 0) return;
    const assignment = parseAssignmentValue(value, localNotes);
    setAssigning(true);
    const ids = [...selected];
    setAssignOverride((s) => {
      const next = { ...s };
      ids.forEach((id) => (next[id] = assignment));
      return next;
    });
    const supabase = createClient();
    await supabase
      .from("accounts")
      .update({ note_id: assignment.noteId, sub_note_id: assignment.subNoteId })
      .in("id", ids);
    setAssigning(false);
    setSelected(new Set());
    setBulkValue("");
    router.refresh();
  }

  async function applyBulk() {
    await applyAssignmentToSelected(bulkValue);
  }

  function handleBulkSelectChange(value: string) {
    if (value === NEW_SUB_NOTE) {
      setNewSubNoteTarget({ scope: "bulk", defaultNoteId: "" });
      return;
    }
    setBulkValue(value);
  }

  function handleSubNoteCreated(parentNoteId: string, subNote: SubNoteOption) {
    setLocalNotes((prev) => prev.map((n) => (n.id === parentNoteId ? { ...n, subNotes: [...n.subNotes, subNote] } : n)));
    const value = assignmentValue({ noteId: parentNoteId, subNoteId: subNote.id });
    const target = newSubNoteTarget;
    setNewSubNoteTarget(null);
    if (target?.scope === "row") {
      setRowAssignment(target.accountId, value);
    } else if (target?.scope === "bulk") {
      applyAssignmentToSelected(value);
    }
  }

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
        <div className="flex gap-2">
          {(
            [
              ["all", "הכל"],
              ["unassigned", "לא מוינו"],
              ["assigned", "מוינו"],
            ] as [Filter, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className="rounded-full border-2 px-5 py-2 text-base font-bold"
              style={
                filter === key
                  ? { background: "var(--success)", borderColor: "var(--success)", color: "white" }
                  : { background: "var(--background)", borderColor: "var(--border)", color: "var(--muted)" }
              }
            >
              {label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-base font-semibold" style={{ color: "var(--muted)" }}>
          <input type="checkbox" checked={hideZero} onChange={(e) => setHideZero(e.target.checked)} />
          הסתר יתרות אפס
        </label>
        <span className="mr-auto text-base font-semibold" style={{ color: "var(--muted)" }}>
          מציג {filtered.length.toLocaleString("he-IL")} מתוך {rows.length.toLocaleString("he-IL")}
        </span>
      </div>

      {selected.size > 0 && (
        <div
          className="mx-6 mb-4 flex flex-wrap items-center gap-3 rounded-2xl p-4"
          style={{ background: "var(--background)" }}
        >
          <span className="text-base font-bold">סומנו {selected.size.toLocaleString("he-IL")} שורות</span>
          <select
            value={bulkValue}
            onChange={(e) => handleBulkSelectChange(e.target.value)}
            className="min-w-[220px] rounded-full border-2 px-4 py-2 text-base"
            style={{ borderColor: "var(--border)", background: "var(--card)" }}
          >
            <option value="">הקצה את הסימון לביאור…</option>
            <option value={NEW_SUB_NOTE}>+ תת-ביאור חדש…</option>
            <AssignmentOptions notes={localNotes} />
          </select>
          <button
            onClick={applyBulk}
            disabled={!bulkValue || assigning}
            className="rounded-full px-6 py-2 text-base font-bold text-white disabled:opacity-60"
            style={{ background: "var(--accent)" }}
          >
            {assigning ? "מקצה…" : "הקצה"}
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="rounded-full border-2 px-5 py-2 text-base font-bold"
            style={{ borderColor: "var(--border)" }}
          >
            בטל סימון
          </button>
        </div>
      )}

      <div className="max-h-[620px] overflow-auto px-6 pb-6">
        <table className="w-full border-collapse text-lg">
          <thead>
            <tr style={{ background: "var(--background)", position: "sticky", top: 0 }}>
              <th className="w-10 p-3">
                <input type="checkbox" checked={allFilteredSelected} onChange={toggleAll} />
              </th>
              <th className="p-3 text-right text-sm" style={{ color: "var(--muted)" }}>
                כרטיס
              </th>
              <th className="p-3 text-right text-sm" style={{ color: "var(--muted)" }}>
                שם החשבון
              </th>
              <th className="w-40 p-3 text-right text-sm" style={{ color: "var(--muted)" }}>
                קוד מיון
              </th>
              <th className="p-3 text-left text-sm" style={{ color: "var(--muted)" }}>
                {currLabel}
              </th>
              <th className="p-3 text-left text-sm" style={{ color: "var(--muted)" }}>
                {prevLabel}
              </th>
              <th className="w-64 p-3 text-right text-sm" style={{ color: "var(--muted)" }}>
                ביאור
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const assignment = assignmentOf(r);
              const noteId = assignment.noteId ?? "";
              const value = assignmentValue(assignment);
              return (
                <tr
                  key={r.accountId}
                  style={{
                    borderBottom: "1.5px solid var(--border-soft)",
                    background: r.unclassified
                      ? "#ffe3e3"
                      : !noteId
                      ? "#fff2eb"
                      : selected.has(r.accountId)
                      ? "var(--success-soft)"
                      : "transparent",
                  }}
                >
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selected.has(r.accountId)}
                      onChange={() => toggleOne(r.accountId)}
                    />
                  </td>
                  <td className="p-3 font-mono text-base" style={{ color: "var(--muted)" }}>
                    {r.code}
                  </td>
                  <td className="p-3 font-semibold">{r.name}</td>
                  <td className="p-3 text-sm" style={{ color: "var(--muted)" }}>
                    {r.sourceGroupCode ? `${formatSourceGroupCode(r.sourceGroupCode)} · ${r.sourceGroupDesc ?? ""}` : "—"}
                  </td>
                  <td className="p-3 text-left font-bold tabular-nums">{formatAmount(r.curr)}</td>
                  <td className="p-3 text-left tabular-nums" style={{ color: "var(--muted)" }}>
                    {formatAmount(r.prev)}
                  </td>
                  <td className="p-3">
                    <select
                      value={value}
                      onChange={(e) => handleRowSelectChange(r, e.target.value)}
                      className="w-full rounded-full border-2 px-3 py-2 text-base"
                      style={
                        noteId
                          ? { borderColor: "var(--border)", background: "var(--card)" }
                          : { borderColor: "var(--accent)", background: "var(--card)", color: "var(--accent-text)" }
                      }
                    >
                      <option value="">— לא מוין —</option>
                      <option value={NEW_SUB_NOTE}>+ תת-ביאור חדש…</option>
                      <AssignmentOptions notes={localNotes} />
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: "3px solid var(--border)" }}>
              <td colSpan={4} className="p-4 text-xl font-extrabold">
                סה&quot;כ מאזן בוחן
              </td>
              <td className="p-4 text-left text-xl font-extrabold tabular-nums">{formatAmount(totalCurr)}</td>
              <td className="p-4 text-left text-xl font-extrabold tabular-nums">{formatAmount(totalPrev)}</td>
              <td></td>
            </tr>
            {(Math.round(totalCurr) !== 0 || Math.round(totalPrev) !== 0) && (
              <tr>
                <td colSpan={7} className="px-4 pb-3 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
                  ההפרש מהאיפוס אינו טעות בחישוב — הוא נובע מפעילות רווח והפסד של שנים קודמות
                  שטרם &quot;נסגרה&quot; בהנהלת החשבונות. סעיפי רווח והפסד מוצגים כאן לפי תנועת התקופה
                  הנבחרת בלבד, בעוד סעיפי מאזן מצטברים מאז תחילת הנתונים — לבדיקת איזון אמיתית
                  ולנתוני רווח והפסד מדויקים, ראו את מסכי &quot;מאזן&quot; ו&quot;רווח והפסד&quot;.
                </td>
              </tr>
            )}
          </tfoot>
        </table>
      </div>

      <CreateSubNoteModal
        open={newSubNoteTarget !== null}
        notes={localNotes}
        defaultNoteId={newSubNoteTarget?.defaultNoteId ?? ""}
        onClose={() => setNewSubNoteTarget(null)}
        onCreated={handleSubNoteCreated}
      />
    </div>
  );
}
