"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";

export interface ReportGroup {
  id: string;
  statement: "bs" | "pl";
  side: "assets" | "liabilities_equity" | null;
  name: string;
  sort_order: number;
}

function RenameModal({
  open,
  onClose,
  name,
  setName,
  onSave,
  saving,
  error,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  setName: (v: string) => void;
  onSave: () => void;
  saving: boolean;
  error: string;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: "rgba(32,30,29,0.45)" }}
      onClick={() => !saving && onClose()}
    >
      <div
        className="w-full max-w-sm rounded-[28px] p-8"
        style={{ background: "var(--card)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-xl font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
          שם הקבוצה
        </div>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-4 w-full rounded-full border-2 px-5 py-3 text-lg"
          style={{ borderColor: "var(--border)", background: "var(--background)" }}
        />
        {error && (
          <div className="mt-3 text-base font-semibold" style={{ color: "var(--warn-text)" }}>
            {error}
          </div>
        )}
        <div className="mt-5 flex gap-3">
          <button
            onClick={onSave}
            disabled={saving}
            className="flex-1 rounded-full py-2.5 text-lg font-bold text-white disabled:opacity-60"
            style={{ background: "var(--accent)" }}
          >
            {saving ? "שומר…" : "שמור"}
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

function GroupPill({
  group,
  prev,
  next,
  noteCount,
  onChanged,
}: {
  group: ReportGroup;
  prev: ReportGroup | null;
  next: ReportGroup | null;
  noteCount: number;
  onChanged: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(group.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function swapWith(other: ReportGroup | null) {
    if (!other) return;
    const supabase = createClient();
    await Promise.all([
      supabase.from("report_groups").update({ sort_order: other.sort_order }).eq("id", group.id),
      supabase.from("report_groups").update({ sort_order: group.sort_order }).eq("id", other.id),
    ]);
    onChanged();
  }

  async function saveRename() {
    if (!name.trim()) {
      setError("יש להזין שם.");
      return;
    }
    setSaving(true);
    setError("");
    const supabase = createClient();
    const { error: err } = await supabase.rpc("rename_report_group", {
      p_group_id: group.id,
      p_new_name: name.trim(),
    });
    setSaving(false);
    if (err) {
      setError("שמירה נכשלה: " + err.message);
      return;
    }
    setRenaming(false);
    onChanged();
  }

  async function remove() {
    const supabase = createClient();
    const { error } = await supabase.from("report_groups").delete().eq("id", group.id);
    if (error) throw new Error(error.message);
    onChanged();
  }

  return (
    <div
      className="flex items-center gap-2 rounded-full border-2 py-1.5 pr-2 pl-4"
      style={{ borderColor: "var(--border)", background: "var(--background)" }}
    >
      <div className="flex flex-col">
        <button
          onClick={() => swapWith(prev)}
          disabled={!prev}
          className="leading-none disabled:opacity-25"
          style={{ color: "var(--muted)" }}
        >
          ▲
        </button>
        <button
          onClick={() => swapWith(next)}
          disabled={!next}
          className="leading-none disabled:opacity-25"
          style={{ color: "var(--muted)" }}
        >
          ▼
        </button>
      </div>
      <span className="text-base font-semibold">{group.name}</span>
      {group.side && (
        <span
          className="rounded-full px-2 py-0.5 text-xs font-bold"
          style={{ background: "var(--success-soft)", color: "var(--success-text)" }}
        >
          {group.side === "assets" ? "נכסים" : "התחייבויות והון"}
        </span>
      )}
      <span className="text-xs" style={{ color: "var(--muted)" }}>
        {noteCount > 0 ? `${noteCount} ביאורים` : ""}
      </span>
      <button
        onClick={() => {
          setName(group.name);
          setError("");
          setRenaming(true);
        }}
        className="text-sm font-bold"
        style={{ color: "var(--accent-text)" }}
      >
        עריכה
      </button>
      <ConfirmDeleteButton
        label="×"
        title="מחיקת קבוצה"
        message={
          noteCount > 0
            ? `לקבוצה "${group.name}" משויכים ${noteCount} ביאורים. מחיקת הקבוצה לא תמחק אותם, אבל תצטרך לשייך אותם מחדש לקבוצה אחרת.`
            : `למחוק את הקבוצה "${group.name}"?`
        }
        onConfirm={remove}
        className="flex h-6 w-6 items-center justify-center rounded-full text-base font-bold"
        style={{ color: "var(--muted)" }}
      />
      <RenameModal
        open={renaming}
        onClose={() => setRenaming(false)}
        name={name}
        setName={setName}
        onSave={saveRename}
        saving={saving}
        error={error}
      />
    </div>
  );
}

function AddGroupButton({
  clientId,
  statement,
  nextSortOrder,
  onAdded,
}: {
  clientId: string;
  statement: "bs" | "pl";
  nextSortOrder: number;
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [side, setSide] = useState<"assets" | "liabilities_equity">("assets");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!name.trim()) {
      setError("יש להזין שם.");
      return;
    }
    setSaving(true);
    setError("");
    const supabase = createClient();
    const { error: err } = await supabase.from("report_groups").insert({
      client_id: clientId,
      statement,
      side: statement === "bs" ? side : null,
      name: name.trim(),
      sort_order: nextSortOrder,
    });
    setSaving(false);
    if (err) {
      setError("יצירה נכשלה: " + err.message);
      return;
    }
    setOpen(false);
    setName("");
    onAdded();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-full border-2 px-4 py-1.5 text-sm font-bold"
        style={{ borderColor: "var(--border)", color: "var(--accent-text)" }}
      >
        + קבוצה
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: "rgba(32,30,29,0.45)" }}
          onClick={() => !saving && setOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-[28px] p-8"
            style={{ background: "var(--card)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-xl font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
              קבוצה חדשה
            </div>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="שם הקבוצה"
              className="mt-4 w-full rounded-full border-2 px-5 py-3 text-lg"
              style={{ borderColor: "var(--border)", background: "var(--background)" }}
            />
            {statement === "bs" && (
              <div className="mt-4 flex flex-col gap-2">
                <label className="text-sm font-semibold" style={{ color: "var(--muted)" }}>
                  צד במאזן
                </label>
                <select
                  value={side}
                  onChange={(e) => setSide(e.target.value as "assets" | "liabilities_equity")}
                  className="rounded-full border-2 px-5 py-2.5 text-base"
                  style={{ borderColor: "var(--border)", background: "var(--background)" }}
                >
                  <option value="assets">נכסים</option>
                  <option value="liabilities_equity">התחייבויות והון</option>
                </select>
              </div>
            )}
            {error && (
              <div className="mt-3 text-base font-semibold" style={{ color: "var(--warn-text)" }}>
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
                {saving ? "שומר…" : "צור"}
              </button>
              <button
                onClick={() => setOpen(false)}
                disabled={saving}
                className="flex-1 rounded-full border-2 py-2.5 text-lg font-bold"
                style={{ borderColor: "var(--border)" }}
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function ReportGroupsPanel({
  clientId,
  groups,
  noteCounts,
}: {
  clientId: string;
  groups: ReportGroup[];
  noteCounts: Record<string, number>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const bs = groups.filter((g) => g.statement === "bs").sort((a, b) => a.sort_order - b.sort_order);
  const pl = groups.filter((g) => g.statement === "pl").sort((a, b) => a.sort_order - b.sort_order);

  function refresh() {
    router.refresh();
  }

  function section(title: string, list: ReportGroup[], statement: "bs" | "pl") {
    return (
      <div>
        <div className="text-base font-bold" style={{ color: "var(--muted)" }}>
          {title}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {list.map((g, i) => (
            <GroupPill
              key={g.id}
              group={g}
              prev={list[i - 1] ?? null}
              next={list[i + 1] ?? null}
              noteCount={noteCounts[g.name] ?? 0}
              onChanged={refresh}
            />
          ))}
          <AddGroupButton
            clientId={clientId}
            statement={statement}
            nextSortOrder={list.length > 0 ? Math.max(...list.map((g) => g.sort_order)) + 1 : 0}
            onAdded={refresh}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[28px] border-2 p-6" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between">
        <div className="text-xl font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
          קבוצות הדוח
        </div>
        <span style={{ color: "var(--muted)" }}>{open ? "▲" : "▼"}</span>
      </button>
      {!open && (
        <div className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          מבנה סעיפי המאזן ורווח והפסד של הלקוח הזה — סדר הקבוצות קובע גם את מספור הביאורים.
        </div>
      )}
      {open && (
        <div className="mt-4 flex flex-col gap-5">
          {section("מאזן", bs, "bs")}
          {section("רווח והפסד", pl, "pl")}
        </div>
      )}
    </div>
  );
}
