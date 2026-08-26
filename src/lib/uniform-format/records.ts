// מבנה רשומות "מבנה אחיד" (רשות המסים, הוראה 131, גרסה 1.31, 01/05/2009).
// אורך כל שדה מוגדר ברצף (השדות צמודים ללא רווח), המיקום נגזר ע"י סכימה מצטברת.
// כל טבלה אומתה כך שסכום האורכים תואם בדיוק לאורך הרשומה הרשמי המוצהר בהוראה (סעיף 2.5).

export interface FieldDef {
  key: string;
  length: number;
}

export function recordLength(fields: FieldDef[]): number {
  return fields.reduce((sum, f) => sum + f.length, 0);
}

// INI.TXT — רשומה תחילית A000 (אורך 466)
export const INI_HEADER_FIELDS: FieldDef[] = [
  { key: "recordCode", length: 4 }, // 1000 - "A000"
  { key: "future1001", length: 5 },
  { key: "totalRecordsInBkmvdata", length: 15 }, // 1002
  { key: "vatId", length: 9 }, // 1003 - מספר עוסק מורשה
  { key: "primaryId", length: 15 }, // 1004 - מזהה ראשי
  { key: "systemConst1005", length: 8 },
  { key: "softwareRegNumber", length: 8 }, // 1006
  { key: "softwareName", length: 20 }, // 1007
  { key: "softwareVersion", length: 20 }, // 1008
  { key: "vendorVatId", length: 9 }, // 1009
  { key: "vendorName", length: 20 }, // 1010
  { key: "softwareType", length: 1 }, // 1011 - 1=חד שנתי, 2=רב שנתי
  { key: "storagePath", length: 50 }, // 1012
  { key: "accountingType", length: 1 }, // 1013 - 0/1/2
  { key: "balanceRequired", length: 1 }, // 1014
  { key: "companyNumber", length: 9 }, // 1015 - ח"פ
  { key: "deductionFileNumber", length: 9 }, // 1016
  { key: "future1017", length: 10 },
  { key: "businessName", length: 50 }, // 1018
  { key: "addressStreet", length: 50 }, // 1019
  { key: "addressHouseNumber", length: 10 }, // 1020
  { key: "addressCity", length: 30 }, // 1021
  { key: "addressZip", length: 8 }, // 1022
  { key: "taxYear", length: 4 }, // 1023
  { key: "rangeStartDate", length: 8 }, // 1024
  { key: "rangeEndDate", length: 8 }, // 1025
  { key: "processStartDate", length: 8 }, // 1026
  { key: "processStartTime", length: 4 }, // 1027
  { key: "languageCode", length: 1 }, // 1028
  { key: "charset", length: 1 }, // 1029 - 1=ISO-8859-8-i, 2=CP-862
  { key: "compressionSoftware", length: 20 }, // 1030
  { key: "future1031", length: 0 },
  { key: "currency", length: 3 }, // 1032
  { key: "future1033", length: 0 },
  { key: "hasBranches", length: 1 }, // 1034
  { key: "future1035", length: 46 },
];

// INI.TXT — רשומת סיכום לכל סוג רשומה (אורך 19)
export const INI_SUMMARY_FIELDS: FieldDef[] = [
  { key: "recordCode", length: 4 }, // 1050
  { key: "totalRecords", length: 15 }, // 1051
];

// BKMVDATA.TXT — A100 רשומת פתיחה (אורך 95)
export const A100_FIELDS: FieldDef[] = [
  { key: "recordCode", length: 4 }, // 1100
  { key: "recordNumber", length: 9 }, // 1101
  { key: "vatId", length: 9 }, // 1102
  { key: "primaryId", length: 15 }, // 1103
  { key: "systemConst", length: 8 }, // 1104
  { key: "future1105", length: 50 },
];

// BKMVDATA.TXT — Z900 רשומת סגירה (אורך 110)
export const Z900_FIELDS: FieldDef[] = [
  { key: "recordCode", length: 4 }, // 1150
  { key: "recordNumber", length: 9 }, // 1151
  { key: "vatId", length: 9 }, // 1152
  { key: "primaryId", length: 15 }, // 1153
  { key: "systemConst", length: 8 }, // 1154
  { key: "totalRecordsInFile", length: 15 }, // 1155
  { key: "future1156", length: 50 },
];

// BKMVDATA.TXT — B100 תנועות בהנהלת חשבונות (אורך 317)
export const B100_FIELDS: FieldDef[] = [
  { key: "recordCode", length: 4 }, // 1350
  { key: "recordNumber", length: 9 }, // 1351
  { key: "vatId", length: 9 }, // 1352
  { key: "movementNumber", length: 10 }, // 1353
  { key: "lineNumber", length: 5 }, // 1354
  { key: "batch", length: 8 }, // 1355
  { key: "movementType", length: 15 }, // 1356
  { key: "reference1", length: 20 }, // 1357 - אסמכתא
  { key: "reference1DocType", length: 3 }, // 1358
  { key: "reference2", length: 20 }, // 1359
  { key: "reference2DocType", length: 3 }, // 1360
  { key: "details", length: 50 }, // 1361 - פרטים / תיאור
  { key: "date", length: 8 }, // 1362
  { key: "valueDate", length: 8 }, // 1363
  { key: "accountKey", length: 15 }, // 1364 - חשבון בתנועה
  { key: "counterAccountKey", length: 15 }, // 1365
  { key: "side", length: 1 }, // 1366 - 1=חובה, 2=זכות
  { key: "foreignCurrencyCode", length: 3 }, // 1367
  { key: "amount", length: 15 }, // 1368 - סכום הפעולה (במטבע מוביל)
  { key: "foreignAmount", length: 15 }, // 1369
  { key: "quantity", length: 12 }, // 1370
  { key: "matchField1", length: 10 }, // 1371
  { key: "matchField2", length: 10 }, // 1372
  { key: "future1373", length: 0 },
  { key: "branchId", length: 7 }, // 1374
  { key: "entryDate", length: 8 }, // 1375
  { key: "enteredBy", length: 9 }, // 1376
  { key: "future1377", length: 25 },
];

// BKMVDATA.TXT — B110 חשבון בהנהלת חשבונות (אורך 376)
export const B110_FIELDS: FieldDef[] = [
  { key: "recordCode", length: 4 }, // 1400
  { key: "recordNumber", length: 9 }, // 1401
  { key: "vatId", length: 9 }, // 1402
  { key: "accountKey", length: 15 }, // 1403 - מפתח החשבון
  { key: "accountName", length: 50 }, // 1404
  { key: "trialBalanceCode", length: 15 }, // 1405
  { key: "trialBalanceCodeDesc", length: 30 }, // 1406
  { key: "addressStreet", length: 50 }, // 1407
  { key: "addressHouseNumber", length: 10 }, // 1408
  { key: "addressCity", length: 30 }, // 1409
  { key: "addressZip", length: 8 }, // 1410
  { key: "addressCountry", length: 30 }, // 1411
  { key: "countryCode", length: 2 }, // 1412
  { key: "centralAccountKey", length: 15 }, // 1413
  { key: "openingBalance", length: 15 }, // 1414 - "+" חובה, "-" זכות
  { key: "totalDebit", length: 15 }, // 1415
  { key: "totalCredit", length: 15 }, // 1416
  { key: "classificationCode", length: 4 }, // 1417
  { key: "future1418", length: 0 },
  { key: "supplierCustomerVatId", length: 9 }, // 1419
  { key: "future1420", length: 0 },
  { key: "branchId", length: 7 }, // 1421
  { key: "openingBalanceForeign", length: 15 }, // 1422
  { key: "openingBalanceCurrencyCode", length: 3 }, // 1423
  { key: "future1424", length: 16 },
];
