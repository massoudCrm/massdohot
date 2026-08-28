"use client";

import { useState, type CSSProperties } from "react";
import { describeError } from "@/lib/format";

// כפתור מחיקה עם אישור בתוך האתר (לא window.confirm של הדפדפן) — משמש בכל מקום באפליקציה
// שיש בו פעולת מחיקה, כדי לשמור על עיצוב אחיד.
export function ConfirmDeleteButton({
  label = "מחיקה",
  title,
  message,
  onConfirm,
  className,
  style,
  confirmLabel = "כן, מחק",
  confirmBusyLabel = "מוחק…",
}: {
  label?: string;
  title: string;
  message: string;
  onConfirm: () => Promise<void> | void;
  className?: string;
  style?: CSSProperties;
  /** טקסט כפתור האישור, לשימוש גם בפעולות הרסניות שאינן מחיקה (למשל "טעינת תבנית" שמחליפה ביאורים קיימים) */
  confirmLabel?: string;
  confirmBusyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleConfirm() {
    setBusy(true);
    setError("");
    try {
      await onConfirm();
      setOpen(false);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={className ?? "rounded-full border-2 px-5 py-2.5 text-base font-bold"}
        style={style ?? { borderColor: "var(--border)", color: "var(--muted)" }}
      >
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: "rgba(32,30,29,0.45)" }}
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-[28px] p-8"
            style={{ background: "var(--card)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-2xl font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
              {title}
            </div>
            <div className="mt-3 text-lg leading-relaxed">{message}</div>

            {error && (
              <div className="mt-4 text-base font-semibold" style={{ color: "var(--warn-text)" }}>
                {error}
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={handleConfirm}
                disabled={busy}
                className="flex-1 rounded-full py-3 text-lg font-bold text-white disabled:opacity-60"
                style={{ background: "var(--accent-hover)" }}
              >
                {busy ? confirmBusyLabel : confirmLabel}
              </button>
              <button
                onClick={() => setOpen(false)}
                disabled={busy}
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
