"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function ChangeColumnToggle({ clientId, showChanges }: { clientId: string; showChanges: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    const supabase = createClient();
    await supabase.from("clients").update({ show_changes: !showChanges }).eq("id", clientId);
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className="rounded-full border-2 px-5 py-2.5 text-base font-bold disabled:opacity-60"
      style={
        showChanges
          ? { background: "var(--success)", borderColor: "var(--success)", color: "white" }
          : { background: "var(--card)", borderColor: "var(--border)", color: "var(--muted)" }
      }
    >
      עמודת שינוי
    </button>
  );
}
