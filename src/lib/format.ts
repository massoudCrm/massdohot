// עיצוב סכום בעברית: אפס מוצג כ"—", שלילי בסוגריים, ללא סימן מינוס
export function formatAmount(value: number): string {
  const rounded = Math.round(value);
  if (rounded === 0) return "—";
  const abs = Math.abs(rounded).toLocaleString("he-IL");
  return rounded < 0 ? `(${abs})` : abs;
}

export function lastDayOfMonth(year: number, month: number): string {
  // יום 0 של החודש הבא = היום האחרון של החודש הנוכחי
  const d = new Date(Date.UTC(year, month, 0));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
