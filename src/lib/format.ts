export function money(n: number | string | null | undefined) {
  const v = Number(n ?? 0);
  return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function shortDate(d: string | Date) {
  const date = new Date(d);
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export const DAYS_AR = [
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];

export const DAYS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function hhmm(t: string) {
  return t?.slice(0, 5) ?? "";
}

export const METHOD_LABELS: Record<string, { ar: string; en: string }> = {
  cash: { ar: "نقدي", en: "Cash" },
  shamcash: { ar: "شام كاش", en: "ShamCash" },
  transfer: { ar: "حوالة", en: "Transfer" },
};
