import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DeleteClientButton } from "./delete-client-button";
import { LogoutButton } from "./logout-button";
import { NewClientForm } from "./new-client-form";

const STATUS_STYLE: Record<string, string> = {
  הופק: "border-[color:var(--success-border)] bg-[color:var(--success-soft)] text-[color:var(--success-text)]",
  בעריכה: "border-[color:var(--warn-border)] bg-[color:var(--warn-soft)] text-[color:var(--accent-text)]",
};
const STATUS_STYLE_DEFAULT =
  "border-[color:var(--border)] bg-[color:var(--background)] text-[color:var(--muted)]";

export default async function ClientsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: clients, error } = await supabase
    .from("clients")
    .select("id, name, tax_id, kind, status")
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-1 flex-col" style={{ background: "var(--background)" }}>
      <header className="flex flex-wrap items-center justify-between gap-4 px-11 pt-6">
        <div className="flex items-center gap-4">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full text-2xl font-bold"
            style={{ background: "var(--accent)", color: "var(--card)", fontFamily: "var(--font-display)" }}
          >
            מא
          </div>
          <div>
            <div className="text-2xl font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
              עריכת דוחות כספיים
            </div>
            <div className="text-base" style={{ color: "var(--muted)" }}>
              {user?.email}
            </div>
          </div>
        </div>
        <LogoutButton />
      </header>

      <main className="flex-1 px-11 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="text-3xl font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
              רשימת לקוחות
            </div>
            <div className="mt-1.5 text-lg" style={{ color: "var(--muted)" }}>
              בחר תיק כדי לטעון את מאזן הבוחן, הביאורים והתבנית השמורה שלו.
            </div>
          </div>
          <NewClientForm />
        </div>

        {error && (
          <div
            className="rounded-2xl border-2 p-5 text-lg"
            style={{ borderColor: "var(--warn-border)", background: "var(--warn-soft)", color: "var(--warn-text)" }}
          >
            שגיאה בטעינת הלקוחות: {error.message}
          </div>
        )}

        {!error && clients && clients.length === 0 && (
          <div
            className="rounded-[28px] border-2 border-dashed p-10 text-center text-lg"
            style={{ borderColor: "var(--border)", color: "var(--muted)" }}
          >
            אין עדיין לקוחות. לחץ על &quot;+ לקוח חדש&quot; כדי להתחיל.
          </div>
        )}

        {clients && clients.length > 0 && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {clients.map((c) => (
              <div
                key={c.id}
                className="rounded-[28px] border-2 p-6"
                style={{ background: "var(--card)", borderColor: "var(--border)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="text-xl font-bold leading-snug">{c.name}</div>
                  <span
                    className={`flex-none rounded-full border-2 px-4 py-1.5 text-sm font-bold ${
                      STATUS_STYLE[c.status] ?? STATUS_STYLE_DEFAULT
                    }`}
                  >
                    {c.status}
                  </span>
                </div>
                <div className="mt-2 text-base" style={{ color: "var(--muted)" }}>
                  ח.פ / ע.מ {c.tax_id} · {c.kind}
                </div>
                <div className="mt-5 flex items-center justify-end gap-3">
                  <DeleteClientButton clientId={c.id} clientName={c.name} />
                  <Link
                    href={`/clients/${c.id}/trial-balance`}
                    className="rounded-full border-2 px-5 py-2.5 text-base font-bold"
                    style={{ borderColor: "var(--accent)", color: "var(--accent-text)" }}
                  >
                    פתח תיק
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
