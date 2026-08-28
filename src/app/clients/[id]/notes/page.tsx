import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NotesTable } from "./notes-table";
import { GeneralNoteEditor } from "./general-note-editor";
import { TemplateActions } from "./template-actions";
import { ReportGroupsPanel } from "./report-groups-panel";
import { orderNotesAndNumber } from "../report-shared";

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
    { data: groupsRaw },
  ] = await Promise.all([
    supabase.from("clients").select("id, name, general_note").eq("id", id).single(),
    supabase.from("notes").select("id, name, group, has_note").eq("client_id", id),
    supabase.rpc("note_account_counts", { p_client_id: id }),
    supabase
      .from("sub_notes")
      .select("id, note_id, name, sort_order, notes!inner(client_id)")
      .eq("notes.client_id", id)
      .order("sort_order"),
    supabase.rpc("sub_note_account_counts", { p_client_id: id }),
    supabase
      .from("report_groups")
      .select("id, statement, side, name, sort_order")
      .eq("client_id", id)
      .order("statement")
      .order("sort_order"),
  ]);

  if (clientError || !client) notFound();

  const groups = (groupsRaw ?? []) as {
    id: string;
    statement: "bs" | "pl";
    side: "assets" | "liabilities_equity" | null;
    name: string;
    sort_order: number;
  }[];

  const counts = (countsRaw as Record<string, number>) ?? {};
  const subCounts = (subCountsRaw as Record<string, number>) ?? {};
  const subNotesByNote = new Map<string, { id: string; name: string; count: number }[]>();
  for (const sn of subNotes ?? []) {
    const list = subNotesByNote.get(sn.note_id) ?? [];
    list.push({ id: sn.id, name: sn.name, count: subCounts[sn.id] ?? 0 });
    subNotesByNote.set(sn.note_id, list);
  }
  // סעיף שהקבוצה שלו נמחקה (טקסט חופשי בלי FK) מוצג בסוף הרשימה במקום לגרום לקריסה. מספור
  // "ביאור N" חל רק על סעיפים שסומנו has_note (ראו report-shared.ts).
  const { ordered: orderedNotes, noteNum } = orderNotesAndNumber(notes ?? [], groups);
  const numbered = orderedNotes.map((n) => ({
    ...n,
    num: noteNum.get(n.id) ?? null,
    count: counts[n.id] ?? 0,
    subNotes: subNotesByNote.get(n.id) ?? [],
  }));
  const unassignedCount = counts["unassigned"] ?? 0;
  const groupNoteCounts = new Map<string, number>();
  for (const n of notes ?? []) {
    groupNoteCounts.set(n.group, (groupNoteCounts.get(n.group) ?? 0) + 1);
  }

  return (
    <main className="flex-1 px-11 py-8">
        <div className="mb-6">
          <div className="text-3xl font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
            ניהול סעיפי הדוח
          </div>
          <div className="mt-1.5 text-lg" style={{ color: "var(--muted)" }}>
            כל סעיף מופיע בגוף המאזן/רווח והפסד; רק סעיף שתסמן במפורש כ"ביאור" יקבל מספר ביאור
            ויופיע גם ברשימת הביאורים המפורטת.
            {unassignedCount > 0 && (
              <span style={{ color: "var(--accent-text)" }}>
                {" "}
                · {unassignedCount.toLocaleString("he-IL")} חשבונות עדיין ללא סעיף.
              </span>
            )}
          </div>
        </div>

        {notesError && (
          <div
            className="mb-6 rounded-2xl border-2 p-5 text-lg"
            style={{ borderColor: "var(--warn-border)", background: "var(--warn-soft)", color: "var(--warn-text)" }}
          >
            שגיאה בטעינת הסעיפים: {notesError.message}
          </div>
        )}

        <div className="mb-6">
          <TemplateActions
            clientId={id}
            clientName={client.name}
            currentNotes={(notes ?? []).map((n) => ({ name: n.name, group: n.group, has_note: n.has_note }))}
            currentGroups={groups.map((g) => ({
              statement: g.statement,
              side: g.side,
              name: g.name,
              sort_order: g.sort_order,
            }))}
            currentGeneralNote={client.general_note ?? ""}
          />
        </div>

        <div className="mb-6">
          <ReportGroupsPanel
            clientId={id}
            groups={groups}
            noteCounts={Object.fromEntries(groupNoteCounts)}
          />
        </div>

        <NotesTable clientId={id} notes={numbered} groups={groups} />

        <GeneralNoteEditor clientId={id} initialValue={client.general_note ?? ""} />
    </main>
  );
}
