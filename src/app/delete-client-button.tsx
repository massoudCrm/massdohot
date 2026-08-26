"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function DeleteClientButton({ clientId, clientName }: { clientId: string; clientName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirm() {
    setDeleting(true);
    setError("");
    const supabase = createClient();
    const { error: delError } = await supabase.from("clients").delete().eq("id", clientId);
    setDeleting(false);

    if (delError) {
      setError("המחיקה נכשלה: " + delError.message);
      return;
    }

    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-full border-2 px-5 py-2.5 text-base font-bold"
        style={{ borderColor: "var(--border)", color: "var(--muted)" }}
      >
        מחיקה
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: "rgba(32,30,29,0.45)" }}
          onClick={() => !deleting && setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-[28px] p-8"
            style={{ background: "var(--card)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-2xl font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
              מחיקת לקוח
            </div>
            <div className="mt-3 text-lg leading-relaxed">
              האם אתה בטוח שברצונך למחוק את <b>&quot;{clientName}&quot;</b>? פעולה זו תמחק גם את כל
              החשבונות, התנועות, הביאורים ופקודות היומן של הלקוח, ולא ניתנת לביטול.
            </div>

            {error && (
              <div className="mt-4 text-base font-semibold" style={{ color: "var(--warn-text)" }}>
                {error}
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={handleConfirm}
                disabled={deleting}
                className="flex-1 rounded-full py-3 text-lg font-bold text-white disabled:opacity-60"
                style={{ background: "var(--accent-hover)" }}
              >
                {deleting ? "מוחק…" : "כן, מחק"}
              </button>
              <button
                onClick={() => setOpen(false)}
                disabled={deleting}
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
