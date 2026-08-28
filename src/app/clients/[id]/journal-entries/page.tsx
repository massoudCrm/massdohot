import { createClient } from "@/lib/supabase/server";
import { JournalEntriesTable, type JournalEntry, type AccountOption } from "./journal-entries-table";

export default async function JournalEntriesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: entriesRaw, error: entriesErr }, { data: accountsRaw, error: accountsErr }] = await Promise.all([
    supabase.rpc("journal_entries_list", { p_client_id: id }),
    supabase.rpc("client_accounts_list", { p_client_id: id }),
  ]);

  const entries = (entriesRaw as JournalEntry[]) ?? [];
  const accounts = (accountsRaw as AccountOption[]) ?? [];
  const error = entriesErr?.message || accountsErr?.message || null;

  return (
    <main className="flex-1 px-11 py-8">
      <div className="mb-6">
        <div className="text-3xl font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
          פקודות יומן
        </div>
        <div className="mt-1.5 text-lg" style={{ color: "var(--muted)" }}>
          תנועות ידניות שאינן מגיעות מקובץ ההנה&quot;ח — למשל פקודות מלאי, הפרשות, או תיקונים.
          נוצרות כאן משפיעות מיד על מאזן בוחן, מאזן, ורווח והפסד.
        </div>
      </div>

      {error && (
        <div
          className="mb-6 rounded-2xl border-2 p-5 text-lg"
          style={{ borderColor: "var(--warn-border)", background: "var(--warn-soft)", color: "var(--warn-text)" }}
        >
          שגיאה בטעינת הנתונים: {error}
        </div>
      )}

      <JournalEntriesTable clientId={id} entries={entries} accounts={accounts} />
    </main>
  );
}
