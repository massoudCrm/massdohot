import { createClient } from "@/lib/supabase/server";
import { FileIngestion, type YearStatus } from "./file-ingestion";

export default async function ClientFilesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: client }, { data: statusRaw }] = await Promise.all([
    supabase.from("clients").select("id, report_year").eq("id", id).single(),
    supabase.rpc("client_upload_status", { p_client_id: id }),
  ]);

  return (
    <main className="flex-1 px-11 py-8">
      <div className="text-3xl font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
        קליטת קבצים במבנה אחיד
      </div>
      <div className="mt-1.5 mb-6 text-lg" style={{ color: "var(--muted)" }}>
        גרור או בחר את שני הקבצים מתיקיית הפתיחה. המערכת מזהה את סוגי הרשומות ובונה מהן את מאזן הבוחן.
      </div>
      <FileIngestion
        clientId={id}
        defaultYear={client?.report_year ?? new Date().getFullYear()}
        yearsLoaded={(statusRaw as YearStatus[]) ?? []}
      />
    </main>
  );
}
