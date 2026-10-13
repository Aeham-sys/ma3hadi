import type { MonthlyReport } from "@/lib/monthlyReport";
import { EXPENSE_CATEGORIES } from "@/lib/expenseCategories";
import { METHOD_LABELS } from "@/lib/format";

type ExportOptions = {
  instituteName: string;
  lang: "ar" | "en";
  t: (ar: string, en: string) => string;
  monthLabel: string;
};

function plainText(value: string | null | undefined): string {
  return value ?? "";
}

function excelDate(value: string): Date {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  return new Date(Date.UTC(year, month - 1, day));
}

function configureWorksheet(worksheet: import("exceljs").Worksheet, lang: "ar" | "en"): void {
  worksheet.getRow(1).font = { bold: true };
  worksheet.views = [{ rightToLeft: lang === "ar", state: "frozen", ySplit: 1 }];
}

export async function exportMonthlyExcel(
  report: MonthlyReport,
  opts: ExportOptions,
): Promise<void> {
  if (import.meta.env.SSR) {
    throw new Error("Excel export is only available in the browser");
  }

  const mod = await import("exceljs");
  const ExcelJS = ("default" in mod && mod.default ? mod.default : mod) as typeof import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ma3hadi";
  workbook.created = report.generatedAt;

  const { t, lang } = opts;
  const summary = workbook.addWorksheet(t("الملخص", "Summary"));
  summary.views = [{ rightToLeft: lang === "ar", state: "frozen", ySplit: 5 }];
  summary.columns = [{ width: 38 }, { width: 24 }];
  summary.addRow([plainText(opts.instituteName)]);
  summary.addRow([plainText(opts.monthLabel)]);
  summary.addRow([
    t("تاريخ إنشاء التقرير", "Generated at"),
    report.generatedAt.toLocaleString(lang === "ar" ? "ar" : "en"),
  ]);
  summary.addRow([t("على أساس نقدي", "Cash basis")]);
  summary.addRow([t("البند", "Item"), t("المبلغ", "Amount")]);
  summary.getRow(5).font = { bold: true };
  summary.addRows([
    [t("دخل الطلاب", "Student income"), report.totals.income],
    [t("أجور المدرسين", "Teacher wages"), report.totals.wages],
    [t("مصاريف أخرى", "Other expenses"), report.totals.expenses],
    [t("الصافي", "Net"), report.totals.net],
    [t("الدخل حسب طريقة الدفع", "Income by payment method"), ""],
  ]);
  summary.getRow(10).font = { bold: true };
  for (const [method, labels] of Object.entries(METHOD_LABELS)) {
    summary.addRow([
      lang === "ar" ? labels.ar : labels.en,
      Number(report.totals.incomeByMethod[method] ?? 0),
    ]);
  }
  summary.addRow([t("المصاريف حسب التصنيف", "Expenses by category"), ""]);
  summary.getRow(summary.rowCount).font = { bold: true };
  for (const category of EXPENSE_CATEGORIES) {
    summary.addRow([
      t(category.ar, category.en),
      Number(report.totals.expensesByCategory[category.id] ?? 0),
    ]);
  }
  summary.addRow([t("طلاب جدد", "New students"), report.newStudents]);
  for (let row = 6; row <= summary.rowCount; row += 1) {
    summary.getCell(row, 2).numFmt = "#,##0";
  }

  const addDetailSheet = (
    name: string,
    headers: string[],
    columnWidths: number[],
    rows: Array<Array<string | number | Date>>,
    total: number,
    amountColumn: number,
  ) => {
    const sheet = workbook.addWorksheet(name);
    configureWorksheet(sheet, lang);
    sheet.columns = columnWidths.map((width) => ({ width }));
    sheet.addRow(headers);
    sheet.getRow(1).font = { bold: true };
    for (const values of rows) {
      const row = sheet.addRow(values);
      row.getCell(1).numFmt = "yyyy-mm-dd";
      row.eachCell((cell) => {
        if (typeof cell.value === "number") cell.numFmt = "#,##0";
      });
    }
    const totalValues: Array<string | number> = Array.from({ length: headers.length }, () => "");
    totalValues[0] = t("الإجمالي (الفعّالة فقط)", "Total (active only)");
    totalValues[amountColumn - 1] = total;
    const totalRow = sheet.addRow(totalValues);
    totalRow.font = { bold: true };
    totalRow.eachCell((cell) => {
      if (typeof cell.value === "number") cell.numFmt = "#,##0";
    });
    return sheet;
  };

  addDetailSheet(
    t("دفعات الطلاب", "Student payments"),
    [
      t("التاريخ", "Date"),
      t("الطالب", "Student"),
      t("طريقة الدفع", "Method"),
      t("المبلغ", "Amount"),
      t("ملاحظة", "Note"),
      t("الحالة", "Status"),
    ],
    [16, 28, 20, 16, 36, 16],
    report.studentPayments.map((row) => {
      const name = plainText(row.students?.name);
      const rowName =
        row.students?.status === "withdrawn"
          ? `${name}${t(" (منسحب)", " (Withdrawn)")}`
          : name;
      return [
        excelDate(row.date),
        rowName,
        lang === "ar"
          ? (METHOD_LABELS[row.method]?.ar ?? plainText(row.method))
          : (METHOD_LABELS[row.method]?.en ?? plainText(row.method)),
        Number(row.amount),
        plainText(row.note),
        row.status === "cancelled" ? t("ملغاة", "Cancelled") : t("فعّالة", "Active"),
      ];
    }),
    report.totals.income,
    4,
  );
  addDetailSheet(
    t("دفعات المدرسين", "Teacher payments"),
    [
      t("التاريخ", "Date"),
      t("المدرس", "Teacher"),
      t("المبلغ", "Amount"),
      t("ملاحظة", "Note"),
      t("الحالة", "Status"),
    ],
    [16, 28, 16, 36, 16],
    report.teacherPayments.map((row) => [
      excelDate(row.date),
      plainText(row.teachers?.name),
      Number(row.amount),
      plainText(row.note),
      row.status === "cancelled" ? t("ملغاة", "Cancelled") : t("فعّالة", "Active"),
    ]),
    report.totals.wages,
    3,
  );
  addDetailSheet(
    t("المصاريف", "Expenses"),
    [
      t("التاريخ", "Date"),
      t("التصنيف", "Category"),
      t("المبلغ", "Amount"),
      t("ملاحظة", "Note"),
      t("الحالة", "Status"),
    ],
    [16, 32, 16, 36, 16],
    report.expensesRows.map((row) => [
      excelDate(row.date),
      t(
        EXPENSE_CATEGORIES.find((category) => category.id === row.category)?.ar ?? "أخرى",
        EXPENSE_CATEGORIES.find((category) => category.id === row.category)?.en ?? "Other",
      ),
      Number(row.amount),
      plainText(row.note),
      row.status === "cancelled" ? t("ملغاة", "Cancelled") : t("فعّالة", "Active"),
    ]),
    report.totals.expenses,
    3,
  );

  const data = await workbook.xlsx.writeBuffer();
  const blob = new Blob([data], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `ma3hadi-budget-${report.year}-${String(report.month + 1).padStart(2, "0")}.xlsx`;
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
}
