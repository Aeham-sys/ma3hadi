export type ExpenseCategoryId =
  "rent" | "utilities" | "supplies" | "marketing" | "maintenance" | "staff" | "other";

export const EXPENSE_CATEGORIES: { id: ExpenseCategoryId; ar: string; en: string }[] = [
  { id: "rent", ar: "إيجار", en: "Rent" },
  { id: "utilities", ar: "كهرباء وماء وإنترنت", en: "Utilities" },
  { id: "supplies", ar: "قرطاسية ومستلزمات", en: "Supplies" },
  { id: "marketing", ar: "دعاية وتسويق", en: "Marketing" },
  { id: "maintenance", ar: "صيانة", en: "Maintenance" },
  { id: "staff", ar: "رواتب الموظفين (غير المدرسين)", en: "Staff salaries (non-teachers)" },
  { id: "other", ar: "أخرى", en: "Other" },
];

export function expenseCategoryLabel(id: string, t: (ar: string, en: string) => string): string {
  const category = EXPENSE_CATEGORIES.find((item) => item.id === id);
  return category ? t(category.ar, category.en) : t("أخرى", "Other");
}
