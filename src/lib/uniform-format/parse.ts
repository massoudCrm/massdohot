import {
  A100_FIELDS,
  B100_FIELDS,
  B110_FIELDS,
  INI_HEADER_FIELDS,
  INI_SUMMARY_FIELDS,
  Z900_FIELDS,
} from "./records";
import { decodeUniformFormatFile, splitRecords } from "./decode";
import { parseDateField, parseSignedAmount, sliceFields, trimAlpha } from "./fields";

export interface ParsedAccount {
  code: string;
  name: string;
  openingBalance: number; // חתום: חיובי = יתרת חובה, שלילי = יתרת זכות (שדה 1414)
  sourceGroupCode: string; // "קוד מאזן בוחן" מהקובץ (שדה 1405) — קיבוץ שכבר קיים בתוכנת ההנה"ח
  sourceGroupDesc: string; // "תיאור קוד מאזן בוחן" (שדה 1406)
  // "קוד סיווג" (שדה 1417) — קיים במפרט הרשמי אבל עד כה לא נעשה בו שימוש. חשוף כרגע רק
  // לבדיקה: האם השדה הזה בפועל מכיל מידע שיכול לשמש לזיהוי חשבון מאזני/תוצאתי מהקובץ עצמו,
  // בלי לנחש. אין עדיין שום החלטה אוטומטית שמתבססת עליו.
  classificationCode: string;
}

export interface ParsedTransaction {
  accountCode: string;
  date: string; // ISO yyyy-mm-dd
  reference: string;
  description: string;
  debit: number;
  credit: number;
}

export interface RecordTypeCount {
  code: string;
  description: string;
  count: number;
  declaredCount: number | null; // מהרשומות המסכמות ב-INI.TXT, אם קיים
}

export interface ParseResult {
  businessName: string;
  vatId: string;
  primaryId: string;
  accounts: ParsedAccount[];
  transactions: ParsedTransaction[];
  recordTypeCounts: RecordTypeCount[];
  errors: string[];
  warnings: string[];
}

const RECORD_DESCRIPTIONS: Record<string, string> = {
  A100: "רשומת פתיחה",
  B100: "תנועה בהנהלת חשבונות",
  B110: "חשבון בהנהלת חשבונות",
  C100: "כותרת מסמך",
  D110: "שורת מסמך",
  D120: "פרטי קבלה/הפקדה",
  M100: "פריט במלאי",
  Z900: "רשומת סגירה",
};

export function parseUniformFormat(
  iniBuffer: ArrayBuffer,
  bkmvBuffer: ArrayBuffer
): ParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // --- INI.TXT ---
  let iniText = decodeUniformFormatFile(iniBuffer);
  let iniLines = splitRecords(iniText);
  if (iniLines.length === 0 || !iniLines[0].startsWith("A000")) {
    errors.push('קובץ INI.TXT לא תקין — הרשומה הראשונה אינה מסוג A000.');
    return emptyResult(errors, warnings);
  }

  let header = sliceFields(iniLines[0], INI_HEADER_FIELDS);
  const charsetDigit = header.charset.trim();
  if (charsetDigit === "2") {
    // קידוד DOS — מפענחים מחדש את שני הקבצים עם הקידוד הנכון
    iniText = decodeUniformFormatFile(iniBuffer, charsetDigit);
    iniLines = splitRecords(iniText);
    header = sliceFields(iniLines[0], INI_HEADER_FIELDS);
  }

  const vatId = header.vatId.trim();
  const businessName = trimAlpha(header.businessName);
  const primaryId = header.primaryId.trim();

  const declaredCounts: Record<string, number> = {};
  for (const line of iniLines.slice(1)) {
    const rec = sliceFields(line, INI_SUMMARY_FIELDS);
    const code = rec.recordCode.trim();
    if (code) declaredCounts[code] = parseInt(rec.totalRecords, 10) || 0;
  }

  // --- BKMVDATA.TXT ---
  const bkmvText = decodeUniformFormatFile(bkmvBuffer, charsetDigit);
  const bkmvLines = splitRecords(bkmvText);

  const accountsByCode = new Map<string, ParsedAccount>();
  const transactions: ParsedTransaction[] = [];
  const actualCounts: Record<string, number> = {};
  let openRecordVatId: string | null = null;
  let closeRecordDeclaredTotal: number | null = null;

  for (const line of bkmvLines) {
    const code = line.slice(0, 4);
    actualCounts[code] = (actualCounts[code] || 0) + 1;

    if (code === "A100") {
      const rec = sliceFields(line, A100_FIELDS);
      openRecordVatId = rec.vatId.trim();
    } else if (code === "Z900") {
      const rec = sliceFields(line, Z900_FIELDS);
      closeRecordDeclaredTotal = parseInt(rec.totalRecordsInFile, 10) || 0;
    } else if (code === "B110") {
      const rec = sliceFields(line, B110_FIELDS);
      const accCode = trimAlpha(rec.accountKey);
      if (!accCode) {
        warnings.push("נמצאה רשומת B110 ללא מפתח חשבון — דולגה.");
        continue;
      }
      accountsByCode.set(accCode, {
        code: accCode,
        name: trimAlpha(rec.accountName) || accCode,
        openingBalance: parseSignedAmount(rec.openingBalance),
        sourceGroupCode: trimAlpha(rec.trialBalanceCode),
        sourceGroupDesc: trimAlpha(rec.trialBalanceCodeDesc),
        classificationCode: trimAlpha(rec.classificationCode),
      });
    } else if (code === "B100") {
      const rec = sliceFields(line, B100_FIELDS);
      const accCode = trimAlpha(rec.accountKey);
      const date = parseDateField(rec.date);
      if (!accCode || !date) {
        warnings.push(
          `נמצאה תנועת B100 (מס' רשומה ${rec.recordNumber.trim()}) ללא חשבון ו/או תאריך תקין — דולגה.`
        );
        continue;
      }
      const amount = parseSignedAmount(rec.amount);
      const isDebit = rec.side.trim() === "1";
      transactions.push({
        accountCode: accCode,
        date,
        reference: trimAlpha(rec.reference1) || rec.movementNumber.trim(),
        description: trimAlpha(rec.details),
        debit: isDebit ? amount : 0,
        credit: isDebit ? 0 : amount,
      });
    }
  }

  if (openRecordVatId && openRecordVatId !== vatId) {
    warnings.push(
      `מספר עוסק מורשה ברשומת הפתיחה (${openRecordVatId}) שונה מזה שב-INI.TXT (${vatId}).`
    );
  }

  const totalActual = bkmvLines.length;
  if (closeRecordDeclaredTotal !== null && closeRecordDeclaredTotal !== totalActual) {
    errors.push(
      `רשומת הסגירה (Z900) מצהירה על ${closeRecordDeclaredTotal} רשומות בקובץ, אך נמצאו בפועל ${totalActual}.`
    );
  }

  const recordTypeCounts: RecordTypeCount[] = Object.keys({
    ...actualCounts,
    ...declaredCounts,
  })
    .filter((code) => code in RECORD_DESCRIPTIONS)
    .map((code) => ({
      code,
      description: RECORD_DESCRIPTIONS[code],
      count: actualCounts[code] || 0,
      declaredCount: code in declaredCounts ? declaredCounts[code] : null,
    }))
    .sort((a, b) => a.code.localeCompare(b.code));

  for (const rc of recordTypeCounts) {
    if (rc.declaredCount !== null && rc.declaredCount !== rc.count) {
      warnings.push(
        `אי-התאמה בכמות רשומות מסוג ${rc.code} (${rc.description}): INI.TXT מצהיר ${rc.declaredCount}, נמצאו בפועל ${rc.count}.`
      );
    }
  }

  if (accountsByCode.size === 0) {
    errors.push("לא נמצאו רשומות חשבון (B110) בקובץ BKMVDATA.TXT.");
  }

  return {
    businessName,
    vatId,
    primaryId,
    accounts: [...accountsByCode.values()],
    transactions,
    recordTypeCounts,
    errors,
    warnings,
  };
}

function emptyResult(errors: string[], warnings: string[]): ParseResult {
  return {
    businessName: "",
    vatId: "",
    primaryId: "",
    accounts: [],
    transactions: [],
    recordTypeCounts: [],
    errors,
    warnings,
  };
}
