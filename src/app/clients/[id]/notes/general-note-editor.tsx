"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function GeneralNoteEditor({ clientId, initialValue }: { clientId: string; initialValue: string }) {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  async function save() {
    setSaving(true);
    setStatus("");
    const supabase = createClient();
    const { error } = await supabase.from("clients").update({ general_note: value }).eq("id", clientId);
    setSaving(false);
    setStatus(error ? "שמירה נכשלה: " + error.message : "נשמר.");
  }

  return (
    <div className="mt-6 rounded-[28px] border-2 p-8" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
      <div className="text-xl font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
        ביאור כללי — מהות העסק ועיקרי מדיניות חשבונאית
      </div>
      <div className="mt-2 text-base" style={{ color: "var(--muted)" }}>
        הטקסט נשמר ללקוח ומודפס כעמוד הביאור הראשון.
      </div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={8}
        className="mt-4 w-full rounded-2xl border-2 p-5 text-lg leading-relaxed"
        style={{ borderColor: "var(--border)", background: "var(--background)" }}
      />
      <div className="mt-4 flex items-center gap-4">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-full px-6 py-3 text-lg font-bold text-white disabled:opacity-60"
          style={{ background: "var(--accent)" }}
        >
          {saving ? "שומר…" : "שמור"}
        </button>
        {status && <span className="text-base font-semibold">{status}</span>}
      </div>
    </div>
  );
}
