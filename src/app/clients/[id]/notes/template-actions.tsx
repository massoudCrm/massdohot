"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { describeError } from "@/lib/format";

interface NoteSnapshotItem {
  name: string;
  group: string;
  has_note: boolean;
}

interface GroupSnapshotItem {
  statement: "bs" | "pl";
  side: "assets" | "liabilities_equity" | null;
  name: string;
  sort_order: number;
}

async function replaceNotesWithSnapshot(
  clientId: string,
  notesSnapshot: NoteSnapshotItem[],
  groupsSnapshot: GroupSnapshotItem[],
  generalNote: string
) {
  const supabase = createClient();
  // מוחקים את הביאורים הקיימים — חשבונות ששויכו אליהם הופכים אוטומטית ללא-מוינים (ON DELETE SET NULL)
  const { error: delErr } = await supabase.from("notes").delete().eq("client_id", clientId);
  if (delErr) throw new Error(delErr.message);

  if (notesSnapshot.length > 0) {
    const { error: insErr } = await supabase
      .from("notes")
      .insert(notesSnapshot.map((n) => ({ client_id: clientId, name: n.name, group: n.group, has_note: n.has_note })));
    if (insErr) throw new Error(insErr.message);
  }

  // מבנה קבוצות הדוח (מאזן/רו"ה) הוא חלק מהתבנית — טעינת תבנית מחליפה גם אותו, לא רק את הביאורים.
  if (groupsSnapshot.length > 0) {
    const { error: delGroupsErr } = await supabase.from("report_groups").delete().eq("client_id", clientId);
    if (delGroupsErr) throw new Error(delGroupsErr.message);
    const { error: insGroupsErr } = await supabase.from("report_groups").insert(
      groupsSnapshot.map((g) => ({
        client_id: clientId,
        statement: g.statement,
        side: g.side,
        name: g.name,
        sort_order: g.sort_order,
      }))
    );
    if (insGroupsErr) throw new Error(insGroupsErr.message);
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
  currentGroups,
  currentGeneralNote,
}: {
  clientId: string;
  clientName: string;
  currentNotes: NoteSnapshotItem[];
  currentGroups: GroupSnapshotItem[];
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
        groups_snapshot: currentGroups,
        general_note: currentGeneralNote,
        is_default: false,
      });
      if (error) throw error;
      setStatus(`תבנית הביאורים נשמרה עבור ${clientName}.`);
    } catch (e) {
      setStatus("שמירה נכשלה: " + describeError(e));
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
        .select("notes_snapshot, groups_snapshot, general_note")
        .eq("client_id", clientId)
        .eq("is_default", false)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        setStatus("לא נמצאה תבנית שמורה ללקוח זה.");
        return;
      }
      await replaceNotesWithSnapshot(
        clientId,
        data.notes_snapshot as NoteSnapshotItem[],
        (data.groups_snapshot as GroupSnapshotItem[]) ?? [],
        data.general_note ?? ""
      );
      setStatus(`נטענה התבנית השמורה של ${clientName}.`);
      router.refresh();
    } catch (e) {
      setStatus("טעינה נכשלה: " + describeError(e));
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
        groups_snapshot: currentGroups,
        general_note: currentGeneralNote,
        is_default: true,
      });
      if (error) throw error;
      setStatus("המבנה הנוכחי נקבע כתבנית ברירת מחדל לכל תיק חדש.");
    } catch (e) {
      setStatus("שמירה נכשלה: " + describeError(e));
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
        .select("notes_snapshot, groups_snapshot, general_note")
        .eq("is_default", true)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        setStatus("לא הוגדרה תבנית ברירת מחדל.");
        return;
      }
      await replaceNotesWithSnapshot(
        clientId,
        data.notes_snapshot as NoteSnapshotItem[],
        (data.groups_snapshot as GroupSnapshotItem[]) ?? [],
        data.general_note ?? ""
      );
      setStatus("תבנית ברירת המחדל הוחלה.");
      router.refresh();
    } catch (e) {
      setStatus("טעינה נכשלה: " + describeError(e));
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
