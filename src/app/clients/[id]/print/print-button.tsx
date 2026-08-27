"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-full px-6 py-3 text-lg font-bold text-white"
      style={{ background: "var(--accent)" }}
    >
      הדפס / שמור כ-PDF
    </button>
  );
}
