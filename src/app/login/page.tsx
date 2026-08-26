"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError("אימייל או סיסמה שגויים.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex flex-1 items-center justify-center px-6" style={{ background: "var(--background)" }}>
      <div
        className="w-full max-w-md rounded-[28px] border-2 p-8"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="mb-6 flex items-center gap-4">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full text-2xl font-bold"
            style={{ background: "var(--accent)", color: "var(--card)", fontFamily: "var(--font-display)" }}
          >
            מא
          </div>
          <div>
            <div className="text-xl font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
              עריכת דוחות כספיים
            </div>
            <div className="text-base" style={{ color: "var(--muted)" }}>
              מסעוד אסעד · יועץ מס מוסמך
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="email" className="text-base font-semibold" style={{ color: "var(--muted)" }}>
              אימייל
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-full border-2 px-5 py-3 text-lg"
              style={{ borderColor: "var(--border)", background: "var(--background)" }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="password" className="text-base font-semibold" style={{ color: "var(--muted)" }}>
              סיסמה
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-full border-2 px-5 py-3 text-lg"
              style={{ borderColor: "var(--border)", background: "var(--background)" }}
            />
          </div>

          {error && (
            <div className="text-base font-semibold" style={{ color: "var(--warn-text)" }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 rounded-full py-3 text-lg font-bold text-white disabled:opacity-60"
            style={{ background: "var(--accent)" }}
          >
            {loading ? "מתחבר…" : "התחברות"}
          </button>
        </form>
      </div>
    </div>
  );
}
