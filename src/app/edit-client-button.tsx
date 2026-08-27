"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function EditClientButton({
  clientId,
  name,
  taxId,
  kind,
}: {
  clientId: string;
  name: string;
  taxId: string;
  kind: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editName, setEditName] = useState(name);
  const [editTaxId, setEditTaxId] = useState(taxId);
  const [editKind, setEditKind] = useState(kind);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!editName.trim() || !editTaxId.trim()) {
      setError("יש למלא שם ומספר ח.פ / ע.מ.");
      return;
    }
    setSaving(true);
    setError("");
    const supabase = createClient();
    const { error: err } = await supabase
      .from("clients")
      .update({ name: editName.trim(), tax_id: editTaxId.trim(), kind: editKind })
      .eq("id", clientId);
    setSaving(false);
    if (err) {
      setError("שמירה נכשלה: " + err.message);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => {
          setEditName(name);
          setEditTaxId(taxId);
          setEditKind(kind);
          setError("");
          setOpen(true);
        }}
        className="rounded-full border-2 px-5 py-2.5 text-base font-bold"
        style={{ borderColor: "var(--border)", color: "var(--muted)" }}
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
              עריכת פרטי לקוח
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <label className="text-base font-semibold" style={{ color: "var(--muted)" }}>
                שם הלקוח
              </label>
              <input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="rounded-full border-2 px-5 py-3 text-lg"
                style={{ borderColor: "var(--border)", background: "var(--background)" }}
              />
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <label className="text-base font-semibold" style={{ color: "var(--muted)" }}>
                ח.פ / ע.מ
              </label>
              <input
                value={editTaxId}
                onChange={(e) => setEditTaxId(e.target.value)}
                className="rounded-full border-2 px-5 py-3 text-lg"
                style={{ borderColor: "var(--border)", background: "var(--background)" }}
              />
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <label className="text-base font-semibold" style={{ color: "var(--muted)" }}>
                סוג
              </label>
              <select
                value={editKind}
                onChange={(e) => setEditKind(e.target.value)}
                className="rounded-full border-2 px-5 py-3 text-lg"
                style={{ borderColor: "var(--border)", background: "var(--background)" }}
              >
                <option value='חברה בע"מ'>חברה בע&quot;מ</option>
                <option value="עוסק מורשה">עוסק מורשה</option>
                <option value="עוסק פטור">עוסק פטור</option>
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
