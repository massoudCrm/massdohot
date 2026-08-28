"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem =
  | { kind: "link"; href: string; label: string; segment: string }
  | { kind: "disabled"; label: string };

function TabButton({
  href,
  label,
  clientId,
  active,
}: {
  href: string;
  label: string;
  clientId: string;
  active: boolean;
}) {
  const style = active
    ? { background: "var(--accent)", borderColor: "var(--accent)", color: "white" }
    : { background: "var(--card)", borderColor: "var(--border)", color: "var(--muted)" };
  return (
    <Link href={`/clients/${clientId}${href}`} className="rounded-full border-2 px-5 py-2.5 text-base font-bold" style={style}>
      {label}
    </Link>
  );
}

// סדר הכרטיסיות תואם את סדר העבודה בפועל: קליטת קבצים -> מיון למאזן בוחן -> פקודות יומן
// (תנועות ידניות) -> ביאורים -> מאזן -> רווח והפסד -> תצוגת הדפסה.
const NAV_ITEMS: NavItem[] = [
  { kind: "link", href: "/files", label: "קליטת קבצים", segment: "files" },
  { kind: "link", href: "/trial-balance", label: "מאזן בוחן ומיון", segment: "trial-balance" },
  { kind: "link", href: "/journal-entries", label: "פקודות יומן", segment: "journal-entries" },
  { kind: "link", href: "/notes", label: "ביאורים", segment: "notes" },
  { kind: "link", href: "/balance-sheet", label: "מאזן", segment: "balance-sheet" },
  { kind: "link", href: "/income-statement", label: "רווח והפסד", segment: "income-statement" },
  { kind: "link", href: "/print", label: "תצוגת הדפסה", segment: "print" },
];

export function ClientNav({ clientId, clientName }: { clientId: string; clientName: string }) {
  const pathname = usePathname();
  const segment = pathname.split("/")[3] ?? "trial-balance";

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 px-11 pt-6 print:hidden">
      <div>
        <Link
          href="/"
          className="rounded-full border-2 px-5 py-2.5 text-base font-bold"
          style={{ background: "var(--card)", borderColor: "var(--border)", color: "var(--muted)" }}
        >
          ← החלפת לקוח
        </Link>
        <div className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
          הלקוח הפעיל
        </div>
        <div className="text-2xl font-extrabold" style={{ fontFamily: "var(--font-display)" }}>
          {clientName}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {NAV_ITEMS.map((item) =>
          item.kind === "link" ? (
            <TabButton
              key={item.href}
              href={item.href}
              label={item.label}
              clientId={clientId}
              active={item.segment === segment}
            />
          ) : (
            <span
              key={item.label}
              title="בקרוב"
              className="cursor-not-allowed rounded-full border-2 px-5 py-2.5 text-base font-bold opacity-40"
              style={{ borderColor: "var(--border)", color: "var(--muted)" }}
            >
              {item.label}
            </span>
          )
        )}
      </div>
    </div>
  );
}
