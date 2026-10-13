import { createPortal } from "react-dom";
import { EXPENSE_CATEGORIES } from "@/lib/expenseCategories";
import { METHOD_LABELS, money, shortDate } from "@/lib/format";
import type { MonthlyReport } from "@/lib/monthlyReport";

type MonthlyReportPrintProps = {
  report: MonthlyReport;
  instituteName: string;
  lang: "ar" | "en";
  t: (ar: string, en: string) => string;
  monthLabel: string;
};

export function MonthlyReportPrint({
  report,
  instituteName,
  lang,
  t,
  monthLabel,
}: MonthlyReportPrintProps) {
  if (typeof document === "undefined") return null;

  const direction = lang === "ar" ? "rtl" : "ltr";
  const currentMonth = new Date();
  const isPartialMonth =
    currentMonth.getFullYear() === report.year && currentMonth.getMonth() === report.month;
  const activeStudents = report.studentPayments.filter((row) => row.status === "active");
  const activeTeachers = report.teacherPayments.filter((row) => row.status === "active");
  const activeExpenses = report.expensesRows.filter((row) => row.status === "active");
  const cancelledCount =
    report.counts.studentPayments.cancelled +
    report.counts.teacherPayments.cancelled +
    report.counts.expenses.cancelled;
  const methodLabel = (method: string) =>
    lang === "ar" ? (METHOD_LABELS[method]?.ar ?? method) : (METHOD_LABELS[method]?.en ?? method);
  const categoryLabel = (id: string) => {
    const category = EXPENSE_CATEGORIES.find((item) => item.id === id);
    return category ? t(category.ar, category.en) : t("أخرى", "Other");
  };
  const amount = (value: number) => (
    <span dir="ltr" className="amount">
      {money(value)}
    </span>
  );

  return createPortal(
    <main id="monthly-report-print" dir={direction} lang={lang}>
      <style>{`
        @media screen {
          #monthly-report-print { display: none; }
        }
        @media print {
          body > *:not(#monthly-report-print) { display: none !important; }
          #monthly-report-print { display: block; }
          @page { size: A4; margin: 14mm; }
        }
        #monthly-report-print {
          color: #111;
          background: #fff;
          direction: ${direction};
          font-family: Arial, Tahoma, sans-serif;
          font-size: 10pt;
          line-height: 1.45;
        }
        #monthly-report-print h1 { margin: 0 0 4px; font-size: 20pt; }
        #monthly-report-print h2 { margin: 18px 0 7px; font-size: 13pt; }
        #monthly-report-print p { margin: 3px 0; }
        #monthly-report-print .statement {
          margin-top: 14px;
          border-block: 1px solid #333;
        }
        #monthly-report-print .statement p {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          margin: 0;
          padding: 5px 0;
          border-bottom: 1px solid #bbb;
        }
        #monthly-report-print .statement p:last-child { border-bottom: 0; font-weight: 700; }
        #monthly-report-print .amount { white-space: nowrap; direction: ltr; }
        #monthly-report-print table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 6px;
          font-size: 9pt;
        }
        #monthly-report-print thead { display: table-header-group; }
        #monthly-report-print th,
        #monthly-report-print td {
          border: 1px solid #555;
          padding: 4px 6px;
          text-align: start;
          overflow-wrap: anywhere;
        }
        #monthly-report-print th { font-weight: 700; }
        #monthly-report-print tr { break-inside: avoid; }
        #monthly-report-print .summary-list {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 3px 18px;
        }
        #monthly-report-print .footnote { margin-top: 6px; font-size: 9pt; }
      `}</style>
      <header>
        <h1>{instituteName}</h1>
        <p>{monthLabel}</p>
        <p>
          {t("تاريخ إنشاء التقرير", "Generated at")}:{" "}
          {report.generatedAt.toLocaleString(lang === "ar" ? "ar" : "en")}
        </p>
        <p>{t("على أساس نقدي", "Cash basis")}</p>
        {isPartialMonth && <p>{t("شهر جزئي حتى تاريخه", "Partial month to date")}</p>}
      </header>

      <section className="statement" aria-label={t("كشف الشهر", "Monthly statement")}>
        <h2>{t("كشف الشهر", "Monthly statement")}</h2>
        <p>
          <span>{t("دخل الطلاب", "Student income")} (+)</span>
          {amount(report.totals.income)}
        </p>
        <p>
          <span>{t("أجور المدرسين", "Teacher wages")} (−)</span>
          {amount(report.totals.wages)}
        </p>
        <p>
          <span>{t("مصاريف أخرى", "Other expenses")} (−)</span>
          {amount(report.totals.expenses)}
        </p>
        <p>
          <span>= {t("الصافي", "Net")}</span>
          {amount(report.totals.net)}
        </p>
      </section>

      <section>
        <h2>{t("الدخل حسب طريقة الدفع", "Income by payment method")}</h2>
        <div className="summary-list">
          {Object.entries(METHOD_LABELS).map(([method, labels]) => (
            <p key={method}>
              {lang === "ar" ? labels.ar : labels.en}:{" "}
              {amount(report.totals.incomeByMethod[method] ?? 0)}
            </p>
          ))}
        </div>
      </section>

      <section>
        <h2>{t("المصاريف حسب التصنيف", "Expenses by category")}</h2>
        <div className="summary-list">
          {EXPENSE_CATEGORIES.map((category) => (
            <p key={category.id}>
              {t(category.ar, category.en)}:{" "}
              {amount(report.totals.expensesByCategory[category.id] ?? 0)}
            </p>
          ))}
        </div>
      </section>

      <section>
        <h2>{t("دفعات الطلاب", "Student payments")}</h2>
        <table>
          <thead>
            <tr>
              <th>{t("التاريخ", "Date")}</th>
              <th>{t("الطالب", "Student")}</th>
              <th>{t("طريقة الدفع", "Method")}</th>
              <th>{t("المبلغ", "Amount")}</th>
              <th>{t("ملاحظة", "Note")}</th>
            </tr>
          </thead>
          <tbody>
            {activeStudents.map((row) => {
              const name = row.students?.name ?? "";
              const displayName =
                row.students?.status === "withdrawn"
                  ? `${name}${t(" (منسحب)", " (Withdrawn)")}`
                  : name;
              return (
                <tr key={row.id}>
                  <td>{shortDate(row.date)}</td>
                  <td>{displayName}</td>
                  <td>{methodLabel(row.method)}</td>
                  <td>{amount(Number(row.amount))}</td>
                  <td>{row.note ?? ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section>
        <h2>{t("دفعات المدرسين", "Teacher payments")}</h2>
        <table>
          <thead>
            <tr>
              <th>{t("التاريخ", "Date")}</th>
              <th>{t("المدرس", "Teacher")}</th>
              <th>{t("المبلغ", "Amount")}</th>
              <th>{t("ملاحظة", "Note")}</th>
            </tr>
          </thead>
          <tbody>
            {activeTeachers.map((row) => (
              <tr key={row.id}>
                <td>{shortDate(row.date)}</td>
                <td>{row.teachers?.name ?? ""}</td>
                <td>{amount(Number(row.amount))}</td>
                <td>{row.note ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2>{t("المصاريف", "Expenses")}</h2>
        <table>
          <thead>
            <tr>
              <th>{t("التاريخ", "Date")}</th>
              <th>{t("التصنيف", "Category")}</th>
              <th>{t("المبلغ", "Amount")}</th>
              <th>{t("ملاحظة", "Note")}</th>
            </tr>
          </thead>
          <tbody>
            {activeExpenses.map((row) => (
              <tr key={row.id}>
                <td>{shortDate(row.date)}</td>
                <td>{categoryLabel(row.category)}</td>
                <td>{amount(Number(row.amount))}</td>
                <td>{row.note ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {cancelledCount > 0 && (
        <p className="footnote">
          {cancelledCount} {t("سجلات ملغاة مستبعدة", "cancelled records excluded")}
        </p>
      )}
    </main>,
    document.body,
  );
}
