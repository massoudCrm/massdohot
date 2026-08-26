// לפי סעיף 2.4.ח בהוראה: קידוד עברית תקני הוא ISO-8859-8-i (עברית לוגית) ב-Windows,
// או CP-862 ב-DOS. בפועל כמעט כל תוכנות ההנה"ח המודרניות (Windows) מפיקות ב-windows-1255,
// שתואם ל-ISO-8859-8-i עבור טווח התווים העברי. שדה 1029 ב-INI.TXT קובע איזה מהם (1/2).
// מכיוון שהספרה עצמה זהה בכל קידוד סביר, מפענחים פעם ראשונה עם ברירת המחדל כדי "להציץ"
// בשדה, ורק אם צריך מפענחים שוב עם הקידוד הנכון.

function decodeWith(buffer: ArrayBuffer, encoding: string): string {
  return new TextDecoder(encoding).decode(buffer);
}

export function decodeUniformFormatFile(buffer: ArrayBuffer, charsetDigit?: string): string {
  if (charsetDigit === "2") {
    try {
      return decodeWith(buffer, "cp862");
    } catch {
      // דפדפנים רבים לא תומכים ב-cp862 (קידוד DOS ישן); חוזרים לברירת המחדל
    }
  }
  return decodeWith(buffer, "windows-1255");
}

export function splitRecords(text: string): string[] {
  // לא מסירים רווחים בסוף השורה בכוונה: השדה האחרון ברוב הרשומות הוא "שטח לנתונים
  // עתידיים" המרופד ברווחים, וחיתוך רוחב-קבוע מסתמך על המיקום המדויק של כל שדה.
  return text.split(/\r\n|\r|\n/).filter((line) => line.length > 0);
}
