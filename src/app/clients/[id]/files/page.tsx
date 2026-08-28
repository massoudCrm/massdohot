import { createClient } from "@/lib/supabase/server";
import { FileIngestion, type YearStatus } from "./file-ingestion";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

interface YearStatusRaw {
  year: number;
  txn_count: number;
  total_debit: number;
  total_credit: number;
  last_uploaded_at: string;
}

// לכל שנה שכבר נטענה, מוסיפים גם את "בדיקת יתרות" (חובה/זכות נטו ליום 31/12 של אותה שנה) —
// אותה שיטת חישוב בדיוק כמו "סה"כ לדו"ח" בדוח מאזן הבוחן של תוכנת ההנה"ח, כדי שאפשר יהיה
// להשוות ישירות. מספר קטן של שנים בדרך כלל, אז קריאה נפרדת לכל שנה בבת אחת זול מספיק.
async function withNetBalanceCheck(supabase: SupabaseClient, clientId: string, years: YearStatusRaw[]): Promise<YearStatus[]> {
  const checks = await Promise.all(
    years.map((y) =>
      supabase.rpc("trial_balance_check", {
        p_client_id: clientId,
        p_period_start: `${y.year}-01-01`,
        p_period_end: `${y.year}-12-31`,
      })
    )
  );
  return years.map((y, i) => {
    const check = checks[i].data as { total_debit: number; total_credit: number } | null;
    return {
      ...y,
      net_total_debit: check?.total_debit ?? 0,
      net_total_credit: check?.total_credit ?? 0,
    };
  });
}

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

  const yearsLoaded = await withNetBalanceCheck(supabase, id, (statusRaw as YearStatusRaw[]) ?? []);

  return (
    <main className="flex-1 px-11 py-8">
      <div className="text-3xl font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
        קליטת קבצים במבנה אחיד
      </div>
      <div className="mt-1.5 mb-6 text-lg" style={{ color: "var(--muted)" }}>
        גרור או בחר את שני הקבצים מתיקיית הפתיחה. המערכת מזהה את סוגי הרשומות ובונה מהן את מאזן הבוחן.
      </div>
      <FileIngestion clientId={id} defaultYear={client?.report_year ?? new Date().getFullYear()} yearsLoaded={yearsLoaded} />
    </main>
  );
}
