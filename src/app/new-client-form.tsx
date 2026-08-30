"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// מחיל אוטומטית על לקוח חדש את תבנית ברירת המחדל (סעיפים + קבוצות דוח), אם הוגדרה כזו —
// כדי שלא תצטרך ללחוץ "טען תבנית מחדל" ידנית בכל פעם (קבוצות הדוח כבר נזרעות אוטומטית
// דרך טריגר במסד הנתונים; זה משלים את זה גם לשמות הסעיפים בפועל). כישלון שקט: אם אין
// תבנית ברירת מחדל מוגדרת, הלקוח פשוט נשאר ריק כמו היום, בלי הודעת שגיאה מטרידה.
async function applyDefaultTemplate(clientId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("note_templates")
    .select("notes_snapshot, groups_snapshot, general_note")
    .eq("is_default", true)
    .maybeSingle();
  if (!data) return;

  const notesSnapshot = (data.notes_snapshot as { name: string; group: string; has_note: boolean }[]) ?? [];
  const groupsSnapshot =
    (data.groups_snapshot as
      | { statement: "bs" | "pl"; side: "assets" | "liabilities_equity" | null; name: string; sort_order: number }[]
      | null) ?? [];

  if (groupsSnapshot.length > 0) {
    await supabase.from("report_groups").delete().eq("client_id", clientId);
    await supabase.from("report_groups").insert(
      groupsSnapshot.map((g) => ({
        client_id: clientId,
        statement: g.statement,
        side: g.side,
        name: g.name,
        sort_order: g.sort_order,
      }))
    );
  }
  if (notesSnapshot.length > 0) {
    await supabase
      .from("notes")
      .insert(notesSnapshot.map((n) => ({ client_id: clientId, name: n.name, group: n.group, has_note: n.has_note })));
  }
  if (data.general_note) {
    await supabase.from("clients").update({ general_note: data.general_note }).eq("id", clientId);
  }
}

export function NewClientForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [kind, setKind] = useState("חברה בע\"מ");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const supabase = createClient();
    const { data: inserted, error: insertError } = await supabase
      .from("clients")
      .insert({ name, tax_id: taxId, kind })
      .select("id")
      .single();

    if (insertError) {
      setSaving(false);
      setError("שמירה נכשלה: " + insertError.message);
      return;
    }

    if (inserted) {
      await applyDefaultTemplate(inserted.id);
    }
    setSaving(false);

    setName("");
    setTaxId("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-full px-7 py-3.5 text-lg font-bold text-white"
        style={{ background: "var(--accent)" }}
      >
        + לקוח חדש
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-wrap items-end gap-3 rounded-[28px] border-2 p-5"
      style={{ background: "var(--card)", borderColor: "var(--border)" }}
    >
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold" style={{ color: "var(--muted)" }}>
          שם הלקוח
        </label>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-full border-2 px-4 py-2.5 text-lg"
          style={{ borderColor: "var(--border)", background: "var(--background)" }}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold" style={{ color: "var(--muted)" }}>
          ח.פ / ע.מ
        </label>
        <input
          required
          value={taxId}
          onChange={(e) => setTaxId(e.target.value)}
          className="w-40 rounded-full border-2 px-4 py-2.5 text-lg"
          style={{ borderColor: "var(--border)", background: "var(--background)" }}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-semibold" style={{ color: "var(--muted)" }}>
          סוג
        </label>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="rounded-full border-2 px-4 py-2.5 text-lg"
          style={{ borderColor: "var(--border)", background: "var(--background)" }}
        >
          <option value='חברה בע"מ'>חברה בע&quot;מ</option>
          <option value="עוסק מורשה">עוסק מורשה</option>
          <option value="עוסק פטור">עוסק פטור</option>
        </select>
      </div>

      {error && <div className="text-sm font-semibold" style={{ color: "var(--warn-text)" }}>{error}</div>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full px-6 py-2.5 text-lg font-bold text-white disabled:opacity-60"
          style={{ background: "var(--accent)" }}
        >
          {saving ? "שומר…" : "שמור"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-full border-2 px-6 py-2.5 text-lg font-bold"
          style={{ borderColor: "var(--border)" }}
        >
          ביטול
        </button>
      </div>
    </form>
  );
}
