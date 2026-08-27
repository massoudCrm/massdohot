"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { formatSourceGroupCode } from "@/lib/format";
import { AssignmentOptions, assignmentValue, parseAssignmentValue, type NoteOption } from "./trial-balance-table";

export interface SortRule {
  id: string;
  from_code: string | null;
  to_code: string | null;
  note_id: string;
  sub_note_id: string | null;
  source_group_code: string | null;
}

export interface SourceGroup {
  code: string;
  desc: string;
  count: number;
}

export function SortRulesPanel({
  clientId,
  rules,
  notes,
  sourceGroups,
}: {
  clientId: string;
  rules: SortRule[];
  notes: NoteOption[];
  sourceGroups: SourceGroup[];
}) {
  const router = useRouter();
  const [applying, setApplying] = useState<"unassigned" | "all" | null>(null);
  const [status, setStatus] = useState("");
  const [newGroupCode, setNewGroupCode] = useState("");
  const [addingGroupRule, setAddingGroupRule] = useState(false);

  async function addRangeRule() {
    if (notes.length === 0) return;
    const supabase = createClient();
    await supabase.from("sort_rules").insert({
      client_id: clientId,
      from_code: "",
      to_code: "",
      note_id: notes[0].id,
      sub_note_id: null,
      source_group_code: null,
    });
    router.refresh();
  }

  async function addGroupRule() {
    if (!newGroupCode || notes.length === 0) return;
    setAddingGroupRule(true);
    const supabase = createClient();
    await supabase.from("sort_rules").insert({
      client_id: clientId,
      from_code: null,
      to_code: null,
      source_group_code: newGroupCode,
      note_id: notes[0].id,
      sub_note_id: null,
    });
    setAddingGroupRule(false);
    setNewGroupCode("");
    router.refresh();
  }

  async function updateRule(
    id: string,
    patch: Partial<Pick<SortRule, "from_code" | "to_code" | "note_id" | "sub_note_id">>
  ) {
    const supabase = createClient();
    await supabase.from("sort_rules").update(patch).eq("id", id);
    router.refresh();
  }

  async function removeRule(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("sort_rules").delete().eq("id", id);
    if (error) throw new Error(error.message);
    router.refresh();
  }

  async function apply(onlyUnassigned: boolean) {
    setApplying(onlyUnassigned ? "unassigned" : "all");
    setStatus("");
    const supabase = createClient();
    const { data, error } = await supabase.rpc("apply_sort_rules", {
      p_client_id: clientId,
      p_only_unassigned: onlyUnassigned,
    });
    setApplying(null);
    if (error) {
      setStatus("ההחלה נכשלה: " + error.message);
      return;
    }
    setStatus(`הכללים הוחלו — ${Number(data).toLocaleString("he-IL")} חשבונות עודכנו.`);
    router.refresh();
  }

  const usedGroupCodes = new Set(rules.map((r) => r.source_group_code).filter(Boolean));
  const availableGroups = sourceGroups.filter((g) => !usedGroupCodes.has(g.code));

  return (
    <div className="flex flex-col gap-6">
      {sourceGroups.length > 0 && (
        <div className="rounded-[28px] border-2 p-6" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <div className="text-xl font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
            כלל לפי קוד מיון מהקובץ
          </div>
          <div className="mt-2 text-base" style={{ color: "var(--muted)" }}>
            תוכנת ההנה&quot;ח כבר קיבצה חשבונות תחת קודים כאלה (למשל &quot;לקוחות&quot;). זו הדרך הכי אמינה למיין — עדיפה על טווח כרטיסים.
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <select
              value={newGroupCode}
              onChange={(e) => setNewGroupCode(e.target.value)}
              className="flex-1 min-w-[220px] rounded-full border-2 px-4 py-2.5 text-base"
              style={{ borderColor: "var(--border)", background: "var(--background)" }}
            >
              <option value="">בחר קוד מיון…</option>
              {availableGroups.map((g) => (
                <option key={g.code} value={g.code}>
                  {formatSourceGroupCode(g.code)} · {g.desc} ({g.count.toLocaleString("he-IL")} חשבונות)
                </option>
              ))}
            </select>
            <button
              onClick={addGroupRule}
              disabled={!newGroupCode || addingGroupRule}
              className="rounded-full px-5 py-2.5 text-base font-bold text-white disabled:opacity-60"
              style={{ background: "var(--accent)" }}
            >
              + כלל
            </button>
          </div>
        </div>
      )}

      <div className="rounded-[28px] border-2 p-6" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
        <div className="text-xl font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
          כללי מיון
        </div>
        <div className="mt-2 text-base" style={{ color: "var(--muted)" }}>
          לפי קוד מיון מהקובץ, או לפי טווח כרטיסים ידני.
        </div>

        <div className="mt-4 flex flex-col gap-3">
          {rules.map((r) => {
            const group = sourceGroups.find((g) => g.code === r.source_group_code);
            return (
              <div
                key={r.id}
                className="rounded-2xl border-2 p-3"
                style={{ background: "var(--background)", borderColor: "var(--border-soft)" }}
              >
                <div className="flex flex-wrap items-center gap-2">
                  {r.source_group_code ? (
                    <span className="text-base font-bold" style={{ color: "var(--accent-text)" }}>
                      קוד מיון {formatSourceGroupCode(r.source_group_code)} · {group?.desc ?? ""}
                    </span>
                  ) : (
                    <>
                      <span className="text-sm font-semibold" style={{ color: "var(--muted)" }}>
                        מכרטיס
                      </span>
                      <input
                        defaultValue={r.from_code ?? ""}
                        onBlur={(e) => e.target.value !== r.from_code && updateRule(r.id, { from_code: e.target.value })}
                        className="w-24 rounded-full border-2 px-3 py-1.5 text-base tabular-nums"
                        style={{ borderColor: "var(--border)", background: "var(--card)" }}
                      />
                      <span className="text-sm font-semibold" style={{ color: "var(--muted)" }}>
                        עד
                      </span>
                      <input
                        defaultValue={r.to_code ?? ""}
                        onBlur={(e) => e.target.value !== r.to_code && updateRule(r.id, { to_code: e.target.value })}
                        className="w-24 rounded-full border-2 px-3 py-1.5 text-base tabular-nums"
                        style={{ borderColor: "var(--border)", background: "var(--card)" }}
                      />
                    </>
                  )}
                  <ConfirmDeleteButton
                    label="×"
                    title="מחיקת כלל"
                    message="למחוק את כלל המיון הזה?"
                    onConfirm={() => removeRule(r.id)}
                    className="mr-auto flex h-9 w-9 items-center justify-center rounded-full border-2 text-lg font-bold"
                    style={{ borderColor: "var(--border)", color: "var(--accent-text)" }}
                  />
                </div>
                <select
                  defaultValue={assignmentValue({ noteId: r.note_id, subNoteId: r.sub_note_id })}
                  onChange={(e) => {
                    const a = parseAssignmentValue(e.target.value, notes);
                    if (!a.noteId) return;
                    updateRule(r.id, { note_id: a.noteId, sub_note_id: a.subNoteId });
                  }}
                  className="mt-2 w-full rounded-full border-2 px-3 py-2 text-base"
                  style={{ borderColor: "var(--border)", background: "var(--card)" }}
                >
                  <AssignmentOptions notes={notes} />
                </select>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={addRangeRule}
            disabled={notes.length === 0}
            className="rounded-full border-2 px-5 py-2.5 text-base font-bold disabled:opacity-50"
            style={{ borderColor: "var(--border)", color: "var(--accent-text)" }}
          >
            + כלל טווח כרטיסים
          </button>
          <button
            onClick={() => apply(true)}
            disabled={rules.length === 0 || applying !== null}
            className="rounded-full px-5 py-2.5 text-base font-bold text-white disabled:opacity-60"
            style={{ background: "var(--success)" }}
          >
            {applying === "unassigned" ? "מחיל…" : "החל על לא מוינו"}
          </button>
          <button
            onClick={() => apply(false)}
            disabled={rules.length === 0 || applying !== null}
            className="rounded-full border-2 px-5 py-2.5 text-base font-bold disabled:opacity-60"
            style={{ borderColor: "var(--success-border)", color: "var(--success-text)" }}
          >
            {applying === "all" ? "מחיל…" : "החל על הכל"}
          </button>
        </div>

        {notes.length === 0 && (
          <div className="mt-3 text-sm" style={{ color: "var(--muted)" }}>
            צריך קודם ליצור ביאורים במסך &quot;ביאורים&quot; כדי להגדיר כללים.
          </div>
        )}
        {status && <div className="mt-3 text-base font-semibold">{status}</div>}
      </div>
    </div>
  );
}
