"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";

interface NoteSnapshotItem {
  name: string;
  group: string;
}

async function replaceNotesWithSnapshot(
  clientId: string,
  snapshot: NoteSnapshotItem[],
  generalNote: string
) {
  const supabase = createClient();
  // מוחקים את הביאורים הקיימים — חשבונות ששויכו אליהם הופכים אוטומטית ללא-מוינים (ON DELETE SET NULL)
  const { error: delErr } = await supabase.from("notes").delete().eq("client_id", clientId);
  if (delErr) throw new Error(delErr.message);

  if (snapshot.length > 0) {
    const { error: insErr } = await supabase
      .from("notes")
      .insert(snapshot.map((n) => ({ client_id: clientId, name: n.name, group: n.group })));
    if (insErr) throw new Error(insErr.message);
  }

  const { error: noteErr } = await supabase
    .from("clients")
    .update({ general_note: generalNote })
    .eq("id", clientId);
  if (noteErr) throw new Error(noteErr.message);
}

export function TemplateActions({
  clientId,
  clientName,
  currentNotes,
  currentGeneralNote,
}: {
  clientId: string;
  clientName: string;
  currentNotes: NoteSnapshotItem[];
  currentGeneralNote: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function saveClientTemplate() {
    setBusy("save");
    setStatus("");
    try {
      const supabase = createClient();
      await supabase.from("note_templates").delete().eq("client_id", clientId).eq("is_default", false);
      const { error } = await supabase.from("note_templates").insert({
        client_id: clientId,
        name: `תבנית ${clientName}`,
        notes_snapshot: currentNotes,
        general_note: currentGeneralNote,
        is_default: false,
      });
      if (error) throw error;
      setStatus(`תבנית הביאורים נשמרה עבור ${clientName}.`);
    } catch (e) {
      setStatus("שמירה נכשלה: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  }

  async function loadClientTemplate() {
    setBusy("load");
    setStatus("");
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("note_templates")
        .select("notes_snapshot, general_note")
        .eq("client_id", clientId)
        .eq("is_default", false)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        setStatus("לא נמצאה תבנית שמורה ללקוח זה.");
        return;
      }
      await replaceNotesWithSnapshot(clientId, data.notes_snapshot as NoteSnapshotItem[], data.general_note ?? "");
      setStatus(`נטענה התבנית השמורה של ${clientName}.`);
      router.refresh();
    } catch (e) {
      setStatus("טעינה נכשלה: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  }

  async function setAsDefault() {
    setBusy("setDefault");
    setStatus("");
    try {
      const supabase = createClient();
      await supabase.from("note_templates").delete().eq("is_default", true);
      const { error } = await supabase.from("note_templates").insert({
        client_id: null,
        name: "ברירת מחדל",
        notes_snapshot: currentNotes,
        general_note: currentGeneralNote,
        is_default: true,
      });
      if (error) throw error;
      setStatus("המבנה הנוכחי נקבע כתבנית ברירת מחדל לכל תיק חדש.");
    } catch (e) {
      setStatus("שמירה נכשלה: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  }

  async function applyDefault() {
    setBusy("applyDefault");
    setStatus("");
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("note_templates")
        .select("notes_snapshot, general_note")
        .eq("is_default", true)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        setStatus("לא הוגדרה תבנית ברירת מחדל.");
        return;
      }
      await replaceNotesWithSnapshot(clientId, data.notes_snapshot as NoteSnapshotItem[], data.general_note ?? "");
      setStatus("תבנית ברירת המחדל הוחלה.");
      router.refresh();
    } catch (e) {
      setStatus("טעינה נכשלה: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={saveClientTemplate}
        disabled={busy !== null}
        className="rounded-full border-2 px-5 py-2.5 text-base font-bold disabled:opacity-60"
        style={{ borderColor: "var(--success-border)", color: "var(--success-text)" }}
      >
        {busy === "save" ? "שומר…" : "שמור תבנית ללקוח"}
      </button>

      <ConfirmDeleteButton
        label="טען תבנית הלקוח"
        title="טעינת תבנית שמורה"
        message={`הביאורים הנוכחיים של ${clientName} יוחלפו בתבנית השמורה שלו. חשבונות ששויכו לביאורים שיימחקו יהפכו ללא מוינים.`}
        confirmLabel="כן, טען"
        confirmBusyLabel="טוען…"
        onConfirm={loadClientTemplate}
        className="rounded-full border-2 px-5 py-2.5 text-base font-bold"
        style={{ borderColor: "var(--border)", color: "var(--muted)" }}
      />

      <button
        onClick={setAsDefault}
        disabled={busy !== null}
        className="rounded-full border-2 px-5 py-2.5 text-base font-bold disabled:opacity-60"
        style={{ borderColor: "var(--border)", color: "var(--muted)" }}
      >
        {busy === "setDefault" ? "קובע…" : "קבע כברירת מחדל"}
      </button>

      <ConfirmDeleteButton
        label="החל ברירת מחדל"
        title="החלת תבנית ברירת מחדל"
        message={`הביאורים הנוכחיים של ${clientName} יוחלפו בתבנית ברירת המחדל. חשבונות ששויכו לביאורים שיימחקו יהפכו ללא מוינים.`}
        confirmLabel="כן, החל"
        confirmBusyLabel="מחיל…"
        onConfirm={applyDefault}
        className="rounded-full border-2 px-5 py-2.5 text-base font-bold"
        style={{ borderColor: "var(--border)", color: "var(--muted)" }}
      />

      {status && <span className="text-base font-semibold" style={{ color: "var(--success-text)" }}>{status}</span>}
    </div>
  );
}
