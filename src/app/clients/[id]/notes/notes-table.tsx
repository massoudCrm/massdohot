"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import type { ReportGroup } from "./report-groups-panel";

interface SubNoteRow {
  id: string;
  name: string;
  count: number;
}

interface NoteRow {
  id: string;
  name: string;
  group: string;
  num: number | null;
  has_note: boolean;
  count: number;
  subNotes: SubNoteRow[];
}

// מודל משותף ליצירה ולעריכה של ביאור — נפתח מיד עם לחיצה, לא יוצר ברקע עם שם זמני
function NoteEditorModal({
  open,
  onClose,
  title,
  name,
  setName,
  group,
  setGroup,
  groups,
  onSave,
  saving,
  error,
  submitLabel,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  name: string;
  setName: (v: string) => void;
  group: string;
  setGroup: (v: string) => void;
  groups: ReportGroup[];
  onSave: () => void;
  saving: boolean;
  error: string;
  submitLabel: string;
}) {
  if (!open) return null;
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
          {title}
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <label className="text-base font-semibold" style={{ color: "var(--muted)" }}>
            שם הסעיף
          </label>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-full border-2 px-5 py-3 text-lg"
            style={{ borderColor: "var(--border)", background: "var(--background)" }}
          />
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <label className="text-base font-semibold" style={{ color: "var(--muted)" }}>
            קבוצה בדוח
          </label>
          <select
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            className="rounded-full border-2 px-5 py-3 text-lg"
            style={{ borderColor: "var(--border)", background: "var(--background)" }}
          >
            <optgroup label="מאזן">
              {groups
                .filter((g) => g.statement === "bs")
                .map((g) => (
                  <option key={g.id} value={g.name}>
                    {g.name}
                  </option>
                ))}
            </optgroup>
            <optgroup label="רווח והפסד">
              {groups
                .filter((g) => g.statement === "pl")
                .map((g) => (
                  <option key={g.id} value={g.name}>
                    {g.name}
                  </option>
                ))}
            </optgroup>
          </select>
        </div>

        {error && (
          <div className="mt-4 text-base font-semibold" style={{ color: "var(--warn-text)" }}>
            {error}
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            onClick={onSave}
            disabled={saving}
            className="flex-1 rounded-full py-3 text-lg font-bold text-white disabled:opacity-60"
            style={{ background: "var(--accent)" }}
          >
            {saving ? "שומר…" : submitLabel}
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

function AddNoteButton({
  clientId,
  groups,
  onAdded,
}: {
  clientId: string;
  groups: ReportGroup[];
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [group, setGroup] = useState(groups[0]?.name ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!name.trim()) {
      setError("יש להזין שם לסעיף.");
      return;
    }
    setSaving(true);
    setError("");
    const supabase = createClient();
    const { error: err } = await supabase
      .from("notes")
      .insert({ client_id: clientId, name: name.trim(), group });
    setSaving(false);
    if (err) {
      setError("יצירה נכשלה: " + err.message);
      return;
    }
    setOpen(false);
    setName("");
    setGroup(groups[0]?.name ?? "");
    onAdded();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-full px-6 py-3 text-lg font-bold text-white"
        style={{ background: "var(--accent)" }}
      >
        + סעיף חדש
      </button>
      <NoteEditorModal
        open={open}
        onClose={() => setOpen(false)}
        title="סעיף חדש"
        name={name}
        setName={setName}
        group={group}
        setGroup={setGroup}
        groups={groups}
        onSave={save}
        saving={saving}
        error={error}
        submitLabel="צור"
      />
    </>
  );
}

function EditNoteButton({ note, groups, onSaved }: { note: NoteRow; groups: ReportGroup[]; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(note.name);
  const [group, setGroup] = useState(note.group);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setError("");
    const supabase = createClient();
    const { error: err } = await supabase.from("notes").update({ name, group }).eq("id", note.id);
    setSaving(false);
    if (err) {
      setError("שמירה נכשלה: " + err.message);
      return;
    }
    setOpen(false);
    onSaved();
  }

  return (
    <>
      <button
        onClick={() => {
          setName(note.name);
          setGroup(note.group);
          setOpen(true);
        }}
        className="rounded-full border-2 px-5 py-2.5 text-base font-bold"
        style={{ borderColor: "var(--accent)", color: "var(--accent-text)" }}
      >
        עריכה
      </button>
      <NoteEditorModal
        open={open}
        onClose={() => setOpen(false)}
        title="עריכת סעיף"
        name={name}
        setName={setName}
        group={group}
        setGroup={setGroup}
        groups={groups}
        onSave={save}
        saving={saving}
        error={error}
        submitLabel="שמור"
      />
    </>
  );
}

// כפתור/תג שמסמן אם לסעיף יש ביאור ממוספר — סעיף רגיל מוצג בגוף הדוח בלי מספר; רק כשמסמנים
// "יש ביאור" הוא מקבל מספר ברצף ומופיע גם ברשימת הביאורים המפורטת (ראו report-shared.ts).
function NoteToggle({ note, onChanged }: { note: NoteRow; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    const supabase = createClient();
    await supabase.from("notes").update({ has_note: !note.has_note }).eq("id", note.id);
    setBusy(false);
    onChanged();
  }

  return note.has_note ? (
    <button
      onClick={toggle}
      disabled={busy}
      title="לחיצה תסיר את הסימון כביאור"
      className="rounded-full px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
      style={{ background: "var(--accent)" }}
    >
      ביאור {note.num}
    </button>
  ) : (
    <button
      onClick={toggle}
      disabled={busy}
      className="rounded-full border-2 px-4 py-2 text-sm font-bold"
      style={{ borderColor: "var(--border)", color: "var(--muted)" }}
    >
      {busy ? "…" : "+ הוסף ביאור"}
    </button>
  );
}

// מודל פשוט יותר לתת-ביאור — רק שם, בלי קבוצה (הוא יורש את הקבוצה מהביאור שלו)
function SubNoteEditorModal({
  open,
  onClose,
  title,
  name,
  setName,
  onSave,
  saving,
  error,
  submitLabel,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  name: string;
  setName: (v: string) => void;
  onSave: () => void;
  saving: boolean;
  error: string;
  submitLabel: string;
}) {
  if (!open) return null;
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
          {title}
        </div>
        <div className="mt-5 flex flex-col gap-2">
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
            onClick={onSave}
            disabled={saving}
            className="flex-1 rounded-full py-3 text-lg font-bold text-white disabled:opacity-60"
            style={{ background: "var(--accent)" }}
          >
            {saving ? "שומר…" : submitLabel}
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

function SubNotesSection({ note, onChanged }: { note: NoteRow; onChanged: () => void }) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState("");
  const [editing, setEditing] = useState<SubNoteRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  async function addSubNote() {
    if (!newName.trim()) {
      setAddError("יש להזין שם.");
      return;
    }
    setAddSaving(true);
    setAddError("");
    const supabase = createClient();
    const { error } = await supabase
      .from("sub_notes")
      .insert({ note_id: note.id, name: newName.trim(), sort_order: note.subNotes.length });
    setAddSaving(false);
    if (error) {
      setAddError("יצירה נכשלה: " + error.message);
      return;
    }
    setAdding(false);
    setNewName("");
    onChanged();
  }

  async function saveEdit() {
    if (!editing) return;
    setEditSaving(true);
    setEditError("");
    const supabase = createClient();
    const { error } = await supabase.from("sub_notes").update({ name: editName }).eq("id", editing.id);
    setEditSaving(false);
    if (error) {
      setEditError("שמירה נכשלה: " + error.message);
      return;
    }
    setEditing(null);
    onChanged();
  }

  async function removeSubNote(sn: SubNoteRow) {
    const supabase = createClient();
    const { error } = await supabase.from("sub_notes").delete().eq("id", sn.id);
    if (error) throw new Error(error.message);
    onChanged();
  }

  return (
    <div className="mr-8 flex flex-col gap-2 border-r-2 pr-4" style={{ borderColor: "var(--border-soft)" }}>
      {note.subNotes.length === 0 && (
        <div className="text-sm" style={{ color: "var(--muted)" }}>
          אין תתי-ביאורים לביאור זה.
        </div>
      )}
      {note.subNotes.map((sn) => (
        <div key={sn.id} className="flex items-center justify-between gap-3">
          <span className="text-base font-semibold">{sn.name}</span>
          <div className="flex items-center gap-2">
            <span className="text-sm" style={{ color: "var(--muted)" }}>
              {sn.count.toLocaleString("he-IL")} סעיפים
            </span>
            <button
              onClick={() => {
                setEditing(sn);
                setEditName(sn.name);
                setEditError("");
              }}
              className="rounded-full border-2 px-3 py-1.5 text-sm font-bold"
              style={{ borderColor: "var(--accent)", color: "var(--accent-text)" }}
            >
              עריכה
            </button>
            <ConfirmDeleteButton
              label="מחק"
              title="מחיקת תת-ביאור"
              message={
                sn.count > 0
                  ? `למחוק את תת-הביאור "${sn.name}"? ${sn.count.toLocaleString("he-IL")} חשבונות יישארו משויכים לביאור "${note.name}" אבל בלי תת-ביאור.`
                  : `למחוק את תת-הביאור "${sn.name}"?`
              }
              onConfirm={() => removeSubNote(sn)}
              className="rounded-full border-2 px-3 py-1.5 text-sm font-bold"
              style={{ borderColor: "var(--border)", color: "var(--muted)" }}
            />
          </div>
        </div>
      ))}
      <button
        onClick={() => {
          setAdding(true);
          setNewName("");
          setAddError("");
        }}
        className="mt-1 w-fit rounded-full border-2 px-4 py-1.5 text-sm font-bold"
        style={{ borderColor: "var(--border)", color: "var(--accent-text)" }}
      >
        + תת-ביאור
      </button>

      <SubNoteEditorModal
        open={adding}
        onClose={() => setAdding(false)}
        title={`תת-ביאור חדש תחת "${note.name}"`}
        name={newName}
        setName={setNewName}
        onSave={addSubNote}
        saving={addSaving}
        error={addError}
        submitLabel="צור"
      />
      <SubNoteEditorModal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="עריכת תת-ביאור"
        name={editName}
        setName={setEditName}
        onSave={saveEdit}
        saving={editSaving}
        error={editError}
        submitLabel="שמור"
      />
    </div>
  );
}

export function NotesTable({
  clientId,
  notes,
  groups,
}: {
  clientId: string;
  notes: NoteRow[];
  groups: ReportGroup[];
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpanded(id: string) {
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function removeNote(note: NoteRow) {
    const supabase = createClient();
    const { error: unassignErr } = await supabase.from("accounts").update({ note_id: null }).eq("note_id", note.id);
    if (unassignErr) throw new Error(unassignErr.message);
    const { error: delErr } = await supabase.from("notes").delete().eq("id", note.id);
    if (delErr) throw new Error(delErr.message);
    router.refresh();
  }

  return (
    <div className="rounded-[28px] border-2 p-8" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between">
        <div className="text-2xl font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
          סעיפי הדוח
        </div>
        <AddNoteButton clientId={clientId} groups={groups} onAdded={() => router.refresh()} />
      </div>

      {notes.length === 0 && (
        <div className="mt-6 text-lg" style={{ color: "var(--muted)" }}>
          אין עדיין סעיפים. לחץ &quot;+ סעיף חדש&quot; כדי להתחיל.
        </div>
      )}

      {notes.length > 0 && (
        <table className="mt-6 w-full border-collapse text-lg">
          <thead>
            <tr style={{ background: "var(--background)" }}>
              <th className="p-3 text-right text-sm" style={{ color: "var(--muted)" }}>
                שם הסעיף
              </th>
              <th className="w-56 p-3 text-right text-sm" style={{ color: "var(--muted)" }}>
                קבוצה בדוח
              </th>
              <th className="w-36 p-3 text-right text-sm" style={{ color: "var(--muted)" }}>
                ביאור
              </th>
              <th className="w-28 p-3 text-left text-sm" style={{ color: "var(--muted)" }}>
                סעיפים
              </th>
              <th className="w-80 p-3"></th>
            </tr>
          </thead>
          <tbody>
            {notes.map((n) => (
              <Fragment key={n.id}>
                <tr style={{ borderBottom: expanded.has(n.id) ? "none" : "1.5px solid var(--border-soft)" }}>
                  <td className="p-3 font-semibold">{n.name}</td>
                  <td className="p-3">{n.group}</td>
                  <td className="p-3">
                    <NoteToggle note={n} onChanged={() => router.refresh()} />
                  </td>
                  <td className="p-3 text-left font-semibold">{n.count.toLocaleString("he-IL")}</td>
                  <td className="p-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => toggleExpanded(n.id)}
                        className="rounded-full border-2 px-4 py-2.5 text-base font-bold"
                        style={{ borderColor: "var(--border)", color: "var(--muted)" }}
                      >
                        {expanded.has(n.id) ? "▲" : "▼"} תתי-ביאורים ({n.subNotes.length})
                      </button>
                      <EditNoteButton note={n} groups={groups} onSaved={() => router.refresh()} />
                      <ConfirmDeleteButton
                        title="מחיקת סעיף"
                        message={
                          n.count > 0
                            ? `האם אתה בטוח שברצונך למחוק את הסעיף "${n.name}"? ${n.count.toLocaleString("he-IL")} חשבונות המשויכים אליו יהפכו ללא מוינים.`
                            : `האם אתה בטוח שברצונך למחוק את הסעיף "${n.name}"?`
                        }
                        onConfirm={() => removeNote(n)}
                      />
                    </div>
                  </td>
                </tr>
                {expanded.has(n.id) && (
                  <tr style={{ borderBottom: "1.5px solid var(--border-soft)" }}>
                    <td colSpan={5} className="p-3 pt-0">
                      <SubNotesSection note={n} onChanged={() => router.refresh()} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
