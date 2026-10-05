import { createFileRoute, Link } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { studentBalance, useInstitute, useRefresh } from "@/hooks/useApp";
import type { Institute } from "@/lib/subscription";
import { usePrefs } from "@/lib/i18n";
import { money, METHOD_LABELS, shortDate } from "@/lib/format";
import { isActivePayment } from "@/lib/fees";
import {
  EXPENSE_CATEGORIES,
  expenseCategoryLabel,
  type ExpenseCategoryId,
} from "@/lib/expenseCategories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { FabButton } from "@/components/FabButton";
import { Ban, ChevronLeft, ChevronRight, Pencil, PiggyBank, RotateCcw, Wallet } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type ExpenseRow = {
  id: string;
  category: string;
  amount: number;
  date: string;
  note: string | null;
  status: string;
};

type ExpenseForm = {
  amount: string;
  date: string;
  category: ExpenseCategoryId;
  note: string;
};

type ExpensePatch = {
  category: ExpenseCategoryId;
  amount: number;
  date: string;
  note: string | null;
  status: string;
};

type BudgetSearch = {
  y?: number;
  m?: string | undefined;
};

type InstituteWithCreatedAt = Institute & { created_at?: string | null };

type PageResult<T> = {
  data: T[] | null;
  error: unknown;
};

const PAGE_SIZE = 1000;
const PAYMENT_METHODS = ["cash", "shamcash", "transfer"] as const;
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function localDateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

function monthDate(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-01`;
}

function nextMonthDate(year: number, month: number) {
  const next = new Date(year, month + 1, 1);
  return monthDate(next.getFullYear(), next.getMonth());
}

function currentMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function isValidMonth(value: unknown): value is string {
  return typeof value === "string" && MONTH_PATTERN.test(value);
}

function validateBudgetSearch(search: Record<string, unknown>): BudgetSearch {
  const rawYear = search["y"];
  const parsedYear =
    typeof rawYear === "number"
      ? rawYear
      : typeof rawYear === "string" && rawYear.trim() !== ""
        ? Number(rawYear)
        : Number.NaN;
  const rawMonth = search["m"];
  const month = isValidMonth(rawMonth) && rawMonth <= currentMonthKey() ? rawMonth : undefined;

  return {
    ...(Number.isInteger(parsedYear) ? { y: parsedYear } : {}),
    ...(month ? { m: month } : {}),
  };
}

async function fetchAllPages<T>(
  fetchPage: (from: number, to: number) => Promise<PageResult<T>>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

function instituteSignupYear(institute: InstituteWithCreatedAt, currentYear: number) {
  if (!institute.created_at) return currentYear;
  const createdAt = new Date(institute.created_at);
  if (Number.isNaN(createdAt.getTime())) return currentYear;
  return Math.min(createdAt.getFullYear(), currentYear);
}

export const Route = createFileRoute("/_authenticated/budget")({
  validateSearch: validateBudgetSearch,
  head: () => ({
    meta: [
      { title: "الميزانية — معهدي" },
      { name: "description", content: "تابع دخل المعهد ومصاريفه شهرياً." },
      { property: "og:title", content: "الميزانية — معهدي" },
      { property: "og:description", content: "تابع دخل المعهد ومصاريفه شهرياً." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BudgetPage,
});

function BudgetPage() {
  const { t } = usePrefs();
  const { y, m } = Route.useSearch();
  const {
    data: institute,
    isLoading: instituteLoading,
    error: instituteError,
    refetch: refetchInstitute,
  } = useInstitute();
  const refresh = useRefresh();
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<ExpenseRow | null>(null);

  const openCreateDialog = () => {
    if (!institute) {
      toast.error(t("تعذّر تحميل البيانات", "Could not load data"));
      return;
    }
    setEditingExpense(null);
    setExpenseDialogOpen(true);
  };

  const openEditDialog = (expense: ExpenseRow) => {
    setEditingExpense(expense);
    setExpenseDialogOpen(true);
  };

  const closeExpenseDialog = () => {
    setExpenseDialogOpen(false);
    setEditingExpense(null);
  };

  const saveExpense = async (expense: ExpenseRow | null, patch: ExpensePatch) => {
    try {
      if (!expense) {
        if (!institute) {
          toast.error(t("تعذّر تحميل البيانات", "Could not load data"));
          return false;
        }
        const { error } = await supabase.from("expenses").insert({
          institute_id: institute.id,
          category: patch.category,
          amount: patch.amount,
          date: patch.date,
          note: patch.note,
        });
        if (error) throw error;
        refresh("budget");
        toast.success(t("تم تسجيل المصروف", "Expense added"));
        return true;
      }

      const { data, error } = await supabase
        .from("expenses")
        .update({
          category: patch.category,
          amount: patch.amount,
          date: patch.date,
          note: patch.note,
          status: patch.status,
        })
        .eq("id", expense.id)
        .select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("No expense row was updated");

      refresh("budget");
      toast.success(
        patch.status === "cancelled"
          ? t("تم إلغاء المصروف", "Expense cancelled")
          : expense.status === "cancelled"
            ? t("تمت استعادة المصروف", "Expense restored")
            : t("تم تحديث المصروف", "Expense updated"),
      );
      return true;
    } catch {
      toast.error(
        t("تعذّر حفظ المصروف، جرّب كمان مرة", "Could not save the expense, please try again"),
      );
      return false;
    }
  };

  if (instituteLoading) {
    return (
      <div className="space-y-5 pb-24" aria-busy="true">
        <h1 className="text-xl font-extrabold text-foreground">{t("الميزانية", "Budget")}</h1>
        <div className="h-12 rounded-xl bg-muted" />
        <div className="h-24 rounded-xl bg-muted" />
        <div className="h-16 rounded-xl bg-muted" />
      </div>
    );
  }

  if (instituteError || !institute) {
    return (
      <div className="space-y-4 pb-24">
        <h1 className="text-xl font-extrabold text-foreground">{t("الميزانية", "Budget")}</h1>
        <SectionError onRetry={() => void refetchInstitute()} />
      </div>
    );
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const signupYear = instituteSignupYear(institute as InstituteWithCreatedAt, currentYear);
  const firstYear = Math.min(signupYear, currentYear);
  const listYear = Math.min(currentYear, Math.max(firstYear, y ?? currentYear));
  const requestedMonthYear = m ? Number(m.slice(0, 4)) : undefined;
  const requestedMonth = m ? Number(m.slice(5, 7)) - 1 : undefined;
  const detailIsAvailable =
    !!m &&
    requestedMonthYear !== undefined &&
    requestedMonth !== undefined &&
    requestedMonthYear >= firstYear &&
    requestedMonthYear <= currentYear &&
    m <= currentMonthKey(now);
  const detailYear = detailIsAvailable ? (requestedMonthYear ?? listYear) : listYear;
  const detailMonth = detailIsAvailable ? (requestedMonth ?? 0) : 0;

  return (
    <div className="space-y-5 pb-24">
      {detailIsAvailable ? (
        <BudgetMonthView
          year={detailYear}
          month={detailMonth}
          onEditExpense={openEditDialog}
          onCreateExpense={openCreateDialog}
        />
      ) : (
        <BudgetYearView year={listYear} firstYear={firstYear} currentYear={currentYear} now={now} />
      )}

      <div className="[&_button:focus-visible]:outline-none [&_button:focus-visible]:ring-2 [&_button:focus-visible]:ring-ring [&_button:focus-visible]:ring-offset-2 motion-reduce:[&_button]:transition-none motion-reduce:[&_button]:active:transform-none">
        <FabButton
          label={t("تسجيل مصروف", "Add expense")}
          icon={<Wallet className="size-5" />}
          onClick={openCreateDialog}
        />
      </div>
      <ExpenseDialog
        open={expenseDialogOpen}
        expense={editingExpense}
        onClose={closeExpenseDialog}
        onSave={saveExpense}
      />
    </div>
  );
}

function BudgetYearView({
  year,
  firstYear,
  currentYear,
  now,
}: {
  year: number;
  firstYear: number;
  currentYear: number;
  now: Date;
}) {
  const { t, lang } = usePrefs();
  const totalsQuery = useQuery({
    queryKey: ["budget", "year", year],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("budget_year_totals", { p_year: year });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        month: row.month,
        income: Number(row.income),
        wages: Number(row.wages),
        expenses: Number(row.expenses),
      }));
    },
    placeholderData: keepPreviousData,
  });
  const totals = totalsQuery.data ?? [];
  const totalsReady = totalsQuery.isSuccess && !totalsQuery.isPlaceholderData;
  const yearIncome = totalsReady ? totals.reduce((sum, row) => sum + row.income, 0) : null;
  const yearSpending = totalsReady
    ? totals.reduce((sum, row) => sum + row.wages + row.expenses, 0)
    : null;
  const yearNet = yearIncome !== null && yearSpending !== null ? yearIncome - yearSpending : null;
  const currentKey = currentMonthKey(now);

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold text-foreground">{t("الميزانية", "Budget")}</h1>
        <div className="flex items-center gap-2">
          {year > firstYear ? (
            <Link
              to="/budget"
              search={{ y: year - 1, m: undefined }}
              aria-label={t("السنة السابقة", "Previous year")}
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-input bg-background text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <ChevronLeft className="size-4 icon-flip" />
            </Link>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={t("السنة السابقة", "Previous year")}
              className="h-11 w-11"
              disabled
            >
              <ChevronLeft className="size-4 icon-flip" />
            </Button>
          )}
          <span className="min-w-16 text-center text-base font-extrabold text-foreground">
            {year}
          </span>
          {year < currentYear ? (
            <Link
              to="/budget"
              search={{ y: year + 1, m: undefined }}
              aria-label={t("السنة التالية", "Next year")}
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-input bg-background text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <ChevronRight className="size-4 icon-flip" />
            </Link>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={t("السنة التالية", "Next year")}
              className="h-11 w-11"
              disabled
            >
              <ChevronRight className="size-4 icon-flip" />
            </Button>
          )}
        </div>
      </div>

      <section
        aria-label={t("إجمالي السنة", "Year totals")}
        className="grid grid-cols-3 gap-2 border-y border-border py-3"
      >
        <YearMetric label={t("الدخل", "Income")} amount={yearIncome} tone="income" />
        <YearMetric label={t("الإنفاق", "Spending")} amount={yearSpending} tone="spending" />
        <YearMetric label={t("الصافي", "Net")} amount={yearNet} tone="net" />
      </section>

      <div aria-live="polite">
        {totalsQuery.isError ? (
          <SectionError onRetry={() => void totalsQuery.refetch()} />
        ) : totalsQuery.isPending || totalsQuery.isPlaceholderData ? (
          <LoadingRows />
        ) : (
          <ol className="divide-y divide-border">
            {Array.from({ length: 12 }, (_, month) => {
              const key = `${year}-${String(month + 1).padStart(2, "0")}`;
              const row = totals.find((item) => item.month.slice(0, 7) === key);
              const income = Number(row?.income ?? 0);
              const spending = Number(row?.wages ?? 0) + Number(row?.expenses ?? 0);
              const net = income - spending;
              const future = key > currentKey;
              const current = key === currentKey;
              const ratio =
                income > 0
                  ? Math.min(100, Math.max(0, (spending / income) * 100))
                  : spending > 0
                    ? 100
                    : 0;
              const monthLabel = new Date(year, month, 1).toLocaleDateString(
                lang === "ar" ? "ar" : "en",
                { month: "long" },
              );
              const content = (
                <>
                  <span className="w-full font-bold text-foreground">{monthLabel}</span>
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm">
                    <span className="text-muted-foreground">
                      {t("دخل", "Income")} <MoneyValue amount={income} />
                    </span>
                    <span className="text-muted-foreground">
                      {t("إنفاق", "Spending")} <MoneyValue amount={spending} />
                    </span>
                    <span
                      className={net >= 0 ? "font-bold text-success" : "font-bold text-destructive"}
                    >
                      {t("صافي", "Net")} <MoneyValue amount={net} />
                    </span>
                  </span>
                  {ratio > 0 && (
                    <span
                      className="block h-1.5 w-full overflow-hidden rounded-full bg-muted"
                      aria-hidden="true"
                    >
                      <span
                        className={`block h-full rounded-full ${
                          income <= 0 && spending > 0 ? "bg-destructive" : "bg-primary"
                        }`}
                        style={{ width: `${ratio}%` }}
                      />
                    </span>
                  )}
                </>
              );

              return (
                <li key={key}>
                  {future ? (
                    <div
                      aria-disabled="true"
                      className="grid min-h-20 gap-2 py-3 opacity-45 sm:grid-cols-[minmax(6rem,0.7fr)_minmax(0,2fr)] sm:items-center"
                    >
                      {content}
                    </div>
                  ) : (
                    <Link
                      to="/budget"
                      search={{ y: year, m: key }}
                      aria-current={current ? "date" : undefined}
                      className={`grid min-h-20 gap-2 rounded-xl py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:grid-cols-[minmax(6rem,0.7fr)_minmax(0,2fr)] sm:items-center ${
                        current ? "bg-accent/50 px-3" : "px-1 hover:bg-muted/40"
                      }`}
                    >
                      {content}
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}

function BudgetMonthView({
  year,
  month,
  onEditExpense,
  onCreateExpense,
}: {
  year: number;
  month: number;
  onEditExpense: (expense: ExpenseRow) => void;
  onCreateExpense: () => void;
}) {
  const { t, lang } = usePrefs();
  const startDate = monthDate(year, month);
  const endDate = nextMonthDate(year, month);
  const startInstant = new Date(year, month, 1).toISOString();
  const endInstant = new Date(year, month + 1, 1).toISOString();

  const incomeQuery = useQuery({
    queryKey: ["budget", "month", year, month, "income"],
    queryFn: () =>
      fetchAllPages(async (from, to) => {
        const response = await supabase
          .from("payments")
          .select("amount, method")
          .eq("status", "active")
          .gte("date", startDate)
          .lt("date", endDate)
          .order("id", { ascending: true })
          .range(from, to);
        return { data: response.data, error: response.error };
      }),
    placeholderData: keepPreviousData,
  });
  const wagesQuery = useQuery({
    queryKey: ["budget", "month", year, month, "wages"],
    queryFn: () =>
      fetchAllPages(async (from, to) => {
        const response = await supabase
          .from("teacher_payments")
          .select("amount")
          .eq("status", "active")
          .gte("date", startDate)
          .lt("date", endDate)
          .order("id", { ascending: true })
          .range(from, to);
        return { data: response.data, error: response.error };
      }),
    placeholderData: keepPreviousData,
  });
  const expensesQuery = useQuery({
    queryKey: ["budget", "month", year, month, "expenses"],
    queryFn: () =>
      fetchAllPages(async (from, to) => {
        const response = await supabase
          .from("expenses")
          .select("id, category, amount, date, note, status")
          .gte("date", startDate)
          .lt("date", endDate)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(from, to);
        return { data: response.data, error: response.error };
      }),
    placeholderData: keepPreviousData,
  });
  const newStudentsQuery = useQuery({
    queryKey: ["budget", "month", year, month, "new-students"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("students")
        .select("id", { count: "exact", head: true })
        .gte("created_at", startInstant)
        .lt("created_at", endInstant);
      if (error) throw error;
      return count ?? 0;
    },
    placeholderData: keepPreviousData,
  });
  const studentsQuery = useQuery({
    queryKey: ["budget", "students"],
    queryFn: () =>
      fetchAllPages(async (from, to) => {
        const response = await supabase
          .from("students")
          .select(
            "id, student_courses(id, custom_fee, teacher_id, courses(id,name,price, teacher_courses(teacher_id, price))), payments(id,amount,status)",
          )
          .order("id", { ascending: true })
          .range(from, to);
        return { data: response.data, error: response.error };
      }),
    placeholderData: keepPreviousData,
  });

  const currentIncome = incomeQuery.isPlaceholderData ? undefined : incomeQuery.data;
  const currentWages = wagesQuery.isPlaceholderData ? undefined : wagesQuery.data;
  const currentExpenses = expensesQuery.isPlaceholderData ? undefined : expensesQuery.data;
  const activeExpenses = (currentExpenses ?? []).filter(isActivePayment);
  const incomeTotal = currentIncome?.reduce((sum, payment) => sum + Number(payment.amount), 0) ?? 0;
  const wagesTotal = currentWages?.reduce((sum, payment) => sum + Number(payment.amount), 0) ?? 0;
  const expensesTotal = activeExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const financialDataReady =
    incomeQuery.isSuccess &&
    !incomeQuery.isPlaceholderData &&
    wagesQuery.isSuccess &&
    !wagesQuery.isPlaceholderData &&
    expensesQuery.isSuccess &&
    !expensesQuery.isPlaceholderData;
  const net = financialDataReady ? incomeTotal - wagesTotal - expensesTotal : null;
  const monthTitle = new Date(year, month, 1).toLocaleDateString(lang === "ar" ? "ar" : "en", {
    month: "long",
  });
  const categoryTotals = EXPENSE_CATEGORIES.map((category) => {
    const amount = activeExpenses
      .filter((expense) => expense.category === category.id)
      .reduce((sum, expense) => sum + Number(expense.amount), 0);
    return {
      ...category,
      amount,
      share: expensesTotal > 0 ? (amount / expensesTotal) * 100 : 0,
    };
  }).filter((category) => category.amount > 0);
  const students = studentsQuery.data ?? [];
  const totalOutstanding = students.reduce(
    (sum, student) => sum + Math.max(0, studentBalance(student).owed),
    0,
  );
  const studentsReady = studentsQuery.isSuccess && !studentsQuery.isPlaceholderData;
  const newStudentsReady = newStudentsQuery.isSuccess && !newStudentsQuery.isPlaceholderData;
  const incomeReady = incomeQuery.isSuccess && !incomeQuery.isPlaceholderData;
  const wagesReady = wagesQuery.isSuccess && !wagesQuery.isPlaceholderData;
  const expensesReady = expensesQuery.isSuccess && !expensesQuery.isPlaceholderData;
  const currentMonthExpenses = expensesReady ? (currentExpenses ?? []) : [];

  return (
    <section className="space-y-5">
      <header className="space-y-3">
        <Link
          to="/budget"
          search={{ y: year, m: undefined }}
          className="inline-flex min-h-11 items-center gap-1 rounded-lg pr-2 text-sm font-semibold text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <ChevronLeft className="size-4 icon-flip" />
          {t("كل الأشهر", "All months")}
        </Link>
        <div>
          <h1 className="text-xl font-extrabold text-foreground">
            {monthTitle} {year}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {t(
              "على أساس نقدي: يُحتسب ما تم قبضه وصرفه فعليًا خلال الشهر",
              "Cash basis: only amounts actually collected/paid in the month",
            )}
          </p>
        </div>
      </header>

      <section className="rounded-2xl border border-primary/15 bg-card p-5 shadow-lift sm:p-7">
        <p className="text-sm font-semibold text-muted-foreground">{t("الصافي", "Net")}</p>
        <p
          className={`num mt-2 text-4xl font-extrabold sm:text-5xl ${
            net === null ? "text-muted-foreground" : net >= 0 ? "text-success" : "text-destructive"
          }`}
        >
          <MoneyValue amount={net} />
        </p>
      </section>

      <section aria-label={t("كشف الشهر", "Monthly statement")} className="divide-y divide-border">
        <StatementLine
          label={t("دخل الطلاب", "Student income")}
          amount={incomeReady ? incomeTotal : null}
          prefix="+"
          error={incomeQuery.isError}
          onRetry={() => void incomeQuery.refetch()}
        />
        <StatementLine
          label={t("أجور المدرسين", "Teacher wages")}
          amount={wagesReady ? wagesTotal : null}
          prefix="−"
          error={wagesQuery.isError}
          onRetry={() => void wagesQuery.refetch()}
        />
        <StatementLine
          label={t("مصاريف أخرى", "Other expenses")}
          amount={expensesReady ? expensesTotal : null}
          prefix="−"
          error={expensesQuery.isError}
          onRetry={() => void expensesQuery.refetch()}
        />
        <div className="flex items-center justify-between gap-3 py-3 font-extrabold text-foreground">
          <span>= {t("الصافي", "Net")}</span>
          <MoneyValue
            amount={net}
            className={
              net === null
                ? "text-muted-foreground"
                : net >= 0
                  ? "text-success"
                  : "text-destructive"
            }
          />
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-base font-extrabold text-foreground">
            {t("مصاريف الشهر", "Expenses")}
          </h2>
          {expensesQuery.isError ? (
            <div className="mt-3">
              <SectionError onRetry={() => void expensesQuery.refetch()} />
            </div>
          ) : expensesQuery.isPending || expensesQuery.isPlaceholderData ? (
            <LoadingRows />
          ) : currentMonthExpenses.length === 0 ? (
            <div className="mt-3">
              <div className="[&_button]:min-h-11">
                <EmptyState
                  icon={<PiggyBank className="size-6" />}
                  title={t("ما في مصاريف بهالشهر", "No expenses this month")}
                  description={t(
                    "سجّل أول مصروف حتى تتابع تكاليف المعهد.",
                    "Add your first expense to track institute costs.",
                  )}
                  actionLabel={t("تسجيل مصروف", "Add expense")}
                  onAction={onCreateExpense}
                />
              </div>
            </div>
          ) : (
            <ul className="mt-2 divide-y divide-border">
              {currentMonthExpenses.map((expense) => {
                const cancelled = !isActivePayment(expense);
                return (
                  <li
                    key={expense.id}
                    className="flex min-h-16 items-center justify-between gap-3 py-2"
                  >
                    <div className="min-w-0">
                      <p
                        className={`num text-sm font-bold ${
                          cancelled ? "text-muted-foreground line-through" : "text-foreground"
                        }`}
                      >
                        <MoneyValue amount={expense.amount} />
                      </p>
                      <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span className="break-words [overflow-wrap:anywhere]">
                          {expenseCategoryLabel(expense.category, t)}
                          {expense.note ? ` · ${expense.note}` : ""}
                        </span>
                        {cancelled && (
                          <span className="flex items-center gap-1 rounded-lg bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive">
                            <Ban className="size-3" />
                            {t("ملغاة", "Cancelled")}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="num text-xs text-muted-foreground">
                        {shortDate(expense.date)}
                      </span>
                      <button
                        type="button"
                        onClick={() => onEditExpense(expense)}
                        aria-label={t("تعديل المصروف", "Edit expense")}
                        className="flex h-11 w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <Pencil className="size-4" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-border pt-4">
          <h3 className="text-sm font-bold text-foreground">
            {t("المصاريف حسب التصنيف", "Expenses by category")}
          </h3>
          {expensesQuery.isError ? null : expensesQuery.isPending ||
            expensesQuery.isPlaceholderData ? (
            <LoadingRows />
          ) : categoryTotals.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {t("ما في مصاريف أخرى بهالشهر.", "No other expenses this month.")}
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {categoryTotals.map((category) => (
                <li key={category.id}>
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="truncate font-semibold text-foreground">
                      {t(category.ar, category.en)}
                    </span>
                    <MoneyValue
                      amount={category.amount}
                      className="shrink-0 text-muted-foreground"
                    />
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${category.share}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="space-y-2 border-t border-border pt-4">
        <h2 className="text-sm font-bold text-foreground">
          {t("الدخل حسب طريقة الدفع", "Income by payment method")}
        </h2>
        {incomeQuery.isError ? (
          <SectionError onRetry={() => void incomeQuery.refetch()} />
        ) : incomeQuery.isPending || incomeQuery.isPlaceholderData ? (
          <LoadingRows />
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {PAYMENT_METHODS.map((method) => {
              const amount = (currentIncome ?? [])
                .filter((payment) => payment.method === method)
                .reduce((sum, payment) => sum + Number(payment.amount), 0);
              return (
                <div key={method} className="min-w-0">
                  <p className="truncate text-xs font-semibold text-muted-foreground">
                    {lang === "ar"
                      ? (METHOD_LABELS[method]?.ar ?? method)
                      : (METHOD_LABELS[method]?.en ?? method)}
                  </p>
                  <MoneyValue
                    amount={amount}
                    className="mt-1 text-sm font-extrabold text-foreground"
                  />
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-2 border-t border-border pt-4">
        <h2 className="text-sm font-bold text-foreground">
          {t("معلومات الطلاب", "Student information")}
        </h2>
        {(studentsQuery.isError || newStudentsQuery.isError) && (
          <SectionError
            onRetry={() => {
              if (studentsQuery.isError) void studentsQuery.refetch();
              if (newStudentsQuery.isError) void newStudentsQuery.refetch();
            }}
          />
        )}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <StudentMetric
            label={t("إجمالي الطلاب", "Total students")}
            value={studentsReady ? money(students.length) : "—"}
          />
          <StudentMetric
            label={t("طلاب جدد هالشهر", "New this month")}
            value={newStudentsReady ? money(newStudentsQuery.data ?? 0) : "—"}
          />
          <StudentMetric
            label={t(
              "ذمم مستحقة (للعلم، غير محسوبة بالصافي)",
              "Outstanding dues (info only, not in net)",
            )}
            value={studentsReady ? money(totalOutstanding) : "—"}
          />
        </div>
      </section>
    </section>
  );
}

function MoneyValue({
  amount,
  prefix = "",
  className = "",
}: {
  amount: number | null;
  prefix?: string;
  className?: string;
}) {
  return (
    <span dir="ltr" className={`num inline-block ${className}`}>
      {amount === null ? "—" : `${prefix}${money(amount)}`}
    </span>
  );
}

function YearMetric({
  label,
  amount,
  tone,
}: {
  label: string;
  amount: number | null;
  tone: "income" | "spending" | "net";
}) {
  const color =
    tone === "income"
      ? "text-success"
      : tone === "spending"
        ? "text-foreground"
        : amount === null
          ? "text-muted-foreground"
          : amount >= 0
            ? "text-success"
            : "text-destructive";
  return (
    <div className="min-w-0">
      <p className="truncate text-[11px] font-semibold text-muted-foreground">{label}</p>
      <MoneyValue amount={amount} className={`mt-1 text-sm font-extrabold ${color}`} />
    </div>
  );
}

function StatementLine({
  label,
  amount,
  prefix,
  error,
  onRetry,
}: {
  label: string;
  amount: number | null;
  prefix: string;
  error: boolean;
  onRetry: () => void;
}) {
  const { t } = usePrefs();
  return (
    <div className="flex min-h-12 flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2 text-sm">
      <span className="min-w-0 flex-1 text-muted-foreground">{label}</span>
      <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
        {error && (
          <>
            <span className="text-xs text-destructive">
              {t("تعذّر تحميل البيانات", "Could not load data")}
            </span>
            <button
              type="button"
              onClick={onRetry}
              className="min-h-11 rounded-lg px-2 text-xs font-semibold text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {t("إعادة المحاولة", "Retry")}
            </button>
          </>
        )}
        <MoneyValue
          amount={amount}
          prefix={amount === null ? "" : prefix}
          className={amount === null ? "text-muted-foreground" : "font-semibold text-foreground"}
        />
      </div>
    </div>
  );
}

function StudentMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="min-h-8 text-[10px] font-semibold leading-4 text-muted-foreground sm:text-[11px]">
        {label}
      </p>
      <p className="text-sm font-bold text-foreground">
        <span dir="ltr" className="num inline-block">
          {value}
        </span>
      </p>
    </div>
  );
}

function SectionError({ onRetry }: { onRetry: () => void }) {
  const { t } = usePrefs();
  return (
    <div className="flex flex-wrap items-center gap-2 py-3" role="alert">
      <p className="text-sm text-destructive">{t("تعذّر تحميل البيانات", "Could not load data")}</p>
      <Button variant="outline" size="sm" onClick={onRetry} className="min-h-11">
        {t("إعادة المحاولة", "Try again")}
      </Button>
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-3 py-3" aria-hidden="true">
      <div className="h-12 rounded-xl bg-muted" />
      <div className="h-12 rounded-xl bg-muted" />
      <div className="h-12 rounded-xl bg-muted" />
    </div>
  );
}

function ExpenseDialog({
  open,
  expense,
  onClose,
  onSave,
}: {
  open: boolean;
  expense: ExpenseRow | null;
  onClose: () => void;
  onSave: (expense: ExpenseRow | null, patch: ExpensePatch) => Promise<boolean>;
}) {
  const { t } = usePrefs();
  const [form, setForm] = useState<ExpenseForm>({
    amount: "",
    date: localDateString(new Date()),
    category: "other",
    note: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(
      expense
        ? {
            amount: String(expense.amount),
            date: expense.date,
            category: EXPENSE_CATEGORIES.some((category) => category.id === expense.category)
              ? (expense.category as ExpenseCategoryId)
              : "other",
            note: expense.note ?? "",
          }
        : {
            amount: "",
            date: localDateString(new Date()),
            category: "other",
            note: "",
          },
    );
  }, [expense, open]);

  const cancelled = expense ? !isActivePayment(expense) : false;

  const submit = async (status: string) => {
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error(t("أدخل مبلغ صحيح", "Enter a valid amount"));
      return;
    }
    if (!form.date) {
      toast.error(t("أدخل التاريخ", "Enter a date"));
      return;
    }
    if (!EXPENSE_CATEGORIES.some((category) => category.id === form.category)) {
      toast.error(t("اختر تصنيف صحيح", "Choose a valid category"));
      return;
    }
    if (form.note.length > 500) {
      toast.error(t("الملاحظة أطول من المسموح", "The note is too long"));
      return;
    }
    setSaving(true);
    const ok = await onSave(expense, {
      category: form.category,
      amount,
      date: form.date,
      note: form.note || null,
      status,
    });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>
            {expense ? t("تعديل المصروف", "Edit expense") : t("تسجيل مصروف", "Add expense")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3.5">
          {cancelled && (
            <p className="flex items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
              <Ban className="size-4" />
              {t(
                "هالمصروف ملغى وما بينحسب بالإجمالي.",
                "This expense is cancelled and excluded from totals.",
              )}
            </p>
          )}
          <div className="space-y-1.5">
            <Label>{t("المبلغ", "Amount")}</Label>
            <Input
              dir="ltr"
              type="number"
              inputMode="numeric"
              value={form.amount}
              onChange={(event) => setForm({ ...form, amount: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("التاريخ", "Date")}</Label>
            <Input
              dir="ltr"
              type="date"
              value={form.date}
              onChange={(event) => setForm({ ...form, date: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("التصنيف", "Category")}</Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {EXPENSE_CATEGORIES.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setForm({ ...form, category: category.id })}
                  className={`min-h-11 rounded-xl px-2 py-2.5 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                    form.category === category.id
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {t(category.ar, category.en)}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t("ملاحظة", "Note")}</Label>
            <Textarea
              rows={2}
              maxLength={500}
              value={form.note}
              onChange={(event) => setForm({ ...form, note: event.target.value })}
            />
          </div>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            onClick={() => void submit(cancelled ? "cancelled" : "active")}
            disabled={saving}
            size="lg"
            className="min-h-11 w-full"
          >
            {saving
              ? t("لحظة…", "Saving…")
              : expense
                ? t("حفظ التعديلات", "Save changes")
                : t("تسجيل المصروف", "Add expense")}
          </Button>
          {expense &&
            (cancelled ? (
              <Button
                variant="outline"
                onClick={() => void submit("active")}
                disabled={saving}
                className="min-h-11 w-full"
              >
                <RotateCcw className="size-4" />
                {t("استعادة المصروف", "Restore expense")}
              </Button>
            ) : (
              <Button
                variant="destructive"
                onClick={() => void submit("cancelled")}
                disabled={saving}
                className="min-h-11 w-full"
              >
                <Ban className="size-4" />
                {t("إلغاء المصروف (بدون حذف)", "Cancel expense (keep record)")}
              </Button>
            ))}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
