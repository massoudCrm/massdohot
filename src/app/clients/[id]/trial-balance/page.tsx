import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { lastDayOfMonth } from "@/lib/format";
import { PeriodSelector } from "./period-selector";
import { TrialBalanceTable, type TbRow } from "./trial-balance-table";

const MONTH_NAMES = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];

function periodLabel(fromM: number, toM: number, year: number) {
  const two = (m: number) => String(m).padStart(2, "0");
  return fromM === toM ? `${two(fromM)}/${year}` : `${two(fromM)}-${two(toM)}/${year}`;
}

interface BalanceRow {
  account_id: string;
  code: string;
  name: string;
  balance: number;
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

// account_balances_as_of מחזירה מערך JSON יחיד בתוך שורה בודדת (לא טבלת שורות), כדי לעקוף
// את מגבלת ה-1,000 שורות שSupabase/PostgREST אוכף על תשובות מרובות-שורות, ולחשב פעם אחת בלבד.
async function fetchAccountBalances(
  supabase: SupabaseClient,
  clientId: string,
  asOf: string
): Promise<{ rows: BalanceRow[]; error: { message: string } | null }> {
  const { data, error } = await supabase.rpc("account_balances_as_of", {
    p_client_id: clientId,
    p_as_of: asOf,
  });
  if (error) return { rows: [], error };
  return { rows: (data as BalanceRow[]) ?? [], error: null };
}

export default async function TrialBalancePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string; year?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const now = new Date();
  const fromM = Number(sp.from) || 1;
  const toM = Number(sp.to) || now.getMonth() + 1;
  const year = Number(sp.year) || now.getFullYear();

  const supabase = await createClient();
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id, name, tax_id, kind")
    .eq("id", id)
    .single();
  if (clientError || !client) notFound();

  const currentAsOf = lastDayOfMonth(year, toM);
  const prevAsOf = lastDayOfMonth(year - 1, toM);

  const [
    { rows: currentBalances, error: currErr },
    { rows: prevBalances, error: prevErr },
  ] = await Promise.all([
    fetchAccountBalances(supabase, id, currentAsOf),
    fetchAccountBalances(supabase, id, prevAsOf),
  ]);

  const prevByAccount = new Map<string, number>(
    prevBalances.map((r) => [r.account_id, r.balance])
  );

  const rows: TbRow[] = currentBalances.map((r) => ({
    accountId: r.account_id,
    code: r.code,
    name: r.name,
    curr: r.balance,
    prev: prevByAccount.get(r.account_id) ?? 0,
  }));

  const totalCurr = rows.reduce((s, r) => s + r.curr, 0);
  const totalPrev = rows.reduce((s, r) => s + r.prev, 0);

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
            href={`/clients/${id}/files`}
            className="rounded-full border-2 px-5 py-2.5 text-base font-bold"
            style={{ borderColor: "var(--border)", color: "var(--muted)" }}
          >
            קליטת קבצים
          </Link>
        </div>
      </header>

      <main className="flex-1 px-11 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-3xl font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
              מאזן בוחן
            </div>
            <div className="mt-1.5 text-lg" style={{ color: "var(--muted)" }}>
              יתרות ליום {currentAsOf.split("-").reverse().join("/")} · מקבילה{" "}
              {periodLabel(fromM, toM, year - 1)}
            </div>
          </div>
          <PeriodSelector months={MONTH_NAMES} fromM={fromM} toM={toM} year={year} />
        </div>

        {(clientError || currErr || prevErr) && (
          <div
            className="rounded-2xl border-2 p-5 text-lg"
            style={{ borderColor: "var(--warn-border)", background: "var(--warn-soft)", color: "var(--warn-text)" }}
          >
            שגיאה בטעינת הנתונים: {currErr?.message || prevErr?.message}
          </div>
        )}

        {!currErr && rows.length === 0 && (
          <div
            className="rounded-[28px] border-2 border-dashed p-10 text-center text-lg"
            style={{ borderColor: "var(--border)", color: "var(--muted)" }}
          >
            אין עדיין חשבונות עבור לקוח זה.{" "}
            <Link href={`/clients/${id}/files`} style={{ color: "var(--accent-text)" }}>
              קלוט קבצים
            </Link>{" "}
            כדי להתחיל.
          </div>
        )}

        {rows.length > 0 && (
          <TrialBalanceTable
            rows={rows}
            currLabel={periodLabel(fromM, toM, year)}
            prevLabel={periodLabel(fromM, toM, year - 1)}
            totalCurr={totalCurr}
            totalPrev={totalPrev}
          />
        )}
      </main>
    </div>
  );
}
