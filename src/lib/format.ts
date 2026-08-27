// עיצוב סכום בעברית: אפס מוצג כ"—", שלילי בסוגריים, ללא סימן מינוס
export function formatAmount(value: number): string {
  const rounded = Math.round(value);
  if (rounded === 0) return "—";
  const abs = Math.abs(rounded).toLocaleString("he-IL");
  return rounded < 0 ? `(${abs})` : abs;
}

// שדה "קוד מאזן בוחן" בקובץ האחיד מוגדר אלפאנומרי, אבל בפועל תוכנות רבות ממלאות אותו
// באפסים מובילים (כמו שדה נומרי) — למשל "000000000000011" במקום "11". לצורך תצוגה בלבד
// מנקים את האפסים המובילים; הערך הגולמי נשאר כמו שהוא לצורך התאמה מדויקת בכללי מיון.
export function formatSourceGroupCode(code: string): string {
  const trimmed = code.trim();
  const stripped = trimmed.replace(/^0+(?=.)/, "");
  return stripped || trimmed;
}

// אחוז שינוי בין תקופה מקבילה לתקופה נוכחית, באותה מוסכמה כמו formatAmount (שלילי בסוגריים).
// כשאין יתרה מקבילה להשוואה: "—" אם גם הנוכחית אפס, "חדש" אם הופיע רק בתקופה הנוכחית.
export function formatPercentChange(curr: number, prev: number): string {
  const roundedPrev = Math.round(prev);
  if (roundedPrev === 0) return Math.round(curr) === 0 ? "—" : "חדש";
  const pct = ((curr - prev) / Math.abs(prev)) * 100;
  const abs = Math.abs(pct).toFixed(1);
  return pct < 0 ? `(${abs}%)` : `${abs}%`;
}

export function lastDayOfMonth(year: number, month: number): string {
  // יום 0 של החודש הבא = היום האחרון של החודש הנוכחי
  const d = new Date(Date.UTC(year, month, 0));
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
