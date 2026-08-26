import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FileIngestion } from "./file-ingestion";

export default async function ClientFilesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: client, error } = await supabase
    .from("clients")
    .select("id, name, tax_id, kind")
    .eq("id", id)
    .single();

  if (error || !client) notFound();

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
        <Link
          href={`/clients/${client.id}/trial-balance`}
          className="rounded-full border-2 px-5 py-2.5 text-base font-bold"
          style={{ borderColor: "var(--border)", color: "var(--muted)" }}
        >
          מאזן בוחן
        </Link>
      </header>

      <main className="flex-1 px-11 py-8">
        <div className="text-3xl font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
          קליטת קבצים במבנה אחיד
        </div>
        <div className="mt-1.5 mb-6 text-lg" style={{ color: "var(--muted)" }}>
          גרור או בחר את שני הקבצים מתיקיית הפתיחה. המערכת מזהה את סוגי הרשומות ובונה מהן את מאזן הבוחן.
        </div>
        <FileIngestion clientId={client.id} />
      </main>
    </div>
  );
}
