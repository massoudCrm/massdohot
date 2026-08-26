"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ALL_GROUPS } from "@/lib/report-groups";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";

interface NoteRow {
  id: string;
  name: string;
  group: string;
  num: number;
  count: number;
}

function EditNoteButton({ note, onSaved }: { note: NoteRow; onSaved: () => void }) {
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

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: "rgba(32,30,29,0.45)" }}
          onClick={() => !saving && setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-[28px] p-8"
            style={{ background: "var(--card)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-2xl font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
              עריכת ביאור
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <label className="text-base font-semibold" style={{ color: "var(--muted)" }}>
                שם הביאור
              </label>
              <input
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
                {ALL_GROUPS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
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
                {saving ? "שומר…" : "שמור"}
              </button>
              <button
                onClick={() => setOpen(false)}
                disabled={saving}
                className="flex-1 rounded-full border-2 py-3 text-lg font-bold"
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

export function NotesTable({ clientId, notes }: { clientId: string; notes: NoteRow[] }) {
  const router = useRouter();
  const [addingNote, setAddingNote] = useState(false);

  async function removeNote(note: NoteRow) {
    const supabase = createClient();
    const { error: unassignErr } = await supabase.from("accounts").update({ note_id: null }).eq("note_id", note.id);
    if (unassignErr) throw new Error(unassignErr.message);
    const { error: delErr } = await supabase.from("notes").delete().eq("id", note.id);
    if (delErr) throw new Error(delErr.message);
    router.refresh();
  }

  async function addNote() {
    setAddingNote(true);
    const supabase = createClient();
    await supabase.from("notes").insert({ client_id: clientId, name: "ביאור חדש", group: ALL_GROUPS[0] });
    setAddingNote(false);
    router.refresh();
  }

  return (
    <div className="rounded-[28px] border-2 p-8" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between">
        <div className="text-2xl font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
          ביאורים
        </div>
        <button
          onClick={addNote}
          disabled={addingNote}
          className="rounded-full px-6 py-3 text-lg font-bold text-white disabled:opacity-60"
          style={{ background: "var(--accent)" }}
        >
          + ביאור חדש
        </button>
      </div>

      {notes.length === 0 && (
        <div className="mt-6 text-lg" style={{ color: "var(--muted)" }}>
          אין עדיין ביאורים. לחץ &quot;+ ביאור חדש&quot; כדי להתחיל.
        </div>
      )}

      {notes.length > 0 && (
        <table className="mt-6 w-full border-collapse text-lg">
          <thead>
            <tr style={{ background: "var(--background)" }}>
              <th className="w-16 p-3 text-right text-sm" style={{ color: "var(--muted)" }}>
                מס&apos;
              </th>
              <th className="p-3 text-right text-sm" style={{ color: "var(--muted)" }}>
                שם הביאור
              </th>
              <th className="w-64 p-3 text-right text-sm" style={{ color: "var(--muted)" }}>
                קבוצה בדוח
              </th>
              <th className="w-28 p-3 text-left text-sm" style={{ color: "var(--muted)" }}>
                סעיפים
              </th>
              <th className="w-56 p-3"></th>
            </tr>
          </thead>
          <tbody>
            {notes.map((n) => (
              <tr key={n.id} style={{ borderBottom: "1.5px solid var(--border-soft)" }}>
                <td className="p-3 font-bold">{n.num}</td>
                <td className="p-3 font-semibold">{n.name}</td>
                <td className="p-3">{n.group}</td>
                <td className="p-3 text-left font-semibold">{n.count.toLocaleString("he-IL")}</td>
                <td className="p-3">
                  <div className="flex justify-end gap-2">
                    <EditNoteButton note={n} onSaved={() => router.refresh()} />
                    <ConfirmDeleteButton
                      title="מחיקת ביאור"
                      message={
                        n.count > 0
                          ? `האם אתה בטוח שברצונך למחוק את הביאור "${n.name}"? ${n.count.toLocaleString("he-IL")} חשבונות המשויכים אליו יהפכו ללא מוינים.`
                          : `האם אתה בטוח שברצונך למחוק את הביאור "${n.name}"?`
                      }
                      onConfirm={() => removeNote(n)}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
