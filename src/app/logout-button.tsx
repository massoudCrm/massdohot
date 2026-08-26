"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="rounded-full border-2 px-6 py-3 text-lg font-bold"
      style={{ background: "var(--card)", color: "var(--accent-text)", borderColor: "var(--border)" }}
    >
      התנתקות
    </button>
  );
}
