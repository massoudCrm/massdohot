import type { FieldDef } from "./records";

// חותך רשומה לפי טבלת אורכי שדות ומחזיר מפה של key -> ערך גולמי (ללא עיבוד, כולל רווחים)
export function sliceFields(line: string, fields: FieldDef[]): Record<string, string> {
  const out: Record<string, string> = {};
  let pos = 0;
  for (const f of fields) {
    out[f.key] = line.slice(pos, pos + f.length);
    pos += f.length;
  }
  return out;
}

export function trimAlpha(raw: string): string {
  return raw.replace(/!+$/g, "").trimEnd();
}

// שדה סכום בפורמט X9(12)v99: תו סימן (+/-) + 12 ספרות שלמות + 2 ספרות אגורות, ללא נקודה עשרונית בפועל
export function parseSignedAmount(raw: string): number {
  const trimmed = raw.trim();
  if (!trimmed) return 0;
  const sign = trimmed[0] === "-" ? -1 : 1;
  const digits = trimmed.slice(1).replace(/\D/g, "") || "0";
  return (sign * parseInt(digits, 10)) / 100;
}

// שדה תאריך בפורמט YYYYMMDD -> "YYYY-MM-DD", או null אם ריק/אפסים
export function parseDateField(raw: string): string | null {
  const digits = raw.trim();
  if (!digits || digits === "0".repeat(digits.length)) return null;
  const y = digits.slice(0, 4);
  const m = digits.slice(4, 6);
  const d = digits.slice(6, 8);
  if (!y || !m || !d || m === "00" || d === "00") return null;
  return `${y}-${m}-${d}`;
}
