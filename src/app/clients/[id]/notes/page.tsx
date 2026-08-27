import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ALL_GROUPS } from "@/lib/report-groups";
import { NotesTable } from "./notes-table";
import { GeneralNoteEditor } from "./general-note-editor";
import { TemplateActions } from "./template-actions";

export default async function NotesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: client, error: clientError },
    { data: notes, error: notesError },
    { data: countsRaw },
    { data: subNotes },
    { data: subCountsRaw },
  ] = await Promise.all([
    supabase.from("clients").select("id, name, tax_id, kind, general_note").eq("id", id).single(),
    supabase.from("notes").select("id, name, group").eq("client_id", id),
    supabase.rpc("note_account_counts", { p_client_id: id }),
    supabase
      .from("sub_notes")
      .select("id, note_id, name, sort_order, notes!inner(client_id)")
      .eq("notes.client_id", id)
      .order("sort_order"),
    supabase.rpc("sub_note_account_counts", { p_client_id: id }),
  ]);

  if (clientError || !client) notFound();

  const counts = (countsRaw as Record<string, number>) ?? {};
  const subCounts = (subCountsRaw as Record<string, number>) ?? {};
  const subNotesByNote = new Map<string, { id: string; name: string; count: number }[]>();
  for (const sn of subNotes ?? []) {
    const list = subNotesByNote.get(sn.note_id) ?? [];
    list.push({ id: sn.id, name: sn.name, count: subCounts[sn.id] ?? 0 });
    subNotesByNote.set(sn.note_id, list);
  }
  const orderedNotes = (notes ?? [])
    .slice()
    .sort((a, b) => ALL_GROUPS.indexOf(a.group) - ALL_GROUPS.indexOf(b.group));
  const numbered = orderedNotes.map((n, i) => ({
    ...n,
    num: i + 1,
    count: counts[n.id] ?? 0,
    subNotes: subNotesByNote.get(n.id) ?? [],
  }));
  const unassignedCount = counts["unassigned"] ?? 0;

  return (
    <div className="flex flex-1 flex-col" style={{ background: "var(--background)" }}>
      <header className="flex flex-wrap items-center justify-between gap-4 px-11 pt-6">
        <div>
          <Link href="/" className="text-base font-semibold" style={{ color: "var(--accent-text)" }}>
            ← חזרה לרשימת הלקוחות
          </Link>
          <div className="mt-2 text-2xl font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
            {client.name}
          </div>
          <div className="text-base" style={{ color: "var(--muted)" }}>
            ח.פ / ע.מ {client.tax_id} · {client.kind}
          </div>
        </div>
        <div className="flex gap-3">
          <Link
            href={`/clients/${id}/trial-balance`}
            className="rounded-full border-2 px-5 py-2.5 text-base font-bold"
            style={{ borderColor: "var(--border)", color: "var(--muted)" }}
          >
            מאזן בוחן
          </Link>
        </div>
      </header>

      <main className="flex-1 px-11 py-8">
        <div className="mb-6">
          <div className="text-3xl font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
            ניהול ביאורים
          </div>
          <div className="mt-1.5 text-lg" style={{ color: "var(--muted)" }}>
            ערוך שם ביאור, שנה את הקבוצה שבה הוא מוצג בדוח, או הוסף ביאור חדש.
            {unassignedCount > 0 && (
              <span style={{ color: "var(--accent-text)" }}>
                {" "}
                · {unassignedCount.toLocaleString("he-IL")} חשבונות עדיין ללא ביאור.
              </span>
            )}
          </div>
        </div>

        {notesError && (
          <div
            className="mb-6 rounded-2xl border-2 p-5 text-lg"
            style={{ borderColor: "var(--warn-border)", background: "var(--warn-soft)", color: "var(--warn-text)" }}
          >
            שגיאה בטעינת הביאורים: {notesError.message}
          </div>
        )}

        <div className="mb-6">
          <TemplateActions
            clientId={id}
            clientName={client.name}
            currentNotes={(notes ?? []).map((n) => ({ name: n.name, group: n.group }))}
            currentGeneralNote={client.general_note ?? ""}
          />
        </div>

        <NotesTable clientId={id} notes={numbered} />

        <GeneralNoteEditor clientId={id} initialValue={client.general_note ?? ""} />
      </main>
    </div>
  );
}
